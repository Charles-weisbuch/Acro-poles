// Code.gs
// A coller dans Extensions > Apps Script de la feuille Google Sheets qui recoit les saisies.
// Remplace TOUT le contenu existant du fichier par celui-ci.

var SHEET_NAME = "Heures";

// --- Donnees brutes (colonnes B a F, a partir de la ligne 3) ---
var DATA_FIRST_ROW = 3;
var DATA_FIRST_COL = 2; // B

// --- Tableau "Total tache (h)" : H (labels) / I:N (personnes) / O (total) ---
var TACHE_LABELS_COL = 8;          // H
var TACHE_LABELS_FIRST_ROW = 4;
var TACHE_LABELS_LAST_ROW = 10;
var TACHE_PERSONS_ROW = 3;
var TACHE_PERSONS_FIRST_COL = 9;   // I
var TACHE_PERSONS_LAST_COL = 14;   // N
var TACHE_TOTAL_COL = 15;          // O

// --- Tableau "Lieux" : Q (labels) / R:W (personnes) / X (total) ---
var LIEU_LABELS_COL = 17;          // Q
var LIEU_LABELS_FIRST_ROW = 4;
var LIEU_LABELS_LAST_ROW = 8;
var LIEU_PERSONS_ROW = 3;
var LIEU_PERSONS_FIRST_COL = 18;   // R
var LIEU_PERSONS_LAST_COL = 23;    // W
var LIEU_TOTAL_COL = 24;           // X

// --- Tableau "Total personne (h)" : Z (personnes) / AA:AL (mois) / AM (total) ---
var PERSONNE_COL = 26;             // Z
var PERSONNE_FIRST_ROW = 3;
var PERSONNE_MAX_ROW = 20;         // limite de recherche vers le bas si tu ajoutes des personnes
var MONTHS_FIRST_COL = 27;         // AA
var MONTHS_LAST_COL = 38;          // AL
var PERSONNE_TOTAL_COL = 39;       // AM
var YEAR_TO_TRACK = new Date().getFullYear(); // change ici si besoin de suivre une autre annee

