import "server-only";

import { findFileByName, readFileContent, writeDocument, type DriveFileRef } from "./drive";
import { parseWerklijst, toelichtingVoor } from "./werklijst";
import { sectie, tableWith, alleSecties, parseTables, type MarkdownTable } from "./markdown";
import type { Klant } from "./klanten";

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
 * sectie/tabel-weergave. Er wordt hier NIETS naar toegang.md teruggeschreven
 * — dat "van toepassing"-vinkje uit het oude ontwerp bestaat niet in de
 * echte data, dus die functionaliteit zou op niets gebaseerd zijn.
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

// ---- Drive-laag -------------------------------------------------------------

export interface OnboardingDossier {
  werklijstMd: string;
  toelichtingBestand: DriveFileRef | null;
  toelichtingMd: string;
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
  return { werklijstMd, toelichtingBestand, toelichtingMd, toegangMd, klantMd, toneOfVoiceMd, klantstemMd };
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
