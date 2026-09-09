/**
 * lib/servicepunten-model.ts — het datamodel + de parse/serialiseerfuncties
 * voor servicepunten.md, ZONDER "server-only". Client components
 * (ServicepuntenView.tsx, VestigingKaart.tsx, Tabs.tsx) hebben de constanten
 * en types hier nodig (welke stappen bestaan er, welke statuswaarden, welke
 * CSS-klasse per status) om de checklist en de pillen te renderen, en een
 * "server-only"-bestand mag niet — zelfs niet voor een losse constante —
 * vanuit een client component geïmporteerd worden (Next.js breekt de build
 * dan met "You're importing a component that needs server-only").
 *
 * lib/servicepunten.ts (WEL server-only) doet de daadwerkelijke Drive-I/O en
 * hergebruikt/re-exporteert alles hieronder, zodat server-only bestanden
 * (page.tsx, actions.ts) gewoon van "@/lib/servicepunten" kunnen blijven
 * importeren zonder dit onderscheid te hoeven kennen.
 *
 * Zie de doc-comment in lib/servicepunten.ts voor de volledige achtergrond
 * (waarom deze structuur 1:1 uit de bestaande Claude Artifact "Servicepunten
 * aanhaken" komt, waarom Drive de enige bron van waarheid blijft, enz.).
 */

import { alleSecties, tableWith, type MarkdownTable } from "./markdown";

/**
 * Zelfde slugify() als lib/klanten.ts — hier bewust als eigen, kleine kopie
 * in plaats van geïmporteerd: lib/klanten.ts heeft "server-only" bovenaan,
 * en dit bestand moet (via de client components van de Servicepunten-tab)
 * ook zonder server-context kunnen draaien. Verandert die logica ooit, dan
 * moet dat op BEIDE plekken.
 */
