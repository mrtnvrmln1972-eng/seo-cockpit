"use server";

/**
 * app/bord-cc5100460da936203b8222ad79b65779/actions.ts — server actions voor
 * het Developerbord.
 *
 * Twee acties, één workflow (08-09-2026, op Maartens verzoek de hele
 * Klaar/Afgerond-cyclus af te maken):
 *
 * 1. klaarMeldenAction — de DEVELOPER meldt een taak klaar. Verplicht: hoe
 *    lang hij ermee bezig is geweest (tijdsduur). Optioneel: terugkoppeling
 *    voor Maarten. Zet status "klaar" (= wacht op beoordeling), NIET
 *    "afgerond" — dat zet Maarten pas zelf.
 * 2. zetStatusAction — MAARTEN's eigen vervolgstap: "afgerond" zetten (taak
 *    is echt klaar) of "open" (heropenen, terug naar de developer). Bewust
 *    geen "klaar" meer als geldige waarde hier — dat loopt alleen nog via
 *    klaarMeldenAction, zodat een klaar-melding nooit zonder tijdsduur kan.
 *
 * Fouten (bijv. VersionConflictError uit lib/drive.ts, wanneer developer.md
 * intussen elders is gewijzigd) worden hier omgezet naar een leesbare
 * Nederlandse melding — zelfde patroon als notities/actions.ts en
 * werkbord/actions.ts. Zonder die omzetting toont Next.js in productie een
 * onleesbare, geminifieerde React-foutmelding zonder detail (error #441).
 */

import { revalidatePath } from "next/cache";
import { developerKlaarMeldenOpslaan, developerStatusOpslaan } from "@/lib/developerboard";
import { VersionConflictError } from "@/lib/drive";

const DEVBORD_PATH = "/bord-cc5100460da936203b8222ad79b65779";

function foutmelding(err: unknown, fallback: string): Error {
  if (err instanceof VersionConflictError) {
    return new Error("Dit bestand is intussen elders gewijzigd, laad de pagina opnieuw.");
  }
  return err instanceof Error ? err : new Error(fallback);
}

export async function klaarMeldenAction(klantSlug: string, formData: FormData) {
  const klantFolderId = String(formData.get("klantFolderId") ?? "");
  const n = parseInt(String(formData.get("n") ?? ""), 10);
  const tijdsduur = String(formData.get("tijdsduur") ?? "").trim();
  const terugkoppeling = String(formData.get("terugkoppeling") ?? "").trim();

  if (!klantFolderId || !Number.isFinite(n)) {
    throw new Error("Ontbrekende gegevens bij het klaar melden.");
  }
  if (!tijdsduur) {
    throw new Error("Vul in hoe lang je met deze taak bezig bent geweest.");
  }

  try {
    await developerKlaarMeldenOpslaan(klantFolderId, n, tijdsduur, terugkoppeling);
  } catch (err) {
    throw foutmelding(err, "Kon de taak niet klaar melden.");
  }
  revalidatePath(DEVBORD_PATH);
  revalidatePath(`/klant/${klantSlug}/werkbord`);
}

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
  const waarde = waardeRuw === "afgerond" || waardeRuw === "open" ? waardeRuw : null;

  if (!klantFolderId || !Number.isFinite(n) || !waarde) {
    throw new Error("Ontbrekende gegevens bij het opslaan van de status.");
  }

  try {
    await developerStatusOpslaan(klantFolderId, n, waarde);
  } catch (err) {
    throw foutmelding(err, "Kon de status niet opslaan.");
  }
  revalidatePath(DEVBORD_PATH);
  revalidatePath(`/klant/${klantSlug}/werkbord`);
}
