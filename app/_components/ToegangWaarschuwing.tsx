import { slotStaatAan } from "@/lib/toegang";

/**
 * Een balk bovenaan elke pagina zolang er nog geen wachtwoord is ingesteld.
 * Zonder COCKPIT_WACHTWOORD op Vercel is de hele cockpit voor iedereen met de
 * link te lezen, en dat is niet iets wat je stilletjes moet laten gebeuren.
 * Zodra de variabele er staat, verdwijnt deze balk vanzelf.
 */
export default function ToegangWaarschuwing() {
  if (slotStaatAan()) return null;

  return (
    <div className="toegangwaarschuwing">
      <strong>Deze cockpit staat open voor iedereen met de link.</strong> Het wachtwoordslot is nog
      niet aangezet. Vraag Claude om de stappen; zodra het slot aan staat, verdwijnt deze balk.
    </div>
  );
}
