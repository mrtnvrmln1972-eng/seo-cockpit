import { notFound } from "next/navigation";
import { getKlantBySlug } from "@/lib/klanten";
import { leesOnboardingDossier } from "@/lib/onboarding";
import OnboardingWeergave from "./OnboardingWeergave";

export const dynamic = "force-dynamic";

/**
 * Onboarding-tab, herbouwd op 11-09-2026 naar de vorm van de Claude Artifact
 * "Pingwin Klantcockpit", op verzoek van Maarten. Twee dingen veranderen
 * daarmee ten opzichte van de versie van 03/09-09-2026:
 *
 * 1. **Alleen deze klant.** De klantenstrook met de voortgang van elke andere
 *    klant is weg ("in het tabje onboarding bij elke klant moet het alleen
 *    klantspecifiek zijn"). Ook uit lib/onboarding.ts hoeft daarvoor niets
 *    weg: leesVoortgang() blijft staan voor wie hem later nog wil.
 * 2. **De koppelingentabel wordt eindelijk getoond.** Die stond er niet: het
 *    vangnet zocht een tabel met de kolom "Bron", terwijl de echte toegang.md
 *    van Eerste Kamer Badkamers "Koppeling" heeft, en die tabel staat boven de
 *    eerste `##`-kop waardoor ook de sectie-weergave hem oversloeg. Gemeten
 *    tegen het bestand in Drive.
 *
 * Harde eis van Maarten bij deze klus: **er mag niets verdwijnen van wat er al
 * verzameld is.** Vandaar drie dingen die de artifact zelf niet doet:
 * een regel in toegang.md die niet bij een van de acht vaste koppelingen hoort
 * blijft staan (Eerste Kamer heeft er zo een, "Fotodrive"), de rest van
 * toegang.md (Geschiedenis, Openstaand, wat er naar de klant moet) staat
 * eronder in een uitklapblok, en het vinkje "van toepassing" verandert precies
 * één cel in plaats van de hele tabel opnieuw op te schrijven.
 *
 * Opbouw van boven naar beneden, gelijk aan de artifact: de stand van de
 * ladder met de tien vinkjes, de koppelingen, propositie/toon/klantstem, en
 * onderaan wat er nu ontbreekt met de eerstvolgende stap.
 */
export default async function OnboardingPagina({
  params,
}: {
  params: Promise<{ klantslug: string }>;
}) {
  const { klantslug } = await params;
  const klant = await getKlantBySlug(klantslug);
  if (!klant) notFound();

  if (!klant.mapId) {
    return (
      <div className="paneel">
        <p className="placeholder">Deze klant heeft nog geen dossier in Drive.</p>
      </div>
    );
  }

  let dossier: Awaited<ReturnType<typeof leesOnboardingDossier>> | null = null;
  let foutmelding: string | null = null;
  try {
    dossier = await leesOnboardingDossier(klant.mapId);
  } catch (err) {
    foutmelding = err instanceof Error ? err.message : "Onbekende fout bij het laden van de onboarding.";
  }

  if (foutmelding || !dossier) {
    return (
      <div className="foutbanner">
        Kan de onboarding-gegevens niet laden.
        <br />
        {foutmelding}
      </div>
    );
  }

  return (
    <OnboardingWeergave
      klantSlug={klant.slug}
      klantNaam={klant.weergavenaam}
      domein={klant.domein}
      dossier={dossier}
    />
  );
}
