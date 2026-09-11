import "server-only";

import { findFileByName, readFileContent, writeDocument, type DriveFileRef } from "./drive";
import { tableWith, type MarkdownTable } from "./markdown";

/**
 * lib/kpi-dossier.ts — kpi.md: wat jij op de Resultaten-tab vastzet.
 *
 * Het oude SEO-dashboard bewaart dit in drie Postgres-tabellen (kpi_page_order,
 * keyword_focus en een prioriteitstabel). Deze cockpit heeft bewust geen
 * database, dus het gaat waar al het andere heen gaat: een markdown-bestand in
 * de klantmap, met dezelfde tabelconventie als elk ander dossierbestand. Dat
 * heeft een tweede voordeel dat de database niet had: een Cowork-gesprek kan
 * het lezen en aanvullen.
 *
 * Drie soorten regels, en verder niets:
 *  - Instellingen: welke Search Console- en Analytics-property bij deze klant
 *    horen. Leeg laten mag; dan zoekt de cockpit ze zelf op het domein.
 *  - Zoekwoorden: welke je volgt, als prio of secundair.
 *  - Pagina's: welke je volgt (ster) en in welke volgorde ze bovenaan staan.
 *
 * Het bestand wordt in zijn geheel opnieuw opgeschreven bij een wijziging, net
 * als servicepunten.md: het wordt nooit met de hand geschreven, dus een vaste
 * voorspelbare vorm is hier veiliger dan een regex-reparatie op de ruwe tekst.
 * Wat er verder in staat (een eigen notitie onder een eigen kop) blijft staan.
 */

export const KPI_BESTANDSNAAM = "kpi.md";

export type Focus = "prio" | "secundair";

export interface KpiDossier {
  bestand: DriveFileRef | null;
  /** Met de hand vastgezette property's. Leeg betekent: zelf opzoeken. */
  searchConsoleProperty: string;
  ga4Property: string;
  /** Zoekwoord (kleine letters) naar prio of secundair. */
  zoekwoorden: Record<string, Focus>;
  /** URL's in de volgorde waarin ze bovenaan moeten staan. */
  volgorde: string[];
  /** URL's met een ster. */
  sterren: string[];
  /** Alles onder een eigen kop dat wij niet kennen; blijft ongewijzigd staan. */
  rest: string;
}

export const LEEG_KPI: KpiDossier = {
  bestand: null,
  searchConsoleProperty: "",
  ga4Property: "",
  zoekwoorden: {},
  volgorde: [],
  sterren: [],
  rest: "",
};

/** Een Veld/Waarde-tabel als woordenboek. Zelfde vorm als in servicepunten.md. */
function veldenUitVeldWaarde(tabel: MarkdownTable | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!tabel) return out;
  const iVeld = tabel.headers.findIndex((h) => h.trim().toLowerCase() === "veld");
  const iWaarde = tabel.headers.findIndex((h) => h.trim().toLowerCase() === "waarde");
  if (iVeld === -1 || iWaarde === -1) return out;
  for (const rij of tabel.rows) {
    const key = (rij[iVeld] ?? "").trim().toLowerCase();
    if (key) out[key] = (rij[iWaarde] ?? "").trim();
  }
  return out;
}

const ONZE_KOPPEN = ["instellingen", "zoekwoorden", "pagina's", "paginas"];

function focusVan(ruw: string): Focus | null {
  const v = ruw.trim().toLowerCase();
  if (v === "prio") return "prio";
  if (v === "secundair") return "secundair";
  return null;
}

