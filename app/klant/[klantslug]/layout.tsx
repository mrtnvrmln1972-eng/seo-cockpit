import { notFound } from "next/navigation";
import { getKlantBySlug, getGroepNaam } from "@/lib/klanten";
import Tabs from "@/app/_components/Tabs";

export const dynamic = "force-dynamic";

/**
 * Gedeelde laag voor alle vier de tabbladen van één klant: koptekst met
 * klantnaam + groep, en de tabbalk (Roadmap/Issues/Kansen/Meta-tool).
 * Elke tab-pagina onder deze laag hoeft alleen zijn eigen inhoud te
 * renderen — routing en klant-opzoek zijn hier al geregeld.
 */
export default async function KlantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ klantslug: string }>;
}) {
  const { klantslug } = await params;

  let klant: Awaited<ReturnType<typeof getKlantBySlug>> = null;
  let foutmelding: string | null = null;

  try {
    klant = await getKlantBySlug(klantslug);
  } catch (err) {
    foutmelding =
      err instanceof Error ? err.message : "Onbekende fout bij het laden van dit klantdossier.";
  }

  if (foutmelding) {
    return (
      <div>
        <div className="foutbanner">
          Kan dit klantdossier niet laden vanuit Google Drive.
          <br />
          {foutmelding}
        </div>
        <Tabs klantSlug={klantslug} />
      </div>
    );
  }

  if (!klant) notFound();

  return (
    <div>
      <div className="klant-kop">
        <div className="groep-label">{getGroepNaam(klant.groep)}</div>
        <h1>{klant.naam}</h1>
      </div>
      <Tabs klantSlug={klant.slug} />
      {children}
    </div>
  );
}
