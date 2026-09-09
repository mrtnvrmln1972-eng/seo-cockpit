"use client";

import { useState } from "react";
import NotitieVeld from "@/app/_components/NotitieVeld";
import { notitiesOpslaanAction } from "./actions";

/**
 * app/klant/[klantslug]/notities/NotitiesKaart.tsx — notities.md lezen en
 * bewerken in hetzelfde vlak.
 *
 * HERZIEN 09-09-2026, op Maartens verzoek. Het was: bovenaan een nette,
 * opgemaakte weergave, en daaronder een tweede kaart "Bewerken" met het
 * tekstveld erin. Wilde je één zin aanpassen, dan moest je eerst naar beneden,
 * die kaart openklappen, en in een kopie van dezelfde tekst gaan zoeken. Zijn
 * woorden: "het voelt raar om daar dan weer in te gaan zitten aanpassen".
 *
 * Nu staat er één kaart met één knop: je leest de nette weergave, je klikt
 * "Bewerken" en op diezelfde plek staat de tekst met de opmaakstrip erboven.
 * Notities is en blijft de plek waar je dingen neergooit, niet een document
 * waar je omheen moet werken.
 */
export default function NotitiesKaart({
  klantSlug,
  md,
  html,
}: {
  klantSlug: string;
  md: string;
  html: string;
}) {
  const [bewerken, setBewerken] = useState(md.trim() === "");

  return (
    <div className="blok kaart">
      <div className="blokkop" style={{ cursor: "default" }}>
        <h3>Notities</h3>
        <span className="kopvuller" />
        <button
          type="button"
          className="pillbtn licht klein"
          onClick={() => setBewerken((b) => !b)}
        >
          {bewerken ? "Klaar" : "Bewerken"}
        </button>
      </div>
      <div className="blokbody">
        {bewerken ? (
          <NotitieVeld
            naam="tekst"
            waarde={md}
            plaatshouder="Alles wat je kwijt wilt over deze klant"
            minHoogte={360}
            opslaan={(tekst) => notitiesOpslaanAction(klantSlug, tekst)}
          />
        ) : (
          <div className="doc" dangerouslySetInnerHTML={{ __html: html }} />
        )}
      </div>
    </div>
  );
}
