"use client";

import { useRef, useState, useTransition } from "react";
import {
  STAP_GROEPEN,
  type BewerkbaarVeld,
  type ServicepuntChecklistItem,
  type Vestiging,
} from "@/lib/servicepunten-model";
import NotitieVeld from "@/app/_components/NotitieVeld";
import { leesLinkCel } from "@/lib/link-cel";
import { renderTekst } from "@/lib/scanbaar";
import {
  servicepuntNaamOpslaanAction,
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

/**
 * De regels in de gegevenslijst, in leesvolgorde. "Beschikbaarheid" stond
 * hier als "Quick scans" (11-09-2026 aangepast op Maartens verzoek: "de
 * beschikbaarheid die ze hebben aangegeven, als aparte regel bij de
 * adresgegevens"). Het is dezelfde regel en hetzelfde veld, het heette
 * alleen niet zo: in servicepunten.md staat de kolom van meet af aan als
 * "Beschikbaarheid quick scans" en er staat ook precies dat in ("Om de week
 * donderdag; geblokkeerd 14:30-18:00"). De kolomnaam in het bestand blijft
 * ongewijzigd, dus geen enkele bestaande waarde verhuist.
 *
 * Hij staat nu direct onder het adres: het is een gegeven over de plek zelf,
 * niet over de persoon die je erover spreekt.
 */
const VELDEN: { key: BewerkbaarVeld; label: string; plaatshouder?: string }[] = [
  { key: "adres", label: "Adres" },
  {
    key: "beschikbaarheid",
    label: "Beschikbaarheid",
    plaatshouder: "Welke dagen en tijden ze hebben aangegeven",
  },
  { key: "contact", label: "Contactpersoon" },
  { key: "optometristen", label: "Optometrist(en)" },
  { key: "telefoon", label: "Telefoon" },
  { key: "email", label: "E-mail" },
  { key: "partner", label: "Partner" },
];

export default function VestigingKaart({
  klantSlug,
  vestiging,
  checklist,
  onStapChange,
  volgordeNr,
  opGreep,
}: {
  klantSlug: string;
  vestiging: Vestiging;
  checklist: Record<string, ServicepuntChecklistItem>;
  onStapChange: (stapId: string, next: ServicepuntChecklistItem) => void;
  /**
   * De plek in de wachtrij zoals hij op dít moment op het scherm staat. Weet
   * het overzicht die (11-09-2026, sinds je hier kunt slepen), dan is die
   * leidend boven het opgeslagen nummer: tijdens het slepen loopt het
   * opgeslagen nummer een tel achter, en twee vestigingen kunnen in het
   * bestand hetzelfde nummer dragen.
   */
  volgordeNr?: number | null;
  /**
   * Begint het slepen. Wordt alleen meegegeven waar slepen mag; zonder deze
   * prop verschijnt er geen greep en verandert er niets.
   */
  opGreep?: (e: React.PointerEvent) => void;
}) {
  const [, startTransition] = useTransition();
  const [veldFout, setVeldFout] = useState<string | null>(null);
  const [openStap, setOpenStap] = useState<string | null>(null);
  /** Welke staplink op dit moment als invoerveld openstaat (11-09-2026). */
  const [bewerktLink, setBewerktLink] = useState<string | null>(null);
  /**
   * De link die je bij een stap hebt geplakt, zoals hij nu op het scherm
   * staat. Los bijgehouden zodat het pijltje ernaast meteen meebeweegt,
   * zonder op de server te wachten.
   */
  const [links, setLinks] = useState<Record<string, string>>({});
  /** Het naamveld, zodat het potlood in de kop er meteen naartoe kan springen. */
  const naamVeld = useRef<HTMLInputElement>(null);
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
    /**
     * Vergelijken op het adres zelf, niet op de hele cel: die staat sinds
     * 11-09-2026 als `[Titel](url)` in het dossier, terwijl het invoerveld
     * het kale adres toont. Zonder dit zou elke keer dat je het veld opent en
     * weer verlaat een schrijfactie naar Drive gaan die niets verandert.
     */
    const bestaand = leesLinkCel(links[stapId] ?? checklist[stapId]?.link ?? "");
    if (nu === bestaand.url) return;
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

  /**
   * De naam van de vestiging. Aparte functie en geen gewoon veld, want het is
   * de kop van de sectie in servicepunten.md; zie de uitleg bij de actie.
   * Faalt het opslaan (bijvoorbeeld omdat een andere vestiging al zo heet),
   * dan komt de oude naam terug te staan: liever zichtbaar terug dan een naam
   * tonen die niet is opgeslagen.
   */
  function opBlurNaam(waarde: string) {
    const naam = waarde.trim();
    if (!naam || naam === vestiging.plaats) {
      if (naamVeld.current) naamVeld.current.value = vestiging.plaats;
      return;
    }
    startTransition(async () => {
      try {
        await servicepuntNaamOpslaanAction(klantSlug, vestiging.id, naam);
        setVeldFout(null);
      } catch (err) {
        if (naamVeld.current) naamVeld.current.value = vestiging.plaats;
        setVeldFout(err instanceof Error ? err.message : "Kon de naam niet opslaan.");
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

  const toonNummer = volgordeNr ?? vestiging.prioriteit;

  return (
    <details className="blok kaart sp-kaart" id={`vest-${vestiging.id}`}>
      <summary className="blokkop">
        {opGreep && (
          <span
            className="sp-kaartgreep"
            title="Sleep om de volgorde te veranderen"
            aria-hidden="true"
            onPointerDown={(e) => opGreep(e)}
            /* Een klik op de greep mag de kaart niet open- of dichtklappen. */
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            ⠿
          </span>
        )}
        <h3>{vestiging.plaats}</h3>
        {/*
          De naam zelf staat als eerste regel in de gegevenslijst, net als elk
          ander veld van deze vestiging. Dit potlood is de weg ernaartoe
          (11-09-2026): het klapt de kaart open en zet de cursor in dat veld.
          Bewust geen invoerveld ín de kop: elke klik daarin zou de kaart
          open- en dichtklappen.
        */}
        <button
          type="button"
          className="sp-naamwijzig"
          title="Naam van deze vestiging aanpassen"
          aria-label="Naam van deze vestiging aanpassen"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const kaart = e.currentTarget.closest("details");
            if (kaart instanceof HTMLDetailsElement) kaart.open = true;
            requestAnimationFrame(() => {
              naamVeld.current?.focus();
              naamVeld.current?.select();
            });
          }}
        >
          ✎
        </button>
        {toonNummer != null && (
          <span className="pill sp-p-prioriteit">#{toonNummer} in volgorde</span>
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
          <li>
            <span className="sp-veldnaam">Naam</span>
            <input
              ref={naamVeld}
              type="text"
              className="sp-veldwaarde"
              defaultValue={vestiging.plaats}
              placeholder="Plaatsnaam"
              onBlur={(e) => opBlurNaam(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  e.currentTarget.value = vestiging.plaats;
                  e.currentTarget.blur();
                }
              }}
            />
          </li>
          {VELDEN.map(({ key, label, plaatshouder }) => (
            <li key={key}>
              <span className="sp-veldnaam">{label}</span>
              <input
                type="text"
                className="sp-veldwaarde"
                defaultValue={vestiging[key]}
                placeholder={plaatshouder ?? "—"}
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
              // De cel bevat een kale url of `[Titel](url)`; zie lib/link-cel.ts.
              const gelezenLink = leesLinkCel(link);
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
                        {gelezenLink.url && bewerktLink !== stap.id ? (
                          /**
                           * Staat er een adres, dan is dat een gewone link
                           * waar je op klikt (11-09-2026). Het stond hier in
                           * een invoerveld: het zág eruit als een link, maar
                           * een klik zette alleen je cursor erin, en het
                           * pijltje ernaast was het enige dat werkte. Wijzigen
                           * kan met het potlood ernaast.
                           */
                          <>
                            <a
                              className="sp-stap-linktekst"
                              href={gelezenLink.url}
                              target="_blank"
                              rel="noreferrer"
                              title={gelezenLink.url}
                            >
                              {gelezenLink.label}
                            </a>
                            <button
                              type="button"
                              className="sp-stap-linkwijzig"
                              onClick={() => setBewerktLink(stap.id)}
                              title="Dit adres aanpassen"
                              aria-label="Dit adres aanpassen"
                            >
                              ✎
                            </button>
                          </>
                        ) : (
                          <input
                            type="url"
                            inputMode="url"
                            autoFocus={bewerktLink === stap.id}
                            defaultValue={gelezenLink.url}
                            placeholder={stap.linkveld.plaatshouder}
                            onBlur={(e) => {
                              setBewerktLink(null);
                              opBlurLink(stap.id, e.target.value);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                              if (e.key === "Escape") setBewerktLink(null);
                            }}
                          />
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
