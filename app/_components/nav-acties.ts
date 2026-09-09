"use server";

import { revalidatePath } from "next/cache";
import { getKlantGroepen, vergeetKlanten } from "@/lib/klanten";
import { leesWeergave, metNieuweVolgorde, schrijfWeergave } from "@/lib/weergave";
import { VersionConflictError } from "@/lib/drive";

/**
 * app/_components/nav-acties.ts — server action achter het slepen van
 * klanten in de zijbalk (09-09-2026).
 *
 * De volgorde gaat naar cockpit-weergave.md, niet naar KLANTEN.md: zie de
 * uitleg bovenin lib/weergave.ts. De namen die binnenkomen worden eerst
 * afgezet tegen de klanten die de cockpit kent, zodat er nooit een verzonnen
 * regel in het bestand belandt.
 */
export async function klantenHerschikkenAction(
  groepId: string,
  klantenInVolgorde: string[],
): Promise<void> {
  const groepen = await getKlantGroepen();
  const groep = groepen.find((g) => g.id === groepId);
  if (!groep) throw new Error("Onbekende groep.");

  const bekend = new Set(groep.klanten.map((k) => k.naam));
  const volgorde = klantenInVolgorde.filter((naam) => bekend.has(naam));
  if (volgorde.length !== groep.klanten.length) {
    throw new Error("De lijst is intussen gewijzigd, laad de pagina opnieuw.");
  }

  try {
    const { regels, bestand } = await leesWeergave();
    await schrijfWeergave(metNieuweVolgorde(regels, volgorde), bestand);
  } catch (err) {
    if (err instanceof VersionConflictError) {
      throw new Error("De volgorde is intussen elders gewijzigd, laad de pagina opnieuw.");
    }
    throw err instanceof Error ? err : new Error("Kon de volgorde niet opslaan.");
  }

  vergeetKlanten();
  revalidatePath("/", "layout");
}
