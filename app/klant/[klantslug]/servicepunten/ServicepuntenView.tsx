"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import {
  ALLE_STAPPEN,
  STATUS_GROEPLABEL,
  STATUS_VOLGORDE,
  type ServicepuntChecklistItem,
  type Vestiging,
} from "@/lib/servicepunten-model";
import type { ServicepuntenDossier } from "@/lib/servicepunten";
import VestigingKaart from "./VestigingKaart";
import NotitieVeld from "@/app/_components/NotitieVeld";
import { useSleepVolgorde } from "@/app/_components/sleep-volgorde";
import {
  servicepuntStapOpslaanAction,
  servicepuntEenmaligOpslaanAction,
  servicepuntNotitiesOpslaanAction,
  servicepuntVolgordeOpslaanAction,
} from "./actions";

/**
 * app/klant/[klantslug]/servicepunten/ServicepuntenView.tsx — de hele
 * Servicepunten-tab (alleen Nationaal Oogcentrum). Drie subtabbladen,
 * client-side gewisseld (geen eigen routes nodig, zelfde soort keuze als de
 * artifact se eigen tabnav):
 *
 * - Vestigingen: per status gegroepeerd (Draait/Bevestigd tot januari/
 *   Kandidaat/Nog uitzoeken), elke vestiging een eigen VestigingKaart.
 * - Volgorde: de wachtrij van punten die nog aangesloten moeten worden, op
 *   het nummer dat in het dossier staat, en te herschikken door te slepen
 *   (10-09-2026). De volgorde komt dus uit een menselijke handeling, niet
 *   uit een eigen berekening (CLAUDE.md: "een dashboard mag tonen, nooit
 *   oordelen"). Heette in de artifact zelf
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

type SubTab = "vestigingen" | "basis" | "notities";

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
    const vorige = checklists[vestigingId]?.[stapId] ?? { afgevinkt: false, datum: "", notitie: "", link: "" };
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

  /** Springt naar de groep van een status, vanuit de kerncijfers bovenaan. */
  function naarGroep(status: string) {
    setTab("vestigingen");
    requestAnimationFrame(() => {
      document.getElementById(`sp-groep-${status}`)?.scrollIntoView({ block: "start", behavior: "smooth" });
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

  /**
   * Slepen in het vestigingsoverzicht zelf (11-09-2026, op Maartens verzoek:
   * "ik wil deze servicepunten ook in volgorde kunnen zetten, slepen").
   * Dat kon al op het tabblad Volgorde, maar niet hier, terwijl hier wel
   * "#3 in volgorde" op elke kaart staat.
   *
   * Twee dingen horen bij elkaar en zijn allebei nodig:
   * 1. De kaarten in een groep staan nu ín die volgorde. Ze stonden in de
   *    volgorde van het bestand, dus de nummers liepen door elkaar (#13, #2,
   *    #12, #6) en dan zegt slepen niets.
   * 2. Slepen verandert alleen de plekken bínnen die groep. De wachtrij loopt
   *    over alle groepen heen; door alleen de bewoners van de plekken van
   *    deze groep te wisselen, blijft de rest staan waar hij stond.
   *
   * De punten die al draaien staan niet in de wachtrij en zijn dus ook niet
   * te slepen; daar valt geen volgorde aan te geven.
   */
  const rijVanServer = useMemo(
    () => wachtrij(dossier.vestigingen).map((v) => v.id),
    [dossier.vestigingen],
  );
  const [volgordeFout, setVolgordeFout] = useState<string | null>(null);

  const sleep = useSleepVolgorde(rijVanServer, (ids, herstel) => {
    setVolgordeFout(null);
    startTransition(async () => {
      try {
        await servicepuntVolgordeOpslaanAction(klantSlug, ids);
      } catch (err) {
        herstel();
        setVolgordeFout(err instanceof Error ? err.message : "Kon de volgorde niet opslaan.");
      }
    });
  });
  const plekInRij = new Map(sleep.ids.map((id, i) => [id, i + 1]));

  const gegroepeerd = STATUS_VOLGORDE.map((status) => {
    const inGroep = dossier.vestigingen.filter((v) => v.status === status);
    if (status === "draait") return { status, vestigingen: inGroep, sleepbaar: false };
    // Op de plek die de wachtrij aangeeft, zodat het nummer op elke kaart
    // ook echt de volgorde van boven naar beneden is.
    const opRij = inGroep
      .slice()
      .sort((a, b) => (plekInRij.get(a.id) ?? Infinity) - (plekInRij.get(b.id) ?? Infinity));
    return { status, vestigingen: opRij, sleepbaar: opRij.length > 1 };
  }).filter((g) => g.vestigingen.length > 0);

  return (
    // sp-compact: dezelfde strakke rijenlijst als de gedeelde pagina al had.
    // Het overzicht hier stond veel ruimer, met een losse kaart per vestiging
    // en een gat ertussen; met 21 vestigingen scrol je je dan suf (09-09-2026).
    <div className="sp-compact">
      <div className="sp-topbalk">{deelLink}</div>

      {/*
        De vier kerncijfers als kaarten (10-09-2026, naar Maartens voorbeeld).
        De eerste drie brengen je naar de bijbehorende groep hieronder; het
        percentage is een uitkomst, dus daar valt niets te openen.
      */}
      <div className="sp-kerncijfers">
        <button type="button" className="sp-cijferkaart k-groen" onClick={() => naarGroep("draait")}>
          <span className="sp-cijfergetal">{tellingen.draait}</span>
          <span className="sp-cijferlabel">Draaien</span>
          <span className="chev2" />
        </button>
        <button
          type="button"
          className="sp-cijferkaart k-blauw"
          onClick={() => naarGroep("bevestigd")}
        >
          <span className="sp-cijfergetal">{tellingen.bevestigd}</span>
          <span className="sp-cijferlabel">Bevestigd tot januari</span>
          <span className="chev2" />
        </button>
        <button
          type="button"
          className="sp-cijferkaart k-geel"
          onClick={() => naarGroep("kandidaat")}
        >
          <span className="sp-cijfergetal">{tellingen.kandidaat + tellingen.uitzoeken}</span>
          <span className="sp-cijferlabel">Nog uit te zoeken</span>
          <span className="chev2" />
        </button>
        <div className="sp-cijferkaart sp-cijferkaart-stil">
          <span className="sp-cijfergetal">{pctTotaal}%</span>
          <span className="sp-cijferlabel">Van alle stappen gezet</span>
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
          {volgordeFout && <p className="foutregel">{volgordeFout}</p>}
          {gegroepeerd.map(({ status, vestigingen, sleepbaar }) => (
            <section className="sp-groepkaart" key={status} id={`sp-groep-${status}`}>
              <div className="sp-groepkop">
                <span className={`sp-stip sp-stip-${status}`} />
                <h4>{STATUS_GROEPLABEL[status]}</h4>
                <span className="pill p-open">{vestigingen.length}</span>
                {sleepbaar && (
                  <span className="sp-rm-hulp">Sleep aan de ⠿ om de volgorde te veranderen</span>
                )}
              </div>
              <div className="sp-kaarten">
                {vestigingen.map((v) => (
                  <div
                    key={v.id}
                    className={`sp-sleepbaar${sleep.sleept === v.id ? " sp-sleept" : ""}`}
                    /* Waar de aanwijzer overheen gaat tijdens het slepen. */
                    data-sleep-id={sleepbaar ? v.id : undefined}
                  >
                    <VestigingKaart
                      klantSlug={klantSlug}
                      vestiging={v}
                      checklist={checklists[v.id] || {}}
                      volgordeNr={plekInRij.get(v.id) ?? null}
                      opGreep={sleepbaar ? (e) => sleep.start(v.id, e) : undefined}
                      onStapChange={(stapId, next) => opStapChange(v.id, stapId, next)}
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
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

/**
 * De punten die nog aangesloten moeten worden, op het nummer dat in
 * servicepunten.md staat. Zonder nummer sluit je achteraan aan, in de
 * volgorde waarin ze in het bestand staan — puur een weergave van wat er
 * staat, geen eigen weging.
 */
function wachtrij(vestigingen: Vestiging[]): Vestiging[] {
  return vestigingen
    .filter((v) => v.status !== "draait")
    .map((v, i) => ({ v, i }))
    .sort((a, b) => {
      const pa = a.v.prioriteit ?? Number.MAX_SAFE_INTEGER;
      const pb = b.v.prioriteit ?? Number.MAX_SAFE_INTEGER;
      return pa === pb ? a.i - b.i : pa - pb;
    })
    .map(({ v }) => v);
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
