import { redirect } from "next/navigation";
import { slotStaatAan, veiligeTerugweg } from "@/lib/toegang";
import InlogForm from "./InlogForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inloggen — Pingwin Klantcockpit", robots: { index: false, follow: false } };

/**
 * Het inlogscherm van de cockpit. proxy.ts stuurt iedereen zonder geldige
 * sessie hierheen, met het oorspronkelijke pad in "verder", zodat je na het
 * inloggen op de pagina belandt waar je heen wilde.
 *
 * Staat er geen wachtwoord ingesteld, dan valt er niets in te loggen en gaan
 * we meteen door naar de cockpit zelf (zie lib/toegang.ts: zonder
 * COCKPIT_WACHTWOORD verandert er niets aan hoe de app werkte).
 */
export default async function InloggenPagina({
  searchParams,
}: {
  searchParams: Promise<{ verder?: string }>;
}) {
  const { verder } = await searchParams;
  const terug = veiligeTerugweg(verder ?? "/");

  if (!slotStaatAan()) redirect(terug);

  return (
    <div className="inlogpaneel">
      <h1>Pingwin Klantcockpit</h1>
      <p>Deze cockpit is afgeschermd. Vul het wachtwoord in om verder te gaan.</p>
      <InlogForm verder={terug} />
    </div>
  );
}
