import { notFound } from "next/navigation";
import { getKlantBySlug } from "@/lib/klanten";
import { leesNotities } from "@/lib/notities";

import { notitiesOpslaanAction } from "./actions";
import Opmaakveld from "@/app/_components/Opmaakveld";
import { renderTekst } from "@/lib/scanbaar";

export const dynamic = "force-dynamic";

/**
 * Notities-tab. Toont notities.md, precies zoals het bestand er staat.
 *
 * In de artifact (vNotities(), zie CLAUDE.md/lib/notities.ts voor hoe die
 * geraadpleegd is) is dit één rijk, zichzelf-bewarend schrijfveld met een
 * opmaakbalk (toggle-blokken, tabellen invoegen, bestanden slepen). Dat is
 * hier bewust NIET overgenomen — zelfde soort vereenvoudiging als de
 * Takenlijst-tab t.o.v. de artifact se taakBlok() (zie lib/werklijst.ts):
 * een gewoon tekstveld met een Opslaan-knop, geen opmaakbalk of
 * bestand-slepen. De INHOUD is wel exact hetzelfde bestand, op dezelfde
 * plek: lezen via dezelfde renderTekst() als de rest van de app, bewerken
 * door de hele tekst te overschrijven (net als bij een gewoon document).
 *
 * Geen vaste structuur verondersteld (zie lib/notities.ts): notities.md is
 * bij elke klant anders — soms een linklijstje, soms een uitgebreid
 * document met koppen en tabellen, soms bijna leeg.
 */
export default async function NotitiesPagina({
  params,
}: {
  params: Promise<{ klantslug: string }>;
}) {
  const { klantslug } = await params;
  const klant = await getKlantBySlug(klantslug);
  if (!klant) notFound();

  if (!klant.mapId) {
    return (
      <div className="paneel">
        <p className="placeholder">Deze klant heeft nog geen dossier in Drive.</p>
      </div>
    );
  }

  let notities: Awaited<ReturnType<typeof leesNotities>> | null = null;
  let foutmelding: string | null = null;
  try {
    notities = await leesNotities(klant.mapId);
  } catch (err) {
    foutmelding = err instanceof Error ? err.message : "Onbekende fout bij het laden van notities.md.";
  }

  if (foutmelding) {
    return (
      <div className="foutbanner">
        Kan notities.md niet laden.
        <br />
        {foutmelding}
      </div>
    );
  }

  const md = notities?.md ?? "";
  const opslaanMetKlant = notitiesOpslaanAction.bind(null, klant.slug);

  return (
    <div>
      {md.trim() ? (
        <div className="blok kaart">
          <div className="blokkop" style={{ cursor: "default" }}>
            <h3>Notities</h3>
          </div>
          <div className="blokbody">
            <div className="doc" dangerouslySetInnerHTML={{ __html: renderTekst(md) }} />
          </div>
        </div>
      ) : (
        <div className="paneel">
          <p className="placeholder">Nog geen notities voor {klant.weergavenaam}.</p>
        </div>
      )}

      <details className="blok kaart">
        <summary className="blokkop">
          <h3>Bewerken</h3>
        </summary>
        <div className="blokbody">
          <form action={opslaanMetKlant}>
            <Opmaakveld naam="tekst" waarde={md} label="Notities" minHoogte={340} />
            <button className="pillbtn sterk" type="submit">
              Opslaan
            </button>
          </form>
        </div>
      </details>
    </div>
  );
}
