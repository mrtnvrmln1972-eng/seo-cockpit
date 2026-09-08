import "server-only";

import { alleSecties, alleTabelRijen, parseTables, type TableRow, type MarkdownTable } from "./markdown";

/**
 * lib/roadmap.ts — server-only helpers die specifiek zijn voor de
 * navigatiehiërarchie op de Roadmap-tab (hoofdmenu-groepen met
 * dochterpagina's eronder, plus het samenvoegen van een pagina met zijn
 * signalen.md-rijen tot één "volledige context"-blok). De generieke
 * tabel-/sectieparsing zelf blijft in lib/markdown.ts (alleTabelRijen,
 * alleSecties, parseTables) — dit bestand voegt er alleen de
 * Roadmap-specifieke groepering en koppeling aan toe.
 *
 * Gebouwd tegen de ECHTE roadmap.md en signalen.md van Kamsteeg (Drive-map
 * 18hgi9nafSGcNDZxaFiy7a0vRIoObR2FV, gedownload en volledig gelezen op
 * 08-09-2026 — niet alleen het ingekorte contentSnippet uit search_files).
 * Kamsteegs roadmap.md is GEEN reeks `##`-secties met elk hun eigen
 * paginatabel (zoals de oude Roadmap-tab aannam, gebouwd tegen Nationaal
 * Oogcentrum/Eerste Kamer Badkamers): het is één `#`-kop met ÉÉN grote
 * tabel voor alle 67 pagina's, met een eigen "Groep"-kolom (Homepage,
 * "Hovenier / locaties", Tuinontwerp, Tuinaanleg, Tuinonderhoud, Projecten,
 * "Niet in het menu") die de skill zelf al uit de URL-structuur heeft
 * afgeleid — zie de brontoelichting bovenaan het bestand: "menugroep
 * afgeleid uit de URL-structuur, niet uit een handmatige menu-extractie".
 * Die kolom IS dus al de navigatiehiërarchie die Maarten wil zien; we
 * verzinnen zelf geen nieuwe indeling maar volgen die kolom letterlijk.
 *
 * Kamsteegs signalen.md heeft op zijn beurt GEEN aparte Pagina/URL-kolom in
 * de "## Signalen"-tabel (12 kolommen: #, Signaal, Waarom het uitmaakt, Wat
 * je doet, Wat het oplevert, Wat er moet gebeuren, Hoeveel werk, Recept,
 * Urgentie, Tier, Datum gemeten, Status) — een signaal kan over één pagina
 * gaan of over meerdere tegelijk (bijv. signaal 9 noemt zowel
 * `/hovenier/etten-leur/` als `/hovenier/oosterhout/`). De paginaverwijzing
 * zit in de vrije tekst, steeds als backtick-code (`` `/pad/` ``, bevestigd
 * door alle rijen in het echte bestand). koppelSignalenAanPagina() zoekt
 * daarom op die exacte, backtick-omsloten padnotatie in plaats van op een
 * kolom die er niet is — dat voorkomt ook valse trefs zoals "/project/" dat
 * toevallig een substring is van "/project/page/2/", omdat de backticks de
 * grens van de padnaam markeren.
 */

// ---- Groeperen: hoofdmenu-groepen met dochterpagina's -------------------

export interface RoadmapGroep {
  naam: string;
  paginas: TableRow[];
}

/** Kolomnamen die als "menugroep" gelden — naam-gebaseerd, geen vaste positie (CLAUDE.md). */
const GROEP_KOLOM_NAMEN = ["groep", "menugroep", "hoofdmenu", "hoofdpagina"];
/** Kolomnamen die de pagina/URL identificeren — idem, naam-gebaseerd. */
const PAGINA_KOLOM_NAMEN = ["pagina", "url", "pad", "adres"];

function vindKolom(rij: TableRow, kandidaten: string[]): string | null {
  const keys = Object.keys(rij);
  for (const kandidaat of kandidaten) {
    const gevonden = keys.find((k) => k.trim().toLowerCase() === kandidaat);
    if (gevonden) return gevonden;
  }
  return null;
}

export function vindPaginaKolom(rij: TableRow): string | null {
  return vindKolom(rij, PAGINA_KOLOM_NAMEN);
}

/**
 * Generieke naam-gebaseerde kolomlookup voor losse velden (Score, Status,
 * Geblokkeerd, Urgentie, Tier, ...): geeft de exacte kolomnaam terug van de
 * eerste kandidaat die matcht (case-insensitive), of null. Gebruikt door de
 * pagina/UI-laag om pilletjes te vullen zonder op kolomVOLGORDE te steunen —
 * dezelfde reden als heeftNummerKolom/tableWith in lib/markdown.ts.
 */
export function vindKolomVoor(rij: TableRow, kandidaten: string[]): string | null {
  return vindKolom(rij, kandidaten);
}

/** Idem, maar geeft direct de (rauwe, ongerenderde) celwaarde terug, of "". */
export function veldWaarde(rij: TableRow, kandidaten: string[]): string {
  const key = vindKolom(rij, kandidaten);
  return key ? rij[key] : "";
}

