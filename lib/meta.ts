/**
 * lib/meta.ts — de meta-titel/omschrijving-controles uit de bestaande
 * "Pingwin Klantcockpit"-artifact, 1:1 geport uit de broncode
 * (checkTitel/checkDesc/metaInfo/breedte, met de ARIAL-pixelbreedtetabel).
 * Dit zijn GEEN nieuwe, zelfbedachte regels: het zijn dezelfde objectieve,
 * mechanische controles (paskleur van Google's zoekresultaatvenster,
 * zoekwoordpositie, leestekens) die de oude tool al draaide. Dat is dus
 * geen schending van "een dashboard mag tonen, nooit oordelen" (CLAUDE.md)
 * — er wordt geen prioriteit of belangrijkheid berekend, alleen of een
 * stuk tekst binnen een vast, technisch venster past.
 *
 * Bewust NIET meegenomen in deze eerste versie (spec §3.6/§3.7, en de
 * ROUTEWAT/doorzetKader/klantstemToets/herstelTekst-functies in de oude
 * artifact): de klantstem-toets tegen klantstem.md, het automatisch
 * herstellen van teksten die botsen met "harde regels", en het
 * doorzetten-naar-de-site-mechanisme (dat draait op toegang.md plus een
 * WordPress/Yoast-schrijfroute). Die vereisen dossierbestanden en een
 * schrijf-pad die dit project nog niet heeft. Dit tabblad toont daarom
 * alleen: wat er nu op elke pagina staat, wat het voorstel is, en of dat
 * voorstel aan de META-controles voldoet — puur signalerend, geen actie.
 */

// ---- ARIAL-pixelbreedtetabel (20px titel, 13px omschrijving) ----------

const ARIAL: Record<string, number> = {
  " ": 278, "!": 278, '"': 355, "#": 556, $: 556, "%": 889, "&": 667, "'": 191,
  "(": 333, ")": 333, "*": 389, "+": 584, ",": 278, "-": 333, ".": 278, "/": 278,
  "0": 556, "1": 556, "2": 556, "3": 556, "4": 556, "5": 556, "6": 556, "7": 556,
  "8": 556, "9": 556, ":": 278, ";": 278, "<": 584, "=": 584, ">": 584, "?": 556,
  "@": 1015, A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722,
  I: 278, J: 500, K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778,
  R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  "[": 278, "\\": 278, "]": 278, "^": 469, _: 556, "`": 333, a: 556, b: 556,
  c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222, k: 500,
  l: 222, m: 833, n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278,
  u: 556, v: 500, w: 722, x: 500, y: 500, z: 500, "{": 334, "|": 260, "}": 334,
  "~": 584,
} as unknown as Record<string, number>;

const TITEL = { font: 20, min: 430, max: 580 };
const DESC = { font: 13, min: 800, max: 920 };

function breedte(tekst: string, font: number): number {
  if (!tekst) return 0;
  const n = String(tekst)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  let u = 0;
  for (const c of n) {
    let w = ARIAL[c];
    if (w === undefined) w = c >= "A" && c <= "Z" ? 667 : 556;
    u += w;
  }
  return (u / 1000) * font;
}

export interface MetaInfo {
  px: number;
  chars: number;
  min: number;
  max: number;
  status: "over" | "kort" | "bijna" | "ok";
  ok: boolean;
}

export function metaInfo(soort: "titel" | "desc", tekst: string): MetaInfo {
  const cfg = soort === "titel" ? TITEL : DESC;
  const px = Math.round(breedte(tekst || "", cfg.font));
  const chars = Array.from(tekst || "").length;
  const status: MetaInfo["status"] =
    px > cfg.max ? "over" : px < cfg.min ? "kort" : px > cfg.max * 0.92 ? "bijna" : "ok";
  return { px, chars, min: cfg.min, max: cfg.max, status, ok: px >= cfg.min && px <= cfg.max };
}

function nrm(s: string): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function woorden(s: string): string[] {
  return nrm(s)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
}

const CTA = /\b(bekijk|ontdek|vraag|bereken|lees|vergelijk|start|kies|plan|ontvang|krijg|bestel|boek|probeer|download|neem)\b/i;
const FEIT = /(\d|€|%|\bgratis\b|\bbinnen\b|\bvanaf\b|\bgarantie\b|\bjaar\b|\bvandaag\b|\bdirect\b)/i;

export interface MetaCheck {
  id: string;
  label: string;
  pass: boolean;
  waarde: string;
}

