"use client";

import { useRef, useState, useTransition } from "react";
import {
  STAP_GROEPEN,
  STATUS_LABEL,
  STATUS_PILKLASSE,
  type BewerkbaarVeld,
  type ContactlogRegel,
  type ServicepuntChecklistItem,
  type Vestiging,
} from "@/lib/servicepunten-model";
import { servicepuntVeldOpslaanAction, servicepuntLogToevoegenAction } from "./actions";

/**
 * app/klant/[klantslug]/servicepunten/VestigingKaart.tsx — één vestiging,
 * als uitklapbare kaart (.blok.kaart, zelfde component als de rest van de
 * app). Drie delen: de vaste gegevens (los tekstveld per stuk, opslaan bij
 * onBlur), het aansluitproces (checklist — komt van de ouder aan, zie
 * ServicepuntenView, omdat de voortgang daar ook voor de pillen en de
 * Volgorde-tab nodig is), en het contactlog (puur lokaal aan deze kaart,
 * niets anders op de pagina hoeft dat te weten).
 *
 * Tekstvelden zijn bewust ONGECONTROLEERD (defaultValue + onBlur), zelfde
 * aanpak als de Notities-tab: geen optimistic-sync nodig, en dat voorkomt
 * dat de cursor midden in het typen ergens naartoe springt. Elk veld slaat
 * pas op als de waarde ook echt is gewijzigd (laatsteWaarden-ref), zodat
 * doorheen de velden tabben zonder iets te wijzigen geen onnodige
 * Drive-schrijfactie geeft (zie lib/servicepunten.ts over het risico op
 * schrijfconflicten bij dit ene, gedeelde bestand).
 */

const VELDEN: { key: BewerkbaarVeld; label: string }[] = [
  { key: "adres", label: "Adres" },
  { key: "contact", label: "Contactpersoon en rol" },
  { key: "telefoon", label: "Telefoon" },
  { key: "email", label: "E-mail" },
  { key: "beschikbaarheid", label: "Beschikbaarheid quick scans" },
  { key: "partner", label: "Partner" },
];

