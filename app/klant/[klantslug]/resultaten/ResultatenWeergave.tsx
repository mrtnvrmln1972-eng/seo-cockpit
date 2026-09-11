"use client";

import { useMemo, useState, useTransition } from "react";
import { useSleepVolgorde } from "@/app/_components/sleep-volgorde";
import type { GscUitslag, GscPagina, GscZoekwoord, Vergelijk } from "@/lib/google-data";
import type { Focus } from "@/lib/kpi-dossier";
import KopieerKnop from "../onboarding/KopieerKnop";
import {
  paginaSterAction,
  paginaVolgordeAction,
  paginaZoekwoordenAction,
  searchConsoleAction,
  zoekwoordFocusAction,
} from "./actions";

/**
 * De Resultaten-tab zoals hij op het scherm staat. De uitleg over waar de
 * cijfers vandaan komen en wat er bewust anders is dan in het oude dashboard
 * staat in de doc-comment van page.tsx.
 *
 * Alles wat je hier aanklikt gaat over de server: de periode wisselen haalt
 * verse cijfers op met de sleutel die alleen daar staat, en een ster, een
 * focus of een volgorde landt in kpi.md in de klantmap. De browser rekent
 * niets zelf uit; wat je ziet is wat Search Console gaf.
 */

const PERIODES = [
  { dagen: 7, label: "7 dagen" },
  { dagen: 28, label: "28 dagen" },
  { dagen: 90, label: "3 maanden" },
  { dagen: 180, label: "6 maanden" },
] as const;

const METERS = [
  { sleutel: "clicks", label: "Klikken" },
  { sleutel: "impressions", label: "Vertoningen" },
  { sleutel: "ctr", label: "CTR" },
  { sleutel: "position", label: "Positie" },
] as const;

type Meter = (typeof METERS)[number]["sleutel"];

const getal = (n: number) => n.toLocaleString("nl-NL");
const komma = (n: number, cijfers = 1) =>
  n.toLocaleString("nl-NL", { minimumFractionDigits: cijfers, maximumFractionDigits: cijfers });

