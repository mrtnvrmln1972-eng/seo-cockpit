import "server-only";

/**
 * lib/developerboard.ts — developer.md per klant (Drive, create-then-trash +
 * version gate, zelfde patroon als lib/werklijst.ts) plus een aggregatie over
 * ALLE klantmappen heen voor het Developerbord.
 *
 * Afwijking t.o.v. de bestaande artifact, bewust en expliciet met Maarten
 * afgestemd (08-09-2026): in de artifact is "het Developerbord" een LOSSE,
 * los van Drive staande Claude Artifact met zijn eigen, handmatig bijgehouden
 * JSON-taken-lijst — Maarten kopieerde een doorgezette taak zelf over vanuit
 * developer.md naar die artifact. Hier is er geen tweede databron: dit
 * Developerbord leest developer.md rechtstreeks uit ALLE klantmappen samen,
 * dus "doorzetten" (schrijven naar developer.md) is meteen zichtbaar op het
 * bord, zonder handmatig overtypen. developer.md zelf blijft, net als in de
 * artifact, gewoon een dossierbestand van de klant.
 *
 * Bewust niet geport: de per-stap "## Titel"-detailblokken die
 * naarDeveloperStap() in de artifact onder de tabel zet wanneer je een
 * losse stap uit een stappenplan doorzet. Deze fase zet een hele taak in
 * één keer door (matching taakOpdracht/naarDeveloper), met de toelichting
 * als context — geen granulaire per-stap-doorzet. Kan later alsnog.
 */

import {
  findFileByName,
  writeDocument,
  type DriveFileRef,
} from "./drive";
import { readFileContent } from "./drive";
import { getKlantGroepen, type Klant } from "./klanten";
import { toelichtingVoor } from "./werklijst";

export const SJABLOON_DEVELOPER =
  "# Doorgezet naar de developer\n\n" +
  "| # | Taak | Opmerking | Pagina | Stappenplan | Tijdsduur | Terugkoppeling | Status | Doorgezet op |\n" +
  "|---|---|---|---|---|---|---|---|---|\n";

export interface DevTaak {
  n: number;
  klantNaam: string;
  klantSlug: string;
  titel: string;
  opmerking: string;
  pagina: string;
  werkorder: string;
  /** Door de developer ingevuld bij "Klaar melden" — verplicht, vrije tekst (bijv. "45 min"). */
  tijdsduur: string;
  /** Door de developer ingevuld bij "Klaar melden" — optioneel, terugkoppeling voor Maarten. */
  terugkoppeling: string;
  status: string;
  doorgezetOp: string;
  /** Volledige context uit het `## <titel>`-blok onder de tabel, indien aanwezig. */
  detail: string;
}

/** Vindt alle `## Kop`-blokken (titel + inhoud) onder de taaktabel. */
function detailBlokken(md: string): { titel: string; inhoud: string }[] {
  const tekst = String(md || "").replace(/\r/g, "");
  const out: { titel: string; inhoud: string }[] = [];
  const re = /^##[ \t]+(.+?)[ \t]*$/gm;
  const koppen: { titel: string; start: number; kopStart: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(tekst))) {
    koppen.push({ titel: m[1].trim(), start: m.index + m[0].length, kopStart: m.index });
  }
  koppen.forEach((k, i) => {
    const eind = i + 1 < koppen.length ? koppen[i + 1].kopStart : tekst.length;
    out.push({ titel: k.titel, inhoud: tekst.slice(k.start, eind).trim() });
  });
  return out;
}

