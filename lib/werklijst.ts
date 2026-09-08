import "server-only";

/**
 * lib/werklijst.ts — parser + schrijffuncties voor werklijst.md en
 * toelichting.md, 1:1 geport uit de bestaande "Pingwin Klantcockpit"-artifact
 * (functies taken(), werklijstMetTaak(), werklijstStatus(), werklijstTitel(),
 * toelichtingMetStub(), toelichtingVoor() — klantcockpit_specificatie.md,
 * broncode geraadpleegd 08-09-2026 uit artifact e069f7ca-30e0-4bd9-9353-
 * 2c79fd247df2).
 *
 * Kolommen worden op NAAM herkend (regex op de koptekst), niet op vaste
 * positie — dezelfde aanpak als lib/markdown.ts, en nodig omdat de werklijst
 * van de ene klant een extra kolom (bijv. Week) kan hebben t.o.v. een andere.
 *
 * Bewust NIET geport uit taakBlok() in de artifact: stapblokken (Waarom we dit
 * oppakken/Hoe het er nu voor staat/Wat we doen als vaste gekleurde blokken),
 * vinklijst met pagina-koppeling (Onderdelen/Afronding), sleepvolgorde, en de
 * inline onboarding-voortgangsbalk. Dat is functionaliteit die aanhaakt bij de
 * Roadmap- en Onboarding-tabs (nog niet gebouwd in deze fase) en bij
 * Maartens regel "een nieuwe taak heeft alleen een titel en een
 * notities-veld nodig" past een eenvoudige weergave beter dan die volledige
 * machinerie. toelichting.md wordt hier getoond als gewoon document (zelfde
 * renderer-aanpak als de Signalen-tab-fallback), niet uitgesplitst in vaste
 * gekleurde blokken.
 */

import {
  findFileByName,
  readFileContent,
  writeDocument,
  type DriveFileRef,
} from "./drive";

export interface WerklijstTaak {
  n: number;
  titel: string;
  stap: string;
  status: string;
  datum: string;
  week: string;
}

function splitCells(regel: string): string[] {
  const zonderRand = regel.trim().replace(/^\|/, "").replace(/\|\s*$/, "");
  const cellen: string[] = [];
  let huidig = "";
  for (let i = 0; i < zonderRand.length; i++) {
    const ch = zonderRand[i];
    if (ch === "\\" && zonderRand[i + 1] === "|") {
      huidig += "|";
      i++;
      continue;
    }
    if (ch === "|") {
      cellen.push(huidig.trim());
      huidig = "";
      continue;
    }
    huidig += ch;
  }
  cellen.push(huidig.trim());
  return cellen;
}

interface TabelPositie {
  kopRegel: number;
  scheidingRegel: number;
}

/** Vindt de EERSTE tabel (kop + scheidingsregel) in een markdown-tekst. */
function eersteTabel(regels: string[]): TabelPositie | null {
  let kop = -1;
  for (let i = 0; i < regels.length; i++) {
    if (regels[i].trim().charAt(0) !== "|") continue;
    const cellen = splitCells(regels[i]);
    if (cellen.length > 0 && cellen.every((c) => /^:?-{2,}:?$/.test(c))) {
      if (kop >= 0) return { kopRegel: kop, scheidingRegel: i };
      return null;
    }
    if (kop < 0) kop = i;
  }
  return null;
}

interface KolomIndex {
  n?: number;
  t?: number;
  stap?: number;
  status?: number;
  datum?: number;
  week?: number;
}

function kolomIndex(header: string[]): KolomIndex {
  const kol: KolomIndex = {};
  header.forEach((c, i) => {
    const h = c.toLowerCase().trim();
    if (kol.n === undefined && (h === "#" || /^(nr|nummer)$/.test(h))) kol.n = i;
    if (kol.t === undefined && /taak|omschrijving|actie/.test(h)) kol.t = i;
    if (kol.stap === undefined && /stap|fase|onderdeel|programma/.test(h)) kol.stap = i;
    if (kol.status === undefined && /status/.test(h)) kol.status = i;
    if (kol.datum === undefined && /datum/.test(h)) kol.datum = i;
    if (kol.week === undefined && /week|planning|wanneer/.test(h)) kol.week = i;
  });
  return kol;
}

