# Segnalazioni ambientali

Mini social network per segnalare casi di inquinamento ambientale, spiagge sporche, scarichi a mare o rifiuti abbandonati. Offre una mappa pubblica con puntini rossi per ogni segnalazione e, dopo accesso Google simulato, la possibilità di creare nuovi post con foto e coordinate.

## Funzionalità
- Accesso con email Google + nickname (avatar opzionale ridimensionato a 100x100). L'email viene normalizzata in minuscolo e il nickname viene aggiornato ad ogni nuovo login.
- Pubblicazione di segnalazioni con foto, link a Google Maps o coordinate, e commento massimo due righe.
- Mappa pubblica con marker rossi e popup contenenti commento, link e foto se presente.

## Avvio locale
1. Installare le dipendenze e avviare il server con lo script helper (crea una virtualenv `.venv`):
   ```bash
   ./scripts/devserver.sh
   ```

   In ambienti con proxy restrittivi potrebbe essere necessario configurare `HTTP(S)_PROXY` o scaricare manualmente i wheel
   indicati in `requirements.txt`.

   Se non hai accesso a Internet e vuoi almeno registrare l'installazione in modalità editable senza scaricare nulla, usa:
   ```bash
   ./scripts/offline_editable.sh
   ```
   (installa solo il package locale; le dipendenze reali vanno installate a parte quando hai connettività, ad esempio con
   `pip install -r requirements.txt`).

2. In alternativa, installare manualmente e lanciare uvicorn:
   ```bash
   pip install -r requirements.txt
   uvicorn app.main:app --reload
   ```

3. Aprire il browser su [http://localhost:8000](http://localhost:8000) per usare l'interfaccia.

> Nota: l'accesso Google è simulato lato backend con la sola email; integrare la verifica OAuth per un ambiente produttivo.

## Struttura
- `app/main.py`: applicazione FastAPI e API principali.
- `app/database.py`: persistenza SQLite di utenti e segnalazioni.
- `app/utils.py`: ridimensionamento immagini e normalizzazione commenti.
- `app/static/index.html`: interfaccia con mappa Leaflet e form di login/pubblicazione.
- `app/media/`: cartella dove vengono salvati avatar e foto delle segnalazioni.
