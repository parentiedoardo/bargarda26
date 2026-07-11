// =========================================================
// Enoteca — pagina pubblica
// =========================================================

let TUTTI_I_VINI = [];
let FILTRO_ATTIVO = "Tutti";

async function caricaVini() {
  try {
    const res = await fetch("data/wines.json?t=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("File non trovato");
    TUTTI_I_VINI = await res.json();
  } catch (e) {
    TUTTI_I_VINI = [];
  }
  renderFiltri();
  renderLista();
  const now = new Date();
  document.getElementById("ultimo-aggiornamento").textContent =
    "Aggiornato al " + now.toLocaleDateString("it-IT") + " · " + now.toLocaleTimeString("it-IT", {hour: "2-digit", minute: "2-digit"});
}

function renderFiltri() {
  const box = document.getElementById("filters");
  const tipiPresenti = TIPI_ORDINE.filter(t => TUTTI_I_VINI.some(v => v.tipo === t));
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
  const vini = FILTRO_ATTIVO === "Tutti"
    ? TUTTI_I_VINI
    : TUTTI_I_VINI.filter(v => v.tipo === FILTRO_ATTIVO);

  if (vini.length === 0) {
    container.innerHTML = `<div class="empty-state">Nessun vino disponibile al momento.</div>`;
    return;
  }

  const gruppi = raggruppaPerTipo(ordinaPerTipo(vini));
  let html = "";

  TIPI_ORDINE.forEach(tipo => {
    const lista = gruppi[tipo];
    if (!lista || lista.length === 0) return;

    html += `<div class="group-title"><span class="dot" style="background:${DOT_COLORI[tipo]}"></span>${tipo}</div>`;
    lista.forEach(v => {
      const esaurito = Number(v.quantita) <= 0;
      html += `
        <div class="wine-row ${esaurito ? "sold-out" : ""}">
          <span class="wine-name">${escapeHtml(v.nome)}</span>
          <span class="leader"></span>
          <span class="wine-price">${formattaPrezzo(v.prezzo)}</span>
          ${esaurito ? `<span class="stamp">Esaurito</span>` : ""}
        </div>`;
    });
  });

  container.innerHTML = html;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

caricaVini();
