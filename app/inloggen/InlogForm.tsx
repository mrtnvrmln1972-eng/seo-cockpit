"use client";

import { useActionState } from "react";
import { inloggenAction } from "./actions";

export default function InlogForm({ verder }: { verder: string }) {
  const [fout, formAction, bezig] = useActionState(inloggenAction, null);

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
      {fout && <p className="foutregel">{fout}</p>}
      <div className="acties">
        <button className="pillbtn sterk" type="submit" disabled={bezig}>
          {bezig ? "Bezig…" : "Inloggen"}
        </button>
      </div>
    </form>
  );
}
