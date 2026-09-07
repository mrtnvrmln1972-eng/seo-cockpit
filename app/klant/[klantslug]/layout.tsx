import { notFound } from "next/navigation";
import { getKlantBySlug, getGroepNaam } from "@/lib/klanten";
import Tabs from "@/app/_components/Tabs";

export const dynamic = "force-dynamic";

/**
 * Gedeelde laag voor alle drie tabbladen van één klant: koptekst met
 * klantnaam + domein (artifact: .kop/.dom), en de tabbalk (Roadmap/
 * Signalen/Meta-tool). Elke tab-pagina onder deze laag hoeft alleen zijn
 * eigen inhoud te renderen — routing en klant-opzoek zijn hier al geregeld.
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
      <div className="kop">
        <h2>{klant.naam}</h2>
        {klant.domein && <span className="dom">{klant.domein}</span>}
      </div>
      <p className="subkop">
        {getGroepNaam(klant.groep)}
        {klant.fase ? ` · fase: ${klant.fase}` : ""}
      </p>
      {klant.fase.trim().toLowerCase() === "stil" && (
        <div className="kader let" style={{ marginBottom: 22 }}>
          <h3>Deze klant staat stil</h3>
          <p>
            {klant.naam} heeft in KLANTEN.md de fase &quot;stil&quot; — er loopt momenteel geen
            actief traject. Wat hieronder staat is de laatste stand, niet noodzakelijk actueel.
          </p>
        </div>
      )}
      <Tabs klantSlug={klant.slug} />
      {children}
    </div>
  );
}
