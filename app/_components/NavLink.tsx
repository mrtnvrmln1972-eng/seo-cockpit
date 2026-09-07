"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Client-wrapper rond Link die zichzelf markeert als de huidige route bij deze klant hoort. */
export default function NavLink({
  href,
  klantSlug,
  children,
}: {
  href: string;
  klantSlug: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const actief = pathname?.startsWith(`/klant/${klantSlug}`) ?? false;

  return (
    <Link href={href} className={`nav-klant${actief ? " actief" : ""}`}>
      {children}
    </Link>
  );
}
