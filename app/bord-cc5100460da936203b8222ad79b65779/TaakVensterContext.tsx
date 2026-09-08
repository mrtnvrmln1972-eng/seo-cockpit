"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { DevTaakMetKlant } from "@/lib/developerboard";

/**
 * app/bord-cc5100460da936203b8222ad79b65779/TaakVensterContext.tsx —
 * 08-09-2026 toegevoegd op Maartens verzoek: "Bekijk" moet vanuit ZOWEL de
 * "Lijst per klant" (TaakRij, server-gerenderd in page.tsx) ALS de
 * weekplanning-kaart (Weekplanning.tsx, client) dezelfde popup openen, zonder
 * dat een klik in de weekplanning naar de lijst-weergave overschakelt.
 *
 * Een gewone prop zou hier niet werken: TaakRij's JSX wordt gebouwd in het
 * server component page.tsx en als kant-en-klare children doorgegeven aan
 * DeveloperbordView (client) — er is geen rechtstreekse call-pad terug
 * omhoog. React Context lost dit standaard Next.js-patroon op: zolang de
 * knop die het venster opent zelf een "use client"-component is (BekijkKnop/
 * VerwijderKnop hieronder), maakt het niet uit of hij oorspronkelijk in een
 * server- of client-boom is opgebouwd — hij mag nog steeds de context van
 * een client-voorouder (DeveloperbordView) lezen, zolang hij ergens ONDER die
 * <TaakVensterProvider> terechtkomt in de gerenderde boom (wat hier het geval
 * is, want DeveloperbordView rendert de hele "lijst"-prop binnen zijn eigen
 * Provider).
 */

interface TaakVensterContextWaarde {
  open: DevTaakMetKlant | null;
  openTaak: (taak: DevTaakMetKlant) => void;
  sluitTaak: () => void;
}

const TaakVensterContext = createContext<TaakVensterContextWaarde | null>(null);

export function TaakVensterProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<DevTaakMetKlant | null>(null);

  return (
    <TaakVensterContext.Provider
      value={{
        open,
        openTaak: (taak) => setOpen(taak),
        sluitTaak: () => setOpen(null),
      }}
    >
      {children}
    </TaakVensterContext.Provider>
  );
}

export function useTaakVenster(): TaakVensterContextWaarde {
  const ctx = useContext(TaakVensterContext);
  if (!ctx) {
    throw new Error("useTaakVenster() moet binnen een <TaakVensterProvider> gebruikt worden.");
  }
  return ctx;
}
