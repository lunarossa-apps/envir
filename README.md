# Gruppo Vacanze

Webapp mobile first per gruppi che viaggiano insieme. L'app aiuta a decidere velocemente cosa fare grazie a votazioni rapide, raccolta del mood del gruppo, suggerimenti locali “AI powered” basati su regole e gestione semplice del viaggio.

## Cosa include
- Creazione gruppo con codice breve condivisibile e salvataggio completo in `localStorage`.
- Accesso membri con associazione del dispositivo al partecipante attivo.
- Dashboard Home in stile app con hero, quick actions, activity feed e overview del gruppo.
- Schermate dedicate per `Voting`, `Mood`, `AI Suggestion` e `Gruppo`.
- Light theme, dark theme, persistenza tema, supporto tema di sistema e shell PWA offline friendly.
- Export del riepilogo viaggio in JSON e azioni di reset / scioglimento gruppo.

## Stack
- FastAPI per servire l'app statica.
- Frontend React + hooks con shell TypeScript di riferimento in `frontend/src` e runtime statico già pronto in `app/static`.
- Nessun backend applicativo per i dati del viaggio: tutto resta in `localStorage`.

## Avvio locale
1. Installare le dipendenze Python e avviare il server:
   ```bash
   pip install -r requirements.txt
   uvicorn app.main:app --reload
   ```
2. Aprire [http://localhost:8000](http://localhost:8000).

> Nota: il runtime statico è già incluso in `app/static`, quindi non è necessario alcun build step frontend per provarla.

## Struttura essenziale
- `frontend/src/main.tsx`: shell React, schermate, stato globale e UX.
- `frontend/src/types.ts`: modelli TypeScript dell'app.
- `frontend/src/suggestions.ts`: motore locale per i suggerimenti.
- `frontend/src/styles.css`: design system mobile first, light/dark theme e layout responsive.
- `app/static/`: runtime statico servito da FastAPI.
- `app/main.py`: entrypoint FastAPI.

## Nota progettuale
La persistenza del viaggio è locale al dispositivo, come richiesto. Per condividere lo stato su altri dispositivi è disponibile l'export JSON da schermata `Gruppo`, utile come snapshot manuale del viaggio.
