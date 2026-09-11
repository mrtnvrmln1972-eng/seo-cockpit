import {
  detailKort,
  koppelStanden,
  restVanToegang,
  propositieInfo,
  searchConsoleSoort,
  standKlasse,
  leesLadder,
  type OnboardingDossier,
} from "@/lib/onboarding";
import { ONBOARDING_STAPPEN, stapUitleg, vulOpdracht } from "@/lib/onboarding-ladder";
import { renderCel } from "@/lib/markdown";
import { renderTekst } from "@/lib/scanbaar";
import { onderdeelWisselenAction } from "./actions";
import KopieerKnop from "./KopieerKnop";
import KoppelingVinkje from "./KoppelingVinkje";

/**
 * De Onboarding-tab zoals hij op het scherm staat. Los van page.tsx, dat
 * alleen de klant opzoekt en het dossier van Drive haalt: zo is deze
 * weergave met een dossier uit een bestand te tekenen en dus met eigen ogen
 * na te kijken zonder Drive-sleutel (zie de tijdelijke proefroute in de
 * werkwijze; die staat niet in de repo).
 *
 * De opbouw en alle uitleg staan in de doc-comment van page.tsx.
 */
export default function OnboardingWeergave({
  klantSlug,
  klantNaam,
  domein,
  dossier,
}: {
  klantSlug: string;
  klantNaam: string;
  domein: string;
  dossier: OnboardingDossier;
}) {
  const ladder = leesLadder(dossier.werklijstMd, dossier.toelichtingMd);
  const koppelingen = koppelStanden(dossier.toegangMd);
  const rest = restVanToegang(dossier.toegangMd);
  const propositie = propositieInfo(dossier.klantMd);
  const opdracht = (sjabloon: string) => vulOpdracht(sjabloon, klantNaam, domein);

  const af = ladder.items.filter((i) => i.klaar).length;
  const totaal = ladder.items.length;
  const pct = totaal > 0 ? Math.round((af / totaal) * 100) : 0;
  const open = ladder.items.filter((i) => !i.klaar);
  const eersteOpen = open[0] ?? null;
  const eersteUitleg = eersteOpen
    ? stapUitleg(`${eersteOpen.code} ${eersteOpen.tekst}`, ladder.items.indexOf(eersteOpen))
    : null;

  const wisselMetKlant = onderdeelWisselenAction.bind(null, klantSlug, ladder.taakN ?? 0);

  return (
    <div className="ob">
      {/* 1. De stand van de ladder */}
      {totaal === 0 ? (
        <div className="kader let">
          <h3>Nog geen onboardingladder</h3>
          <p>
            Bij deze klant staat de taak <strong>Onboarding afmaken</strong> nog niet op de
            werklijst, of er staan nog geen vinkjes onder in toelichting.md.
          </p>
          <div className="acties">
            <KopieerKnop
              label="Kopieer opdracht: zet de ladder klaar"
              tekst={`Zet voor ${klantNaam} de taak Onboarding afmaken op de werklijst met de tien vaste stappen als vinkjes in toelichting.md: ${ONBOARDING_STAPPEN.map((s) => `${s.code} ${s.kort}`).join(", ")}.`}
            />
          </div>
        </div>
      ) : (
        <div className="ob-kader">
          <div className="ob-stand">
            <b>
              {af} van de {totaal}
            </b>
            <span>stappen af</span>
          </div>
          <div className={`ob-balk${af === totaal ? " vol" : ""}`}>
            <i style={{ width: `${pct}%` }} />
          </div>
          <ul className="ob-lijst">
            {ladder.items.map((item, i) => {
              const uitleg = stapUitleg(`${item.code} ${item.tekst}`, i);
              return (
                <li key={item.code} className={item.klaar ? "af" : undefined}>
                  <form action={wisselMetKlant.bind(null, item.code)}>
                    <button
                      type="submit"
                      className="ob-vink"
                      aria-pressed={item.klaar}
                      title={item.klaar ? "Weer openzetten" : "Afstrepen"}
                    >
                      {item.klaar ? "✓" : ""}
                    </button>
                  </form>
                  <span className="tk">
                    <b>{item.code}</b> {item.tekst}
                    {!item.klaar && uitleg.wat && <span className="wa">{uitleg.wat}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* 2. De koppelingen */}
      <p className="ob-groepkop">De koppelingen</p>
      <div className="tabel-scroll">
        <table className="matrix ob-tabel">
          <thead>
            <tr>
              <th>Koppeling</th>
              <th>Stand</th>
              <th>Sinds</th>
              <th>Details</th>
              <th />
              <th className="vt">Van toepassing</th>
            </tr>
          </thead>
          <tbody>
            {koppelingen.map((c) => {
              const nvt = c.stand === "niet van toepassing";
              const soort = /search console/i.test(c.naam) ? searchConsoleSoort(c.details) : "";
              return (
                <tr key={c.naam} className={nvt ? "nvt" : undefined}>
                  <td className="nm">
                    {c.naam}
                    {soort && (
                      <span className={`chip ${soort === "domeinproperty" ? "" : "let"}`}>{soort}</span>
                    )}
                  </td>
                  <td>
                    <span className={`dot ${standKlasse(c.stand)}`}>{c.standRuw || c.stand}</span>
                  </td>
                  <td className="klein">{c.sinds}</td>
                  <td className="klein det">
                    {(() => {
                      const d = detailKort(c.details);
                      if (!d.rest) {
                        return <span dangerouslySetInnerHTML={{ __html: renderCel(c.details) }} />;
                      }
                      return (
                        <details className="ob-det">
                          <summary dangerouslySetInnerHTML={{ __html: renderCel(d.kort) }} />
                          {/* Alleen de rest, want de eerste zin blijft in de
                              kop staan; anders leest hij twee keer. */}
                          <span dangerouslySetInnerHTML={{ __html: renderCel(d.rest) }} />
                        </details>
                      );
                    })()}
                  </td>
                  <td className="knopcel">
                    {c.vraag && c.stand !== "gekoppeld" && !nvt && (
                      <KopieerKnop label={c.knop} tekst={opdracht(c.vraag)} />
                    )}
                  </td>
                  <td className="vt">
                    {c.inBestand ? (
                      <KoppelingVinkje klantSlug={klantSlug} naam={c.naam} vanToepassing={!nvt} />
                    ) : (
                      <span className="ob-nietinbestand" title="Deze regel staat nog niet in toegang.md">
                        &ndash;
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!dossier.toegangMd.trim() && (
        <p className="placeholder">Voor deze klant staat er nog geen toegang.md in het dossier.</p>
      )}
      {rest.length > 0 && (
        <details className="ob-rest">
          <summary>De rest van toegang.md ({rest.map((r) => r.kop).join(", ")})</summary>
          {rest.map((sec) => (
            <div key={sec.kop} className="ob-restsectie">
              <h6>{sec.kop}</h6>
              <div className="doc" dangerouslySetInnerHTML={{ __html: renderTekst(sec.inhoud) }} />
            </div>
          ))}
        </details>
      )}

      {/* 3. Propositie, toon en klantstem */}
      <p className="ob-groepkop">De propositie</p>
      {propositie.tekst ? (
        <details className="blok kaart ob-kaart">
          <summary className="blokkop">
            <h3>Propositie</h3>
            <span className={`pill ${propositie.bevestigd ? "p-klaar" : "p-mist"}`}>
              {propositie.bevestigd ? `bevestigd op ${propositie.bevestigdOp}` : "nog niet bevestigd"}
            </span>
            <span className="chev" />
          </summary>
          <div className="blokbody">
            <div className="doc" dangerouslySetInnerHTML={{ __html: renderTekst(propositie.tekst) }} />
            <div className="acties">
              <KopieerKnop label="Kopieer de propositie" tekst={propositie.tekst.trim()} />
              {dossier.toneOfVoiceMd.trim() && (
                <KopieerKnop
                  sterk
                  label="Kopieer voor de klant"
                  tekst={`${propositie.tekst.trim()}\n\n${dossier.toneOfVoiceMd.trim()}`}
                />
              )}
            </div>
          </div>
        </details>
      ) : (
        <div className="kader let">
          <h3>Nog geen propositie</h3>
          <p>
            De propositie bepaalt welke zoektermen, thema&apos;s en pagina&apos;s voorrang krijgen.
            Zolang die zin er niet is, kiest elke prioritering op zoekvolume.
          </p>
          <div className="acties">
            <KopieerKnop
              label="Kopieer opdracht: stel de propositie op"
              tekst={opdracht(stapUitleg("1e", 4).cmd)}
            />
          </div>
        </div>
      )}

      {dossier.toneOfVoiceMd.trim() ? (
        <details className="blok kaart ob-kaart">
          <summary className="blokkop">
            <h3>Tone of voice</h3>
            <span className="pill p-open">{telRegels(dossier.toneOfVoiceMd)} regels</span>
            <span className="chev" />
          </summary>
          <div className="blokbody">
            <div className="doc" dangerouslySetInnerHTML={{ __html: renderTekst(dossier.toneOfVoiceMd) }} />
          </div>
        </details>
      ) : (
        <div className="kader let">
          <h3>Nog geen tone of voice</h3>
          <p>
            Zonder tone of voice schrijft elke tekst in een algemene SEO-stem, ook bij een klant die
            op vakmanschap verkoopt.
          </p>
          <div className="acties">
            <KopieerKnop
              label="Kopieer opdracht: leg de toon vast"
              tekst={opdracht(stapUitleg("2", 6).cmd)}
            />
          </div>
        </div>
      )}

      {dossier.klantstemMd.trim() ? (
        <details className="blok kaart ob-kaart">
          <summary className="blokkop">
            <h3>Klantstem</h3>
            <span className="pill p-open">{telRegels(dossier.klantstemMd)} regels</span>
            <span className="chev" />
          </summary>
          <div className="blokbody">
            <div className="doc" dangerouslySetInnerHTML={{ __html: renderTekst(dossier.klantstemMd) }} />
          </div>
        </details>
      ) : (
        <div className="kader let">
          <h3>Nog geen klantstem</h3>
          <p>
            Wat de klant zelf heeft gezegd wint van elke blauwdruk en elke copy. Zolang dat nergens
            staat, moet je het elke keer opnieuw opzoeken.
          </p>
          <div className="acties">
            <KopieerKnop
              label="Kopieer opdracht: bouw de klantstem op"
              tekst={opdracht(stapUitleg("1b", 1).cmd)}
            />
          </div>
        </div>
      )}

      {/* 4. Wat er nu ontbreekt */}
      <p className="ob-groepkop">Wat er nu ontbreekt</p>
      {totaal === 0 ? (
        <p className="placeholder">Zolang de ladder er niet staat valt er niets over de stand te zeggen.</p>
      ) : open.length === 0 ? (
        <div className="kader goed">
          <h3>De onboarding is af</h3>
          <p>
            Alle {totaal} stappen staan af. Er ligt dus een bevestigde propositie, een gevulde
            roadmap en een gevuld signalenbakje.
          </p>
        </div>
      ) : (
        <div className="kader let">
          {ladder.watOntbreekt && (
            <>
              <p className="ob-sub">Wat er speelt</p>
              <div className="doc" dangerouslySetInnerHTML={{ __html: renderTekst(ladder.watOntbreekt) }} />
            </>
          )}
          <p className="ob-sub">
            Nog open, {open.length} van de {totaal}
          </p>
          <ul className="ob-open">
            {open.map((item) => (
              <li key={item.code}>
                <b>{item.code}</b> {item.tekst}
              </li>
            ))}
          </ul>
          {eersteOpen && eersteUitleg && (
            <>
              <p className="ob-sub">De eerstvolgende stap</p>
              <p className="ob-kop">
                <b>{eersteOpen.code}</b> {eersteOpen.tekst}
              </p>
              {eersteUitleg.wat && <p className="ob-regel">{eersteUitleg.wat}</p>}
              {eersteUitleg.nu && <p className="ob-regel">{eersteUitleg.nu}</p>}
              {eersteUitleg.cmd && (
                <div className="acties">
                  <KopieerKnop sterk label="Kopieer de opdracht" tekst={opdracht(eersteUitleg.cmd)} />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Hoeveel opsommingsregels een document heeft; het getal in de pil naast de kop. */
function telRegels(md: string): number {
  return String(md || "")
    .split("\n")
    .filter((r) => /^\s*[-*+]\s+\S/.test(r)).length;
}
