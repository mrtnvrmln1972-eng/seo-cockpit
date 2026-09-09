"use client";

import { useState } from "react";

/**
 * Het deelblok bovenaan het Servicepunten-tabblad: de volledige, deelbare
 * link staat er leesbaar bij, met een knop die hem naar het klembord kopieert
 * en een knop die een mailtje opent met de link er al in.
 *
 * De link staat er bewust voluit en zichtbaar, niet verstopt achter alleen een
 * knop: Maarten moet hem ook kunnen doorlezen of met de hand ergens in
 * plakken, zonder eerst te moeten raden waar hij heen wijst.
 */
export default function DeelLink({ url }: { url: string }) {
  const [gekopieerd, setGekopieerd] = useState(false);
  const [fout, setFout] = useState(false);

  async function kopieer() {
    try {
      await navigator.clipboard.writeText(url);
      setFout(false);
      setGekopieerd(true);
      setTimeout(() => setGekopieerd(false), 2500);
    } catch {
      setFout(true);
    }
  }

  const mailto = `mailto:?subject=${encodeURIComponent(
    "Servicepunten Nationaal Oogcentrum",
  )}&body=${encodeURIComponent(
    `Hier staat de stand van zaken van het aansluitproces per vestiging:\n\n${url}\n\nJe kunt de pagina bekijken, er is niets aan te passen.\n`,
  )}`;

  return (
    <div className="deelblok">
      <div className="deelblok-tekst">
        <span className="deelblok-lbl">Deelbare link</span>
        <p>
          Alleen deze servicepunten, alleen om te lezen. Wie de link krijgt, ziet niets anders uit de
          cockpit en kan niets wijzigen.
        </p>
      </div>
      <div className="deelblok-link">
        <a href={url} target="_blank" rel="noreferrer">
          {url}
        </a>
      </div>
      <div className="deelblok-knoppen">
        <button type="button" className="pillbtn sterk" onClick={kopieer}>
          {gekopieerd ? "Gekopieerd" : "Link kopiëren"}
        </button>
        <a className="pillbtn licht" href={mailto}>
          Mailtje openen
        </a>
        {fout && <span className="deelblok-fout">Kopiëren lukte niet, selecteer de link hierboven.</span>}
      </div>
    </div>
  );
}
