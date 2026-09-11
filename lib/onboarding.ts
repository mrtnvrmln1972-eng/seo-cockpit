import "server-only";

import { findFileByName, readFileContent, writeDocument, type DriveFileRef } from "./drive";
import { parseWerklijst, toelichtingVoor } from "./werklijst";
import { sectie, tableWith, alleSecties, parseTables, type MarkdownTable } from "./markdown";
import type { Klant } from "./klanten";
import { VASTE_KOPPELINGEN } from "./onboarding-ladder";

/**
 * lib/onboarding.ts — lezen/bewerken van de Onboarding-ladder + de
 * bijbehorende dossierbestanden (toelichting.md, toegang.md, klant.md,
 * tone-of-voice.md, klantstem.md). Ontwerp vastgelegd 03-09-2026 (aparte
 * chat, zie het bouwlogboek): een venster op bestaande bestanden, GEEN eigen
 * administratie — dit bestand voegt geen nieuwe dossierbestanden of velden
 * toe, het leest en schrijft uitsluitend in de bestaande structuur.
 *
 * BELANGRIJKE CORRECTIE t.o.v. het 03-09-ontwerp (vastgesteld 09-09-2026,
 * tegen de echte, actuele bestanden van Kamsteeg én Nationaal Oogcentrum):
 * het ontwerp ging uit van een vaste 8-rijen-tabel Koppeling/Stand/Sinds/
 * Details in toegang.md met een "van toepassing"-vinkje dat direct
 * terugschrijft. De WERKELIJKE toegang.md bij beide gecontroleerde klanten
 * is een tabel met kolommen Bron/Status/Details (5 rijen: Google Search
 * Console, Ahrefs, Google Analytics, CMS of WordPress, Google Ads) gevolgd
 * door een "## Openstaand"-lijst — geen "van toepassing"-vinkje, geen vaste
 * 8-rijenset. Net als bij signalen.md (zie de doc-comment in
 * app/klant/[klantslug]/signalen/page.tsx) is er dus geen eigen aanname op
 * ÉÉN vaste vorm gebouwd: de koppelingentabel hieronder leest de Bron/
 * Status/Details-tabel als die er is, en valt anders terug op een generieke
 * sectie/tabel-weergave.
 *
 * BIJGESTELD 11-09-2026. De echte toegang.md van Eerste Kamer Badkamers is
 * gemeten en heeft wél de vorm Koppeling/Stand/Sinds/Details, met negen
 * rijen. Het "van toepassing"-vinkje bestaat nog steeds niet als kolom in het
 * bestand, maar is af te lezen uit de stand ("niet van toepassing"), en zo
 * doet de artifact het ook. Er wordt sindsdien dus wél naar toegang.md
 * teruggeschreven, maar uitsluitend die ene cel; zie koppelStanden() en
 * koppelingVanToepassingWisselen() verderop.
 *
 * De tien ladderstappen (1a-3c) komen wél overeen met de echte data: in
 * toelichting.md, onder de taak "Onboarding afmaken" (opgezocht via
 * werklijst.md, het tasknummer ligt niet vast), staat een "**Onderdelen**"
 * blok met vinkregels "- [ ] <code> <tekst>" / "- [x] <code> <tekst>".
 * Dat vinken is de enige schrijfactie in dit tabblad.
 */

export interface OnboardingItem {
  code: string;
  tekst: string;
  klaar: boolean;
}

export interface OnboardingLadder {
  taakN: number | null;
  taakTitel: string;
  items: OnboardingItem[];
  inHetKort: string;
  watOntbreekt: string;
}

/** Zoekt de taak "Onboarding afmaken" in werklijst.md — het tasknummer ligt niet vast per klant. */
export function vindOnboardingTaakNummer(werklijstMd: string): { n: number; titel: string } | null {
  const taken = parseWerklijst(werklijstMd);
  const taak = taken.find((t) => /onboarding.*afmaken/i.test(t.titel));
  return taak ? { n: taak.n, titel: taak.titel } : null;
}

interface TaakBlokInfo {
  volledig: string;
  inhoud: string;
  matchIndex: number;
}

