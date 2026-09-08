import { headers } from "next/headers";
import { aggregeerDeveloperbord, type DevTaakMetKlant } from "@/lib/developerboard";
import { statusClass, renderCel, renderAlineas } from "@/lib/markdown";
import { zetStatusAction } from "./actions";
import KlaarMeldenForm from "./KlaarMeldenForm";
import BewerkTaakForm from "./BewerkTaakForm";
import AutoOpenHash from "./AutoOpenHash";
import DeveloperbordView from "./DeveloperbordView";

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
 * Klaar/Afgerond-cyclus (08-09-2026, op Maartens verzoek de hele workflow
 * afgemaakt): drie statussen, geen twee.
 *   open      — nog te doen door de developer.
 *   klaar     — de developer heeft 'm afgevinkt via KlaarMeldenForm, MET
 *               verplichte tijdsduur en optionele terugkoppeling. Wacht op
 *               beoordeling door Maarten.
 *   afgerond  — Maarten heeft de klaar-melding bekeken en akkoord bevonden.
 * Vanuit "klaar" kan Maarten "Afgerond zetten" of "Heropenen" (terug naar
 * "open", bijv. als het werk niet klopt). Vanuit "afgerond" kan hij ook nog
 * heropenen, voor het geval dat per ongeluk gebeurde.
 *
 * Confidentialiteit: deze pagina is bedoeld om (indirect, via de link) ook
 * door een externe developer bekeken te worden. De klantnaam moet daarom wel
 * getoond worden (de developer moet weten voor welke klant een taak is),
 * maar de rest van de app — de klantenlijst-navigatie met alle overige
 * klantnamen — mag niet meelekken. Vandaar [data-bord-secret] op het
 * buitenste element: globals.css verbergt daarmee automatisch de hele
 * Nav-sidebar op deze ene route (zie de regel onderaan globals.css).
 *
 * Weekplanning (08-09-2026, naar het voorbeeld van de oude
 * pingwin-seo-dashboard.vercel.app op Maartens verzoek): naast deze
 * "Lijst per klant"-weergave is er nu ook een weekplanning-kalender
 * (DeveloperbordView.tsx/Weekplanning.tsx). Deze pagina zelf blijft de
 * per-klant-lijst precies zo server-renderen als voorheen — de
 * view-schakelaar en de kalender zijn een client-wrapper eromheen, geen
 * herbouw van deze functie.
 */

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

const DEVBORD_PATH = "/bord-cc5100460da936203b8222ad79b65779";
/** Vast e-mailadres van de developer — al elders in de app zo gebruikt (zie werkbord/page.tsx). */
const DEVELOPER_EMAIL = "tonny@pingwin.nl";

function statusVan(taak: DevTaakMetKlant): string {
  return taak.status.trim().toLowerCase();
}
function isOpen(taak: DevTaakMetKlant): boolean {
  return statusVan(taak) === "open" || statusVan(taak) === "";
}
function isKlaar(taak: DevTaakMetKlant): boolean {
  return statusVan(taak) === "klaar";
}
function isAfgerond(taak: DevTaakMetKlant): boolean {
  return statusVan(taak) === "afgerond";
}
function isVervallen(taak: DevTaakMetKlant): boolean {
  return statusVan(taak) === "vervallen";
}
/** Eén stabiel anker per taak, gebruikt door het mailto-linkje én AutoOpenHash. */
function taakAnker(taak: DevTaakMetKlant): string {
  return `taak-${taak.klantSlug}-${taak.n}`;
}

/**
 * Eén taakrij, gedeeld door de open lijst en het "Afgerond"-blok hieronder —
 * zelfde <details className="binnenrij"> als voorheen, nu uitgebreid met de
 * Bewerken/Verwijderen-knoppen (BewerkTaakForm) in de actierij, ongeacht
 * status. De bestaande status-flow (KlaarMeldenForm/zetStatusAction/mailto)
 * blijft ongewijzigd.
 */
