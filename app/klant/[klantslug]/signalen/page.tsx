import { notFound } from "next/navigation";
import { getKlantBySlug } from "@/lib/klanten";
import { leesDossierBestand } from "@/lib/dossier";
import { alleTabelRijen, renderCel } from "@/lib/markdown";

export const dynamic = "force-dynamic";

/**
 * Signalen-tab. Toont signalen.md.
 *
 * LET OP — afwijking t.o.v. de oorspronkelijke artifact (klantcockpit_
 * specificatie.md §3.4/§3.5): de specificatie beschrijft twee aparte tabs,
 * Issues en Kansen, die elk hun eigen "## Issues"/"## Kansen"-sectie in
 * signalen.md lezen via tabelUitSectie(). Gecontroleerd tegen de
 * daadwerkelijke, actuele signalen.md van twee live klanten (Nationaal
 * Oogcentrum en Eerste Kamer Badkamers, beide bijgewerkt begin september
 * 2026): geen van beide bestanden heeft nog die koppen. Ze bevatten één
 * kop "# Wat mij is opgevallen" met één ongesplitste tabel (kolommen #,
 * Signaal, Waarom het uitmaakt, Wat je doet, Wat het oplevert, Wat er moet
 * gebeuren, Hoeveel werk, Recept, Urgentie, Datum gemeten, Status). Er is
 * dus geen Issues/Kansen-onderscheid meer in de brondata zelf — dat maakt
 * de oorspronkelijke Issues/Kansen-splitsing bij deze klanten feitelijk een
 * lege tab. Dit tabblad volgt daarom het WERKELIJKE, huidige bestandsformaat:
 * één "Signalen"-lijst, puur getoond zoals hij in het bestand staat (zelfde
 * volgorde, geen eigen sortering/weging — "een dashboard mag tonen, nooit
 * oordelen", CLAUDE.md). Urgentie is een kolomwaarde uit het bestand zelf,
 * geen berekening.
 */
export default async function SignalenPagina({
  params,
}: {
  params: Promise<{ klantslug: string }>;
}) {
  const { klantslug } = await params;
  const klant = await getKlantBySlug(klantslug);
  if (!klant) notFound();

  let bestand: Awaited<ReturnType<typeof leesDossierBestand>> = null;
  let foutmelding: string | null = null;
  try {
    bestand = await leesDossierBestand(klant, "signalen.md");
  } catch (err) {
    foutmelding =
      err instanceof Error ? err.message : "Onbekende fout bij het laden van signalen.md.";
  }

  if (foutmelding) {
    return <div className="foutbanner">Kan signalen.md niet laden.<br />{foutmelding}</div>;
  }

  if (!bestand) {
    return (
      <div className="paneel">
        <p className="placeholder">
          Nog geen signalen.md gevonden in de dossiermap van {klant.naam}.
        </p>
      </div>
    );
  }

  const rijen = alleTabelRijen(bestand.content, "Signaal");

  if (rijen.length === 0) {
    return (
      <div className="paneel">
        <p className="placeholder">
          signalen.md staat er, maar er is geen signalentabel in gevonden.
        </p>
      </div>
    );
  }

  return (
    <div className="signalen-lijst">
      {rijen.map((rij, idx) => {
        const nummer = rij["#"] ?? String(idx + 1);
        const titel = rij["Signaal"] ?? "";
        const urgentie = (rij["Urgentie"] ?? "").trim().toLowerCase();
        const status = (rij["Status"] ?? "").trim();
        const datum = rij["Datum gemeten"] ?? "";

        return (
          <details key={nummer} className="signaal-kaart">
            <summary>
              <span className="signaal-nr">#{nummer}</span>
              <span className="signaal-titel">{titel}</span>
              <span className="signaal-pillen">
                {urgentie && (
                  <span className={`pil pil-urgentie-${urgentie.replace(/\s+/g, "-")}`}>
                    {urgentie}
                  </span>
                )}
                {status && <span className="pil pil-status">{status}</span>}
                {datum && <span className="pil pil-datum">{datum}</span>}
              </span>
            </summary>

            <div className="signaal-inhoud">
              {rij["Waarom het uitmaakt"] && (
                <div
                  className="signaal-blok"
                  dangerouslySetInnerHTML={{ __html: renderCel(rij["Waarom het uitmaakt"]) }}
                />
              )}

              <div className="signaal-grid">
                {rij["Wat je doet"] && (
                  <div className="signaal-veld">
                    <div className="signaal-veld-label">Wat je doet</div>
                    <div
                      dangerouslySetInnerHTML={{ __html: renderCel(rij["Wat je doet"]) }}
                    />
                  </div>
                )}
                {rij["Wat het oplevert"] && (
                  <div className="signaal-veld">
                    <div className="signaal-veld-label">Wat het oplevert</div>
                    <div
                      dangerouslySetInnerHTML={{ __html: renderCel(rij["Wat het oplevert"]) }}
                    />
                  </div>
                )}
              </div>

              <div className="signaal-meta">
                {rij["Hoeveel werk"] && (
                  <span>
                    <strong>Hoeveel werk:</strong> {rij["Hoeveel werk"]}
                  </span>
                )}
                {rij["Recept"] && (
                  <span>
                    <strong>Recept:</strong> {rij["Recept"]}
                  </span>
                )}
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );
}