function vindTaakBlok(md: string, n: number): TaakBlokInfo | null {
  const re = new RegExp(`^##\\s*Taak\\s*${n}\\s*$[\\r\\n]+([\\s\\S]*?)(?=^##\\s|$(?![\\s\\S]))`, "m");
  const m = re.exec(String(md || ""));
  if (!m) return null;
  return { volledig: m[0], inhoud: m[1], matchIndex: m.index };
}

/** Haalt de "- [ ] code tekst"-vinkregels uit een taakblok-tekst. */
export function parseOnderdelen(blokInhoud: string): OnboardingItem[] {
  const regels = String(blokInhoud || "").replace(/\r/g, "").split("\n");
  const re = /^\s*-\s*\[([ xX])\]\s*(\S+)\s+(.*)$/;
  const items: OnboardingItem[] = [];
  for (const regel of regels) {
    const m = re.exec(regel);
    if (!m) continue;
    items.push({ klaar: m[1].toLowerCase() === "x", code: m[2], tekst: m[3].trim() });
  }
  return items;
}

function escapeReg(tekst: string): string {
  return tekst.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Haalt de tekst onder een vetgedrukte pseudo-kop ("**Kop**") uit een taakblok, tot de volgende zo'n kop. */
export function boldBlok(blokInhoud: string, kop: string): string {
  const re = new RegExp(
    `\\*\\*${escapeReg(kop)}\\*\\*\\s*\\n+([\\s\\S]*?)(?=\\n\\*\\*[^\\n*]+\\*\\*|$)`,
  );
  const m = re.exec(String(blokInhoud || ""));
  return m ? m[1].trim() : "";
}

/** Leest de volledige onboarding-ladder (items + korte toelichting) voor één klant. */
export function leesLadder(werklijstMd: string, toelichtingMd: string): OnboardingLadder {
  const taak = vindOnboardingTaakNummer(werklijstMd);
  if (!taak) {
    return { taakN: null, taakTitel: "", items: [], inHetKort: "", watOntbreekt: "" };
  }
  const blok = toelichtingVoor(toelichtingMd, taak.n);
  return {
    taakN: taak.n,
    taakTitel: taak.titel,
    items: parseOnderdelen(blok),
    inHetKort: boldBlok(blok, "In het kort"),
    watOntbreekt: boldBlok(blok, "Wat er nu ontbreekt"),
  };
}

/** Zet één vinkregel (code) in taak n van toelichting.md om, teruggegeven als nieuwe volledige tekst (of null als niet gevonden). */
export function onderdeelWisselen(toelichtingMd: string, n: number, code: string): string | null {
  const blokInfo = vindTaakBlok(toelichtingMd, n);
  if (!blokInfo) return null;
  const regelRe = new RegExp(`(^\\s*-\\s*\\[)([ xX])(\\]\\s*${escapeReg(code)}\\b.*$)`, "m");
  const mr = regelRe.exec(blokInfo.inhoud);
  if (!mr) return null;
  const huidigAf = mr[2].toLowerCase() === "x";
  const nieuweRegel = mr[1] + (huidigAf ? " " : "x") + mr[3];
  const nieuweInhoud =
    blokInfo.inhoud.slice(0, mr.index) + nieuweRegel + blokInfo.inhoud.slice(mr.index + mr[0].length);
  const nieuwVolledig =
    blokInfo.volledig.slice(0, blokInfo.volledig.length - blokInfo.inhoud.length) + nieuweInhoud;
  const md = String(toelichtingMd || "");
  return md.slice(0, blokInfo.matchIndex) + nieuwVolledig + md.slice(blokInfo.matchIndex + blokInfo.volledig.length);
}

// ---- klant.md: propositie + bevestiging -----------------------------------

export interface PropositieInfo {
  tekst: string;
  bevestigd: boolean;
  bevestigdOp: string;
}

/** Leest de "## De propositie in één zin"-sectie uit klant.md, incl. bevestigingsstatus. */
export function propositieInfo(klantMd: string): PropositieInfo {
  const tekst = sectie(klantMd, "De propositie in één zin") ?? "";
  const m = /Bevestigd op:\s*(.*)/i.exec(tekst);
  const bevestigdOpRuw = (m?.[1] ?? "").trim();
  const bevestigd = bevestigdOpRuw.length > 0 && !/nog niet/i.test(bevestigdOpRuw);
  return { tekst, bevestigd, bevestigdOp: bevestigdOpRuw };
}

// ---- toegang.md: koppelingentabel, generiek met vangnet --------------------

export interface KoppelingenWeergave {
  tabel: MarkdownTable | null;
  secties: { kop: string; inhoud: string; tabellen: MarkdownTable[] }[];
}

/** Leest toegang.md: probeert eerst de bekende Bron/Status/Details-tabel, valt anders terug op alle secties/tabellen. */
export function leesKoppelingen(toegangMd: string): KoppelingenWeergave {
  const tabel = tableWith(toegangMd, "Bron");
  if (tabel) return { tabel, secties: [] };
  const secties = alleSecties(toegangMd).map((sec) => ({
    ...sec,
    tabellen: parseTables(sec.inhoud),
  }));
  return { tabel: null, secties };
}

// ---- toegang.md: de koppelingen als vaste rijen ---------------------------

/**
 * De koppelingen op de Onboarding-tab (11-09-2026, op verzoek van Maarten:
 * dezelfde weergave als in de Claude Artifact "Pingwin Klantcockpit").
 *
 * Dit vervangt de eerdere keuze om hier alleen de rauwe tabel te tonen. Die
 * keuze had trouwens een stil gevolg: `leesKoppelingen` zoekt een tabel met de
 * kolom "Bron", en de echte toegang.md van Eerste Kamer Badkamers heeft de
 * kolom "Koppeling". Die tabel staat bovendien boven de eerste `##`-kop, en
 * het vangnet daaronder loopt via alleSecties(). Uitkomst: de complete
 * koppelingentabel van die klant stond helemaal NIET op het scherm. Gemeten op
 * 11-09-2026 tegen het echte bestand in Drive.
 *
 * Twee dingen die hier bewust anders zijn dan in de artifact:
 *
 * 1. Een regel in het bestand die niet bij een van de acht vaste koppelingen
 *    hoort (Eerste Kamer heeft er zo een: "Fotodrive") verdwijnt niet, maar
 *    komt onderaan de tabel te staan. De artifact laat alleen de vaste acht
 *    zien en zo'n regel valt daar dus weg. Maartens harde eis bij deze klus:
 *    er mag niets van wat er al verzameld is verdwijnen.
 * 2. Er wordt nooit een hele tabel opnieuw opgeschreven. De artifact bouwt bij
 *    het omzetten van "van toepassing" de complete tabel opnieuw op uit de
 *    genormaliseerde standen, en daarmee verdwijnt de nuance in een cel
 *    ("gekoppeld, robots.txt weer bereikbaar" wordt dan "gekoppeld"). Hier
 *    verandert alleen de ene cel die je aanklikt; de rest van het bestand
 *    blijft letterlijk staan.
 */
export type KoppelingStand =
  | "gekoppeld"
  | "ontbreekt"
  | "deels"
  | "niet van toepassing"
  | "niet gevraagd";

export interface KoppelingRij {
  naam: string;
  /** Zoals de stand in het bestand staat, ongewijzigd. Leeg als er niets staat. */
  standRuw: string;
  /** De stand teruggebracht tot een van de vijf woorden, voor het bolletje. */
  stand: KoppelingStand;
  sinds: string;
  details: string;
  /** Staat deze regel in toegang.md, of is het een vaste rij die er nog niet in staat? */
  inBestand: boolean;
  /** Alleen bij de acht vaste koppelingen: de knop en de tekst om te kopiëren. */
  knop: string;
  vraag: string;
}

/** De stand teruggebracht tot een van de vijf woorden. Leest het bestand, oordeelt niet. */
export function standNaar(ruw: string): KoppelingStand {
  const v = String(ruw || "").trim().toLowerCase();
  if (!v) return "niet gevraagd";
  if (/niet van toepassing|^nvt\b/.test(v)) return "niet van toepassing";
  if (/^gekoppeld/.test(v) || /^ja\b/.test(v)) return "gekoppeld";
  if (/^ontbreekt/.test(v) || /^nee\b/.test(v)) return "ontbreekt";
  if (/^deels/.test(v)) return "deels";
  return "niet gevraagd";
}

/** Welke kleur het bolletje krijgt. */
export function standKlasse(stand: KoppelingStand): "ja" | "nee" | "deels" | "onbekend" {
  if (stand === "gekoppeld") return "ja";
  if (stand === "ontbreekt") return "nee";
  if (stand === "deels") return "deels";
  return "onbekend";
}

/**
 * Search Console kent twee soorten properties. Een domeinproperty
 * (sc-domain:klant.nl) meet www, non-www, http, https en alle subdomeinen; een
 * URL-prefix meet alleen die ene variant, dus daar mis je een deel van de
 * zoekcijfers. Welke van de twee het is staat in de details.
 */
export function searchConsoleSoort(details: string): "" | "domeinproperty" | "alleen URL-prefix" | "niet geverifieerd" {
  const t = String(details || "");
  if (/sc-domain:/i.test(t) && !/geen domeinproperty/i.test(t)) return "domeinproperty";
  if (/niet geverifieerd/i.test(t)) return "niet geverifieerd";
  if (/url-?prefix|https?:\/\//i.test(t)) return "alleen URL-prefix";
  return "";
}

interface KolomIndex {
  stand: number;
  sinds: number;
  details: number;
}

function kolommenVan(headers: string[]): KolomIndex {
  const idx: KolomIndex = { stand: 1, sinds: -1, details: -1 };
  headers.forEach((h, n) => {
    if (n === 0) return;
    const l = String(h || "").toLowerCase();
    if (/sinds|datum/.test(l)) idx.sinds = n;
    else if (/detail|toelichting|opmerking|bijzonder/.test(l)) idx.details = n;
    else if (/stand|status/.test(l)) idx.stand = n;
  });
  if (idx.details < 0) idx.details = Math.max(1, headers.length - 1);
  return idx;
}

/** De koppelingentabel: de acht vaste rijen, plus wat er verder in het bestand staat. */
export function koppelStanden(toegangMd: string): KoppelingRij[] {
  const md = String(toegangMd || "");
  const tabel = tableWith(md, "koppeling") ?? tableWith(md, "bron");
  const headers = tabel?.headers ?? [];
  const rijen = tabel?.rows ?? [];
  const idx = kolommenVan(headers);

  const gebruikt = new Set<number>();
  const uit: KoppelingRij[] = VASTE_KOPPELINGEN.map((vast) => {
    const n = rijen.findIndex((r, i) => !gebruikt.has(i) && vast.zoek.test(String(r[0] || "")));
    if (n >= 0) gebruikt.add(n);
    const r = n >= 0 ? rijen[n] : null;
    const standRuw = r ? String(r[idx.stand] ?? "").trim() : "";
    return {
      naam: vast.naam,
      standRuw,
      stand: standNaar(standRuw),
      sinds: r && idx.sinds > -1 ? String(r[idx.sinds] ?? "").trim() : "",
      details: r ? String(r[idx.details] ?? "").trim() : "",
      inBestand: r !== null,
      knop: vast.knop,
      vraag: vast.vraag,
    };
  });

  // Alles wat in het bestand staat maar bij geen enkele vaste koppeling hoort.
  rijen.forEach((r, i) => {
    if (gebruikt.has(i)) return;
    const naam = String(r[0] ?? "").trim();
    if (!naam) return;
    const standRuw = String(r[idx.stand] ?? "").trim();
    uit.push({
      naam,
      standRuw,
      stand: standNaar(standRuw),
      sinds: idx.sinds > -1 ? String(r[idx.sinds] ?? "").trim() : "",
      details: String(r[idx.details] ?? "").trim(),
      inBestand: true,
      knop: "",
      vraag: "",
    });
  });

  return uit;
}

/**
 * Details kan een hele alinea zijn. In de tabel staat de eerste zin, de rest
 * klapt eronder open. De artifact kapt hem af met de rest in een tooltip; dat
 * is hier bewust een uitklapregel geworden, want een tooltip lees je niet op
 * een telefoon en kun je niet kopiëren, en er staat in die cellen precies wat
 * er gevraagd is en bij wie.
 */
export function detailKort(details: string): { kort: string; rest: string } {
  const v = String(details || "").replace(/\s+/g, " ").trim();
  if (v.length <= 110) return { kort: v, rest: "" };
  const m = /^[\s\S]*?[.!?](?=\s)/.exec(v.slice(0, 200));
  const kort = m ? m[0] : v.slice(0, 110);
  return { kort, rest: v.slice(kort.length).trim() };
}

/**
 * Alles in toegang.md dat NIET de koppelingentabel is: Geschiedenis,
 * Openstaand, wat er naar de klant moet. Dat staat vol met wat er precies
 * gevraagd is en bij wie, en dat is precies het soort informatie dat niet mag
 * verdwijnen omdat het scherm eromheen verandert.
 */
export function restVanToegang(toegangMd: string): { kop: string; inhoud: string }[] {
  return alleSecties(String(toegangMd || "")).filter((sec) => sec.inhoud.trim().length > 0);
}

/**
 * Zet één koppeling op "niet van toepassing" of weer terug, door precies één
 * cel in de tabel te veranderen. De rest van het bestand blijft letterlijk
 * staan, tot en met de spaties in de andere rijen.
 *
 * Terugzetten geeft "niet gevraagd" en niet de oude stand: die staat na het
 * uitzetten nergens meer, en we gaan hem niet verzinnen. Dat staat ook zo in
 * de knoptekst op het scherm.
 */
export function koppelingVanToepassingWisselen(
  toegangMd: string,
  naam: string,
  vanToepassing: boolean,
  vandaag: string,
): string | null {
  const md = String(toegangMd || "");
  const regels = md.split("\n");
  let kopIndex = -1;
  for (let i = 0; i < regels.length; i++) {
    const r = regels[i].trim();
    if (r.startsWith("|") && /koppeling|bron/i.test(r) && /stand|status/i.test(r)) {
      kopIndex = i;
      break;
    }
  }
  if (kopIndex < 0) return null;

  const headers = celletjes(regels[kopIndex]);
  const idx = kolommenVan(headers);

  for (let i = kopIndex + 2; i < regels.length; i++) {
    const rij = regels[i];
    if (!rij.trim().startsWith("|")) break;
    const cellen = celletjes(rij);
    if (String(cellen[0] ?? "").trim().toLowerCase() !== naam.trim().toLowerCase()) continue;
    cellen[idx.stand] = vanToepassing ? "niet gevraagd" : "niet van toepassing";
    if (idx.sinds > -1) cellen[idx.sinds] = vandaag;
    // Weer ontsnappen: celletjes() maakt van `\|` een gewone streep, en die
    // zou hier een kolom af breken. Zonder deze regel valt een tabel stuk op
    // het eerste detail waar iemand een | in heeft gezet.
    regels[i] =
      "| " + cellen.map((c) => String(c ?? "").trim().replace(/\|/g, "\\|")).join(" | ") + " |";
    return regels.join("\n");
  }
  return null;
}

/** De cellen van één tabelregel, met \| als ontsnapte kolomstreep. */
function celletjes(regel: string): string[] {
  const kaal = regel.trim().replace(/^\|/, "").replace(/\|$/, "");
  return kaal.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, "|").trim());
}

