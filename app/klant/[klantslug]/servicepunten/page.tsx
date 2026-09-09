import { notFound } from "next/navigation";
import { getKlantBySlug } from "@/lib/klanten";
import { leesServicepunten, NOC_SLUG, type ServicepuntenDossier } from "@/lib/servicepunten";
import ServicepuntenView from "./ServicepuntenView";

export const dynamic = "force-dynamic";

/**
 * Servicepunten-tab — alleen voor Nationaal Oogcentrum (zie NOC_SLUG en
 * Tabs.tsx, waar deze tab om diezelfde reden alleen voor die ene klant in de
 * tabbalk verschijnt). Interactieve opvolger van de losse Claude Artifact
 * "Servicepunten aanhaken" (zie de doc-comment in lib/servicepunten.ts): per
 * vestiging de gegevens, het aansluitproces om af te vinken en het
 * contactlog, plus een vaste sectie met wat maar één keer geregeld hoeft te
 * worden.
 *
 * Alle daadwerkelijke rendering/interactiviteit zit in ServicepuntenView
 * (client component) — deze pagina haalt alleen het dossier op vanaf Drive
 * en vangt de bekende foutgevallen af (geen dossier, verkeerde klant),
 * zelfde patroon als elke andere tab in deze app.
 */
export default async function ServicepuntenPagina({
  params,
}: {
  params: Promise<{ klantslug: string }>;
}) {
  const { klantslug } = await params;
  const klant = await getKlantBySlug(klantslug);
  if (!klant) notFound();

  if (klant.slug !== NOC_SLUG) {
    return (
      <div className="paneel">
        <p className="placeholder">
          Servicepunten is alleen beschikbaar voor Nationaal Oogcentrum.
        </p>
      </div>
    );
  }

  if (!klant.mapId) {
    return (
      <div className="paneel">
        <p className="placeholder">Deze klant heeft nog geen dossier in Drive.</p>
      </div>
    );
  }

  let dossier: ServicepuntenDossier | null = null;
  let foutmelding: string | null = null;
  try {
    dossier = await leesServicepunten(klant.mapId);
  } catch (err) {
    foutmelding = err instanceof Error ? err.message : "Onbekende fout bij het laden van servicepunten.md.";
  }

  if (foutmelding) {
    return (
      <div className="foutbanner">
        Kan servicepunten.md niet laden.
        <br />
        {foutmelding}
      </div>
    );
  }

  if (!dossier || (!dossier.bestand && dossier.vestigingen.length === 0)) {
    return (
      <div className="paneel">
        <p className="placeholder">
          Nog geen servicepunten.md gevonden in de dossiermap van {klant.naam}.
        </p>
      </div>
    );
  }

  return <ServicepuntenView klantSlug={klant.slug} dossier={dossier} />;
}
