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