function slugify(naam: string): string {
  return naam
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const NOC_SLUG = "nationaal-oogcentrum";
export const SERVICEPUNTEN_BESTANDSNAAM = "servicepunten.md";

// ---- Vaste procesdefinitie: 1:1 uit de artifact se STAP_GROEPEN --------

export interface ServicepuntStap {
  id: string;
  label: string;
  crit: string;
}

export interface ServicepuntStapGroep {
  naam: string;
  stappen: ServicepuntStap[];
}

export const STAP_GROEPEN: ServicepuntStapGroep[] = [
  {
    naam: "Contact en voorbereiding",
    stappen: [
      {
        id: "contact",
        label: "Eerste contact gelegd",
        crit: "Met de optiekzaak en de optometrist of vestigingsmanager, vóórdat er iets gepland wordt. Naam, rol, telefoon en mail vastgelegd.",
      },
      {
        id: "handleiding",
        label: "Handleiding verstuurd",
        crit: "De twee handleidingen (protocol van de quick scan, in- en uitsluitingscriteria) mee bij het eerste contact.",
      },
      {
        id: "login",
        label: "Login verstuurd",
        crit: "Toegang tot het systeem, zodat de vestiging zelf de quick scan-waarden kan invullen.",
      },
      {
        id: "doorloop",
        label: "Systeem samen doorlopen",
        crit: "Eén keer samen doornemen hoe de waarden voor de quick scan juist worden ingevuld, vóór de eerste patient.",
      },
    ],
  },
  {
    naam: "Gegevens en materiaal",
    stappen: [
      {
        id: "gegevens",
        label: "Locatiegegevens compleet",
        crit: "Adres, openingstijden, parkeren of OV, en de bevestiging dat de pre-scan er ook echt geboekt kan worden.",
      },
      {
        id: "beschikbaarheid",
        label: "Beschikbaarheid vastgelegd",
        crit: "Vaste dagen en tijden voor de quick scan, opengezet in de agenda.",
      },
      {
        id: "folder",
        label: "Folder en fotomateriaal verstuurd",
        crit: "De folder gaat naar de vestiging voor op de balie. Zij maken er zelf een foto van.",
      },
      {
        id: "foto",
        label: "Foto ontvangen en bruikbaar",
        crit: "De foto moet echt zijn en het materiaal herkenbaar tonen; een gegenereerd beeld keurt Google af. Zonder deze foto kan het bedrijfsprofiel niet door.",
      },
      {
        id: "telefoon",
        label: "Lokaal nummer gekoppeld",
        crit: "Nummer uit de reeks 088 44 88 41x, met een welkomsttekst waarin de plaatsnaam wordt genoemd.",
      },
    ],
  },
  {
    naam: "Techniek en zichtbaarheid",
    stappen: [
      {
        id: "gmb",
        label: "Google Mijn Bedrijf aangemaakt",
        crit: "Vaste naamvorm en categorieën, link naar de SEO-landingpagina, afsprakenlink, verificatie gestart. Kan pas nadat de foto binnen is.",
      },
      {
        id: "seo",
        label: "SEO-landingpagina live",
        crit: "/klinieken/ooglaseren-{stad}/, of bij een vestiging binnen ongeveer vijftien minuten van een bestaande pagina alleen het vestigingsblok daarop.",
      },
      {
        id: "ads",
        label: "Ads-pagina (no-index) klaar",
        crit: "Aparte advertentiepagina voor de campagne, buiten de Google-index.",
      },
      {
        id: "campagne",
        label: "Ads-campagne aan",
        crit: "Start op de dag dat er ook echt afspraken ingepland kunnen worden, niet eerder.",
      },
      {
        id: "zichtbaar",
        label: "Zichtbaar op de site",
        crit: "Locatiekaartje, home en afsprakenpagina bijgewerkt.",
      },
      {
        id: "controle",
        label: "Gecontroleerd en live",
        crit: "Pagina indexeerbaar, profiel wijst goed door, telefoonnummer overal gelijk, een testafspraak is gelukt.",
      },
    ],
  },
];

export const ALLE_STAPPEN: ServicepuntStap[] = STAP_GROEPEN.flatMap((g) => g.stappen);

export type ServicepuntStatus = "draait" | "bevestigd" | "kandidaat" | "uitzoeken";

export const STATUS_VOLGORDE: ServicepuntStatus[] = ["draait", "bevestigd", "kandidaat", "uitzoeken"];

export const STATUS_LABEL: Record<ServicepuntStatus, string> = {
  draait: "Draait",
  bevestigd: "Bevestigd tot januari",
  kandidaat: "Kandidaat",
  uitzoeken: "Nog uitzoeken",
};

/** CSS-modifierklasse per status — puur weergave, zie .sp-p-* in globals.css. */
export const STATUS_PILKLASSE: Record<ServicepuntStatus, string> = {
  draait: "sp-p-draait",
  bevestigd: "sp-p-bevestigd",
  kandidaat: "sp-p-kandidaat",
  uitzoeken: "sp-p-uitzoeken",
};

function normaliseerStatus(ruw: string): ServicepuntStatus {
  const key = ruw.trim().toLowerCase();
  return (STATUS_VOLGORDE as string[]).includes(key) ? (key as ServicepuntStatus) : "uitzoeken";
}

// ---- Datamodel ----------------------------------------------------------

export interface ServicepuntChecklistItem {
  afgevinkt: boolean;
  datum: string;
}

export interface ContactlogRegel {
  datum: string;
  wie: string;
  tekst: string;
}

/** Velden van een vestiging die rechtstreeks als los tekstveld bewerkbaar zijn. */
export const BEWERKBARE_VELDEN = [
  "partner",
  "adres",
  "contact",
  "telefoon",
  "email",
  "beschikbaarheid",
  "opmerking",
] as const;
export type BewerkbaarVeld = (typeof BEWERKBARE_VELDEN)[number];

export interface Vestiging {
  id: string;
  plaats: string;
  status: ServicepuntStatus;
  partner: string;
  adres: string;
  contact: string;
  telefoon: string;
  email: string;
  beschikbaarheid: string;
  opmerking: string;
  prioriteit: number | null;
  volgordereden: string;
  checklist: Record<string, ServicepuntChecklistItem>;
  contactlog: ContactlogRegel[];
}

export interface ServicepuntenModel {
  laatstBijgewerkt: string;
  vestigingen: Vestiging[];
  eenmaligGeregeld: string;
}

/** Voortgang van één vestiging (aantal afgevinkte stappen / totaal) — pure telling, geen eigen weging. */
export function voortgang(v: Vestiging): { klaar: number; totaal: number } {
  const klaar = ALLE_STAPPEN.filter((s) => v.checklist[s.id]?.afgevinkt).length;
  return { klaar, totaal: ALLE_STAPPEN.length };
}

// ---- Parsen --------------------------------------------------------------

const EENMALIG_KOP = "Eenmalig geregeld";

function veldenUitGegevensTabel(tabel: MarkdownTable | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!tabel) return out;
  const idxVeld = tabel.headers.findIndex((h) => h.trim().toLowerCase() === "veld");
  const idxWaarde = tabel.headers.findIndex((h) => h.trim().toLowerCase() === "waarde");
  if (idxVeld === -1 || idxWaarde === -1) return out;
  for (const rij of tabel.rows) {
    const key = (rij[idxVeld] ?? "").trim().toLowerCase();
    if (key) out[key] = (rij[idxWaarde] ?? "").trim();
  }
  return out;
}

