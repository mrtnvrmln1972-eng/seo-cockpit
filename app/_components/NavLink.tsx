"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

/**
 * Eén klantregel in de navigatie (artifact: .navlink). Client-wrapper rond
 * Link zodat hij zichzelf markeert als de huidige route bij deze klant
 * hoort. `nr` is een pure volgnummer-badge (positie in de lijst, geen
 * berekend belang); `stil` dimt de regel als de klant op fase "stil" staat
 * — beide rechtstreeks afgeleid van data uit KLANTEN.md, geen eigen
 * weging (CLAUDE.md: "een dashboard mag tonen, nooit oordelen").
 *
 * prefetch={false} (08-09-2026, gevonden bij het uitzoeken van sporadische
 * "Er ging iets mis"-meldingen door de hele cockpit heen): elke klantregel
 * hier staat in beeld zodra de zijbalk rendert, en Next prefetcht standaard
 * ELKE zichtbare Link — voor al onze ~27 klanten tegelijk, en elke
 * werkbord-pagina is force-dynamic en leest zelf meerdere Drive-bestanden.
 * Eén paginalading kon zo tientallen extra Drive-aanroepen in de
 * achtergrond triggeren, bovenop de aanroep die je zelf deed — genoeg om
 * Drive's ratelimiet te raken en een schrijfactie (Nieuwe taak, Klaar
 * melden) te laten mislukken met een onduidelijke serverfout. Live
 * gereproduceerd: de zijbalk prefetchte alle klanten tegelijk en
 * Nationaal Oogcentrum kwam terug met een 503 van Drive.
 *
 * VOORLADEN BIJ AANWIJZEN (09-09-2026, omdat het wisselen tussen klanten
 * traag aanvoelde): prefetch={false} betekent in Next 16 dat er ook bij
 * hover NIETS wordt voorgeladen (nagelezen in de documentatie van de
 * Link-component, niet uit het hoofd). Elke klik wachtte dus op een
 * volledige serverrender. Daarom laden we hier zelf voor zodra je een regel
 * aanwijst of hem met de toetsenbordfocus raakt: dat is één klant tegelijk,
 * de klant die je waarschijnlijk gaat openen, in plaats van alle
 * zevenentwintig ineens. De ratelimiet-oorzaak hierboven blijft daarmee
 * afgedekt, en de klik zelf voelt direct. Eén keer per regel, want een
 * herhaalde prefetch is een herhaalde serverrender.
 */
export default function NavLink({
  href,
  klantSlug,
  nr,
  stil,
  children,
}: {
  href: string;
  klantSlug: string;
  nr: number;
  stil?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const alVoorgeladen = useRef(false);
  const actief = pathname?.startsWith(`/klant/${klantSlug}`) ?? false;

  function laadVoor() {
    if (alVoorgeladen.current || actief) return;
    alVoorgeladen.current = true;
    router.prefetch(href);
  }

  return (
    <Link
      href={href}
      prefetch={false}
      onMouseEnter={laadVoor}
      onFocus={laadVoor}
      onTouchStart={laadVoor}
      aria-current={actief ? "true" : undefined}
      className={`navlink${stil ? " stil" : ""}`}
      data-naam={typeof children === "string" ? children.toLowerCase() : undefined}
    >
      <span className="nr">{nr}</span>
      <span className="stip" />
      {children}
    </Link>
  );
}
