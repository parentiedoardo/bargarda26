# Enoteca — sito lista vini

Sito statico in due pagine:

- **`index.html`** — carta dei vini pubblica (tipologia, nome, prezzo). Non mostra le quantità.
- **`admin.html`** — pagina di gestione riservata al titolare: quantità in cantina, aggiunta/modifica/eliminazione vini, +/− bottiglie con "Esaurito" automatico a quantità 0.

I dati vivono in un unico file: `data/wines.json`. La pagina pubblica lo legge e basta.
La pagina admin, invece, lo **modifica direttamente nel repository GitHub** tramite le API di GitHub — è il trucco che permette di gestire il sito da telefono senza bisogno di un server.

---

## 1. Pubblicare il sito (GitHub Pages)

1. Crea un repository su GitHub (può essere **pubblico**; se privato, GitHub Pages richiede un piano a pagamento).
2. Carica tutti i file di questa cartella mantenendo la struttura (compresa `data/wines.json`).
3. Vai su **Settings → Pages** del repository, e in "Build and deployment" scegli **Deploy from a branch**, branch `main`, cartella `/ (root)`.
4. Dopo un minuto il sito sarà visibile su `https://<tuo-utente>.github.io/<nome-repo>/`.

> Dopo ogni modifica dalla pagina admin, la pagina pubblica può impiegare **fino a 1-2 minuti** a mostrare i dati aggiornati (tempo di pubblicazione di GitHub Pages). È normale.

## 2. Creare il token per la gestione

La pagina admin ha bisogno di un **token di accesso personale** con permesso di scrittura solo su questo repository:

1. Vai su **github.com → Settings (del tuo account) → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. **Repository access**: scegli "Only select repositories" → seleziona questo repository.
3. **Permissions → Repository permissions → Contents**: imposta su **Read and write**.
4. Genera il token e copialo (comincia con `github_pat_...`). Non sarà più visibile dopo, quindi salvalo in un posto sicuro (es. gestore password).

La prima volta che apri `admin.html` dopo la password, ti verrà chiesto:
- Utente/organizzazione GitHub
- Nome del repository
- Branch (di solito `main`)
- Percorso file dati (di solito `data/wines.json`, già precompilato)
- Il token appena creato

Questi dati restano salvati **solo nel browser di quel telefono** (localStorage), non vengono inviati altrove se non a GitHub stesso.

## 3. Cambiare la password di gestione

La password di default è **`GardaVinoBar26`**. Per cambiarla:

1. Apri `admin.html` nel browser del computer.
2. Apri la Console sviluppatore (F12 o tasto destro → Ispeziona → Console).
3. Scrivi: `await hashPassword("la-tua-nuova-password")` e premi invio.
4. Copia la stringa che restituisce.
5. Apri il file `admin.js`, trova la riga `const PASSWORD_HASH = "..."` e sostituisci il valore con quello copiato.
6. Salva e carica di nuovo il file su GitHub.

⚠️ **Nota sulla sicurezza**: essendo un sito statico, questa password è un semplice cancello per tenere fuori i curiosi — non è una protezione a prova di esperti. Il vero controllo d'accesso è il **token GitHub**, che solo il titolare possiede e che può essere revocato in qualsiasi momento da GitHub in caso di smarrimento del telefono.

## 4. Uso quotidiano da smartphone

- Aggiungi la pagina `admin.html` alla schermata Home del telefono (Safari/Chrome → "Aggiungi a Home") per aprirla come un'app.
- Tocca **+** per aggiungere un vino nuovo.
- Usa **−** / **+** per scalare o aggiungere bottiglie: a quantità 0 il vino compare automaticamente come "Esaurito" nella carta pubblica.
- **Modifica** cambia nome/tipo/prezzo/quantità di un vino esistente; **Elimina** lo rimuove del tutto.
- **Esci** in alto a destra richiede di nuovo la password (utile se il telefono viene prestato).

## Struttura dei file

```
index.html        pagina pubblica
admin.html         pagina di gestione
style.css          stile condiviso
common.js          funzioni condivise + client API GitHub
index.js            logica pagina pubblica
admin.js            logica pagina di gestione
data/wines.json     archivio vini (letto/scritto via API GitHub)
```