// ---- Drive-laag -------------------------------------------------------------

export interface OnboardingDossier {
  werklijstMd: string;
  toelichtingBestand: DriveFileRef | null;
  toelichtingMd: string;
  toegangBestand: DriveFileRef | null;
  toegangMd: string;
  klantMd: string;
  toneOfVoiceMd: string;
  klantstemMd: string;
}

export async function leesOnboardingDossier(mapId: string): Promise<OnboardingDossier> {
  const [werklijstBestand, toelichtingBestand, toegangBestand, klantBestand, toonBestand, stemBestand] =
    await Promise.all([
      findFileByName(mapId, "werklijst.md"),
      findFileByName(mapId, "toelichting.md"),
      findFileByName(mapId, "toegang.md"),
      findFileByName(mapId, "klant.md"),
      findFileByName(mapId, "tone-of-voice.md"),
      findFileByName(mapId, "klantstem.md"),
    ]);
  const [werklijstMd, toelichtingMd, toegangMd, klantMd, toneOfVoiceMd, klantstemMd] = await Promise.all([
    werklijstBestand ? readFileContent(werklijstBestand.id) : Promise.resolve(""),
    toelichtingBestand ? readFileContent(toelichtingBestand.id) : Promise.resolve(""),
    toegangBestand ? readFileContent(toegangBestand.id) : Promise.resolve(""),
    klantBestand ? readFileContent(klantBestand.id) : Promise.resolve(""),
    toonBestand ? readFileContent(toonBestand.id) : Promise.resolve(""),
    stemBestand ? readFileContent(stemBestand.id) : Promise.resolve(""),
  ]);
  return {
    werklijstMd,
    toelichtingBestand,
    toelichtingMd,
    toegangBestand,
    toegangMd,
    klantMd,
    toneOfVoiceMd,
    klantstemMd,
  };
}

