import "server-only";

import {
  findFileByName,
  getRootFolderId,
  readFileContent,
  writeDocument,
  vergeetMapInhoud,
  type DriveFileRef,
} from "./drive";
import { tableWith } from "./markdown";

/**
 * lib/weergave.ts — cockpit-weergave.md, het enige bestand dat de cockpit
 * zelf bezit.
 *
 * Waarom het bestaat (09-09-2026, op verzoek): Maarten wil klanten in zijn
 * eigen volgorde kunnen slepen en een kortere naam kunnen tonen ("Eerste
 * Kamer" in plaats van "Eerste Kamer Badkamers", "NOC" in plaats van
 * "Nationaal Oogcentrum"). Allebei is het weergave, geen klantgegeven.
 *
 * Waarom NIET in KLANTEN.md: de naam in KLANTEN.md is de sleutel waarmee de
 * klantmap in Drive wordt gevonden (mapPerNaam in lib/klanten.ts) én waar de
 * slug in de URL uit komt. Zou je die naam wijzigen, dan raakt het dossier
 * los van de klant en veranderen alle links. KLANTEN.md wordt bovendien ook
 * buiten deze app gelezen en geschreven. Daarom houdt de cockpit zijn eigen,
 * kleine bestand ernaast, en blijft KLANTEN.md ongemoeid: de klantgegevens
 * staan daar en worden hier niet gedupliceerd, alleen de volgorde en de naam
 * die op het scherm komt te staan.
 *
 * Het bestand is met de hand te lezen en aan te passen; het is gewone
 * markdown met één tabel. Staat een klant er niet in, dan houdt hij zijn
 * naam en zijn plaats uit KLANTEN.md.
 */

/** Naam van het bestand in de root van "Pingwin Klanten". */
export const WEERGAVE_BESTAND = "cockpit-weergave.md";

export interface WeergaveRegel {
  /** De klantnaam zoals hij in KLANTEN.md staat; dat is de sleutel. */
  klant: string;
  /** De naam die de cockpit toont, of "" als de volledige naam blijft staan. */
  korteNaam: string;
  /** Plaats binnen de groep, of null als die niet is vastgelegd. */
  volgorde: number | null;
}

const KOP = `# Cockpitweergave

Dit bestand hoort bij de klantcockpit en gaat alleen over hoe de klantenlijst
in de zijbalk eruitziet: in welke volgorde de klanten staan en welke naam
erbij getoond wordt. De klantgegevens zelf staan in KLANTEN.md en veranderen
hier niet door; de naam in de eerste kolom hieronder verwijst daarnaar.

De cockpit schrijft dit bestand zelf bij zodra je klanten in de zijbalk
versleept. Met de hand aanpassen mag ook: zet een kortere naam in de tweede
kolom, of laat die leeg om de volledige naam te blijven tonen. Staat een
klant hier niet in, dan blijft hij op zijn plaats uit KLANTEN.md staan.
`;

/** Zet de regels om naar de tekst van het bestand, in vaste vorm. */
export function weergaveNaarMarkdown(regels: WeergaveRegel[]): string {
  const rijen = regels
    .filter((r) => r.klant.trim() !== "")
    .map(
      (r) =>
        `| ${r.klant.trim()} | ${r.korteNaam.trim()} | ${r.volgorde === null ? "" : r.volgorde} |`,
    );
  return `${KOP}\n| Klant | Korte naam | Volgorde |\n|---|---|---|\n${rijen.join("\n")}\n`;
}

/** Leest de tabel uit het bestand; een onbekende of ontbrekende vorm levert een lege lijst op. */
export function weergaveUitMarkdown(md: string): WeergaveRegel[] {
  const tabel = tableWith(md, "klant");
  if (!tabel) return [];
  const kolom = (naam: string) =>
    tabel.headers.findIndex((h) => h.trim().toLowerCase() === naam);
  const idxKlant = kolom("klant");
  const idxNaam = kolom("korte naam");
  const idxVolgorde = kolom("volgorde");
  if (idxKlant === -1) return [];

  const uit: WeergaveRegel[] = [];
  for (const rij of tabel.rows) {
    const klant = (rij[idxKlant] ?? "").trim();
    if (!klant) continue;
    const volgordeRuw = idxVolgorde === -1 ? "" : (rij[idxVolgorde] ?? "").trim();
    const volgorde = /^\d+$/.test(volgordeRuw) ? parseInt(volgordeRuw, 10) : null;
    uit.push({
      klant,
      korteNaam: idxNaam === -1 ? "" : (rij[idxNaam] ?? "").trim(),
      volgorde,
    });
  }
  return uit;
}

interface WeergaveBestand {
  regels: WeergaveRegel[];
  bestand: DriveFileRef | null;
}

/**
 * Haalt de weergave op. Bestaat het bestand nog niet, dan is dat geen fout:
 * dan blijft alles zoals het in KLANTEN.md staat en schrijft de eerste
 * sleepactie het bestand aan.
 */
export async function leesWeergave(): Promise<WeergaveBestand> {
  const root = getRootFolderId();
  const bestand = await findFileByName(root, WEERGAVE_BESTAND);
  if (!bestand) return { regels: [], bestand: null };
  const md = await readFileContent(bestand.id);
  return { regels: weergaveUitMarkdown(md), bestand };
}

/**
 * Legt een nieuwe volgorde vast voor de klanten van één groep. De regels van
 * andere klanten blijven staan zoals ze waren, inclusief hun korte naam.
 */
export function metNieuweVolgorde(
  bestaand: WeergaveRegel[],
  klantenInVolgorde: string[],
): WeergaveRegel[] {
  const perKlant = new Map(bestaand.map((r) => [r.klant, { ...r }]));
  klantenInVolgorde.forEach((klant, i) => {
    const regel = perKlant.get(klant) ?? { klant, korteNaam: "", volgorde: null };
    regel.volgorde = i + 1;
    perKlant.set(klant, regel);
  });
  return [...perKlant.values()];
}

/** Schrijft de weergave terug naar Drive. */
export async function schrijfWeergave(
  regels: WeergaveRegel[],
  bestand: DriveFileRef | null,
): Promise<void> {
  const root = getRootFolderId();
  await writeDocument({
    folderId: root,
    fileName: WEERGAVE_BESTAND,
    content: weergaveNaarMarkdown(regels),
    knownFileId: bestand?.id ?? null,
    knownModifiedTime: bestand?.modifiedTime ?? null,
  });
  // De maplijst van de root is per verzoek gecached; na een schrijfactie zou
  // een volgende lezing anders het oude bestand terugvinden.
  vergeetMapInhoud(root);
}
