import { notFound } from "next/navigation";
import { getKlantBySlug } from "@/lib/klanten";
import { leesDossierBestand } from "@/lib/dossier";
import { alleSecties, tabelUitSectie, renderCel } from "@/lib/markdown";
import { boldBlokken, veldenUitBlok, checkTitel, checkDesc, metaInfo } from "@/lib/meta";

export const dynamic = "force-dynamic";

/**
 * Meta-tool-tab. Toont meta.md: per pagina wat er nu staat, wat het
 * voorstel is, en of dat voorstel voldoet aan de META-controles (pixel-
 * breedte, zoekwoordpositie, leestekens — objectieve, mechanische regels,
 * 1:1 geport uit de oude artifact via lib/meta.ts, geen nieuwe eigen
 * beoordeling; zie de doc-comment daar).
 *
 * Paginasecties in meta.md staan onder een kale `## <url>`-kop (bijv.
 * "## /" of "## /lensimplantatie/"), precies zoals alleSecties() al
 * verwerkt. We filteren op koppen die met "/" beginnen om ze te
 * onderscheiden van de niet-paginasecties ("Overzicht", "Doorzetten, nog
 * niet uitgevoerd", "Wat hier nog niet in staat") — bevestigd tegen de
 * echte meta.md van Nationaal Oogcentrum (gefetcht 07-09-2026).
 *
 * Bewust niet geport (zie lib/meta.ts): de klantstem-toets, het
 * automatisch herstellen van botsende teksten, en het doorzetten-naar-
 * de-site-mechanisme. Dit tabblad is puur signalerend.
 */
