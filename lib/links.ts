import "server-only";

import { getFileMetadata, serviceAccountEmail } from "@/lib/drive";

/**
 * lib/links.ts — geplakte Google Drive-links automatisch naar hun echte
 * documentnaam omzetten, 08-09-2026 op Maartens verzoek: plakt hij een kale
 * Drive-/Docs-/Sheets-/Slides-link ergens in een notitie- of opmerkingveld
 * (Takenlijst, Developerbord, Notities-tab — overal), dan moet die vanzelf
 * gaan linken MET de echte titel van het document als linktekst, in plaats
 * van de kale URL. Precies wat hij al als vaste regel had voor door Claude
 * opgeleverde documenten ("de link krijgt de naam als linktekst vanzelf"),
 * nu ook voor links die hij zelf met de hand plakt.
 *
 * Twee stappen, bewust gescheiden:
 * 1. Hier, bij het OPSLAAN (server actions): een kale Drive-URL wordt één
 *    keer omgezet naar `[Titel](url)`-markdown-syntax en zo weggeschreven
 *    naar het dossierbestand zelf — dus ook leesbaar/bruikbaar voor wie het
 *    bestand rechtstreeks in Drive opent, en geen herhaalde Drive-API-call
 *    bij elke pagina-render (de service-account-quota is al eerder een
 *    probleem geweest, zie het "schrijven naar Drive faalde altijd"-fixje).
 * 2. In lib/markdown.ts (renderCel): een kale URL die HIER niet is opgelost
 *    (geen Drive-link, of de opzoeking mislukte — bijv. een document dat
 *    niet met het service-account is gedeeld) wordt nog steeds automatisch
 *    klikbaar gemaakt, alleen dan met de URL zelf als linktekst. Die
 *    autolink-regex bestond al (08-09-2026, Notities-tab); dit bestand voegt
 *    er alleen de titel-opzoeking voor Drive-links aan toe.
 *
 * Bewust NIET gedaan: title-opzoeking voor niet-Drive-URL's (bijv. de live
 * website van een klant). Dat zou een willekeurige pagina moeten ophalen en
 * de <title> eruit parsen — een heel andere, foutgevoeligere operatie dan
 * het Drive-API'tje dat hier al beschikbaar is, en niet wat Maarten vroeg
 * ("de titel van het document" — dat zijn hier steeds Drive-documenten).
 */

/**
 * De titel van een gewone webpagina ophalen (09-09-2026, op verzoek: "als ik
 * een link plak wil ik gewoon de titel zien, of het nu een webpagina, een
 * document of een sheet is"). Dit stond hierboven eerst als bewust NIET
 * gedaan; Maarten wil het wel.
 *
 * Bewust klein gehouden en nooit blokkerend:
 * - alleen http en https, en geen adressen op het eigen netwerk;
 * - drie seconden geduld, daarna geen titel;
 * - hooguit de eerste 200 kB, want we hebben alleen de <head> nodig;
 * - elke fout betekent gewoon "geen titel", nooit een mislukte opslag.
 */
const PRIVATE_HOSTS =
  /^(?:localhost|127\.|0\.|10\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|\[?::1)/i;

function tekenreeksTerug(tekst: string): string {
  return tekst
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&rsquo;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_h, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/\s+/g, " ")
    .trim();
}

/** De titel uit een stuk HTML halen. Los testbaar, zonder netwerk. */
export function titelUitHtml(html: string): string | null {
  const ogTitel = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i.exec(html);
  const titel = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const gevonden = tekenreeksTerug(ogTitel?.[1] ?? titel?.[1] ?? "");
  return gevonden.length > 0 && gevonden.length < 300 ? gevonden : null;
}

/** Mag deze url opgehaald worden? Geen adressen op het eigen netwerk. */
export function magOpgehaaldWorden(url: string): boolean {
  try {
    const adres = new URL(url);
    if (adres.protocol !== "http:" && adres.protocol !== "https:") return false;
    return !PRIVATE_HOSTS.test(adres.hostname);
  } catch {
    return false;
  }
}

