import "server-only";

import {
  findFileByName,
  getRootFolderId,
  listFilesInFolder,
  readFileContent,
  type DriveFileRef,
} from "./drive";
import { tableWith } from "./markdown";

/**
 * lib/klanten.ts — leest KLANTEN.md (de root-index in de Drive-map
 * "Pingwin Klanten") en geeft de drie vaste groepen terug: Eigen klanten,
 * Leads en Multimedia Concepts, met naam en Drive-mapverwijzing per klant.
 * Spec §2.2: bouwKlanten() in de bestaande artifact combineert de
 * indexmarkdown met de daadwerkelijk in Drive gevonden klantmappen.
 *
 * Echte KLANTEN.md (bevestigd tegen Maartens bestand, 07-09-2026) is GEEN
 * bullet-lijst per groep, maar één platte tabel onder "# Klantenlijst" met
 * de kolommen Groep | Klant | Domein | Fase, waarbij Groep de waarde
 * "eigen", "mc" of "lead" bevat. tableWith() vindt die ene tabel op
 * koptekst-inhoud; de Groep-kolom bepaalt de indeling, niet een aparte
 * sectiekop per groep.
 */

export type GroepId = "eigen" | "lead" | "mc";

export interface Klant {
  naam: string;
  slug: string;
  groep: GroepId;
  domein: string;
  /** Fase-waarde uit KLANTEN.md (nieuw/onboarding/aanval/lopend/stil/lead/eigen site), zoals ze daar letterlijk staat. */
  fase: string;
  /** Drive-map-id van de klantmap, of null als er (nog) geen map bij hoort. */
  mapId: string | null;
}

export interface KlantGroep {
  id: GroepId;
  naam: string;
  klanten: Klant[];
}

// Vaste groepen, exact zoals GROEPEN in de bestaande artifact (spec §1.3/§2.2).
const GROEPEN: { id: GroepId; naam: string }[] = [
  { id: "eigen", naam: "Eigen klanten" },
  { id: "lead", naam: "Leads" },
  { id: "mc", naam: "Multimedia Concepts" },
];

/** Leesbare groepsnaam bij een groep-id (voor koppen in de UI). */
export function getGroepNaam(id: GroepId): string {
  return GROEPEN.find((g) => g.id === id)?.naam ?? id;
}

/** Zet een klantnaam om naar een URL-vriendelijke slug voor de routes /klant/[klantslug]/... */
export function slugify(naam: string): string {
  return naam
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanCellText(tekst: string): string {
  const link = /^\[(.+)\]\(.+\)$/.exec(tekst.trim());
  return (link ? link[1] : tekst).trim();
}

interface IndexRij {
  groep: GroepId;
  naam: string;
  domein: string;
  fase: string;
}

/** Leest de ene Groep/Klant/Domein/Fase-tabel uit KLANTEN.md, in bestandsvolgorde. */
function rijenUitIndex(md: string): IndexRij[] {
  const tabel = tableWith(md, "klant");
  if (!tabel) return [];

  const kolom = (naam: string) =>
    tabel.headers.findIndex((h) => h.trim().toLowerCase() === naam);
  const idxGroep = kolom("groep");
  const idxKlant = kolom("klant");
  const idxDomein = kolom("domein");
  const idxFase = kolom("fase");
  if (idxGroep === -1 || idxKlant === -1) return [];

  const out: IndexRij[] = [];
  for (const rij of tabel.rows) {
    const groepRuw = (rij[idxGroep] ?? "").trim().toLowerCase();
    const naam = cleanCellText(rij[idxKlant] ?? "");
    if (!naam) continue;
    const groep = GROEPEN.find((g) => g.id === groepRuw)?.id;
    if (!groep) continue;
    out.push({
      groep,
      naam,
      domein: idxDomein !== -1 ? (rij[idxDomein] ?? "").trim() : "",
      fase: idxFase !== -1 ? (rij[idxFase] ?? "").trim() : "",
    });
  }
  return out;
}

let cache: { at: number; groepen: KlantGroep[] } | null = null;
const CACHE_MS = 30_000;

/**
 * Haalt de drie klantgroepen op, samengesteld uit KLANTEN.md + de
 * daadwerkelijke Drive-mappen in de root. Kortstondig in-memory gecached
 * (30s) zodat elke tab/route-navigatie niet steeds opnieuw hoeft te lezen.
 */
export async function getKlantGroepen(): Promise<KlantGroep[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.groepen;

  const root = getRootFolderId();
  const [indexFile, mappen] = await Promise.all([
    findFileByName(root, "KLANTEN.md"),
    listFilesInFolder(root, { onlyFolders: true }),
  ]);
  const indexMd = indexFile ? await readFileContent(indexFile.id) : "";

  const mapPerNaam = new Map<string, DriveFileRef>();
  for (const m of mappen) mapPerNaam.set(m.name, m);

  const rijen = rijenUitIndex(indexMd);
  const groepen: KlantGroep[] = GROEPEN.map((g) => {
    const klanten: Klant[] = rijen
      .filter((r) => r.groep === g.id)
      .map((r) => ({
        naam: r.naam,
        slug: slugify(r.naam),
        groep: g.id,
        domein: r.domein,
        fase: r.fase,
        mapId: mapPerNaam.get(r.naam)?.id ?? null,
      }));
    return { id: g.id, naam: g.naam, klanten };
  });

  cache = { at: Date.now(), groepen };
  return groepen;
}

export async function getKlantBySlug(slug: string): Promise<Klant | null> {
  const groepen = await getKlantGroepen();
  for (const groep of groepen) {
    const klant = groep.klanten.find((k) => k.slug === slug);
    if (klant) return klant;
  }
  return null;
}
