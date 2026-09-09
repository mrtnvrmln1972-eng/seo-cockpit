import { getKlantGroepen } from "@/lib/klanten";
import Link from "next/link";
import NavKlanten from "./NavKlanten";
import NavZoek from "./NavZoek";

/**
 * Linker klantenlijst — zo dicht mogelijk bij de vormgeving van de
 * bestaande artifact (renderNav()): een "brand"-blok, een zoekveld, en per
 * groep (Eigen klanten / Leads / Multimedia Concepts) een uitklapbare lijst
 * met genummerde klantregels.
 *
 * Sinds 09-09-2026 zijn de klanten binnen een groep te slepen (NavKlanten.tsx)
 * en toont de lijst de korte naam als die in cockpit-weergave.md staat. Alleen
 * "Eigen klanten" staat standaard open: Leads en Multimedia Concepts zijn de
 * langste lijsten en de minst gebruikte, en zo past het geheel weer op één
 * scherm zonder scrollen.
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

      <Link href="/" prefetch={false} className="navlink">
        Overzicht
      </Link>
      <Link href="/bord-cc5100460da936203b8222ad79b65779" prefetch={false} className="navlink">
        Developer
      </Link>

      {foutmelding ? (
        <div className="foutbanner" style={{ marginTop: 16 }}>
          Kan klantenlijst niet laden vanuit Google Drive.
          <br />
          {foutmelding}
        </div>
      ) : (
        groepen.map((groep) => (
          <details className="navgroep" key={groep.id} open={groep.id === "eigen"}>
            <summary className="navgroepkop">
              <span className="chev" />
              <span className="lbl">{groep.naam}</span>
              <span className="tel">{groep.klanten.length}</span>
            </summary>
            <div className="navlijst">
              <NavKlanten
                groepId={groep.id}
                klanten={groep.klanten.map((klant) => ({
                  naam: klant.naam,
                  weergavenaam: klant.weergavenaam,
                  slug: klant.slug,
                  stil: klant.fase.trim().toLowerCase() === "stil",
                }))}
              />
            </div>
          </details>
        ))
      )}
    </aside>
  );
}
