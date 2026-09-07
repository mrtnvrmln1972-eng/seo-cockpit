/**
 * lib/markdown.ts — parsers voor de markdown-conventies die de bestaande
 * "Pingwin Klantcockpit"-artifact gebruikt in de dossierbestanden
 * (klantcockpit_specificatie.md §2.3). Dit is bewust GEEN generieke
 * markdown-library: de dossierbestanden gebruiken vaste Nederlandse
 * koppen/kolomnamen, en de bestaande tool herkent tabellen op
 * koptekst-INHOUD (niet op vaste kolomvolgorde) zodat een bestand kolommen
 * kan toevoegen/verplaatsen zonder de parser te breken. Deze module volgt
 * dat principe zo letterlijk mogelijk.
 */

export interface MarkdownTable {
  headers: string[];
  rows: string[][];
}

export interface TableRow {
  [header: string]: string;
}

// ---- Celsplitsing (escape-bewust) -----------------------------------

/**
 * Splitst één markdown-tabelrij in cellen, met correcte behandeling van
 * escaped pipes (`\|`). Dit is de fix voor de "bij Kamsteeg"-bug uit de
 * bestaande artifact (spec §6.2): een ongeëscapete `|` in een cel schoof
 * anders alle volgende kolommen op (bijv. "1.402 woorden" verscheen dan in
 * de verkeerde kolom als "1402%").
 */
export function splitCells(regel: string): string[] {
  const zonderRand = regel.trim().replace(/^\|/, "").replace(/\|\s*$/, "");
  const cellen: string[] = [];
  let huidig = "";
  for (let i = 0; i < zonderRand.length; i++) {
    const ch = zonderRand[i];
    if (ch === "\\" && zonderRand[i + 1] === "|") {
      huidig += "|";
      i++;
      continue;
    }
    if (ch === "|") {
      cellen.push(huidig.trim());
      huidig = "";
      continue;
    }
    huidig += ch;
  }
  cellen.push(huidig.trim());
  return cellen;
}

const SCHEIDINGSREGEL = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

/** Vindt alle markdown-tabellen (`| ... |` met een `---`-scheidingsregel) in een tekst. */
export function parseTables(md: string): MarkdownTable[] {
  const regels = md.split(/\r?\n/);
  const tabellen: MarkdownTable[] = [];
  let i = 0;
  while (i < regels.length) {
    const regel = regels[i];
    if (
      regel.trim().startsWith("|") &&
      i + 1 < regels.length &&
      SCHEIDINGSREGEL.test(regels[i + 1])
    ) {
      const headers = splitCells(regel);
      let j = i + 2;
      const rows: string[][] = [];
      while (j < regels.length && regels[j].trim().startsWith("|")) {
        rows.push(splitCells(regels[j]));
        j++;
      }
      tabellen.push({ headers, rows });
      i = j;
      continue;
    }
    i++;
  }
  return tabellen;
}

/**
 * Vindt de tabel die matcht op een zoekwoord in de koptekst (case-
 * insensitive substring-match op de samengevoegde headerregel) — kolommen
 * worden dus bij NAAM herkend, niet bij positie (spec §2.3, tableWith()).
 */
export function tableWith(md: string, zoekwoord: string): MarkdownTable | null {
  const needle = zoekwoord.toLowerCase();
  const tabellen = parseTables(md);
  return (
    tabellen.find((t) => t.headers.join(" | ").toLowerCase().includes(needle)) ??
    null
  );
}

function heeftNummerKolom(headers: string[]): boolean {
  return headers.some((h) => {
    const v = h.trim().toLowerCase();
    return v === "#" || v === "nr" || v === "nr.";
  });
}

function rijNaarObject(headers: string[], rij: string[]): TableRow {
  const obj: TableRow = {};
  headers.forEach((h, idx) => {
    obj[h.trim()] = (rij[idx] ?? "").trim();
  });
  return obj;
}

/**
 * Itereert ALLE tabellen in het bestand die matchen op koptekst-inhoud (niet
 * alleen de eerste), en slaat elke tabel over die geen echte `#`-
 * nummeringskolom heeft. Dit is de fix voor de "bij Bogard"-bug (spec §6.4):
 * een bestand als roadmap.md kan meerdere `##`-secties hebben die elk hun
 * eigen tabel bevatten (bijv. "Landingspagina's" naast "Webshop en
 * categorieën"), en zonder deze aanpak liepen de rijen van twee
 * verschillende tabellen door elkaar op hetzelfde volgnummer.
 */
export function alleTabelRijen(md: string, zoekwoord: string): TableRow[] {
  const needle = zoekwoord.toLowerCase();
  const tabellen = parseTables(md);
  const out: TableRow[] = [];
  for (const t of tabellen) {
    if (!t.headers.join(" | ").toLowerCase().includes(needle)) continue;
    if (!heeftNummerKolom(t.headers)) continue;
    for (const rij of t.rows) out.push(rijNaarObject(t.headers, rij));
  }
  return out;
}

// ---- Sectie-extractie -------------------------------------------------

/**
 * Pakt de tekst onder een `## Kop`-heading tot de volgende `##`-heading (of
 * einde bestand). Generieke bouwsteen, spec §2.3 (sectie()).
 */
export function sectie(md: string, kop: string): string | null {
  const escaped = kop.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^##\\s+${escaped}\\s*$`, "m");
  const match = re.exec(md);
  if (!match) return null;
  const start = match.index + match[0].length;
  const rest = md.slice(start);
  const volgendeKop = /^##\s+/m.exec(rest);
  const eind = volgendeKop ? volgendeKop.index : rest.length;
  return rest.slice(0, eind).trim();
}

