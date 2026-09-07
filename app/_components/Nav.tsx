import { getKlantGroepen } from "@/lib/klanten";
import NavLink from "./NavLink";

/**
 * Linker klantenlijst: leest de drie vaste groepen (Eigen klanten, Leads,
 * Multimedia Concepts) via lib/klanten.ts en toont per klant een link naar
 * zijn Roadmap-tab (de eerste van de vier tabbladen). Spec §1.3/§2.2.
 *
 * Server Component die rechtstreeks uit Drive leest — als Drive niet
 * geconfigureerd is (ontbrekende env-vars, zie README.md) faalt dit netjes
 * met een duidelijke melding in plaats van de hele app te laten crashen.
 */
export default async function Nav() {
  let groepen: Awaited<ReturnType<typeof getKlantGroepen>> = [];
  let foutmelding: string | null = null;

  try {
    groepen = await getKlantGroepen();
  } catch (err) {
    foutmelding =
      err instanceof Error ? err.message : "Onbekende fout bij het laden van klanten.";
  }

  if (foutmelding) {
    return (
      <aside className="nav">
        <div className="foutbanner">
          Kan klantenlijst niet laden vanuit Google Drive.
          <br />
          {foutmelding}
        </div>
      </aside>
    );
  }

  return (
    <aside className="nav">
      {groepen.map((groep) => (
        <div className="nav-groep" key={groep.id}>
          <div className="nav-groep-titel">{groep.naam}</div>
          {groep.klanten.length === 0 ? (
            <div className="nav-leeg">Geen klanten</div>
          ) : (
            groep.klanten.map((klant) => (
              <NavLink
                key={klant.slug}
                href={`/klant/${klant.slug}/roadmap`}
                klantSlug={klant.slug}
              >
                {klant.naam}
              </NavLink>
            ))
          )}
        </div>
      ))}
    </aside>
  );
}
