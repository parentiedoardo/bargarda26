// =========================================================
// Enoteca — funzioni condivise tra pagina pubblica e admin
// =========================================================

const TIPI_ORDINE = ["Bollicine", "Bianco", "Rosso"];

const DOT_COLORI = {
  "Bianco": "var(--dot-bianco)",
  "Bollicine": "var(--dot-bollicine)",
  "Rosso": "var(--dot-rosso)"
};

function formattaPrezzo(numero) {
  const n = Number(numero) || 0;
  return "€ " + n.toFixed(2).replace(".", ",");
}

function ordinaPerTipo(vini) {
  return [...vini].sort((a, b) => {
    const ia = TIPI_ORDINE.indexOf(a.tipo);
    const ib = TIPI_ORDINE.indexOf(b.tipo);
    if (ia !== ib) return ia - ib;
    return a.nome.localeCompare(b.nome, "it");
  });
}

function raggruppaPerTipo(vini) {
  const gruppi = {};
  TIPI_ORDINE.forEach(t => gruppi[t] = []);
  vini.forEach(v => {
    if (!gruppi[v.tipo]) gruppi[v.tipo] = [];
    gruppi[v.tipo].push(v);
  });
  return gruppi;
}

// ---------- Codifica/decodifica UTF-8 <-> Base64 (per accenti italiani) ----------

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
}

function base64ToUtf8(b64) {
  const binary = atob(b64.replace(/\n/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// ---------- Tema chiaro/scuro ----------

const THEME_KEY = "enoteca_theme";

function getTheme() {
  return localStorage.getItem(THEME_KEY) || "dark";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
}

function initTheme() {
  applyTheme(getTheme());
}

function toggleTheme() {
  const nuovo = getTheme() === "dark" ? "light" : "dark";
  applyTheme(nuovo);
  return nuovo;
}

// ---------- Config repo GitHub (salvata in localStorage sul telefono) ----------

const GH_CONFIG_KEY = "enoteca_gh_config";

function getGhConfig() {
  try {
    return JSON.parse(localStorage.getItem(GH_CONFIG_KEY) || "null");
  } catch (e) {
    return null;
  }
}

function setGhConfig(config) {
  localStorage.setItem(GH_CONFIG_KEY, JSON.stringify(config));
}

function clearGhConfig() {
  localStorage.removeItem(GH_CONFIG_KEY);
}

// ---------- Client minimale per l'API "Contents" di GitHub ----------

class GitHubDataStore {
  constructor(config) {
    this.owner = config.owner;
    this.repo = config.repo;
    this.branch = config.branch || "main";
    this.path = config.path || "data/wines.json";
    this.token = config.token;
    this._lastSha = null;
  }

  _headers() {
    return {
      "Authorization": "Bearer " + this.token,
      "Accept": "application/vnd.github+json"
    };
  }

  _url() {
    return `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${this.path}?ref=${this.branch}`;
  }

  async load() {
    const res = await fetch(this._url(), { headers: this._headers(), cache: "no-store" });
    if (res.status === 404) {
      this._lastSha = null;
      this.notFound = true;
      return [];
    }
    this.notFound = false;
    if (!res.ok) {
      throw new Error(await this._readError(res));
    }
    const data = await res.json();
    this._lastSha = data.sha;
    const jsonText = base64ToUtf8(data.content);
    return JSON.parse(jsonText || "[]");
  }

  async save(vini, message) {
    const body = {
      message: message || "Aggiornamento lista vini",
      content: utf8ToBase64(JSON.stringify(vini, null, 2)),
      branch: this.branch
    };
    if (this._lastSha) body.sha = this._lastSha;

    const res = await fetch(
      `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${this.path}`,
      { method: "PUT", headers: this._headers(), body: JSON.stringify(body) }
    );

    if (!res.ok) {
      // Se qualcun altro ha modificato il file nel frattempo, ricarico lo sha e riprovo una volta
      if (res.status === 409 || res.status === 422) {
        await this.load();
        body.sha = this._lastSha;
        const retry = await fetch(
          `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${this.path}`,
          { method: "PUT", headers: this._headers(), body: JSON.stringify(body) }
        );
        if (!retry.ok) throw new Error(await this._readError(retry));
        const retryData = await retry.json();
        this._lastSha = retryData.content.sha;
        return;
      }
      throw new Error(await this._readError(res));
    }
    const data = await res.json();
    this._lastSha = data.content.sha;
  }

  async _readError(res) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j.message || "";
    } catch (e) { /* noop */ }
    if (res.status === 401) return "Token non valido o scaduto.";
    if (res.status === 403) return "Il token non ha i permessi necessari su questo repository.";
    if (res.status === 404) return "Repository o percorso file non trovati. Controlla i dati inseriti.";
    return `Errore GitHub (${res.status}): ${detail}`;
  }
}
