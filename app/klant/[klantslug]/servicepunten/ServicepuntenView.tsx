"use client";

import { useEffect, useState, useTransition } from "react";

import {
  ALLE_STAPPEN,
  STATUS_GROEPLABEL,
  STATUS_LABEL,
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
            <section className="sp-groepkaart" key={status} id={`sp-groep-${status}`}>
              <div className="sp-groepkop">
                <span className={`sp-stip sp-stip-${status}`} />
                <h4>{STATUS_GROEPLABEL[status]}</h4>
                <span className="pill p-open">{vestigingen.length}</span>
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
            </section>
          ))}
        </div>
      )}

      {tab === "volgorde" && (
        <VolgordeTab
          klantSlug={klantSlug}
          dossier={dossier}
          checklists={checklists}
          onOpenVestiging={openVestiging}
        />
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
 * Het tabblad Volgorde: de wachtrij van punten die nog aangesloten moeten
 * worden, van boven naar beneden, en die volgorde sleep je zelf
 * (10-09-2026, op Maartens verzoek: "kun je het zo maken dat ik de
 * vestigingen kan slepen in volgorde?").
 *
 * Bij loslaten worden de nummers doorgenummerd vanaf 1 en in één keer
 * opgeslagen in servicepunten.md (het veld "Prioriteit" per vestiging).
 * Lukt dat niet, dan springt de lijst terug naar de volgorde die op de
 * server staat, met de melding erbij: beter zichtbaar terug dan een
 * volgorde tonen die niet is opgeslagen. Zelfde aanpak als de klantenlijst
 * in de zijbalk (NavKlanten.tsx) en de takenlijst op het werkbord.
 *
 * Slepen kan alleen als je de greep vasthebt (het nummer vooraan), zodat je
 * de tekst op een regel gewoon kunt selecteren en kopiëren.
 *
 * De punten die al draaien staan eronder in een aparte, niet-sleepbare
 * lijst: die hoeven niet meer in de rij te staan.
 */
function VolgordeTab({
  klantSlug,
  dossier,
  checklists,
  onOpenVestiging,
}: {
  klantSlug: string;
  dossier: ServicepuntenDossier;
  checklists: Record<string, Record<string, ServicepuntChecklistItem>>;
  onOpenVestiging: (id: string) => void;
}) {
  const wachtrijVanServer = wachtrij(dossier.vestigingen);
  const draaien = dossier.vestigingen.filter((v) => v.status === "draait");

  const [lijst, setLijst] = useState(wachtrijVanServer);
  const [sleept, setSleept] = useState<string | null>(null);
  const [greep, setGreep] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // De server is de baas: komt er verse data binnen (na opslaan, of na een
  // wijziging elders), dan volgt de lokale lijst die. Dit is de "state
  // bijstellen tijdens renderen"-vorm uit de React-documentatie, niet een
  // effect: een effect zou de oude volgorde eerst nog een keer tekenen.
  const [bron, setBron] = useState(dossier.vestigingen);
  if (bron !== dossier.vestigingen) {
    setBron(dossier.vestigingen);
    setLijst(wachtrijVanServer);
  }

  function opDragOver(id: string) {
    if (!sleept || sleept === id) return;
    setLijst((oud) => {
      const van = oud.findIndex((v) => v.id === sleept);
      const naar = oud.findIndex((v) => v.id === id);
      if (van === -1 || naar === -1 || van === naar) return oud;
      const nieuw = oud.slice();
      const [verplaatst] = nieuw.splice(van, 1);
      nieuw.splice(naar, 0, verplaatst);
      return nieuw;
    });
  }

  function opDrop() {
    if (!sleept) return;
    setSleept(null);
    setGreep(null);
    setFout(null);
    const ids = lijst.map((v) => v.id);
    startTransition(async () => {
      try {
        await servicepuntVolgordeOpslaanAction(klantSlug, ids);
      } catch (err) {
        setLijst(wachtrij(dossier.vestigingen));
        setFout(err instanceof Error ? err.message : "Kon de volgorde niet opslaan.");
      }
    });
  }

  function rij(v: Vestiging, nummer: number | null, sleepbaar: boolean) {
    const cl = checklists[v.id] || {};
    const klaar = ALLE_STAPPEN.filter((s) => cl[s.id]?.afgevinkt).length;
    const totaal = ALLE_STAPPEN.length;
    const pct = totaal ? Math.round((klaar / totaal) * 100) : 0;
    const meta = v.volgordereden || v.opmerking || "";
    const metaKort = meta.length > 90 ? `${meta.slice(0, 90)}…` : meta;
    return (
      <div
        className={`sp-rm-rij${sleept === v.id ? " sp-rm-rij-sleept" : ""}`}
        key={v.id}
        draggable={sleepbaar && greep === v.id}
        onDragStart={() => sleepbaar && setSleept(v.id)}
        onDragOver={(e) => {
          if (!sleepbaar) return;
          e.preventDefault();
          opDragOver(v.id);
        }}
        onDrop={(e) => {
          if (!sleepbaar) return;
          e.preventDefault();
          opDrop();
        }}
        onDragEnd={() => {
          setSleept(null);
          setGreep(null);
        }}
      >
        {sleepbaar ? (
          <span
            className="sp-rm-greep"
            title="Sleep om de volgorde te veranderen"
            onMouseDown={() => setGreep(v.id)}
            onTouchStart={() => setGreep(v.id)}
            onMouseUp={() => setGreep(null)}
          >
            <span className="sp-rm-greepstippen">⠿</span>
            <span className="sp-rm-nr">{nummer}</span>
          </span>
        ) : (
          <span className="sp-rm-greep sp-rm-geengreep">
            <span className="sp-stip sp-stip-draait" />
          </span>
        )}
        <span className="sp-rm-plaats">{v.plaats}</span>
        <span className="sp-rm-status">
          <span className={`sp-stip sp-stip-${v.status}`} />
          {STATUS_LABEL[v.status]}
        </span>
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
  }

  return (
    <div>
      {fout && <p className="foutregel">{fout}</p>}

      <div className="blok kaart" style={{ marginBottom: 14 }}>
        <div className="sp-groepskop" style={{ margin: "16px 18px 0" }}>
          <h4>Aansluiten, in deze volgorde ({lijst.length})</h4>
          <span className="sp-lijn" />
          <span className="sp-rm-hulp">Sleep aan het nummer om te wisselen</span>
        </div>
        {lijst.map((v, i) => rij(v, i + 1, true))}
      </div>

      {draaien.length > 0 && (
        <div className="blok kaart" style={{ marginBottom: 14 }}>
          <div className="sp-groepskop" style={{ margin: "16px 18px 0" }}>
            <h4>Draaien al ({draaien.length})</h4>
            <span className="sp-lijn" />
          </div>
          {draaien.map((v) => rij(v, null, false))}
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
