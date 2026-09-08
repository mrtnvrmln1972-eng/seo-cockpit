"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { statusClass, renderCel } from "@/lib/markdown";
import { useTaakVenster } from "./TaakVensterContext";
import { bewerkTaakAction, zetStatusAction, verwijderTaakAction } from "./actions";
import KlaarMeldenForm from "./KlaarMeldenForm";
import RijkTekstVeld from "@/app/_ui/RijkTekstVeld";

/** Zelfde vaste developer-adres als page.tsx (DEVELOPER_EMAIL) — bewust hier
 * los gehouden in plaats van geëxporteerd, dit is de enige andere plek die
 * het nodig heeft. */
const DEVELOPER_EMAIL = "tonny@pingwin.nl";
const DEVBORD_PATH = "/bord-cc5100460da936203b8222ad79b65779";

/**
 * app/bord-cc5100460da936203b8222ad79b65779/TaakVenster.tsx — de gedeelde
 * "Bekijk"-popup, 08-09-2026 gebouwd op Maartens verzoek: één plek met alle
 * informatie/context/links van een taak, netjes opgemaakt, die zowel vanuit
 * de "Lijst per klant" als vanuit de weekplanning-kaart identiek werkt (de
 * weekplanning heeft zelf geen ruimte voor een uitklapbare rij, dus dit
 * venster moet daar VOLLEDIG zelfstandig werken — status wijzigen, mailen,
 * verwijderen, bewerken, niet alleen "bekijken").
 *
 * Bewerken/opslaan: titel, opmerking, pagina en volledige context zijn hier
 * rechtstreeks te wijzigen (RijkTekstVeld voor opmerking/detail, net als in
 * de eerdere BewerkTaakForm). Geen aparte "Opslaan"-knop — sluiten (kruisje,
 * klik op de achtergrond, Escape) vergelijkt de huidige velden met de
 * waarden bij het openen en slaat automatisch op als er iets is gewijzigd.
 * Bij een mislukte opslag blijft het venster open met een foutmelding, zodat
 * een wijziging nooit stilzwijgend verloren gaat.
 */
