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
import {
  developerKlaarMeldenOpslaan,
  developerStatusOpslaan,
  developerTaakBewerkenOpslaan,
  developerTaakVerwijderenOpslaan,
  developerUitvoerdatumOpslaan,
} from "@/lib/developerboard";
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

/**
 * zetUitvoerdatumAction — de Uitvoerdatum van een taak zetten (of wissen,
 * datum "") vanuit de weekplanning-kalender. AFWIJKEND FORMAAT t.o.v. de
 * andere acties hierboven: geen FormData, maar directe argumenten — deze
 * actie wordt aangeroepen bij een drag-and-drop-gebeurtenis (Weekplanning.tsx),
 * niet vanuit een <form>, dus er is geen FormData om uit te lezen. Een server
 * action mag ook zo, rechtstreeks als async functie, aangeroepen worden.
 */
export async function zetUitvoerdatumAction(
  klantSlug: string,
  klantFolderId: string,
  n: number,
  datum: string,
): Promise<void> {
  if (!klantFolderId || !Number.isFinite(n)) {
    throw new Error("Ontbrekende gegevens bij het inplannen van de taak.");
  }
  try {
    await developerUitvoerdatumOpslaan(klantFolderId, n, datum);
  } catch (err) {
    throw foutmelding(err, "Kon de uitvoerdatum niet opslaan.");
  }
  revalidatePath(DEVBORD_PATH);
}

/**
 * bewerkTaakAction — een bestaande taak op het Developerbord aanpassen
 * (titel, opmerking, pagina, volledige context/detail) zonder ze opnieuw
 * door te hoeven zetten vanuit de werklijst. klantFolderId/n gaan, net als
 * bij zetStatusAction hierboven, als verborgen formuliervelden mee. Titel is
 * verplicht — zelfde validatiepatroon als maakTaakAction in
 * app/klant/[klantslug]/werkbord/actions.ts (lege titel na trim() ->
 * duidelijke Nederlandse foutmelding, geen stille no-op).
 */
export async function bewerkTaakAction(klantSlug: string, formData: FormData) {
  const klantFolderId = String(formData.get("klantFolderId") ?? "");
  const n = parseInt(String(formData.get("n") ?? ""), 10);
  const titel = String(formData.get("titel") ?? "").trim();
  const opmerking = String(formData.get("opmerking") ?? "").trim();
  const pagina = String(formData.get("pagina") ?? "").trim();
  const detail = String(formData.get("detail") ?? "").trim();

  if (!klantFolderId || !Number.isFinite(n)) {
    throw new Error("Ontbrekende gegevens bij het bewerken van de taak.");
  }
  if (!titel) {
    throw new Error("Een taak heeft een titel nodig.");
  }

  try {
    await developerTaakBewerkenOpslaan(klantFolderId, n, titel, opmerking, pagina, detail);
  } catch (err) {
    throw foutmelding(err, "Kon de taak niet bewerken.");
  }
  revalidatePath(DEVBORD_PATH);
  revalidatePath(`/klant/${klantSlug}/werkbord`);
}

/**
 * verwijderTaakAction — een taak volledig van het Developerbord verwijderen
 * (tabelrij + bijbehorend detailblok, zie developerTaakVerwijderen() in
 * lib/developerboard.ts). Zelfde formulierpatroon als zetStatusAction
 * hierboven: klantFolderId/n als verborgen velden, geen extra
 * .bind()-argumenten.
 */
export async function verwijderTaakAction(klantSlug: string, formData: FormData) {
  const klantFolderId = String(formData.get("klantFolderId") ?? "");
  const n = parseInt(String(formData.get("n") ?? ""), 10);

  if (!klantFolderId || !Number.isFinite(n)) {
    throw new Error("Ontbrekende gegevens bij het verwijderen van de taak.");
  }

  try {
    await developerTaakVerwijderenOpslaan(klantFolderId, n);
  } catch (err) {
    throw foutmelding(err, "Kon de taak niet verwijderen.");
  }
  revalidatePath(DEVBORD_PATH);
  revalidatePath(`/klant/${klantSlug}/werkbord`);
}
