import { notFound } from "next/navigation";
import { getKlantBySlug } from "@/lib/klanten";
import { leesDossierBestand } from "@/lib/dossier";
import { alleSecties, alleTabelRijen } from "@/lib/markdown";

export const dynamic = "force-dynamic";

/**
 * Roadmap-tab. Toont roadmap.md, gegroepeerd per `##`-sectie (spec §3.3),
 * elke sectie zijn eigen paginatabel — bewust NIET beperkt tot de eerste
 * tabel in het bestand (dat was de "bij Bogard"-bug, spec §6.4).
 *
 * Nog niet in deze eerste versie geport (bewust, geen aanname): het
 * samenvoegen met crawldata/gerelateerde signalen per pagina op één
 * detailkaart (spec §3.3, pagDetailVenster/crawlVoorPad/signalenVoorPad),
 * de kannibalisatie- en dubbele-meta-labels, en het rechtstreeks vanaf een
 * rij een taak aanmaken. Dit tabblad toont voor nu precies de rauwe
 * roadmap-tabel(len) zoals ze in roadmap.md staan, puur signalerend.
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
    return <div className="foutbanner">Kan roadmap.md niet laden.<br />{foutmelding}</div>;
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

  return (
    <div className="roadmap-secties">
      {secties.map((sec) => (
        <section key={sec.kop} className="roadmap-sectie">
          <h2>{sec.kop}</h2>
          <div className="tabel-scroll">
            <table className="roadmap-tabel">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Pagina</th>
                  <th>Zoekterm</th>
                  <th>Positie</th>
                  <th>Vert. zoekterm</th>
                  <th>Woorden</th>
                  <th>Links</th>
                  <th>Klikken</th>
                  <th>Vert. pagina</th>
                  <th>Pos. pagina</th>
                  <th>Index</th>
                  <th>Notities</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sec.rijen.map((rij) => {
                  const geenIndex = (rij["Index"] ?? "").trim().toLowerCase() === "nee";
                  return (
                    <tr key={rij["#"]}>
                      <td className="col-nr">{rij["#"]}</td>
                      <td className="col-pagina">
                        <code>{rij["Pagina"]}</code>
                      </td>
                      <td>{rij["Zoekterm"]}</td>
                      <td className="col-num">{rij["Positie"]}</td>
                      <td className="col-num">{rij["Vertoningen zoekterm"]}</td>
                      <td className="col-num">{rij["Woorden"]}</td>
                      <td className="col-num">{rij["Unieke links"]}</td>
                      <td className="col-num">{rij["Klikken pagina"]}</td>
                      <td className="col-num">{rij["Vertoningen pagina"]}</td>
                      <td className="col-num">{rij["Positie pagina"]}</td>
                      <td>
                        <span className={`pil ${geenIndex ? "pil-noindex" : "pil-index"}`}>
                          {rij["Index"]}
                        </span>
                      </td>
                      <td className="col-notities">{rij["Notities"]}</td>
                      <td>{rij["Status"]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
