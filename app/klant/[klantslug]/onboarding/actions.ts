"use server";

import { revalidatePath } from "next/cache";
import { getKlantBySlug } from "@/lib/klanten";
import { findFileByName, readFileContent, VersionConflictError } from "@/lib/drive";
import { koppelingOpslaan, onderdeelOpslaan } from "@/lib/onboarding";

/**
 * app/klant/[klantslug]/onboarding/actions.ts — server actions voor de
 * Onboarding-tab. Twee acties: een ladderstap (code, bijv. "1a") aan/uit
 * vinken in toelichting.md, en een koppeling op "niet van toepassing" zetten
 * of terug in toegang.md (11-09-2026 erbij). klant.md, tone-of-voice.md en
 * klantstem.md blijven puur leesbaar getoond.
 */
export async function onderdeelWisselenAction(klantSlug: string, taakN: number, code: string) {
  const klant = await getKlantBySlug(klantSlug);
  if (!klant?.mapId) throw new Error("Deze klant heeft nog geen dossier in Drive.");

  try {
    const [toelichtingBestand] = await Promise.all([findFileByName(klant.mapId, "toelichting.md")]);
    const toelichtingMd = toelichtingBestand ? await readFileContent(toelichtingBestand.id) : "";
    await onderdeelOpslaan(klant.mapId, toelichtingBestand, toelichtingMd, taakN, code);
  } catch (err) {
    if (err instanceof VersionConflictError) {
      throw new Error("Dit bestand is intussen elders gewijzigd, laad de pagina opnieuw.");
    }
    throw err instanceof Error ? err : new Error("Kon dit vinkje niet opslaan.");
  }

  revalidatePath(`/klant/${klantSlug}/onboarding`);
}

/**
 * Een koppeling op "niet van toepassing" zetten of weer terug. Verandert
 * precies één cel in de tabel van toegang.md; zie de uitleg bij
 * koppelingVanToepassingWisselen() in lib/onboarding.ts.
 */
export async function koppelingWisselenAction(
  klantSlug: string,
  naam: string,
  vanToepassing: boolean,
) {
  const klant = await getKlantBySlug(klantSlug);
  if (!klant?.mapId) throw new Error("Deze klant heeft nog geen dossier in Drive.");

  try {
    const toegangBestand = await findFileByName(klant.mapId, "toegang.md");
    const toegangMd = toegangBestand ? await readFileContent(toegangBestand.id) : "";
    await koppelingOpslaan(klant.mapId, toegangBestand, toegangMd, naam, vanToepassing);
  } catch (err) {
    if (err instanceof VersionConflictError) {
      throw new Error("Dit bestand is intussen elders gewijzigd, laad de pagina opnieuw.");
    }
    throw err instanceof Error ? err : new Error("Kon deze koppeling niet opslaan.");
  }

  revalidatePath(`/klant/${klantSlug}/onboarding`);
}
