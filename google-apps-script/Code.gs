// Code.gs
// A coller dans Extensions > Apps Script de la feuille Google Sheets qui recoit les saisies.
//
// Adapter uniquement la ligne SHEET_NAME ci-dessous au nom exact de l'onglet
// qui contient les colonnes Date / Personne / Lieux / Tache / Temps passe (h).

var SHEET_NAME = "Saisie"; // <-- a adapter au nom reel de l'onglet

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var data = JSON.parse(e.postData.contents);

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.getSheets()[0];
    }

    sheet.appendRow([
      data.date || "",
      data.personne || "",
      data.lieu || "",
      data.tache || "",
      data.heures || 0
    ]);

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
  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok", message: "acro-poles endpoint actif" }))
    .setMimeType(ContentService.MimeType.JSON);
}
