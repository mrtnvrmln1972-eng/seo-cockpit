"use client";

import { useEffect, useState, useTransition } from "react";
import { statusClass } from "@/lib/markdown";
import { herschikTakenAction, taakVerwijderenAction, taakAfvinkenAction } from "./actions";
import NieuweTaakForm from "./NieuweTaakForm";
import BewerkTaak from "./BewerkTaak";
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
  /** Vaste kleur bij een van de drie standaard labels, zie kleurVoorLabel() in page.tsx. */
  kleur?: "roze" | "blauw" | "groen";
}

export interface TaakItem {
  n: number;
  titel: string;
  status: string;
  blokken: TaakItemBlok[];
  mailHref: string;
  /** De onbewerkte tekst uit toelichting.md, voor het bewerkveld. */
  toelichtingRuw: string;
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
  /**
   * Welke taak nu om een bevestiging vraagt om weggegooid te worden. Een
   * kruisje dat meteen wist is te makkelijk misgeklikt in een lijst waar je
   * ook in sleept, en wat hier weg is, is weg uit het dossierbestand in Drive.
   */
  const [weggooienN, setWeggooienN] = useState<number | null>(null);
  /** Staat het formulier voor een nieuwe taak open? Knop zit in de kopbalk. */
  const [nieuweTaak, setNieuweTaak] = useState(false);
  /** Staat de lijst met afgevinkte taken open? Standaard dicht. */
  const [afgevinktOpen, setAfgevinktOpen] = useState(false);
  /**
   * Welke rij op dit moment gesleept MAG worden. Stond eerst vast op elke
   * rij (draggable op de hele <details>), en dat maakte de tekst in een taak
   * onselecteerbaar: de browser begint bij ingedrukte muis dan een sleep in
   * plaats van een selectie, dus kopiëren en plakken lukte niet
   * (09-09-2026). Nu zet je hem alleen aan door de greep vast te pakken.
   */
  const [greepN, setGreepN] = useState<number | null>(null);
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

  function vinkAf(n: number, afgevinkt: boolean) {
    setFout(null);
    setLijst((oud) =>
      oud.map((t) => (t.n === n ? { ...t, status: afgevinkt ? "klaar" : "open" } : t)),
    );
    startTransition(async () => {
      try {
        await taakAfvinkenAction(klantSlug, n, afgevinkt);
      } catch {
        setLijst(items);
        setFout("Afvinken lukte niet. Probeer het zo nog eens.");
      }
    });
  }

  function gooiWeg(n: number) {
    setWeggooienN(null);
    setFout(null);
    // Meteen uit de lijst halen, anders staat de taak er tot de server
    // klaar is nog gewoon tussen en lijkt het kruisje niets te doen.
    setLijst((oud) => oud.filter((t) => t.n !== n));
    startTransition(async () => {
      try {
        await taakVerwijderenAction(klantSlug, n);
      } catch (err) {
        setLijst(items);
        setFout(err instanceof Error ? err.message : "Kon de taak niet weggooien.");
      }
    });
  }

  const open = lijst.filter((t) => !/klaar|vervallen/i.test(t.status));
  const afgevinkt = lijst.filter((t) => /klaar|vervallen/i.test(t.status));

  function rij(taak: TaakItem) {
    return (
            <details
              className={"binnenrij" + (dragN === taak.n ? " binnenrijSlepend" : "")}
              key={taak.n}
              draggable={greepN === taak.n}
              onDragStart={() => opDragStart(taak.n)}
              onDragOver={(e) => {
                e.preventDefault();
                opDragOverRij(taak.n);
              }}
              onDrop={(e) => {
                e.preventDefault();
                opDrop();
              }}
              onDragEnd={() => {
                setDragN(null);
                setGreepN(null);
              }}
            >
              <summary className="binnenregel">
                <span
                  className="sleepgreep"
                  title="Sleep om te herschikken"
                  onMouseDown={() => setGreepN(taak.n)}
                  onTouchStart={() => setGreepN(taak.n)}
                  onMouseUp={() => setGreepN(null)}
                >
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
                  {weggooienN === taak.n ? (
                    <span className="weggooivraag">
                      <span className="weggooitekst">Weggooien?</span>
                      <button
                        type="button"
                        className="pillbtn sterk klein"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          gooiWeg(taak.n);
                        }}
                      >
                        Ja
                      </button>
                      <button
                        type="button"
                        className="pillbtn licht klein"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setWeggooienN(null);
                        }}
                      >
                        Nee
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="weggooikruis"
                      title="Deze taak weggooien"
                      aria-label={`Taak "${taak.titel}" weggooien`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setWeggooienN(taak.n);
                      }}
                    >
                      ×
                    </button>
                  )}
                </span>
              </summary>

              <div className="binnenbody">
                {/*
                  Een open taak toont meteen de tekst zelf, met de opmaakstrip
                  erboven (09-09-2026, op verzoek). Hier stonden eerst de
                  opgemaakte blokken én daaronder een apart bewerkformulier met
                  dezelfde tekst er nog een keer in; je moest dus eerst iets
                  aanklikken om te mogen wijzigen, en zag alles dubbel.
                */}
                <BewerkTaak
                  klantSlug={klantSlug}
                  n={taak.n}
                  titel={taak.titel}
                  toelichting={taak.toelichtingRuw}
                  onOpgeslagen={(nieuweTitel, nieuweToelichting) =>
                    setLijst((oud) =>
                      oud.map((t) =>
                        t.n === taak.n
                          ? { ...t, titel: nieuweTitel, toelichtingRuw: nieuweToelichting }
                          : t,
                      ),
                    )
                  }
                />

                <div className="acties">
                  <button
                    type="button"
                    className={
                      "pillbtn " + (/klaar|vervallen/i.test(taak.status) ? "klaarknop" : "licht")
                    }
                    onClick={() => vinkAf(taak.n, !/klaar|vervallen/i.test(taak.status))}
                  >
                    {/klaar|vervallen/i.test(taak.status) ? "Afgevinkt" : "Afvinken"}
                  </button>
                  <DoorzettenKnop klantSlug={klantSlug} n={taak.n} />
                  <a className="pillbtn licht" href={taak.mailHref}>
                    Mailen naar Tonny
                  </a>
                </div>
              </div>
            </details>
    );
  }

  return (
    <div className="blok kaart">
      <div className="blokkop" style={{ cursor: "default" }}>
        <h3>Taken</h3>
        <span className="c">{open.length}</span>
        <span className="kopvuller" />
        <button
          type="button"
          className="pillbtn sterk klein"
          onClick={() => setNieuweTaak((b) => !b)}
        >
          {nieuweTaak ? "Sluiten" : "Nieuwe taak"}
        </button>
      </div>
      <div className="blokbody">
        {nieuweTaak && (
          <div className="nieuwetaakvak">
            <NieuweTaakForm klantSlug={klantSlug} onKlaar={() => setNieuweTaak(false)} />
          </div>
        )}
        {fout && <p className="foutregel">{fout}</p>}
        <div className="binnenlijst">{open.map((taak) => rij(taak))}</div>

        {afgevinkt.length > 0 && (
          <div className="afgevinktblok">
            <div className="afgevinktregel">
              <button
                type="button"
                className="afgevinktlink"
                onClick={() => setAfgevinktOpen((b) => !b)}
                aria-expanded={afgevinktOpen}
              >
                {afgevinktOpen ? "Verberg" : "Toon"} afgevinkte taken ({afgevinkt.length})
              </button>
            </div>
            {afgevinktOpen && <div className="binnenlijst">{afgevinkt.map((taak) => rij(taak))}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
