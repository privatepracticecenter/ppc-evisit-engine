/**
 * PPC E-Visit Engine - Dual-Payload Router
 * Routes non-sensitive metadata to Supabase and confidential details to Google Vault.
 */

export async function submitIntake(formData, config) {
  const requestId = 'REQ-' + Date.now().toString(36).toUpperCase();
  const timestamp = new Date().toISOString();

  // 1. NON-SENSITIVE PAYLOAD -> Supabase Operational Ledger
  const ledgerPayload = {
    request_id: requestId,
    member_id: config.memberId,
    vertical: config.vertical || 'HEALTH',
    status: 'PENDING',
    created_at: timestamp
  };

  // 2. CONFIDENTIAL PAYLOAD -> Google Workspace Vault (Apps Script)
  const vaultPayload = {
    request_id: requestId,
    timestamp: timestamp,
    client_name: formData.clientName,
    client_email: formData.clientEmail,
    client_dob: formData.clientDob,
    intake_answers: formData.answers,
    attestations: formData.attestations
  };

  try {
    // Dispatch confidential payload directly to Google Workspace
    const vaultResponse = await fetch(config.googleVaultUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vaultPayload)
    });

    // Dispatch ledger metadata to Supabase endpoint
    const ledgerResponse = await fetch(config.supabaseLedgerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ledgerPayload)
    });

    return {
      success: vaultResponse.ok && ledgerResponse.ok,
      requestId: requestId
    };
  } catch (error) {
    console.error('Submission Routing Error:', error);
    return { success: false, error: error.message };
  }
}
