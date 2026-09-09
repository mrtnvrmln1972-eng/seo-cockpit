"use client";

import { useState, useTransition } from "react";
import NavLink from "./NavLink";
import { klantenHerschikkenAction } from "./nav-acties";

/**
 * app/_components/NavKlanten.tsx — de klantenlijst van één groep in de
 * zijbalk, sleepbaar (09-09-2026, op verzoek).
 *
 * Zelfde aanpak als de takenlijst op het werkbord (TakenlijstItems.tsx) en de
 * weekplanning op het Developerbord: native HTML5 drag-and-drop, geen
 * library, en slepen kan alleen als je de greep vasthebt. Dat laatste is hier
 * extra nodig, want elke regel is een link en een link is van zichzelf al
 * sleepbaar; zonder greep zou je bij het aanwijzen van een klant al aan het
 * slepen zijn in plaats van aan het klikken. Het volgnummer vóór de naam is
 * die greep.
 *
 * De nieuwe volgorde wordt bij loslaten in één keer opgeslagen in
 * cockpit-weergave.md (zie lib/weergave.ts). Lukt dat niet, dan springt de
 * lijst terug naar de volgorde die op de server staat, met de melding erbij:
 * beter zichtbaar terug dan een volgorde tonen die niet is opgeslagen.
 */

export interface NavKlant {
  naam: string;
  weergavenaam: string;
  slug: string;
  stil: boolean;
}

export default function NavKlanten({
  groepId,
  klanten,
}: {
  groepId: string;
  klanten: NavKlant[];
}) {
  const [lijst, setLijst] = useState(klanten);
  const [sleept, setSleept] = useState<string | null>(null);
  const [greep, setGreep] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // De server is de baas: komt er een verse lijst binnen (na opslaan, of na
  // een wijziging in KLANTEN.md), dan volgt de lokale lijst die. Dit is de
  // "state bijstellen tijdens renderen"-vorm uit de React-documentatie, niet
  // een effect: een effect zou de oude volgorde eerst nog een keer tekenen.
  const [bron, setBron] = useState(klanten);
  if (bron !== klanten) {
    setBron(klanten);
    setLijst(klanten);
  }

  function opDragOver(slug: string) {
    if (!sleept || sleept === slug) return;
    setLijst((oud) => {
      const van = oud.findIndex((k) => k.slug === sleept);
      const naar = oud.findIndex((k) => k.slug === slug);
      if (van === -1 || naar === -1 || van === naar) return oud;
      const nieuw = [...oud];
      const [verplaatst] = nieuw.splice(van, 1);
      nieuw.splice(naar, 0, verplaatst);
      return nieuw;
    });
  }

  function opDrop() {
    if (!sleept) return;
    setSleept(null);
    setGreep(null);
    setFout(null);
    const volgorde = lijst.map((k) => k.naam);
    startTransition(async () => {
      try {
        await klantenHerschikkenAction(groepId, volgorde);
      } catch (err) {
        setLijst(klanten);
        setFout(err instanceof Error ? err.message : "Kon de volgorde niet opslaan.");
      }
    });
  }

  if (lijst.length === 0) return <p className="navhulp">Geen klanten in deze groep.</p>;

  return (
    <>
      {fout && <p className="navhulp navfout">{fout}</p>}
      {lijst.map((klant, i) => (
        <div
          key={klant.slug}
          className={"navrij" + (sleept === klant.slug ? " navrijSlepend" : "")}
          draggable={greep === klant.slug}
          onDragStart={() => setSleept(klant.slug)}
          onDragOver={(e) => {
            e.preventDefault();
            opDragOver(klant.slug);
          }}
          onDrop={(e) => {
            e.preventDefault();
            opDrop();
          }}
          onDragEnd={() => {
            setSleept(null);
            setGreep(null);
          }}
        >
          <NavLink
            href={`/klant/${klant.slug}/werkbord`}
            klantSlug={klant.slug}
            nr={i + 1}
            stil={klant.stil}
            onGreep={() => setGreep(klant.slug)}
            greepLos={() => setGreep(null)}
          >
            {klant.weergavenaam}
          </NavLink>
        </div>
      ))}
    </>
  );
}
