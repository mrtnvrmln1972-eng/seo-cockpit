"use client";

import { useState, useTransition } from "react";
import { koppelingWisselenAction } from "./actions";

/**
 * Het vinkje "van toepassing" achter een koppeling. Uit betekent: deze bron
 * speelt niet bij deze klant, dus hij telt niet mee als openstaand.
 *
 * Wat er gebeurt bij het omzetten staat in de titel van de knop, want het is
 * niet omkeerbaar zonder verlies: uitzetten schrijft "niet van toepassing" in
 * de stand, en weer aanzetten geeft "niet gevraagd". Wat er vóór het uitzetten
 * stond weten we dan niet meer, en dat gaan we niet verzinnen.
 */
export default function KoppelingVinkje({
  klantSlug,
  naam,
  vanToepassing,
}: {
  klantSlug: string;
  naam: string;
  vanToepassing: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [fout, setFout] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        className="ob-vink"
        aria-pressed={vanToepassing}
        disabled={pending}
        title={
          vanToepassing
            ? "Zet uit: deze koppeling speelt niet bij deze klant. De stand wordt dan “niet van toepassing”."
            : "Zet aan: deze koppeling speelt wel. De stand wordt dan “niet gevraagd”, want wat er eerder stond is niet bewaard."
        }
        onClick={() => {
          setFout(null);
          startTransition(async () => {
            try {
              await koppelingWisselenAction(klantSlug, naam, !vanToepassing);
            } catch (err) {
              setFout(err instanceof Error ? err.message : "Kon deze koppeling niet opslaan.");
            }
          });
        }}
      >
        {vanToepassing ? "✓" : ""}
      </button>
      {fout && <span className="ob-vinkfout">{fout}</span>}
    </>
  );
}
