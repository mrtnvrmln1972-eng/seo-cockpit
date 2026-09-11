/**
 * lib/onboarding-ladder.ts — de vaste teksten achter de Onboarding-tab: de
 * tien ladderstappen met hun uitleg, en de acht koppelingen met de
 * aanvraagtekst die je kunt kopiëren.
 *
 * Deze teksten zijn 1:1 overgenomen uit de Claude Artifact "Pingwin
 * Klantcockpit" (ONBSTAPPEN en KOPPELVAST daarin), op verzoek van Maarten
 * (11-09-2026: "ik wil graag een onboarding zoals in dat artefact, maar dan
 * in het SEO-dashboard, zodat we daar alles kunnen afvinken"). Niets
 * verzonnen, niets herschreven; dit is zijn eigen tekst.
 *
 * Waarom het hier in code staat en niet in een dossierbestand: het is voor
 * elke klant hetzelfde. De klantgebonden kant, dus wélke stap af is en wat er
 * bij een koppeling speelt, staat in toelichting.md en toegang.md en komt
 * daarvandaan. De code hieronder voegt daar alleen de vaste uitleg aan toe,
 * gekoppeld op de code vooraan een regel (1a, 3b). Zo blijft het dossier
 * leesbaar zonder nummers of id's, precies zoals in de artifact.
 *
 * Geen "server-only": ook de client component (de kopieerknoppen) leest hier.
 */

export interface OnboardingStap {
  /** De code vooraan de vinkregel in toelichting.md, bijvoorbeeld "1a". */
  code: string;
  /** Kort etiket, handig bij het zoeken; komt niet op het scherm. */
  kort: string;
  /** Waarom deze stap er is. Staat onder de regel zolang hij niet af is. */
  wat: string;
  /** Wat je nu doet, als dat niet met een opdracht op te lossen is. */
  nu: string;
  /** Opdracht om te kopiëren naar een Cowork-gesprek. {k} en {domein} worden ingevuld. */
  cmd: string;
}

