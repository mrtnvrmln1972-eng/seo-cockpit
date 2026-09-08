import "server-only";

import {
  findFileByName,
  readFileContent,
  writeDocument,
  type DriveFileRef,
} from "./drive";

/**
 * lib/notities.ts — lezen/schrijven van notities.md.
 *
 * Waar werklijst.md en developer.md een vaste, herkenbare tabelstructuur
 * hebben, is notities.md in de praktijk gewoon een vrij schrijfveld — in de
 * artifact letterlijk "Eén veld. Notities, afspraken, documenten en links
 * zijn allemaal gewoon notities, dus die staan bij elkaar. Het begint leeg."
 * (vNotities()/schrijfblok() in de artifact, zie CLAUDE.md/lib/werklijst.ts
 * voor de manier waarop we de artifact als bron raadplegen).
 *
 * Een live audit (08-09-2026) van notities.md bij zes klanten (Kamsteeg,
 * Bogard, Eerste Kamer Badkamers, GardenSwimm, Nationaal Oogcentrum, One Day
 * Clinic) bevestigt dat: geen twee bestanden gebruiken dezelfde structuur.
 * Sommige hebben ##-koppen en nette tabellen, andere zijn alleen een
 * linklijstje of zelfs maar één regel, en meerdere bestanden hebben stukken
 * platte, aan elkaar geplakte tekst zonder regeleinde. Er is dus BEWUST geen
 * parser die op een vaste structuur rekent (zoals bij werklijst.md) — dit
 * bestand wordt puur als vrije tekst gelezen en met lib/markdown.ts's
 * renderAlineas() getoond zoals het er staat (koppen, tabellen, bullets en
 * vinklijsten worden herkend, de rest wordt gewoon alinea's).
 *
 * LET OP: bij minstens twee van de zes gecontroleerde klanten staan er
 * wachtwoorden in platte tekst in notities.md (inlog-gegevens voor een CMS).
 * Dit bestand wordt hier ongewijzigd getoond, exact zoals in de artifact.
 */

export interface NotitiesBestand {
  bestand: DriveFileRef | null;
  md: string;
}

export async function leesNotities(klantFolderId: string): Promise<NotitiesBestand> {
  const bestand = await findFileByName(klantFolderId, "notities.md");
  const md = bestand ? await readFileContent(bestand.id) : "";
  return { bestand, md };
}

export async function notitiesOpslaan(
  klantFolderId: string,
  huidig: NotitiesBestand,
  nieuweMd: string,
): Promise<void> {
  await writeDocument({
    folderId: klantFolderId,
    fileName: "notities.md",
    content: nieuweMd,
    knownFileId: huidig.bestand?.id ?? null,
    knownModifiedTime: huidig.bestand?.modifiedTime ?? null,
  });
}
