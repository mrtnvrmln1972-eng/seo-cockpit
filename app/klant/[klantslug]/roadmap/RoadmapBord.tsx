"use client";

import { useState } from "react";
import styles from "./roadmap.module.css";

/**
 * app/klant/[klantslug]/roadmap/RoadmapBord.tsx — de kolommenweergave
 * (hoofdmenu-groep = kolom, pagina = kaart) plus het detailvenster dat
 * opent bij een klik op een kaart. Vervangt 08-09-2026 de eerdere,
 * verticaal-uitklapbare lijstweergave: Maarten liet zien dat de oude
 * claude.ai-artifact (weken lang zijn dagelijkse Roadmap-tab) een
 * kolommenbord was met een klik-detailvenster, en wil die vormgeving terug
 * — "die vind ik een stuk minder overzichtelijk en toont ook niet de
 * navigatiestructuur" over de vorige, platte opzet.
 *
 * Alle data komt kant-en-klaar (al gerenderd naar HTML via renderCel) van de
 * server-component (page.tsx); dit bestand doet alleen lay-out en het
 * open/dicht-zetten van het detailvenster (useState), geen eigen Drive- of
 * parseerlogica.
 */

export interface VeldItem {
  label: string;
  html: string;
}

export interface SignaalKaart {
  sectie: string;
  titel: string;
  meta: string[];
  velden: VeldItem[];
}

export interface PaginaKaart {
  key: string;
  pad: string;
  titel: string;
  woorden: string;
  score: string;
  scoreBand: "goed" | "kan-beter" | "nog-veel" | "";
  voortgang: string;
  voortgangKlaar: boolean;
  status: string;
  geblokkeerd: string;
  signalenCount: number;
  livePaginaUrl: string | null;
  roadmapVelden: VeldItem[];
  crawlVelden: VeldItem[];
  crawlDatum: string | null;
  signalen: SignaalKaart[];
}

export interface RoadmapGroepUI {
  naam: string;
  paginas: PaginaKaart[];
}

export default function RoadmapBord({ groepen }: { groepen: RoadmapGroepUI[] }) {
  const [open, setOpen] = useState<PaginaKaart | null>(null);

  return (
    <>
      <div className={styles.bord}>
        {groepen.map((groep) => (
          <div className={styles.kolom} key={groep.naam}>
            <div className={styles.kolomKop}>
              <h3 className={styles.kolomNaam}>{groep.naam}</h3>
              <span className={styles.kolomCount}>{groep.paginas.length}</span>
            </div>
            <div className={styles.kolomLijst}>
              {groep.paginas.map((p) => (
                <button
                  type="button"
                  className={styles.kaart}
                  key={p.key}
                  onClick={() => setOpen(p)}
                >
                  <span className={styles.kaartTitel}>{p.titel || p.pad}</span>
                  {p.pad && p.titel && <span className={styles.kaartPad}>{p.pad}</span>}
                  <span className={styles.kaartMeta}>
                    {p.woorden && <span className={styles.kaartWoorden}>{p.woorden}</span>}
                    {p.score && (
                      <span
                        className={`${styles.pil} ${
                          p.scoreBand === "goed"
                            ? styles.pilScoreGoed
                            : p.scoreBand === "kan-beter"
                              ? styles.pilScoreMiddel
                              : p.scoreBand === "nog-veel"
                                ? styles.pilScoreSlecht
                                : ""
                        }`}
                      >
                        {p.score}
                      </span>
                    )}
                    {p.voortgangKlaar ? (
                      <span className={styles.kaartVinkje}>✓</span>
                    ) : (
                      p.voortgang && <span className={styles.kaartVoortgang}>{p.voortgang}</span>
                    )}
                    {p.geblokkeerd && <span className={`${styles.pil} ${styles.pilGeblokkeerd}`}>geblokkeerd</span>}
                  </span>
                  {p.signalenCount > 0 && (
                    <span className={`${styles.pil} ${styles.signaalTeller}`}>
                      {p.signalenCount} {p.signalenCount === 1 ? "signaal" : "signalen"}
                    </span>
                  )}
                </button>
              ))}
              {groep.paginas.length === 0 && <p className={styles.kolomLeeg}>Geen pagina&apos;s</p>}
            </div>
          </div>
        ))}
      </div>

      {open && (
        <div className={styles.overlay} onClick={() => setOpen(null)}>
          <div className={styles.venster} onClick={(e) => e.stopPropagation()}>
            <div className={styles.vensterKop}>
              <h2 className={styles.vensterTitel}>{open.titel || open.pad}</h2>
              <button type="button" className={styles.vensterSluit} onClick={() => setOpen(null)} aria-label="Sluiten">
                ×
              </button>
            </div>

            <div className={styles.vensterBody}>
              {open.livePaginaUrl && (
                <p className={styles.liveLink}>
                  Live pagina:{" "}
                  <a href={open.livePaginaUrl} target="_blank" rel="noopener">
                    {open.livePaginaUrl}
                  </a>
                </p>
              )}

              {open.roadmapVelden.length > 0 && (
                <div className={styles.blok}>
                  <p className={styles.blokKop}>Roadmap, paginaradar</p>
                  <div className={styles.veldLijst}>
                    {open.roadmapVelden.map((v) => (
                      <div className={styles.veldRegel} key={v.label}>
                        <span className={styles.veldLabel}>{v.label}</span>
                        <span className={styles.veldWaarde} dangerouslySetInnerHTML={{ __html: v.html }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {open.crawlVelden.length > 0 && (
                <div className={styles.blok}>
                  <p className={styles.blokKop}>
                    Screaming Frog{open.crawlDatum ? `, crawl van ${open.crawlDatum}` : ", laatste crawl"}
                  </p>
                  <div className={styles.veldLijst}>
                    {open.crawlVelden.map((v) => (
                      <div className={styles.veldRegel} key={v.label}>
                        <span className={styles.veldLabel}>{v.label}</span>
                        <span className={styles.veldWaarde} dangerouslySetInnerHTML={{ __html: v.html }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {open.signalen.length > 0 && (
                <div className={styles.blok}>
                  <p className={styles.blokKop}>Uit signalen.md</p>
                  <div className={styles.signalenLijst}>
                    {open.signalen.map((s, si) => (
                      <div className={styles.signaalKaart} key={si}>
                        <div className={styles.signaalKop}>
                          <span className={styles.signaalTitel}>{s.titel}</span>
                          <span className={styles.signaalMeta}>
                            <span className={styles.pil}>{s.sectie}</span>
                            {s.meta.map((m) => (
                              <span className={styles.pil} key={m}>
                                {m}
                              </span>
                            ))}
                          </span>
                        </div>
                        {s.velden.map((v) => (
                          <div className={styles.signaalVeld} key={v.label}>
                            <span className={styles.signaalVeldLabel}>{v.label}</span>
                            <span className={styles.signaalVeldWaarde} dangerouslySetInnerHTML={{ __html: v.html }} />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