// ==================== SAISIE (app) ====================

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = getSheet_();

    var lastCell = sheet.getRange(sheet.getMaxRows(), DATA_FIRST_COL)
      .getNextDataCell(SpreadsheetApp.Direction.UP);
    var lastRow = lastCell.getRow();
    if (lastRow < DATA_FIRST_ROW - 1) lastRow = DATA_FIRST_ROW - 1;
    var targetRow = lastRow + 1;

    sheet.getRange(targetRow, DATA_FIRST_COL, 1, 5).setValues([[
      data.date || "",
      data.personne || "",
      data.lieu || "",
      data.tache || "",
      data.heures || 0
    ]]);

    try {
      recalculateTotals();
    } catch (calcErr) {
      // la saisie brute est deja enregistree meme si le recalcul echoue
      console.log("Erreur recalcul: " + calcErr);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: "ok" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  var action = e && e.parameter && e.parameter.action;
  if (action === "totals") {
    return handleGetTotals_();
  }
  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok", message: "acro-poles endpoint actif" }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Renvoie, pour chaque personne du tableau "Total personne (h)",
// son detail mois par mois (Janvier=index 0) et son total annuel.
function handleGetTotals_() {
  try {
    var sheet = getSheet_();
    var lastPersonRow = PERSONNE_FIRST_ROW - 1;
    for (var r = PERSONNE_FIRST_ROW; r <= PERSONNE_MAX_ROW; r++) {
      var name = sheet.getRange(r, PERSONNE_COL).getValue();
      if (!name) break;
      lastPersonRow = r;
    }

    var persons = [];
    if (lastPersonRow >= PERSONNE_FIRST_ROW) {
      var numPersons = lastPersonRow - PERSONNE_FIRST_ROW + 1;
      var numMonths = MONTHS_LAST_COL - MONTHS_FIRST_COL + 1;
      var names = sheet.getRange(PERSONNE_FIRST_ROW, PERSONNE_COL, numPersons, 1).getValues();
      var months = sheet.getRange(PERSONNE_FIRST_ROW, MONTHS_FIRST_COL, numPersons, numMonths).getValues();
      var totals = sheet.getRange(PERSONNE_FIRST_ROW, PERSONNE_TOTAL_COL, numPersons, 1).getValues();

      for (var i = 0; i < numPersons; i++) {
        persons.push({
          name: names[i][0],
          months: months[i].map(function (v) { return Number(v) || 0; }),
          total: Number(totals[i][0]) || 0
        });
      }
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: "ok", year: YEAR_TO_TRACK, persons: persons }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ==================== RECALCUL DES TABLEAUX ====================

// Peut aussi etre lance a la main depuis l'editeur Apps Script (menu Executer > recalculateTotals)
// apres une modification manuelle des donnees dans la feuille.
function recalculateTotals() {
  var sheet = getSheet_();
  var raw = readRawData_(sheet);
  if (!raw) return;

  fillGrid_(sheet, raw, {
    field: "tache",
    labelsCol: TACHE_LABELS_COL, labelsFirstRow: TACHE_LABELS_FIRST_ROW, labelsLastRow: TACHE_LABELS_LAST_ROW,
    personsRow: TACHE_PERSONS_ROW, personsFirstCol: TACHE_PERSONS_FIRST_COL, personsLastCol: TACHE_PERSONS_LAST_COL,
    totalCol: TACHE_TOTAL_COL
  });

  fillGrid_(sheet, raw, {
    field: "lieu",
    labelsCol: LIEU_LABELS_COL, labelsFirstRow: LIEU_LABELS_FIRST_ROW, labelsLastRow: LIEU_LABELS_LAST_ROW,
    personsRow: LIEU_PERSONS_ROW, personsFirstCol: LIEU_PERSONS_FIRST_COL, personsLastCol: LIEU_PERSONS_LAST_COL,
    totalCol: LIEU_TOTAL_COL
  });

  fillMonthlyGrid_(sheet, raw);
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  return sheet || ss.getSheets()[0];
}

function readRawData_(sheet) {
  var lastRow = sheet.getRange(sheet.getMaxRows(), DATA_FIRST_COL)
    .getNextDataCell(SpreadsheetApp.Direction.UP).getRow();
  if (lastRow < DATA_FIRST_ROW) return null;

  var values = sheet.getRange(DATA_FIRST_ROW, DATA_FIRST_COL, lastRow - DATA_FIRST_ROW + 1, 5).getValues();
  return values.map(function (r) {
    return { date: r[0], personne: r[1], lieu: r[2], tache: r[3], heures: Number(r[4]) || 0 };
  });
}

// Tableau "categories en ligne x personnes en colonne", avec total de ligne
function fillGrid_(sheet, raw, cfg) {
  var numLabels = cfg.labelsLastRow - cfg.labelsFirstRow + 1;
  var numPersons = cfg.personsLastCol - cfg.personsFirstCol + 1;

  var labels = sheet.getRange(cfg.labelsFirstRow, cfg.labelsCol, numLabels, 1).getValues();
  var persons = sheet.getRange(cfg.personsRow, cfg.personsFirstCol, 1, numPersons).getValues()[0];

  var grid = [];
  var totals = [];

  for (var i = 0; i < numLabels; i++) {
    var label = labels[i][0];
    var row = [];
    var rowTotal = 0;

    for (var p = 0; p < numPersons; p++) {
      var person = persons[p];
      var sum = 0;
      if (label && person) {
        for (var d = 0; d < raw.length; d++) {
          if (raw[d][cfg.field] === label && raw[d].personne === person) {
            sum += raw[d].heures;
          }
        }
      }
      row.push(sum);
      rowTotal += sum;
    }

    grid.push(row);
    totals.push([rowTotal]);
  }

  sheet.getRange(cfg.labelsFirstRow, cfg.personsFirstCol, numLabels, numPersons).setValues(grid);
  sheet.getRange(cfg.labelsFirstRow, cfg.totalCol, numLabels, 1).setValues(totals);
}

// Tableau "personnes en ligne x mois en colonne", avec total de ligne
function fillMonthlyGrid_(sheet, raw) {
  var lastPersonRow = PERSONNE_FIRST_ROW - 1;
  for (var r = PERSONNE_FIRST_ROW; r <= PERSONNE_MAX_ROW; r++) {
    var name = sheet.getRange(r, PERSONNE_COL).getValue();
    if (!name) break;
    lastPersonRow = r;
  }
  if (lastPersonRow < PERSONNE_FIRST_ROW) return;

  var numPersons = lastPersonRow - PERSONNE_FIRST_ROW + 1;
  var numMonths = MONTHS_LAST_COL - MONTHS_FIRST_COL + 1;
  var persons = sheet.getRange(PERSONNE_FIRST_ROW, PERSONNE_COL, numPersons, 1).getValues();

  var grid = [];
  var totals = [];

  for (var i = 0; i < numPersons; i++) {
    var person = persons[i][0];
    var row = [];
    var rowTotal = 0;

    for (var m = 1; m <= numMonths; m++) {
      var sum = 0;
      for (var d = 0; d < raw.length; d++) {
        var date = raw[d].date;
        if (raw[d].personne === person && date instanceof Date &&
            date.getFullYear() === YEAR_TO_TRACK && (date.getMonth() + 1) === m) {
          sum += raw[d].heures;
        }
      }
      row.push(sum);
      rowTotal += sum;
    }

    grid.push(row);
    totals.push([rowTotal]);
  }

  sheet.getRange(PERSONNE_FIRST_ROW, MONTHS_FIRST_COL, numPersons, numMonths).setValues(grid);
  sheet.getRange(PERSONNE_FIRST_ROW, PERSONNE_TOTAL_COL, numPersons, 1).setValues(totals);
}

// Menu pratique pour relancer le calcul a la main depuis la feuille elle-meme
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("acro-poles")
    .addItem("Recalculer les totaux", "recalculateTotals")
    .addToUi();
}

// Se declenche automatiquement a chaque modification manuelle dans la feuille
// (ne se declenche pas pour les ecritures faites par le script lui-meme,
// donc pas de risque de boucle avec recalculateTotals()).
function onEdit(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  if (sheet.getName() !== SHEET_NAME) return;

  try {
    recalculateTotals();
  } catch (err) {
    console.log("Erreur recalcul (onEdit): " + err);
  }
}
