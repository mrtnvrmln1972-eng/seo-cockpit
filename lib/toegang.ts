import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * lib/toegang.ts — de toegangslaag van de cockpit. Twee dingen die met
 * elkaar te maken hebben en daarom bij elkaar staan:
 *
 *   1. De DEELPADEN: routes met een lang, onraadbaar stuk in de URL, bedoeld
 *      om aan iemand buiten Pingwin te geven (het Developerbord voor Tonny,
 *      de servicepunten-pagina voor Nationaal Oogcentrum). Die blijven altijd
 *      open, ook als de rest achter een wachtwoord zit; de link zelf IS de
 *      sleutel.
 *   2. Het WACHTWOORDSLOT op al het andere: proxy.ts laat een bezoeker zonder
 *      geldige koekje-sessie alleen naar /inloggen.
 *
 * Waarom dit er is (09-09-2026): tot vandaag was de hele cockpit op
 * seo-cockpit-eight.vercel.app zonder enige drempel te bekijken, inclusief de
 * klantenlijst van alle klanten. Een deellink doorsturen betekende dus in de
 * praktijk het hele dossierbestand van elke klant meegeven.
 *
 * Belangrijk bij een deelpad: de klantenlijst-navigatie mag niet meelekken.
 * Alleen wegstoppen met CSS is niet genoeg — dan staan alle klantnamen nog
 * steeds gewoon in de broncode van de pagina, en dat was precies wat er tot
 * vandaag op het Developerbord gebeurde. Daarom zet proxy.ts de header
 * DEEL_HEADER op een deelpad en laat app/layout.tsx de navigatie dan
 * helemaal weg, in plaats van hem alleen onzichtbaar te maken.
 *
 * Het wachtwoord staat NOOIT in dit bestand of waar dan ook in de repo (zie
 * CLAUDE.md), alleen in de omgevingsvariabele COCKPIT_WACHTWOORD op Vercel.
 * Staat die variabele er niet, dan blijft de cockpit open zoals hij was: dan
 * gaat er niets kapot, en app/_components/ToegangWaarschuwing.tsx laat
 * bovenaan elke pagina zien dat het slot nog niet aan staat.
 */

/** Naam van het koekje waarin de ingelogde sessie staat. */
export const TOEGANG_COOKIE = "pingwin_cockpit";

/** Route van het Developerbord (Tonny). Het lange stuk is de sleutel. */
export const DEVELOPERBORD_PAD = "/bord-cc5100460da936203b8222ad79b65779";

/** Route van de deelbare, alleen-lezen servicepuntenpagina (Nationaal Oogcentrum). */
export const SERVICEPUNTEN_DEELPAD = "/punten-0a5cd164e753ce997b96f211431c0479";

/** Alle routes die zonder wachtwoord bereikbaar blijven, omdat de link zelf de sleutel is. */
export const DEELPADEN = [DEVELOPERBORD_PAD, SERVICEPUNTEN_DEELPAD] as const;

/**
 * Header die proxy.ts op een deelpad meestuurt, zodat app/layout.tsx weet dat
 * het de klantenlijst niet mag renderen.
 */
export const DEEL_HEADER = "x-pingwin-deelpad";

/** Hoort dit pad bij een deelpad (de route zelf of iets eronder)? */
export function isDeelpad(pad: string): boolean {
  return DEELPADEN.some((deel) => pad === deel || pad.startsWith(`${deel}/`));
}

/** Het ingestelde wachtwoord, of een lege tekst als het slot (nog) niet aan staat. */
export function cockpitWachtwoord(): string {
  return (process.env.COCKPIT_WACHTWOORD ?? "").trim();
}

/** Staat het wachtwoordslot aan? Zonder COCKPIT_WACHTWOORD blijft alles open. */
export function slotStaatAan(): boolean {
  return cockpitWachtwoord().length > 0;
}

/**
 * De waarde die in het koekje komt: een handtekening over een vaste tekst,
 * gezet met het wachtwoord als sleutel. Zo staat het wachtwoord zelf nooit in
 * het koekje, en verandert elk uitgegeven koekje vanzelf mee zodra Maarten
 * het wachtwoord op Vercel wijzigt (iedereen moet dan opnieuw inloggen).
 */
export function sessiewaarde(wachtwoord = cockpitWachtwoord()): string {
  return createHmac("sha256", wachtwoord).update("pingwin-cockpit-v1").digest("hex");
}

/** Klopt het koekje bij het huidige wachtwoord? Vergelijking zonder tijdlek. */
export function isGeldigeSessie(koekje: string | undefined): boolean {
  if (!koekje) return false;
  const verwacht = Buffer.from(sessiewaarde(), "utf8");
  const gekregen = Buffer.from(koekje, "utf8");
  if (verwacht.length !== gekregen.length) return false;
  return timingSafeEqual(verwacht, gekregen);
}

/** Klopt het ingetypte wachtwoord? Vergelijking zonder tijdlek. */
export function wachtwoordKlopt(ingetypt: string): boolean {
  const juist = Buffer.from(cockpitWachtwoord(), "utf8");
  const gekregen = Buffer.from(ingetypt, "utf8");
  if (juist.length === 0 || juist.length !== gekregen.length) return false;
  return timingSafeEqual(juist, gekregen);
}

/**
 * Waar gaan we heen na het inloggen? Alleen een pad binnen deze app is goed;
 * "//ergens-anders.nl" en een volledige URL worden geweigerd, zodat de
 * inlogpagina niemand naar een vreemde site kan sturen.
 */
export function veiligeTerugweg(ruw: string | null | undefined): string {
  if (!ruw) return "/";
  if (!ruw.startsWith("/") || ruw.startsWith("//")) return "/";
  return ruw;
}
