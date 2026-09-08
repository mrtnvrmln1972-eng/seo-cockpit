import "server-only";

import { findFolderByName, listFilesInFolder, readFileContent } from "./drive";
import { parseTables, type TableRow } from "./markdown";
import type { Klant } from "./klanten";

/**
 * lib/crawl.ts — leest de nieuwste Screaming Frog-crawlsamenvatting
 * (crawls/crawl-JJJJ-MM-DD.md) uit de map van één klant, en koppelt de
 * "Alle 200-pagina's"-tabel daarin aan een paginapad uit roadmap.md.
 *
 * Bestaat sinds 08-09-2026, toegevoegd toen Maarten liet zien dat de
 * Roadmap-tab qua opzet weer bij de oude claude.ai-artifact moet aansluiten:
 * die toonde per pagina ook een blok "Screaming Frog, laatste crawl" (Title,
 * Title px, Desc px, H1, Woorden, Inlinks, Diepte, Linkscore) naast de
 * roadmap.md-velden. Bevestigd tegen de ECHTE crawls-map van Kamsteeg
 * (submap "crawls" in de klantmap, bestand crawl-2026-09-03.md): die bevat
 * onder de kop "Alle 200-pagina's" één tabel met kolommen URL/Title/Title
 * px/Desc px/H1/Woorden/Inlinks/Diepte/Linkscore — geen "#"-kolom, dus
 * alleTabelRijen() uit lib/markdown.ts (die een nummerkolom eist) matcht hem
 * niet; deze module doet zijn eigen, kleinere tabelherkenning op de URL- en
 * Diepte-kolom samen.
 *
 * Niet elke klant heeft (nog) een crawls-map of een crawl-bestand — dit is
 * altijd best-effort, net als signalen.md bij de Roadmap-tab: ontbreekt hij,
 * dan toont de pagina simpelweg geen Screaming Frog-blok, geen foutmelding.
 */

export interface CrawlPaginaRegel {
  /** Ruwe velden zoals ze in de crawltabel staan (Title, Title px, Desc px, H1, Woorden, Inlinks, Diepte, Linkscore, ...). */
  velden: TableRow;
  /** Datum uit de bestandsnaam (crawl-JJJJ-MM-DD.md), voor weergave "laatste crawl van ...". */
  crawlDatum: string | null;
}

function datumUitBestandsnaam(naam: string): string | null {
  const m = /crawl-(\d{4}-\d{2}-\d{2})/.exec(naam);
  return m ? m[1] : null;
}

/**
 * Vindt de "Alle 200-pagina's"-tabel (of vergelijkbaar genaamd) in een
 * crawlbestand: de tabel met zowel een URL- als een Diepte-kolom, zodat een
 * andere tabel in hetzelfde bestand (bijv. "Redirects en fouten") niet per
 * ongeluk wordt gepakt.
 */
function paginaTabel(md: string): { headers: string[]; rows: string[][] } | null {
  const tabellen = parseTables(md);
  for (const t of tabellen) {
    const kop = t.headers.map((h) => h.trim().toLowerCase());
    if (kop.includes("url") && kop.includes("diepte")) return t;
  }
  return null;
}

/** Leest de nieuwste crawl-samenvatting van een klant, of null als die er niet is. */
export async function leesLaatsteCrawl(
  klant: Klant,
): Promise<{ paginas: Map<string, CrawlPaginaRegel>; crawlDatum: string | null } | null> {
  if (!klant.mapId) return null;

  const crawlsMap = await findFolderByName(klant.mapId, "crawls");
  if (!crawlsMap) return null;

  const bestanden = await listFilesInFolder(crawlsMap.id, { onlyFiles: true });
  const crawlBestanden = bestanden
    .filter((f) => /^crawl-\d{4}-\d{2}-\d{2}\.md$/.test(f.name))
    .sort((a, b) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0)); // nieuwste datum eerst

  const nieuwste = crawlBestanden[0];
  if (!nieuwste) return null;

  const content = await readFileContent(nieuwste.id);
  const tabel = paginaTabel(content);
  if (!tabel) return null;

  const urlIdx = tabel.headers.findIndex((h) => h.trim().toLowerCase() === "url");
  const crawlDatum = datumUitBestandsnaam(nieuwste.name);

  const paginas = new Map<string, CrawlPaginaRegel>();
  for (const rij of tabel.rows) {
    const pad = (rij[urlIdx] ?? "").trim();
    if (!pad) continue;
    const velden: TableRow = {};
    tabel.headers.forEach((h, i) => {
      velden[h.trim()] = (rij[i] ?? "").trim();
    });
    paginas.set(pad, { velden, crawlDatum });
  }

  return { paginas, crawlDatum };
}
