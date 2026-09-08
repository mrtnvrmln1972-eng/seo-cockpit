import { aggregeerDeveloperbord, type DevTaakMetKlant } from "@/lib/developerboard";
import { statusClass, renderCel, renderAlineas } from "@/lib/markdown";
import { zetStatusAction } from "./actions";

/**
 * app/bord-cc5100460da936203b8222ad79b65779/page.tsx — het Developerbord.
 *
 * Dit lange, willekeurige stuk in de route-naam IS de toegangsbeveiliging
 * ("alleen-zij-link"): wie de URL niet kent, komt er niet. Geen login, geen
 * wachtwoord, geen extra check in code nodig.
 *
 * AFWIJKING t.o.v. de oude Claude Artifact "Pingwin Developerbord" (bewust
 * en expliciet met Maarten afgestemd, zie de doc-comment bovenaan
 * lib/developerboard.ts): in die artifact was het Developerbord een LOSSE,
 * los van Drive staande, handmatig bijgehouden takenlijst — Maarten moest
 * een doorgezette taak zelf overtypen vanuit developer.md naar die artifact.
 * Dit bord doet dat niet: het leest developer.md rechtstreeks uit ALLE
 * klantmappen in Drive en voegt ze in één keer samen (aggregeerDeveloperbord()).
 * Doorzetten vanuit een klant-Takenlijst (de Werkbord-tab, die
 * taakNaarDeveloperbord() aanroept) is hier dus DIRECT zichtbaar, zonder
 * kopiëren of een tweede bron van waarheid.
 *
 * Confidentialiteit: deze pagina is bedoeld om (indirect, via de link) ook
 * door een externe developer bekeken te worden. De klantnaam moet daarom wel
 * getoond worden (de developer moet weten voor welke klant een taak is),
 * maar de rest van de app — de klantenlijst-navigatie met alle overige
 * klantnamen — mag niet meelekken. Vandaar [data-bord-secret] op het
 * buitenste element: globals.css verbergt daarmee automatisch de hele
 * Nav-sidebar op deze ene route (zie de regel onderaan globals.css).
 */

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

function isKlaar(taak: DevTaakMetKlant): boolean {
  return taak.status.trim().toLowerCase() === "klaar";
}

function isVervallen(taak: DevTaakMetKlant): boolean {
  return taak.status.trim().toLowerCase() === "vervallen";
}

export default async function DeveloperbordPagina() {
  const taken = await aggregeerDeveloperbord();

  const aantalOpen = taken.filter((t) => !isKlaar(t) && !isVervallen(t)).length;
  const aantalKlaar = taken.filter((t) => isKlaar(t)).length;

  const groepen = new Map<string, DevTaakMetKlant[]>();
  for (const taak of taken) {
    const lijst = groepen.get(taak.klantNaam) ?? [];
    lijst.push(taak);
    groepen.set(taak.klantNaam, lijst);
  }
  const klantNamen = [...groepen.keys()].sort((a, b) => a.localeCompare(b, "nl"));

  return (
    <div data-bord-secret>
      <div className="kop">
        <h2>Developerbord</h2>
      </div>

      {taken.length === 0 ? (
        <div className="paneel">
          <p className="placeholder">Nog niets op het bord.</p>
        </div>
      ) : (
        <>
          <div className="sum">
            <div>
              <b>{aantalOpen}</b>
              <span>Open</span>
            </div>
            <div className="acc">
              <b>{aantalKlaar}</b>
              <span>Klaar</span>
            </div>
          </div>

          {klantNamen.map((klantNaam) => {
            const groep = groepen.get(klantNaam)!;
            return (
              <div className="blok kaart" key={klantNaam}>
                <div className="blokkop">
                  <h3>{klantNaam}</h3>
                  <span className="c">{groep.length}</span>
                </div>
                <div className="binnenlijst">
                  {groep.map((taak) => {
                    const klaar = isKlaar(taak);
                    const mailtoOnderwerp = encodeURIComponent(
                      `Developerbord, ${taak.klantNaam}: ${taak.titel}`,
                    );
                    const mailtoBody = encodeURIComponent(
                      `Over deze taak: ${taak.titel}` + (taak.opmerking ? `\n\n${taak.opmerking}` : ""),
                    );
                    return (
                      <details className="binnenrij" key={`${taak.klantSlug}-${taak.n}`} open={!klaar}>
                        <summary className="binnenregel">
                          <span className="binnenkop">
                            <span className="tk">{taak.titel}</span>
                            <span className="chev2" />
                          </span>
                          <span className="binnenmeta">
                            <span className={`pill ${statusClass(taak.status)}`}>{taak.status}</span>
                          </span>
                        </summary>

                        <div className="binnenbody">
                          {taak.opmerking && (
                            <p dangerouslySetInnerHTML={{ __html: renderCel(taak.opmerking) }} />
                          )}
                          {taak.pagina && (
                            <p>
                              <a href={taak.pagina} target="_blank" rel="noopener">
                                {taak.pagina.replace(/^https?:\/\//, "")}
                              </a>
                            </p>
                          )}
                          {taak.detail && (
                            <div
                              className="doc"
                              dangerouslySetInnerHTML={{ __html: renderAlineas(taak.detail) }}
                            />
                          )}

                          <div className="acties">
                            <form
                              action={zetStatusAction.bind(
                                null,
                                taak.klantFolderId,
                                taak.klantSlug,
                                taak.n,
                                klaar ? "open" : "klaar",
                              )}
                            >
                              <button className={klaar ? "pillbtn licht" : "pillbtn sterk"} type="submit">
                                {klaar ? "Heropenen" : "Klaar melden"}
                              </button>
                            </form>
                            <a
                              className="pillbtn licht"
                              href={`mailto:Maarten@pingwin.nl?subject=${mailtoOnderwerp}&body=${mailtoBody}`}
                            >
                              Mailen
                            </a>
                          </div>
                        </div>
                      </details>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
