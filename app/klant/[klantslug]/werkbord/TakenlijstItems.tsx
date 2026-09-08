"use client";

import { useEffect, useState, useTransition } from "react";
import { statusClass } from "@/lib/markdown";
import { herschikTakenAction } from "./actions";
import DoorzettenKnop from "./DoorzettenKnop";

/**
 * app/klant/[klantslug]/werkbord/TakenlijstItems.tsx — de platte, sleepbare
 * takenlijst zelf, 08-09-2026 op Maartens verzoek uit page.tsx getrokken naar
 * een eigen client component: de groepering per "Stap" (Onboarding/Techniek/
 * ...) is diezelfde dag verwijderd (zie de doc-comment in page.tsx) en
 * daarvoor in de plaats kunnen taken nu zelf in volgorde gesleept worden —
 * dat kan alleen met client-side interactiviteit, dus dit stuk kan niet
 * langer een server-gerenderde `<details>`-lijst blijven zoals de rest van
 * de tab.
 *
 * blokken/mailHref/status komen kant-en-klaar (HTML al gerenderd via
 * renderAlineas op de server) binnen als props — dezelfde toelichting-
 * splitsing als voorheen, alleen nu in page.tsx berekend en hierheen
 * doorgegeven, in plaats van inline in de JSX.
 *
 * Slepen: zelfde native HTML5 drag-and-drop-aanpak als Weekplanning.tsx op
 * het Developerbord (geen library). Tijdens het slepen wordt de lokale
 * lijst live herschikt voor direct visueel effect; bij loslaten wordt de
 * nieuwe volgorde in ÉÉN keer opgeslagen via herschikTakenAction (geen
 * optimistic-UI-gedoe nodig omdat de lijst al lokaal herschikt is). Een
 * revalidatePath() ververst daarna de props vanaf de server; de useEffect
 * hieronder synchroniseert de lokale lijst dan weer met die verse volgorde.
 */

export interface TaakItemBlok {
  label: string;
  html: string;
}

export interface TaakItem {
  n: number;
  titel: string;
  status: string;
  blokken: TaakItemBlok[];
  mailHref: string;
}

export default function TakenlijstItems({
  klantSlug,
  items,
}: {
  klantSlug: string;
  items: TaakItem[];
}) {
  const [lijst, setLijst] = useState(items);
  const [dragN, setDragN] = useState<number | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Ververst de lokale (mogelijk gesleepte) lijst zodra page.tsx opnieuw
  // rendert met verse server-data (revalidatePath, of gewoon een nieuwe
  // paginabezoek) — anders zou een sleepactie van een ANDERE sessie, of een
  // nieuwe taak die intussen is toegevoegd, hier niet doorkomen.
  useEffect(() => {
    setLijst(items);
  }, [items]);

  function opDragStart(n: number) {
    setDragN(n);
  }

  function opDragOverRij(overN: number) {
    if (dragN === null || dragN === overN) return;
    setLijst((huidig) => {
      const vanIdx = huidig.findIndex((t) => t.n === dragN);
      const naarIdx = huidig.findIndex((t) => t.n === overN);
      if (vanIdx < 0 || naarIdx < 0) return huidig;
      const kopie = huidig.slice();
      const [item] = kopie.splice(vanIdx, 1);
      kopie.splice(naarIdx, 0, item);
      return kopie;
    });
  }

  function opDrop() {
    if (dragN === null) return;
    setDragN(null);
    setFout(null);
    const volgordeNs = lijst.map((t) => t.n);
    startTransition(async () => {
      try {
        await herschikTakenAction(klantSlug, volgordeNs);
      } catch (err) {
        setFout(err instanceof Error ? err.message : "Kon de volgorde niet opslaan.");
      }
    });
  }

  return (
    <div className="blok kaart">
      <div className="blokkop" style={{ cursor: "default" }}>
        <h3>Taken</h3>
        <span className="c">{lijst.length}</span>
      </div>
      <div className="blokbody">
        {fout && <p className="foutregel">{fout}</p>}
        <div className="binnenlijst">
          {lijst.map((taak) => (
            <details
              className={"binnenrij" + (dragN === taak.n ? " binnenrijSlepend" : "")}
              key={taak.n}
              draggable
              onDragStart={() => opDragStart(taak.n)}
              onDragOver={(e) => {
                e.preventDefault();
                opDragOverRij(taak.n);
              }}
              onDrop={(e) => {
                e.preventDefault();
                opDrop();
              }}
              onDragEnd={() => setDragN(null)}
            >
              <summary className="binnenregel">
                <span className="sleepgreep" title="Sleep om te herschikken">
                  ⠿
                </span>
                <span className="binnenkop">
                  <span className="tk">{taak.titel}</span>
                  <span className="chev2" />
                </span>
                <span className="binnenmeta">
                  {taak.status && taak.status.toLowerCase() !== "open" && (
                    <span className={`pill ${statusClass(taak.status)}`}>{taak.status}</span>
                  )}
                </span>
              </summary>

              <div className="binnenbody">
                {taak.blokken.length === 0 ? (
                  <p>Nog geen toelichting.</p>
                ) : (
                  taak.blokken.map((blok, bi) => (
                    <div key={bi}>
                      <h6>{blok.label}</h6>
                      {blok.html ? (
                        <div dangerouslySetInnerHTML={{ __html: blok.html }} />
                      ) : (
                        <p>—</p>
                      )}
                    </div>
                  ))
                )}

                <div className="acties">
                  <DoorzettenKnop klantSlug={klantSlug} n={taak.n} />
                  <a className="pillbtn licht" href={taak.mailHref}>
                    Mailen naar Tonny
                  </a>
                </div>
              </div>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
