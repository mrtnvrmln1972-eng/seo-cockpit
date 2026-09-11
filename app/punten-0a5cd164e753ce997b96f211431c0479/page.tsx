import { getKlantBySlug } from "@/lib/klanten";
import {
  NOC_SLUG,
  leesServicepunten,
  type ServicepuntenDossier,
} from "@/lib/servicepunten";
import ServicepuntenView from "@/app/klant/[klantslug]/servicepunten/ServicepuntenView";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Servicepunten — Nationaal Oogcentrum",
  robots: { index: false, follow: false },
};

/**
 * De deelbare servicepuntenpagina van Nationaal Oogcentrum.
 *
 * Het lange, willekeurige stuk in de route-naam IS de toegangsbeveiliging
 * ("alleen-zij-link"), precies zoals bij het Developerbord: wie de URL niet
 * kent, komt er niet. Deze route staat daarom in DEELPADEN in lib/toegang.ts,
 * zodat hij ook open blijft als de rest van de cockpit achter het wachtwoord
 * zit — en zodat app/layout.tsx de klantenlijst hier helemaal niet rendert,
 * en er dus geen andere klantnamen in de broncode van deze pagina staan.
 *
 * HETZELFDE SCHERM ALS IN DE COCKPIT, EN OOK TE BEWERKEN (11-09-2026, op
 * verzoek van Maarten: "kun je dit overzicht via de deelbare link er exact zo
 * uit laten zien als in mijn eigen dashboard, zonder de klanten links, en dat
 * iemand anders die die link heeft er ook dingen in kan aanpassen").
 *
 * Daarmee vervalt de eerdere keuze van 09-09-2026 (alleen lezen), en dat is
 * bewust: wie deze link heeft mag nu hetzelfde als Maarten op deze ene tab.
 * De link zelf is de sleutel; doorsturen is dus schrijfrecht weggeven op
 * servicepunten.md. Verder komt er niets mee: alleen dít dossier, geen
 * klantenlijst, geen andere tab.
 *
 * En bewust GEEN tweede uitvoering van hetzelfde scherm meer. Hier stond een
 * eigen, met de hand nagebouwde alleen-lezen weergave van 265 regels. Die
 * liep bij elke wijziging aan de echte tab verder achter: de kolom met de
 * link bij een stap, de foto-stap en de reden op de kaart zaten er alle drie
 * niet in. Eén scherm, één bron; hetzelfde argument als overal elders in dit
 * project.
 */
export default async function GedeeldeServicepuntenPagina() {
  const klant = await getKlantBySlug(NOC_SLUG);

  if (!klant?.mapId) {
    return (
      <div data-bord-secret className="paneel">
        <p className="placeholder">Het dossier van Nationaal Oogcentrum is nu niet bereikbaar.</p>
      </div>
    );
  }

  let dossier: ServicepuntenDossier | null = null;
  let foutmelding: string | null = null;
  try {
    dossier = await leesServicepunten(klant.mapId);
  } catch (err) {
    foutmelding = err instanceof Error ? err.message : "Onbekende fout bij het laden van servicepunten.md.";
  }

  if (foutmelding || !dossier) {
    return (
      <div data-bord-secret className="foutbanner">
        Kan de servicepunten nu niet laden.
        <br />
        {foutmelding}
      </div>
    );
  }

  if (!dossier.bestand && dossier.vestigingen.length === 0) {
    return (
      <div data-bord-secret className="paneel">
        <p className="placeholder">Er staan nog geen servicepunten in het dossier.</p>
      </div>
    );
  }

  /**
   * Eén kopregel erboven, en die staat er niet voor de sier: in de cockpit
   * weet je uit de tabbalk en de klantenlijst waar je bent, hier begint de
   * pagina koud met vier tegels. En wie deze link krijgt moet weten dat wat
   * hij aanvinkt of typt echt in het gedeelde dossier landt.
   *
   * Geen deelLink-knop: je kijkt al naar de gedeelde pagina.
   */
  return (
    <div data-bord-secret>
      <div className="deelkop">
        <h1>Servicepunten &middot; {klant.weergavenaam}</h1>
        <p>
          Dit is hetzelfde overzicht als in de Pingwin-cockpit. Wat je hier aanpast, aanvinkt of
          versleept wordt meteen bewaard en zien wij ook.
        </p>
      </div>
      <ServicepuntenView klantSlug={klant.slug} dossier={dossier} />
    </div>
  );
}
