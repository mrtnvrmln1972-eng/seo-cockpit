import "server-only";

import { Readable } from "node:stream";
import { google, type drive_v3 } from "googleapis";

/**
 * lib/drive.ts — server-only Google Drive-client.
 *
 * Architectuurregel (zie CLAUDE.md): Google Drive is en blijft de enige bron
 * van waarheid voor klantdossiers. Er is geen database. Deze module logt in
 * met een Google service-account (GEEN gebruikers-OAuth, geen claude.ai
 * MCP-koppeling — dat kan een losstaande Vercel-app niet) en praat
 * rechtstreeks tegen de Drive API voor dezelfde mapstructuur/bestanden die de
 * bestaande "Pingwin Klantcockpit"-artifact ook gebruikt
 * (klantcockpit_specificatie.md, hoofdstuk 1 en 2).
 *
 * Benodigde omgevingsvariabelen (zie README.md voor de installatiestappen):
 * - GOOGLE_SERVICE_ACCOUNT_KEY: de volledige JSON-sleutel van het
 *   service-account, als één string.
 * - GOOGLE_DRIVE_ROOT_FOLDER_ID: de Drive-map-id van "Pingwin Klanten".
 */

const SCOPES = ["https://www.googleapis.com/auth/drive"];
const FOLDER_MIME = "application/vnd.google-apps.folder";

let cachedClient: drive_v3.Drive | null = null;

function leesServiceAccountSleutel(): Record<string, unknown> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_KEY ontbreekt. Zet de volledige JSON-sleutel van het " +
        "Google service-account als omgevingsvariabele (zie README.md).",
    );
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_KEY bevat geen geldige JSON. Plak de hele sleutel " +
        "als één regel, inclusief de accolades.",
    );
  }
}

/** Geeft een (gecachte) ingelogde Drive-client terug. */
export function getDriveClient(): drive_v3.Drive {
  if (cachedClient) return cachedClient;
  const credentials = leesServiceAccountSleutel();
  const auth = new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
  cachedClient = google.drive({ version: "v3", auth });
  return cachedClient;
}

/** Geeft de Drive-map-id van de root ("Pingwin Klanten") terug. */
export function getRootFolderId(): string {
  const id = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!id) {
    throw new Error(
      "GOOGLE_DRIVE_ROOT_FOLDER_ID ontbreekt. Zet de Drive-map-id van " +
        '"Pingwin Klanten" als omgevingsvariabele (zie README.md).',
    );
  }
  return id;
}

export interface DriveFileRef {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
}

function escapeVoorQuery(waarde: string): string {
  return waarde.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/**
 * Lijst bestanden/mappen binnen een map op, optioneel gefilterd op exacte
 * naam. Mirrors search_files uit de bestaande artifact (spec §1.2).
 */
export async function listFilesInFolder(
  folderId: string,
  opts?: { name?: string; onlyFolders?: boolean; onlyFiles?: boolean },
): Promise<DriveFileRef[]> {
  const drive = getDriveClient();
  let q = `'${escapeVoorQuery(folderId)}' in parents and trashed = false`;
  if (opts?.name) {
    q += ` and name = '${escapeVoorQuery(opts.name)}'`;
  }
  if (opts?.onlyFolders) {
    q += ` and mimeType = '${FOLDER_MIME}'`;
  } else if (opts?.onlyFiles) {
    q += ` and mimeType != '${FOLDER_MIME}'`;
  }

  const bestanden: DriveFileRef[] = [];
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      q,
      fields: "nextPageToken, files(id, name, mimeType, modifiedTime)",
      pageToken,
      pageSize: 1000,
      spaces: "drive",
    });
    for (const f of res.data.files ?? []) {
      if (f.id && f.name && f.mimeType && f.modifiedTime) {
        bestanden.push({
          id: f.id,
          name: f.name,
          mimeType: f.mimeType,
          modifiedTime: f.modifiedTime,
        });
      }
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return bestanden;
}

/** Zoekt een submap met een exacte naam binnen een map. */
export async function findFolderByName(
  parentId: string,
  name: string,
): Promise<DriveFileRef | null> {
  const matches = await listFilesInFolder(parentId, { name, onlyFolders: true });
  return matches[0] ?? null;
}