function normTitel(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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

/**
 * Vindt de eerste tabel VOOR de eerste `##`-kop (spec: developerMetRegel()
 * in de artifact negeert tabellen die in de uitlegblokken onder de kop
 * staan, want dat zijn geen taakregels).
 */
function eersteTabelVoorKop(regels: string[]): { kopRegel: number; scheidingRegel: number } | null {
  let grens = regels.length;
  for (let g = 0; g < regels.length; g++) {
    if (/^##\s/.test(regels[g])) {
      grens = g;
      break;
    }
  }
  let kop = -1;
  let laatsteRegel = -1;
  for (let i = 0; i < grens; i++) {
    if (regels[i].trim().charAt(0) === "|") {
      if (kop < 0) kop = i;
      laatsteRegel = i;
    }
  }
  if (kop < 0) return null;
  // De tweede tabelregel (index kop+1) is de scheidingsregel als het een
  // geldige tabel is; we hebben hier alleen de kopregel-index nodig, de
  // rijen worden hierna gewoon vanaf kop+2 gelezen (scheidingsregel wordt
  // overgeslagen op basis van het `---`-patroon).
  return { kopRegel: kop, scheidingRegel: kop + 1 };
}

interface KolomIndex {
  n?: number;
  titel?: number;
  opmerking?: number;
  pagina?: number;
  werkorder?: number;
  tijdsduur?: number;
  terugkoppeling?: number;
  status?: number;
  datum?: number;
}

function kolomIndex(header: string[]): KolomIndex {
  const kol: KolomIndex = {};
  header.forEach((c, i) => {
    const h = c.toLowerCase().trim();
    if (kol.n === undefined && (h === "#" || /^(nr|nummer)$/.test(h))) kol.n = i;
    if (kol.titel === undefined && /taak|omschrijving|actie/.test(h)) kol.titel = i;
    if (kol.opmerking === undefined && /opmerking|notitie|toelichting/.test(h)) kol.opmerking = i;
    if (kol.pagina === undefined && /pagina|url/.test(h)) kol.pagina = i;
    if (kol.werkorder === undefined && /werkorder|stappenplan|artifact|bord/.test(h)) kol.werkorder = i;
    if (kol.tijdsduur === undefined && /tijdsduur/.test(h)) kol.tijdsduur = i;
    if (kol.terugkoppeling === undefined && /terugkoppeling/.test(h)) kol.terugkoppeling = i;
    if (kol.status === undefined && /status/.test(h)) kol.status = i;
    if (kol.datum === undefined && /datum|doorgezet/.test(h)) kol.datum = i;
  });
  return kol;
}

/**
 * Migratie-helper voor bestaande developer.md-bestanden die nog geen
 * Tijdsduur/Terugkoppeling-kolom hebben (elk klantbestand dat al vóór
 * 08-09-2026 is aangemaakt). Voegt de kolom, indien afwezig, toe aan het
 * EIND van de kop-, scheidings- en elke databregel — kolomvolgorde is
 * verder irrelevant, kolomIndex() matcht op naam, niet op positie.
 * Idempotent: bestaat de kolom al, dan gebeurt er niets.
 */
function voegKolomToe(regel: string, waarde: string): string {
  return regel.replace(/\|\s*$/, "") + `| ${waarde} |`;
}

function zorgKolomBestaat(
  regels: string[],
  kopRegel: number,
  scheidingRegel: number,
  naam: string,
  matcher: RegExp,
): void {
  const header = splitCells(regels[kopRegel]);
  if (header.some((c) => matcher.test(c.toLowerCase()))) return;
  regels[kopRegel] = voegKolomToe(regels[kopRegel], naam);
  regels[scheidingRegel] = voegKolomToe(regels[scheidingRegel], "---");
  for (let j = scheidingRegel + 1; j < regels.length; j++) {
    if (regels[j] === undefined || regels[j].trim().charAt(0) !== "|") break;
    regels[j] = voegKolomToe(regels[j], "");
  }
}

/** Leest alle taken uit één developer.md, getagd met klantnaam/slug. */
export function parseDeveloperMd(md: string, klantNaam: string, klantSlug: string): DevTaak[] {
  const regels = String(md || "").replace(/\r/g, "").split("\n");
  const pos = eersteTabelVoorKop(regels);
  if (!pos) return [];
  const header = splitCells(regels[pos.kopRegel]);
  const kol = kolomIndex(header);
  const idxN = kol.n ?? 0;
  const idxTitel = kol.titel ?? 1;
  const blokken = detailBlokken(md);

  const out: DevTaak[] = [];
  for (let j = pos.scheidingRegel + 1; j < regels.length; j++) {
    const regel = regels[j];
    if (regel === undefined || regel.trim().charAt(0) !== "|") break;
    const r = splitCells(regel);
    if (!r[idxTitel]) continue;
    const n = parseInt(r[idxN] ?? "", 10);
    const titel = r[idxTitel] ?? "";
    const blok = blokken.find((b) => normTitel(b.titel) === normTitel(titel));
    out.push({
      n: isNaN(n) ? 0 : n,
      klantNaam,
      klantSlug,
      titel,
      opmerking: (kol.opmerking !== undefined ? r[kol.opmerking] : "") || "",
      pagina: (kol.pagina !== undefined ? r[kol.pagina] : "") || "",
      werkorder: (kol.werkorder !== undefined ? r[kol.werkorder] : "") || "",
      tijdsduur: (kol.tijdsduur !== undefined ? r[kol.tijdsduur] : "") || "",
      terugkoppeling: (kol.terugkoppeling !== undefined ? r[kol.terugkoppeling] : "") || "",
      status: (kol.status !== undefined ? r[kol.status] : "") || "open",
      doorgezetOp: (kol.datum !== undefined ? r[kol.datum] : "") || "",
      detail: blok?.inhoud ?? "",
    });
  }
  return out;
}

function vandaagIso(): string {
  const d = new Date();
  const tw = (n: number) => (n < 10 ? "0" : "") + n;
  return `${d.getFullYear()}-${tw(d.getMonth() + 1)}-${tw(d.getDate())}`;
}

function schoon(x: string): string {
  return String(x || "").replace(/\|/g, "/").replace(/\s+/g, " ").trim();
}

/**
 * Voegt een taak toe aan developer.md (of maakt de tabel aan als het
 * bestand nog niet bestaat/leeg is). 1:1 geport uit developerMetRegel().
 */
export function developerMetRegel(
  md: string,
  taakN: number,
  titel: string,
  opmerking: string,
  pagina: string,
  werkorder: string,
  detail?: string,
): string {
  const regels = String(md || "").replace(/\r/g, "").split("\n");
  let grens = regels.length;
  for (let g = 0; g < regels.length; g++) {
    if (/^##\s/.test(regels[g])) {
      grens = g;
      break;
    }
  }
  let kop = -1;
  let laatste = -1;
  for (let i = 0; i < grens; i++) {
    if (regels[i].trim().charAt(0) === "|") {
      if (kop < 0) kop = i;
      laatste = i;
    }
  }
  let uit: string;
  if (kop < 0) {
    regels.splice(
      grens,
      0,
      "| # | Taak | Opmerking | Pagina | Werkorder | Tijdsduur | Terugkoppeling | Status | Doorgezet op |",
      "|---|---|---|---|---|---|---|---|---|",
      `| ${taakN} | ${schoon(titel)} | ${schoon(opmerking)} | ${schoon(pagina)} | ${schoon(werkorder)} |  |  | open | ${vandaagIso()} |`,
      "",
    );
    uit = regels.join("\n");
  } else {
    const header = splitCells(regels[kop]).map((c) => c.toLowerCase());
    const cellen = header.map((hh) => {
      if (hh === "#" || /^(nr|nummer)$/.test(hh)) return ` ${taakN} `;
      if (/werkorder|stappenplan|artifact|bord/.test(hh)) return ` ${schoon(werkorder)} `;
      if (/taak|omschrijving|actie/.test(hh)) return ` ${schoon(titel)} `;
      if (/opmerking|notitie|toelichting/.test(hh)) return ` ${schoon(opmerking)} `;
      if (/pagina|url/.test(hh)) return ` ${schoon(pagina)} `;
      if (/tijdsduur/.test(hh)) return " ";
      if (/terugkoppeling/.test(hh)) return " ";
      if (/status/.test(hh)) return " open ";
      if (/datum|doorgezet/.test(hh)) return ` ${vandaagIso()} `;
      return " ";
    });
    regels.splice(laatste + 1, 0, "|" + cellen.join("|") + "|");
    uit = regels.join("\n");
  }
  // De volledige context (toelichting) staat, net als bij een doorgezette
  // stap in de artifact, als eigen ## blok onder de tabel — een tabelcel kan
  // geen alinea's bevatten, en juist dat heeft de developer nodig.
  if (detail && detail.trim() && !detailBlokken(uit).some((b) => normTitel(b.titel) === normTitel(titel))) {
    uit = uit.replace(/\s+$/, "") + "\n\n## " + titel.trim() + "\n\n" + detail.trim() + "\n";
  }
  return uit;
}

/** Zet de status van taak n in developer.md om (bijv. open -> klaar). */
export function developerStatus(md: string, n: number, waarde: string): string | null {
  const regels = String(md || "").replace(/\r/g, "").split("\n");
  const pos = eersteTabelVoorKop(regels);
  if (!pos) return null;
  const header = splitCells(regels[pos.kopRegel]).map((c) => c.toLowerCase());
  const kol = kolomIndex(splitCells(regels[pos.kopRegel]));
  const idxN = kol.n ?? 0;
  let kolS = -1;
  header.forEach((hh, i) => {
    if (kolS < 0 && /status/.test(hh)) kolS = i;
  });
  if (kolS < 0) return null;
  for (let j = pos.scheidingRegel + 1; j < regels.length; j++) {
    if (regels[j].trim().charAt(0) !== "|") break;
    const c = splitCells(regels[j]);
    if (parseInt(c[idxN] ?? "", 10) !== n) continue;
    while (c.length <= kolS) c.push(" ");
    c[kolS] = ` ${waarde} `;
    regels[j] = "|" + c.join("|") + "|";
    return regels.join("\n");
  }
  return null;
}

/**
 * De developer meldt taak n klaar: verplichte tijdsduur + optionele
 * terugkoppeling gaan de tabel in, status wordt "klaar" (= wacht op
 * beoordeling door Maarten, zie developerStatus() hierboven voor de
 * vervolgstap "afgerond"/"open"). Migreert oudere developer.md-bestanden
 * zonder Tijdsduur/Terugkoppeling-kolom automatisch (zorgKolomBestaat()).
 */
export function developerKlaarMelden(
  md: string,
  n: number,
  tijdsduur: string,
  terugkoppeling: string,
): string | null {
  const regels = String(md || "").replace(/\r/g, "").split("\n");
  const pos = eersteTabelVoorKop(regels);
  if (!pos) return null;
  zorgKolomBestaat(regels, pos.kopRegel, pos.scheidingRegel, "Tijdsduur", /tijdsduur/);
  zorgKolomBestaat(regels, pos.kopRegel, pos.scheidingRegel, "Terugkoppeling", /terugkoppeling/);
  const kol = kolomIndex(splitCells(regels[pos.kopRegel]));
  const idxN = kol.n ?? 0;
  if (kol.status === undefined || kol.tijdsduur === undefined || kol.terugkoppeling === undefined) {
    return null;
  }
  const laatsteKolom = Math.max(kol.status, kol.tijdsduur, kol.terugkoppeling);
  for (let j = pos.scheidingRegel + 1; j < regels.length; j++) {
    if (regels[j].trim().charAt(0) !== "|") break;
    const c = splitCells(regels[j]);
    if (parseInt(c[idxN] ?? "", 10) !== n) continue;
    while (c.length <= laatsteKolom) c.push(" ");
    c[kol.status] = " klaar ";
    c[kol.tijdsduur] = ` ${schoon(tijdsduur)} `;
    c[kol.terugkoppeling] = ` ${schoon(terugkoppeling)} `;
    regels[j] = "|" + c.join("|") + "|";
    return regels.join("\n");
  }
  return null;
}

/**
 * Vervangt (of verwijdert, of maakt) het `## <titel>`-detailblok van een
 * taak. Gedeeld door developerTaakBewerken() (titel kan wijzigen, dus de kop
 * moet mee hernoemen) en developerTaakVerwijderen() (nieuweInhoud "" ->
 * blok weg). Werkt op de ruwe tekst, niet op de regel-array van de tabel,
 * want een blok kan meerdere regels beslaan.
 */
function vervangDetailBlok(
  md: string,
  oudeTitel: string,
  nieuweTitel: string,
  nieuweInhoud: string,
): string {
  const tekst = String(md || "").replace(/\r/g, "");
  const re = /^##[ \t]+(.+?)[ \t]*$/gm;
  const koppen: { titel: string; kopStart: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(tekst))) {
    koppen.push({ titel: m[1].trim(), kopStart: m.index });
  }
  const idx = koppen.findIndex((k) => normTitel(k.titel) === normTitel(oudeTitel));

  if (idx < 0) {
    if (!nieuweInhoud.trim()) return tekst;
    return tekst.replace(/\s+$/, "") + "\n\n## " + nieuweTitel.trim() + "\n\n" + nieuweInhoud.trim() + "\n";
  }

  const blokStart = koppen[idx].kopStart;
  const blokEind = idx + 1 < koppen.length ? koppen[idx + 1].kopStart : tekst.length;

  if (!nieuweInhoud.trim()) {
    return (tekst.slice(0, blokStart) + tekst.slice(blokEind)).replace(/\n{3,}/g, "\n\n");
  }

  const nieuwBlok = "## " + nieuweTitel.trim() + "\n\n" + nieuweInhoud.trim() + "\n";
  return tekst.slice(0, blokStart) + nieuwBlok + tekst.slice(blokEind);
}

