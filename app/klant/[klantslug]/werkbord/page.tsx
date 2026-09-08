import { notFound } from "next/navigation";
import { getKlantBySlug } from "@/lib/klanten";
import {
  leesWerklijstDossier,
  parseWerklijst,
  toelichtingVoor,
  type WerklijstTaak,
} from "@/lib/werklijst";
import { leesNotities } from "@/lib/notities";
import { statusClass, renderAlineas } from "@/lib/markdown";
import { maakTaakAction, zetNaarDeveloperbordAction } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Werkbord-tab ("Takenlijst") — de EERSTE tab, spec §3.1/§3.2 (taken() +
 * taakBlok() in de bestaande artifact), maar bewust vereenvoudigd: geen
 * stapblokken/vinklijst/sleepvolgorde (zie de doc-comment in
 * lib/werklijst.ts) en geen JS-modal voor een nieuwe taak — Maartens harde
 * regel is dat een nieuwe taak alleen een titel en optionele notities
 * krijgt, en dat een taak nooit automatisch gegenereerd wordt.
 *
 * Groepering is op de kolom "Stap" uit werklijst.md, in volgorde van eerste
 * voorkomen in de tabel (dus zoals het dossier zelf ordent — geen eigen
 * sortering, "een dashboard mag tonen, nooit oordelen", CLAUDE.md).
 */

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

/** Groepeert taken op stap, in volgorde van eerste voorkomen (niet alfabetisch). */
function groepeerOpStap(taken: WerklijstTaak[]): { stap: string; taken: WerklijstTaak[] }[] {
  const groepen: { stap: string; taken: WerklijstTaak[] }[] = [];
  const index = new Map<string, number>();
  for (const taak of taken) {
    if (!index.has(taak.stap)) {
      index.set(taak.stap, groepen.length);
      groepen.push({ stap: taak.stap, taken: [] });
    }
    groepen[index.get(taak.stap)!].taken.push(taak);
  }
  return groepen;
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
  const groepen = groepeerOpStap(taken);

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

  return (
    <div>
      <details className="blok kaart">
        <summary className="blokkop">
          <h3>Nieuwe taak</h3>
        </summary>
        <div className="blokbody">
          <form action={maakTaakAction.bind(null, klant.slug)}>
            <div className="metaveld">
              <label>Titel</label>
              <input type="text" name="titel" required placeholder="Wat moet er gebeuren?" />
            </div>
            <div className="metaveld">
              <label>Notities (optioneel)</label>
              <textarea name="notities" placeholder="Korte context, mag leeg blijven" />
            </div>
            <button className="pillbtn sterk" type="submit">
              Toevoegen
            </button>
          </form>
        </div>
      </details>

      {taken.length === 0 ? (
        <div className="paneel">
          <p className="placeholder">Nog geen taken in werklijst.md.</p>
        </div>
      ) : (
        groepen.map((groep) => (
          <div className="blok kaart" key={groep.stap}>
            <div className="blokkop">
              <h3>{groep.stap}</h3>
              <span className="c">{groep.taken.length}</span>
            </div>
            <div className="binnenlijst">
              {groep.taken.map((taak) => {
                const toelichting = toelichtingVoor(dossier!.toelichtingMd, taak.n);
                const blokken = toelichtingBlokken(toelichting);
                const status = taak.status.trim();
                const mailBody =
                  toelichting.trim() || `Zie taak ${taak.n} in de klantcockpit.`;
                const mailHref =
                  `mailto:tonny@pingwin.nl` +
                  `?subject=${encodeURIComponent(`Klantcockpit, ${klant.naam}: ${taak.titel}`)}` +
                  `&body=${encodeURIComponent(mailBody)}`;

                return (
                  <details className="binnenrij" key={`${groep.stap}-${taak.n}`}>
                    <summary className="binnenregel">
                      <span className="binnenkop">
                        <span className="tk">
                          #{taak.n} — {taak.titel}
                        </span>
                        <span className="chev2" />
                      </span>
                      <span className="binnenmeta">
                        {status && status.toLowerCase() !== "open" && (
                          <span className={`pill ${statusClass(status)}`}>{status}</span>
                        )}
                      </span>
                    </summary>

                    <div className="binnenbody">
                      {blokken.length === 0 ? (
                        <p>Nog geen toelichting.</p>
                      ) : (
                        blokken.map((blok, bi) => (
                          <div key={bi}>
                            <h6>{blok.label}</h6>
                            {blok.inhoud ? (
                              <div dangerouslySetInnerHTML={{ __html: renderAlineas(blok.inhoud) }} />
                            ) : (
                              <p>—</p>
                            )}
                          </div>
                        ))
                      )}

                      <div className="acties">
                        <form action={zetNaarDeveloperbordAction.bind(null, klant.slug, taak.n)}>
                          <button className="pillbtn sterk" type="submit">
                            Naar developerbord
                          </button>
                        </form>
                        <a className="pillbtn licht" href={mailHref}>
                          Mailen naar Tonny
                        </a>
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          </div>
        ))
      )}

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
