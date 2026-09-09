"use client";

import { useActionState, useEffect } from "react";
import { inloggenAction, type InlogUitkomst } from "./actions";

const BEGIN: InlogUitkomst = { fout: null, verder: null };

export default function InlogForm({ verder }: { verder: string }) {
  const [uitkomst, formAction, bezig] = useActionState(inloggenAction, BEGIN);

  // Bewust een echte paginalading en geen router.push(): alleen zo bouwt
  // Next.js de buitenste laag van de app opnieuw op, mét de klantenlijst die
  // op het inlogscherm juist ontbreekt. Zie de uitleg in actions.ts.
  useEffect(() => {
    if (uitkomst.verder) window.location.replace(uitkomst.verder);
  }, [uitkomst.verder]);

  const wachtOpPagina = uitkomst.verder !== null;

  return (
    <form action={formAction} className="inlogform">
      <input type="hidden" name="verder" value={verder} />
      <div className="metaveld">
        <label htmlFor="wachtwoord">Wachtwoord</label>
        <input
          id="wachtwoord"
          name="wachtwoord"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
        />
      </div>
      {uitkomst.fout && <p className="foutregel">{uitkomst.fout}</p>}
      <div className="acties">
        <button className="pillbtn sterk" type="submit" disabled={bezig || wachtOpPagina}>
          {bezig || wachtOpPagina ? "Bezig…" : "Inloggen"}
        </button>
      </div>
    </form>
  );
}