export function checkTitel(t: string, kw?: string): MetaCheck[] {
  t = t || "";
  const info = metaInfo("titel", t);
  const c: MetaCheck[] = [];
  c.push({
    id: "META-02",
    label: "Vult het venster van Google (430 tot 580 px)",
    pass: info.ok && info.chars >= 35 && info.chars <= 65,
    waarde: `${info.chars} tekens, ${info.px} px (venster ${info.min} tot ${info.max} px)`,
  });
  if (kw) {
    const voor = nrm(t).slice(0, 30).indexOf(nrm(kw)) > -1;
    c.push({
      id: "META-03",
      label: "Zoekwoord in de eerste 30 tekens",
      pass: voor,
      waarde: voor ? `'${kw}' vooraan` : `'${kw}' staat niet vooraan`,
    });
  }
  c.push({
    id: "META-04",
    label: "Past ook op mobiel, hoogstens 480 px",
    pass: info.px > 0 && info.px <= 480,
    waarde: info.px > 480 ? `${info.px} px van max 480 px` : `${info.px} px`,
  });
  const pijp = /\|/.test(t);
  c.push({
    id: "META-05",
    label: "Koppelteken als scheidingsteken, geen pijp",
    pass: !pijp,
    waarde: pijp ? "bevat een pijp" : "geen pijp",
  });
  const haken = /[[\]]/.test(t);
  c.push({
    id: "META-11",
    label: "Geen vierkante haken",
    pass: !haken,
    waarde: haken ? "bevat [ of ]" : "ok",
  });
  const caps = t.match(/\b[A-Z]{4,}\b/);
  const uitroep = (t.match(/!/g) || []).length;
  c.push({
    id: "META-12",
    label: "Geen hoofdletterwoorden, hooguit één uitroepteken, geen emoji",
    pass: !caps && uitroep <= 1 && !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(t),
    waarde: caps ? `'${caps[0]}' staat in hoofdletters` : uitroep > 1 ? `${uitroep} uitroeptekens` : "ok",
  });
  const w = woorden(t);
  let dubbel: string | null = null;
  w.forEach((x, i) => {
    if (!dubbel && w.indexOf(x) !== i) dubbel = x;
  });
  c.push({
    id: "META-13",
    label: "Geen woordherhaling",
    pass: !dubbel,
    waarde: dubbel ? `'${dubbel}' komt dubbel voor` : "ok",
  });
  return c;
}

export function checkDesc(d: string, kw?: string, titel?: string): MetaCheck[] {
  d = d || "";
  const info = metaInfo("desc", d);
  const c: MetaCheck[] = [];
  c.push({
    id: "META-07",
    label: "Vult het venster van Google (800 tot 920 px)",
    pass: info.ok && info.chars >= 105 && info.chars <= 170,
    waarde: `${info.chars} tekens, ${info.px} px (venster ${info.min} tot ${info.max} px)`,
  });
  if (kw) {
    const n = nrm(d).split(nrm(kw)).length - 1;
    c.push({
      id: "META-08",
      label: "Zoekwoord één keer letterlijk, hooguit twee keer",
      pass: n >= 1 && n <= 2,
      waarde: `${n} keer '${kw}'`,
    });
    const kern = nrm(d).slice(0, 120).indexOf(nrm(kw)) > -1;
    c.push({
      id: "META-14",
      label: "Zoekwoord in de eerste 120 tekens, want mobiel kapt daar af",
      pass: kern,
      waarde: kern ? "zoekwoord staat in de kern" : "zoekwoord staat pas na de mobiele afkap",
    });
  }
  const cta = d.match(CTA);
  c.push({
    id: "META-09",
    label: "Actief werkwoord (Ontdek, Bekijk, Plan, Bereken)",
    pass: !!cta,
    waarde: cta ? `'${cta[0]}'` : "geen actief werkwoord gevonden",
  });
  const feit = d.match(FEIT);
  c.push({
    id: "META-15",
    label: "Minstens één concreet feit (getal, prijs, termijn, garantie)",
    pass: !!feit,
    waarde: feit ? `'${feit[0]}'` : "geen concreet feit gevonden",
  });
  if (titel) {
    const kopie = nrm(d).slice(0, 30) === nrm(titel).slice(0, 30);
    c.push({
      id: "META-10",
      label: "Herhaalt de titel niet letterlijk",
      pass: !kopie,
      waarde: kopie ? "eerste 30 tekens zijn gelijk aan de titel" : "ok",
    });
  }
  return c;
}

/**
 * Splitst de inhoud van één `## <url>`-paginasectie in meta.md in de vaste
 * genummerde subblokken (**Baan van de pagina**, **Zo staat het er nu**,
 * **Wat er niet klopt**, **Voorstel**, **Goedkeuring**) — bevestigd tegen
 * de echte meta.md van Nationaal Oogcentrum (gefetcht 07-09-2026).
 */
export function boldBlokken(md: string): Record<string, string> {
  const out: Record<string, string> = {};
  const koppen = [...md.matchAll(/^\*\*(.+?)\*\*\s*$/gm)];
  for (let i = 0; i < koppen.length; i++) {
    const kop = koppen[i][1].trim();
    const start = (koppen[i].index ?? 0) + koppen[i][0].length;
    const eind = i + 1 < koppen.length ? koppen[i + 1].index : md.length;
    out[kop] = md.slice(start, eind).trim();
  }
  return out;
}

/** Haalt `- Label: waarde`-regels uit een tekstblok naar een key/value-object. */
export function veldenUitBlok(blok: string): Record<string, string> {
  const out: Record<string, string> = {};
  const regels = (blok || "").split(/\r?\n/);
  for (const regel of regels) {
    const m = regel.trim().match(/^[-*]\s*([^:]+):\s*(.*)$/);
    if (m) out[m[1].trim()] = m[2].trim();
  }
  return out;
}
