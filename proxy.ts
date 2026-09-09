import { NextResponse, type NextRequest } from "next/server";
import { DEEL_HEADER, TOEGANG_COOKIE, isDeelpad, isGeldigeSessie, slotStaatAan } from "@/lib/toegang";

/**
 * proxy.ts — draait vóór elke pagina (in Next 16 heet dit bestand "proxy",
 * de opvolger van "middleware"; het draait op Node.js). Twee taken, allebei
 * uitgelegd in lib/toegang.ts:
 *
 *   1. Op een pagina zonder klantenlijst (een deelpad, of het inlogscherm)
 *      zetten we een header, zodat app/layout.tsx die lijst helemaal weglaat
 *      en er dus geen klantnamen in de broncode belanden. Bij het inlogscherm
 *      is dat geen detail: anders zou wie nog niet is ingelogd in de zijbalk
 *      de namen van alle klanten zien staan, en doet het wachtwoord niets.
 *   2. Al het andere gaat achter het wachtwoord, zodra COCKPIT_WACHTWOORD op
 *      Vercel is ingevuld. Staat die er niet, dan verandert er niets aan hoe
 *      de cockpit nu werkt.
 */
export default function proxy(request: NextRequest) {
  const pad = request.nextUrl.pathname;

  // Deze twee blijven altijd bereikbaar, ook zonder wachtwoord: bij een
  // deelpad is de lange, onraadbare link zelf de sleutel, en op het
  // inlogscherm moet je juist kunnen komen om in te loggen.
  if (isDeelpad(pad) || pad === "/inloggen") {
    const kop = new Headers(request.headers);
    kop.set(DEEL_HEADER, "1");
    return NextResponse.next({ request: { headers: kop } });
  }

  if (!slotStaatAan()) return NextResponse.next();
  if (isGeldigeSessie(request.cookies.get(TOEGANG_COOKIE)?.value)) return NextResponse.next();

  const naarInloggen = request.nextUrl.clone();
  naarInloggen.pathname = "/inloggen";
  naarInloggen.search = "";
  naarInloggen.searchParams.set("verder", `${pad}${request.nextUrl.search}`);
  return NextResponse.redirect(naarInloggen);
}

export const config = {
  /**
   * Alles behalve de dingen die Next.js zelf serveert (de opmaak- en
   * script-bestanden, het icoontje). Zonder deze uitzondering zou het
   * inlogscherm zijn eigen opmaak niet kunnen laden.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