/**
 * De taak zelf bewerken (titel, opmerking, pagina, volledige context) —
 * Maarten wil taken kunnen aanpassen zonder ze opnieuw te hoeven doorzetten.
 * Wijzigt titel ook in het bijbehorende `## <titel>`-detailblok mee, anders
 * raakt de koppeling tussen tabelrij en blok los (die loopt op naam, zie
 * detailBlokken()).
 */
export function developerTaakBewerken(
  md: string,
  n: number,
  titel: string,
  opmerking: string,
  pagina: string,
  detail: string,
): string | null {
  const regels = String(md || "").replace(/\r/g, "").split("\n");
  const pos = eersteTabelVoorKop(regels);
  if (!pos) return null;
  const kol = kolomIndex(splitCells(regels[pos.kopRegel]));
  const idxN = kol.n ?? 0;
  const idxTitel = kol.titel ?? 1;

  for (let j = pos.scheidingRegel + 1; j < regels.length; j++) {
    if (regels[j] === undefined || regels[j].trim().charAt(0) !== "|") break;
    const c = splitCells(regels[j]);
    if (parseInt(c[idxN] ?? "", 10) !== n) continue;
    const oudeTitel = c[idxTitel] ?? "";
    while (c.length <= idxTitel) c.push(" ");
    c[idxTitel] = ` ${schoon(titel)} `;
    if (kol.opmerking !== undefined) {
      while (c.length <= kol.opmerking) c.push(" ");
      c[kol.opmerking] = ` ${schoon(opmerking)} `;
    }
    if (kol.pagina !== undefined) {
      while (c.length <= kol.pagina) c.push(" ");
      c[kol.pagina] = ` ${schoon(pagina)} `;
    }
    regels[j] = "|" + c.join("|") + "|";
    return vervangDetailBlok(regels.join("\n"), oudeTitel, titel, detail);
  }
  return null;
}

