import { getKlantBySlug } from "@/lib/klanten";
import { renderTekst } from "@/lib/scanbaar";

import {
  NOC_SLUG,
  STAP_GROEPEN,
  STATUS_LABEL,
  STATUS_PILKLASSE,
  STATUS_VOLGORDE,
  leesServicepunten,
  voortgang,
  type ServicepuntenDossier,
  type Vestiging,
} from "@/lib/servicepunten";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Servicepunten — Nationaal Oogcentrum",
  robots: { index: false, follow: false },
};

/**
 * De deelbare servicepuntenpagina van Nationaal Oogcentrum.
 *
 * Het lange, willekeurige stuk in de route-naam IS de toegangsbeveiliging
 * ("alleen-zij-link"), precies zoals bij het Developerbord: wie de URL niet
 * kent, komt er niet. Deze route staat daarom in DEELPADEN in lib/toegang.ts,
 * zodat hij ook open blijft als de rest van de cockpit achter het wachtwoord
 * zit — en zodat app/layout.tsx de klantenlijst hier helemaal niet rendert,
 * en er dus geen andere klantnamen in de broncode van deze pagina staan.
 *
 * ALLEEN LEZEN, bewust (09-09-2026, keuze van Maarten): dit is dezelfde
 * inhoud als het Servicepunten-tabblad, maar zonder invulvelden, vinkjes of
 * contactlog-formulier. Wie deze link doorstuurt, geeft daarmee dus geen
 * schrijfrecht op het Drive-dossier weg. Het bewerken gebeurt in de cockpit
 * zelf, op /klant/nationaal-oogcentrum/servicepunten.
 *
 * De Volgorde-weergave uit het tabblad zit hier niet apart in: de #N-badge
 * en de reden staan al op de kaart van elke vestiging zelf.
 */
