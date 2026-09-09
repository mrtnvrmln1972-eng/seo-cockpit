import { notFound } from "next/navigation";
import { getKlantBySlug, getKlantGroepen } from "@/lib/klanten";
import {
  leesOnboardingDossier,
  leesLadder,
  leesKoppelingen,
  propositieInfo,
  leesVoortgang,
} from "@/lib/onboarding";
import { renderCel, renderAlineas } from "@/lib/markdown";
import { onderdeelWisselenAction } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Onboarding-tab. Ontwerp vastgelegd 03-09-2026, gecorrigeerd tegen echte
 * dossierdata op 09-09-2026 (zie de uitgebreide doc-comment in
 * lib/onboarding.ts — het "van toepassing"-vinkje op toegang.md uit het
 * oorspronkelijke ontwerp bestaat niet in de echte bestanden en is daarom
 * niet gebouwd).
 *
 * Opbouw (van boven naar beneden), 1:1 het 03-09-ontwerp:
 *   1. Klantenstrook — voortgangsbalkje per klant in dezelfde groep.
 *   2. Tien ladderstappen (1a-3c) uit toelichting.md, aanvinkbaar.
 *   3. Koppelingentabel uit toegang.md (generiek, zie lib/onboarding.ts).
 *   4. Propositie/toon/klantstem — de ENE dichte toggle die deze cockpit
 *      kent (uitzondering op de nul-toggles-regel, expliciet zo afgesproken
 *      op 03-09-2026): klant.md's propositie + tone-of-voice.md +
 *      klantstem.md, puur ter referentie, geen bewerking.
 *   5. Wat ontbreekt + eerstvolgende stap — letterlijk overgenomen uit het
 *      "Wat er nu ontbreekt"-blok in toelichting.md plus de eerste
 *      nog-niet-afgevinkte ladderstap in vaste volgorde (geen berekend
 *      oordeel, puur de volgende regel die nog open staat).
 */
