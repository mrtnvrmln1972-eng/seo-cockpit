import "server-only";

import {
  findFileByName,
  readFileContent,
  writeDocument,
  type DriveFileRef,
} from "./drive";

/**
 * lib/mail.ts — lezen/schrijven van mail-log.md, het nieuwe dossierbestand
 * voor het mailoverzicht (Maartens verzoek 08-09-2026: "een overzichtje...
 * waarin de e-mails terug te vinden zijn... in een tijdslijn", eerst als
 * default-dichte toggle onder de Takenlijst).
 *
 * Zelfde aanpak als lib/notities.ts: één los dossierbestand, gelezen via
 * findFileByName + readFileContent, geschreven via het create-then-trash-
 * patroon van writeDocument(). Anders dan notities.md is mail-log.md WEL een
 * vaste structuur (per klant met de hand samengesteld uit e-mailthreads,
 * zie hieronder) omdat de UI per thread moet kunnen tonen: onderwerp,
 * berichten in tijdsvolgorde, geëxtraheerde punten en een status (bij
 * Pingwin/bij klant/afgerond) — dat kan niet uit vrije tekst.
 *
 * BELANGRIJK — vertrouwelijkheid (zie CLAUDE.md/VERTROUWELIJKHEIDSREGEL):
 * threads worden per klant ingedeeld op INHOUD (welk bedrijf/domein de mail
 * behandelt), nooit op basis van afzender/contactpersoon alleen. Bij
 * Kamsteeg Tuinen bijvoorbeeld horen de contacten Sander Kamsteeg, Helma en
 * Sander van XL Creations (de sitebouwer) ook bij een andere Pingwin-klant
 * (Strandtuin) — eenzelfde mailwisseling kan dus over een andere klant gaan.
 * Een sessie die mail-log.md vult (handmatig of via een toekomstige
 * geplande sync) moet elke thread op inhoud beoordelen voordat hij in het
 * dossier van een specifieke klant terechtkomt.
 *
 * Format van mail-log.md (nieuwste thread bovenaan):
 *
 *   # Mailoverzicht
 *
 *   ## <Onderwerp van de e-mailthread>
 *   - Laatste bericht: DD-MM-JJJJ
 *   - Van: Pingwin|Klant
 *   - Status: bij klant|bij Pingwin|afgerond
 *
 *   **Berichten**
 *   - DD-MM-JJJJ · Pingwin: <samenvatting van het bericht>
 *   - DD-MM-JJJJ · Klant: <samenvatting van het bericht>
 *
 *   **Punten**
 *   - [gemeld] <tekst>
 *   - [gevraagd] <tekst>
 *   - [opgemerkt] <tekst>
 *
 * "Punten" is optioneel (een thread zonder losse punten toont alleen de
 * berichten). Status staat per thread, niet per punt — dat is genoeg voor
 * "ligt de bal bij ons of bij de klant" zoals Maarten vroeg.
 */

export type MailStatus = "bij klant" | "bij Pingwin" | "afgerond";
export type MailPuntType = "gemeld" | "gevraagd" | "opgemerkt";
export type MailAfzender = "Pingwin" | "Klant";

export interface MailBericht {
  datum: string;
  van: MailAfzender;
  tekst: string;
}

export interface MailPunt {
  type: MailPuntType;
  tekst: string;
}

export interface MailThread {
  onderwerp: string;
  laatsteBericht: string;
  van: MailAfzender;
  status: MailStatus;
  berichten: MailBericht[];
  punten: MailPunt[];
}

export interface MailLogBestand {
  bestand: DriveFileRef | null;
  md: string;
}

export async function leesMailLog(klantFolderId: string): Promise<MailLogBestand> {
  const bestand = await findFileByName(klantFolderId, "mail-log.md");
  const md = bestand ? await readFileContent(bestand.id) : "";
  return { bestand, md };
}

export async function mailLogOpslaan(
  klantFolderId: string,
  huidig: MailLogBestand,
  nieuweMd: string,
): Promise<void> {
  await writeDocument({
    folderId: klantFolderId,
    fileName: "mail-log.md",
    content: nieuweMd,
    knownFileId: huidig.bestand?.id ?? null,
    knownModifiedTime: huidig.bestand?.modifiedTime ?? null,
  });
}

