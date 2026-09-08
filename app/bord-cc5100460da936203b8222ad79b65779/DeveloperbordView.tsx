"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { DevTaakMetKlant } from "@/lib/developerboard";
import Weekplanning from "./Weekplanning";
import { TaakVensterProvider } from "./TaakVensterContext";
import TaakVenster from "./TaakVenster";

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
 * 08-09-2026, op Maartens feedback: "Bekijk" schakelt NIET meer naar "Lijst
 * per klant" (dat deed de vorige versie wel, via een anker+scroll-truc). In
 * plaats daarvan opent "Bekijk" — vanuit beide weergaven identiek — het
 * gedeelde TaakVenster (zie TaakVensterContext.tsx voor waarom dat via
 * React Context moet). Dit component is dus nu vooral de Provider + de
 * weergave-schakelaar zelf; de vorige pendingAnker/scroll-logica is weg.
 *
 * De #taak-<klantslug>-<n>-ankerlogica (voorheen het losse AutoOpenHash.tsx)
 * is hierheen verhuisd: die moest sowieso weten of de "Lijst per klant"-
 * weergave zichtbaar is, want die staat standaard verborgen (view="week").
 * Zonder deze verhuizing zou een binnenkomende mailto-link altijd in de
 * onzichtbare weekplanning belanden.
 */
export default function DeveloperbordView({
  taken,
  lijst,
}: {
  taken: DevTaakMetKlant[];
  lijst: ReactNode;
}) {
  const [view, setView] = useState<"lijst" | "week">("week");

  // Komt de pagina binnen met #taak-<klantslug>-<n> in de URL (het
  // mailto-linkje, of TaakVenster's eigen "link naar deze taak"), schakel
  // dan naar "Lijst per klant" en klap/scroll naar die rij — zie de
  // doc-comment hierboven.
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash.startsWith("taak-")) return;
    setView("lijst");
    requestAnimationFrame(() => {
      const el = document.getElementById(hash);
      if (!el) return;
      if (el instanceof HTMLDetailsElement) el.open = true;
      el.scrollIntoView({ block: "start" });
    });
  }, []);

  // Actieve taken (open + klaar) horen in de weekplanning; afgerond/vervallen
  // niet meer — zelfde filter als aantalOpen/aantalKlaar in page.tsx, maar
  // hier "of-of" omdat de weekplanning beide statussen samen toont (klaar
  // wacht nog op Maartens beoordeling, dus is nog relevant om in te plannen).
  const actief = taken.filter((t) => {
    const s = t.status.trim().toLowerCase();
    return s !== "afgerond" && s !== "vervallen";
  });

  return (
    <TaakVensterProvider>
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
          <Weekplanning taken={actief} />
        </div>
        <div style={{ display: view === "lijst" ? "block" : "none" }}>{lijst}</div>
      </div>

      <TaakVenster />
    </TaakVensterProvider>
  );
}
