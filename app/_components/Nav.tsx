import { getKlantGroepen } from "@/lib/klanten";
import Link from "next/link";
import NavLink from "./NavLink";
import NavZoek from "./NavZoek";

/**
 * Linker klantenlijst — zo dicht mogelijk bij de vormgeving van de
 * bestaande artifact (renderNav()): een "brand"-blok, een zoekveld, en per
 * groep (Eigen klanten / Leads / Multimedia Concepts) een uitklapbare lijst
 * met genummerde klantregels. Drag-and-drop-herordenen uit de artifact is
 * bewust (nog) niet overgenomen — die vraagt een client-side volgorde-
 * state die hier nog niet bestaat; zie CLAUDE.md voor wat er nog ontbreekt.
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

  return (
    <aside className="nav">
      <div className="brand">
        <span className="mark">P</span>
        <div>
          <h1>Klantcockpit</h1>
          <p>Pingwin</p>
        </div>
      </div>

      <NavZoek />

      <Link href="/" className="navlink">
        Overzicht
      </Link>

      {foutmelding ? (
        <div className="foutbanner" style={{ marginTop: 16 }}>
          Kan klantenlijst niet laden vanuit Google Drive.
          <br />
          {foutmelding}
        </div>
      ) : (
        groepen.map((groep) => (
          <details className="navgroep" key={groep.id} open>
            <summary className="navgroepkop">
              <span className="chev" />
              <span className="lbl">{groep.naam}</span>
              <span className="tel">{groep.klanten.length}</span>
            </summary>
            <div className="navlijst">
              {groep.klanten.length === 0 ? (
                <p className="navhulp">Geen klanten in deze groep.</p>
              ) : (
                groep.klanten.map((klant, i) => (
                  <NavLink
                    key={klant.slug}
                    href={`/klant/${klant.slug}/werkbord`}
                    klantSlug={klant.slug}
                    nr={i + 1}
                    stil={klant.fase.trim().toLowerCase() === "stil"}
                  >
                    {klant.naam}
                  </NavLink>
                ))
              )}
            </div>
          </details>
        ))
      )}
    </aside>
  );
}
