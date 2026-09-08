"use client";

import type { ReactNode } from "react";
import type { DevTaakMetKlant } from "@/lib/developerboard";
import { useTaakVenster } from "./TaakVensterContext";

/**
 * Kleine client-knop die het gedeelde TaakVenster opent (zie de doc-comment
 * in TaakVensterContext.tsx voor waarom dit als losse knop moet, niet als
 * inline onClick op een server-gerenderde <button>). Herbruikt in zowel
 * TaakRij (Lijst per klant, page.tsx) als Weekplanning.tsx.
 */
export default function BekijkKnop({
  taak,
  className = "pillbtn licht",
  children = "Bekijk",
}: {
  taak: DevTaakMetKlant;
  className?: string;
  children?: ReactNode;
}) {
  const { openTaak } = useTaakVenster();
  return (
    <button type="button" className={className} onClick={() => openTaak(taak)}>
      {children}
    </button>
  );
}