export default async function MetaPagina({
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
    bestand = await leesDossierBestand(klant, "meta.md");
  } catch (err) {
    foutmelding = err instanceof Error ? err.message : "Onbekende fout bij het laden van meta.md.";
  }

  if (foutmelding) {
    return <div className="foutbanner">Kan meta.md niet laden.<br />{foutmelding}</div>;
  }

  if (!bestand) {
    return (
      <div className="paneel">
        <p className="placeholder">Nog geen meta.md gevonden in de dossiermap van {klant.naam}.</p>
      </div>
    );
  }

  const secties = alleSecties(bestand.content);
  const paginaSecties = secties.filter((s) => s.kop.startsWith("/"));

  // De Overzicht-tabel heeft geen eigen "#"-nummeringskolom (het is een
  // samenvattingstabel per pagina, geen paginalijst zoals in roadmap.md),
  // dus alleTabelRijen() zou hem overslaan (spec §6.4, "bij Bogard"-bug-fix).
  // tabelUitSectie() heeft die #-eis niet en is hier daarom de juiste keuze.
  const overzichtRijen = tabelUitSectie(bestand.content, "Overzicht", "status titel");

  if (paginaSecties.length === 0) {
    return (
      <div className="paneel">
        <p className="placeholder">meta.md staat er, maar er zijn geen paginasecties in gevonden.</p>
      </div>
    );
  }

  const pagina = paginaSecties.map((sec) => {
    const blokken = boldBlokken(sec.inhoud);
    const nu = veldenUitBlok(blokken["Zo staat het er nu"] ?? "");
    const voorstel = veldenUitBlok(blokken["Voorstel"] ?? "");
    const goedkeuring = veldenUitBlok(blokken["Goedkeuring"] ?? "");
    const zoekterm = nu["Zoekterm"] ?? "";

    const nieuweTitel = voorstel["Titel"] ?? "";
    const nieuweDesc = voorstel["Omschrijving"] ?? "";
    const checksTitel = nieuweTitel ? checkTitel(nieuweTitel, zoekterm) : [];
    const checksDesc = nieuweDesc ? checkDesc(nieuweDesc, zoekterm, nieuweTitel) : [];
    const infoTitel = nieuweTitel ? metaInfo("titel", nieuweTitel) : null;
    const infoDesc = nieuweDesc ? metaInfo("desc", nieuweDesc) : null;

    return {
      url: sec.kop,
      baan: blokken["Baan van de pagina"] ?? "",
      nu,
      voorstel,
      goedkeuring,
      zoekterm,
      checksTitel,
      checksDesc,
      infoTitel,
      infoDesc,
    };
  });

  return (
    <div>
      {overzichtRijen.length > 0 && (
        <div className="tabel-scroll" style={{ marginBottom: "1.75rem" }}>
          <table className="roadmap-tabel">
            <thead>
              <tr>
                <th>URL</th>
                <th>Zoekterm</th>
                <th>Vert.</th>
                <th>Pos.</th>
                <th>CTR nu</th>
                <th>Status titel</th>
                <th>Status omschrijving</th>
              </tr>
            </thead>
            <tbody>
              {overzichtRijen.map((rij, idx) => (
                <tr key={idx}>
                  <td>
                    <code>{rij["URL"]}</code>
                  </td>
                  <td>{rij["Zoekterm"]}</td>
                  <td className="col-num">{rij["Vert."]}</td>
                  <td className="col-num">{rij["Pos."]}</td>
                  <td className="col-num">{rij["CTR nu"]}</td>
                  <td>{rij["Status titel"]}</td>
                  <td>{rij["Status omschrijving"]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="signalen-lijst">
        {pagina.map((p) => {
          const titelFout = p.checksTitel.filter((c) => !c.pass).length;
          const descFout = p.checksDesc.filter((c) => !c.pass).length;
          return (
            <details key={p.url} className="signaal-kaart">
              <summary>
                <span className="signaal-titel">
                  <code>{p.url}</code>
                </span>
                <span className="signaal-pillen">
                  {p.zoekterm && <span className="pil">{p.zoekterm}</span>}
                  {p.infoTitel && (
                    <span className={`pil ${titelFout === 0 ? "pil-index" : "pil-noindex"}`}>
                      titel {titelFout === 0 ? "ok" : `${titelFout} punt(en)`}
                    </span>
                  )}
                  {p.infoDesc && (
                    <span className={`pil ${descFout === 0 ? "pil-index" : "pil-noindex"}`}>
                      omschrijving {descFout === 0 ? "ok" : `${descFout} punt(en)`}
                    </span>
                  )}
                  <span className="pil">
                    titel: {p.goedkeuring["Titel"] ?? "nog niet beoordeeld"}
                  </span>
                </span>
              </summary>

              <div className="signaal-inhoud">
                {p.baan && (
                  <div className="signaal-blok" dangerouslySetInnerHTML={{ __html: renderCel(p.baan) }} />
                )}

                <div className="signaal-grid">
                  <div className="signaal-veld">
                    <div className="signaal-veld-label">Zo staat het er nu</div>
                    <div>
                      {p.nu["Titel"] && <p>Titel: {p.nu["Titel"]}</p>}
                      {p.nu["Omschrijving"] && <p>Omschrijving: {p.nu["Omschrijving"]}</p>}
                    </div>
                  </div>
                  <div className="signaal-veld">
                    <div className="signaal-veld-label">Voorstel</div>
                    <div>
                      {p.voorstel["Titel"] && <p>Titel: {p.voorstel["Titel"]}</p>}
                      {p.voorstel["Omschrijving"] && <p>Omschrijving: {p.voorstel["Omschrijving"]}</p>}
                    </div>
                  </div>
                </div>

                {(p.checksTitel.length > 0 || p.checksDesc.length > 0) && (
                  <div className="signaal-blok">
                    <div className="signaal-veld-label">META-controles op het voorstel</div>
                    <ul className="meta-checks">
                      {[...p.checksTitel, ...p.checksDesc].map((c) => (
                        <li key={c.id} className={c.pass ? "ok" : "nee"}>
                          <span className="vink">{c.pass ? "✓" : "!"}</span>
                          {c.label}
                          <em>{c.waarde}</em>
                          <span className="code">{c.id}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