/** Verwijdert taak n volledig: de tabelrij én het bijbehorende detailblok. */
export function developerTaakVerwijderen(md: string, n: number): string | null {
  const regels = String(md || "").replace(/\r/g, "").split("\n");
  const pos = eersteTabelVoorKop(regels);
  if (!pos) return null;
  const kol = kolomIndex(splitCells(regels[pos.kopRegel]));
  const idxN = kol.n ?? 0;
  const idxTitel = kol.titel ?? 1;

  for (let j = pos.scheidingRegel + 1; j < regels.length; j++) {
    if (regels[j] === undefined || regels[j].trim().charAt(0) !== "|") break;
    const c = splitCells(regels[j]);
    if (parseInt(c[idxN] ?? "", 10) !== n) continue;
    const titel = c[idxTitel] ?? "";
    regels.splice(j, 1);
    return vervangDetailBlok(regels.join("\n"), titel, titel, "");
  }
  return null;
}

/**
 * Zet een taak uit werklijst.md/toelichting.md door naar developer.md van
 * dezelfde klant. Schrijft developer.md; de aanroeper is verantwoordelijk
 * voor het (los) bijwerken van de werklijst-status naar "bij developer",
 * zodat een mislukte developer.md-schrijving niet stilzwijgend de
 * werklijst-status verandert.
 */
