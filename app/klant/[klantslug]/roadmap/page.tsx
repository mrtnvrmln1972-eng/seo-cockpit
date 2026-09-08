import { notFound } from "next/navigation";
import { getKlantBySlug } from "@/lib/klanten";
import { leesDossierBestand } from "@/lib/dossier";
import { renderCel } from "@/lib/markdown";
import {
  groepeerRoadmapPaginas,
  sorteerGroepenMetOverigAchteraan,
  koppelSignalenAanPagina,
  vindPaginaKolom,
  vindKolomVoor,
  veldWaarde,
  type RoadmapGroep,
} from "@/lib/roadmap";
import styles from "./roadmap.module.css";

export const dynamic = "force-dynamic";

/**
 * Roadmap-tab — helemaal opnieuw gebouwd (Kamsteeg als pilot), niet meer de
 * kolommenweergave uit de vorige versie. Maarten wil geen Kanban-bord maar
 * een navigatie-achtige hiërarchie: een hoofdmenu met dochterpagina's
 * eronder, zoals de sitenavigatie er in het echt uitziet. Elke pagina is
 * standaard dichtgeklapt (native <details>, de harde regel voor alles wat
 * meerdere regels beslaat) en toont opengeklapt een "volledige context":
 * alle velden die roadmap.md voor die pagina heeft (GSC/Ahrefs/Screaming
 * Frog door elkaar, precies zoals de skill ze al heeft samengevoegd) plus
 * de bijbehorende rij(en) uit signalen.md.
 *
 * ECHTE Kamsteeg-data eerst gelezen (Drive-map 18hgi9nafSGcNDZxaFiy7a0vRIo
 * ObR2FV, roadmap.md en signalen.md volledig gedownload en gelezen op
 * 08-09-2026 — niet aangenomen):
 *
 * - roadmap.md is bij Kamsteeg GEEN losse `##`-secties met elk hun eigen
 *   tabel (dat was de aanname van de vorige versie van deze tab, gebouwd
 *   tegen Nationaal Oogcentrum/Eerste Kamer Badkamers). Het is één grote
 *   tabel voor alle 67 pagina's met 16 kolommen: #, Groep, Pagina, Titel,
 *   Zoekterm, Positie, Vertoningen, Woorden, Score, Geblokkeerd, Backlinks,
 *   Cannibalisatie, Dubbele meta, Voortgang, Wat we ermee willen, Status.
 *   De "Groep"-kolom is door de roadmap-en-signalen-skill zelf al uit de
 *   URL-structuur afgeleid (Homepage, "Hovenier / locaties", Tuinontwerp,
 *   Tuinaanleg, Tuinonderhoud, Projecten, "Niet in het menu") — dat IS dus
 *   al de navigatiehiërarchie die hier als hoofdmenu-groepen dient
 *   (lib/roadmap.ts, groepeerRoadmapPaginas()). Voor een andere klant zonder
 *   die kolom valt die functie terug op de oude ##-sectie-indeling — een
 *   vangnet, geen aanname (roadmap.md heeft geen vaste vorm, CLAUDE.md).
 * - signalen.md is bij Kamsteeg de derde vorm uit CLAUDE.md: "## Issues" +
 *   "## Signalen" met een Tier-kolom. Er is GEEN Pagina/URL-kolom in die
 *   tabellen — een signaal verwijst naar een pagina via een backtick-
 *   omsloten pad middenin de vrije tekst (bv. "`/hovenier/oosterhout/`"),
 *   en kan naar meerdere pagina's tegelijk verwijzen. koppelSignalenAan
 *   Pagina() zoekt daarom op die exacte notatie in plaats van op een kolom
 *   die er niet is (lib/roadmap.ts).
 * - Score/Status/Geblokkeerd/Tier/Urgentie worden puur getoond zoals ze in
 *   de bestanden staan — geen eigen kleurcodering op basis van een drempel-
 *   waarde die de app zelf zou bedenken ("een dashboard mag tonen, nooit
 *   oordelen", CLAUDE.md). Alleen de aanwezigheid van een Geblokkeerd-waarde
 *   krijgt een visuele nadruk (net als de oude Index-dot dat deed), niet de
 *   inhoud ervan.
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

  const ruweGroepen = groepeerRoadmapPaginas(bestand.content);
  const groepen: RoadmapGroep[] = sorteerGroepenMetOverigAchteraan(ruweGroepen);

  if (groepen.length === 0) {
    return (
      <div className="paneel">
        <p className="placeholder">
          roadmap.md staat er, maar er is geen paginatabel in gevonden.
        </p>
      </div>
    );
  }

  // signalen.md is aanvullende context bij een pagina, geen vereiste voor
  // deze tab — best-effort gelezen; ontbreekt het bestand of faalt het
  // lezen, dan tonen we simpelweg geen gekoppelde signalen (geen foutbanner,
  // geen uitlegzin, de roadmap zelf blijft gewoon zichtbaar).
  let signalenContent = "";
  try {
    const signalenBestand = await leesDossierBestand(klant, "signalen.md");
    if (signalenBestand) signalenContent = signalenBestand.content;
  } catch {
    signalenContent = "";
  }

  const alleRijen = groepen.flatMap((g) => g.paginas);
  const aantalGeblokkeerd = alleRijen.filter(
    (rij) => veldWaarde(rij, ["geblokkeerd"]).trim().length > 0,
  ).length;

  return (
    <div>
      <div className={styles.sum}>
        <div className={styles.sumItem}>
          <span className={styles.sumNum}>{alleRijen.length}</span>
          <span className={styles.sumLabel}>Pagina&apos;s</span>
        </div>
        <div className={styles.sumItem}>
          <span className={styles.sumNum}>{groepen.length}</span>
          <span className={styles.sumLabel}>Hoofdmenu-groepen</span>
        </div>
        <div className={styles.sumItem}>
          <span className={styles.sumNum}>{aantalGeblokkeerd}</span>
          <span className={styles.sumLabel}>Geblokkeerd</span>
        </div>
      </div>

      <div className={styles.groepen}>
        {groepen.map((groep) => (
          <div className={styles.groep} key={groep.naam}>
            <div className={styles.groepKop}>
              <h3 className={styles.groepNaam}>{groep.naam}</h3>
              <span className={styles.groepCount}>
                {groep.paginas.length} {groep.paginas.length === 1 ? "pagina" : "pagina's"}
              </span>
            </div>

            {groep.paginas.map((rij, idx) => {
              const paginaKolom = vindPaginaKolom(rij) ?? "Pagina";
              const titelKolom = vindKolomVoor(rij, ["titel", "naam"]);
              const pad = (rij[paginaKolom] ?? "").trim();
              const titel = titelKolom ? rij[titelKolom].trim() : "";

              const score = veldWaarde(rij, ["score"]);
              const status = veldWaarde(rij, ["status"]);
              const geblokkeerd = veldWaarde(rij, ["geblokkeerd"]);

              const gekoppeldeSignalen = pad ? koppelSignalenAanPagina(signalenContent, pad) : [];

              const groepKolom = vindKolomVoor(rij, ["groep", "menugroep", "hoofdmenu", "hoofdpagina"]);
              const uitgesloten = new Set(
                [paginaKolom, titelKolom, groepKolom, "#"]
                  .filter((k): k is string => Boolean(k))
                  .map((k) => k.trim().toLowerCase()),
              );
              const overigeVelden = Object.entries(rij).filter(
                ([key, waarde]) => waarde.trim().length > 0 && !uitgesloten.has(key.trim().toLowerCase()),
              );

              return (
                <details className={styles.pagina} key={`${groep.naam}-${pad || idx}`}>
                  <summary className={styles.paginaSamenvatting}>
                    <span className={styles.paginaNaam}>
                      <span className={styles.paginaTitel}>{titel || pad || `Pagina ${idx + 1}`}</span>
                      {pad && titel && <span className={styles.paginaPad}>{pad}</span>}
                    </span>
                    <span className={styles.pillen}>
                      {score && <span className={styles.pil}>score {score}</span>}
                      {status && <span className={styles.pil}>{status}</span>}
                      {geblokkeerd && <span className={`${styles.pil} ${styles.pilGeblokkeerd}`}>geblokkeerd</span>}
                      {gekoppeldeSignalen.length > 0 && (
                        <span className={`${styles.pil} ${styles.signaalTeller}`}>
                          {gekoppeldeSignalen.length}{" "}
                          {gekoppeldeSignalen.length === 1 ? "signaal" : "signalen"}
                        </span>
                      )}
                    </span>
                  </summary>

                  <div className={styles.detail}>
                    {overigeVelden.length > 0 && (
                      <div className={styles.veldGrid}>
                        {overigeVelden.map(([key, waarde]) => (
                          <div className={styles.veld} key={key}>
                            <span className={styles.veldLabel}>{key}</span>
                            <span
                              className={styles.veldWaarde}
                              dangerouslySetInnerHTML={{ __html: renderCel(waarde) }}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {gekoppeldeSignalen.length > 0 && (
                      <div>
                        <p className={styles.signalenKop}>Uit signalen.md</p>
                        <div className={styles.signalenLijst}>
                          {gekoppeldeSignalen.map(({ sectie, rij: signaalRij }, si) => {
                            const titelKolomSignaal = vindKolomVoor(signaalRij, [
                              "signaal",
                              "type",
                              "titel",
                              "naam",
                            ]);
                            const signaalTitel = titelKolomSignaal ? signaalRij[titelKolomSignaal] : "";
                            const nummerKolom = vindKolomVoor(signaalRij, ["#", "nr"]);

                            const metaKolommen = [nummerKolom, "Urgentie", "Tier", "Status", "Datum gemeten"];
                            const metaExclusie = new Set(
                              [titelKolomSignaal, ...metaKolommen]
                                .filter((k): k is string => Boolean(k))
                                .map((k) => k.trim().toLowerCase()),
                            );

                            return (
                              <div className={styles.signaalKaart} key={`${sectie}-${si}`}>
                                <div className={styles.signaalKop}>
                                  <span className={styles.signaalTitel}>
                                    {nummerKolom && `#${signaalRij[nummerKolom]} — `}
                                    {signaalTitel || "(zonder titel)"}
                                  </span>
                                  <span className={styles.signaalMeta}>
                                    <span className={styles.pil}>{sectie}</span>
                                    {veldWaarde(signaalRij, ["urgentie"]) && (
                                      <span className={styles.pil}>{veldWaarde(signaalRij, ["urgentie"])}</span>
                                    )}
                                    {veldWaarde(signaalRij, ["tier"]) && (
                                      <span className={styles.pil}>tier {veldWaarde(signaalRij, ["tier"])}</span>
                                    )}
                                    {veldWaarde(signaalRij, ["status"]) && (
                                      <span className={styles.pil}>{veldWaarde(signaalRij, ["status"])}</span>
                                    )}
                                  </span>
                                </div>
                                {Object.entries(signaalRij)
                                  .filter(
                                    ([key, waarde]) =>
                                      waarde.trim().length > 0 &&
                                      !metaExclusie.has(key.trim().toLowerCase()),
                                  )
                                  .map(([key, waarde]) => (
                                    <div className={styles.signaalVeld} key={key}>
                                      <span className={styles.signaalVeldLabel}>{key}</span>
                                      <span
                                        className={styles.signaalVeldWaarde}
                                        dangerouslySetInnerHTML={{ __html: renderCel(waarde) }}
                                      />
                                    </div>
                                  ))}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
