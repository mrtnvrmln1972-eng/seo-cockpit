import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getKlantBySlug } from "@/lib/klanten";
import { leesServicepunten, NOC_SLUG, type ServicepuntenDossier } from "@/lib/servicepunten";
import { SERVICEPUNTEN_DEELPAD } from "@/lib/toegang";
import DeelLink from "./DeelLink";
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
          Nog geen servicepunten.md gevonden in de dossiermap van {klant.weergavenaam}.
        </p>
      </div>
    );
  }

  return (
    <>
      <ServicepuntenView
        klantSlug={klant.slug}
        dossier={dossier}
        deelLink={<DeelLink url={await deelUrl()} />}
      />
    </>
  );
}

/**
 * De volledige, deelbare link naar de alleen-lezen servicepuntenpagina. Het
 * domein komt uit het verzoek zelf, zodat de link ook klopt als de cockpit
 * ooit op een ander adres komt te staan — nooit een adres hardcoderen dat
 * daarna stilletjes verkeerd wordt.
 */
async function deelUrl(): Promise<string> {
  const kop = await headers();
  const host = kop.get("x-forwarded-host") ?? kop.get("host") ?? "";
  const protocol = kop.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}${SERVICEPUNTEN_DEELPAD}`;
}
