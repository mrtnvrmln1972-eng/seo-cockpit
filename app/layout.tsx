import type { Metadata } from "next";
import "./globals.css";
import Nav from "./_components/Nav";

export const metadata: Metadata = {
  title: "Pingwin Klantcockpit",
  description: "Klantdossiers rechtstreeks uit Google Drive.",
};

// De klantenlijst wordt live uit Drive gelezen (geen database, zie
// CLAUDE.md), dus de hele app is inherent dynamisch — geen statische
// pre-render nodig/gewenst.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body>
        <div className="band" />
        <div className="shell">
          <Nav />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
