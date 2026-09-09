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
 * Vormgeving naar de artifact's vMeta()/metakaart-patroon: één kaart per
 * pagina (.metakaart), met genummerde veldjes (.metaveldje/.mv-kop/
 * .mv-tekst/.mv-meting) voor "nu" en "voorstel", en de META-controles als
 * checklijst (ul.checks, zoals checksHtml() in de artifact rendert).
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
    return (
      <div className="foutbanner">
        Kan meta.md niet laden.
        <br />
        {foutmelding}
      </div>
    );
  }

  if (!bestand) {
    return (
      <div className="paneel">
        <p className="placeholder">Nog geen meta.md gevonden in de dossiermap van {klant.weergavenaam}.</p>
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
        <div className="tabel-scroll" style={{ marginBottom: "26px" }}>
          <table className="matrix">
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
                  <td className="nm">
                    <code>{rij["URL"]}</code>
                  </td>
                  <td>{rij["Zoekterm"]}</td>
                  <td className="num">{rij["Vert."]}</td>
                  <td className="num">{rij["Pos."]}</td>
                  <td className="num">{rij["CTR nu"]}</td>
                  <td>{rij["Status titel"]}</td>
                  <td>{rij["Status omschrijving"]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagina.map((p) => {
        const titelFout = p.checksTitel.filter((c) => !c.pass).length;
        const descFout = p.checksDesc.filter((c) => !c.pass).length;
        return (
          <div key={p.url} className="metakaart">
            <div className="metakop">
              <code>{p.url}</code>
              {p.zoekterm && <span className="wat">zoekwoord: {p.zoekterm}</span>}
              <span className="wat">
                titel: {p.goedkeuring["Titel"] ?? "nog niet beoordeeld"}
              </span>
            </div>

            {p.baan && (
              <p className="mv-tekst" dangerouslySetInnerHTML={{ __html: renderCel(p.baan) }} />
            )}

            {(p.nu["Titel"] || p.voorstel["Titel"]) && (
              <div className="metaveldje">
                <div className="mv-kop">
                  <h5>Titel</h5>
                  {p.infoTitel && (
                    <span className={titelFout === 0 ? "chip ok" : "chip let"}>
                      {titelFout === 0 ? "voldoet aan de check" : `${titelFout} punt(en)`}
                    </span>
                  )}
                </div>
                {p.nu["Titel"] && <p className="mv-tekst">Nu: {p.nu["Titel"]}</p>}
                {p.voorstel["Titel"] && <p className="mv-tekst">Voorstel: {p.voorstel["Titel"]}</p>}
                {p.infoTitel && (
                  <p className="mv-meting">
                    {p.infoTitel.chars} tekens, {p.infoTitel.px} px (venster {p.infoTitel.min} tot{" "}
                    {p.infoTitel.max} px)
                  </p>
                )}
              </div>
            )}

            {(p.nu["Omschrijving"] || p.voorstel["Omschrijving"]) && (
              <div className="metaveldje">
                <div className="mv-kop">
                  <h5>Omschrijving</h5>
                  {p.infoDesc && (
                    <span className={descFout === 0 ? "chip ok" : "chip let"}>
                      {descFout === 0 ? "voldoet aan de check" : `${descFout} punt(en)`}
                    </span>
                  )}
                </div>
                {p.nu["Omschrijving"] && <p className="mv-tekst">Nu: {p.nu["Omschrijving"]}</p>}
                {p.voorstel["Omschrijving"] && (
                  <p className="mv-tekst">Voorstel: {p.voorstel["Omschrijving"]}</p>
                )}
                {p.infoDesc && (
                  <p className="mv-meting">
                    {p.infoDesc.chars} tekens, {p.infoDesc.px} px (venster {p.infoDesc.min} tot{" "}
                    {p.infoDesc.max} px)
                  </p>
                )}
              </div>
            )}

            {(p.checksTitel.length > 0 || p.checksDesc.length > 0) && (
              <ul className="checks">
                {[...p.checksTitel, ...p.checksDesc].map((c) => (
                  <li key={c.id}>
                    <span className={`vink ${c.pass ? "ja" : "nee"}`}>{c.pass ? "✓" : "!"}</span>
                    <span className="lab">
                      {c.label}
                      <em>{c.waarde}</em>
                    </span>
                    <span className="code">{c.id}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
