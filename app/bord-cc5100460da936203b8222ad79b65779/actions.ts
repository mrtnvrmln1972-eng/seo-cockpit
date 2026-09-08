"use server";

/**
 * app/bord-cc5100460da936203b8222ad79b65779/actions.ts — server action voor
 * het Developerbord. Eén statuswissel: klaar melden of heropenen. Bewust
 * geen extra goedkeuringslaag of verplicht tijdsindicatie-veld — de
 * developer vinkt zelf af wanneer een taak klaar is (zie de doc-comment in
 * page.tsx).
 *
 * Fouten (bijv. VersionConflictError uit lib/drive.ts, wanneer developer.md
 * intussen elders is gewijzigd) worden hier WEL omgezet naar een leesbare
 * Nederlandse melding — zelfde patroon als notities/actions.ts en
 * werkbord/actions.ts. Zonder die omzetting toont Next.js in productie een
 * onleesbare, geminifieerde React-foutmelding zonder detail (error #441).
 */

import { revalidatePath } from "next/cache";
import { developerStatusOpslaan } from "@/lib/developerboard";
import { VersionConflictError } from "@/lib/drive";

const DEVBORD_PATH = "/bord-cc5100460da936203b8222ad79b65779";

export async function zetStatusAction(
  klantFolderId: string,
  klantSlug: string,
  n: number,
  waarde: "klaar" | "open",
) {
  try {
    await developerStatusOpslaan(klantFolderId, n, waarde);
  } catch (err) {
    if (err instanceof VersionConflictError) {
      throw new Error("Dit bestand is intussen elders gewijzigd, laad de pagina opnieuw.");
    }
    throw err instanceof Error ? err : new Error("Kon de status niet opslaan.");
  }
  revalidatePath(DEVBORD_PATH);
  revalidatePath(`/klant/${klantSlug}/werkbord`);
}
