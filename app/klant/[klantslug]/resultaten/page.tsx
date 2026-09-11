import { notFound } from "next/navigation";
import { getKlantBySlug } from "@/lib/klanten";
import { leesKpiDossier } from "@/lib/kpi-dossier";
import { leesSearchConsole, serviceAccountAdres } from "@/lib/google-data";
import ResultatenWeergave from "./ResultatenWeergave";

export const dynamic = "force-dynamic";

/**
 * Resultaten-tab, gebouwd op 11-09-2026 naar het voorbeeld van de tab
 * "resultaten" in het oude SEO-dashboard (pingwin-seo-dashboard.vercel.app),
 * op Maartens verzoek rechts van Meta-tool.
 *
 * Twee dingen zijn bewust anders dan daar, allebei omdat ze in deze cockpit
 * niet kunnen of niet moeten:
 *
 * 1. **Geen database en geen inlog per gebruiker.** Het oude dashboard laat
 *    elke gebruiker zelf bij Google inloggen en bewaart de cijfers in
 *    Postgres. Hier leest één service-account mee (dezelfde die de Drive-map
 *    leest, nu ook met leesrechten op Search Console en Analytics) en staat
 *    wat jij vastzet in kpi.md in de klantmap. Zie lib/google-data.ts.
 * 2. **Geen "Quick win"-label en geen knop "Toelichting".** Uitdrukkelijk zo
 *    afgesproken met Maarten op 11-09-2026.
 *
 * De eerste stap is Search Console: de vier cijfers bovenaan met de vorige
 * periode ernaast, en daaronder de zoekwoorden en de pagina's. Analytics en
 * Ads volgen, daarna Ahrefs.
 *
 * Het ophalen gebeurt hier op de server en niet in de browser: de sleutel van
 * het service-account mag nooit de kant van de browser op. Een andere periode
 * kiezen loopt via de server action in actions.ts, om dezelfde reden.
 */
export default async function ResultatenPagina({
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

  const kpi = await leesKpiDossier(klant.mapId).catch(() => null);

  let gsc: Awaited<ReturnType<typeof leesSearchConsole>> | null = null;
  let foutmelding: string | null = null;
  try {
    gsc = await leesSearchConsole(
      klant.domein,
      28,
      "prev",
      kpi?.searchConsoleProperty || undefined,
    );
  } catch (err) {
    foutmelding = err instanceof Error ? err.message : "Onbekende fout bij het ophalen van Search Console.";
  }

  return (
    <ResultatenWeergave
      klantSlug={klant.slug}
      klantNaam={klant.weergavenaam}
      domein={klant.domein}
      serviceAccount={serviceAccountAdres()}
      gsc={gsc}
      foutmelding={foutmelding}
      zoekwoordFocus={kpi?.zoekwoorden ?? {}}
      sterren={kpi?.sterren ?? []}
      volgorde={kpi?.volgorde ?? []}
    />
  );
}