/**
 * Waarom er geen titel is. Niet om mee te rekenen, alleen om op het scherm
 * één begrijpelijke zin van te maken (09-09-2026): "geen titel gevonden" laat
 * je zoeken, "dit document is niet gedeeld met de cockpit" is meteen op te
 * lossen. Gemeten aanleiding: een geplakte Google Docs-link gaf 401 en een
 * Cowork-link 403, en op het scherm bleef in beide gevallen alleen de kale
 * url staan zonder één woord uitleg.
 */
export type TitelReden =
  | "gevonden"
  | "geen-drive-toegang"
  | "inloggen-nodig"
  | "niet-bereikbaar"
  | "geen-titel";

export interface TitelUitslag {
  titel: string | null;
  reden: TitelReden;
}

export async function titelVanWebpaginaMetReden(url: string): Promise<TitelUitslag> {
  if (!magOpgehaaldWorden(url)) return { titel: null, reden: "niet-bereikbaar" };
  const adres = new URL(url);

  const stop = AbortSignal.timeout(3000);
  try {
    const res = await fetch(adres.toString(), {
      signal: stop,
      redirect: "follow",
      headers: {
        // Sommige sites geven zonder deze twee een kale 403 terug.
        "user-agent": "Mozilla/5.0 (compatible; PingwinCockpit/1.0)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) {
      const slot = res.status === 401 || res.status === 403;
      return { titel: null, reden: slot ? "inloggen-nodig" : "niet-bereikbaar" };
    }
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html")) return { titel: null, reden: "geen-titel" };
    const titel = titelUitHtml((await res.text()).slice(0, 200_000));
    return titel ? { titel, reden: "gevonden" } : { titel: null, reden: "geen-titel" };
  } catch {
    return { titel: null, reden: "niet-bereikbaar" };
  }
}

export async function titelVanWebpagina(url: string): Promise<string | null> {
  return (await titelVanWebpaginaMetReden(url)).titel;
}

/**
 * Adressen waarvan we de titel niet kunnen ophalen omdat er een inlog voor
 * nodig is, maar waarvan we wél weten wat het is. Een mailtje in Superhuman,
 * Gmail of Outlook krijgt zo "Mail" als linktekst in plaats van een regel van
 * tweehonderd tekens.
 *
 * Wat er NIET bij kan: de datum en de afzender van dat mailtje. Die staan niet
 * in het adres en de mailbox zelf is vanuit het dashboard niet te lezen (dat
 * draait op een Google-serviceaccount dat alleen bij de Drive-map kan). Een
 * Cowork-gesprek kan dat wél: dat heeft toegang tot de mail en kan de regel in
 * het dossier aanvullen.
 */
const BEKENDE_BRONNEN: Array<{ host: RegExp; naam: (adres: URL) => string }> = [
  { host: /^mail\.superhuman\.com$/i, naam: () => "Mail" },
  { host: /^mail\.google\.com$/i, naam: () => "Mail" },
  { host: /^outlook\.(office|live|office365)\.com$/i, naam: () => "Mail" },
  /**
   * Claude (09-09-2026). Gemeten: claude.ai geeft een anonieme opvraging een
   * 403 van Cloudflare terug, dus hier valt nooit een titel te halen, hoe vaak
   * je het ook probeert. Het pad zegt wél wat het is, en dat is precies wat
   * Maarten in zijn notitie wil zien staan in plaats van cse_016yAgMh1DLz…
   */
  {
    host: /^(?:www\.)?claude\.ai$/i,
    naam: (adres) =>
      adres.pathname.startsWith("/cowork/")
        ? "Cowork-gesprek"
        : adres.pathname.startsWith("/chat/") || adres.pathname.startsWith("/share/")
          ? "Claude-gesprek"
          : "Claude",
  },
  {
    host: /^(?:www\.)?(?:chatgpt\.com|chat\.openai\.com)$/i,
    naam: () => "ChatGPT-gesprek",
  },
];

/**
 * Wat we van een adres al weten, met een houdbaarheidsdatum erbij
 * (12-09-2026). Dit is geen snelheidstruc maar een reparatie: de toelichting
 * bij een taak slaat zichzelf ongeveer een seconde na je laatste toetsaanslag
 * op, en bij élke opslag ging resolveDriveLinksInText opnieuw langs álle kale
 * links in die tekst. Voor een link die nooit een titel oplevert (een Google
 * Doc dat niet met de cockpit gedeeld is, een pagina die niet reageert) kostte
 * dat tot drie seconden per link per opslag, en dus werd typen in een taak met
 * een paar van die links merkbaar traag. Gemeld door Maarten op 12-09-2026.
 *
 * Een gevonden titel houden we een uur vast (een documentnaam verandert zelden
 * tussen twee toetsaanslagen), een mislukte opzoeking tien minuten. Dat laatste
 * is precies lang genoeg om het herhalen tijdens het typen te stoppen, en het
 * staat niets in de weg: plak je de link opnieuw nadat je het document hebt
 * gedeeld, dan wordt er hoe dan ook vers gekeken (zie `opnieuw` hieronder).
 *
 * Het geheugen leeft in het werkgeheugen van de server en is dus per
 * serverproces. Raakt dat proces weg, dan gebeurt er niets ergers dan wat
 * hiervoor altijd al gebeurde: één keer opnieuw opzoeken.
 */
const GEHEUGEN_GEVONDEN_MS = 60 * 60 * 1000;
const GEHEUGEN_MISLUKT_MS = 10 * 60 * 1000;
const GEHEUGEN_MAX = 500;

const titelGeheugen = new Map<string, { uitslag: TitelUitslag; tot: number }>();

function uitGeheugen(url: string): TitelUitslag | null {
  const bewaard = titelGeheugen.get(url);
  if (!bewaard) return null;
  if (bewaard.tot <= Date.now()) {
    titelGeheugen.delete(url);
    return null;
  }
  return bewaard.uitslag;
}

function inGeheugen(url: string, uitslag: TitelUitslag): TitelUitslag {
  // De oudste eruit zodra het vol is. Een Map houdt zijn invoegvolgorde aan,
  // dus de eerste sleutel is ook echt de oudste.
  if (titelGeheugen.size >= GEHEUGEN_MAX) {
    const oudste = titelGeheugen.keys().next().value;
    if (oudste !== undefined) titelGeheugen.delete(oudste);
  }
  const duur = uitslag.reden === "gevonden" ? GEHEUGEN_GEVONDEN_MS : GEHEUGEN_MISLUKT_MS;
  titelGeheugen.set(url, { uitslag, tot: Date.now() + duur });
  return uitslag;
}

/** Alleen voor de proef: het geheugen leegmaken. */
export function vergeetTitels(): void {
  titelGeheugen.clear();
}

export interface TitelOpties {
  /**
   * Niet uit het geheugen lezen maar echt opnieuw kijken. Gebruikt door de
   * plak-actie in de editor (app/_components/link-acties.ts): plakken is een
   * handeling van Maarten zelf en gebeurt zelden, dus daar hoort een vers
   * antwoord bij. Dat is ook de weg terug uit een mislukte opzoeking: deel het
   * document met de cockpit en plak de link opnieuw, precies zoals de uitleg
   * op het scherm zegt. Het antwoord gaat wél het geheugen in, zodat de opslag
   * een seconde later niets meer hoeft op te halen.
   */
  opnieuw?: boolean;
}

/**
 * Hoe een geplakte link heet: eerst een bekende bron (die nooit op te halen
 * is, maar waarvan we weten wat het is), dan Drive (de echte bestandsnaam),
 * dan de <title> van de pagina zelf. Geeft er de reden bij als er niets
 * gevonden is, zodat het scherm kan zeggen wat eraan te doen is.
 */
export async function titelVanLinkMetReden(
  url: string,
  opties?: TitelOpties,
): Promise<TitelUitslag> {
  if (!opties?.opnieuw) {
    const bekend = uitGeheugen(url);
    if (bekend) return bekend;
  }
  return inGeheugen(url, await zoekTitelOp(url));
}

/** Het echte opzoeken, zonder geheugen ervoor. */
async function zoekTitelOp(url: string): Promise<TitelUitslag> {
  let adres: URL;
  try {
    adres = new URL(url);
  } catch {
    return { titel: null, reden: "niet-bereikbaar" };
  }
  for (const bron of BEKENDE_BRONNEN) {
    if (bron.host.test(adres.hostname)) return { titel: bron.naam(adres), reden: "gevonden" };
  }

  const fileId = driveFileIdVan(url);
  if (fileId) {
    try {
      const meta = await getFileMetadata(fileId);
      if (meta?.name) return { titel: meta.name, reden: "gevonden" };
    } catch {
      // valt hieronder terug op de pagina zelf
    }
    /**
     * Een Drive-link waar het service-account niet bij kan. De pagina zelf
     * ophalen heeft dan geen zin: gemeten geeft docs.google.com een anonieme
     * opvraging een 401, altijd. Meteen de bruikbare reden teruggeven scheelt
     * drie seconden wachten op een antwoord dat toch niets oplevert.
     */
    if (/(?:docs|drive)\.google\.com$/i.test(adres.hostname)) {
      return { titel: null, reden: "geen-drive-toegang" };
    }
  }
  return titelVanWebpaginaMetReden(url);
}

/**
 * De titel bij een geplakte link: eerst Drive (dan hebben we de echte
 * bestandsnaam), anders een bekende bron, anders de <title> van de pagina zelf.
 */
export async function titelVanLink(url: string, opties?: TitelOpties): Promise<string | null> {
  return (await titelVanLinkMetReden(url, opties)).titel;
}

/**
 * De reden in één zin die Maarten iets zegt, met de handeling erbij als die
 * er is. Staat hier en niet in het scherm, zodat elke plek die een titel
 * opzoekt dezelfde uitleg geeft.
 */
export function uitlegBijReden(reden: TitelReden): string | null {
  switch (reden) {
    case "gevonden":
      return null;
    case "geen-drive-toegang": {
      const account = serviceAccountEmail();
      return account
        ? `Geen titel: dit document is niet gedeeld met de cockpit. Deel het (Lezer is genoeg) met ${account} en plak de link opnieuw.`
        : "Geen titel: dit document is niet gedeeld met de cockpit.";
    }
    case "inloggen-nodig":
      return "Geen titel: deze pagina is alleen na inloggen te lezen, dus de link blijft zoals hij is.";
    case "niet-bereikbaar":
      return "Geen titel: deze pagina was niet op te halen, dus de link blijft zoals hij is.";
    case "geen-titel":
      return "Geen titel: deze pagina heeft er zelf geen, dus de link blijft zoals hij is.";
  }
}

/** Combinatie van elk Drive-URL-patroon dat in de praktijk wordt geplakt. */
const DRIVE_ID_PATRONEN: RegExp[] = [
  /docs\.google\.com\/(?:document|spreadsheets|presentation|forms)\/d\/([a-zA-Z0-9_-]+)/,
  /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
  /drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)/,
  /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
  /[?&]id=([a-zA-Z0-9_-]+)/,
];

function driveFileIdVan(url: string): string | null {
  for (const patroon of DRIVE_ID_PATRONEN) {
    const m = patroon.exec(url);
    if (m) return m[1];
  }
  return null;
}

/**
 * Zelfde gecombineerde markdown-link/kale-url-regex als renderCel() in
 * lib/markdown.ts (zie de doc-comment daar voor waarom dit in één pass met
 * alternation moet: een kale-url-pass NA een markdown-link-pass zou de net
 * gegenereerde `[label](url)` opnieuw doorzoeken en de href-inhoud dubbel
 * pakken). Een al bestaande `[label](url)` blijft hier ALTIJD ongewijzigd
 * (heeft al een eigen, door de mens gekozen linktekst) — alleen kale URL's
 * komen voor titel-opzoeking in aanmerking.
 */
const LINK_PATROON = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<\]\)]+)/g;

