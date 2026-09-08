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

/**
 * klantFolderId/n/waarde gaan als verborgen formuliervelden mee (FormData)
 * in plaats van als extra .bind()-argumenten — dezelfde vorm als
 * maakTaakAction/notitiesOpslaanAction (één gebonden argument, de rest uit
 * FormData). Eerdere versie bond alle vier als losse .bind()-argumenten,
 * wat in productie leidde tot een volledige serverfout (Vercel-foutpagina,
 * geen React-foutgrens die het nog kon opvangen) zodra de knop werd
 * ingedrukt — dit is de bekend-werkende vorm.
 */
export async function zetStatusAction(klantSlug: string, formData: FormData) {
  const klantFolderId = String(formData.get("klantFolderId") ?? "");
  const n = parseInt(String(formData.get("n") ?? ""), 10);
  const waardeRuw = String(formData.get("waarde") ?? "");
  const waarde = waardeRuw === "klaar" || waardeRuw === "open" ? waardeRuw : null;

  if (!klantFolderId || !Number.isFinite(n) || !waarde) {
    throw new Error("Ontbrekende gegevens bij het opslaan van de status.");
  }

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