/** Leest alle taken uit werklijst.md (spec: functie taken() in de artifact). */
export function parseWerklijst(md: string): WerklijstTaak[] {
  const regels = String(md || "").replace(/\r/g, "").split("\n");
  const pos = eersteTabel(regels);
  if (!pos) return [];
  const header = splitCells(regels[pos.kopRegel]);
  const kol = kolomIndex(header);
  const idxN = kol.n ?? 0;
  const idxT = kol.t ?? 1;
  const idxStap = kol.stap ?? 2;
  const idxStatus = kol.status ?? 3;

  const out: WerklijstTaak[] = [];
  for (let j = pos.scheidingRegel + 1; j < regels.length; j++) {
    if (regels[j].trim().charAt(0) !== "|") break;
    const r = splitCells(regels[j]);
    if (!r[idxT]) continue;
    const n = parseInt(r[idxN] ?? "", 10);
    out.push({
      n: isNaN(n) ? 0 : n,
      titel: r[idxT] ?? "",
      stap: (kol.stap !== undefined ? r[kol.stap] : "") || "Overig",
      status: (kol.status !== undefined ? r[idxStatus] : "") || "open",
      datum: (kol.datum !== undefined ? r[kol.datum] : "") || "",
      week: (kol.week !== undefined ? r[kol.week] : "") || "",
    });
  }
  return out;
}

export function nieuweTaakNummer(md: string): number {
  let max = 0;
  for (const t of parseWerklijst(md)) if (t.n > max) max = t.n;
  return max + 1;
}

function vandaagIso(): string {
  const d = new Date();
  const tw = (n: number) => (n < 10 ? "0" : "") + n;
  return `${d.getFullYear()}-${tw(d.getMonth() + 1)}-${tw(d.getDate())}`;
}

/** Voegt een nieuwe taakregel toe aan de eerste tabel in werklijst.md. */
export function werklijstMetTaak(
  md: string,
  n: number,
  tekst: string,
  stap: string,
): string | null {
  const regels = String(md || "").replace(/\r/g, "").split("\n");
  const pos = eersteTabel(regels);
  if (!pos) return null;
  const header = splitCells(regels[pos.kopRegel]).map((c) => c.toLowerCase());
  const cellen = header.map(() => " ");
  const datum = vandaagIso();
  header.forEach((hh, i) => {
    if (hh === "#" || /^(nr|nummer)$/.test(hh)) cellen[i] = ` ${n} `;
    else if (/taak|omschrijving|actie/.test(hh)) cellen[i] = ` ${tekst.replace(/\|/g, "/")} `;
    else if (/stap|fase|onderdeel|programma/.test(hh)) cellen[i] = ` ${stap} `;
    else if (/status/.test(hh)) cellen[i] = " open ";
    else if (/datum/.test(hh)) cellen[i] = ` ${datum} `;
  });
  regels.splice(pos.scheidingRegel + 1, 0, "|" + cellen.join("|") + "|");
  return regels.join("\n");
}

/** Zet de status van taak n om naar een nieuwe waarde. */
export function werklijstStatus(md: string, n: number, waarde: string): string | null {
  const regels = String(md || "").replace(/\r/g, "").split("\n");
  const pos = eersteTabel(regels);
  if (!pos) return null;
  const header = splitCells(regels[pos.kopRegel]).map((c) => c.toLowerCase());
  let kolN = 0;
  let kolS = -1;
  header.forEach((hh, i) => {
    if (hh === "#" || /^(nr|nummer)$/.test(hh)) kolN = i;
    if (kolS < 0 && /status/.test(hh)) kolS = i;
  });
  if (kolS < 0) return null;
  for (let j = pos.scheidingRegel + 1; j < regels.length; j++) {
    if (regels[j].trim().charAt(0) !== "|") break;
    const c = splitCells(regels[j]);
    if (parseInt(c[kolN] ?? "", 10) !== n) continue;
    while (c.length <= kolS) c.push(" ");
    c[kolS] = ` ${waarde} `;
    regels[j] = "|" + c.join("|") + "|";
    return regels.join("\n");
  }
  return null;
}