/**
 * Een stuk tekst dat we straks ongewijzigd overnemen, of een kale url die nog
 * een titel mag krijgen. Eerst de hele tekst in zulke stukjes knippen en pas
 * dáárna opzoeken: zo kunnen alle opzoekingen tegelijk lopen.
 */
type Stuk = { soort: "tekst"; tekst: string } | { soort: "url"; url: string; staart: string };

/**
 * Zoekt kale Google Drive-links in vrije tekst en zet ze om naar
 * `[Echte titel](url)`. Niet-Drive-URL's en al bestaande `[tekst](url)`-links
 * blijven ongewijzigd. Faalt de opzoeking (geen toegang, verwijderd
 * document, netwerkfout) dan blijft de URL kaal staan — renderCel() maakt
 * 'm dan alsnog klikbaar, alleen zonder titel. Nooit een fout gooien: dit is
 * een verrijking, geen verplicht onderdeel van het opslaan.
 *
 * De opzoekingen lopen sinds 12-09-2026 naast elkaar in plaats van achter
 * elkaar. Ze stonden in een lus met een await erin, dus vier links die geen
 * antwoord geven kostten vier keer de wachttijd van drie seconden. Bij elke
 * automatische opslag. Naast elkaar is dat één keer drie seconden, en samen
 * met het geheugen hierboven daarna nul.
 */