export default function VestigingKaart({
  klantSlug,
  vestiging,
  checklist,
  onStapChange,
}: {
  klantSlug: string;
  vestiging: Vestiging;
  checklist: Record<string, ServicepuntChecklistItem>;
  onStapChange: (stapId: string, next: ServicepuntChecklistItem) => void;
}) {
  const [, startTransition] = useTransition();
  const [veldFout, setVeldFout] = useState<string | null>(null);
  const laatsteWaarden = useRef<Record<BewerkbaarVeld, string>>({
    partner: vestiging.partner,
    adres: vestiging.adres,
    contact: vestiging.contact,
    telefoon: vestiging.telefoon,
    email: vestiging.email,
    beschikbaarheid: vestiging.beschikbaarheid,
    opmerking: vestiging.opmerking,
  });

  const [log, setLog] = useState<ContactlogRegel[]>(vestiging.contactlog);
  const [logFout, setLogFout] = useState<string | null>(null);
  const logFormRef = useRef<HTMLFormElement>(null);

  const klaar = STAP_GROEPEN.reduce(
    (n, g) => n + g.stappen.filter((s) => checklist[s.id]?.afgevinkt).length,
    0,
  );
  const totaal = STAP_GROEPEN.reduce((n, g) => n + g.stappen.length, 0);
  const pct = totaal ? Math.round((klaar / totaal) * 100) : 0;

  function opBlurVeld(veld: BewerkbaarVeld, waarde: string) {
    if (waarde === laatsteWaarden.current[veld]) return;
    startTransition(async () => {
      try {
        await servicepuntVeldOpslaanAction(klantSlug, vestiging.id, veld, waarde);
        laatsteWaarden.current[veld] = waarde;
        setVeldFout(null);
      } catch (err) {
        setVeldFout(err instanceof Error ? err.message : "Kon dit veld niet opslaan.");
      }
    });
  }

  const logGesorteerd = log.slice().sort((a, b) => b.datum.localeCompare(a.datum));

  return (
    <details className="blok kaart sp-kaart" id={`vest-${vestiging.id}`}>
      <summary className="blokkop">
        <h3>{vestiging.plaats}</h3>
        <span className={`pill ${STATUS_PILKLASSE[vestiging.status]}`}>{STATUS_LABEL[vestiging.status]}</span>
        {vestiging.prioriteit != null && (
          <span className="pill sp-p-prioriteit">#{vestiging.prioriteit} in volgorde</span>
        )}
        {vestiging.contact && <span className="sp-sum-sub">{vestiging.contact}</span>}
        <span className="sp-voortgang">
          <span className="sp-balk">
            <span className="sp-vul" style={{ width: `${pct}%` }} />
          </span>
          <span className="sp-cijfer">
            {klaar}/{totaal}
          </span>
        </span>
        <span className="chev" />
      </summary>

      <div className="blokbody">
        {vestiging.prioriteit != null && vestiging.volgordereden && (
          <div className="sp-voorstel">
            <span className="sp-lbl">Voorgestelde volgorde &middot; #{vestiging.prioriteit}</span>
            <p>{vestiging.volgordereden}</p>
          </div>
        )}

        <div className="sp-subkop">Gegevens</div>
        <div className="sp-gegevens">
          {VELDEN.map(({ key, label }) => (
            <div className="metaveld" key={key}>
              <label>{label}</label>
              <input
                type="text"
                defaultValue={vestiging[key]}
                onBlur={(e) => opBlurVeld(key, e.target.value)}
              />
            </div>
          ))}
        </div>
        <div className="metaveld">
          <label>Let op</label>
          <textarea
            rows={2}
            defaultValue={vestiging.opmerking}
            placeholder="Bijzonderheden bij deze vestiging, mag leeg blijven"
            onBlur={(e) => opBlurVeld("opmerking", e.target.value)}
          />
        </div>
        {veldFout && <p className="foutregel">{veldFout}</p>}

        <div className="sp-subkop">Aansluitproces</div>
        {STAP_GROEPEN.map((groep) => (
          <div className="sp-checkgroep" key={groep.naam}>
            <div className="sp-checkgroep-lbl">{groep.naam}</div>
            {groep.stappen.map((stap) => {
              const item = checklist[stap.id] || { afgevinkt: false, datum: "" };
              return (
                <div className={`sp-stap${item.afgevinkt ? " sp-stap-af" : ""}`} key={stap.id}>
                  <input
                    type="checkbox"
                    checked={item.afgevinkt}
                    onChange={(e) => onStapChange(stap.id, { afgevinkt: e.target.checked, datum: item.datum })}
                  />
                  <div className="sp-stap-tekst">
                    <span className="sp-stap-label">{stap.label}</span>
                    <span className="sp-stap-crit">{stap.crit}</span>
                  </div>
                  <input
                    type="date"
                    className="sp-stap-datum"
                    value={item.datum}
                    onChange={(e) => onStapChange(stap.id, { afgevinkt: item.afgevinkt, datum: e.target.value })}
                  />
                </div>
              );
            })}
          </div>
        ))}

        <div className="sp-subkop">Contactlog</div>
        <div className="sp-log">
          {logGesorteerd.length === 0 ? (
            <p className="sp-log-leeg">Nog geen contactmomenten gelogd.</p>
          ) : (
            logGesorteerd.map((l, i) => (
              <div className="sp-logrij" key={i}>
                <span className="sp-datum">{l.datum}</span>
                <span className="sp-wie">{l.wie}</span>
                <span className="sp-tekst">{l.tekst}</span>
              </div>
            ))
          )}
        </div>
        <form
          ref={logFormRef}
          className="sp-logform"
          action={(formData: FormData) => {
            const datum = String(formData.get("datum") || "").trim() || new Date().toISOString().slice(0, 10);
            const wie = String(formData.get("wie") || "Maarten").trim() || "Maarten";
            const tekst = String(formData.get("tekst") || "").trim();
            if (!tekst) return;
            setLogFout(null);
            setLog((huidig) => [...huidig, { datum, wie, tekst }]);
            startTransition(async () => {
              try {
                await servicepuntLogToevoegenAction(klantSlug, vestiging.id, formData);
                logFormRef.current?.reset();
              } catch (err) {
                setLog((huidig) => huidig.slice(0, -1));
                setLogFout(err instanceof Error ? err.message : "Kon dit contactmoment niet opslaan.");
              }
            });
          }}
        >
          <input type="date" name="datum" defaultValue={new Date().toISOString().slice(0, 10)} />
          <select name="wie" defaultValue="Maarten">
            <option>Maarten</option>
            <option>Tonny</option>
            <option>Anders</option>
          </select>
          <input type="text" name="tekst" placeholder="Wat is er besproken of gebeurd?" />
          <button className="pillbtn licht" type="submit">
            Toevoegen
          </button>
        </form>
        {logFout && <p className="foutregel">{logFout}</p>}
      </div>
    </details>
  );
}