export default async function GedeeldeServicepuntenPagina() {
  const klant = await getKlantBySlug(NOC_SLUG);

  if (!klant?.mapId) {
    return (
      <div data-bord-secret className="paneel">
        <p className="placeholder">Het dossier van Nationaal Oogcentrum is nu niet bereikbaar.</p>
      </div>
    );
  }

  let dossier: ServicepuntenDossier | null = null;
  let foutmelding: string | null = null;
  try {
    dossier = await leesServicepunten(klant.mapId);
  } catch (err) {
    foutmelding = err instanceof Error ? err.message : "Onbekende fout bij het laden van servicepunten.md.";
  }

  if (foutmelding || !dossier) {
    return (
      <div data-bord-secret className="foutbanner">
        Kan de servicepunten nu niet laden.
        <br />
        {foutmelding}
      </div>
    );
  }

  if (!dossier.bestand && dossier.vestigingen.length === 0) {
    return (
      <div data-bord-secret className="paneel">
        <p className="placeholder">Er staan nog geen servicepunten in het dossier.</p>
      </div>
    );
  }

  const tellingen = { draait: 0, bevestigd: 0, kandidaat: 0, uitzoeken: 0 };
  let klaarTotaal = 0;
  let stappenTotaal = 0;
  for (const v of dossier.vestigingen) {
    tellingen[v.status]++;
    const { klaar, totaal } = voortgang(v);
    klaarTotaal += klaar;
    stappenTotaal += totaal;
  }
  const pctTotaal = stappenTotaal ? Math.round((klaarTotaal / stappenTotaal) * 100) : 0;

  const gegroepeerd = STATUS_VOLGORDE.map((status) => ({
    status,
    vestigingen: dossier.vestigingen
      .filter((v) => v.status === status)
      .slice()
      .sort((a, b) => (a.prioriteit ?? 999) - (b.prioriteit ?? 999)),
  })).filter((g) => g.vestigingen.length > 0);

  return (
    <div data-bord-secret className="sp-compact">
      <div className="deelkop">
        <h1>Servicepunten</h1>
        <p>
          Nationaal Oogcentrum · het aansluitproces per vestiging. Deze pagina toont de stand van
          zaken en is niet te bewerken.
        </p>
      </div>

      <div className="sp-pillen">
        <span className={`pill ${STATUS_PILKLASSE.draait}`}>{tellingen.draait} draaien</span>
        <span className={`pill ${STATUS_PILKLASSE.bevestigd}`}>
          {tellingen.bevestigd} bevestigd tot januari
        </span>
        <span className={`pill ${STATUS_PILKLASSE.kandidaat}`}>
          {tellingen.kandidaat + tellingen.uitzoeken} nog uit te zoeken
        </span>
        <span className="pill p-open">{pctTotaal}% van alle stappen gezet</span>
      </div>

      {gegroepeerd.map(({ status, vestigingen }) => (
        <div key={status}>
          <div className="sp-groepskop">
            <h4>{STATUS_LABEL[status]}</h4>
            <span className="sp-lijn" />
          </div>
          <div className="sp-kaarten">
            {vestigingen.map((v) => (
              <VestigingLezen key={v.id} vestiging={v} />
            ))}
          </div>
        </div>
      ))}

      {dossier.eenmaligGeregeld.trim() && (
        <>
          <div className="sp-groepskop">
            <h4>Eenmalig geregeld</h4>
            <span className="sp-lijn" />
          </div>
          <div className="blok kaart">
            <div className="blokbody">
              <div
                className="doc"
                dangerouslySetInnerHTML={{ __html: renderTekst(dossier.eenmaligGeregeld) }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

type TekstVeld = "adres" | "contact" | "telefoon" | "email" | "beschikbaarheid" | "partner";

const VELDEN: { key: TekstVeld; label: string }[] = [
  { key: "adres", label: "Adres" },
  { key: "contact", label: "Contactpersoon en rol" },
  { key: "telefoon", label: "Telefoon" },
  { key: "email", label: "E-mail" },
  { key: "beschikbaarheid", label: "Beschikbaarheid quick scans" },
  { key: "partner", label: "Partner" },
];

/** Eén vestiging, dezelfde kaart als in het tabblad maar zonder invulvelden. */
function VestigingLezen({ vestiging }: { vestiging: Vestiging }) {
  const { klaar, totaal } = voortgang(vestiging);
  const pct = totaal ? Math.round((klaar / totaal) * 100) : 0;
  const gevuld = VELDEN.filter(({ key }) => (vestiging[key] ?? "").trim());
  const log = vestiging.contactlog.slice().sort((a, b) => b.datum.localeCompare(a.datum));

  return (
    <details className="blok kaart sp-kaart">
      <summary className="blokkop">
        <h3>{vestiging.plaats}</h3>
        <span className={`pill ${STATUS_PILKLASSE[vestiging.status]}`}>
          {STATUS_LABEL[vestiging.status]}
        </span>
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

        {gevuld.length > 0 && (
          <>
            <div className="sp-subkop">Gegevens</div>
            <dl className="sp-lees-gegevens">
              {gevuld.map(({ key, label }) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>{vestiging[key]}</dd>
                </div>
              ))}
            </dl>
          </>
        )}

        {vestiging.opmerking.trim() && (
          <>
            <div className="sp-subkop">Let op</div>
            {/* "Let op" is sinds 09-09-2026 vrije markdown (opsomming, links),
                dus hier ook gerenderd in plaats van als platte regel getoond. */}
            <div
              className="doc sp-opmerking"
              dangerouslySetInnerHTML={{ __html: renderTekst(vestiging.opmerking) }}
            />
          </>
        )}

        <div className="sp-subkop">Aansluitproces</div>
        {STAP_GROEPEN.map((groep) => (
          <div className="sp-checkgroep" key={groep.naam}>
            <div className="sp-checkgroep-lbl">{groep.naam}</div>
            {groep.stappen.map((stap) => {
              const item = vestiging.checklist[stap.id] || { afgevinkt: false, datum: "" };
              return (
                <div className={`sp-stap${item.afgevinkt ? " sp-stap-af" : ""}`} key={stap.id}>
                  <span className="sp-lees-vink" aria-hidden="true">
                    {item.afgevinkt ? "✓" : "○"}
                  </span>
                  <div className="sp-stap-tekst">
                    <span className="sp-stap-label">{stap.label}</span>
                    <span className="sp-stap-crit">{stap.crit}</span>
                  </div>
                  <span className="sp-lees-datum">{item.datum}</span>
                </div>
              );
            })}
          </div>
        ))}

        <div className="sp-subkop">Contactlog</div>
        <div className="sp-log">
          {log.length === 0 ? (
            <p className="sp-log-leeg">Nog geen contactmomenten gelogd.</p>
          ) : (
            log.map((l, i) => (
              <div className="sp-logrij" key={i}>
                <span className="sp-datum">{l.datum}</span>
                <span className="sp-wie">{l.wie}</span>
                <span className="sp-tekst">{l.tekst}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </details>
  );
}