export async function taakNaarDeveloperbord(
  klantFolderId: string,
  taakN: number,
  titel: string,
  opmerking: string,
  pagina: string,
  detail?: string,
): Promise<void> {
  const bestaand = await findFileByName(klantFolderId, "developer.md");
  const huidigeMd = bestaand ? await readFileContent(bestaand.id) : SJABLOON_DEVELOPER;
  const werkorder = ""; // geen los stappenplan-document in deze fase; de volledige context gaat als ## blok mee (zie detail)
  const nieuw = developerMetRegel(huidigeMd, taakN, titel, opmerking, pagina, werkorder, detail);
  await writeDocument({
    folderId: klantFolderId,
    fileName: "developer.md",
    content: nieuw,
    knownFileId: bestaand?.id ?? null,
    knownModifiedTime: bestaand?.modifiedTime ?? null,
  });
}

export interface DevTaakMetKlant extends DevTaak {
  klantFolderId: string;
}

/**
 * Leest developer.md uit ALLE klantmappen (elke groep, elke klant met een
 * map in Drive) en voegt de rijen samen tot één bord. Klanten zonder
 * developer.md (of zonder map) leveren gewoon niets bij — geen fout.
 */
export async function aggregeerDeveloperbord(): Promise<DevTaakMetKlant[]> {
  const groepen = await getKlantGroepen();
  const klanten: Klant[] = groepen.flatMap((g) => g.klanten).filter((k) => k.mapId);

  const perKlant = await Promise.all(
    klanten.map(async (k): Promise<DevTaakMetKlant[]> => {
      if (!k.mapId) return [];
      try {
        const bestand = await findFileByName(k.mapId, "developer.md");
        if (!bestand) return [];
        const md = await readFileContent(bestand.id);
        return parseDeveloperMd(md, k.naam, k.slug).map((t) => ({
          ...t,
          klantFolderId: k.mapId as string,
        }));
      } catch {
        return [];
      }
    }),
  );

  return perKlant.flat();
}

