import { notFound } from "next/navigation";
import { getKlantBySlug } from "@/lib/klanten";
import { leesDossierBestand } from "@/lib/dossier";
import { alleSecties, alleTabelRijen } from "@/lib/markdown";

export const dynamic = "force-dynamic";

/**
 * Roadmap-tab. Toont roadmap.md, gegroepeerd per `##`-sectie (spec §3.3),
 * elke sectie zijn eigen paginakaart — bewust NIET beperkt tot de eerste
 * tabel in het bestand (dat was de "bij Bogard"-bug, spec §6.4).
 *
 * Vormgeving naar de artifact's vRoadmap(): een tellerrij (.sum) en
 * per sectie een kaart (.rmgrid/.rmkaart/.rmrij) in plaats van een platte
 * tabel. De artifact's rmrij toont een "score" en "voortgang %" die uit
 * roadmap.md-velden komen die déze dossiers niet hebben (geen expliciete
 * score/voortgang-kolom) — hier tonen we in plaats daarvan de kolommen die
 * dit dossierformaat wél heeft (Woorden, Positie, Klikken, Index, Status),
 * puur zoals ze in het bestand staan, geen eigen berekening.
 *
 * Nog niet in deze versie geport (bewust, geen aanname): het samenvoegen
 * met crawldata/gerelateerde signalen per pagina op één detailkaart (spec
 * §3.3, pagDetailVenster/crawlVoorPad/signalenVoorPad), de kannibalisatie-
 * en dubbele-meta-labels, en het rechtstreeks vanaf een rij een taak
 * aanmaken.
 */
export default async function RoadmapPagina({
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
    bestand = await leesDossierBestand(klant, "roadmap.md");
  } catch (err) {
    foutmelding =
      err instanceof Error ? err.message : "Onbekende fout bij het laden van roadmap.md.";
  }

  if (foutmelding) {
    return (
      <div className="foutbanner">
        Kan roadmap.md niet laden.
        <br />
        {foutmelding}
      </div>
    );
  }

  if (!bestand) {
    return (
      <div className="paneel">
        <p className="placeholder">
          Nog geen roadmap.md gevonden in de dossiermap van {klant.naam}.
        </p>
      </div>
    );
  }

  const secties = alleSecties(bestand.content)
    .map((sec) => ({ ...sec, rijen: alleTabelRijen(sec.inhoud, "Pagina") }))
    .filter((sec) => sec.rijen.length > 0);

  // "Niet in het menu"/"losse pagina"-achtige groepen altijd achteraan (spec §3.3, achteraan()).
  const achteraanNeedle = /niet in het menu|losse pagina/i;
  secties.sort((a, b) => {
    const aLast = achteraanNeedle.test(a.kop) ? 1 : 0;
    const bLast = achteraanNeedle.test(b.kop) ? 1 : 0;
    return aLast - bLast;
  });

  if (secties.length === 0) {
    return (
      <div className="paneel">
        <p className="placeholder">
          roadmap.md staat er, maar er is geen paginatabel in gevonden.
        </p>
      </div>
    );
  }

  const alleRijen = secties.flatMap((s) => s.rijen);
  const metIndex = alleRijen.filter(
    (r) => (r["Index"] ?? "").trim().toLowerCase() === "ja",
  ).length;

  return (
    <div>
      <div className="sum">
        <div>
          <b>{alleRijen.length}</b>
          <span>Pagina&apos;s</span>
        </div>
        <div>
          <b>{secties.length}</b>
          <span>Groepen</span>
        </div>
        <div className="acc">
          <b>{metIndex}</b>
          <span>Staan op index</span>
        </div>
      </div>

      <div className="rmgrid">
        {secties.map((sec) => (
          <div className="rmkaart" key={sec.kop}>
            <div className="rmkop">
              <h3>{sec.kop}</h3>
              <span className="c">{sec.rijen.length}</span>
            </div>
            {sec.rijen.map((rij) => {
              const indexRuw = (rij["Index"] ?? "").trim().toLowerCase();
              const indexKlasse =
                indexRuw === "ja" ? "ja" : indexRuw === "nee" ? "nee" : "onbekend";
              return (
                <div className="rmrij" key={`${sec.kop}-${rij["#"]}`}>
                  <span className="nm">
                    <code>{rij["Pagina"]}</code>
                    {rij["Zoekterm"] ? ` — ${rij["Zoekterm"]}` : ""}
                  </span>
                  {rij["Woorden"] && <span className="w">{rij["Woorden"]} w</span>}
                  {rij["Positie"] && <span className="w">pos {rij["Positie"]}</span>}
                  {rij["Klikken pagina"] && <span className="w">{rij["Klikken pagina"]} clicks</span>}
                  {rij["Index"] && <span className={`dot ${indexKlasse}`}>{rij["Index"]}</span>}
                  {rij["Status"] && <span className="chip">{rij["Status"]}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