function TaakRij({ taak, basisUrl }: { taak: DevTaakMetKlant; basisUrl: string }) {
  const anker = taakAnker(taak);
  const link = basisUrl ? `${basisUrl}${DEVBORD_PATH}#${anker}` : "";
  const mailtoOnderwerp = encodeURIComponent(`Developerbord, ${taak.klantNaam}: ${taak.titel}`);
  const mailtoRegels = [
    `Taak: ${taak.titel} (${taak.klantNaam})`,
    link,
    ...(taak.opmerking ? ["", taak.opmerking] : []),
  ];
  const mailtoBody = encodeURIComponent(mailtoRegels.join("\n"));

  return (
    <details className="binnenrij" id={anker} open={isOpen(taak)}>
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
        {taak.opmerking && <p dangerouslySetInnerHTML={{ __html: renderCel(taak.opmerking) }} />}
        {taak.pagina && (
          <p>
            <a href={taak.pagina} target="_blank" rel="noopener">
              {taak.pagina.replace(/^https?:\/\//, "")}
            </a>
          </p>
        )}
        {taak.detail && (
          <div className="doc" dangerouslySetInnerHTML={{ __html: renderAlineas(taak.detail) }} />
        )}

        {(isKlaar(taak) || isAfgerond(taak)) && (taak.tijdsduur || taak.terugkoppeling) && (
          <div className="terugkoppelblok">
            <b>Terugkoppeling developer</b>
            {taak.tijdsduur && <p>Tijd besteed: {taak.tijdsduur}</p>}
            {taak.terugkoppeling && (
              <p dangerouslySetInnerHTML={{ __html: renderCel(taak.terugkoppeling) }} />
            )}
          </div>
        )}

        <div className="acties">
          {isOpen(taak) && (
            <KlaarMeldenForm klantSlug={taak.klantSlug} klantFolderId={taak.klantFolderId} n={taak.n} />
          )}

          {isKlaar(taak) && (
            <>
              <form action={zetStatusAction.bind(null, taak.klantSlug)}>
                <input type="hidden" name="klantFolderId" value={taak.klantFolderId} />
                <input type="hidden" name="n" value={taak.n} />
                <input type="hidden" name="waarde" value="afgerond" />
                <button className="pillbtn sterk" type="submit">
                  Afgerond zetten
                </button>
              </form>
              <form action={zetStatusAction.bind(null, taak.klantSlug)}>
                <input type="hidden" name="klantFolderId" value={taak.klantFolderId} />
                <input type="hidden" name="n" value={taak.n} />
                <input type="hidden" name="waarde" value="open" />
                <button className="pillbtn licht" type="submit">
                  Heropenen
                </button>
              </form>
            </>
          )}

          {isAfgerond(taak) && (
            <form action={zetStatusAction.bind(null, taak.klantSlug)}>
              <input type="hidden" name="klantFolderId" value={taak.klantFolderId} />
              <input type="hidden" name="n" value={taak.n} />
              <input type="hidden" name="waarde" value="open" />
              <button className="pillbtn licht" type="submit">
                Heropenen
              </button>
            </form>
          )}

          <a
            className="pillbtn licht"
            href={`mailto:${DEVELOPER_EMAIL}?subject=${mailtoOnderwerp}&body=${mailtoBody}`}
          >
            Mailen naar developer
          </a>

          <BewerkTaakForm
            klantSlug={taak.klantSlug}
            klantFolderId={taak.klantFolderId}
            n={taak.n}
            titel={taak.titel}
            opmerking={taak.opmerking}
            pagina={taak.pagina}
            detail={taak.detail}
          />
        </div>
      </div>
    </details>
  );
}

export default async function DeveloperbordPagina() {
  const [taken, hdrs] = await Promise.all([aggregeerDeveloperbord(), headers()]);

  const host = hdrs.get("host") ?? "";
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const basisUrl = host ? `${proto}://${host}` : "";

  const aantalOpen = taken.filter((t) => !isKlaar(t) && !isAfgerond(t) && !isVervallen(t)).length;
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
      <AutoOpenHash />
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

          <DeveloperbordView
            taken={taken}
            lijst={klantNamen.map((klantNaam) => {
              const groep = groepen.get(klantNaam)!;
              // Afgerond gaat naar een apart, standaard dichtgeklapt blok
              // onderaan de klantkaart, zodat het de open taken niet verdringt
              // (zie doc-comment TaakRij hierboven voor de gedeelde rij-JSX).
              const actief = groep.filter((t) => !isAfgerond(t));
              const afgerond = groep.filter((t) => isAfgerond(t));
              return (
                <div className="blok kaart" key={klantNaam}>
                  <div className="blokkop">
                    <h3>{klantNaam}</h3>
                    <span className="c">{groep.length}</span>
                  </div>
                  {actief.length > 0 && (
                    <div className="binnenlijst">
                      {actief.map((taak) => (
                        <TaakRij taak={taak} basisUrl={basisUrl} key={`${taak.klantSlug}-${taak.n}`} />
                      ))}
                    </div>
                  )}

                  {afgerond.length > 0 && (
                    <details className="afgerondgroep">
                      <summary className="afgerondkop">
                        Afgerond ({afgerond.length})
                        <span className="chev2" />
                      </summary>
                      <div className="binnenlijst">
                        {afgerond.map((taak) => (
                          <TaakRij taak={taak} basisUrl={basisUrl} key={`${taak.klantSlug}-${taak.n}`} />
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              );
            })}
          />
        </>
      )}
    </div>
  );
}