/** Zoekt een bestand (geen map) met een exacte naam binnen een map. */
export async function findFileByName(
  parentId: string,
  name: string,
): Promise<DriveFileRef | null> {
  const matches = await listFilesInFolder(parentId, { name, onlyFiles: true });
  return matches[0] ?? null;
}

/** Leest de tekstinhoud van één bestand op id. Mirrors read_file_content. */
export async function readFileContent(fileId: string): Promise<string> {
  const drive = getDriveClient();
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "text" },
  );
  return typeof res.data === "string" ? res.data : String(res.data ?? "");
}

/** Haalt id/naam/modifiedTime van één bestand op. Mirrors get_file_metadata. */
export async function getFileMetadata(
  fileId: string,
): Promise<DriveFileRef | null> {
  const drive = getDriveClient();
  try {
    const res = await drive.files.get({
      fileId,
      fields: "id, name, mimeType, modifiedTime",
    });
    const f = res.data;
    if (!f.id || !f.name || !f.mimeType || !f.modifiedTime) return null;
    return {
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      modifiedTime: f.modifiedTime,
    };
  } catch {
    return null;
  }
}

/**
 * Gegooid door writeDocument() wanneer de version gate een conflict
 * signaleert: het bekende bestand is buiten deze sessie om al gewijzigd.
 * Mirrors de foutcode "veranderd" uit de bestaande artifact (spec §4.4),
 * die daar bewust NOOIT automatisch geretryd wordt.
 */
export class VersionConflictError extends Error {
  constructor(message = "veranderd") {
    super(message);
    this.name = "VersionConflictError";
  }
}

export interface WriteDocumentParams {
  /** Drive-map-id waarin het bestand moet komen te staan (de klantmap). */
  folderId: string;
  /** Bestandsnaam, bijv. "werklijst.md". */
  fileName: string;
  /** Nieuwe volledige inhoud van het bestand. */
  content: string;
  /**
   * Het bestands-id zoals de gebruiker/sessie het kende toen het bewerken
   * begon. `null` als dit een compleet nieuw bestand is (er bestond nog
   * niets op deze naam).
   */
  knownFileId: string | null;
  /**
   * De modifiedTime van dat bekende bestand, voor de version gate. Verplicht
   * zodra knownFileId gezet is.
   */
  knownModifiedTime?: string | null;
}

export interface WriteDocumentResult {
  file: DriveFileRef;
  /**
   * true als het oude bestand niet succesvol naar de prullenbak kon
   * (naamcollisie) — moet in de UI zichtbaar gemaakt worden, nooit
   * stilzwijgend genegeerd (spec §4.3/bug-fix §6.10).
   */
  dubbel: boolean;
}

/**
 * Schrijft een dossierbestand weg.
 *
 * GEWIJZIGD 08-09-2026 (productiebug, opgelost): dit gebruikte eerder het
 * create-then-trash-patroon van de bestaande Klantcockpit-artifact
 * (klantcockpit_specificatie.md §4.3) — eerst een NIEUW bestand aanmaken,
 * dan het oude naar de prullenbak. Dat faalde in productie altijd met
 * "Service Accounts do not have storage quota" (Google Drive 403): een
 * service-account heeft, anders dan een ingelogde gebruiker, GEEN eigen
 * opslagruimte om een nieuw bestand in eigendom te nemen — ongeacht welke
 * map het in staat. Zichtbaar voor Maarten als "kon geen taak opslaan" /
 * Minified React error #441 op elke schrijfactie (Klaar melden, nieuwe taak,
 * status wijzigen, enz.).
 *
 * Fix: bij een BEKEND bestand (knownFileId gezet — verreweg het meeste
 * gebruik, elk dossierbestand bestaat al) wordt de inhoud nu in-place
 * overschreven met `drive.files.update({ fileId, media })`. Dat bestand
 * blijft in eigendom van de oorspronkelijke eigenaar (Maarten), dus geen
 * quota-probleem, geen prullenbak-stap, geen dubbelgangers-risico meer.
 * De version gate (optimistic locking, spec §4.4) blijft ongewijzigd vooraf
 * staan: als de modifiedTime van het bekende bestand niet meer klopt, is er
 * buiten deze sessie om al geschreven en wordt hier geweigerd met
 * VersionConflictError.
 *
 * Blijft een echt onopgelost gat: een compleet NIEUW bestand (knownFileId
 * null — bijv. het allereerste developer.md voor een klant die nog nooit
 * een Developerbord-taak had) moet nog steeds via `files.create()`, en dat
 * raakt dezelfde quota-muur. Zonder Google Workspace (Shared Drives/OAuth-
 * delegation) kan een service-account principieel geen eigen bestand
 * aanmaken. Zolang dat niet is opgelost, moet zo'n bestand één keer
 * handmatig (leeg) aangemaakt worden in Drive door Maarten zelf — daarna
 * kan de app het probleemloos bijwerken. De foutmelding hieronder maakt dat
 * expliciet in plaats van de kale Google-fout door te geven.
 */
