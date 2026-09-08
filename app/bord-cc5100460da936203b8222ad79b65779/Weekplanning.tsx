"use client";

import { useRef, useState, useTransition } from "react";
import type { DevTaakMetKlant } from "@/lib/developerboard";
import { statusClass } from "@/lib/markdown";
import { zetUitvoerdatumAction } from "./actions";

/**
 * app/bord-cc5100460da936203b8222ad79b65779/Weekplanning.tsx — de
 * weekplanning-kalender van het Developerbord, 08-09-2026 gebouwd naar het
 * voorbeeld van de oude pingwin-seo-dashboard.vercel.app (DeveloperOverview.tsx,
 * "week"-weergave): weken scrollen verticaal onder elkaar, elke week is zelf
 * een horizontale Maandag-Zondag rij, en een taakkaart is met de muis naar een
 * andere dag te slepen. Onderaan staat de "nog niet ingepland"-pool.
 *
 * BEWUSTE AFWIJKINGEN t.o.v. de oude versie (kleiner gehouden, zie de
 * doc-comment in lib/developerboard.ts voor de bredere context): geen los
 * taakvenster/mail-knop/"is dit doorgevoerd?" op de kaart zelf — een kaart
 * hier toont alleen klant, titel, status en (indien aanwezig) de gemelde
 * tijdsduur. Alle overige acties (klaar melden, afgerond zetten, mailen,
 * bewerken, volledige context) staan al in de "Lijst per klant"-weergave; een
 * klik op de titel hier schakelt naar die weergave en klapt de bijbehorende
 * rij open (zie onBekijk-prop, aangestuurd door DeveloperbordView.tsx) in
 * plaats van dat dit component die hele rij-UI hier dupliceert.
 *
 * Optimistic UI is bewust WEGGELATEN: net als KlaarMeldenForm/BewerkTaakForm
 * elders in dit bord wacht een wijziging op de servertrip + revalidatePath()
 * (zie actions.ts) voordat de kaart echt van dag wisselt. Bij het slepen zelf
 * geeft de kaart alleen een "bezig"-vervaging als directe feedback dat de
 * sleep is opgepikt.
 */

const WEKEN_TERUG = 8;
const WEKEN_VOORUIT = 16;
const WEEK_OFFSETS = Array.from(
  { length: WEKEN_TERUG + WEKEN_VOORUIT + 1 },
  (_, i) => i - WEKEN_TERUG,
);
const WEEKDAGEN = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"];
const MAANDEN_KORT = [
  "jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec",
];

function maandagVan(offsetWeken: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const dag = (d.getDay() + 6) % 7; // 0 = maandag
  d.setDate(d.getDate() - dag + offsetWeken * 7);
  return d;
}

function isoVan(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function taakSleutel(t: DevTaakMetKlant): string {
  return `${t.klantSlug}|${t.n}`;
}

export default function Weekplanning({
  taken,
  onBekijk,
}: {
  taken: DevTaakMetKlant[];
  onBekijk: (anker: string) => void;
}) {
  const [dragSleutel, setDragSleutel] = useState<string | null>(null);
  const [bezigSleutel, setBezigSleutel] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const huidigeWeekRef = useRef<HTMLDivElement | null>(null);
  const wekenScrollRef = useRef<HTMLDivElement | null>(null);

  const vandaagIso = isoVan(new Date());

  const perDag = new Map<string, DevTaakMetKlant[]>();
  const nietIngepland: DevTaakMetKlant[] = [];
  taken.forEach((t) => {
    if (t.uitvoerdatum) {
      const lijst = perDag.get(t.uitvoerdatum) ?? [];
      lijst.push(t);
      perDag.set(t.uitvoerdatum, lijst);
    } else {
      nietIngepland.push(t);
    }
  });

  function zetDatum(taak: DevTaakMetKlant, datum: string) {
    const sleutel = taakSleutel(taak);
    setBezigSleutel(sleutel);
    setFout(null);
    startTransition(async () => {
      try {
        await zetUitvoerdatumAction(taak.klantSlug, taak.klantFolderId, taak.n, datum);
      } catch (err) {
        setFout(err instanceof Error ? err.message : "Kon de uitvoerdatum niet opslaan.");
      } finally {
        setBezigSleutel(null);
      }
    });
  }

  function opDrop(datum: string) {
    const taak = taken.find((t) => taakSleutel(t) === dragSleutel);
    setDragSleutel(null);
    if (!taak) return;
    if (taak.uitvoerdatum === datum) return;
    zetDatum(taak, datum);
  }

  function kaart(t: DevTaakMetKlant) {
    const sleutel = taakSleutel(t);
    const anker = `taak-${t.klantSlug}-${t.n}`;
    return (
      <div
        key={sleutel}
        className={"wpkaart" + (bezigSleutel === sleutel ? " wpkaartBezig" : "")}
        draggable
        onDragStart={() => setDragSleutel(sleutel)}
        onDragEnd={() => setDragSleutel(null)}
      >
        <div className="wpkaartTop">
          <span className="wpklant">{t.klantNaam}</span>
          <span className={`pill ${statusClass(t.status)}`}>{t.status}</span>
        </div>
        <button
          type="button"
          className="wpTitel"
          onClick={() => onBekijk(anker)}
          title="Bekijk deze taak in de lijst per klant"
        >
          {t.titel}
        </button>
        {t.tijdsduur && <span className="wpMeta">{t.tijdsduur}</span>}
      </div>
    );
  }

  return (
    <div className="wpscherm">
      {fout && <p className="foutregel">{fout}</p>}

      <button
        type="button"
        className="pillbtn licht wpNaarWeek"
        onClick={() => huidigeWeekRef.current?.scrollIntoView({ block: "start", behavior: "smooth" })}
      >
        Naar deze week
      </button>

      <div className="wpWekenScroll" ref={wekenScrollRef}>
        {WEEK_OFFSETS.map((offset) => {
          const weekStart = maandagVan(offset);
          const dagen = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + i);
            return d;
          });
          return (
            <div
              key={offset}
              ref={offset === 0 ? huidigeWeekRef : undefined}
              className={"wpWeekRij" + (offset === 0 ? " wpWeekRijNu" : "")}
            >
              <div className="wpWeekLabel">
                Week van {weekStart.getDate()} {MAANDEN_KORT[weekStart.getMonth()]} {weekStart.getFullYear()}
                {offset === 0 && <span className="wpWeekNuBadge">deze week</span>}
              </div>
              <div className="wpWeekGrid">
                {dagen.map((d, i) => {
                  const iso = isoVan(d);
                  const items = perDag.get(iso) ?? [];
                  return (
                    <div
                      key={iso}
                      className={"wpDag" + (iso === vandaagIso ? " wpDagVandaag" : "")}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        opDrop(iso);
                      }}
                    >
                      <div className="wpDagKop">
                        {WEEKDAGEN[i]}
                        <span>
                          {d.getDate()} {MAANDEN_KORT[d.getMonth()]}
                        </span>
                      </div>
                      <div className="wpDagBody">
                        {items.map((t) => kaart(t))}
                        {items.length === 0 && <div className="wpDagLeeg" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="wpPool"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          opDrop("");
        }}
      >
        <div className="wpPoolKop">Nog niet ingepland ({nietIngepland.length}) — sleep naar een dag</div>
        <div className="wpPoolBody">
          {nietIngepland.map((t) => kaart(t))}
          {nietIngepland.length === 0 && <div className="wpPoolLeeg">Alles is ingepland.</div>}
        </div>
      </div>
    </div>
  );
}
