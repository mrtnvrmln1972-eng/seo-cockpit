import "server-only";

import { findFileByName, readFileContent, type DriveFileRef } from "./drive";
import type { Klant } from "./klanten";

/**
 * lib/dossier.ts — kleine gedeelde helper om één dossierbestand
 * (werklijst.md, roadmap.md, signalen.md, meta.md, ...) uit de klantmap op
 * te halen. Elke tab haalt lazy alleen de bestanden op die hij nodig heeft
 * (spec §2.1, TABNODIG) — deze helper doet dat ene bestand, niets meer.
 */
export interface DossierBestand {
  file: DriveFileRef;
  content: string;
}

export async function leesDossierBestand(
  klant: Klant,
  bestandsnaam: string,
): Promise<DossierBestand | null> {
  if (!klant.mapId) return null;
  const file = await findFileByName(klant.mapId, bestandsnaam);
  if (!file) return null;
  const content = await readFileContent(file.id);
  return { file, content };
}
