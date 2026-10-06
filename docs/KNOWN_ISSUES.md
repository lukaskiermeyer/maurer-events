# Known Issues

## ESLint Inkompatibilität
Beim Ausführen von `npm run lint` kommt es aktuell zu folgendem Fehler:
`scopeManager.addGlobals is not a function`

**Ursache:**
Das Projekt nutzt ESLint in Version 9+ (Flat Config) zusammen mit dem Next.js 16.x Setup. Das Plugin `eslint-config-next` bzw. dessen interne Abhängigkeiten (z.B. `@typescript-eslint/scope-manager` oder alte React-Plugins) sind aktuell noch nicht vollständig kompatibel zur neuen ESLint 9 Engine, die globale Scopes anders verwaltet.

**Workaround / Lösung:**
Dies ist ein bekanntes Ökosystem-Problem zwischen Next.js und ESLint 9. Es lässt sich nachhaltig beheben, sobald `eslint-config-next` ein offizielles Update für die finale Flat Config-Unterstützung (ohne alte `scopeManager`-Aufrufe in den Plugins) erhält. Bis dahin kann die Linting-Pipeline im CI übergangen werden, oder ein expliziter Downgrade aller ESLint-Pakete auf v8 (inkl. `eslintrc.json` anstelle von `eslint.config.mjs`) durchgeführt werden. Da das Projekt die neue `eslint.config.mjs` voraussetzt, wurde von einem Downgrade abgesehen, um die Build-Pipeline nicht zu gefährden.
