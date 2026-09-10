"use client";

import { useRef, useState, useTransition } from "react";
import {
  STAP_GROEPEN,
  type BewerkbaarVeld,
  type ServicepuntChecklistItem,
  type Vestiging,
} from "@/lib/servicepunten-model";
import NotitieVeld from "@/app/_components/NotitieVeld";
import { renderTekst } from "@/lib/scanbaar";
import {
  servicepuntVeldOpslaanAction,
  servicepuntStapNotitieOpslaanAction,
  servicepuntStapLinkOpslaanAction,
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
 * De status staat niet meer op de regel zelf: de kaart waar de vestiging in
 * staat draagt die kop al ("Draaien", "Bevestigd tot januari"), en hem er per
 * regel bij zetten maakte de lijst onrustig (10-09-2026).
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
  { key: "optometristen", label: "Optometrist(en)" },
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
  /**
   * De link die je bij een stap hebt geplakt, zoals hij nu op het scherm
   * staat. Los bijgehouden zodat het pijltje ernaast meteen meebeweegt,
   * zonder op de server te wachten.
   */
  const [links, setLinks] = useState<Record<string, string>>({});
  const laatsteWaarden = useRef<Record<BewerkbaarVeld, string>>({
    partner: vestiging.partner,
    adres: vestiging.adres,
    contact: vestiging.contact,
    optometristen: vestiging.optometristen,
    telefoon: vestiging.telefoon,
    email: vestiging.email,
    beschikbaarheid: vestiging.beschikbaarheid,
    opmerking: vestiging.opmerking,
  });

  const klaar = STAP_GROEPEN.reduce(
    (n, g) => n + g.stappen.filter((s) => checklist[s.id]?.afgevinkt).length,
    0,
  );
  const totaal = STAP_GROEPEN.reduce((n, g) => n + g.stappen.length, 0);
  const pct = totaal ? Math.round((klaar / totaal) * 100) : 0;

  function opBlurLink(stapId: string, waarde: string) {
    const nu = waarde.trim();
    if (nu === (links[stapId] ?? checklist[stapId]?.link ?? "")) return;
    setLinks((oud) => ({ ...oud, [stapId]: nu }));
    startTransition(async () => {
      try {
        await servicepuntStapLinkOpslaanAction(klantSlug, vestiging.id, stapId, nu);
        setVeldFout(null);
      } catch (err) {
        setVeldFout(err instanceof Error ? err.message : "Kon deze link niet opslaan.");
      }
    });
  }

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

  return (
    <details className="blok kaart sp-kaart" id={`vest-${vestiging.id}`}>
      <summary className="blokkop">
        <h3>{vestiging.plaats}</h3>
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
              const item = checklist[stap.id] || { afgevinkt: false, datum: "", notitie: "", link: "" };
              const open = openStap === stap.id;
              const link = links[stap.id] ?? item.link;
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
                    {stap.linkveld && (
                      <span className="sp-stap-linkveld">
                        <input
                          type="url"
                          inputMode="url"
                          defaultValue={item.link}
                          placeholder={stap.linkveld.plaatshouder}
                          onBlur={(e) => opBlurLink(stap.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                          }}
                        />
                        {link && (
                          <a
                            href={link}
                            target="_blank"
                            rel="noreferrer"
                            title="Deze pagina openen"
                            aria-label="Deze pagina openen"
                          >
                            ↗
                          </a>
                        )}
                      </span>
                    )}
                    {item.datum && <span className="sp-stap-datumtekst">{kortDatum(item.datum)}</span>}
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
                      <label className="sp-stap-datumveld">
                        Datum
                        <input
                          type="date"
                          value={item.datum}
                          onChange={(e) => onStapChange(stap.id, { ...item, datum: e.target.value })}
                        />
                      </label>
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

      </div>
    </details>
  );
}

/** "2026-09-06" wordt "6 sep": kort genoeg om achter een stap te passen. */
function kortDatum(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso;
  const maanden = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  return `${Number(m[3])} ${maanden[Number(m[2]) - 1] ?? m[2]}`;
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
