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
      <strong>Deze cockpit staat open voor iedereen met de link.</strong> Zet op Vercel de
      omgevingsvariabele <code>COCKPIT_WACHTWOORD</code> (Settings, Environment Variables) en deploy
      opnieuw; daarna vraagt de cockpit om dat wachtwoord en verdwijnt deze balk. De deelbare links
      blijven wel gewoon werken.
    </div>
  );
}
