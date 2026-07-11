// =========================================================
// Enoteca — pagina di gestione (admin)
// =========================================================

// Hash SHA-256 della password di gestione.
// Password attuale: "GardaVinoBar26"
// Per cambiarla: apri la console del browser su questa pagina e scrivi
//   await hashPassword("la-tua-nuova-password")
// poi incolla il risultato qui sotto al posto della stringa.
const PASSWORD_HASH = "5f0d7a1881ff690766f1355bef43aa0cceec1230474a7bc353f631481db7c1f8";

const SESSION_KEY = "enoteca_admin_unlocked";

let store = null;
let VINI = [];
let FILTRO_ATTIVO = "Tutti";
let VINO_IN_MODIFICA = null; // id del vino aperto nel foglio, null = nuovo vino

async function hashPassword(str) {
  const enc = new TextEncoder().encode(str);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
window.hashPassword = hashPassword; // disponibile in console per generare nuovi hash

// ---------- Avvio ----------

function aggiornaLabelTema() {
  document.getElementById("btn-tema").textContent = getTheme() === "dark" ? "Chiaro" : "Scuro";
}

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  aggiornaLabelTema();
  document.getElementById("btn-tema").addEventListener("click", () => {
    toggleTheme();
    aggiornaLabelTema();
  });

  document.getElementById("btn-stampa-pubblico").addEventListener("click", () => stampaPDF(false));
  document.getElementById("btn-stampa-interno").addEventListener("click", () => stampaPDF(true));

  if (sessionStorage.getItem(SESSION_KEY) === "1") {
    document.getElementById("gate").style.display = "none";
    avviaDopoPassword();
  }

  document.getElementById("btn-entra").addEventListener("click", provaPassword);
  document.getElementById("pwd").addEventListener("keydown", e => {
    if (e.key === "Enter") provaPassword();
  });

  document.getElementById("btn-salva-config").addEventListener("click", salvaConfigGithub);
  document.getElementById("btn-disconnetti").addEventListener("click", e => {
    e.preventDefault();
    sessionStorage.removeItem(SESSION_KEY);
    location.reload();
  });

  document.getElementById("fab-aggiungi").addEventListener("click", () => apriSheet(null));
  document.getElementById("btn-annulla-vino").addEventListener("click", chiudiSheet);
  document.getElementById("btn-salva-vino").addEventListener("click", salvaVinoDaSheet);
  document.getElementById("sheet-backdrop").addEventListener("click", e => {
    if (e.target.id === "sheet-backdrop") chiudiSheet();
  });
});

async function provaPassword() {
  const val = document.getElementById("pwd").value;
  const hash = await hashPassword(val);
  if (hash === PASSWORD_HASH) {
    sessionStorage.setItem(SESSION_KEY, "1");
    document.getElementById("gate").style.display = "none";
    document.getElementById("pwd-errore").style.display = "none";
    avviaDopoPassword();
  } else {
    document.getElementById("pwd-errore").style.display = "block";
  }
}

function avviaDopoPassword() {
  const config = getGhConfig();
  if (!config || !config.owner || !config.repo || !config.token) {
    document.getElementById("gh-owner").value = config?.owner || "";
    document.getElementById("gh-repo").value = config?.repo || "";
    document.getElementById("gh-branch").value = config?.branch || "main";
    document.getElementById("gh-path").value = config?.path || "data/wines.json";
    document.getElementById("gh-setup").style.display = "flex";
    return;
  }
  connettiEcarica(config);
}

async function salvaConfigGithub() {
  const config = {
    owner: document.getElementById("gh-owner").value.trim(),
    repo: document.getElementById("gh-repo").value.trim(),
    branch: document.getElementById("gh-branch").value.trim() || "main",
    path: document.getElementById("gh-path").value.trim() || "data/wines.json",
    token: document.getElementById("gh-token").value.trim()
  };
  const err = document.getElementById("gh-errore");
  err.style.display = "none";

  if (!config.owner || !config.repo || !config.token) {
    err.textContent = "Compila utente, repository e token.";
    err.style.display = "block";
    return;
  }

  try {
    const tempStore = new GitHubDataStore(config);
    await tempStore.load(); // verifica che le credenziali funzionino
    setGhConfig(config);
    document.getElementById("gh-setup").style.display = "none";
    connettiEcarica(config);
  } catch (e) {
    err.textContent = e.message;
    err.style.display = "block";
  }
}