export async function onderdeelOpslaan(
  mapId: string,
  toelichtingBestand: DriveFileRef | null,
  toelichtingMd: string,
  n: number,
  code: string,
): Promise<void> {
  const nieuw = onderdeelWisselen(toelichtingMd, n, code);
  if (!nieuw) throw new Error("Kon dit vinkje niet terugvinden in toelichting.md.");
  await writeDocument({
    folderId: mapId,
    fileName: "toelichting.md",
    content: nieuw,
    knownFileId: toelichtingBestand?.id ?? null,
    knownModifiedTime: toelichtingBestand?.modifiedTime ?? null,
  });
}

/**
 * Eén koppeling op "niet van toepassing" zetten of terug, en toegang.md
 * wegschrijven. Alleen die ene cel verandert; zie de uitleg bij
 * koppelingVanToepassingWisselen().
 */
export async function koppelingOpslaan(
  mapId: string,
  toegangBestand: DriveFileRef | null,
  toegangMd: string,
  naam: string,
  vanToepassing: boolean,
): Promise<void> {
  const vandaag = new Date().toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).replace(/-/g, "-");
  const nieuw = koppelingVanToepassingWisselen(toegangMd, naam, vanToepassing, vandaag);
  if (!nieuw) {
    throw new Error(
      `Kon "${naam}" niet terugvinden in de koppelingentabel van toegang.md. Zet de regel er eerst met de hand in.`,
    );
  }
  await writeDocument({
    folderId: mapId,
    fileName: "toegang.md",
    content: nieuw,
    knownFileId: toegangBestand?.id ?? null,
    knownModifiedTime: toegangBestand?.modifiedTime ?? null,
  });
}