/**
 * Herschikt de taakregels in werklijst.md naar de gegeven volgorde van
 * taaknummers — 08-09-2026 op Maartens verzoek om taken zelf te kunnen
 * slepen in plaats van dat de weergave-volgorde vastligt aan de "Stap"-
 * kolom (die groepering is dezelfde dag op zijn verzoek juist weer
 * verwijderd uit de Takenlijst-tab, zie de doc-comment in
 * app/klant/[klantslug]/werkbord/page.tsx). Herschrijft alleen de
 * RIJVOLGORDE binnen de tabel, geen enkele celwaarde verandert.
 *
 * Een taaknummer dat niet in volgordeNs voorkomt (zou niet moeten gebeuren
 * — bijv. een race met een taak die net elders is toegevoegd) wordt nooit
 * stilzwijgend laten vallen: die rij wordt achteraan toegevoegd, in de
 * oorspronkelijke volgorde, zodat er nooit een taak zoekraakt door een
 * sleepactie.
 */
export function werklijstHerschikken(md: string, volgordeNs: number[]): string | null {
  const regels = String(md || "").replace(/\r/g, "").split("\n");
  const pos = eersteTabel(regels);
  if (!pos) return null;
  const header = splitCells(regels[pos.kopRegel]).map((c) => c.toLowerCase());
  let kolN = 0;
  header.forEach((hh, i) => {
    if (hh === "#" || /^(nr|nummer)$/.test(hh)) kolN = i;
  });

  const rijStart = pos.scheidingRegel + 1;
  let rijEind = rijStart;
  while (rijEind < regels.length && regels[rijEind].trim().charAt(0) === "|") rijEind++;

  const rijen = regels.slice(rijStart, rijEind);
  const perN = new Map<number, string>();
  for (const rij of rijen) {
    const n = parseInt(splitCells(rij)[kolN] ?? "", 10);
    if (!isNaN(n) && !perN.has(n)) perN.set(n, rij);
  }

  const nieuweRijen: string[] = [];
  const gebruikt = new Set<number>();
  for (const n of volgordeNs) {
    const rij = perN.get(n);
    if (rij !== undefined && !gebruikt.has(n)) {
      nieuweRijen.push(rij);
      gebruikt.add(n);
    }
  }
  for (const rij of rijen) {
    const n = parseInt(splitCells(rij)[kolN] ?? "", 10);
    if (!isNaN(n) && !gebruikt.has(n)) {
      nieuweRijen.push(rij);
      gebruikt.add(n);
    }
  }
  if (nieuweRijen.length !== rijen.length) return null;

  regels.splice(rijStart, rijEind - rijStart, ...nieuweRijen);
  return regels.join("\n");
}

/** Past de titel (kolom Taak) van taak n aan; het nummer blijft gelijk. */
export function werklijstTitel(md: string, n: number, tekst: string): string | null {
  const regels = String(md || "").replace(/\r/g, "").split("\n");
  const pos = eersteTabel(regels);
  if (!pos) return null;
  const header = splitCells(regels[pos.kopRegel]).map((c) => c.toLowerCase());
  let kolN = 0;
  let kolT = -1;
  header.forEach((hh, i) => {
    if (hh === "#" || /^(nr|nummer)$/.test(hh)) kolN = i;
    if (kolT < 0 && /taak|omschrijving|actie/.test(hh)) kolT = i;
  });
  if (kolT < 0) return null;
  for (let j = pos.scheidingRegel + 1; j < regels.length; j++) {
    if (regels[j].trim().charAt(0) !== "|") break;
    const c = splitCells(regels[j]);
    if (parseInt(c[kolN] ?? "", 10) !== n) continue;
    while (c.length <= kolT) c.push(" ");
    c[kolT] = ` ${tekst.replace(/\|/g, "/").replace(/\s+/g, " ").trim()} `;
    regels[j] = "|" + c.join("|") + "|";
    return regels.join("\n");
  }
  return null;
}