export default async function OnboardingPagina({
  params,
}: {
  params: Promise<{ klantslug: string }>;
}) {
  const { klantslug } = await params;
  const klant = await getKlantBySlug(klantslug);
  if (!klant) notFound();

  if (!klant.mapId) {
    return (
      <div className="paneel">
        <p className="placeholder">Deze klant heeft nog geen dossier in Drive.</p>
      </div>
    );
  }

  let dossier: Awaited<ReturnType<typeof leesOnboardingDossier>> | null = null;
  let groepen: Awaited<ReturnType<typeof getKlantGroepen>> = [];
  let foutmelding: string | null = null;
  try {
    [dossier, groepen] = await Promise.all([leesOnboardingDossier(klant.mapId), getKlantGroepen()]);
  } catch (err) {
    foutmelding = err instanceof Error ? err.message : "Onbekende fout bij het laden van de onboarding.";
  }

  if (foutmelding || !dossier) {
    return (
      <div className="foutbanner">
        Kan de onboarding-gegevens niet laden.
        <br />
        {foutmelding}
      </div>
    );
  }

  const ladder = leesLadder(dossier.werklijstMd, dossier.toelichtingMd);
  const koppelingen = leesKoppelingen(dossier.toegangMd);
  const propositie = propositieInfo(dossier.klantMd);
  const eersteOpen = ladder.items.find((i) => !i.klaar);
  const eigenGroep = groepen.find((g) => g.id === klant.groep);
  const voortgangKlanten = eigenGroep ? eigenGroep.klanten.filter((k) => k.mapId) : [];
  const voortgangen = await Promise.all(voortgangKlanten.map((k) => leesVoortgang(k)));

  const wisselMetKlant = onderdeelWisselenAction.bind(null, klant.slug, ladder.taakN ?? 0);

  return (
    <div>
      {/* 1. Klantenstrook */}
      {voortgangen.length > 0 && (
        <div className="blok kaart" style={{ marginBottom: 14 }}>
          <div className="blokkop" style={{ cursor: "default" }}>
            <h3>Onboarding — {eigenGroep?.naam}</h3>
          </div>
          <div className="blokbody">
            <div className="binnenlijst">
              {voortgangen.map((v) => {
                const pct = v.totaal > 0 ? Math.round((v.klaar / v.totaal) * 100) : 0;
                const isHuidig = v.klant.slug === klant.slug;
                return (
                  <div
                    key={v.klant.slug}
                    className="binnenrij"
                    style={{ padding: "8px 10px", fontWeight: isHuidig ? 700 : 400 }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span>{v.klant.naam}</span>
                      <span>{v.taakN ? `${v.klaar}/${v.totaal}` : "geen onboardingtaak"}</span>
                    </div>
                    {v.taakN && (
                      <div style={{ background: "var(--rand, #e5e5e5)", borderRadius: 4, height: 6 }}>
                        <div
                          style={{
                            width: `${pct}%`,
                            background: pct === 100 ? "#2e8b57" : "#3b6fd6",
                            height: 6,
                            borderRadius: 4,
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 2. Ladderstappen */}
      <div className="blok kaart" style={{ marginBottom: 14 }}>
        <div className="blokkop" style={{ cursor: "default" }}>
          <h3>Ladder — {ladder.taakTitel || "Onboarding afmaken"}</h3>
        </div>
        <div className="blokbody">
          {ladder.items.length === 0 ? (
            <p className="placeholder">
              Geen &quot;Onboarding afmaken&quot;-taak (of geen vinkregels) gevonden in
              werklijst.md/toelichting.md.
            </p>
          ) : (
            <div className="binnenlijst">
              {ladder.items.map((item) => (
                <form key={item.code} action={wisselMetKlant.bind(null, item.code)}>
                  <button
                    type="submit"
                    className="binnenrij"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 10px",
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                    }}
                  >
                    <input type="checkbox" checked={item.klaar} readOnly />
                    <span className="chip info">{item.code}</span>
                    <span style={{ textDecoration: item.klaar ? "line-through" : "none" }}>{item.tekst}</span>
                  </button>
                </form>
              ))}
            </div>
          )}
          {ladder.inHetKort && (
            <>
              <h6 style={{ marginTop: 14 }}>In het kort</h6>
              <div className="doc" dangerouslySetInnerHTML={{ __html: renderAlineas(ladder.inHetKort) }} />
            </>
          )}
        </div>
      </div>

      {/* 3. Koppelingentabel */}
      <div className="blok kaart" style={{ marginBottom: 14 }}>
        <div className="blokkop" style={{ cursor: "default" }}>
          <h3>Koppelingen</h3>
        </div>
        <div className="blokbody">
          {koppelingen.tabel ? (
            <div className="tabel-scroll">
              <table className="matrix">
                <thead>
                  <tr>
                    {koppelingen.tabel.headers.map((h, hi) => (
                      <th key={hi}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {koppelingen.tabel.rows.map((rij, ri) => (
                    <tr key={ri}>
                      {rij.map((cel, ci) => (
                        <td key={ci} dangerouslySetInnerHTML={{ __html: renderCel(cel) }} />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : koppelingen.secties.length > 0 ? (
            koppelingen.secties.map((sec) => (
              <div key={sec.kop} style={{ marginBottom: 14 }}>
                <h6>{sec.kop}</h6>
                {sec.tabellen.length > 0 ? (
                  sec.tabellen.map((tabel, ti) => (
                    <div className="tabel-scroll" key={ti}>
                      <table className="matrix">
                        <thead>
                          <tr>
                            {tabel.headers.map((h, hi) => (
                              <th key={hi}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tabel.rows.map((rij, ri) => (
                            <tr key={ri}>
                              {rij.map((cel, ci) => (
                                <td key={ci} dangerouslySetInnerHTML={{ __html: renderCel(cel) }} />
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))
                ) : (
                  <div className="doc" dangerouslySetInnerHTML={{ __html: renderAlineas(sec.inhoud) }} />
                )}
              </div>
            ))
          ) : (
            <p className="placeholder">Nog geen toegang.md gevonden.</p>
          )}
        </div>
      </div>

      {/* 4. Propositie/toon/klantstem — de ene toegestane dichte toggle */}
      <details className="blok kaart" style={{ marginBottom: 14 }}>
        <summary className="blokkop">
          <h3>Propositie, toon &amp; klantstem</h3>
        </summary>
        <div className="blokbody">
          <h6>Propositie</h6>
          {propositie.tekst ? (
            <>
              <div className="doc" dangerouslySetInnerHTML={{ __html: renderAlineas(propositie.tekst) }} />
              <p>
                <span className={`chip ${propositie.bevestigd ? "" : "info"}`}>
                  {propositie.bevestigd ? `Bevestigd op ${propositie.bevestigdOp}` : "Nog niet bevestigd"}
                </span>
              </p>
            </>
          ) : (
            <p className="placeholder">Geen propositiesectie gevonden in klant.md.</p>
          )}

          <h6 style={{ marginTop: 14 }}>Tone of voice</h6>
          {dossier.toneOfVoiceMd.trim() ? (
            <div className="doc" dangerouslySetInnerHTML={{ __html: renderAlineas(dossier.toneOfVoiceMd) }} />
          ) : (
            <p className="placeholder">Geen tone-of-voice.md gevonden.</p>
          )}

          <h6 style={{ marginTop: 14 }}>Klantstem</h6>
          {dossier.klantstemMd.trim() ? (
            <div className="doc" dangerouslySetInnerHTML={{ __html: renderAlineas(dossier.klantstemMd) }} />
          ) : (
            <p className="placeholder">Geen klantstem.md gevonden.</p>
          )}
        </div>
      </details>

      {/* 5. Wat ontbreekt + eerstvolgende stap */}
      <div className="blok kaart">
        <div className="blokkop" style={{ cursor: "default" }}>
          <h3>Wat ontbreekt &amp; eerstvolgende stap</h3>
        </div>
        <div className="blokbody">
          {ladder.watOntbreekt ? (
            <div className="doc" dangerouslySetInnerHTML={{ __html: renderAlineas(ladder.watOntbreekt) }} />
          ) : (
            <p className="placeholder">
              Geen &quot;Wat er nu ontbreekt&quot;-blok gevonden in toelichting.md.
            </p>
          )}
          <h6 style={{ marginTop: 14 }}>Eerstvolgende stap</h6>
          {eersteOpen ? (
            <p>
              <span className="chip info">{eersteOpen.code}</span> {eersteOpen.tekst}
            </p>
          ) : (
            <p className="placeholder">
              {ladder.items.length > 0 ? "Alle ladderstappen staan op klaar." : "Geen ladderstappen gevonden."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