async function connettiEcarica(config) {
  store = new GitHubDataStore(config);
  document.getElementById("app").style.display = "block";
  document.getElementById("fab-aggiungi").style.display = "flex";
  await ricaricaDaGithub();
}

async function ricaricaDaGithub() {
  try {
    VINI = await store.load();
  } catch (e) {
    mostraToast("Errore: " + e.message);
    return;
  }
  renderFiltri();
  renderLista();
}

// ---------- Rendering ----------

function renderFiltri() {
  const box = document.getElementById("filters");
  const tipiPresenti = TIPI_ORDINE.filter(t => VINI.some(v => v.tipo === t));
  const tipi = ["Tutti", ...tipiPresenti];

  box.innerHTML = tipi.map(t => {
    const dot = t === "Tutti" ? "" : `<span class="dot" style="background:${DOT_COLORI[t]}"></span>`;
    const active = t === FILTRO_ATTIVO ? "active" : "";
    return `<button class="pill ${active}" data-tipo="${t}">${dot}${t}</button>`;
  }).join("");

  box.querySelectorAll(".pill").forEach(btn => {
    btn.addEventListener("click", () => {
      FILTRO_ATTIVO = btn.dataset.tipo;
      renderFiltri();
      renderLista();
    });
  });
}

function renderLista() {
  const container = document.getElementById("lista");
  const vini = FILTRO_ATTIVO === "Tutti" ? VINI : VINI.filter(v => v.tipo === FILTRO_ATTIVO);

  if (vini.length === 0) {
    container.innerHTML = `<div class="empty-state">Nessun vino in cantina. Tocca "+" per aggiungerne uno.</div>`;
    return;
  }

  const ordinati = ordinaPerTipo(vini);
  container.innerHTML = ordinati.map(v => {
    const esaurito = Number(v.quantita) <= 0;
    return `
      <div class="wine-card" data-id="${v.id}">
        <div class="wine-card-top">
          <div class="wine-card-title">
            <span class="dot" style="background:${DOT_COLORI[v.tipo]}"></span>
            <span>${escapeHtml(v.nome)}</span>
          </div>
          <span class="wine-card-price">${formattaPrezzo(v.prezzo)}</span>
        </div>
        <div class="wine-card-bottom">
          <div>
            ${esaurito ? `<span class="badge-esaurito">Esaurito</span>` : `<span class="hint">${v.quantita} in cantina</span>`}
          </div>
          <div class="stepper">
            <button data-azione="meno" data-id="${v.id}">−</button>
            <span class="qty">${v.quantita}</span>
            <button data-azione="piu" data-id="${v.id}">+</button>
          </div>
        </div>
        <div class="row-2" style="margin-top:12px;">
          <button class="btn-ghost" data-azione="modifica" data-id="${v.id}">Modifica</button>
          <button class="btn-danger" data-azione="elimina" data-id="${v.id}">Elimina</button>
        </div>
      </div>`;
  }).join("");

  container.querySelectorAll("[data-azione]").forEach(btn => {
    btn.addEventListener("click", () => gestisciAzione(btn.dataset.azione, btn.dataset.id));
  });
}

async function gestisciAzione(azione, id) {
  const vino = VINI.find(v => v.id === id);
  if (!vino) return;

  if (azione === "piu") {
    vino.quantita = Number(vino.quantita) + 1;
    await salvaSuGithub("Aggiunta bottiglia: " + vino.nome);
  } else if (azione === "meno") {
    vino.quantita = Math.max(0, Number(vino.quantita) - 1);
    await salvaSuGithub("Rimossa bottiglia: " + vino.nome);
  } else if (azione === "modifica") {
    apriSheet(id);
  } else if (azione === "elimina") {
    if (confirm(`Eliminare "${vino.nome}" dalla lista?`)) {
      VINI = VINI.filter(v => v.id !== id);
      await salvaSuGithub("Rimosso vino: " + vino.nome);
    }
  }
}