export async function writeDocument(
  params: WriteDocumentParams,
): Promise<WriteDocumentResult> {
  const { folderId, fileName, content, knownFileId, knownModifiedTime } = params;
  const drive = getDriveClient();

  // Version gate — zie versiePoort() in de bestaande artifact (spec §4.4).
  if (knownFileId) {
    const actueel = await getFileMetadata(knownFileId);
    if (actueel && knownModifiedTime && actueel.modifiedTime !== knownModifiedTime) {
      throw new VersionConflictError();
    }
  }

  if (knownFileId) {
    // Bestaand bestand: inhoud in-place overschrijven, geen nieuw bestand.
    const updateRes = await drive.files.update({
      fileId: knownFileId,
      media: { mimeType: "text/markdown", body: Readable.from([content]) },
      fields: "id, name, mimeType, modifiedTime",
    });
    const bijgewerkt = updateRes.data;
    if (!bijgewerkt.id || !bijgewerkt.name || !bijgewerkt.mimeType || !bijgewerkt.modifiedTime) {
      throw new Error(
        "Bijwerken van het bestand op Drive is mislukt (onvolledige respons).",
      );
    }
    return {
      file: {
        id: bijgewerkt.id,
        name: bijgewerkt.name,
        mimeType: bijgewerkt.mimeType,
        modifiedTime: bijgewerkt.modifiedTime,
      },
      dubbel: false,
    };
  }

  // Compleet nieuw bestand: moet nog via create(), zie doc-comment hierboven.
  let createRes;
  try {
    createRes = await drive.files.create({
      requestBody: { name: fileName, parents: [folderId] },
      media: { mimeType: "text/markdown", body: Readable.from([content]) },
      fields: "id, name, mimeType, modifiedTime",
    });
  } catch (err) {
    const bericht = err instanceof Error ? err.message : String(err);
    if (bericht.includes("storage quota")) {
      throw new Error(
        `Het bestand "${fileName}" bestaat nog niet en kan niet automatisch aangemaakt worden ` +
          "(het service-account heeft geen eigen opslagruimte op Drive). Maak dit bestand één " +
          "keer leeg aan in de klantmap in Drive — daarna kan de app het wel bijwerken.",
      );
    }
    throw err;
  }
  const nieuw = createRes.data;
  if (!nieuw.id || !nieuw.name || !nieuw.mimeType || !nieuw.modifiedTime) {
    throw new Error(
      "Aanmaken van het nieuwe bestand op Drive is mislukt (onvolledige respons).",
    );
  }

  return {
    file: {
      id: nieuw.id,
      name: nieuw.name,
      mimeType: nieuw.mimeType,
      modifiedTime: nieuw.modifiedTime,
    },
    dubbel: false,
  };
}

/**
 * Bepaalt het nieuwste bestand in een submap (bijv. metingen/ of crawls/),
 * gebruikt voor de pseudo-sleutels "meting" en "crawl" uit de bestaande
 * artifact (spec §2.1, nieuwsteUit()). Optioneel gefilterd op
 * bestandsextensie (crawls/ moet alleen .md-bestanden meenemen).
 */
export async function nieuwsteUitSubmap(
  parentId: string,
  submapNaam: string,
  opts?: { extensie?: string },
): Promise<DriveFileRef | null> {
  const submap = await findFolderByName(parentId, submapNaam);
  if (!submap) return null;
  let bestanden = await listFilesInFolder(submap.id, { onlyFiles: true });
  if (opts?.extensie) {
    bestanden = bestanden.filter((b) => b.name.endsWith(opts.extensie!));
  }
  if (bestanden.length === 0) return null;
  return bestanden.reduce((nieuwste, b) =>
    new Date(b.modifiedTime).getTime() > new Date(nieuwste.modifiedTime).getTime()
      ? b
      : nieuwste,
  );
}
