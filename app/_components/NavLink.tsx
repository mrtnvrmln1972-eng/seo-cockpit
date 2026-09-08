"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
  const actief = pathname?.startsWith(`/klant/${klantSlug}`) ?? false;

  return (
    <Link
      href={href}
      prefetch={false}
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
