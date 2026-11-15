# KI/LLM-Inventar

## Beleg: Es gibt genau einen LLM-Aufruf im Anwendungscode

| # | Datei | Provider | Modell | Region | Zweck | Daten im Prompt | AVV/No-Training | Status |
|---|-------|----------|--------|--------|-------|-----------------|-----------------|--------|
| 1 | `src/lib/translate.ts` (`translateContent`) | Google Gemini | `gemini-1.5-flash` | Google-Region (API-Endpoint, nicht in Code festgelegt) | Übersetzung von Veranstaltungs-/Galarietexten DE↔EN im Admin-Panel | **Nur der zu übersetzende Text** (Veranstaltungsbeschreibungen, Galerietitel). Keine Personendaten, keine Steuer-IDs, keine Ausweise. | Nicht belegt im Repo. `GEMINI_API_KEY` optional; bei fehlendem Key Fallback auf Originaltext. | Offen: AVV mit Google, Zero-Retention/No-Training, Drittlandtransfer prüfen |

Aufrufstelle: `src/app/actions/events.ts` importiert `translateContent`. Wird nur bei Admin-Aktion (Erstellen/Bearbeiten von Events) ausgelöst, nicht automatisch im Hintergrund.

## Nicht im Anwendungscode, aber im Ökosystem

| # | Artefakt | Provider | Modell | Zweck | Daten |
|---|----------|----------|--------|-------|-------|
| 2 | `docs/n8n-festwirt-finder.json` (n8n-Workflow, nicht in App deployed) | NVIDIA NIM (default) / austauschbar (Groq, Together, OpenRouter, Gemini, Ollama) | `meta/llama-3.1-8b-instruct` (default) | Festwirt-Scout: Extraktion + Scoring aus öffentlichen Webseiten | Öffentliche Festseiten (Titel, Snippet, Text). Prompt fordert `contactName`, `contactEmail`, `contactPhone` aus öffentlichen Quellen → personenbezogene Daten (Geschäftskontakte) werden vom LLM extrahiert und in `fest_opportunities` gespeichert. |

## Nicht eingesetzt (belegt)

- **OCR / Dokumenten-Extraktion:** nicht vorhanden. Ausweise/Gesundheitszeugnisse werden nur gespeichert, nicht analysiert.
- **Bewerber-Screening:** nicht vorhanden. Bewerbungen werden manuell geprüft.
- **Chat:** nicht vorhanden.
- **Schichtvorschläge:** nicht vorhanden. Schichten werden manuell zugewiesen.
- **Embeddings / RAG:** nicht vorhanden.

Belege (Dependencies/API-Clients/Env-Keys):
- `package.json`: keine OpenAI/Anthropic/LangChain/Vercel-AI-SDK-Dependency. Einzige LLM-SDK: `@google/generative-ai` (^0.24.1).
- `src/`: einziger Import von `@google/generative-ai` in `src/lib/translate.ts`.
- Env-Keys: nur `GEMINI_API_KEY` (optional). Keine `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `LLM_BASE_URL` etc. in `.env.example`.
- Kein `fetch` zu LLM-Endpoints im App-Code (grep `chat/completions` = 0 Treffer in src/).

## Bewertung Art. 22 / EU-AI-Act

- **Art. 22 (automatisierte Entscheidung mit rechtlicher Wirkung):** Nicht betroffen. Der einzige LLM-Aufruf (Übersetzung) hat keine rechtliche Wirkung und keine Profilbildung. Keine automatisierte Bewerber-Ablehnung.
- **EU-AI-Act:** Kein Hochrisiko-System. Übersetzung ist ein Hilfswerkzeug ohne Entscheidungswirkung. n8n-Festwirt-Finder (falls deployed) extrahiert öffentliche Kontaktdaten → keine Hochrisiko-Kategorie (keine Beschäftigung/Bewerberauswahl im Sinne des AI-Act; es ist Lead-Generierung, keine Einstellungsentscheidung).

## Offene Punkte (KI-bezogen)

1. Google Gemini AVV prüfen (Drittlandtransfer USA; DPF/SCC).
2. Zero-Retention/No-Training für `gemini-1.5-flash` klären (Google AI Studio vs. Vertex AI haben unterschiedliche Datenverwendungsbedingungen).
3. Prompt-/Response-Logging bei Google deaktivieren bzw. prüfen.
4. Redaction vor Versand: Da nur redaktionelle Texte übersetzt werden, kein PII-Risiko. Aber: Admin könnte versehentlich personenbezogene Daten in Event-Beschreibungen einfügen → Hinweis in UI oder Filter vor dem API-Call.
5. n8n-Workflow: Wenn deployed, AVV mit NVIDIA/Provider prüfen; Kontaktdaten-Minimierung (nur geschäftliche Kontakte, keine sensiblen Daten).
