import { notFound } from "next/navigation";
import { getKlantBySlug } from "@/lib/klanten";
import { leesWerklijstDossier, parseWerklijst, toelichtingVoor } from "@/lib/werklijst";
import { leesNotities } from "@/lib/notities";
import { leesMailLog, parseMailLog, type MailStatus } from "@/lib/mail";
import { renderAlineas, statusClass } from "@/lib/markdown";
import NieuweTaakForm from "./NieuweTaakForm";
import TakenlijstItems, { type TaakItem } from "./TakenlijstItems";

export const dynamic = "force-dynamic";

/**
 * Werkbord-tab ("Takenlijst") — de EERSTE tab, spec §3.1/§3.2 (taken() +
 * taakBlok() in de bestaande artifact), maar bewust vereenvoudigd: geen
 * vinklijst en geen JS-modal voor een nieuwe taak — Maartens harde regel is
 * dat een nieuwe taak alleen een titel en optionele notities krijgt, en dat
 * een taak nooit automatisch gegenereerd wordt.
 *
 * Geen groepering per "Stap" meer (was: 1. Onboarding / 2. .../ 3. Techniek
 * etc.) — op Maartens verzoek 08-09-2026 verwijderd: dat onderscheid komt
 * niet overal even zinnig terug (elke klant heeft z'n eigen stap-varianten
 * in werklijst.md) en voegde in de UI niets toe. De "Stap"-kolom zelf blijft
 * gewoon in werklijst.md staan (nog steeds een verplicht veld bij het
 * aanmaken van een taak, zie maakTaakAction in actions.ts) — dit is puur een
 * weergavewijziging, geen datamodelwijziging. In plaats van groepering is er
 * nu één platte, sleepbare lijst (TakenlijstItems.tsx) in de volgorde van
 * werklijst.md zelf — sorteren is dus aan Maarten, niet aan het dashboard
 * ("een dashboard mag tonen, nooit oordelen", CLAUDE.md).
 */

/**
 * De vaste kleur bij een van de drie standaard toelichting-labels. Komt uit
 * het label zelf, dus een taak die deze labels niet gebruikt houdt gewoon een
 * ongekleurd blok; er wordt hier niets afgeleid of geraden.
 */
function kleurVoorLabel(label: string): "roze" | "blauw" | "groen" | undefined {
  switch (label.trim().toLowerCase()) {
    case "waarom we dit oppakken":
      return "roze";
    case "hoe het er nu voor staat":
      return "blauw";
    case "wat we doen":
      return "groen";
    default:
      return undefined;
  }
}

/** Eén label-blok uit toelichting.md: "**Label**" op een eigen regel, gevolgd door de rest. */
interface ToelichtingBlok {
  label: string;
  inhoud: string;
}

/**
 * Splitst de toelichting-tekst van één taak (vorm: "**In het kort**\n\n
 * <tekst>\n\n**Klaar als**\n\n<tekst>", en vaak ook "**Onderdelen**" met
 * een vinkjeslijst: "- [ ] 1a ...") op de vetgedrukte labelregels. Een regel
 * telt alleen als label als hij, getrimd, EXACT "**Label**" (met evt. ":"
 * erachter) is — geen ##-koppen, geen inline-vet middenin tekst. De inhoud
 * per blok wordt met renderAlineas() gerenderd (lijsten/vinkjes + alinea's).
 */
function toelichtingBlokken(tekst: string): ToelichtingBlok[] {
  const regels = String(tekst || "").replace(/\r/g, "").split("\n");
  const blokken: { label: string; inhoud: string[] }[] = [];
  let huidig: { label: string; inhoud: string[] } | null = null;
  const labelRegex = /^\*\*(.+?)\*\*:?\s*$/;

  for (const regel of regels) {
    const match = labelRegex.exec(regel.trim());
    if (match) {
      huidig = { label: match[1].trim(), inhoud: [] };
      blokken.push(huidig);
      continue;
    }
    if (huidig) huidig.inhoud.push(regel);
  }

  return blokken.map((b) => ({ label: b.label, inhoud: b.inhoud.join("\n").trim() }));
}

