# Segnalazioni ambientali

Mini social network per segnalare casi di inquinamento ambientale, spiagge sporche, scarichi a mare o rifiuti abbandonati. Offre una mappa pubblica con puntini rossi per ogni segnalazione e, dopo aver inserito un nickname (senza login Google reale), la possibilità di creare nuovi post con foto e coordinate.

## Funzionalità
- Accesso inserendo solo un nickname (avatar opzionale ridimensionato a 100x100).
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

3. Aprire il browser su [http://localhost:8000](http://localhost:8000) per usare l'interfaccia e inserire un nickname con eventuale avatar.
   - Se stai aprendo l'`index.html` hostato altrove (es. GitHub Pages) devi comunque avere il backend in esecuzione e raggiungibile; in quel caso puoi impostare `window.API_BASE = 'https://<host-backend>'` **prima** di caricare lo script della pagina.
   - Se ricevi il messaggio «Backend non raggiungibile», verifica che il server sia attivo (controlla il log di `uvicorn`) e che il browser punti all'host corretto.

## Struttura
- `app/main.py`: applicazione FastAPI e API principali.
- `app/database.py`: persistenza SQLite di utenti e segnalazioni.
- `app/utils.py`: ridimensionamento immagini e normalizzazione commenti.
- `app/static/index.html`: interfaccia con mappa Leaflet e form di login/pubblicazione.
- `app/media/`: cartella dove vengono salvati avatar e foto delle segnalazioni.

## Risoluzione problemi GitHub (errore 50x nell'app mobile)
Se durante l'aggiornamento del branch vedi il messaggio «Errore durante il caricamento di una richiesta pull» o «Il server sta
riscontrando problemi (50x)», è un problema lato GitHub e non dipende dal codice di questo progetto. Puoi provare così:

1. Controlla [status.github.com](https://www.githubstatus.com/) per verificare eventuali incidenti in corso.
2. Chiudi e riapri l'app GitHub oppure usa il sito web desktop/mobile per forzare un refresh della PR.
3. Assicurati che il branch sia stato pushato correttamente (ad esempio con `git push origin <nome-branch>`).
4. Se l'errore persiste anche via web, attendi la risoluzione dell'incidente o apri un ticket al supporto GitHub allegando lo
   `request id` mostrato nel messaggio di errore.
