"use client";

import { useEffect, useState, useTransition } from "react";

import {
  ALLE_STAPPEN,
  STATUS_LABEL,
  STATUS_PILKLASSE,
  STATUS_VOLGORDE,
  type ServicepuntChecklistItem,
  type Vestiging,
} from "@/lib/servicepunten-model";
import type { ServicepuntenDossier } from "@/lib/servicepunten";
import VestigingKaart from "./VestigingKaart";
import NotitieVeld from "@/app/_components/NotitieVeld";
import {
  servicepuntStapOpslaanAction,
  servicepuntEenmaligOpslaanAction,
  servicepuntNotitiesOpslaanAction,
} from "./actions";

/**
 * app/klant/[klantslug]/servicepunten/ServicepuntenView.tsx — de hele
 * Servicepunten-tab (alleen Nationaal Oogcentrum). Drie subtabbladen,
 * client-side gewisseld (geen eigen routes nodig, zelfde soort keuze als de
 * artifact se eigen tabnav):
 *
 * - Vestigingen: per status gegroepeerd (Draait/Bevestigd tot januari/
 *   Kandidaat/Nog uitzoeken), elke vestiging een eigen VestigingKaart.
 * - Volgorde: dezelfde vestigingen, gesorteerd op de al vastgelegde
 *   prioriteit (bevestigde/kandidaat-punten) — puur een weergave van een
 *   waarde die al in het dossier staat, geen eigen berekening (CLAUDE.md:
 *   "een dashboard mag tonen, nooit oordelen"). Heette in de artifact zelf
 *   "Roadmap"; hier omgedoopt tot "Volgorde" om verwarring met de al
 *   bestaande Roadmap-tab van deze klant (roadmap.md, over SEO-pagina's) te
 *   voorkomen — geen inhoudelijk verschil, alleen het label.
 * - Eenmalig geregeld: de vrije tekst over knopen die maar één keer geregeld
 *   hoeven te worden, met dezelfde bewerk-textarea als de Notities-tab.
 *
 * De aansluitproces-checklist (per stap afgevinkt+datum) is BEWUST hierheen
 * getild (in plaats van alleen lokaal in VestigingKaart bij te houden): de
 * pillen bovenaan en de Volgorde-tab tonen de voortgang van elke vestiging,
 * en die moet meteen kloppen zodra je hier een stap aanvinkt, ook zonder de
 * pagina te verversen.
 */

type SubTab = "vestigingen" | "volgorde" | "basis" | "notities";

function checklistUitVestigingen(vestigingen: Vestiging[]): Record<string, Record<string, ServicepuntChecklistItem>> {
  const out: Record<string, Record<string, ServicepuntChecklistItem>> = {};
  for (const v of vestigingen) out[v.id] = v.checklist;
  return out;
}