/** Leest kpi.md. Een bestand dat er niet is levert lege voorkeuren op, geen fout. */
export function parseKpi(md: string): Omit<KpiDossier, "bestand"> {
  const tekst = String(md || "");
  const instellingen = veldenUitVeldWaarde(tableWith(tekst, "waarde"));

  const zoekwoorden: Record<string, Focus> = {};
  const kwTabel = tableWith(tekst, "zoekwoord");
  if (kwTabel) {
    const iKw = 0;
    const iFocus = kwTabel.headers.findIndex((h) => /focus/i.test(h));
    for (const rij of kwTabel.rows) {
      const kw = (rij[iKw] ?? "").trim();
      const f = focusVan(iFocus >= 0 ? (rij[iFocus] ?? "") : "");
      if (kw && f) zoekwoorden[kw.toLowerCase()] = f;
    }
  }

  const volgorde: string[] = [];
  const sterren: string[] = [];
  const pgTabel = tableWith(tekst, "pagina");
  if (pgTabel) {
    const iVolg = pgTabel.headers.findIndex((h) => /volgorde/i.test(h));
    const iSter = pgTabel.headers.findIndex((h) => /ster/i.test(h));
    const rijen = pgTabel.rows
      .map((rij) => ({
        url: (rij[0] ?? "").trim(),
        volg: iVolg >= 0 ? parseInt((rij[iVolg] ?? "").trim(), 10) : NaN,
        ster: iSter >= 0 ? /^[xX✓]$/.test((rij[iSter] ?? "").trim()) : false,
      }))
      .filter((r) => r.url);
    for (const r of rijen) if (r.ster) sterren.push(r.url);
    for (const r of [...rijen].sort((a, b) => (a.volg || 9999) - (b.volg || 9999))) {
      if (Number.isFinite(r.volg)) volgorde.push(r.url);
    }
  }

  // Alles onder een kop die wij niet kennen blijft staan.
  const rest = tekst
    .split(/^##\s+/m)
    .slice(1)
    .filter((blok) => {
      const kop = (blok.split("\n")[0] ?? "").trim().toLowerCase();
      return !ONZE_KOPPEN.includes(kop);
    })
    .map((blok) => `## ${blok.trimEnd()}`)
    .join("\n\n");

  return {
    searchConsoleProperty: instellingen["search console-property"] ?? instellingen["search console"] ?? "",
    ga4Property: instellingen["ga4-property"] ?? instellingen["analytics-property"] ?? "",
    zoekwoorden,
    volgorde,
    sterren,
    rest,
  };
}

function escCel(waarde: string): string {
  return (waarde || "").replace(/\r?\n+/g, " ").replace(/\|/g, "\\|").trim();
}

/** Schrijft kpi.md deterministisch terug. */
export function serialiseerKpi(d: Omit<KpiDossier, "bestand">): string {
  const paginas = new Map<string, { volg: number | null; ster: boolean }>();
  d.volgorde.forEach((url, i) => paginas.set(url, { volg: i + 1, ster: false }));
  for (const url of d.sterren) {
    const nu = paginas.get(url);
    if (nu) nu.ster = true;
    else paginas.set(url, { volg: null, ster: true });
  }

  const regels = [
    "# KPI",
    "",
    "Wat er op de Resultaten-tab is vastgezet: welke zoekwoorden en pagina's gevolgd worden,",
    "en in welke volgorde ze bovenaan staan. Dit bestand wordt door de cockpit geschreven.",
    "",
    "## Instellingen",
    "",
    "| Veld | Waarde |",
    "|---|---|",
    `| Search Console-property | ${escCel(d.searchConsoleProperty)} |`,
    `| GA4-property | ${escCel(d.ga4Property)} |`,
    "",
    "## Zoekwoorden",
    "",
    "| Zoekwoord | Focus |",
    "|---|---|",
    ...Object.entries(d.zoekwoorden).map(([kw, f]) => `| ${escCel(kw)} | ${f} |`),
    "",
    "## Pagina's",
    "",
    "| Pagina | Volgorde | Ster |",
    "|---|---|---|",
    ...[...paginas.entries()].map(([url, p]) => `| ${escCel(url)} | ${p.volg ?? ""} | ${p.ster ? "x" : ""} |`),
    "",
  ];
  if (d.rest.trim()) regels.push(d.rest.trim(), "");
  return regels.join("\n");
}

export async function leesKpiDossier(mapId: string): Promise<KpiDossier> {
  const bestand = await findFileByName(mapId, KPI_BESTANDSNAAM);
  const md = bestand ? await readFileContent(bestand.id) : "";
  return { bestand, ...parseKpi(md) };
}

export async function schrijfKpiDossier(mapId: string, dossier: KpiDossier): Promise<void> {
  await writeDocument({
    folderId: mapId,
    fileName: KPI_BESTANDSNAAM,
    content: serialiseerKpi(dossier),
    knownFileId: dossier.bestand?.id ?? null,
    knownModifiedTime: dossier.bestand?.modifiedTime ?? null,
  });
}
