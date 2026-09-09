"use server";

import { titelVanLink } from "@/lib/links";

/**
 * app/_components/link-acties.ts — de titel bij een geplakte link ophalen,
 * vanuit de editor zelf (09-09-2026, op verzoek).
 *
 * Bij het opslaan gebeurt dit ook al (lib/links.ts), maar dat zie je pas
 * ná het opslaan. Maarten wil de titel meteen zien op het moment dat hij
 * plakt: "ik wil gewoon de titel zien, of het nu een webpagina, een document
 * of een sheet is". Vandaar deze ene, kleine actie.
 *
 * Levert nooit een fout op: lukt het opzoeken niet, dan komt er null terug en
 * blijft de kale link staan zoals je hem plakte.
 */
export async function titelVanLinkAction(url: string): Promise<string | null> {
  try {
    return await titelVanLink(String(url ?? ""));
  } catch {
    return null;
  }
}
