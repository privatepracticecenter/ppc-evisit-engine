/**
 * PPC E-Visit Engine - Production Vault Endpoint & Multi-Sheet Router
 * Target File: workflows/apps-script-vault.gs
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000); // 10s wait lock

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return respondJSON({ status: "error", message: "Empty payload received" }, 400);
    }

    var payload = JSON.parse(e.postData.contents);
    var vertical = (payload.vertical || "HEALTH").toUpperCase();
    var data = payload.data || {};

    // 1. Identity Validation
    if (!data.firstName || !data.lastName || !data.dob) {
      return respondJSON({ status: "error", message: "Missing required identity fields" }, 422);
    }

    // 2. Ticket & Metadata Generation
    var timestamp = new Date().toISOString();
    var ticketId = "PPC-" + vertical.substring(0, 3) + "-" + Math.floor(100000 + Math.random() * 900000);

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 3. Dynamic Vertical Sheet Routing
    var targetSheetName = "Vault_" + vertical.charAt(0) + vertical.slice(1).toLowerCase();
    var sheet = ss.getSheetByName(targetSheetName);
    if (!sheet) {
      sheet = ss.insertSheet(targetSheetName);
      initializeSheetHeaders(sheet);
    }

    // 4. Record Intake Data
    var contextDetails = data.clinicalNotes || data.matterContext || data.financialContext || "";
    sheet.appendRow([
      ticketId,
      timestamp,
      data.firstName,
      data.lastName,
      data.dob,
      data.state || "",
      data.serviceCode || "",
      contextDetails,
      isAttested(data.attestConsent)
    ]);

    // 5. Compliance Audit Log
    writeAuditLog(ss, ticketId, vertical, timestamp);

    return respondJSON({
      status: "success",
      ticketId: ticketId,
      timestamp: timestamp,
      message: "Intake record successfully vaulted."
    }, 200);

  } catch (err) {
    return respondJSON({ status: "error", message: err.toString() }, 500);
  } finally {
    lock.releaseLock();
  }
}

// Normalize attestation check across browser variants ("on", "true", true, 1)
function isAttested(val) {
  if (!val) return "NO";
  var str = String(val).toLowerCase().trim();
  return (str === "on" || str === "true" || str === "1" || val === true) ? "YES" : "NO";
}

function initializeSheetHeaders(sheet) {
  var headers = ["Ticket ID", "Timestamp", "First Name", "Last Name", "DOB", "State", "Service Code", "Context/Notes", "Attestation"];
  sheet.appendRow(headers);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
}

function writeAuditLog(ss, ticketId, vertical, timestamp) {
  var auditSheet = ss.getSheetByName("Audit_Log");
  if (!auditSheet) {
    auditSheet = ss.insertSheet("Audit_Log");
    auditSheet.appendRow(["Event ID", "Ticket ID", "Vertical", "Timestamp", "Action", "Status"]);
    auditSheet.getRange(1, 1, 1, 6).setFontWeight("bold");
  }
  auditSheet.appendRow([
    "EVT-" + Utilities.getUuid().substring(0, 8),
    ticketId,
    vertical,
    timestamp,
    "INTAKE_VAULTED",
    "SUCCESS"
  ]);
}

function respondJSON(obj, statusCode) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
