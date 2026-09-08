"use server";

/**
 * app/bord-cc5100460da936203b8222ad79b65779/actions.ts — server action voor
 * het Developerbord. Eén statuswissel: klaar melden of heropenen. Bewust
 * geen extra goedkeuringslaag of verplicht tijdsindicatie-veld — de
 * developer vinkt zelf af wanneer een taak klaar is (zie de doc-comment in
 * page.tsx).
 *
 * Fouten (bijv. VersionConflictError uit lib/drive.ts, wanneer developer.md
 * intussen elders is gewijzigd) worden hier bewust niet apart afgevangen:
 * voor deze fase is het acceptabel dat een mislukte actie gewoon Next.js's
 * standaard foutpagina toont.
 */

import { revalidatePath } from "next/cache";
import { developerStatusOpslaan } from "@/lib/developerboard";

const DEVBORD_PATH = "/bord-cc5100460da936203b8222ad79b65779";

export async function zetStatusAction(
  klantFolderId: string,
  klantSlug: string,
  n: number,
  waarde: "klaar" | "open",
) {
  await developerStatusOpslaan(klantFolderId, n, waarde);
  revalidatePath(DEVBORD_PATH);
  revalidatePath(`/klant/${klantSlug}/werkbord`);
}