/** Haalt de toelichting-tekst onder "## Taak N" uit toelichting.md. */
export function toelichtingVoor(md: string, n: number): string {
  const re = new RegExp(
    `^##\\s*Taak\\s*${n}\\s*$[\\r\\n]+([\\s\\S]*?)(?=^##\\s|$(?![\\s\\S]))`,
    "m",
  );
  const m = String(md || "").match(re);
  return m ? m[1].trim() : "";
}

/** Voegt een lege toelichting-stub toe voor een nieuwe taak n, met notities als "In het kort". */
export function toelichtingMetStub(md: string, n: number, notities: string): string {
  const inhoud = notities.trim();
  const stub = `## Taak ${n}\n**In het kort**\n\n${inhoud ? inhoud + "\n\n" : "\n"}**Klaar als**\n\n`;
  const basis = (typeof md === "string" && md.trim())
    ? md.replace(/\s+$/, "")
    : "# Toelichting per taak\n\nPer taak staat hier in het kort wat er speelt, wanneer hij klaar is en waar het stappenplan staat.";
  return basis + "\n\n" + stub;
}

// ---- Drive-laag: lezen/schrijven van werklijst.md + toelichting.md --------

export interface WerklijstDossier {
  werklijstBestand: DriveFileRef | null;
  toelichtingBestand: DriveFileRef | null;
  werklijstMd: string;
  toelichtingMd: string;
}

export async function leesWerklijstDossier(klantFolderId: string): Promise<WerklijstDossier> {
  const [werk, uitleg] = await Promise.all([
    findFileByName(klantFolderId, "werklijst.md"),
    findFileByName(klantFolderId, "toelichting.md"),
  ]);
  const [werklijstMd, toelichtingMd] = await Promise.all([
    werk ? readFileContent(werk.id) : Promise.resolve(""),
    uitleg ? readFileContent(uitleg.id) : Promise.resolve(""),
  ]);
  return { werklijstBestand: werk, toelichtingBestand: uitleg, werklijstMd, toelichtingMd };
}

/**
 * Voegt een nieuwe taak toe: eerst de regel in werklijst.md, dan de stub in
 * toelichting.md — zelfde volgorde als taakToevoegen() in de artifact. Lukt
 * de werklijst wel en de toelichting niet, dan staat de taak er gewoon (met
 * uitlegOk:false teruggegeven), precies zoals de artifact dat ook meldt.
 */
export async function taakToevoegen(
  klantFolderId: string,
  dossier: WerklijstDossier,
  titel: string,
  notities: string,
  stap: string,
): Promise<{ n: number; uitlegOk: boolean }> {
  const n = nieuweTaakNummer(dossier.werklijstMd);
  const nieuweWerklijst = werklijstMetTaak(dossier.werklijstMd, n, titel, stap);
  if (!nieuweWerklijst) {
    throw new Error(
      "In werklijst.md staat geen tabel met taken, dus er kan geen regel bij.",
    );
  }
  await writeDocument({
    folderId: klantFolderId,
    fileName: "werklijst.md",
    content: nieuweWerklijst,
    knownFileId: dossier.werklijstBestand?.id ?? null,
    knownModifiedTime: dossier.werklijstBestand?.modifiedTime ?? null,
  });

  const nieuweToelichting = toelichtingMetStub(dossier.toelichtingMd, n, notities);
  try {
    await writeDocument({
      folderId: klantFolderId,
      fileName: "toelichting.md",
      content: nieuweToelichting,
      knownFileId: dossier.toelichtingBestand?.id ?? null,
      knownModifiedTime: dossier.toelichtingBestand?.modifiedTime ?? null,
    });
    return { n, uitlegOk: true };
  } catch {
    return { n, uitlegOk: false };
  }
}

export async function taakStatusOpslaan(
  klantFolderId: string,
  dossier: WerklijstDossier,
  n: number,
  waarde: string,
): Promise<void> {
  const nieuw = werklijstStatus(dossier.werklijstMd, n, waarde);
  if (!nieuw) throw new Error("Kon de status van deze taak niet in werklijst.md vinden.");
  await writeDocument({
    folderId: klantFolderId,
    fileName: "werklijst.md",
    content: nieuw,
    knownFileId: dossier.werklijstBestand?.id ?? null,
    knownModifiedTime: dossier.werklijstBestand?.modifiedTime ?? null,
  });
}