export const ONBOARDING_STAPPEN: OnboardingStap[] = [
  {
    code: "1a",
    kort: "koppelingen",
    wat: "Search Console, Ahrefs, GA4, WordPress en het Bedrijfsprofiel moeten aanstaan. Zolang die bronnen ontbreken rust elke uitspraak op een schatting.",
    nu: "Vraag de ontbrekende koppelingen aan. Hieronder bij de koppelingen staat per bron een knop met de aanvraagtekst.",
    cmd: "",
  },
  {
    code: "1b",
    kort: "klantstem",
    wat: "Alles wat de klant zelf per mail heeft gezegd hoort met citaat, datum en bron in klantstem.md te staan.",
    nu: "",
    cmd: "Bouw klantstem.md voor {k} op uit de mailhistorie, met per punt het letterlijke citaat, de datum en de mail als bron.",
  },
  {
    code: "1c",
    kort: "paginavoorraad",
    wat: "Alle URL's van de site moeten in beeld staan met het aantal woorden, de title en de description, uit de laatste crawl.",
    nu: "",
    cmd: "Meet de paginavoorraad van {k} uit de laatste crawl: alle URL's met het aantal woorden, de title en de description, en zet het in roadmap.md met de datum van de crawl erbij.",
  },
  {
    code: "1d",
    kort: "cijfers per pagina",
    wat: "Per pagina horen de vertoningen, de klikken en de gemiddelde positie in de roadmap te staan, met de bron en de meetperiode erbij.",
    nu: "",
    cmd: "Zet in roadmap.md van {k} per pagina de vertoningen, klikken en gemiddelde positie uit Search Console over de laatste 90 dagen, met de bron en de meetperiode erbij.",
  },
  {
    code: "1e",
    kort: "propositievoorstel",
    wat: "Er hoort een voorstel in klant.md te liggen: twee varianten met de onderbouwing en ons advies eronder.",
    nu: "",
    cmd: "Stel de propositie voor {k} op in twee varianten in klant.md, met de onderbouwing, wat elke variant uitsluit en ons advies eronder.",
  },
  {
    code: "1f",
    kort: "propositie bevestigd",
    wat: "De klant moet de zin nog bevestigen. Alles daaronder weegt op dit besluit, dus zonder bevestiging staat de rest op los zand.",
    nu: "Leg de zin voor aan de klant. Hierboven bij de propositie staat de knop die de tekst voor de klant klaarzet.",
    cmd: "",
  },
  {
    code: "2",
    kort: "tone of voice",
    wat: "Nog vast te leggen uit de beste bestaande pagina's: een versie voor de klant en een interne instructie waar alle copy langs gaat.",
    nu: "",
    cmd: "Leg de tone of voice van {k} vast in tone-of-voice.md: een versie voor de klant van een half A4 en een interne instructie van hooguit twee A4, met citaten van de site als bewijs.",
  },
  {
    code: "3a",
    kort: "signalen",
    wat: "Het signalenbakje moet gevuld zijn en gewogen op de bevestigde propositie, dus niet op zoekvolume alleen.",
    nu: "",
    cmd: "Vul signalen.md van {k}, gewogen op de bevestigde propositie, met per punt wat er speelt met de cijfers, wat je doet, wat het oplevert en waarmee het gemeten is.",
  },
  {
    code: "3b",
    kort: "roadmap af",
    wat: "Per pagina moet er staan wat we ermee willen, dus welke pagina wint, welke verandert en welke vervalt.",
    nu: "",
    cmd: "Maak roadmap.md van {k} af: zet per pagina wat we ermee willen, op basis van de bevestigde propositie.",
  },
  {
    code: "3c",
    kort: "prioritering",
    wat: "De punten die jij zelf kiest komen als taken op de werklijst. Alleen wat jij kiest, nooit een lijst die vanzelf volloopt.",
    nu: "",
    cmd: "Geef me de laaghangende punten voor {k} uit signalen.md en de roadmap, op volgorde van opbrengst. Ik kies zelf welke er taken van worden.",
  },
];

export interface VasteKoppeling {
  naam: string;
  /** Waarmee een regel in toegang.md bij deze koppeling hoort. */
  zoek: RegExp;
  knop: string;
  vraag: string;
}

