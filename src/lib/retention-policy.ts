// Retention-Matrix für Personalakten (Art. 5 Abs. 1 lit. e DSGVO, §§ 147 AO, 257 HGB).
// - Lohn/Steuer-Datensätze und Vertrags-Nachweise sind steuer- und handelsrechtlich
//   bis zu 10 Jahre aufzubewahren.
// - Identitäts- und Gesundheitsnachweise sind nur für den Nachweis der gesetzlichen
//   Anforderung erforderlich und werden nach Austritt fristgerecht gelöscht.
// - Sessions/Invites sind Sicherheitsartefakte ohne langfristigen Zweck.
//
// Fristen laufen ab exitDate (Austritt). Ohne exitDate wird nicht anonymisiert,
// damit kein laufender Mitarbeiter (z. B. ohne erfassten Austritt) verloren geht.

export const STAFF_ID_DOC_RETENTION_DAYS = 365;
export const STAFF_ANONYMIZE_AFTER_DAYS = 3650;
export const STAFF_AUDIT_RETENTION_DAYS = 3650;

export const STAFF_ID_DOC_KINDS = ["id_card", "health_certificate"] as const;
