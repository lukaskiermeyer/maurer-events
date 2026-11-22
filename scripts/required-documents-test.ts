import test from "node:test";
import assert from "node:assert/strict";
import { kindForRequiredDoc, missingRequiredDocLabels, resolveRequiredDocs } from "../src/lib/required-documents";

test("Admin-Chips mappen auf eigene Upload-Arten", () => {
  assert.equal(kindForRequiredDoc("Ausweis"), "id_card");
  assert.equal(kindForRequiredDoc("Gesundheitszeugnis"), "health_certificate");
  assert.equal(kindForRequiredDoc("Steuerkarte"), "tax_card");
  assert.equal(kindForRequiredDoc("Minijob-Formular"), "minijob_form");
  assert.equal(kindForRequiredDoc("Führerschein"), "driver_license");
  assert.equal(kindForRequiredDoc("Arbeitszeugnis"), "work_certificate");
});

test("Checkliste erkennt done, missing und rejected", () => {
  const states = resolveRequiredDocs(["Ausweis", "Arbeitszeugnis"], [{ kind: "id_card", status: "pending" }]);
  assert.deepEqual(states.map(doc => doc.state), ["done", "missing"]);
  const rejected = resolveRequiredDocs(["Ausweis"], [{ kind: "id_card", status: "rejected" }]);
  assert.equal(rejected[0].state, "rejected");
});

test("Beliebiger Sonstiges-Upload erfüllt nicht das Arbeitszeugnis", () => {
  const states = resolveRequiredDocs(["Arbeitszeugnis"], [{ kind: "other", status: "verified" }]);
  assert.equal(states[0].state, "missing");
  assert.deepEqual(missingRequiredDocLabels(["Arbeitszeugnis"], [{ kind: "other", status: "verified" }]), ["Arbeitszeugnis"]);
});

test("Minijob-Formular zählt ohne aktive Vorlage nicht als fehlend", () => {
  const skipped = resolveRequiredDocs(["Minijob-Formular"], [], { minijobTemplateActive: false });
  assert.equal(skipped[0].state, "skipped");
  assert.deepEqual(missingRequiredDocLabels(["Minijob-Formular"], [], { minijobTemplateActive: false }), []);
  const missing = resolveRequiredDocs(["Minijob-Formular"], [], { minijobTemplateActive: true });
  assert.equal(missing[0].state, "missing");
  assert.deepEqual(missingRequiredDocLabels(["Minijob-Formular"], [], { minijobTemplateActive: true }), ["Minijob-Formular"]);
});

test("Signatur-Sperre: missing und rejected blocken, done und skipped nicht", () => {
  const labels = missingRequiredDocLabels(
    ["Ausweis", "Arbeitszeugnis", "Minijob-Formular", "Führerschein"],
    [
      { kind: "id_card", status: "verified" },
      { kind: "driver_license", status: "rejected" },
    ],
    { minijobTemplateActive: false },
  );
  assert.deepEqual(labels, ["Arbeitszeugnis", "Führerschein"]);
});
