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
 *
 * Vormgeving naar de artifact's binnenlijst/binnenrij-patroon (een rij per
 * signaal, met de details achter een uitklapper) — hier met het native
 * <details>-element in plaats van de JS-toggle uit de artifact, zodat dit
 * tabblad zonder eigen client-state werkt.
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
    return (
      <div className="foutbanner">
        Kan signalen.md niet laden.
        <br />
        {foutmelding}
      </div>
    );
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
    <div>
      <div className="sum">
        <div>
          <b>{rijen.length}</b>
          <span>Signalen</span>
        </div>
      </div>

      <div className="binnenlijst">
        {rijen.map((rij, idx) => {
          const nummer = rij["#"] ?? String(idx + 1);
          const titel = rij["Signaal"] ?? "";
          const urgentieRuw = (rij["Urgentie"] ?? "").trim().toLowerCase();
          const urgentieKlasse =
            urgentieRuw === "hoog"
              ? "u-hoog"
              : urgentieRuw === "midden" || urgentieRuw === "gemiddeld"
                ? "u-mid"
                : urgentieRuw === "laag"
                  ? "u-laag"
                  : "";
          const status = (rij["Status"] ?? "").trim();
          const datum = rij["Datum gemeten"] ?? "";

          return (
            <details className="binnenrij" key={nummer}>
              <summary className="binnenregel">
                <span className="binnenkop">
                  <span className="tk">
                    #{nummer} — {titel}
                  </span>
                </span>
                <span className="binnenmeta">
                  {urgentieRuw && <span className={`urg ${urgentieKlasse}`}>{urgentieRuw}</span>}
                  {status && <span className="chip">{status}</span>}
                  {datum && <span className="chip info">{datum}</span>}
                </span>
                <span className="chev2" />
              </summary>

              <div className="binnenbody">
                {rij["Waarom het uitmaakt"] && (
                  <>
                    <h6>Waarom het uitmaakt</h6>
                    <div
                      className="doc"
                      dangerouslySetInnerHTML={{ __html: renderCel(rij["Waarom het uitmaakt"]) }}
                    />
                  </>
                )}

                {rij["Wat je doet"] && (
                  <>
                    <h6>Wat je doet</h6>
                    <div
                      className="doc"
                      dangerouslySetInnerHTML={{ __html: renderCel(rij["Wat je doet"]) }}
                    />
                  </>
                )}

                {rij["Wat het oplevert"] && (
                  <>
                    <h6>Wat het oplevert</h6>
                    <div
                      className="doc"
                      dangerouslySetInnerHTML={{ __html: renderCel(rij["Wat het oplevert"]) }}
                    />
                  </>
                )}

                {(rij["Hoeveel werk"] || rij["Recept"]) && (
                  <>
                    <h6>Erbij</h6>
                    <p>
                      {rij["Hoeveel werk"] && (
                        <>
                          <strong>Hoeveel werk:</strong> {rij["Hoeveel werk"]}
                          <br />
                        </>
                      )}
                      {rij["Recept"] && (
                        <>
                          <strong>Recept:</strong> {rij["Recept"]}
                        </>
                      )}
                    </p>
                  </>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
