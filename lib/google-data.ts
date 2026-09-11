import "server-only";

import { google } from "googleapis";

/**
 * lib/google-data.ts — Search Console en Google Analytics lezen met hetzelfde
 * service-account waarmee deze cockpit al bij Drive komt.
 *
 * Waarom zo, en niet zoals het oude SEO-dashboard (11-09-2026). Dat dashboard
 * gebruikt een Google-inlog van Maarten zelf: één keer inloggen, en daarna
 * leeft er een verversbare sleutel in een Postgres-tabel. Die weg kan hier
 * niet, want deze cockpit heeft bewust geen database (zie CLAUDE.md), en een
 * verversbare sleutel in een dossierbestand zou een wachtwoord in de opslag
 * zijn.
 *
 * De schone weg is dat het service-account, dat er al is, ook leesrechten
 * krijgt op de Search Console-property en de Analytics-property van een klant.
 * Dat is precies dezelfde handeling als het delen van de dossiermap: één keer
 * een e-mailadres toevoegen. Geen inlog, geen sleutel om te bewaren, geen
 * token dat verloopt. Google geeft het service-account op aanvraag een
 * kortlevend toegangsbewijs, en dat gebeurt hieronder.
 *
 * De sleutel zelf is dezelfde als in lib/drive.ts (GOOGLE_SERVICE_ACCOUNT_KEY),
 * maar met andere, strikt alleen-lezen rechten gevraagd. Drive-toestemming en
 * data-toestemming lopen dus niet door elkaar.
 */

const LEES_SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
];

function sleutel(): Record<string, unknown> | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Het adres waarmee dit dashboard bij Google aanklopt. Geen geheim; het moet juist gedeeld worden. */
export function serviceAccountAdres(): string | null {
  const s = sleutel();
  const adres = s?.["client_email"];
  return typeof adres === "string" && adres.includes("@") ? adres : null;
}

let bewaardeAuth: InstanceType<typeof google.auth.GoogleAuth> | null = null;

/** Een kortlevend toegangsbewijs voor Search Console en Analytics, of null als de sleutel ontbreekt. */
export async function leesToken(): Promise<string | null> {
  const credentials = sleutel();
  if (!credentials) return null;
  try {
    if (!bewaardeAuth) {
      bewaardeAuth = new google.auth.GoogleAuth({ credentials, scopes: LEES_SCOPES });
    }
    const token = await bewaardeAuth.getAccessToken();
    return typeof token === "string" && token ? token : null;
  } catch {
    return null;
  }
}

// ---- Perioden ---------------------------------------------------------------

export type Vergelijk = "prev" | "yoy";

export interface Periode {
  curStart: string;
  curEnd: string;
  prevStart: string;
  prevEnd: string;
}

/**
 * De huidige periode en waarmee hij vergeleken wordt. De laatste twee dagen
 * gaan eraf: Search Console loopt zelf altijd twee à drie dagen achter, dus de
 * laatste dagen zouden anders kunstmatig laag zijn. Zelfde regel als in het
 * oude dashboard.
 */
export function periodeVan(dagen: number, vergelijk: Vergelijk = "prev"): Periode {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const curEnd = new Date();
  curEnd.setDate(curEnd.getDate() - 2);
  const curStart = new Date(curEnd);
  curStart.setDate(curStart.getDate() - (dagen - 1));
  let prevStart: Date;
  let prevEnd: Date;
  if (vergelijk === "yoy") {
    prevStart = new Date(curStart);
    prevStart.setFullYear(prevStart.getFullYear() - 1);
    prevEnd = new Date(curEnd);
    prevEnd.setFullYear(prevEnd.getFullYear() - 1);
  } else {
    prevEnd = new Date(curStart);
    prevEnd.setDate(prevEnd.getDate() - 1);
    prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - (dagen - 1));
  }
  return { curStart: iso(curStart), curEnd: iso(curEnd), prevStart: iso(prevStart), prevEnd: iso(prevEnd) };
}

// ---- Search Console ---------------------------------------------------------

interface GscRij {
  keys?: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

async function gscVraag(token: string, site: string, body: Record<string, unknown>): Promise<GscRij[]> {
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) return [];
  const j = (await res.json()) as { rows?: GscRij[] };
  return Array.isArray(j.rows) ? j.rows : [];
}

/** Alle properties die dit service-account mag zien. Ook de diagnose op het scherm gebruikt deze lijst. */
export async function gscProperties(token: string): Promise<string[]> {
  const res = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const j = (await res.json()) as { siteEntry?: { siteUrl: string; permissionLevel?: string }[] };
  return (j.siteEntry ?? [])
    .filter((e) => e.permissionLevel !== "siteUnverifiedUser")
    .map((e) => e.siteUrl);
}