/**
 * Mail-status ("bij klant"/"bij Pingwin"/"afgerond") hergebruikt de
 * bestaande pill-kleuren uit lib/markdown.ts (statusClass) — "bij Pingwin"
 * heeft daar geen eigen waarde, dat krijgt de kleur van "bezig" (oranje: bij
 * ons, actie nodig), de andere twee bestaan al letterlijk zo in de
 * werklijst-statussen.
 */
function mailStatusClass(status: MailStatus): string {
  if (status === "bij Pingwin") return statusClass("bezig");
  return statusClass(status);
}

export default async function WerkbordPagina({
  params,
}: {
  params: Promise<{ klantslug: string }>;
}) {
  const { klantslug } = await params;
  const klant = await getKlantBySlug(klantslug);
  if (!klant) notFound();

  if (!klant.mapId) {
    return (
      <div className="paneel">
        <p className="placeholder">Deze klant heeft nog geen dossier in Drive.</p>
      </div>
    );
  }

  let dossier: Awaited<ReturnType<typeof leesWerklijstDossier>> | null = null;
  let foutmelding: string | null = null;
  try {
    dossier = await leesWerklijstDossier(klant.mapId);
  } catch (err) {
    foutmelding =
      err instanceof Error ? err.message : "Onbekende fout bij het laden van werklijst.md.";
  }

  if (foutmelding) {
    return (
      <div className="foutbanner">
        Kan werklijst.md niet laden.
        <br />
        {foutmelding}
      </div>
    );
  }

  const taken = parseWerklijst(dossier!.werklijstMd);

  // Platte lijst voor TakenlijstItems (client component, i.v.m. slepen) —
  // toelichting alvast gesplitst in labelblokken en gerenderd tot HTML op de
  // server, zodat het client component zelf geen markdown-logica hoeft te
  // kennen.
  const items: TaakItem[] = taken.map((taak) => {
    const toelichting = toelichtingVoor(dossier!.toelichtingMd, taak.n);
    const blokken = toelichtingBlokken(toelichting).map((b) => ({
      label: b.label,
      html: b.inhoud ? renderAlineas(b.inhoud) : "",
      kleur: kleurVoorLabel(b.label),
    }));
    const mailBody = toelichting.trim() || `Zie taak ${taak.n} in de klantcockpit.`;
    const mailHref =
      `mailto:tonny@pingwin.nl` +
      `?subject=${encodeURIComponent(`Klantcockpit, ${klant.naam}: ${taak.titel}`)}` +
      `&body=${encodeURIComponent(mailBody)}`;
    return {
      n: taak.n,
      titel: taak.titel,
      status: taak.status.trim(),
      blokken,
      mailHref,
      toelichtingRuw: toelichting,
    };
  });

  // Notities is een los bestand (lib/notities.ts) en staat hier los van de
  // taken-versiepoort — net als naslagBlok() in de artifact, dat dezelfde
  // notities.md-inhoud toont als de eigen Notities-tab, maar dan dichtgeklapt
  // onderaan de Takenlijst. Een leesfout hier blokkeert de rest van de
  // Takenlijst niet: de kaart valt gewoon terug op "geen notities".
  let notitiesMd = "";
  try {
    notitiesMd = (await leesNotities(klant.mapId)).md;
  } catch {
    // stil: de Notities-tab zelf toont een echte foutmelding als het lezen mislukt
  }

  // Mailoverzicht (mail-log.md) — zelfde aanpak als notities.md hierboven:
  // los bestand, een leesfout blokkeert de rest van de Takenlijst niet.
  //
  // Drie gevallen die op het scherm uit elkaar gehouden worden (09-09-2026):
  // er is nog helemaal geen bestand, er is wel een bestand maar er staan geen
  // threads in (bijvoorbeeld omdat er in deze periode geen mailcontact was, en
  // dan staat de reden in de vrije tekst bovenaan het bestand), of er zijn
  // threads. Eerder liepen die eerste twee samen in één regel, en dan lijkt een
  // bewust leeg dossier op een kapot scherm.
  let mailThreads: Awaited<ReturnType<typeof parseMailLog>> = [];
  let mailBestandBestaat = false;
  let mailInleiding = "";
  try {
    const mailLog = await leesMailLog(klant.mapId);
    mailBestandBestaat = mailLog.bestand !== null;
    mailThreads = parseMailLog(mailLog.md);
    // De vrije tekst boven de eerste "## "-kop: bedoeld voor een uitleg waarom
    // er (nog) niets in staat. De "# Mailoverzicht"-kop zelf laten we weg.
    mailInleiding = mailLog.md
      .split(/^##\s/m)[0]
      .replace(/^#\s*Mailoverzicht\s*$/m, "")
      .trim();
  } catch {
    // stil: zie hierboven
  }

  return (
    <div>
      <details className="blok kaart">
        <summary className="blokkop">
          <h3>Nieuwe taak</h3>
        </summary>
        <div className="blokbody">
          <NieuweTaakForm klantSlug={klant.slug} />
        </div>
      </details>

      {taken.length === 0 ? (
        <div className="paneel">
          <p className="placeholder">Nog geen taken in werklijst.md.</p>
        </div>
      ) : (
        <TakenlijstItems klantSlug={klant.slug} items={items} />
      )}

      <details className="blok kaart">
        <summary className="blokkop">
          <h3>Mailoverzicht</h3>
          <span className="c">{mailThreads.length}</span>
        </summary>
        <div className="blokbody">
          {mailThreads.length === 0 ? (
            !mailBestandBestaat ? (
              <p className="mailLeeg">
                Er is nog geen mailoverzicht aangelegd voor {klant.naam}.
              </p>
            ) : mailInleiding ? (
              <div className="doc" dangerouslySetInnerHTML={{ __html: renderAlineas(mailInleiding) }} />
            ) : (
              <p className="mailLeeg">Het mailoverzicht van {klant.naam} is nog leeg.</p>
            )
          ) : (
            <div className="binnenlijst">
              {mailThreads.map((thread, ti) => (
                <details className="binnenrij" key={ti}>
                  <summary className="binnenregel">
                    <span className="binnenkop">
                      <span className="tk">{thread.onderwerp}</span>
                      <span className="chev2" />
                    </span>
                    <span className="binnenmeta">
                      <span className={`pill ${mailStatusClass(thread.status)}`}>
                        {thread.status}
                      </span>
                    </span>
                  </summary>
                  <div className="binnenbody">
                    <div className="mailtijdlijn">
                      {thread.berichten.map((b, bi) => (
                        <div
                          key={bi}
                          className={"mailbericht" + (b.van === "Klant" ? " vanKlant" : "")}
                        >
                          <span className="mailberichtDatum">
                            {b.datum} · {b.van}
                          </span>
                          <span className="mailberichtTekst">{b.tekst}</span>
                        </div>
                      ))}
                    </div>
                    {thread.punten.length > 0 && (
                      <details>
                        <summary>Punten</summary>
                        <div className="mailpunten">
                          {thread.punten.map((p, pi) => (
                            <div className="mailpunt" key={pi}>
                              <span className="mailpuntType">{p.type}</span>
                              <span>{p.tekst}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      </details>

      <details className="blok kaart">
        <summary className="blokkop">
          <h3>Notities</h3>
        </summary>
        <div className="blokbody">
          {notitiesMd.trim() ? (
            <div className="doc" dangerouslySetInnerHTML={{ __html: renderAlineas(notitiesMd) }} />
          ) : (
            <p className="note">Nog geen notities voor {klant.naam}.</p>
          )}
          <div className="acties">
            <a className="pillbtn licht" href={`/klant/${klant.slug}/notities`}>
              Openen op de Notities-tab
            </a>
          </div>
        </div>
      </details>
    </div>
  );
}
