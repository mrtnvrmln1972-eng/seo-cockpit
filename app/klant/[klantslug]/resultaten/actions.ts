"use server";

import { revalidatePath } from "next/cache";
import { getKlantBySlug } from "@/lib/klanten";
import { VersionConflictError } from "@/lib/drive";
import {
  leesSearchConsole,
  leesPaginaZoekwoorden,
  type GscUitslag,
  type Vergelijk,
} from "@/lib/google-data";
import { leesKpiDossier, schrijfKpiDossier, type Focus } from "@/lib/kpi-dossier";

/**
 * Server actions voor de Resultaten-tab.
 *
 * Bewust geen eigen API-routes: deze cockpit heeft die nergens, en een
 * server action doet hier hetzelfde werk. Het scherm roept ze aan om een
 * andere periode op te halen, een pagina open te klappen, en om vast te
 * leggen wat je volgt.
 */

function foutmelding(err: unknown, terugval: string): Error {
  if (err instanceof VersionConflictError) {
    return new Error("kpi.md is intussen elders gewijzigd, laad de pagina opnieuw.");
  }
  return err instanceof Error ? err : new Error(terugval);
}

async function klantMetMap(klantSlug: string) {
  const klant = await getKlantBySlug(klantSlug);
  if (!klant?.mapId) throw new Error("Deze klant heeft nog geen dossier in Drive.");
  return klant;
}

/** Search Console opnieuw ophalen voor een andere periode. */
export async function searchConsoleAction(
  klantSlug: string,
  dagen: number,
  vergelijk: Vergelijk,
): Promise<GscUitslag> {
  const klant = await klantMetMap(klantSlug);
  const kpi = await leesKpiDossier(klant.mapId!);
  return leesSearchConsole(klant.domein, dagen, vergelijk, kpi.searchConsoleProperty || undefined);
}

/** De zoekwoorden waarop één pagina gevonden wordt. */
export async function paginaZoekwoordenAction(
  klantSlug: string,
  property: string,
  url: string,
  dagen: number,
  vergelijk: Vergelijk,
) {
  await klantMetMap(klantSlug);
  return leesPaginaZoekwoorden(property, url, dagen, vergelijk);
}

/** Een zoekwoord markeren als prio of secundair, of de markering weghalen. */
export async function zoekwoordFocusAction(
  klantSlug: string,
  zoekwoord: string,
  focus: Focus | null,
): Promise<void> {
  const klant = await klantMetMap(klantSlug);
  try {
    const kpi = await leesKpiDossier(klant.mapId!);
    const sleutel = zoekwoord.trim().toLowerCase();
    if (!sleutel) return;
    const nieuw = { ...kpi.zoekwoorden };
    if (focus) nieuw[sleutel] = focus;
    else delete nieuw[sleutel];
    await schrijfKpiDossier(klant.mapId!, { ...kpi, zoekwoorden: nieuw });
  } catch (err) {
    throw foutmelding(err, "Kon dit zoekwoord niet vastleggen.");
  }
  revalidatePath(`/klant/${klantSlug}/resultaten`);
}

/** Een pagina een ster geven of afhalen. */
export async function paginaSterAction(klantSlug: string, url: string, ster: boolean): Promise<void> {
  const klant = await klantMetMap(klantSlug);
  try {
    const kpi = await leesKpiDossier(klant.mapId!);
    const zonder = kpi.sterren.filter((u) => u !== url);
    await schrijfKpiDossier(klant.mapId!, {
      ...kpi,
      sterren: ster ? [...zonder, url] : zonder,
    });
  } catch (err) {
    throw foutmelding(err, "Kon deze ster niet vastleggen.");
  }
  revalidatePath(`/klant/${klantSlug}/resultaten`);
}

/** De volgorde waarin pagina's bovenaan staan, na slepen. */
export async function paginaVolgordeAction(klantSlug: string, volgorde: string[]): Promise<void> {
  const klant = await klantMetMap(klantSlug);
  try {
    const kpi = await leesKpiDossier(klant.mapId!);
    await schrijfKpiDossier(klant.mapId!, { ...kpi, volgorde });
  } catch (err) {
    throw foutmelding(err, "Kon de volgorde niet vastleggen.");
  }
  revalidatePath(`/klant/${klantSlug}/resultaten`);
}
