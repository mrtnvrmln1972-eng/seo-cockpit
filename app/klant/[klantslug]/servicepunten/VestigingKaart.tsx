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
import NotitieVeld from "@/app/_components/NotitieVeld";
import { renderTekst } from "@/lib/scanbaar";
import {
  servicepuntVeldOpslaanAction,
  servicepuntLogToevoegenAction,
  servicepuntStapNotitieOpslaanAction,
} from "./actions";

/**
 * app/klant/[klantslug]/servicepunten/VestigingKaart.tsx — één vestiging,
 * als uitklapbare kaart.
 *
 * HERZIEN 09-09-2026, op Maartens verzoek: het was een ruim opgezet
 * invulformulier met een raster van zeven labels en zeven invoervakken. Nu:
 *
 * - De gegevens staan als een compacte lijst onder elkaar, "Adres · waarde".
 *   Je kunt ze nog steeds gewoon aanpassen (klik erin, hij slaat op zodra je
 *   het veld verlaat), maar het leest als een lijstje, niet als een formulier.
 * - Elke stap van het aansluitproces is een vinkje, een titel en een
 *   uitklapper met vrije tekst erachter: waar het nu staat, met de link naar
 *   wat er is aangemaakt (Google-bedrijfsprofiel, SEO-landingspagina,
 *   Ads-pagina). Staat er iets in, dan zie je die stand meteen onder de titel,
 *   zonder uit te klappen.
 * - Die tekst is gewone markdown in servicepunten.md (een "#### <stap>"-blok),
 *   dus een Cowork-gesprek kan hem net zo goed vullen of aanvullen als dit
 *   scherm. Hetzelfde geldt voor "Let op" bij de vestiging.
 *
 * Tekstvelden zijn bewust ONGECONTROLEERD (defaultValue + onBlur), zelfde
 * aanpak als de Notities-tab: dat voorkomt dat de cursor midden in het typen
 * ergens naartoe springt. Elk veld slaat pas op als de waarde ook echt is
 * gewijzigd (laatsteWaarden-ref), zodat door de velden tabben zonder iets te
 * wijzigen geen onnodige Drive-schrijfactie geeft (zie lib/servicepunten.ts
 * over het risico op schrijfconflicten bij dit ene, gedeelde bestand).
 */

const VELDEN: { key: BewerkbaarVeld; label: string }[] = [
  { key: "adres", label: "Adres" },
  { key: "contact", label: "Contactpersoon" },
  { key: "telefoon", label: "Telefoon" },
  { key: "email", label: "E-mail" },
  { key: "beschikbaarheid", label: "Quick scans" },
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
  const [openStap, setOpenStap] = useState<string | null>(null);
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

        <ul className="sp-gegevenslijst">
          {VELDEN.map(({ key, label }) => (
            <li key={key}>
              <span className="sp-veldnaam">{label}</span>
              <input
                type="text"
                className="sp-veldwaarde"
                defaultValue={vestiging[key]}
                placeholder="—"
                onBlur={(e) => opBlurVeld(key, e.target.value)}
              />
            </li>
          ))}
        </ul>
        {veldFout && <p className="foutregel">{veldFout}</p>}

        <details className="sp-letop">
          <summary>
            <span className="chev2" />
            <span className="sp-letop-lbl">Let op</span>
            {vestiging.opmerking.trim() ? (
              <span className="sp-letop-kort">{eersteRegel(vestiging.opmerking)}</span>
            ) : (
              <span className="sp-letop-leeg">nog niets</span>
            )}
          </summary>
          <NotitieVeld
            naam={`letop-${vestiging.id}`}
            waarde={vestiging.opmerking}
            plaatshouder="Bijzonderheden bij deze vestiging"
            opslaan={(tekst) => servicepuntVeldOpslaanAction(klantSlug, vestiging.id, "opmerking", tekst)}
          />
        </details>

        <div className="sp-subkop">Aansluitproces</div>
        {STAP_GROEPEN.map((groep) => (
          <div className="sp-checkgroep" key={groep.naam}>
            <div className="sp-checkgroep-lbl">{groep.naam}</div>
            {groep.stappen.map((stap) => {
              const item = checklist[stap.id] || { afgevinkt: false, datum: "", notitie: "" };
              const open = openStap === stap.id;
              return (
                <div className={`sp-stap${item.afgevinkt ? " sp-stap-af" : ""}`} key={stap.id}>
                  <div className="sp-stap-regel">
                    <input
                      type="checkbox"
                      checked={item.afgevinkt}
                      onChange={(e) => onStapChange(stap.id, { ...item, afgevinkt: e.target.checked })}
                    />
                    <button
                      type="button"
                      className="sp-stap-knop"
                      aria-expanded={open}
                      onClick={() => setOpenStap(open ? null : stap.id)}
                    >
                      <span className={`chev2${open ? " chev2-open" : ""}`} />
                      <span className="sp-stap-label">{stap.label}</span>
                    </button>
                    <input
                      type="date"
                      className="sp-stap-datum"
                      value={item.datum}
                      onChange={(e) => onStapChange(stap.id, { ...item, datum: e.target.value })}
                    />
                  </div>
                  {!open && item.notitie.trim() && (
                    <div
                      className="doc sp-stap-stand"
                      dangerouslySetInnerHTML={{ __html: renderTekst(item.notitie) }}
                    />
                  )}
                  {open && (
                    <div className="sp-stap-open">
                      <p className="sp-stap-crit">{stap.crit}</p>
                      <NotitieVeld
                        naam={`stap-${vestiging.id}-${stap.id}`}
                        waarde={item.notitie}
                        plaatshouder="Waar staat dit nu? Zet hier de link naartoe."
                        minHoogte={90}
                        opslaan={(tekst) =>
                          servicepuntStapNotitieOpslaanAction(klantSlug, vestiging.id, stap.id, tekst)
                        }
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        <details className="sp-letop">
          <summary>
            <span className="chev2" />
            <span className="sp-letop-lbl">Contactlog</span>
            <span className="sp-letop-leeg">
              {logGesorteerd.length === 0 ? "nog niets" : `${logGesorteerd.length} regels`}
            </span>
          </summary>
          <div className="sp-log">
            {logGesorteerd.map((l, i) => (
              <div className="sp-logrij" key={i}>
                <span className="sp-datum">{l.datum}</span>
                <span className="sp-wie">{l.wie}</span>
                <span className="sp-tekst">{l.tekst}</span>
              </div>
            ))}
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
        </details>
      </div>
    </details>
  );
}

/** De eerste regel van een stuk tekst, voor het samenvattingsregeltje. */
function eersteRegel(tekst: string): string {
  const regel = tekst
    .split("\n")
    .map((r) => r.replace(/^[-*]\s+/, "").replace(/[*_`#]/g, "").trim())
    .find((r) => r !== "");
  if (!regel) return "";
  return regel.length > 80 ? `${regel.slice(0, 80)}…` : regel;
}