/**
 * De property die bij dit domein hoort. Een domeinproperty wint van een
 * URL-prefix: die meet www, non-www en alle subdomeinen samen. Niet
 * geverifieerde properties staan wel in de lijst maar geven geen cijfers, dus
 * die vallen af; anders kiest hij een lege property terwijl er een werkende
 * naast staat. Zelfde regel als in het oude dashboard.
 */
export function kiesProperty(properties: string[], domein: string, vast?: string): string | null {
  if (vast && properties.includes(vast)) return vast;
  if (vast) return vast; // met de hand gezet: gebruiken, ook als de lijst leeg is
  const d = domein.replace(/^https?:\/\//i, "").replace(/\/$/, "").replace(/^www\./i, "").toLowerCase();
  if (!d) return null;
  const domeinProperty = properties.find((p) => p.toLowerCase() === `sc-domain:${d}`);
  if (domeinProperty) return domeinProperty;
  return properties.find((p) => p.toLowerCase().includes(d)) ?? null;
}

export interface Reeks {
  dates: string[];
  clicks: number[];
  impressions: number[];
  ctr: number[];
  position: number[];
  prevClicks: number[];
  prevImpressions: number[];
  prevCtr: number[];
  prevPosition: number[];
}

export interface Totaal {
  cur: number;
  prev: number;
}

export interface GscZoekwoord {
  keyword: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  prevClicks: number;
  prevImpressions: number;
  prevCtr: number;
  prevPosition: number | null;
  page: string | null;
}

export interface GscPagina {
  url: string;
  clicks: number;
  impressions: number;
  prevClicks: number;
  prevImpressions: number;
}

export interface GscUitslag {
  /** Staat de sleutel er, en mag dit account ergens bij? */
  gekoppeld: boolean;
  /** De gekozen property, of null als er geen bij dit domein hoort. */
  property: string | null;
  /** Wat dit account wél mag zien; om op het scherm te kunnen zeggen wat er mist. */
  zichtbaar: string[];
  periode: Periode;
  totalen: { clicks: Totaal; impressions: Totaal; ctr: Totaal; position: Totaal } | null;
  reeks: Reeks;
  zoekwoorden: GscZoekwoord[];
  paginas: GscPagina[];
}

const LEGE_REEKS: Reeks = {
  dates: [], clicks: [], impressions: [], ctr: [], position: [],
  prevClicks: [], prevImpressions: [], prevCtr: [], prevPosition: [],
};

const r1 = (n: number) => Math.round(n * 10) / 10;
const pct = (n: number) => Math.round(n * 1000) / 10;

/** Search Console voor één klant, met de vorige periode ernaast. */
export async function leesSearchConsole(
  domein: string,
  dagen: number,
  vergelijk: Vergelijk,
  vasteProperty?: string,
): Promise<GscUitslag> {
  const periode = periodeVan(dagen, vergelijk);
  const leeg: GscUitslag = {
    gekoppeld: false, property: null, zichtbaar: [], periode,
    totalen: null, reeks: LEGE_REEKS, zoekwoorden: [], paginas: [],
  };

  const token = await leesToken();
  if (!token) return leeg;

  const zichtbaar = await gscProperties(token);
  const property = kiesProperty(zichtbaar, domein, vasteProperty);
  if (!property) return { ...leeg, gekoppeld: true, zichtbaar };

  const v = (body: Record<string, unknown>) => gscVraag(token, property, body);
  const [curTot, prevTot, curKw, prevKw, curPg, prevPg, perDag, perDagVorig, kwPagina] = await Promise.all([
    v({ startDate: periode.curStart, endDate: periode.curEnd }),
    v({ startDate: periode.prevStart, endDate: periode.prevEnd }),
    v({ startDate: periode.curStart, endDate: periode.curEnd, dimensions: ["query"], rowLimit: 100 }),
    v({ startDate: periode.prevStart, endDate: periode.prevEnd, dimensions: ["query"], rowLimit: 100 }),
    v({ startDate: periode.curStart, endDate: periode.curEnd, dimensions: ["page"], rowLimit: 50 }),
    v({ startDate: periode.prevStart, endDate: periode.prevEnd, dimensions: ["page"], rowLimit: 50 }),
    v({ startDate: periode.curStart, endDate: periode.curEnd, dimensions: ["date"], rowLimit: 500 }),
    v({ startDate: periode.prevStart, endDate: periode.prevEnd, dimensions: ["date"], rowLimit: 500 }),
    v({ startDate: periode.curStart, endDate: periode.curEnd, dimensions: ["query", "page"], rowLimit: 1000 }),
  ]);

  const opDatum = (a: GscRij, b: GscRij) => (a.keys?.[0] ?? "").localeCompare(b.keys?.[0] ?? "");
  const dag = [...perDag].sort(opDatum);
  const dagVorig = [...perDagVorig].sort(opDatum);
  const reeks: Reeks = {
    dates: dag.map((r) => r.keys?.[0] ?? ""),
    clicks: dag.map((r) => Math.round(r.clicks)),
    impressions: dag.map((r) => Math.round(r.impressions)),
    ctr: dag.map((r) => pct(r.ctr)),
    position: dag.map((r) => r1(r.position)),
    prevClicks: dagVorig.map((r) => Math.round(r.clicks)),
    prevImpressions: dagVorig.map((r) => Math.round(r.impressions)),
    prevCtr: dagVorig.map((r) => pct(r.ctr)),
    prevPosition: dagVorig.map((r) => r1(r.position)),
  };

  const c = curTot[0];
  const p = prevTot[0];
  const totalen = c
    ? {
        clicks: { cur: Math.round(c.clicks), prev: Math.round(p?.clicks ?? 0) },
        impressions: { cur: Math.round(c.impressions), prev: Math.round(p?.impressions ?? 0) },
        ctr: { cur: pct(c.ctr), prev: pct(p?.ctr ?? 0) },
        position: { cur: r1(c.position), prev: p ? r1(p.position) : 0 },
      }
    : null;

  const vorigeKw = new Map<string, GscRij>();
  for (const r of prevKw) if (r.keys?.[0]) vorigeKw.set(r.keys[0], r);

  // De pagina die op dit zoekwoord het meest gevonden wordt: meeste klikken,
  // bij gelijke stand de meeste vertoningen.
  const bestePagina = new Map<string, { page: string; clicks: number; impressions: number }>();
  for (const r of kwPagina) {
    const kw = r.keys?.[0];
    const pg = r.keys?.[1];
    if (!kw || !pg) continue;
    const nu = bestePagina.get(kw);
    if (!nu || r.clicks > nu.clicks || (r.clicks === nu.clicks && r.impressions > nu.impressions)) {
      bestePagina.set(kw, { page: pg, clicks: r.clicks, impressions: r.impressions });
    }
  }

  const zoekwoorden: GscZoekwoord[] = curKw.map((r) => {
    const kw = r.keys?.[0] ?? "";
    const pr = vorigeKw.get(kw);
    return {
      keyword: kw,
      clicks: Math.round(r.clicks),
      impressions: Math.round(r.impressions),
      ctr: pct(r.ctr),
      position: r1(r.position),
      prevClicks: pr ? Math.round(pr.clicks) : 0,
      prevImpressions: pr ? Math.round(pr.impressions) : 0,
      prevCtr: pr ? pct(pr.ctr) : 0,
      prevPosition: pr ? r1(pr.position) : null,
      page: bestePagina.get(kw)?.page ?? null,
    };
  });

  const vorigePg = new Map<string, GscRij>();
  for (const r of prevPg) if (r.keys?.[0]) vorigePg.set(r.keys[0], r);
  const paginas: GscPagina[] = curPg.map((r) => {
    const url = r.keys?.[0] ?? "";
    const pr = vorigePg.get(url);
    return {
      url,
      clicks: Math.round(r.clicks),
      impressions: Math.round(r.impressions),
      prevClicks: pr ? Math.round(pr.clicks) : 0,
      prevImpressions: pr ? Math.round(pr.impressions) : 0,
    };
  });

  return { gekoppeld: true, property, zichtbaar, periode, totalen, reeks, zoekwoorden, paginas };
}

/** De zoekwoorden waarop één pagina gevonden wordt; voor het uitklappen van een pagina-regel. */
export async function leesPaginaZoekwoorden(
  property: string,
  url: string,
  dagen: number,
  vergelijk: Vergelijk,
): Promise<{ keyword: string; clicks: number; impressions: number; position: number; prevClicks: number; prevImpressions: number; prevPosition: number | null }[]> {
  const token = await leesToken();
  if (!token) return [];
  const periode = periodeVan(dagen, vergelijk);
  const filter = {
    dimensionFilterGroups: [{ filters: [{ dimension: "page", operator: "equals", expression: url }] }],
    dimensions: ["query"],
    rowLimit: 50,
  };
  const [cur, prev] = await Promise.all([
    gscVraag(token, property, { startDate: periode.curStart, endDate: periode.curEnd, ...filter }),
    gscVraag(token, property, { startDate: periode.prevStart, endDate: periode.prevEnd, ...filter }),
  ]);
  const vorig = new Map<string, GscRij>();
  for (const r of prev) if (r.keys?.[0]) vorig.set(r.keys[0], r);
  return cur.map((r) => {
    const kw = r.keys?.[0] ?? "";
    const pr = vorig.get(kw);
    return {
      keyword: kw,
      clicks: Math.round(r.clicks),
      impressions: Math.round(r.impressions),
      position: r1(r.position),
      prevClicks: pr ? Math.round(pr.clicks) : 0,
      prevImpressions: pr ? Math.round(pr.impressions) : 0,
      prevPosition: pr ? r1(pr.position) : null,
    };
  });
}