/**
 * Groepeert de paginarijen uit roadmap.md tot hoofdmenu-groepen. Kamsteeg
 * heeft een expliciete "Groep"-kolom (zie doc-comment hierboven) — die
 * volgen we dan letterlijk, in de volgorde waarin de groepen voor het eerst
 * in het bestand voorkomen (dat is bij Kamsteeg al de sitenavigatie-
 * volgorde: Homepage, Hovenier/locaties, Tuinontwerp, Tuinaanleg,
 * Tuinonderhoud, Projecten, Niet in het menu).
 *
 * Vangnet voor een andere klant zonder Groep-kolom (roadmap.md heeft GEEN
 * vaste vorm, CLAUDE.md): val dan terug op de `##`-sectie-indeling die de
 * vorige versie van deze tab gebruikte (elke `##`-kop met een eigen
 * paginatabel wordt een hoofdmenu-groep). Alleen als ook dát niets oplevert
 * is er geen hiërarchie te tonen.
 */
export function groepeerRoadmapPaginas(md: string): RoadmapGroep[] {
  const rijen = alleTabelRijen(md, "Pagina");
  if (rijen.length > 0) {
    const groepKolom = vindKolom(rijen[0], GROEP_KOLOM_NAMEN);
    if (groepKolom) {
      const volgorde: string[] = [];
      const perGroep = new Map<string, TableRow[]>();
      for (const rij of rijen) {
        const naam = (rij[groepKolom] || "").trim() || "Overig";
        if (!perGroep.has(naam)) {
          perGroep.set(naam, []);
          volgorde.push(naam);
        }
        perGroep.get(naam)!.push(rij);
      }
      return volgorde.map((naam) => ({ naam, paginas: perGroep.get(naam)! }));
    }
  }

  // Vangnet: geen Groep-kolom in de grote tabel gevonden — terugvallen op
  // de oude ##-sectie-indeling (elke ##-kop met eigen paginatabel).
  return alleSecties(md)
    .map((sec) => ({ naam: sec.kop, paginas: alleTabelRijen(sec.inhoud, "Pagina") }))
    .filter((sec) => sec.paginas.length > 0);
}

/**
 * "Niet in het menu"/"losse pagina"-achtige groepen altijd achteraan, net
 * als de oude Roadmap-tab deed — dit zijn geen kanban-kolommen maar puur de
 * volgorde van weergave, geen oordeel over de pagina's zelf.
 */
export function sorteerGroepenMetOverigAchteraan(groepen: RoadmapGroep[]): RoadmapGroep[] {
  const achteraanNeedle = /niet in het menu|losse pagina|^overig$/i;
  return [...groepen].sort((a, b) => {
    const aLast = achteraanNeedle.test(a.naam) ? 1 : 0;
    const bLast = achteraanNeedle.test(b.naam) ? 1 : 0;
    return aLast - bLast;
  });
}

// ---- Koppelen aan signalen.md -------------------------------------------

export interface GekoppeldSignaal {
  /** De `##`-sectie in signalen.md waar deze rij vandaan komt (bv. "Signalen" of "Issues"). */
  sectie: string;
  rij: TableRow;
}

function tabelNaarRijen(tabel: MarkdownTable): TableRow[] {
  return tabel.rows.map((rij) => {
    const obj: TableRow = {};
    tabel.headers.forEach((h, i) => {
      obj[h.trim()] = (rij[i] ?? "").trim();
    });
    return obj;
  });
}

/**
 * Zoekt alle rijen in signalen.md die deze pagina noemen, ongeacht onder
 * welke `##`-sectie ze staan (Kamsteeg heeft "Issues" en "Signalen"; een
 * andere klant kan andere kopnamen hebben — CLAUDE.md waarschuwt dat
 * signalen.md geen vaste vorm heeft). Matcht op de exacte, backtick-
 * omsloten padnotatie (zie doc-comment bovenaan dit bestand) zodat
 * "/project/" niet per ongeluk meetelt als match voor "/project/page/2/".
 *
 * Werkt zowel op bestanden met `##`-secties als op de ongesplitste
 * "# Wat mij is opgevallen"-vorm zonder subkoppen (dan wordt het hele
 * bestand als één sectie behandeld).
 */
export function koppelSignalenAanPagina(signalenMd: string, paginaPad: string): GekoppeldSignaal[] {
  const pad = paginaPad.trim();
  if (!pad) return [];
  const needle = "`" + pad + "`";

  const secties = alleSecties(signalenMd);
  const bronnen = secties.length > 0 ? secties : [{ kop: "Signalen", inhoud: signalenMd }];

  const resultaat: GekoppeldSignaal[] = [];
  for (const sec of bronnen) {
    const tabellen = parseTables(sec.inhoud);
    for (const tabel of tabellen) {
      for (const rij of tabelNaarRijen(tabel)) {
        const volledigeTekst = Object.values(rij).join(" ");
        if (volledigeTekst.includes(needle)) {
          resultaat.push({ sectie: sec.kop, rij });
        }
      }
    }
  }
  return resultaat;
}