export default function TaakVenster() {
  const { open: taak, sluitTaak } = useTaakVenster();

  const [titel, setTitel] = useState("");
  const [opmerking, setOpmerking] = useState("");
  const [pagina, setPagina] = useState("");
  const [detail, setDetail] = useState("");
  const snapshotRef = useRef({ titel: "", opmerking: "", pagina: "", detail: "" });

  const [opslaanBezig, startOpslaan] = useTransition();
  const [statusBezig, startStatus] = useTransition();
  const [verwijderBezig, startVerwijder] = useTransition();
  const [fout, setFout] = useState<string | null>(null);

  // Bij het openen van een (andere) taak: lokale velden + snapshot resetten.
  useEffect(() => {
    if (!taak) return;
    setTitel(taak.titel);
    setOpmerking(taak.opmerking);
    setPagina(taak.pagina);
    setDetail(taak.detail);
    snapshotRef.current = {
      titel: taak.titel,
      opmerking: taak.opmerking,
      pagina: taak.pagina,
      detail: taak.detail,
    };
    setFout(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taak?.klantSlug, taak?.n]);

  if (!taak) return null;

  const status = taak.status.trim().toLowerCase();
  const isOpenStatus = status === "open" || status === "";
  const isKlaar = status === "klaar";
  const isAfgerond = status === "afgerond";

  // Escape sluit (en slaat op) het venster — een globale listener in plaats
  // van onKeyDown op het venster-element, want daarvoor zou iets in het
  // venster expliciet focus moeten hebben. sluitenMetOpslaanRef houdt steeds
  // de nieuwste versie vast (met de actuele titel/opmerking/pagina/detail in
  // zijn closure) zodat de listener zelf maar één keer per open taak hoeft
  // te worden aan/afgemeld.
  const sluitenMetOpslaanRef = useRef<() => void>(() => {});
  useEffect(() => {
    sluitenMetOpslaanRef.current = sluitenMetOpslaan;
  });
  useEffect(() => {
    if (!taak) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") sluitenMetOpslaanRef.current();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taak?.klantSlug, taak?.n]);

  function isGewijzigd(): boolean {
    const s = snapshotRef.current;
    return titel !== s.titel || opmerking !== s.opmerking || pagina !== s.pagina || detail !== s.detail;
  }

  function sluitenMetOpslaan() {
    if (!taak) return;
    if (!titel.trim()) {
      setFout("Een taak heeft een titel nodig.");
      return;
    }
    if (!isGewijzigd()) {
      sluitTaak();
      return;
    }
    setFout(null);
    startOpslaan(async () => {
      try {
        await bewerkTaakAction(
          taak.klantSlug,
          (() => {
            const fd = new FormData();
            fd.set("klantFolderId", taak.klantFolderId);
            fd.set("n", String(taak.n));
            fd.set("titel", titel);
            fd.set("opmerking", opmerking);
            fd.set("pagina", pagina);
            fd.set("detail", detail);
            return fd;
          })(),
        );
        sluitTaak();
      } catch (err) {
        setFout(err instanceof Error ? err.message : "Kon de wijzigingen niet opslaan.");
      }
    });
  }

  function zetStatus(waarde: "afgerond" | "open") {
    if (!taak) return;
    setFout(null);
    startStatus(async () => {
      try {
        await zetStatusAction(
          taak.klantSlug,
          (() => {
            const fd = new FormData();
            fd.set("klantFolderId", taak.klantFolderId);
            fd.set("n", String(taak.n));
            fd.set("waarde", waarde);
            return fd;
          })(),
        );
      } catch (err) {
        setFout(err instanceof Error ? err.message : "Kon de status niet opslaan.");
      }
    });
  }

  function verwijderTaak() {
    if (!taak) return;
    if (!window.confirm(`"${taak.titel}" verwijderen?`)) return;
    setFout(null);
    startVerwijder(async () => {
      try {
        await verwijderTaakAction(
          taak.klantSlug,
          (() => {
            const fd = new FormData();
            fd.set("klantFolderId", taak.klantFolderId);
            fd.set("n", String(taak.n));
            return fd;
          })(),
        );
        sluitTaak();
      } catch (err) {
        setFout(err instanceof Error ? err.message : "Kon de taak niet verwijderen.");
      }
    });
  }

  const anker = `taak-${taak.klantSlug}-${taak.n}`;
  const link =
    typeof window !== "undefined" ? `${window.location.origin}${DEVBORD_PATH}#${anker}` : "";
  const mailtoOnderwerp = encodeURIComponent(`Developerbord, ${taak.klantNaam}: ${taak.titel}`);
  const mailtoRegels = [`Taak: ${taak.titel} (${taak.klantNaam})`, link, ...(opmerking ? ["", opmerking] : [])];
  const mailtoHref = `mailto:${DEVELOPER_EMAIL}?subject=${mailtoOnderwerp}&body=${encodeURIComponent(mailtoRegels.join("\n"))}`;

  const bezig = opslaanBezig || statusBezig || verwijderBezig;

  return (
    <div
      className="tvOverlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) sluitenMetOpslaan();
      }}
    >
      <div className="tvVenster" role="dialog" aria-modal="true">
        <div className="tvKop">
          <div className="tvKopLinks">
            <span className="tvKlant">{taak.klantNaam}</span>
            <span className={`pill ${statusClass(taak.status)}`}>{taak.status}</span>
          </div>
          <button type="button" className="tvSluit" onClick={sluitenMetOpslaan} title="Sluiten (slaat op)">
            ×
          </button>
        </div>

        <div className="tvBody">
          <div className="metaveld">
            <label>Titel</label>
            <input type="text" value={titel} onChange={(e) => setTitel(e.target.value)} disabled={bezig} />
          </div>

          <div className="metaveld">
            <label>Opmerking</label>
            <RijkTekstVeld waarde={opmerking} onChange={setOpmerking} rows={3} disabled={bezig} />
          </div>

          <div className="metaveld">
            <label>Pagina</label>
            <input
              type="text"
              value={pagina}
              onChange={(e) => setPagina(e.target.value)}
              placeholder="https://…"
              disabled={bezig}
            />
            {pagina && (
              <a className="tvPaginaLink" href={pagina} target="_blank" rel="noopener">
                {pagina.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>

          <div className="metaveld">
            <label>Volledige context</label>
            <RijkTekstVeld waarde={detail} onChange={setDetail} rows={7} disabled={bezig} />
          </div>

          {(isKlaar || isAfgerond) && (taak.tijdsduur || taak.terugkoppeling) && (
            <div className="terugkoppelblok">
              <b>Terugkoppeling developer</b>
              {taak.tijdsduur && <p>Tijd besteed: {taak.tijdsduur}</p>}
              {taak.terugkoppeling && (
                <p dangerouslySetInnerHTML={{ __html: renderCel(taak.terugkoppeling) }} />
              )}
            </div>
          )}

          {fout && <p className="foutregel">{fout}</p>}

          <div className="acties tvActies">
            {isOpenStatus && (
              <KlaarMeldenForm klantSlug={taak.klantSlug} klantFolderId={taak.klantFolderId} n={taak.n} />
            )}
            {isKlaar && (
              <>
                <button className="pillbtn sterk" type="button" disabled={bezig} onClick={() => zetStatus("afgerond")}>
                  Afgerond zetten
                </button>
                <button className="pillbtn licht" type="button" disabled={bezig} onClick={() => zetStatus("open")}>
                  Heropenen
                </button>
              </>
            )}
            {isAfgerond && (
              <button className="pillbtn licht" type="button" disabled={bezig} onClick={() => zetStatus("open")}>
                Heropenen
              </button>
            )}
            <a className="pillbtn licht" href={mailtoHref}>
              Mail
            </a>
            <button
              className="pillbtn kritiek"
              type="button"
              disabled={bezig}
              onClick={verwijderTaak}
            >
              Verwijderen
            </button>
          </div>

          {opslaanBezig && <p className="tvOpslaanStatus">Bezig met opslaan…</p>}
        </div>
      </div>
    </div>
  );
}
