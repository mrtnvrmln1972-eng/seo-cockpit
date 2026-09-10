"use server";

import { revalidatePath } from "next/cache";
import { getKlantBySlug, type Klant } from "@/lib/klanten";
import { VersionConflictError } from "@/lib/drive";
import { resolveDriveLinksInText } from "@/lib/links";
import {
  ALLE_STAPPEN,
  BEWERKBARE_VELDEN,
  NOC_SLUG,
  herschikPrioriteiten,
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
      const bestaand = vestiging.checklist[stapId] || { afgevinkt: false, datum: "", notitie: "", link: "" };
      // Vinkt iemand een stap voor het eerst aan zonder zelf een datum te
      // kiezen, dan valt de datum terug op vandaag — zelfde gedrag als de
      // artifact (change-handler op de checkbox zette ook automatisch de
      // datum van vandaag als die nog leeg was).
      const nieuweDatum = datum || (afgevinkt && !bestaand.datum ? new Date().toISOString().slice(0, 10) : bestaand.datum);
      vestiging.checklist[stapId] = { ...bestaand, afgevinkt, datum: nieuweDatum };
    });
  } catch (err) {
    throw foutmelding(err, "Kon deze stap niet opslaan.");
  }

  revalidatePath(`/klant/${klantSlug}/servicepunten`);
}

/**
 * De vrije tekst bij één stap van het aansluitproces: waar het nu staat, met
 * de links naar wat er is aangemaakt. Komt als "#### <stap>"-blok in
 * servicepunten.md te staan, dus met volledige opmaak, en dus ook te vullen
 * of aan te vullen vanuit een Cowork-gesprek.
 */
export async function servicepuntStapNotitieOpslaanAction(
  klantSlug: string,
  vestigingId: string,
  stapId: string,
  tekstRuw: string,
): Promise<void> {
  if (!ALLE_STAPPEN.some((s) => s.id === stapId)) throw new Error("Onbekende stap.");
  const klant = await klantMetServicepuntenDossier(klantSlug);
  const tekst = await resolveDriveLinksInText(String(tekstRuw ?? ""));

  try {
    await muteerEnSchrijf(klant.mapId!, (dossier) => {
      const vestiging = dossier.vestigingen.find((v) => v.id === vestigingId);
      if (!vestiging) throw new Error("Deze vestiging is niet gevonden in servicepunten.md.");
      const bestaand = vestiging.checklist[stapId] || { afgevinkt: false, datum: "", notitie: "", link: "" };
      vestiging.checklist[stapId] = { ...bestaand, notitie: tekst };
    });
  } catch (err) {
    throw foutmelding(err, "Kon deze opmerking niet opslaan.");
  }

  revalidatePath(`/klant/${klantSlug}/servicepunten`);
}

/**
 * Het adres van de pagina die bij een stap hoort, geplakt op de regel zelf
 * (het bedrijfsprofiel, de SEO-landingspagina, de Ads-pagina). Komt als cel
 * in de Aansluitproces-tabel te staan, niet als notitie: het is één adres.
 */
export async function servicepuntStapLinkOpslaanAction(
  klantSlug: string,
  vestigingId: string,
  stapId: string,
  linkRuw: string,
): Promise<void> {
  const stap = ALLE_STAPPEN.find((s) => s.id === stapId);
  if (!stap) throw new Error("Onbekende stap.");
  if (!stap.linkveld) throw new Error("Bij deze stap hoort geen link.");
  const klant = await klantMetServicepuntenDossier(klantSlug);
  const link = String(linkRuw ?? "").trim();

  try {
    await muteerEnSchrijf(klant.mapId!, (dossier) => {
      const vestiging = dossier.vestigingen.find((v) => v.id === vestigingId);
      if (!vestiging) throw new Error("Deze vestiging is niet gevonden in servicepunten.md.");
      const bestaand = vestiging.checklist[stapId] || { afgevinkt: false, datum: "", notitie: "", link: "" };
      vestiging.checklist[stapId] = { ...bestaand, link };
    });
  } catch (err) {
    throw foutmelding(err, "Kon deze link niet opslaan.");
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

/**
 * De volgorde waarin de servicepunten worden aangesloten, zoals Maarten ze
 * op het tabblad Volgorde heeft gesleept: `idsOpVolgorde` is de complete
 * lijst van boven naar beneden, en wordt hier doorgenummerd vanaf 1. Wat
 * niet in de lijst staat (de punten die al draaien) houdt wat het had.
 */
export async function servicepuntVolgordeOpslaanAction(
  klantSlug: string,
  idsOpVolgorde: string[],
): Promise<void> {
  const klant = await klantMetServicepuntenDossier(klantSlug);
  const ids = (idsOpVolgorde ?? []).map((id) => String(id));
  if (ids.length === 0) throw new Error("Geen volgorde ontvangen.");

  try {
    await muteerEnSchrijf(klant.mapId!, (dossier) => {
      const onbekend = ids.find((id) => !dossier.vestigingen.some((v) => v.id === id));
      if (onbekend) throw new Error("Deze vestiging is niet gevonden in servicepunten.md.");
      herschikPrioriteiten(dossier.vestigingen, ids);
    });
  } catch (err) {
    throw foutmelding(err, "Kon de volgorde niet opslaan.");
  }

  revalidatePath(`/klant/${klantSlug}/servicepunten`);
}

/** De vrije notities bij deze klant (de vierde tab), als eigen sectie in servicepunten.md. */
export async function servicepuntNotitiesOpslaanAction(
  klantSlug: string,
  tekstRuw: string,
): Promise<void> {
  const klant = await klantMetServicepuntenDossier(klantSlug);
  const tekst = await resolveDriveLinksInText(String(tekstRuw ?? ""));

  try {
    await muteerEnSchrijf(klant.mapId!, (dossier) => {
      dossier.notities = tekst;
    });
  } catch (err) {
    throw foutmelding(err, "Kon de notities niet opslaan.");
  }

  revalidatePath(`/klant/${klantSlug}/servicepunten`);
}

export async function servicepuntEenmaligOpslaanAction(
  klantSlug: string,
  tekstRuw: string,
): Promise<void> {
  const klant = await klantMetServicepuntenDossier(klantSlug);
  const tekst = await resolveDriveLinksInText(String(tekstRuw ?? ""));

  try {
    await muteerEnSchrijf(klant.mapId!, (dossier) => {
      dossier.eenmaligGeregeld = tekst;
    });
  } catch (err) {
    throw foutmelding(err, "Kon dit niet opslaan.");
  }

  revalidatePath(`/klant/${klantSlug}/servicepunten`);
}
