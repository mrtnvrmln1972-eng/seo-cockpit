"use server";

import { revalidatePath } from "next/cache";
import { getKlantBySlug, type Klant } from "@/lib/klanten";
import { VersionConflictError } from "@/lib/drive";
import { resolveDriveLinksInText } from "@/lib/links";
import {
  ALLE_STAPPEN,
  BEWERKBARE_VELDEN,
  NOC_SLUG,
  muteerEnSchrijf,
  type BewerkbaarVeld,
} from "@/lib/servicepunten";

/**
 * app/klant/[klantslug]/servicepunten/actions.ts — server actions voor de
 * Servicepunten-tab (alleen Nationaal Oogcentrum, zie NOC_SLUG). Vier
 * acties: één los tekstveld van een vestiging opslaan, één aansluitstap
 * (af)vinken met datum, een contactlogregel toevoegen, en de vrije tekst
 * onder "Eenmalig geregeld" opslaan (zelfde whole-tekst-overschrijven-
 * patroon als de Notities-tab, zie lib/notities.ts).
 */

function foutmelding(err: unknown, fallback: string): Error {
  if (err instanceof VersionConflictError) {
    return new Error("Dit bestand is intussen elders gewijzigd, laad de pagina opnieuw.");
  }
  if (err instanceof Error) return err;
  return new Error(fallback);
}

async function klantMetServicepuntenDossier(klantSlug: string): Promise<Klant> {
  const klant = await getKlantBySlug(klantSlug);
  if (!klant?.mapId) throw new Error("Deze klant heeft nog geen dossier in Drive.");
  if (klant.slug !== NOC_SLUG) {
    throw new Error("Servicepunten is alleen beschikbaar voor Nationaal Oogcentrum.");
  }
  return klant;
}

export async function servicepuntVeldOpslaanAction(
  klantSlug: string,
  vestigingId: string,
  veld: BewerkbaarVeld,
  waardeRuw: string,
): Promise<void> {
  if (!BEWERKBARE_VELDEN.includes(veld)) throw new Error("Onbekend veld.");
  const klant = await klantMetServicepuntenDossier(klantSlug);
  const waarde = await resolveDriveLinksInText(waardeRuw);

  try {
    await muteerEnSchrijf(klant.mapId!, (dossier) => {
      const vestiging = dossier.vestigingen.find((v) => v.id === vestigingId);
      if (!vestiging) throw new Error("Deze vestiging is niet gevonden in servicepunten.md.");
      vestiging[veld] = waarde;
    });
  } catch (err) {
    throw foutmelding(err, "Kon dit veld niet opslaan.");
  }

  revalidatePath(`/klant/${klantSlug}/servicepunten`);
}

export async function servicepuntStapOpslaanAction(
  klantSlug: string,
  vestigingId: string,
  stapId: string,
  afgevinkt: boolean,
  datum: string,
): Promise<void> {
  if (!ALLE_STAPPEN.some((s) => s.id === stapId)) throw new Error("Onbekende stap.");
  const klant = await klantMetServicepuntenDossier(klantSlug);

  try {
    await muteerEnSchrijf(klant.mapId!, (dossier) => {
      const vestiging = dossier.vestigingen.find((v) => v.id === vestigingId);
      if (!vestiging) throw new Error("Deze vestiging is niet gevonden in servicepunten.md.");
      const bestaand = vestiging.checklist[stapId] || { afgevinkt: false, datum: "" };
      // Vinkt iemand een stap voor het eerst aan zonder zelf een datum te
      // kiezen, dan valt de datum terug op vandaag — zelfde gedrag als de
      // artifact (change-handler op de checkbox zette ook automatisch de
      // datum van vandaag als die nog leeg was).
      const nieuweDatum = datum || (afgevinkt && !bestaand.datum ? new Date().toISOString().slice(0, 10) : bestaand.datum);
      vestiging.checklist[stapId] = { afgevinkt, datum: nieuweDatum };
    });
  } catch (err) {
    throw foutmelding(err, "Kon deze stap niet opslaan.");
  }

  revalidatePath(`/klant/${klantSlug}/servicepunten`);
}

export async function servicepuntLogToevoegenAction(
  klantSlug: string,
  vestigingId: string,
  formData: FormData,
): Promise<void> {
  const klant = await klantMetServicepuntenDossier(klantSlug);
  const datum = String(formData.get("datum") || "").trim() || new Date().toISOString().slice(0, 10);
  const wie = String(formData.get("wie") || "Maarten").trim() || "Maarten";
  const tekstRuw = String(formData.get("tekst") || "").trim();
  if (!tekstRuw) throw new Error("Vul een tekst in voor het contactlog.");
  const tekst = await resolveDriveLinksInText(tekstRuw);

  try {
    await muteerEnSchrijf(klant.mapId!, (dossier) => {
      const vestiging = dossier.vestigingen.find((v) => v.id === vestigingId);
      if (!vestiging) throw new Error("Deze vestiging is niet gevonden in servicepunten.md.");
      vestiging.contactlog.push({ datum, wie, tekst });
    });
  } catch (err) {
    throw foutmelding(err, "Kon dit contactmoment niet opslaan.");
  }

  revalidatePath(`/klant/${klantSlug}/servicepunten`);
}

export async function servicepuntEenmaligOpslaanAction(klantSlug: string, formData: FormData): Promise<void> {
  const klant = await klantMetServicepuntenDossier(klantSlug);
  const tekstRuw = String(formData.get("tekst") ?? "");
  const tekst = await resolveDriveLinksInText(tekstRuw);

  try {
    await muteerEnSchrijf(klant.mapId!, (dossier) => {
      dossier.eenmaligGeregeld = tekst;
    });
  } catch (err) {
    throw foutmelding(err, "Kon dit niet opslaan.");
  }

  revalidatePath(`/klant/${klantSlug}/servicepunten`);
}
