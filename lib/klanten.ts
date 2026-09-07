import "server-only";

import {
  findFileByName,
  getRootFolderId,
  listFilesInFolder,
  readFileContent,
  type DriveFileRef,
} from "./drive";
import { sectie } from "./markdown";

/**
 * lib/klanten.ts — leest KLANTEN.md (de root-index in de Drive-map
 * "Pingwin Klanten") en geeft de drie vaste groepen terug: Eigen klanten,
 * Leads en Multimedia Concepts, met naam en Drive-mapverwijzing per klant.
 * Spec §2.2: bouwKlanten() in de bestaande artifact combineert de
 * indexmarkdown met de daadwerkelijk in Drive gevonden klantmappen.
 *
 * Let op (spec, open vraag §10.7): het exacte regelformaat van KLANTEN.md
 * (bullet-lijst per groep, of een tabel) kon niet met zekerheid uit de
 * bestaande broncode worden afgeleid. Deze parser accepteert daarom zowel
 * "- Klantnaam"-bullets als de eerste kolom van een markdown-tabelrij onder
 * elke groepskop, zodat hij niet meteen breekt zodra het echte bestand
 * bekeken kan worden. Pas dit aan zodra het werkelijke format van
 * Maartens KLANTEN.md bevestigd is.
 */

export type GroepId = "eigen" | "lead" | "mc";

export interface Klant {
  naam: string;
  slug: string;
  groep: GroepId;
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

function namenUitSectie(md: string, kop: string): string[] {
  const sec = sectie(md, kop);
  if (!sec) return [];
  const namen: string[] = [];
  for (const regel of sec.split(/\r?\n/)) {
    const trimmed = regel.trim();
    if (!trimmed) continue;

    const bullet = /^[-*]\s+(.+)$/.exec(trimmed);
    if (bullet) {
      namen.push(cleanCellText(bullet[1]));
      continue;
    }

    if (trimmed.startsWith("|")) {
      const cellen = trimmed
        .split("|")
        .map((c) => c.trim())
        .filter((c) => c.length > 0);
      const eersteCel = cellen[0];
      if (
        eersteCel &&
        !/^:?-{2,}:?$/.test(eersteCel) &&
        !["naam", "klant", "klantnaam"].includes(eersteCel.toLowerCase())
      ) {
        namen.push(cleanCellText(eersteCel));
      }
      continue;
    }
  }
  // Lege regels/duplicaten opruimen, volgorde behouden.
  return [...new Set(namen.filter(Boolean))];
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

  const groepen: KlantGroep[] = GROEPEN.map((g) => {
    const namen = namenUitSectie(indexMd, g.naam);
    const klanten: Klant[] = namen.map((naam) => ({
      naam,
      slug: slugify(naam),
      groep: g.id,
      mapId: mapPerNaam.get(naam)?.id ?? null,
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
