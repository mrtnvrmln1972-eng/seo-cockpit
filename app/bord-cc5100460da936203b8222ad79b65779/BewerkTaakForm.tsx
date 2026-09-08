"use client";

import { useState, useTransition } from "react";
import { bewerkTaakAction, verwijderTaakAction } from "./actions";

/**
 * Bewerken/verwijderen van een bestaande taak op het Developerbord
 * (08-09-2026, "Lijst per klant"-restyle). Zelfde client-component-patroon
 * als KlaarMeldenForm.tsx: pas na een klik verschijnt het formulier
 * (lokale, niet-persistente UI-state), en een mislukte inzending toont een
 * leesbare melding in het formulier zelf in plaats van de pagina te laten
 * crashen — vandaar de eigen try/catch rond de server actions.
 *
 * Bewust ÉÉN component voor zowel bewerken als verwijderen: beide acties
 * horen bij dezelfde taakrij, delen dezelfde drie verborgen velden
 * (klantFolderId/n) en dezelfde idle-knoppenrij, en scheiden ze op zou alleen
 * dubbele props/boilerplate opleveren zonder dat er iets herbruikbaars mee
 * wordt gewonnen.
 *
 * Bewust GEEN Notion-stijl toolbar (bold/lijst/link-knoppen) op het
 * detailveld: dat is een latere, grotere klus ("RijkEditor"). Dit is een
 * plat tekstformulier — de opmaakregels (bullets, vinkjes, genummerde
 * lijsten, kale URL's) worden al herkend door renderAlineas()/renderCel()
 * zodra iemand ze zo typt, dus daar hoeft dit formulier niets voor te doen.
 */
export default function BewerkTaakForm({
  klantSlug,
  klantFolderId,
  n,
  titel,
  opmerking,
  pagina,
  detail,
}: {
  klantSlug: string;
  klantFolderId: string;
  n: number;
  titel: string;
  opmerking: string;
  pagina: string;
  detail: string;
}) {
  const [modus, setModus] = useState<"idle" | "bewerken" | "verwijderen">("idle");
  const [foutBewerken, setFoutBewerken] = useState<string | null>(null);
  const [foutVerwijderen, setFoutVerwijderen] = useState<string | null>(null);
  const [pendingBewerken, startBewerken] = useTransition();
  const [pendingVerwijderen, startVerwijderen] = useTransition();

  if (modus === "idle") {
    return (
      <>
        <button type="button" className="pillbtn licht" onClick={() => setModus("bewerken")}>
          Bewerken
        </button>
        <button type="button" className="pillbtn licht" onClick={() => setModus("verwijderen")}>
          Verwijderen
        </button>
      </>
    );
  }

  if (modus === "verwijderen") {
    return (
      <div className="verwijderbevestig">
        <span>Zeker weten?</span>
        <button
          type="button"
          className="pillbtn kritiek"
          disabled={pendingVerwijderen}
          onClick={() => {
            setFoutVerwijderen(null);
            startVerwijderen(async () => {
              try {
                const formData = new FormData();
                formData.set("klantFolderId", klantFolderId);
                formData.set("n", String(n));
                await verwijderTaakAction(klantSlug, formData);
                // Geen setModus("idle") nodig: de taakrij verdwijnt bij
                // succes uit de door revalidatePath() ververste lijst, dus
                // dit component wordt sowieso niet meer gerenderd.
              } catch (err) {
                setFoutVerwijderen(
                  err instanceof Error ? err.message : "Kon de taak niet verwijderen.",
                );
              }
            });
          }}
        >
          {pendingVerwijderen ? "Bezig…" : "Ja, verwijderen"}
        </button>
        <button
          type="button"
          className="pillbtn licht"
          onClick={() => {
            setFoutVerwijderen(null);
            setModus("idle");
          }}
          disabled={pendingVerwijderen}
        >
          Annuleren
        </button>
        {foutVerwijderen && <p className="foutregel">{foutVerwijderen}</p>}
      </div>
    );
  }

  // modus === "bewerken"
  return (
    <form
      className="klaarmeldform bewerktaakform"
      action={(formData: FormData) => {
        setFoutBewerken(null);
        startBewerken(async () => {
          try {
            await bewerkTaakAction(klantSlug, formData);
            setModus("idle");
          } catch (err) {
            setFoutBewerken(err instanceof Error ? err.message : "Kon de taak niet bewerken.");
          }
        });
      }}
    >
      <input type="hidden" name="klantFolderId" value={klantFolderId} />
      <input type="hidden" name="n" value={n} />

      <div className="metaveld">
        <label>Titel</label>
        <input type="text" name="titel" required defaultValue={titel} disabled={pendingBewerken} />
      </div>
      <div className="metaveld">
        <label>Opmerking</label>
        <textarea name="opmerking" defaultValue={opmerking} disabled={pendingBewerken} />
      </div>
      <div className="metaveld">
        <label>Pagina</label>
        <input
          type="text"
          name="pagina"
          defaultValue={pagina}
          placeholder="https://…"
          disabled={pendingBewerken}
        />
      </div>
      <div className="metaveld">
        <label>Volledige context</label>
        <textarea
          name="detail"
          className="groot"
          defaultValue={detail}
          disabled={pendingBewerken}
        />
      </div>

      {foutBewerken && <p className="foutregel">{foutBewerken}</p>}

      <div className="acties">
        <button className="pillbtn sterk" type="submit" disabled={pendingBewerken}>
          {pendingBewerken ? "Bezig…" : "Opslaan"}
        </button>
        <button
          className="pillbtn licht"
          type="button"
          onClick={() => setModus("idle")}
          disabled={pendingBewerken}
        >
          Annuleren
        </button>
      </div>
    </form>
  );
}
