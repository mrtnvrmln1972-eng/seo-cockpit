"use server";

import { revalidatePath } from "next/cache";
import { getKlantBySlug } from "@/lib/klanten";
import {
  leesWerklijstDossier,
  taakToevoegen,
  taakStatusOpslaan,
  toelichtingVoor,
  parseWerklijst,
} from "@/lib/werklijst";
import { taakNaarDeveloperbord } from "@/lib/developerboard";
import { VersionConflictError } from "@/lib/drive";

/**
 * app/klant/[klantslug]/werkbord/actions.ts — server actions voor de
 * Takenlijst-tab (werkbord). Twee acties: een nieuwe taak toevoegen aan
 * werklijst.md/toelichting.md, en een taak doorzetten naar het
 * Developerbord (developer.md van dezelfde klant + de gedeelde
 * developerbord-route).
 *
 * Beide acties vangen VersionConflictError expliciet af en gooien een
 * Nederlandse, leesbare foutmelding terug — de dichtstbijzijnde
 * app/klant/[klantslug]/werkbord/error.tsx toont die vervolgens via
 * Next.js's ingebouwde error-boundary, in plaats van een generieke crash.
 */

const DEVBORD_PATH = "/bord-cc5100460da936203b8222ad79b65779";

function foutmelding(err: unknown, fallback: string): Error {
  if (err instanceof VersionConflictError) {
    return new Error(
      "Dit bestand is intussen elders gewijzigd, laad de pagina opnieuw.",
    );
  }
  if (err instanceof Error) return err;
  return new Error(fallback);
}

export async function maakTaakAction(klantSlug: string, formData: FormData) {
  const klant = await getKlantBySlug(klantSlug);
  if (!klant?.mapId) throw new Error("Deze klant heeft nog geen dossier in Drive.");

  const titel = String(formData.get("titel") || "").trim();
  if (!titel) throw new Error("Een taak heeft een titel nodig.");
  const notities = String(formData.get("notities") || "").trim();

  try {
    const dossier = await leesWerklijstDossier(klant.mapId);
    // Stap: van de eerste nog-niet-klare/vervallen taak, anders de stap van
    // de eerste taak in de lijst, anders een vaste fallback. Geen eigen
    // logica over WELKE stap "logisch" is — puur een bestaande waarde
    // hergebruiken zodat de nieuwe taak niet in een lege/verzonnen stap valt.
    const taken = parseWerklijst(dossier.werklijstMd);
    const openTaak = taken.find((t) => !/klaar|vervallen/i.test(t.status) && t.stap);
    const stap = openTaak?.stap || (taken[0]?.stap ?? "Techniek");
    await taakToevoegen(klant.mapId, dossier, titel, notities, stap);
  } catch (err) {
    throw foutmelding(err, "Kon de taak niet toevoegen aan werklijst.md.");
  }

  revalidatePath(`/klant/${klantSlug}/werkbord`);
}

export async function zetNaarDeveloperbordAction(klantSlug: string, n: number) {
  const klant = await getKlantBySlug(klantSlug);
  if (!klant?.mapId) throw new Error("Deze klant heeft nog geen dossier in Drive.");

  try {
    const dossier = await leesWerklijstDossier(klant.mapId);
    const taak = parseWerklijst(dossier.werklijstMd).find((t) => t.n === n);
    if (!taak) throw new Error("Deze taak is niet gevonden in werklijst.md.");
    const detail = toelichtingVoor(dossier.toelichtingMd, n);
    await taakNaarDeveloperbord(klant.mapId, n, taak.titel, "", "", detail);
    await taakStatusOpslaan(klant.mapId, dossier, n, "bij developer").catch(() => {});
  } catch (err) {
    throw foutmelding(err, "Kon de taak niet doorzetten naar het developerbord.");
  }

  revalidatePath(`/klant/${klantSlug}/werkbord`);
  revalidatePath(DEVBORD_PATH);
}
