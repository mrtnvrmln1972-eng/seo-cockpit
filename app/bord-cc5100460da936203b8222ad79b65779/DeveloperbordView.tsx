"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { DevTaakMetKlant } from "@/lib/developerboard";
import Weekplanning from "./Weekplanning";

/**
 * app/bord-cc5100460da936203b8222ad79b65779/DeveloperbordView.tsx —
 * client-wrapper die de weergave-schakelaar (Lijst per klant / Weekplanning)
 * bijhoudt, 08-09-2026 toegevoegd naar het voorbeeld van de oude
 * pingwin-seo-dashboard.vercel.app.
 *
 * `lijst` is de AL BESTAANDE, server-gerenderde "Lijst per klant"-JSX uit
 * page.tsx (ongewijzigd, inclusief elke <details id="taak-...">-rij) — dit
 * component rendert die gewoon als children/prop, het bouwt zelf geen HTML
 * voor die weergave. Alleen de weekplanning zelf (Weekplanning.tsx) is een
 * nieuw, apart client component, omdat alleen dát stuk interactiviteit nodig
 * heeft (slepen, view-state).
 *
 * onBekijk: een kaart in de weekplanning heeft geen eigen detail-UI (zie de
 * doc-comment in Weekplanning.tsx) — een klik op de titel schakelt hier naar
 * "Lijst per klant" en klapt/scrollt naar de bijbehorende rij open, met
 * dezelfde aanpak als AutoOpenHash.tsx (die alleen bij het laden van de
 * pagina werkt): hier opnieuw bruikbaar omdat de gebruiker al op de pagina
 * staat.
 */
export default function DeveloperbordView({
  taken,
  lijst,
}: {
  taken: DevTaakMetKlant[];
  lijst: ReactNode;
}) {
  const [view, setView] = useState<"lijst" | "week">("week");
  const [pendingAnker, setPendingAnker] = useState<string | null>(null);

  // Actieve taken (open + klaar) horen in de weekplanning; afgerond/vervallen
  // niet meer — zelfde filter als aantalOpen/aantalKlaar in page.tsx, maar
  // hier "of-of" omdat de weekplanning beide statussen samen toont (klaar
  // wacht nog op Maartens beoordeling, dus is nog relevant om in te plannen).
  const actief = taken.filter((t) => {
    const s = t.status.trim().toLowerCase();
    return s !== "afgerond" && s !== "vervallen";
  });

  useEffect(() => {
    if (view !== "lijst" || !pendingAnker) return;
    const anker = pendingAnker;
    setPendingAnker(null);
    // Wacht één tick tot de lijst-JSX (die al in de DOM staat, want lijst is
    // altijd gerenderd — alleen met CSS verborgen, zie hieronder) zichtbaar
    // is voordat er gescrold wordt.
    requestAnimationFrame(() => {
      const el = document.getElementById(anker);
      if (!el) return;
      if (el instanceof HTMLDetailsElement) el.open = true;
      el.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }, [view, pendingAnker]);

  function bekijkInLijst(anker: string) {
    setPendingAnker(anker);
    setView("lijst");
  }

  return (
    <div className="wpwrap">
      <div className="wpToggle">
        <button
          type="button"
          className={`schakelknop${view === "lijst" ? " aan" : ""}`}
          onClick={() => setView("lijst")}
        >
          Lijst per klant
        </button>
        <button
          type="button"
          className={`schakelknop${view === "week" ? " aan" : ""}`}
          onClick={() => setView("week")}
        >
          Weekplanning
        </button>
      </div>

      <div style={{ display: view === "week" ? "block" : "none" }}>
        <Weekplanning taken={actief} onBekijk={bekijkInLijst} />
      </div>
      <div style={{ display: view === "lijst" ? "block" : "none" }}>{lijst}</div>
    </div>
  );
}