// ---- Klantenstrook: voortgang per klant in een groep -----------------------

export interface OnboardingVoortgang {
  klant: Klant;
  taakN: number | null;
  klaar: number;
  totaal: number;
}

/** Voortgang (klaar/totaal ladderstappen) van één klant, of null-taak als er geen onboardingtaak is. */
export async function leesVoortgang(klant: Klant): Promise<OnboardingVoortgang> {
  if (!klant.mapId) return { klant, taakN: null, klaar: 0, totaal: 0 };
  try {
    const [werklijstBestand, toelichtingBestand] = await Promise.all([
      findFileByName(klant.mapId, "werklijst.md"),
      findFileByName(klant.mapId, "toelichting.md"),
    ]);
    const [werklijstMd, toelichtingMd] = await Promise.all([
      werklijstBestand ? readFileContent(werklijstBestand.id) : Promise.resolve(""),
      toelichtingBestand ? readFileContent(toelichtingBestand.id) : Promise.resolve(""),
    ]);
    const ladder = leesLadder(werklijstMd, toelichtingMd);
    return {
      klant,
      taakN: ladder.taakN,
      klaar: ladder.items.filter((i) => i.klaar).length,
      totaal: ladder.items.length,
    };
  } catch {
    return { klant, taakN: null, klaar: 0, totaal: 0 };
  }
}
