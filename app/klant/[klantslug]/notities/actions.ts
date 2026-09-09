"use server";

import { revalidatePath } from "next/cache";
import { getKlantBySlug } from "@/lib/klanten";
import { leesNotities, notitiesOpslaan } from "@/lib/notities";
import { VersionConflictError } from "@/lib/drive";
import { resolveDriveLinksInText } from "@/lib/links";

/**
 * app/klant/[klantslug]/notities/actions.ts — server action voor de
 * Notities-tab. Eén actie: de volledige tekst opslaan. Geen aparte
 * "toevoegen"-actie zoals bij taken — notities.md is in de artifact één vrij
 * schrijfveld zonder vaste regels/items om aan toe te voegen (zie de
 * doc-comment in lib/notities.ts), dus bewerken betekent hier de hele tekst
 * overschrijven, net als bij een gewoon tekstdocument.
 */

export async function notitiesOpslaanAction(klantSlug: string, tekstRuw: string) {
  const klant = await getKlantBySlug(klantSlug);
  if (!klant?.mapId) throw new Error("Deze klant heeft nog geen dossier in Drive.");

  // Kale Drive-links worden vóór het schrijven omgezet naar `[Titel](url)`
  // — zie de doc-comment in lib/links.ts.
  const tekst = await resolveDriveLinksInText(String(tekstRuw ?? ""));

  try {
    const huidig = await leesNotities(klant.mapId);
    await notitiesOpslaan(klant.mapId, huidig, tekst);
  } catch (err) {
    if (err instanceof VersionConflictError) {
      throw new Error("Dit bestand is intussen elders gewijzigd, laad de pagina opnieuw.");
    }
    throw err instanceof Error ? err : new Error("Kon notities.md niet opslaan.");
  }

  revalidatePath(`/klant/${klantSlug}/notities`);
  revalidatePath(`/klant/${klantSlug}/werkbord`);
}
