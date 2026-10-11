(function () {
  "use strict";

  var LS_ENTRIES = "ap_entries";
  var LS_WEBHOOK = "ap_webhook_url";
  var LS_PERSONNES = "ap_personnes";

  var state = { lieu: null, tache: null };

  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function monthPrefix(dateStr) { return dateStr.slice(0, 7); }

  function fmtH(n) {
    return (Math.round(n * 100) / 100).toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function loadEntries() {
    try {
      return JSON.parse(localStorage.getItem(LS_ENTRIES) || "[]");
    } catch (e) {
      return [];
    }
  }

  function saveEntries(list) {
    localStorage.setItem(LS_ENTRIES, JSON.stringify(list));
  }

  function loadPersonnes() {
    try {
      return JSON.parse(localStorage.getItem(LS_PERSONNES) || "[]");
    } catch (e) {
      return [];
    }
  }

  function rememberPersonne(name) {
    if (!name) return;
    var list = loadPersonnes();
    list = list.filter(function (n) { return n.toLowerCase() !== name.toLowerCase(); });
    list.unshift(name);
    list = list.slice(0, 20);
    localStorage.setItem(LS_PERSONNES, JSON.stringify(list));
    renderPersonneList();
  }

  function renderPersonneList() {
    var dl = document.getElementById("personneList");
    var list = loadPersonnes();
    if (list.indexOf("Charles") === -1) list.unshift("Charles");
    dl.innerHTML = "";
    list.forEach(function (n) {
      var opt = document.createElement("option");
      opt.value = n;
      dl.appendChild(opt);
    });
  }

  // ---------- Chips ----------

  function wireChips(containerId, autreWrapId, autreInputId, stateKey) {
    var container = document.getElementById(containerId);
    var chips = container.querySelectorAll(".chip");
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        chips.forEach(function (c) { c.classList.remove("active"); });
        chip.classList.add("active");
        state[stateKey] = chip.getAttribute("data-val");
        var isAutre = state[stateKey] === "Autre";
        document.getElementById(autreWrapId).classList.toggle("show", isAutre);
        if (isAutre) document.getElementById(autreInputId).focus();
      });
    });
  }

  function resetChips(containerId) {
    document.getElementById(containerId).querySelectorAll(".chip").forEach(function (c) {
      c.classList.remove("active");
    });
  }

  // ---------- Stepper ----------

  function currentHeures() {
    var v = parseFloat(document.getElementById("fHeures").value);
    return isNaN(v) ? 0 : v;
  }

  function setHeures(v) {
    if (v < 0) v = 0;
    document.getElementById("fHeures").value = Math.round(v * 100) / 100;
  }

  // ---------- Rendering ----------

  function render() {
    var entries = loadEntries();
    var today = todayStr();
    var month = monthPrefix(today);

    var dayTotal = 0, monthTotal = 0;
    entries.forEach(function (e) {
      if (e.date === today) dayTotal += e.heures;
      if (monthPrefix(e.date) === month) monthTotal += e.heures;
    });

    document.querySelector("#totalDay span").textContent = fmtH(dayTotal);
    document.querySelector("#totalMonth span").textContent = fmtH(monthTotal);

    var todays = entries.filter(function (e) { return e.date === today; })
      .sort(function (a, b) { return b.ts - a.ts; });

    var list = document.getElementById("histList");
    if (todays.length === 0) {
      list.innerHTML = '<div class="empty-hist">Aucune saisie pour l\u2019instant.</div>';
      return;
    }
    list.innerHTML = "";
    todays.forEach(function (e) {
      var row = document.createElement("div");
      row.className = "entry";
      var time = new Date(e.ts);
      var timeStr = pad(time.getHours()) + ":" + pad(time.getMinutes());
      row.innerHTML =
        '<div><span class="pending-dot" style="' + (e.synced ? "visibility:hidden" : "") + '"></span>' +
        '<span class="meta">' + timeStr + " · " + escapeHtml(e.lieu) + " · " + escapeHtml(e.tache) + "</span></div>" +
        '<div class="dur">' + fmtH(e.heures) + " h</div>";
      list.appendChild(row);
    });
  }

  function escapeHtml(s) {
    return (s || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ---------- Save ----------

  function showStatus(msg) {
    document.getElementById("statusMsg").textContent = msg || "";
  }

  function onSave() {
    var date = document.getElementById("fDate").value;
    var personne = document.getElementById("fPersonne").value.trim();
    var lieu = state.lieu === "Autre" ? document.getElementById("lieuAutre").value.trim() : state.lieu;
    var tache = state.tache === "Autre" ? document.getElementById("tacheAutre").value.trim() : state.tache;
    var heures = currentHeures();

    if (!date) return showStatus("Choisis une date.");
    if (!personne) return showStatus("Indique le nom de la personne.");
    if (!lieu) return showStatus("Choisis un lieu.");
    if (!tache) return showStatus("Choisis une tâche.");
    if (!heures || heures <= 0) return showStatus("Indique un temps passé supérieur à 0.");

    showStatus("");

    var entry = {
      id: "e" + Date.now() + Math.floor(Math.random() * 1000),
      date: date,
      personne: personne,
      lieu: lieu,
      tache: tache,
      heures: heures,
      ts: Date.now(),
      synced: false
    };

    var entries = loadEntries();
    entries.push(entry);
    saveEntries(entries);
    rememberPersonne(personne);

    // reset lieu/tache/heures for next entry, keep date + personne
    state.lieu = null;
    state.tache = null;
    resetChips("lieuChips");
    resetChips("tacheChips");
    document.getElementById("lieuAutreWrap").classList.remove("show");
    document.getElementById("tacheAutreWrap").classList.remove("show");
    document.getElementById("lieuAutre").value = "";
    document.getElementById("tacheAutre").value = "";
    document.getElementById("fHeures").value = "";

    render();
    syncPending();
  }

  // ---------- Sync ----------

  function getWebhook() {
    return localStorage.getItem(LS_WEBHOOK) || "";
  }

  function updateSyncInfo() {
    var entries = loadEntries();
    var pending = entries.filter(function (e) { return !e.synced; }).length;
    var el = document.getElementById("syncInfo");
    if (!el) return;
    if (pending === 0) {
      el.innerHTML = "Tout est synchronisé.";
    } else {
      el.innerHTML = "<b>" + pending + "</b> saisie(s) en attente d'envoi.";
    }
  }

  function syncPending() {
    var url = getWebhook();
    updateSyncInfo();
    if (!url || !navigator.onLine) return;

    var entries = loadEntries();
    var pending = entries.filter(function (e) { return !e.synced; });
    if (pending.length === 0) return;

    pending.forEach(function (entry) {
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          date: entry.date,
          personne: entry.personne,
          lieu: entry.lieu,
          tache: entry.tache,
          heures: entry.heures
        })
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data && data.status === "ok") {
            markSynced(entry.id);
          }
        })
        .catch(function () {
          // stays pending, will retry later
        });
    });
  }

  function markSynced(id) {
    var entries = loadEntries();
    entries = entries.map(function (e) {
      if (e.id === id) e.synced = true;
      return e;
    });
    saveEntries(entries);
    render();
    updateSyncInfo();
  }

  // ---------- CSV export ----------

  function exportCsv() {
    var entries = loadEntries().sort(function (a, b) { return a.ts - b.ts; });
    var lines = ["Date;Personne;Lieu;Tache;Temps passe (h)"];
    entries.forEach(function (e) {
      lines.push([e.date, e.personne, e.lieu, e.tache, String(e.heures).replace(".", ",")]
        .map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; })
        .join(";"));
    });
    var blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "acro-poles-" + todayStr() + ".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // ---------- Init ----------

  function init() {
    document.getElementById("fDate").value = todayStr();
    renderPersonneList();
    if (!document.getElementById("fPersonne").value) {
      document.getElementById("fPersonne").value = "Charles";
    }

    wireChips("lieuChips", "lieuAutreWrap", "lieuAutre", "lieu");
    wireChips("tacheChips", "tacheAutreWrap", "tacheAutre", "tache");

    document.getElementById("hMinus").addEventListener("click", function () {
      setHeures(currentHeures() - 0.25);
    });
    document.getElementById("hPlus").addEventListener("click", function () {
      setHeures(currentHeures() + 0.25);
    });
    document.querySelectorAll(".quick-h button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setHeures(currentHeures() + parseFloat(btn.getAttribute("data-add")));
      });
    });

    document.getElementById("saveBtn").addEventListener("click", onSave);

    // Settings modal
    var modal = document.getElementById("settingsModal");
    document.getElementById("openSettings").addEventListener("click", function () {
      document.getElementById("webhookUrl").value = getWebhook();
      updateSyncInfo();
      modal.classList.add("show");
    });
    document.getElementById("closeSettings").addEventListener("click", function () {
      modal.classList.remove("show");
    });
    document.getElementById("saveSettings").addEventListener("click", function () {
      var url = document.getElementById("webhookUrl").value.trim();
      localStorage.setItem(LS_WEBHOOK, url);
      modal.classList.remove("show");
      syncPending();
    });
    document.getElementById("exportCsv").addEventListener("click", exportCsv);
    document.getElementById("clearLocal").addEventListener("click", function () {
      if (confirm("Vider l'historique local de cet appareil ? (les données déjà envoyées dans Google Sheets ne sont pas touchées)")) {
        localStorage.removeItem(LS_ENTRIES);
        render();
        updateSyncInfo();
      }
    });

    window.addEventListener("online", syncPending);

    render();
    syncPending();

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("service-worker.js").catch(function () {});
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
