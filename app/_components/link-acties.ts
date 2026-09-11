"use server";

import { titelVanLinkMetReden, uitlegBijReden } from "@/lib/links";

/**
 * app/_components/link-acties.ts — de titel bij een geplakte link ophalen,
 * vanuit de editor zelf (09-09-2026, op verzoek).
 *
 * Bij het opslaan gebeurt dit ook al (lib/links.ts), maar dat zie je pas
 * ná het opslaan. Maarten wil de titel meteen zien op het moment dat hij
 * plakt: "ik wil gewoon de titel zien, of het nu een webpagina, een document
 * of een sheet is". Vandaar deze ene, kleine actie.
 *
 * Levert nooit een fout op: lukt het opzoeken niet, dan komt er geen titel
 * terug en blijft de kale link staan zoals je hem plakte. Sinds 11-09-2026
 * komt er in dat geval wél een uitleg mee, want dát was het echte probleem:
 * er verscheen geen titel en er stond nergens waarom. Gemeten op de twee
 * links die Maarten plakte: een Google Docs-link geeft anoniem een 401 (het
 * document is niet met het service-account gedeeld) en een Cowork-link een
 * 403 van Cloudflare. Twee heel verschillende oorzaken, allebei stil.
 */
/**
 * Bewust geen geëxporteerd type hiernaast: uit een "use server"-bestand mag
 * alleen een async functie komen. De vorm ({ titel, uitleg }) leidt de
 * aanroeper zelf af; uitleg is één zin voor op het scherm als er geen titel
 * is, en anders null.
 */
export async function titelVanLinkAction(
  url: string,
): Promise<{ titel: string | null; uitleg: string | null }> {
  try {
    const uitslag = await titelVanLinkMetReden(String(url ?? ""));
    return { titel: uitslag.titel, uitleg: uitlegBijReden(uitslag.reden) };
  } catch {
    return { titel: null, uitleg: null };
  }
}