/** De acht vaste koppelingen, met de aanvraagtekst zodat er alleen geknipt en geplakt hoeft te worden. */
export const VASTE_KOPPELINGEN: VasteKoppeling[] = [
  {
    naam: "Search Console",
    zoek: /search\s*console/i,
    knop: "Kopieer de aanvraag",
    vraag:
      "Search Console goed zetten voor {domein} van {k}. 1. Kijk in Search Console welke property er voor dit domein bestaat en van welk type. 2. Is het geen domeinproperty (sc-domain:{domein}), maak die dan aan via Property toevoegen, Domein. Google geeft daarna het TXT-record. 3. Dat record moet in de DNS van het domein: vraag {k} om het door de hostingpartij te laten plaatsen, of om tijdelijk toegang tot het domeinbeheer. 4. Laat de bestaande URL-prefix property staan, die houdt de historie vast; een nieuwe property begint pas te meten vanaf de verificatie. 5. Zodra de verificatie rond is: de domeinproperty koppelen aan Windsor, connector searchconsole. Af is het pas als er een geverifieerde sc-domain property is en een Windsor-koppeling.",
  },
  {
    naam: "Ahrefs",
    zoek: /ahrefs/i,
    knop: "Kopieer de opdracht",
    vraag:
      "Maak in Ahrefs een project aan voor {domein} van {k}, koppel Search Console eraan, zet de Site Audit aan en zet de belangrijkste zoekwoorden in de Rank Tracker. Leg het projectnummer vast in toegang.md.",
  },
  {
    naam: "Google Analytics 4",
    zoek: /analytics|ga4/i,
    knop: "Kopieer de aanvraag",
    vraag:
      "Vraag aan {k}: geef maarten@pingwin.nl leesrechten op de Google Analytics 4-property van {domein}. Ga naar Beheer, Toegangsbeheer voor property, plus-teken, Gebruikers toevoegen, rol Kijker. Bestaat er geen GA4-property, laat dat dan weten, dan zetten we er zelf een klaar.",
  },
  {
    naam: "Google Ads",
    zoek: /google ads|adwords|^ads\b/i,
    knop: "Kopieer de aanvraag",
    vraag:
      "Vraag aan {k}: geef maarten@pingwin.nl leestoegang tot het Google Ads-account van {domein}. Ga naar Tools, Toegang en beveiliging, plus-teken, vul het e-mailadres in en kies toegangsniveau Alleen lezen. Draait er geen Google Ads, laat dat dan weten, dan zetten we deze regel op niet van toepassing.",
  },
  {
    naam: "WordPress",
    zoek: /wordpress|cms|wp\b/i,
    knop: "Kopieer de aanvraag",
    vraag:
      "Vraag aan {k} of de bouwer van {domein}: maak een eigen beheerdersaccount aan voor maarten@pingwin.nl, dus niet meeliften op een gedeeld account. We hebben het nodig om titels en meta descriptions rechtstreeks door te zetten in plaats van ze met de hand te laten overtypen.",
  },
  {
    naam: "Google Bedrijfsprofiel",
    zoek: /bedrijfsprofiel|business|mijn bedrijf/i,
    knop: "Kopieer de aanvraag",
    vraag:
      "Vraag aan {k}: nodig maarten@pingwin.nl uit als beheerder van het Google Bedrijfsprofiel van {k}. Ga naar het profiel, Bedrijfsprofielinstellingen, Mensen en toegang, Toevoegen, rol Beheerder. Daarmee kunnen we de lokale vindbaarheid meten en de gegevens kloppend houden.",
  },
  {
    naam: "Microsoft Clarity",
    zoek: /clarity/i,
    knop: "Kopieer de opdracht",
    vraag:
      "Zet Microsoft Clarity klaar voor {domein} van {k} en laat de bouwer het script in de head van elke pagina plaatsen. Daarmee zien we waar bezoekers vastlopen en hoe ver ze scrollen, en dat kost niets.",
  },
  {
    naam: "Screaming Frog-crawl",
    zoek: /screaming ?frog|crawl/i,
    knop: "Kopieer de opdracht",
    vraag:
      "Draai een Screaming Frog-crawl van {domein} en upload internal_html, inlinks, images_missing_alt en redirect_chains naar de map crawls in het dossier van {k}. Zet er dit bericht bij: Screaming Frog-crawl {k}, verwerk hem in het dossier. Een crawl van hooguit een maand oud is vers genoeg.",
  },
];

/** De vaste uitleg bij een vinkregel, gezocht op de code vooraan ("1a Koppelingen compleet: ..."). */
export function stapUitleg(regelTekst: string, volgnummer: number): OnboardingStap {
  const m = /^\s*(\d[a-z]?)\b/i.exec(String(regelTekst || ""));
  const code = m ? m[1].toLowerCase() : "";
  const gevonden = code ? ONBOARDING_STAPPEN.find((s) => s.code === code) : undefined;
  return (
    gevonden ??
    ONBOARDING_STAPPEN[volgnummer] ?? { code: "", kort: "", wat: "", nu: "", cmd: "" }
  );
}

/** Vult {k} (klantnaam) en {domein} in een opdracht- of aanvraagtekst. */
export function vulOpdracht(sjabloon: string, klantnaam: string, domein: string): string {
  return String(sjabloon || "")
    .replace(/\{k\}/g, klantnaam)
    .replace(/\{domein\}/g, domein || klantnaam);
}
