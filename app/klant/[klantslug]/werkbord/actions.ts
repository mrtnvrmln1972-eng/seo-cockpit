"use server";

import { revalidatePath } from "next/cache";
import { getKlantBySlug } from "@/lib/klanten";
import {
  leesWerklijstDossier,
  taakToevoegen,
  taakStatusOpslaan,
  toelichtingVoor,
  parseWerklijst,
  werklijstHerschikken,
  werklijstTitel,
  toelichtingVervangen,
} from "@/lib/werklijst";
import { taakNaarDeveloperbord } from "@/lib/developerboard";
import { VersionConflictError, writeDocument } from "@/lib/drive";
import { resolveDriveLinksInText } from "@/lib/links";

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
  const notitiesRuw = String(formData.get("notities") || "").trim();
  // Kale Drive-links in de notities worden vóór het schrijven omgezet naar
  // `[Titel](url)` — zie de doc-comment in lib/links.ts.
  const notities = await resolveDriveLinksInText(notitiesRuw);

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

/**
 * herschikTakenAction — de volgorde van de taakregels in werklijst.md
 * aanpassen na een sleepactie in de Takenlijst-tab (TakenlijstItems.tsx).
 * Geen <form>/FormData nodig (zelfde afwijkende vorm als
 * zetUitvoerdatumAction op het Developerbord): dit wordt aangeroepen vanuit
 * een drag-and-drop-gebeurtenis, direct met de volledige nieuwe
 * taaknummer-volgorde als argument.
 */
export async function herschikTakenAction(
  klantSlug: string,
  volgordeNs: number[],
): Promise<void> {
  const klant = await getKlantBySlug(klantSlug);
  if (!klant?.mapId) throw new Error("Deze klant heeft nog geen dossier in Drive.");

  try {
    const dossier = await leesWerklijstDossier(klant.mapId);
    const nieuw = werklijstHerschikken(dossier.werklijstMd, volgordeNs);
    if (!nieuw) throw new Error("Kon de nieuwe volgorde niet in werklijst.md verwerken.");
    await writeDocument({
      folderId: klant.mapId,
      fileName: "werklijst.md",
      content: nieuw,
      knownFileId: dossier.werklijstBestand?.id ?? null,
      knownModifiedTime: dossier.werklijstBestand?.modifiedTime ?? null,
    });
  } catch (err) {
    throw foutmelding(err, "Kon de volgorde niet opslaan.");
  }

  revalidatePath(`/klant/${klantSlug}/werkbord`);
}

/**
 * Past de tekst van één taak aan: de titel in werklijst.md en de volledige
 * toelichting onder "## Taak N" in toelichting.md.
 *
 * Er wordt alleen geschreven wat ook echt veranderd is, zodat een taak
 * openen, lezen en weer sluiten zonder wijziging geen schrijfactie op Drive
 * oplevert. De toelichting gaat er letterlijk in zoals hij is ingetypt: het
 * blijft een markdown-dossierbestand dat ook buiten deze app gelezen en
 * bewerkt wordt (zie CLAUDE.md), dus we sleutelen hier niet aan de opmaak.
 */
export async function taakBewerkenAction(
  klantSlug: string,
  n: number,
  formData: FormData,
): Promise<void> {
  const klant = await getKlantBySlug(klantSlug);
  if (!klant?.mapId) throw new Error("Deze klant heeft nog geen dossier in Drive.");

  const titel = String(formData.get("titel") || "").trim();
  if (!titel) throw new Error("Een taak heeft een titel nodig.");
  // Kale Drive-links worden ook hier omgezet naar `[Titel](url)`, net als bij
  // een nieuwe taak — zie de doc-comment in lib/links.ts.
  const toelichting = await resolveDriveLinksInText(String(formData.get("toelichting") ?? ""));

  try {
    const dossier = await leesWerklijstDossier(klant.mapId);

    const huidigeTaak = parseWerklijst(dossier.werklijstMd).find((t) => t.n === n);
    if (!huidigeTaak) throw new Error("Deze taak staat niet (meer) in werklijst.md.");

    if (huidigeTaak.titel.trim() !== titel) {
      const nieuweWerklijst = werklijstTitel(dossier.werklijstMd, n, titel);
      if (!nieuweWerklijst) throw new Error("Kon de titel niet in werklijst.md verwerken.");
      await writeDocument({
        folderId: klant.mapId,
        fileName: "werklijst.md",
        content: nieuweWerklijst,
        knownFileId: dossier.werklijstBestand?.id ?? null,
        knownModifiedTime: dossier.werklijstBestand?.modifiedTime ?? null,
      });
    }

    if (toelichtingVoor(dossier.toelichtingMd, n).trim() !== toelichting.trim()) {
      await writeDocument({
        folderId: klant.mapId,
        fileName: "toelichting.md",
        content: toelichtingVervangen(dossier.toelichtingMd, n, toelichting),
        knownFileId: dossier.toelichtingBestand?.id ?? null,
        knownModifiedTime: dossier.toelichtingBestand?.modifiedTime ?? null,
      });
    }
  } catch (err) {
    throw foutmelding(err, "Kon deze taak niet opslaan.");
  }

  revalidatePath(`/klant/${klantSlug}/werkbord`);
}