function parseVestigingSectie(naam: string, inhoud: string): Vestiging {
  const gegevens = veldenUitGegevensTabel(tableWith(inhoud, "waarde"));

  const prioriteitRuw = (gegevens["prioriteit"] || "").trim();
  const prioriteit = /^\d+$/.test(prioriteitRuw) ? parseInt(prioriteitRuw, 10) : null;

  const checklist: Record<string, ServicepuntChecklistItem> = {};
  const stapTabel = tableWith(inhoud, "afgevinkt");
  if (stapTabel) {
    const idxStap = stapTabel.headers.findIndex((h) => h.trim().toLowerCase() === "stap");
    const idxAf = stapTabel.headers.findIndex((h) => h.trim().toLowerCase() === "afgevinkt");
    const idxDatum = stapTabel.headers.findIndex((h) => h.trim().toLowerCase() === "datum");
    if (idxStap !== -1) {
      for (const rij of stapTabel.rows) {
        const label = (rij[idxStap] ?? "").trim();
        const stap = ALLE_STAPPEN.find((s) => s.label === label);
        if (!stap) continue; // onbekende/verouderde regel: negeren, niet crashen
        checklist[stap.id] = {
          afgevinkt: (rij[idxAf] ?? "").trim().toLowerCase() === "x",
          datum: idxDatum !== -1 ? (rij[idxDatum] ?? "").trim() : "",
        };
      }
    }
  }
  for (const s of ALLE_STAPPEN) {
    if (!checklist[s.id]) checklist[s.id] = { afgevinkt: false, datum: "" };
  }

  const contactlog: ContactlogRegel[] = [];
  const logTabel = tableWith(inhoud, "wie");
  if (logTabel) {
    const idxDatum = logTabel.headers.findIndex((h) => h.trim().toLowerCase() === "datum");
    const idxWie = logTabel.headers.findIndex((h) => h.trim().toLowerCase() === "wie");
    const idxWat = logTabel.headers.findIndex((h) => h.trim().toLowerCase() === "wat");
    for (const rij of logTabel.rows) {
      const tekst = idxWat !== -1 ? (rij[idxWat] ?? "").trim() : "";
      if (!tekst) continue;
      contactlog.push({
        datum: idxDatum !== -1 ? (rij[idxDatum] ?? "").trim() : "",
        wie: idxWie !== -1 ? (rij[idxWie] ?? "").trim() : "",
        tekst,
      });
    }
  }

  return {
    id: slugify(naam),
    plaats: naam,
    status: normaliseerStatus(gegevens["status"] || "uitzoeken"),
    partner: gegevens["partner"] || "",
    adres: gegevens["adres"] || "",
    contact: gegevens["contactpersoon en rol"] || "",
    telefoon: gegevens["telefoon"] || "",
    email: gegevens["e-mail"] || "",
    beschikbaarheid: gegevens["beschikbaarheid quick scans"] || "",
    opmerking: gegevens["opmerking"] || "",
    prioriteit,
    volgordereden: gegevens["waarom deze volgorde"] || "",
    checklist,
    contactlog,
  };
}

