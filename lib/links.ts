import "server-only";

import { getFileMetadata } from "@/lib/drive";

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

export async function titelVanWebpagina(url: string): Promise<string | null> {
  if (!magOpgehaaldWorden(url)) return null;
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
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html")) return null;
    return titelUitHtml((await res.text()).slice(0, 200_000));
  } catch {
    return null;
  }
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
const BEKENDE_BRONNEN: Array<[RegExp, string]> = [
  [/^mail\.superhuman\.com$/i, "Mail"],
  [/^mail\.google\.com$/i, "Mail"],
  [/^outlook\.(office|live|office365)\.com$/i, "Mail"],
];

/**
 * De titel bij een geplakte link: eerst Drive (dan hebben we de echte
 * bestandsnaam), anders een bekende bron, anders de <title> van de pagina zelf.
 */
export async function titelVanLink(url: string): Promise<string | null> {
  try {
    const host = new URL(url).hostname;
    for (const [patroon, naam] of BEKENDE_BRONNEN) if (patroon.test(host)) return naam;
  } catch {
    return null;
  }

  const fileId = driveFileIdVan(url);
  if (fileId) {
    try {
      const meta = await getFileMetadata(fileId);
      if (meta?.name) return meta.name;
    } catch {
      // valt hieronder terug op de pagina zelf
    }
  }
  return titelVanWebpagina(url);
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
 * Zoekt kale Google Drive-links in vrije tekst en zet ze om naar
 * `[Echte titel](url)`. Niet-Drive-URL's en al bestaande `[tekst](url)`-links
 * blijven ongewijzigd. Faalt de opzoeking (geen toegang, verwijderd
 * document, netwerkfout) dan blijft de URL kaal staan — renderCel() maakt
 * 'm dan alsnog klikbaar, alleen zonder titel. Nooit een fout gooien: dit is
 * een verrijking, geen verplicht onderdeel van het opslaan.
 */
export async function resolveDriveLinksInText(tekst: string): Promise<string> {
  if (!tekst || !tekst.includes("http")) return tekst;

  const matches = Array.from(tekst.matchAll(LINK_PATROON));
  if (!matches.length) return tekst;

  const titelCache = new Map<string, string | null>();
  let out = "";
  let cursor = 0;

  for (const m of matches) {
    const volledigeMatch = m[0];
    const mdUrl = m[2];
    const kaleUrlRuw = m[3];
    const start = m.index ?? 0;

    out += tekst.slice(cursor, start);
    cursor = start + volledigeMatch.length;

    if (mdUrl) {
      // Al een markdown-link met eigen label — niet aankomen.
      out += volledigeMatch;
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
      out += volledigeMatch;
      continue;
    }

    if (!titelCache.has(url)) {
      let titel: string | null = null;
      try {
        titel = await titelVanLink(url);
      } catch {
        titel = null;
      }
      titelCache.set(url, titel);
    }
    const titel = titelCache.get(url) ?? null;

    if (titel) {
      // Vierkante haken uit de titel halen zodat de `[label](url)`-syntax
      // zelf niet per ongeluk breekt.
      const veiligeTitel = titel.replace(/[[\]]/g, "");
      out += `[${veiligeTitel}](${url})${staart}`;
    } else {
      out += url + staart;
    }
  }
  out += tekst.slice(cursor);
  return out;
}