export async function resolveDriveLinksInText(tekst: string): Promise<string> {
  if (!tekst || !tekst.includes("http")) return tekst;

  const matches = Array.from(tekst.matchAll(LINK_PATROON));
  if (!matches.length) return tekst;

  const stukken: Stuk[] = [];
  let cursor = 0;

  for (const m of matches) {
    const volledigeMatch = m[0];
    const mdUrl = m[2];
    const kaleUrlRuw = m[3];
    const start = m.index ?? 0;

    stukken.push({ soort: "tekst", tekst: tekst.slice(cursor, start) });
    cursor = start + volledigeMatch.length;

    if (mdUrl) {
      // Al een markdown-link met eigen label — niet aankomen.
      stukken.push({ soort: "tekst", tekst: volledigeMatch });
      continue;
    }

    // Afsluitende leestekens die bij de zin horen, niet bij de url zelf —
    // zelfde behandeling als renderCel().
    let url = String(kaleUrlRuw);
    let staart = "";
    const staartMatch = /[.,;:!?)\]]+$/.exec(url);
    if (staartMatch) {
      staart = staartMatch[0];
      url = url.slice(0, url.length - staart.length);
    }
    if (!url) {
      stukken.push({ soort: "tekst", tekst: volledigeMatch });
      continue;
    }
    stukken.push({ soort: "url", url, staart });
  }
  stukken.push({ soort: "tekst", tekst: tekst.slice(cursor) });

  // Elk adres één keer, allemaal tegelijk.
  const adressen = [...new Set(stukken.filter((s) => s.soort === "url").map((s) => s.url))];
  if (!adressen.length) return tekst;
  const titels = new Map<string, string | null>();
  await Promise.all(
    adressen.map(async (url) => {
      try {
        titels.set(url, await titelVanLink(url));
      } catch {
        titels.set(url, null);
      }
    }),
  );

  return stukken
    .map((stuk) => {
      if (stuk.soort === "tekst") return stuk.tekst;
      const titel = titels.get(stuk.url) ?? null;
      if (!titel) return stuk.url + stuk.staart;
      // Vierkante haken uit de titel halen zodat de `[label](url)`-syntax
      // zelf niet per ongeluk breekt.
      return `[${titel.replace(/[[\]]/g, "")}](${stuk.url})${stuk.staart}`;
    })
    .join("");
}
