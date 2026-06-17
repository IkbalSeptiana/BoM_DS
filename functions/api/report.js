export async function onRequestPost(context) {
  const GAS_WEBHOOK_URL = context.env.GAS_WEBHOOK_URL;

  if (!GAS_WEBHOOK_URL) {
    return new Response(JSON.stringify({ status: 'error', message: 'Webhook URL not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const formData = await context.request.json();

    // Map form data to match the Google Apps Script expected format
    const payload = {
      reporterId: formData.reporterId,
      reporterName: formData.reporterName,
      reporterAlliance: formData.reporterAlliance,
      suspectId: formData.suspectId,
      suspectName: formData.suspectName,
      reason: formData.reason
    };

    // Forward to Google Apps Script webhook
    const response = await fetch(GAS_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (result.status === 'success') {
      return new Response(JSON.stringify({ status: 'success' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } else {
      return new Response(JSON.stringify({ status: 'error', message: result.message || 'Unknown error' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.toString() }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
