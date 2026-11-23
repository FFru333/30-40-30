# Zone Planner

PWA mobile-first per comporre pasti a Zona per due profili (Luca, Marina): blocchi di proteine,
carboidrati e grassi, stato "in Zona sì/no" e suggerimenti calcolati su cosa aggiungere o togliere.
Nessun backend: i dati stanno in IndexedDB sul telefono, con export/import JSON.

## Modello Zona

- 1 blocco = 7 g proteine + 9 g carboidrati netti + 3 g grassi totali (28 + 36 + 27 kcal ≈ 31/40/30).
- I grassi si confrontano in grammi con 3 g × N; i "blocchi da 1,5 g" sono solo un valore secondario.
- **Carboidrati netti:** le etichette UE (DE/IT) riportano i carboidrati già senza fibre. Ogni alimento ha
  `carbBasis`: `eu` (si usano così) o `us_total` (si sottraggono le fibre). Sottrarre sempre le fibre
  conterebbe la fibra due volte sui dati europei.
- In Zona se ogni macro è entro ± tolleranza (default 0,5 blocchi, impostabile per macro e per profilo).
- La ripartizione calorica è calcolata dai macro (4/4/9), non dalle kcal in etichetta.

Tutta la logica è in `src/domain/` (pura, senza UI né database) ed è coperta da test.

## Struttura

```
src/
  domain/zone/      blocchi, totali pasto, stato Zona, suggerimenti di bilanciamento (+ test)
  domain/food/      tipi alimento, piatti composti
  domain/profile/   profili, diete, blocchi giornalieri
  data/             archivio iniziale (~220 alimenti, sinonimi DE, piatti pronti)
  db/               IndexedDB (Dexie), backup JSON (+ test)
  features/         composer (Pasto), foods (Alimenti), profiles (Profili e backup)
  ui/               barre macro, ripartizione calorica, badge fonte, formattazione it-IT
  styles/           token colore e stili
```

## Comandi

```
npm install
npm run dev       # sviluppo
npm test          # test unitari (Vitest)
npm run build     # build di produzione in dist/
```

## Pubblicazione

`.github/workflows/deploy.yml` pubblica su GitHub Pages a ogni push su `main`.
Una tantum: Settings → Pages → Source: **GitHub Actions**.

## Dati alimentari

Solo planted.kebab Original è verificato (scheda produttore). Gli altri valori sono **stime** da valori medi
tipici e nell'app hanno il badge "stima": vanno controllati sull'etichetta del prodotto comprato e poi
marcati come "Etichetta".

## Fasi successive

- Fase 2: ricette con varianti per profilo e scalatura, dispensa, "cosa posso cucinare".
- Fase 3: settimana, lista della spesa, Open Food Facts e codice a barre (verificare licenza ODbL e API).