/**
 * Leest een tabel binnen een specifieke sectie (bijv. de "Issues"- of
 * "Kansen"-sectie in signalen.md). Spec §2.3/§3.4/§3.5 (tabelUitSectie()).
 * Als `zoekwoord` niet is opgegeven, wordt de eerste tabel in de sectie
 * gebruikt.
 */
export function tabelUitSectie(
  md: string,
  kop: string,
  zoekwoord?: string,
): TableRow[] {
  const sec = sectie(md, kop);
  if (sec == null) return [];
  const tabellen = parseTables(sec);
  const target = zoekwoord
    ? tabellen.find((t) =>
        t.headers.join(" | ").toLowerCase().includes(zoekwoord.toLowerCase()),
      )
    : tabellen[0];
  if (!target) return [];
  return target.rows.map((rij) => rijNaarObject(target.headers, rij));
}

/**
 * Splitst een bestand in al zijn `## Kop`-secties, in volgorde, elk met de
 * bijbehorende koptekst en tekstinhoud. Gebruikt door de Roadmap-tab om
 * per `##`-sectie (bijv. "Homepage en hoofdthema's" naast "Lensimplantatie")
 * een eigen paginagroep te tonen, terwijl alleTabelRijen() zelf alle rijen
 * plat door elkaar zou teruggeven (spec §3.3, bug-fix §6.4).
 */
export function alleSecties(md: string): { kop: string; inhoud: string }[] {
  const out: { kop: string; inhoud: string }[] = [];
  const koppen = [...md.matchAll(/^##\s+(.+?)\s*$/gm)];
  for (let i = 0; i < koppen.length; i++) {
    const kop = koppen[i][1].trim();
    const start = (koppen[i].index ?? 0) + koppen[i][0].length;
    const eind = i + 1 < koppen.length ? koppen[i + 1].index : md.length;
    out.push({ kop, inhoud: md.slice(start, eind).trim() });
  }
  return out;
}

/**
 * Rendert de inhoud van één tabelcel naar veilige, beperkte HTML. De
 * dossierbestanden gebruiken bewust een kleine, vaste opmaakset binnen
 * cellen: `**vet**`, inline `` `code` `` en letterlijke `<br>`-tags voor
 * regelafbreking binnen één cel (bevestigd door de echte signalen.md- en
 * roadmap.md-bestanden in Drive). Alle andere tekst wordt HTML-geëscaped,
 * dus dit is geen generieke markdown-renderer — precies genoeg voor deze
 * vaste opmaakset, niets meer.
 */
export function renderCel(tekst: string): string {
  let out = tekst
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  out = out.replace(/&lt;br&gt;/g, "<br />");
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return out;
}

/** Haalt een markdown-link `[tekst](url)` uit een cel, of de kale tekst als er geen link is. */
export function urlUitCel(cel: string): { tekst: string; url: string | null } {
  const link = /^\[(.*)\]\((.*)\)$/.exec(cel.trim());
  if (link) return { tekst: link[1].trim(), url: link[2].trim() };
  const kaal = /^https?:\/\/\S+$/.exec(cel.trim());
  if (kaal) return { tekst: cel.trim(), url: cel.trim() };
  return { tekst: cel.trim(), url: null };
}

// ---- Statuswaarden (spec §2.3) ----------------------------------------

/**
 * Vaste statuswaarden voor taken (kolom "status" in werklijst.md/
 * developer.md). Puur weergave-mapping — GEEN van deze functies berekent
 * een eigen prioriteit; ze zetten alleen een reeds-in-de-data-aanwezige
 * waarde om naar een CSS-klasse. Zie CLAUDE.md: "een dashboard mag tonen,
 * nooit oordelen".
 */
export const STATUS_WAARDEN = [
  "open",
  "bezig",
  "bij klant",
  "bij developer",
  "klaar",
  "vervallen",
  "later",
  "bevinding",
] as const;

export type StatusWaarde = (typeof STATUS_WAARDEN)[number];

const STATUS_KLASSE: Record<StatusWaarde, string> = {
  open: "p-open",
  bezig: "p-bezig",
  "bij klant": "p-klant",
  "bij developer": "p-developer",
  klaar: "p-klaar",
  vervallen: "p-vervallen",
  later: "p-later",
  bevinding: "p-bevinding",
};

const DOT_KLASSE: Record<StatusWaarde, string> = {
  open: "dot-open",
  bezig: "dot-bezig",
  "bij klant": "dot-klant",
  "bij developer": "dot-developer",
  klaar: "dot-klaar",
  vervallen: "dot-vervallen",
  later: "dot-later",
  bevinding: "dot-bevinding",
};

export function normaliseerStatus(ruw: string): StatusWaarde | null {
  const key = ruw.trim().toLowerCase();
  return (STATUS_WAARDEN as readonly string[]).includes(key)
    ? (key as StatusWaarde)
    : null;
}

/** Zet een statuswaarde om naar CSS-klasse (spec §2.3, statusClass()). */
export function statusClass(ruw: string): string {
  const status = normaliseerStatus(ruw);
  return status ? STATUS_KLASSE[status] : "p-onbekend";
}

/** Zet een statuswaarde om naar kleur-dot-klasse (spec §2.3, dotClass()). */
export function dotClass(ruw: string): string {
  const status = normaliseerStatus(ruw);
  return status ? DOT_KLASSE[status] : "dot-onbekend";
}
