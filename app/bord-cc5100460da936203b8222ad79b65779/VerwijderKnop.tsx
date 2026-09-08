"use client";

import { useState, useTransition } from "react";
import { verwijderTaakAction } from "./actions";

/**
 * Klein "×"-kruisje om een taak te verwijderen, 08-09-2026 op Maartens
 * verzoek in de header van elke taak (lijst-rij én weekplanning-kaart) — in
 * plaats van de eerdere, grotere "Verwijderen"-knop-met-bevestigingsvak
 * (BewerkTaakForm.tsx) die geen plaats meer heeft in zo'n compacte header.
 * Bevestiging via een native confirm(): voor zo'n klein knopje is een eigen
 * inline bevestigingsblokje onevenredig veel UI.
 */
export default function VerwijderKnop({
  klantSlug,
  klantFolderId,
  n,
  titel,
  className = "kruisknop",
}: {
  klantSlug: string;
  klantFolderId: string;
  n: number;
  titel: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [fout, setFout] = useState<string | null>(null);

  return (
    <span className="kruisknopwrap">
      <button
        type="button"
        className={className}
        title="Verwijderen"
        disabled={pending}
        onClick={(e) => {
          e.stopPropagation();
          if (pending) return;
          if (!window.confirm(`"${titel}" verwijderen?`)) return;
          setFout(null);
          startTransition(async () => {
            try {
              await verwijderTaakAction(klantSlug, (() => {
                const fd = new FormData();
                fd.set("klantFolderId", klantFolderId);
                fd.set("n", String(n));
                return fd;
              })());
            } catch (err) {
              setFout(err instanceof Error ? err.message : "Kon de taak niet verwijderen.");
            }
          });
        }}
      >
        {pending ? "…" : "×"}
      </button>
      {fout && <span className="foutregel foutregelInline">{fout}</span>}
    </span>
  );
}