/** Datum uit Search Console (2026-09-01) als "1 sep". */
function korteDatum(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

/**
 * Het verschil met de vorige periode, als chip. Bij de positie is lager beter,
 * dus daar draait de kleur om; dat is precies het soort ding dat je op een
 * scherm niet ziet en waar je dan maanden verkeerd naar kijkt.
 */
function Verschil({
  nu,
  toen,
  omgekeerd = false,
  cijfers = 0,
}: {
  nu: number;
  toen: number;
  omgekeerd?: boolean;
  cijfers?: number;
}) {
  if (!Number.isFinite(nu) || !Number.isFinite(toen) || toen === 0) {
    return <span className="res-delta neutraal">geen vergelijking</span>;
  }
  const verschil = nu - toen;
  const procent = (verschil / Math.abs(toen)) * 100;
  const beter = omgekeerd ? verschil < 0 : verschil > 0;
  const klasse = Math.abs(procent) < 0.5 ? "neutraal" : beter ? "beter" : "slechter";
  const teken = verschil > 0 ? "+" : verschil < 0 ? "" : "";
  return (
    <span className={`res-delta ${klasse}`}>
      {teken}
      {komma(procent, 0)}%
      <span className="res-delta-abs">
        ({teken}
        {komma(verschil, cijfers)})
      </span>
    </span>
  );
}

/** Eén van de vier cijfers bovenaan. */
function Cijferkaart({
  titel,
  waarde,
  nu,
  toen,
  omgekeerd,
  cijfers,
}: {
  titel: string;
  waarde: string;
  nu: number;
  toen: number;
  omgekeerd?: boolean;
  cijfers?: number;
}) {
  return (
    <div className="res-kaart">
      <div className="res-kaart-titel">{titel}</div>
      <div className="res-kaart-waarde">{waarde}</div>
      <Verschil nu={nu} toen={toen} omgekeerd={omgekeerd} cijfers={cijfers} />
    </div>
  );
}

/**
 * De grafiek: deze periode als volle lijn, de vorige als stippellijn eronder.
 * Met de hand getekend in SVG en niet met een grafiekbibliotheek: het is één
 * lijn, en een bibliotheek erbij maakt de pagina zwaarder dan de cijfers zelf.
 */
function Lijngrafiek({
  dates,
  nu,
  toen,
  meter,
}: {
  dates: string[];
  nu: number[];
  toen: number[];
  meter: Meter;
}) {
  if (nu.length < 2) {
    return <p className="placeholder">Te weinig dagen om een lijn te tekenen.</p>;
  }
  const B = 760;
  const H = 200;
  const marge = { boven: 12, onder: 26, links: 46, rechts: 10 };
  const omgekeerd = meter === "position";
  const alles = [...nu, ...toen].filter((n) => Number.isFinite(n));
  const hoog = Math.max(...alles, omgekeerd ? 1 : 0);
  const laag = omgekeerd ? Math.max(0, Math.min(...alles) - 1) : 0;
  const bereik = hoog - laag || 1;

  const x = (i: number) =>
    marge.links + (i / (nu.length - 1)) * (B - marge.links - marge.rechts);
  const y = (w: number) => {
    const deel = (w - laag) / bereik;
    const van_onder = omgekeerd ? 1 - deel : deel;
    return H - marge.onder - van_onder * (H - marge.boven - marge.onder);
  };
  const pad = (reeks: number[]) =>
    reeks
      .slice(0, nu.length)
      .map((w, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(w).toFixed(1)}`)
      .join(" ");

  const lijnen = [0, 0.5, 1].map((deel) => laag + deel * bereik);
  const labelVan = (w: number) =>
    meter === "ctr" ? `${komma(w, 1)}%` : meter === "position" ? komma(w, 1) : getal(Math.round(w));
  const stappen = Math.min(6, nu.length);

  return (
    <svg className="res-grafiek" viewBox={`0 0 ${B} ${H}`} role="img" aria-label="Verloop per dag">
      {lijnen.map((w) => (
        <g key={w}>
          <line className="res-raster" x1={marge.links} x2={B - marge.rechts} y1={y(w)} y2={y(w)} />
          <text className="res-as" x={marge.links - 6} y={y(w) + 4} textAnchor="end">
            {labelVan(w)}
          </text>
        </g>
      ))}
      {toen.length >= 2 && <path className="res-lijn vorig" d={pad(toen)} />}
      <path className="res-lijn nu" d={pad(nu)} />
      {Array.from({ length: stappen }, (_, k) => {
        const i = Math.round((k / (stappen - 1 || 1)) * (nu.length - 1));
        return (
          <text key={i} className="res-as" x={x(i)} y={H - 8} textAnchor="middle">
            {korteDatum(dates[i] ?? "")}
          </text>
        );
      })}
    </svg>
  );
}

export default function ResultatenWeergave({
  klantSlug,
  klantNaam,
  domein,
  serviceAccount,
  gsc,
  foutmelding,
  zoekwoordFocus,
  sterren,
  volgorde,
}: {
  klantSlug: string;
  klantNaam: string;
  domein: string;
  serviceAccount: string | null;
  gsc: GscUitslag | null;
  foutmelding: string | null;
  zoekwoordFocus: Record<string, Focus>;
  sterren: string[];
  volgorde: string[];
}) {
  const [uitslag, setUitslag] = useState<GscUitslag | null>(gsc);
  const [dagen, setDagen] = useState(28);
  const [vergelijk, setVergelijk] = useState<Vergelijk>("prev");
  const [meter, setMeter] = useState<Meter>("clicks");
  const [laadt, startLaden] = useTransition();
  const [fout, setFout] = useState<string | null>(foutmelding);

  // Wat jij vastzet, meteen zichtbaar. De server schrijft het naar kpi.md;
  // wachten op dat antwoord zou elke klik een halve seconde laten hangen.
  const [focus, setFocus] = useState<Record<string, Focus>>(zoekwoordFocus);
  const [sterLijst, setSterLijst] = useState<string[]>(sterren);
  const [alleenGevolgd, setAlleenGevolgd] = useState(false);
  const [zoek, setZoek] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [paginaKw, setPaginaKw] = useState<
    Record<string, Awaited<ReturnType<typeof paginaZoekwoordenAction>> | "laadt" | "fout">
  >({});

  function haalOp(nieuweDagen: number, nieuweVergelijk: Vergelijk) {
    setDagen(nieuweDagen);
    setVergelijk(nieuweVergelijk);
    setOpen(null);
    setPaginaKw({});
    startLaden(async () => {
      try {
        setUitslag(await searchConsoleAction(klantSlug, nieuweDagen, nieuweVergelijk));
        setFout(null);
      } catch (err) {
        setFout(err instanceof Error ? err.message : "Kon de cijfers niet ophalen.");
      }
    });
  }

  function zetFocus(zoekwoord: string, nieuw: Focus | null) {
    const sleutel = zoekwoord.toLowerCase();
    setFocus((oud) => {
      const kopie = { ...oud };
      if (nieuw) kopie[sleutel] = nieuw;
      else delete kopie[sleutel];
      return kopie;
    });
    startLaden(async () => {
      try {
        await zoekwoordFocusAction(klantSlug, zoekwoord, nieuw);
      } catch (err) {
        setFout(err instanceof Error ? err.message : "Kon dit zoekwoord niet vastleggen.");
      }
    });
  }

  function zetSter(url: string, ster: boolean) {
    setSterLijst((oud) => (ster ? [...oud.filter((u) => u !== url), url] : oud.filter((u) => u !== url)));
    startLaden(async () => {
      try {
        await paginaSterAction(klantSlug, url, ster);
      } catch (err) {
        setFout(err instanceof Error ? err.message : "Kon deze ster niet vastleggen.");
      }
    });
  }

  function klapUit(url: string) {
    if (open === url) {
      setOpen(null);
      return;
    }
    setOpen(url);
    if (paginaKw[url] || !uitslag?.property) return;
    setPaginaKw((oud) => ({ ...oud, [url]: "laadt" }));
    startLaden(async () => {
      try {
        const rijen = await paginaZoekwoordenAction(klantSlug, uitslag.property!, url, dagen, vergelijk);
        setPaginaKw((oud) => ({ ...oud, [url]: rijen }));
      } catch {
        // Bewust een eigen stand en niet de regel weer leeghalen: dan blijft er
        // "Zoekwoorden ophalen…" staan en wacht je op iets dat nooit komt.
        setPaginaKw((oud) => ({ ...oud, [url]: "fout" }));
      }
    });
  }

  // De pagina's: eerst wat jij vastzette (de volgorde uit kpi.md), daarna de
  // rest op klikken. Slepen verandert alleen die eerste lijst.
  //
  // De lijst moet dezelfde lijst blijven zolang de cijfers niet veranderen.
  // Zonder useMemo is het elke keer een nieuwe reeks, en dan denkt de
  // sleep-hook bij élke tekening dat de server met iets nieuws kwam: dat gaf
  // een pagina die zichzelf eindeloos opnieuw tekende en helemaal niet meer in
  // beeld kwam. Gevonden door ernaar te kijken, niet door de proef.
  const paginas: GscPagina[] = useMemo(() => uitslag?.paginas ?? [], [uitslag]);
  const opUrl = new Map(paginas.map((p) => [p.url, p]));
  const paginaIds = useMemo(() => {
    const bekend = new Set(paginas.map((p) => p.url));
    const vast = volgorde.filter((u) => bekend.has(u));
    return [...vast, ...paginas.filter((p) => !vast.includes(p.url)).map((p) => p.url)];
  }, [paginas, volgorde]);
  const sleep = useSleepVolgorde(paginaIds, (ids, herstel) => {
    startLaden(async () => {
      try {
        await paginaVolgordeAction(klantSlug, ids);
      } catch (err) {
        herstel();
        setFout(err instanceof Error ? err.message : "Kon de volgorde niet vastleggen.");
      }
    });
  });

  const zoekwoorden: GscZoekwoord[] = (uitslag?.zoekwoorden ?? []).filter((z) => {
    if (alleenGevolgd && !focus[z.keyword.toLowerCase()]) return false;
    if (zoek && !z.keyword.toLowerCase().includes(zoek.toLowerCase())) return false;
    return true;
  });

  const t = uitslag?.totalen ?? null;
  const reeksVan = (m: Meter) => ({
    nu: uitslag?.reeks[m] ?? [],
    toen:
      uitslag?.reeks[
        m === "clicks"
          ? "prevClicks"
          : m === "impressions"
            ? "prevImpressions"
            : m === "ctr"
              ? "prevCtr"
              : "prevPosition"
      ] ?? [],
  });

  return (
    <div className="res">
      <div className="res-kop">
        <div>
          <h2>Resultaten</h2>
          <p className="res-bron">
            {uitslag?.property ? (
              <>
                Search Console: <strong>{uitslag.property}</strong>
              </>
            ) : (
              <>Search Console voor {domein}</>
            )}
            {uitslag?.periode && (
              <>
                {" "}
                &middot; {korteDatum(uitslag.periode.curStart)} tot en met{" "}
                {korteDatum(uitslag.periode.curEnd)}
              </>
            )}
          </p>
        </div>
        <div className="res-knoppen">
          {PERIODES.map((p) => (
            <button
              key={p.dagen}
              type="button"
              className={`res-knop ${dagen === p.dagen ? "aan" : ""}`}
              onClick={() => haalOp(p.dagen, vergelijk)}
              disabled={laadt}
            >
              {p.label}
            </button>
          ))}
          <span className="res-scheiding" aria-hidden="true" />
          <button
            type="button"
            className={`res-knop ${vergelijk === "prev" ? "aan" : ""}`}
            onClick={() => haalOp(dagen, "prev")}
            disabled={laadt}
          >
            vorige periode
          </button>
          <button
            type="button"
            className={`res-knop ${vergelijk === "yoy" ? "aan" : ""}`}
            onClick={() => haalOp(dagen, "yoy")}
            disabled={laadt}
          >
            vorig jaar
          </button>
        </div>
      </div>

      {fout && <div className="foutbanner">{fout}</div>}

      {!uitslag?.gekoppeld || !uitslag.property ? (
        <GeenToegang
          klantNaam={klantNaam}
          domein={domein}
          serviceAccount={serviceAccount}
          gekoppeld={Boolean(uitslag?.gekoppeld)}
          zichtbaar={uitslag?.zichtbaar ?? []}
        />
      ) : (
        <>
          <div className={`res-cijfers ${laadt ? "laadt" : ""}`}>
            <Cijferkaart
              titel="Klikken"
              waarde={getal(t?.clicks.cur ?? 0)}
              nu={t?.clicks.cur ?? 0}
              toen={t?.clicks.prev ?? 0}
            />
            <Cijferkaart
              titel="Vertoningen"
              waarde={getal(t?.impressions.cur ?? 0)}
              nu={t?.impressions.cur ?? 0}
              toen={t?.impressions.prev ?? 0}
            />
            <Cijferkaart
              titel="CTR"
              waarde={`${komma(t?.ctr.cur ?? 0, 1)}%`}
              nu={t?.ctr.cur ?? 0}
              toen={t?.ctr.prev ?? 0}
              cijfers={1}
            />
            <Cijferkaart
              titel="Gemiddelde positie"
              waarde={komma(t?.position.cur ?? 0, 1)}
              nu={t?.position.cur ?? 0}
              toen={t?.position.prev ?? 0}
              omgekeerd
              cijfers={1}
            />
          </div>

          <div className="paneel res-paneel">
            <div className="res-paneelkop">
              <h3>Verloop per dag</h3>
              <div className="res-knoppen">
                {METERS.map((m) => (
                  <button
                    key={m.sleutel}
                    type="button"
                    className={`res-knop ${meter === m.sleutel ? "aan" : ""}`}
                    onClick={() => setMeter(m.sleutel)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="res-grafiekwrap">
              <Lijngrafiek
                dates={uitslag.reeks.dates}
                nu={reeksVan(meter).nu}
                toen={reeksVan(meter).toen}
                meter={meter}
              />
            </div>
            <p className="res-legenda">
              <span className="res-staal nu" /> deze periode
              <span className="res-staal vorig" />{" "}
              {vergelijk === "yoy" ? "zelfde periode vorig jaar" : "vorige periode"}
            </p>
          </div>

          <div className="paneel res-paneel">
            <div className="res-paneelkop">
              <h3>Zoekwoorden</h3>
              <div className="res-filters">
                <input
                  className="res-zoek"
                  type="search"
                  value={zoek}
                  onChange={(e) => setZoek(e.target.value)}
                  placeholder="Zoek in zoekwoorden"
                />
                <button
                  type="button"
                  className={`res-knop ${alleenGevolgd ? "aan" : ""}`}
                  onClick={() => setAlleenGevolgd((a) => !a)}
                >
                  Alleen wat je volgt
                </button>
              </div>
            </div>
            {zoekwoorden.length === 0 ? (
              <p className="placeholder">Geen zoekwoorden in deze periode.</p>
            ) : (
              <div className="res-tabelwrap">
                <table className="res-tabel">
                  <thead>
                    <tr>
                      <th>Zoekwoord</th>
                      <th className="num">Klikken</th>
                      <th className="num">Vertoningen</th>
                      <th className="num">CTR</th>
                      <th className="num">Positie</th>
                      <th>Volgen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zoekwoorden.map((z) => {
                      const nu = focus[z.keyword.toLowerCase()] ?? null;
                      return (
                        <tr key={z.keyword} className={nu ? `res-focus-${nu}` : ""}>
                          <td>
                            <span className="res-kw">{z.keyword}</span>
                            {z.page && (
                              <a className="res-kwpad" href={z.page} target="_blank" rel="noreferrer">
                                {pad(z.page)}
                              </a>
                            )}
                          </td>
                          <td className="num">
                            {getal(z.clicks)}
                            <Verschil nu={z.clicks} toen={z.prevClicks} />
                          </td>
                          <td className="num">
                            {getal(z.impressions)}
                            <Verschil nu={z.impressions} toen={z.prevImpressions} />
                          </td>
                          <td className="num">{komma(z.ctr, 1)}%</td>
                          <td className="num">
                            {komma(z.position, 1)}
                            {z.prevPosition !== null && (
                              <Verschil nu={z.position} toen={z.prevPosition} omgekeerd cijfers={1} />
                            )}
                          </td>
                          <td>
                            <div className="res-focusknoppen">
                              <button
                                type="button"
                                className={`res-knop klein ${nu === "prio" ? "aan" : ""}`}
                                onClick={() => zetFocus(z.keyword, nu === "prio" ? null : "prio")}
                              >
                                prio
                              </button>
                              <button
                                type="button"
                                className={`res-knop klein ${nu === "secundair" ? "aan" : ""}`}
                                onClick={() => zetFocus(z.keyword, nu === "secundair" ? null : "secundair")}
                              >
                                tweede
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="paneel res-paneel">
            <div className="res-paneelkop">
              <h3>Pagina&apos;s</h3>
              <p className="res-hulp">Sleep aan de ⠿ om de volgorde te bepalen; klik een regel open voor de zoekwoorden.</p>
            </div>
            {sleep.ids.length === 0 ? (
              <p className="placeholder">Geen pagina&apos;s met vertoningen in deze periode.</p>
            ) : (
              <ul className="res-paginas">
                {sleep.ids.map((url) => {
                  const p = opUrl.get(url);
                  if (!p) return null;
                  const kw = paginaKw[url];
                  const ster = sterLijst.includes(url);
                  return (
                    <li
                      key={url}
                      data-sleep-id={url}
                      className={`res-pagina ${sleep.sleept === url ? "sleept" : ""} ${ster ? "ster" : ""}`}
                    >
                      <div className="res-paginarij">
                        <button
                          type="button"
                          className="res-greep"
                          aria-label="Versleep deze pagina"
                          onPointerDown={(e) => sleep.start(url, e)}
                        >
                          ⠿
                        </button>
                        <button
                          type="button"
                          className={`res-ster ${ster ? "aan" : ""}`}
                          aria-label={ster ? "Haal de ster weg" : "Geef deze pagina een ster"}
                          onClick={() => zetSter(url, !ster)}
                        >
                          {ster ? "★" : "☆"}
                        </button>
                        <button type="button" className="res-paginanaam" onClick={() => klapUit(url)}>
                          {pad(url)}
                        </button>
                        <a className="res-paginalink" href={url} target="_blank" rel="noreferrer">
                          open
                        </a>
                        <span className="res-paginagetal">
                          {getal(p.clicks)} klikken
                          <Verschil nu={p.clicks} toen={p.prevClicks} />
                        </span>
                        <span className="res-paginagetal">
                          {getal(p.impressions)} vertoningen
                          <Verschil nu={p.impressions} toen={p.prevImpressions} />
                        </span>
                      </div>
                      {open === url && (
                        <div className="res-paginakw">
                          {kw === "fout" ? (
                            <p className="placeholder">
                              Kon de zoekwoorden van deze pagina niet ophalen. Probeer het
                              opnieuw, of laad de pagina opnieuw.
                            </p>
                          ) : kw === "laadt" || !kw ? (
                            <p className="placeholder">Zoekwoorden ophalen…</p>
                          ) : kw.length === 0 ? (
                            <p className="placeholder">Geen zoekwoorden voor deze pagina.</p>
                          ) : (
                            <table className="res-tabel">
                              <thead>
                                <tr>
                                  <th>Zoekwoord</th>
                                  <th className="num">Klikken</th>
                                  <th className="num">Vertoningen</th>
                                  <th className="num">Positie</th>
                                </tr>
                              </thead>
                              <tbody>
                                {kw.map((r) => (
                                  <tr key={r.keyword}>
                                    <td>{r.keyword}</td>
                                    <td className="num">
                                      {getal(r.clicks)}
                                      <Verschil nu={r.clicks} toen={r.prevClicks} />
                                    </td>
                                    <td className="num">{getal(r.impressions)}</td>
                                    <td className="num">
                                      {komma(r.position, 1)}
                                      {r.prevPosition !== null && (
                                        <Verschil nu={r.position} toen={r.prevPosition} omgekeerd cijfers={1} />
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Een adres zonder het domein ervoor; dat staat al in de kop. */
function pad(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname === "/" ? "/ (voorpagina)" : u.pathname + u.search;
  } catch {
    return url;
  }
}

/**
 * Wat er moet gebeuren als er nog geen cijfers zijn. Bewust met het volledige
 * adres van het service-account én de twee volledige links erbij: zonder die
 * twee is dit scherm een melding waar je niets mee kunt.
 */
function GeenToegang({
  klantNaam,
  domein,
  serviceAccount,
  gekoppeld,
  zichtbaar,
}: {
  klantNaam: string;
  domein: string;
  serviceAccount: string | null;
  gekoppeld: boolean;
  zichtbaar: string[];
}) {
  return (
    <div className="kader let res-toegang">
      <h3>Nog geen cijfers voor {klantNaam}</h3>
      {!serviceAccount ? (
        <p>
          De sleutel van het service-account staat niet in deze omgeving
          (<code>GOOGLE_SERVICE_ACCOUNT_KEY</code>). Zonder die sleutel kan de cockpit
          niets bij Google ophalen.
        </p>
      ) : !gekoppeld ? (
        <p>
          Google gaf geen antwoord op de sleutel van dit service-account. Controleer of
          de Search Console API aanstaat voor het project waar deze sleutel bij hoort.
        </p>
      ) : (
        <>
          <p>
            Het service-account mag nog niet bij de gegevens van <strong>{domein}</strong>.
            Geef dit adres leesrechten, dan staan de cijfers hier vanzelf:
          </p>
          <p className="res-adres">
            <code>{serviceAccount}</code>{" "}
            <KopieerKnop tekst={serviceAccount} label="Kopieer dit adres" />
          </p>
          <ul className="res-stappen">
            <li>
              Search Console: open{" "}
              <a href="https://search.google.com/search-console/users" target="_blank" rel="noreferrer">
                https://search.google.com/search-console/users
              </a>
              , kies de property van {domein}, klik op <strong>Gebruiker toevoegen</strong> en
              plak het adres hierboven met recht <strong>Beperkt</strong>.
            </li>
            <li>
              Google Analytics (voor de volgende stap): open{" "}
              <a href="https://analytics.google.com/analytics/web/#/a/admin/accounts" target="_blank" rel="noreferrer">
                https://analytics.google.com/analytics/web/#/a/admin/accounts
              </a>
              , ga naar <strong>Toegangsbeheer voor property</strong>, klik op{" "}
              <strong>+</strong> en geef hetzelfde adres de rol <strong>Viewer</strong>.
            </li>
          </ul>
          {zichtbaar.length > 0 && (
            <details className="ob-det">
              <summary>Waar dit account nu wél bij mag ({zichtbaar.length})</summary>
              <ul className="res-stappen">
                {zichtbaar.map((p) => (
                  <li key={p}>
                    <code>{p}</code>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}
