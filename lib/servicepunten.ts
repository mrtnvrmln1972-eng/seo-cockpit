import "server-only";

import { findFileByName, readFileContent, writeDocument, VersionConflictError, type DriveFileRef } from "./drive";
import {
  parseServicepunten,
  serialiseerServicepunten,
  SERVICEPUNTEN_BESTANDSNAAM,
  type ServicepuntenModel,
} from "./servicepunten-model";

/**
 * lib/servicepunten.ts — server-only Drive-I/O voor servicepunten.md,
 * bovenop het pure datamodel in lib/servicepunten-model.ts (dat GEEN
 * "server-only" heeft, juist omdat de Servicepunten-tab se client
 * components de constanten/types daaruit ook nodig hebben — zie de
 * doc-comment daar).
 *
 * Deze tab bestaat NIET voor elke klant (zie NOC_SLUG in
 * servicepunten-model.ts): hij is 09-09-2026 op Maartens uitdrukkelijke
 * verzoek toegevoegd, specifiek voor Nationaal Oogcentrum, als interactieve
 * opvolger van de losse Claude Artifact "Servicepunten aanhaken"
 * (claude.ai/code/artifact/7c389a05-dcbd-4355-b4a2-6094641ef117). De
 * structuur (statuswaarden, de 15 vaste aansluitstappen in 3 groepen, de
 * velden per vestiging) is 1:1 overgenomen uit die artifact se eigen
 * databron (het `<script type="application/json" id="data">`-blok daarin)
 * — geen nieuwe structuur verzonnen, zie CLAUDE.md/AGENTS.md-regel over
 * eerst de bron raadplegen.
 *
 * Net als de rest van deze app is Drive de enige bron van waarheid: er is
 * geen aparte database voor deze vestigingendata. servicepunten.md leeft in
 * de klantmap van Nationaal Oogcentrum, met één `## <plaatsnaam>`-sectie per
 * vestiging (herkend via lib/markdown.ts's alleSecties(), zelfde conventie
 * als elk ander dossierbestand) en één vaste `## Eenmalig geregeld`-sectie
 * met de vrije tekst over de knopen die maar één keer geregeld hoeven te
 * worden (domeinoverstap, telefonie, vergoeding, etc. — zie de artifact se
 * "Eenmalig geregeld"-tab).
 *
 * Schrijven herbouwt het HELE bestand deterministisch uit het geparste
 * model (net als developer.md op het Developerbord): dit bestand wordt
 * nooit met de hand door Maarten geschreven, dus een vaste, voorspelbare
 * volgorde/opmaak bij elke schrijfactie is hier veiliger dan een
 * regex-patch op de ruwe tekst.
 *
 * Elke los invulveld/vinkje/contactlog-regel is een EIGEN schrijfactie op
 * dit ene bestand (zie app/klant/[klantslug]/servicepunten/actions.ts). Met
 * 21 vestigingen x 15 stappen in hetzelfde bestand is de kans op een
 * version-conflict (spec/CLAUDE.md: optimistic locking in writeDocument())
 * tussen twee snel achter elkaar aangevinkte stapjes van dezelfde gebruiker
 * reëel — daarom leest/muteert/schrijft muteerEnSchrijf() hieronder met een
 * paar automatische retries bij een VersionConflictError (opnieuw lezen,
 * dezelfde mutatie opnieuw toepassen, opnieuw schrijven) in plaats van
 * meteen een foutmelding te tonen bij een simpel dubbelklik-tempo.
 */

export * from "./servicepunten-model";

export interface ServicepuntenDossier extends ServicepuntenModel {
  bestand: DriveFileRef | null;
}

export async function leesServicepunten(klantFolderId: string): Promise<ServicepuntenDossier> {
  const bestand = await findFileByName(klantFolderId, SERVICEPUNTEN_BESTANDSNAAM);
  const md = bestand ? await readFileContent(bestand.id) : "";
  const model = parseServicepunten(md);
  return { bestand, ...model };
}

async function schrijfServicepunten(klantFolderId: string, dossier: ServicepuntenDossier): Promise<void> {
  const nieuweMd = serialiseerServicepunten({
    laatstBijgewerkt: new Date().toISOString().slice(0, 10),
    vestigingen: dossier.vestigingen,
    eenmaligGeregeld: dossier.eenmaligGeregeld,
  });
  await writeDocument({
    folderId: klantFolderId,
    fileName: SERVICEPUNTEN_BESTANDSNAAM,
    content: nieuweMd,
    knownFileId: dossier.bestand?.id ?? null,
    knownModifiedTime: dossier.bestand?.modifiedTime ?? null,
  });
}

/**
 * Leest servicepunten.md, past `muteer` toe op het geparste model en
 * schrijft het geheel terug — met een paar automatische retries als de
 * version gate in writeDocument() een VersionConflictError geeft (zie de
 * doc-comment bovenaan dit bestand: met 21 vestigingen x 15 stappen in één
 * bestand is dat een reëel scenario bij normaal, snel achter elkaar
 * aanvinken, niet alleen bij een echte gelijktijdige bewerking).
 *
 * `muteer` moet de vestiging zelf opzoeken (via het id) in het dossier dat
 * het meekrijgt — niet een eerder opgehaalde referentie hergebruiken — want
 * bij een retry is dat een compleet nieuw, vers gelezen object.
 */
export async function muteerEnSchrijf(
  klantFolderId: string,
  muteer: (dossier: ServicepuntenDossier) => void,
  pogingenOver = 3,
): Promise<void> {
  for (;;) {
    const dossier = await leesServicepunten(klantFolderId);
    muteer(dossier);
    try {
      await schrijfServicepunten(klantFolderId, dossier);
      return;
    } catch (err) {
      if (err instanceof VersionConflictError && pogingenOver > 0) {
        pogingenOver -= 1;
        continue;
      }
      throw err;
    }
  }
}