export default function ServicepuntenView({
  klantSlug,
  dossier,
  deelLink,
}: {
  klantSlug: string;
  dossier: ServicepuntenDossier;
  /** De knop met de deelbare link; staat links van de statuspillen. */
  deelLink?: React.ReactNode;
}) {
  const [tab, setTab] = useState<SubTab>("vestigingen");
  const [checklists, setChecklists] = useState(() => checklistUitVestigingen(dossier.vestigingen));
  const [stapFout, setStapFout] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Elke server action doet revalidatePath() op het huidige pad, waarna
  // Next.js deze pagina server-side opnieuw ophaalt en `dossier` met verse
  // data doorgeeft — de checklist-kopie hier volgt dan weer mee (zelfde
  // patroon als TakenlijstItems.tsx op de Takenlijst-tab).
  useEffect(() => {
    setChecklists(checklistUitVestigingen(dossier.vestigingen));
  }, [dossier]);

  function opStapChange(vestigingId: string, stapId: string, next: ServicepuntChecklistItem) {
    const vorige = checklists[vestigingId]?.[stapId] ?? { afgevinkt: false, datum: "", notitie: "" };
    setChecklists((huidig) => ({
      ...huidig,
      [vestigingId]: { ...huidig[vestigingId], [stapId]: next },
    }));
    setStapFout(null);
    startTransition(async () => {
      try {
        await servicepuntStapOpslaanAction(klantSlug, vestigingId, stapId, next.afgevinkt, next.datum);
      } catch (err) {
        setChecklists((huidig) => ({
          ...huidig,
          [vestigingId]: { ...huidig[vestigingId], [stapId]: vorige },
        }));
        setStapFout(err instanceof Error ? err.message : "Kon deze stap niet opslaan.");
      }
    });
  }

  function openVestiging(id: string) {
    setTab("vestigingen");
    requestAnimationFrame(() => {
      const el = document.getElementById(`vest-${id}`);
      if (el instanceof HTMLDetailsElement) {
        el.open = true;
        el.scrollIntoView({ block: "start", behavior: "smooth" });
      }
    });
  }

  const tellingen = { draait: 0, bevestigd: 0, kandidaat: 0, uitzoeken: 0 };
  let klaarTotaal = 0;
  let stappenTotaal = 0;
  for (const v of dossier.vestigingen) {
    tellingen[v.status]++;
    const cl = checklists[v.id] || {};
    klaarTotaal += ALLE_STAPPEN.filter((s) => cl[s.id]?.afgevinkt).length;
    stappenTotaal += ALLE_STAPPEN.length;
  }
  const pctTotaal = stappenTotaal ? Math.round((klaarTotaal / stappenTotaal) * 100) : 0;

  const gegroepeerd = STATUS_VOLGORDE.map((status) => ({
    status,
    vestigingen: dossier.vestigingen.filter((v) => v.status === status),
  })).filter((g) => g.vestigingen.length > 0);

  return (
    // sp-compact: dezelfde strakke rijenlijst als de gedeelde pagina al had.
    // Het overzicht hier stond veel ruimer, met een losse kaart per vestiging
    // en een gat ertussen; met 21 vestigingen scrol je je dan suf (09-09-2026).
    <div className="sp-compact">
      <div className="sp-topbalk">
        {deelLink}
        <div className="sp-pillen">
        <span className={`pill ${STATUS_PILKLASSE.draait}`}>{tellingen.draait} draaien</span>
        <span className={`pill ${STATUS_PILKLASSE.bevestigd}`}>{tellingen.bevestigd} bevestigd tot januari</span>
        <span className={`pill ${STATUS_PILKLASSE.kandidaat}`}>
          {tellingen.kandidaat + tellingen.uitzoeken} nog uit te zoeken
        </span>
          <span className="pill p-open">{pctTotaal}% van alle stappen gezet</span>
        </div>
      </div>

      <div className="sp-tabs">
        <button
          type="button"
          className={`sp-tab${tab === "vestigingen" ? " sp-tab-actief" : ""}`}
          onClick={() => setTab("vestigingen")}
        >
          Vestigingen <span className="pill p-open">{dossier.vestigingen.length}</span>
        </button>
        <button
          type="button"
          className={`sp-tab${tab === "volgorde" ? " sp-tab-actief" : ""}`}
          onClick={() => setTab("volgorde")}
        >
          Volgorde
        </button>
        <button
          type="button"
          className={`sp-tab${tab === "basis" ? " sp-tab-actief" : ""}`}
          onClick={() => setTab("basis")}
        >
          Eenmalig geregeld
        </button>
        <button
          type="button"
          className={`sp-tab${tab === "notities" ? " sp-tab-actief" : ""}`}
          onClick={() => setTab("notities")}
        >
          Notities
        </button>
      </div>

      {stapFout && <p className="foutregel">{stapFout}</p>}

      {tab === "vestigingen" && (
        <div>
          {gegroepeerd.map(({ status, vestigingen }) => (
            <div key={status}>
              <div className="sp-groepskop">
                <h4>{STATUS_LABEL[status]}</h4>
                <span className="sp-lijn" />
              </div>
              <div className="sp-kaarten">
                {vestigingen.map((v) => (
                  <VestigingKaart
                    key={v.id}
                    klantSlug={klantSlug}
                    vestiging={v}
                    checklist={checklists[v.id] || {}}
                    onStapChange={(stapId, next) => opStapChange(v.id, stapId, next)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "volgorde" && (
        <VolgordeTab dossier={dossier} checklists={checklists} onOpenVestiging={openVestiging} />
      )}

      {tab === "basis" && (
        <EenmaligGeregeldTab klantSlug={klantSlug} tekst={dossier.eenmaligGeregeld} />
      )}

      {tab === "notities" && (
        <div className="blok kaart">
          <div className="blokkop" style={{ cursor: "default" }}>
            <h3>Notities</h3>
          </div>
          <div className="blokbody">
            <NotitieVeld
              naam="sp-notities"
              waarde={dossier.notities}
              plaatshouder="Alles wat je kwijt wilt over de servicepunten"
              minHoogte={320}
              opslaan={(tekst) => servicepuntNotitiesOpslaanAction(klantSlug, tekst)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function VolgordeTab({
  dossier,
  checklists,
  onOpenVestiging,
}: {
  dossier: ServicepuntenDossier;
  checklists: Record<string, Record<string, ServicepuntChecklistItem>>;
  onOpenVestiging: (id: string) => void;
}) {
  const groepen = STATUS_VOLGORDE.map((status) => {
    const lijst = dossier.vestigingen
      .filter((v) => v.status === status)
      .slice()
      .sort((a, b) => (a.prioriteit ?? 999) - (b.prioriteit ?? 999));
    return { status, lijst };
  }).filter((g) => g.lijst.length > 0);

  return (
    <div>
      <div className="sp-voorstel">
        <span className="sp-lbl">Volgorde bevestigde en kandidaat-punten</span>
        <p>
          Op zoekvolume van de bijbehorende stadsterm (Ahrefs NL) en op landelijke dekking: een nieuwe
          provincie of regio weegt zwaarder dan een vierde punt in een gebied dat al gedekt is. Draaiende
          punten en de nog uit te zoeken punten staan op volgorde van binnenkomst.
        </p>
      </div>
      {groepen.map(({ status, lijst }) => (
        <div className="blok kaart" key={status} style={{ marginBottom: 14 }}>
          <div className="sp-groepskop" style={{ margin: "16px 18px 0" }}>
            <h4>
              {STATUS_LABEL[status]} ({lijst.length})
            </h4>
            <span className="sp-lijn" />
          </div>
          {lijst.map((v) => {
            const cl = checklists[v.id] || {};
            const klaar = ALLE_STAPPEN.filter((s) => cl[s.id]?.afgevinkt).length;
            const totaal = ALLE_STAPPEN.length;
            const pct = totaal ? Math.round((klaar / totaal) * 100) : 0;
            const meta = v.prioriteit != null ? v.volgordereden : v.opmerking || "";
            const metaKort = meta.length > 90 ? `${meta.slice(0, 90)}…` : meta;
            return (
              <div className="sp-rm-rij" key={v.id}>
                {v.prioriteit != null && <span className="pill sp-p-prioriteit">#{v.prioriteit}</span>}
                <span className="sp-rm-plaats">{v.plaats}</span>
                <span className="sp-voortgang">
                  <span className="sp-balk">
                    <span className="sp-vul" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="sp-cijfer">
                    {klaar}/{totaal}
                  </span>
                </span>
                <span className="sp-rm-meta">{metaKort}</span>
                <button type="button" className="sp-rm-link" onClick={() => onOpenVestiging(v.id)}>
                  Open kaart →
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function EenmaligGeregeldTab({ klantSlug, tekst }: { klantSlug: string; tekst: string }) {
  return (
    <div className="blok kaart">
      <div className="blokkop" style={{ cursor: "default" }}>
        <h3>Eenmalig geregeld</h3>
      </div>
      <div className="blokbody">
        <NotitieVeld
          naam="tekst"
          waarde={tekst}
          plaatshouder="Wat er maar één keer geregeld hoeft te worden: domeinoverstap, telefonie, vergoeding"
          minHoogte={320}
          opslaan={(nieuw) => servicepuntEenmaligOpslaanAction(klantSlug, nieuw)}
        />
      </div>
    </div>
  );
}
