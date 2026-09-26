/**
 * PPC E-Visit Engine - Secure Vault Endpoint & Multi-Sheet Router
 * Target Repository File: workflows/apps-script-vault.gs
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  // Prevent concurrent write collisions
  lock.tryLock(10000);

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return respondJSON({ status: "error", message: "Empty payload received." }, 400);
    }

    var payload = JSON.parse(e.postData.contents);
    var vertical = (payload.vertical || "HEALTH").toUpperCase();
    var data = payload.data || {};

    // 1. Basic Field Validation
    if (!data.firstName || !data.lastName || !data.dob) {
      return respondJSON({ status: "error", message: "Missing required identity fields." }, 422);
    }

    // 2. Metadata Generation
    var timestamp = new Date().toISOString();
    var ticketId = "PPC-" + vertical.substring(0, 3) + "-" + Math.floor(100000 + Math.random() * 900000);

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 3. Multi-Sheet Dynamic Routing (Health / Legal / Finance)
    var targetSheetName = getSheetNameForVertical(vertical);
    var sheet = ss.getSheetByName(targetSheetName);
    if (!sheet) {
      sheet = ss.insertSheet(targetSheetName);
      initializeSheetHeaders(sheet, vertical);
    }

    // 4. Append Substantive Intake Data
    appendIntakeRow(sheet, vertical, ticketId, timestamp, data);

    // 5. Append Compliance Audit Log Entry
    writeAuditLog(ss, ticketId, vertical, timestamp);

    // Return Success Response
    return respondJSON({
      status: "success",
      ticketId: ticketId,
      timestamp: timestamp,
      message: "Payload securely recorded in Google Workspace Vault."
    }, 200);

  } catch (err) {
    return respondJSON({ status: "error", message: err.toString() }, 500);
  } finally {
    lock.releaseLock();
  }
}

// Map vertical to specific tab
function getSheetNameForVertical(vertical) {
  switch (vertical) {
    case "LEGAL": return "Vault_Legal";
    case "FINANCE": return "Vault_Finance";
    case "HEALTH":
    default: return "Vault_Health";
  }
}

// Initialize Headers if sheet is new
function initializeSheetHeaders(sheet, vertical) {
  var commonHeaders = ["Ticket ID", "Timestamp", "First Name", "Last Name", "DOB/ID", "State/Jurisdiction", "Service Code", "Context/Notes", "Attestation Confirmed"];
  sheet.appendRow(commonHeaders);
  sheet.getRange(1, 1, 1, commonHeaders.length).setFontWeight("bold");
}

// Record Intake Payload
function appendIntakeRow(sheet, vertical, ticketId, timestamp, data) {
  var contextNote = data.clinicalNotes || data.matterContext || data.financialContext || "";
  sheet.appendRow([
    ticketId,
    timestamp,
    data.firstName || "",
    data.lastName || "",
    data.dob || "",
    data.state || "",
    data.serviceCode || "",
    contextNote,
    data.attestConsent ? "YES" : "NO"
  ]);
}

// Immutable Audit Log
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
    "RECORD_CREATED",
    "SUCCESS"
  ]);
}

// Helper: Standardized JSON Output
function respondJSON(obj, statusCode) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
