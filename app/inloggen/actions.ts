"use server";

import { cookies } from "next/headers";
import { TOEGANG_COOKIE, sessiewaarde, veiligeTerugweg, wachtwoordKlopt } from "@/lib/toegang";

export interface InlogUitkomst {
  fout: string | null;
  /** Waar de browser heen moet als het wachtwoord klopte; null zolang er niets gelukt is. */
  verder: string | null;
}

/**
 * De inlogactie. Klopt het wachtwoord (COCKPIT_WACHTWOORD op Vercel, nooit in
 * de repo), dan zetten we een koekje met de handtekening uit lib/toegang.ts.
 *
 * LET OP, en dit is met opzet zo (09-09-2026, na een kapot scherm): hier staat
 * bewust GEEN redirect(). Een redirect vanuit een server action doet een
 * zachte navigatie, en daarbij bouwt Next.js de buitenste laag van de app
 * (app/layout.tsx) niet opnieuw op. Die laag kwam dan van het inlogscherm, en
 * daar zit de klantenlijst er juist bewust niet in — resultaat: na het
 * inloggen een cockpit zonder zijbalk, met alle inhoud geperst in de lege
 * kolom waar die zijbalk had moeten staan. Daarom geven we het doeladres
 * terug en laat InlogForm de browser de pagina echt opnieuw laden.
 */
export async function inloggenAction(
  _vorige: InlogUitkomst,
  formData: FormData,
): Promise<InlogUitkomst> {
  const ingetypt = String(formData.get("wachtwoord") ?? "");
  const verder = veiligeTerugweg(String(formData.get("verder") ?? "/"));

  if (!wachtwoordKlopt(ingetypt)) {
    return { fout: "Dat wachtwoord klopt niet.", verder: null };
  }

  const koekjes = await cookies();
  koekjes.set(TOEGANG_COOKIE, sessiewaarde(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });

  return { fout: null, verder };
}
