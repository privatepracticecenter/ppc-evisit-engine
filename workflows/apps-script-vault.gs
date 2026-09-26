/**
 * PPC E-Visit Engine - Google Apps Script Vault Handler
 * Receives confidential intake data and logs it directly to the provider's BAA Google Vault.
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Append submission entry to the Master Log
    sheet.appendRow([
      new Date(),
      data.request_id || '',
      data.client_name || '',
      data.client_email || '',
      data.client_dob || '',
      JSON.stringify(data.intake_answers || {}),
      JSON.stringify(data.attestations || {})
    ]);
    
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success', request_id: data.request_id }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
