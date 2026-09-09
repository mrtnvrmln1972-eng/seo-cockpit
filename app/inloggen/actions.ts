"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TOEGANG_COOKIE, sessiewaarde, veiligeTerugweg, wachtwoordKlopt } from "@/lib/toegang";

/**
 * De inlogactie. Klopt het wachtwoord (COCKPIT_WACHTWOORD op Vercel, nooit in
 * de repo), dan zetten we een koekje met de handtekening uit lib/toegang.ts en
 * gaan we door naar de pagina waar de bezoeker heen wilde.
 *
 * Het koekje is httpOnly (geen enkel script op de pagina kan erbij), secure
 * (alleen over https) en sameSite lax, en gaat negentig dagen mee, zodat
 * Maarten niet elke dag opnieuw hoeft in te loggen.
 */
export async function inloggenAction(_vorigeFout: string | null, formData: FormData): Promise<string | null> {
  const ingetypt = String(formData.get("wachtwoord") ?? "");
  const verder = veiligeTerugweg(String(formData.get("verder") ?? "/"));

  if (!wachtwoordKlopt(ingetypt)) {
    return "Dat wachtwoord klopt niet.";
  }

  const koekjes = await cookies();
  koekjes.set(TOEGANG_COOKIE, sessiewaarde(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });

  redirect(verder);
}