export function parseServicepunten(md: string): ServicepuntenModel {
  const laatstBijgewerktMatch = /^Laatst bijgewerkt:\s*(.+)$/m.exec(md);
  const laatstBijgewerkt = laatstBijgewerktMatch?.[1].trim() ?? "";

  const secties = alleSecties(md);
  const eenmaligSectie = secties.find((s) => s.kop.trim().toLowerCase() === EENMALIG_KOP.toLowerCase());
  const eenmaligGeregeld = eenmaligSectie?.inhoud ?? "";

  const vestigingen = secties
    .filter((s) => s.kop.trim().toLowerCase() !== EENMALIG_KOP.toLowerCase())
    .map((s) => parseVestigingSectie(s.kop.trim(), s.inhoud));

  return { laatstBijgewerkt, vestigingen, eenmaligGeregeld };
}

// ---- Serialiseren ---------------------------------------------------------

/** Ontsnapt een waarde voor gebruik als markdown-tabelcel: geen kale `|`, geen regeleinde. */
function escCel(waarde: string): string {
  return (waarde || "").replace(/\r?\n+/g, " ").replace(/\|/g, "\\|").trim();
}

function serialiseerVestiging(v: Vestiging): string {
  const gegevensRijen: [string, string][] = [
    ["Status", v.status],
    ["Partner", v.partner],
    ["Adres", v.adres],
    ["Contactpersoon en rol", v.contact],
    ["Telefoon", v.telefoon],
    ["E-mail", v.email],
    ["Beschikbaarheid quick scans", v.beschikbaarheid],
    ["Prioriteit", v.prioriteit != null ? String(v.prioriteit) : ""],
    ["Waarom deze volgorde", v.volgordereden],
    ["Opmerking", v.opmerking],
  ];
  const gegevensTabel = [
    "| Veld | Waarde |",
    "|---|---|",
    ...gegevensRijen.map(([k, waarde]) => `| ${escCel(k)} | ${escCel(waarde)} |`),
  ].join("\n");

  const stapRijen = ALLE_STAPPEN.map((s) => {
    const item = v.checklist[s.id] || { afgevinkt: false, datum: "" };
    return `| ${escCel(s.label)} | ${item.afgevinkt ? "x" : ""} | ${escCel(item.datum)} |`;
  });
  const stapTabel = ["| Stap | Afgevinkt | Datum |", "|---|---|---|", ...stapRijen].join("\n");

  const logGesorteerd = v.contactlog.slice().sort((a, b) => a.datum.localeCompare(b.datum));
  const logTabel = [
    "| Datum | Wie | Wat |",
    "|---|---|---|",
    ...logGesorteerd.map((l) => `| ${escCel(l.datum)} | ${escCel(l.wie)} | ${escCel(l.tekst)} |`),
  ].join("\n");

  return [
    `## ${v.plaats}`,
    "",
    gegevensTabel,
    "",
    "### Aansluitproces",
    "",
    stapTabel,
    "",
    "### Contactlog",
    "",
    logTabel,
    "",
  ].join("\n");
}

export function serialiseerServicepunten(model: ServicepuntenModel): string {
  const delen: string[] = [
    "# Servicepunten",
    "",
    `Laatst bijgewerkt: ${model.laatstBijgewerkt}`,
    "",
  ];
  for (const v of model.vestigingen) {
    delen.push(serialiseerVestiging(v));
  }
  delen.push(`## ${EENMALIG_KOP}`, "", model.eenmaligGeregeld.trim(), "");
  return delen.join("\n");
}