// ---------- Foglio aggiunta/modifica ----------

function apriSheet(id) {
  VINO_IN_MODIFICA = id;
  const sheetTitle = document.querySelector("#sheet-backdrop h3");
  if (id) {
    const v = VINI.find(v => v.id === id);
    sheetTitle.textContent = "Modifica vino";
    document.getElementById("f-tipo").value = v.tipo;
    document.getElementById("f-nome").value = v.nome;
    document.getElementById("f-prezzo").value = v.prezzo;
    document.getElementById("f-quantita").value = v.quantita;
  } else {
    sheetTitle.textContent = "Nuovo vino";
    document.getElementById("f-tipo").value = "Bianco";
    document.getElementById("f-nome").value = "";
    document.getElementById("f-prezzo").value = "";
    document.getElementById("f-quantita").value = "";
  }
  document.getElementById("sheet-backdrop").classList.add("open");
}

function chiudiSheet() {
  document.getElementById("sheet-backdrop").classList.remove("open");
  VINO_IN_MODIFICA = null;
}

async function salvaVinoDaSheet() {
  const tipo = document.getElementById("f-tipo").value;
  const nome = document.getElementById("f-nome").value.trim();
  const prezzo = parseFloat(document.getElementById("f-prezzo").value);
  const quantita = parseInt(document.getElementById("f-quantita").value, 10);

  if (!nome || isNaN(prezzo) || isNaN(quantita)) {
    mostraToast("Compila nome, prezzo e quantità.");
    return;
  }

  if (VINO_IN_MODIFICA) {
    const v = VINI.find(v => v.id === VINO_IN_MODIFICA);
    v.tipo = tipo; v.nome = nome; v.prezzo = prezzo; v.quantita = quantita;
    await salvaSuGithub("Modificato vino: " + nome);
  } else {
    VINI.push({ id: generaId(), tipo, nome, prezzo, quantita });
    await salvaSuGithub("Aggiunto vino: " + nome);
  }
  chiudiSheet();
}

function generaId() {
  return "w" + Date.now().toString(36) + Math.floor(Math.random() * 1000);
}

// ---------- Salvataggio ----------

async function salvaSuGithub(messaggio) {
  renderFiltri();
  renderLista();
  try {
    await store.save(VINI, messaggio);
    mostraToast("Salvato ✓");
  } catch (e) {
    mostraToast("Errore nel salvataggio: " + e.message);
  }
}

// ---------- Utilità ----------

function mostraToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Stampa / esportazione PDF ----------
// Usa la funzione di stampa del browser: nella finestra di stampa che si apre,
// scegliendo come stampante "Salva come PDF" si ottiene un file PDF pronto.

function stampaPDF(conQuantita) {
  if (!VINI || VINI.length === 0) {
    mostraToast("Nessun vino da stampare.");
    return;
  }

  const gruppi = raggruppaPerTipo(ordinaPerTipo(VINI));
  const oggi = new Date().toLocaleDateString("it-IT");

  let html = `<div class="print-title">Bar Garda — Carta dei vini</div>`;
  html += `<div class="print-sub">${conQuantita ? "Uso interno · con quantità in cantina · " : ""}${oggi}</div>`;

  TIPI_ORDINE.forEach(tipo => {
    const lista = gruppi[tipo];
    if (!lista || lista.length === 0) return;
    html += `<div class="print-group">${tipo}</div>`;
    lista.forEach(v => {
      const esaurito = Number(v.quantita) <= 0;
      const etichettaQty = conQuantita
        ? `<span class="qty">${esaurito ? "esaurito" : v.quantita + " pz"}</span>`
        : (esaurito ? `<span class="qty">esaurito</span>` : "");
      html += `
        <div class="print-row">
          <span>${escapeHtml(v.nome)}</span>
          <span>${formattaPrezzo(v.prezzo)}${etichettaQty}</span>
        </div>`;
    });
  });

  document.getElementById("print-area").innerHTML = html;
  window.print();
}
