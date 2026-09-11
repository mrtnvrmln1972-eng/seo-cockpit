"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * app/_components/sleep-volgorde.ts — rijen op volgorde slepen, met gewone
 * aanwijs-gebeurtenissen in plaats van het HTML5-sleepmechanisme.
 *
 * Waarom niet HTML5 (11-09-2026). Dat mechanisme is niet na te meten: in een
 * echte browser hier komt een sleep botweg niet op gang, ook niet met een
 * schermsessie erbij en ook niet als het element van tevoren al sleepbaar
 * staat. En het patroon dat de Volgorde-tab gebruikte, `draggable` pas
 * aanzetten zodra je de greep vasthebt, hangt bovendien aan het moment waarop
 * de browser besluit dat er een sleep begint; dat is per browser anders.
 * Aanwijs-gebeurtenissen werken overal hetzelfde, werken met een vinger, en
 * zijn wél te bewijzen.
 *
 * Hoe je het gebruikt:
 * - zet `data-sleep-id="<id>"` op elke rij die meedoet;
 * - zet `onPointerDown={(e) => sleep.start(id, e)}` op de greep;
 * - `sleep.sleept` is het id dat op dit moment in de hand zit.
 *
 * `verschuif` wordt aangeroepen zodra de aanwijzer boven een ándere rij komt,
 * en zet die twee om; dat is dezelfde beweging als eerst. Zodra de knop
 * loslaat volgt `klaar`, en dáár hoort het opslaan.
 */
export interface SleepVolgorde {
  /** De volgorde zoals hij nu op het scherm hoort te staan. */
  ids: string[];
  /** Welk id op dit moment in de hand zit, of null. */
  sleept: string | null;
  /** Op de greep zetten: hiermee begint het slepen. */
  start: (id: string, e: React.PointerEvent) => void;
}

export function useSleepVolgorde(
  /** De volgorde zoals de server hem geeft. Verandert die, dan wint hij. */
  idsVanServer: string[],
  /**
   * Wordt aangeroepen bij loslaten, met de nieuwe volgorde en met de knop om
   * terug te vallen op de volgorde van de server. Die knop komt hier mee en
   * staat niet in de teruggave, zodat de aanroeper hem kan gebruiken zonder
   * naar zichzelf te hoeven verwijzen terwijl hij nog gemaakt wordt.
   */
  opLoslaten: (ids: string[], herstel: () => void) => void,
): SleepVolgorde {
  const [eigen, setEigen] = useState<string[] | null>(null);
  const [sleept, setSleept] = useState<string | null>(null);
  const ids = eigen ?? idsVanServer;

  // De server is de baas: komt er verse data binnen, dan gaat een eigen
  // volgorde weg. Bijgesteld tijdens het renderen en niet in een effect: een
  // effect zou de oude volgorde eerst nog een keer tekenen.
  const [bron, setBron] = useState(idsVanServer);
  if (bron !== idsVanServer) {
    setBron(idsVanServer);
    setEigen(null);
  }

  // Alles wat de luisteraar hieronder nodig heeft, ververst na elke render.
  // Zo hoeft hij niet bij elke muisbeweging opnieuw opgehangen te worden, en
  // slaat het loslaten precies op wat er op dat moment staat.
  const nu = useRef({ ids, opLoslaten });
  useEffect(() => {
    nu.current = { ids, opLoslaten };
  });

  const start = useCallback((id: string, e: React.PointerEvent) => {
    // Anders begint de browser tekst te selecteren zodra je gaat schuiven.
    e.preventDefault();
    setSleept(id);
  }, []);

  useEffect(() => {
    if (!sleept) return;

    function beweeg(e: PointerEvent) {
      const onder = document.elementFromPoint(e.clientX, e.clientY);
      const rij = onder?.closest("[data-sleep-id]");
      const doel = rij?.getAttribute("data-sleep-id");
      // Boven de rij die je zelf vasthebt valt niets te wisselen; daardoor
      // komt het omwisselen ook nooit in een lus terecht.
      if (!doel || doel === sleept) return;
      setEigen((oud) => verschuifIn(oud ?? nu.current.ids, sleept!, doel));
    }

    function los() {
      setSleept(null);
      nu.current.opLoslaten(nu.current.ids.slice(), () => setEigen(null));
    }

    window.addEventListener("pointermove", beweeg);
    window.addEventListener("pointerup", los);
    window.addEventListener("pointercancel", los);
    return () => {
      window.removeEventListener("pointermove", beweeg);
      window.removeEventListener("pointerup", los);
      window.removeEventListener("pointercancel", los);
    };
  }, [sleept]);

  return { ids, sleept, start };
}

/** Eén id voor een ander schuiven in een lijst. Geeft dezelfde lijst terug als er niets verandert. */
export function verschuifIn(lijst: string[], sleeptId: string, doelId: string): string[] {
  const van = lijst.indexOf(sleeptId);
  const naar = lijst.indexOf(doelId);
  if (van === -1 || naar === -1 || van === naar) return lijst;
  const nieuw = lijst.slice();
  const [verplaatst] = nieuw.splice(van, 1);
  nieuw.splice(naar, 0, verplaatst);
  return nieuw;
}