export async function developerStatusOpslaan(
  klantFolderId: string,
  n: number,
  waarde: string,
): Promise<void> {
  const bestand = await findFileByName(klantFolderId, "developer.md");
  if (!bestand) throw new Error("Er is nog geen developer.md voor deze klant.");
  const md = await readFileContent(bestand.id);
  const nieuw = developerStatus(md, n, waarde);
  if (!nieuw) throw new Error("Kon deze taak niet in developer.md vinden.");
  await writeDocument({
    folderId: klantFolderId,
    fileName: "developer.md",
    content: nieuw,
    knownFileId: bestand.id,
    knownModifiedTime: bestand.modifiedTime,
  });
}

export async function developerKlaarMeldenOpslaan(
  klantFolderId: string,
  n: number,
  tijdsduur: string,
  terugkoppeling: string,
): Promise<void> {
  const bestand = await findFileByName(klantFolderId, "developer.md");
  if (!bestand) throw new Error("Er is nog geen developer.md voor deze klant.");
  const md = await readFileContent(bestand.id);
  const nieuw = developerKlaarMelden(md, n, tijdsduur, terugkoppeling);
  if (!nieuw) throw new Error("Kon deze taak niet in developer.md vinden.");
  await writeDocument({
    folderId: klantFolderId,
    fileName: "developer.md",
    content: nieuw,
    knownFileId: bestand.id,
    knownModifiedTime: bestand.modifiedTime,
  });
}

/**
 * Slaat een bewerking van taak n op in developer.md — Drive-wrapper rond de
 * pure developerTaakBewerken() hierboven, exact naar het patroon van
 * developerStatusOpslaan()/developerKlaarMeldenOpslaan(): bestand opzoeken
 * (geen developer.md -> duidelijke Nederlandse foutmelding, want er is dan
 * simpelweg niets om in te bewerken), inhoud lezen, de pure functie
 * toepassen (null -> taak n bestaat niet (meer) in dit bestand -> eigen
 * foutmelding), en het resultaat terugschrijven met de version gate
 * (knownModifiedTime) zodat een gelijktijdige wijziging elders (bijv. door
 * de developer zelf, of door Maarten op dezelfde taak) een VersionConflictError
 * geeft in plaats van stilzwijgend overschreven te worden.
 */
export async function developerTaakBewerkenOpslaan(
  klantFolderId: string,
  n: number,
  titel: string,
  opmerking: string,
  pagina: string,
  detail: string,
): Promise<void> {
  const bestand = await findFileByName(klantFolderId, "developer.md");
  if (!bestand) throw new Error("Er is nog geen developer.md voor deze klant.");
  const md = await readFileContent(bestand.id);
  const nieuw = developerTaakBewerken(md, n, titel, opmerking, pagina, detail);
  if (!nieuw) throw new Error("Kon deze taak niet in developer.md vinden.");
  await writeDocument({
    folderId: klantFolderId,
    fileName: "developer.md",
    content: nieuw,
    knownFileId: bestand.id,
    knownModifiedTime: bestand.modifiedTime,
  });
}

/**
 * Verwijdert taak n uit developer.md — Drive-wrapper rond de pure
 * developerTaakVerwijderen() hierboven, zelfde patroon als
 * developerTaakBewerkenOpslaan() hierboven (zie die doc-comment voor de
 * reden achter elke stap).
 */
export async function developerTaakVerwijderenOpslaan(
  klantFolderId: string,
  n: number,
): Promise<void> {
  const bestand = await findFileByName(klantFolderId, "developer.md");
  if (!bestand) throw new Error("Er is nog geen developer.md voor deze klant.");
  const md = await readFileContent(bestand.id);
  const nieuw = developerTaakVerwijderen(md, n);
  if (!nieuw) throw new Error("Kon deze taak niet in developer.md vinden.");
  await writeDocument({
    folderId: klantFolderId,
    fileName: "developer.md",
    content: nieuw,
    knownFileId: bestand.id,
    knownModifiedTime: bestand.modifiedTime,
  });
}

/** Herexporteert toelichtingVoor voor gebruik door developerbord-UI (context bij een taak). */
export { toelichtingVoor };
