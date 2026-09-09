import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import Nav from "./_components/Nav";
import ToegangWaarschuwing from "./_components/ToegangWaarschuwing";
import { DEEL_HEADER } from "@/lib/toegang";

export const metadata: Metadata = {
  title: "Pingwin Klantcockpit",
  description: "Klantdossiers rechtstreeks uit Google Drive.",
};

// De klantenlijst wordt live uit Drive gelezen (geen database, zie
// CLAUDE.md), dus de hele app is inherent dynamisch — geen statische
// pre-render nodig/gewenst.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  /**
   * Op een deelpad (zie lib/toegang.ts) renderen we de klantenlijst HELEMAAL
   * NIET. Tot 09-09-2026 werd hij op het Developerbord alleen met CSS
   * weggestopt, en stonden alle klantnamen dus gewoon in de broncode van een
   * pagina die juist aan iemand buiten Pingwin gegeven wordt. Wegstoppen is
   * geen afschermen; niet renderen wel.
   */
  const kop = await headers();
  const isDeel = kop.get(DEEL_HEADER) === "1";

  return (
    <html lang="nl">
      <body>
        <div className="band" />
        {!isDeel && <ToegangWaarschuwing />}
        <div className="shell">
          {!isDeel && <Nav />}
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
