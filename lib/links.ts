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

    const fileId = driveFileIdVan(url);
    if (!fileId) {
      out += url + staart;
      continue;
    }

    if (!titelCache.has(fileId)) {
      let titel: string | null = null;
      try {
        const meta = await getFileMetadata(fileId);
        titel = meta?.name ?? null;
      } catch {
        titel = null;
      }
      titelCache.set(fileId, titel);
    }
    const titel = titelCache.get(fileId) ?? null;

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
