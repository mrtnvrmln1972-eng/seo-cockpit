"use server";

import { revalidatePath } from "next/cache";
import { getKlantBySlug } from "@/lib/klanten";
import { findFileByName, readFileContent, VersionConflictError } from "@/lib/drive";
import { onderdeelOpslaan } from "@/lib/onboarding";

/**
 * app/klant/[klantslug]/onboarding/actions.ts — server action voor de
 * Onboarding-tab. Eén actie: een ladderstap (code, bijv. "1a") aan/uit
 * vinken in toelichting.md. Alle andere bestanden op dit tabblad
 * (toegang.md, klant.md, tone-of-voice.md, klantstem.md) zijn puur leesbaar
 * getoond — zie de doc-comment in lib/onboarding.ts voor waarom daar niet
 * naar teruggeschreven wordt.
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