function parseAfzender(ruw: string): MailAfzender {
  return ruw.trim().toLowerCase().startsWith("klant") ? "Klant" : "Pingwin";
}

function parseStatus(ruw: string): MailStatus {
  const key = ruw.trim().toLowerCase();
  if (key === "afgerond") return "afgerond";
  if (key === "bij pingwin") return "bij Pingwin";
  return "bij klant";
}

const PUNT_TYPES: MailPuntType[] = ["gemeld", "gevraagd", "opgemerkt"];

/**
 * Parseert mail-log.md tot een lijst threads, in de volgorde waarin ze in
 * het bestand staan (nieuwste bovenaan, want zo wordt het bestand
 * geschreven — geen eigen sortering/oordeel hier, spec-regel "toont, nooit
 * oordeelt").
 */
export function parseMailLog(md: string): MailThread[] {
  const tekst = String(md || "").replace(/\r/g, "");
  const regels = tekst.split("\n");

  const threads: MailThread[] = [];
  let huidig: MailThread | null = null;
  let sectie: "meta" | "berichten" | "punten" | null = null;

  const metaRegex = /^-\s*(Laatste bericht|Van|Status)\s*:\s*(.+)$/i;
  const berichtRegex = /^-\s*([0-9]{2}-[0-9]{2}-[0-9]{4})\s*·\s*(Pingwin|Klant)\s*:\s*(.+)$/i;
  const puntRegex = /^-\s*\[(gemeld|gevraagd|opgemerkt)\]\s*(.+)$/i;

  for (const regel of regels) {
    const kop = /^##\s+(.+?)\s*$/.exec(regel);
    if (kop) {
      huidig = {
        onderwerp: kop[1].trim(),
        laatsteBericht: "",
        van: "Pingwin",
        status: "bij klant",
        berichten: [],
        punten: [],
      };
      threads.push(huidig);
      sectie = "meta";
      continue;
    }
    if (!huidig) continue;

    if (/^\*\*Berichten\*\*\s*$/i.test(regel.trim())) {
      sectie = "berichten";
      continue;
    }
    if (/^\*\*Punten\*\*\s*$/i.test(regel.trim())) {
      sectie = "punten";
      continue;
    }

    if (sectie === "meta") {
      const m = metaRegex.exec(regel.trim());
      if (m) {
        const [, veld, waarde] = m;
        if (/laatste bericht/i.test(veld)) huidig.laatsteBericht = waarde.trim();
        else if (/^van$/i.test(veld)) huidig.van = parseAfzender(waarde);
        else if (/^status$/i.test(veld)) huidig.status = parseStatus(waarde);
      }
    } else if (sectie === "berichten") {
      const b = berichtRegex.exec(regel.trim());
      if (b) {
        const [, datum, van, tekstVeld] = b;
        huidig.berichten.push({ datum, van: van as MailAfzender, tekst: tekstVeld.trim() });
      }
    } else if (sectie === "punten") {
      const p = puntRegex.exec(regel.trim());
      if (p) {
        const [, type, tekstVeld] = p;
        huidig.punten.push({ type: type.toLowerCase() as MailPuntType, tekst: tekstVeld.trim() });
      }
    }
  }

  return threads;
}

/** Zet een lijst threads terug om naar de mail-log.md-tekstvorm (schrijfkant). */
export function renderMailLog(threads: MailThread[]): string {
  const delen = ["# Mailoverzicht", ""];
  for (const t of threads) {
    delen.push(`## ${t.onderwerp}`);
    delen.push(`- Laatste bericht: ${t.laatsteBericht}`);
    delen.push(`- Van: ${t.van}`);
    delen.push(`- Status: ${t.status}`);
    delen.push("");
    delen.push("**Berichten**");
    for (const b of t.berichten) {
      delen.push(`- ${b.datum} · ${b.van}: ${b.tekst}`);
    }
    if (t.punten.length > 0) {
      delen.push("");
      delen.push("**Punten**");
      for (const p of t.punten) {
        delen.push(`- [${p.type}] ${p.tekst}`);
      }
    }
    delen.push("");
  }
  return delen.join("\n").trim() + "\n";
}

export { PUNT_TYPES };
