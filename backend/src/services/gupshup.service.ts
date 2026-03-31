export function buildGupshupOutboundPayload(phone: string, text: string) {
  return {
    channel: "whatsapp",
    source: process.env.GUPSHUP_SOURCE_NUMBER,
    destination: phone,
    src: process.env.GUPSHUP_APP_NAME,
    message: JSON.stringify({ type: "text", text })
  };
}

export async function sendGupshupText(phone: string, text: string) {
  const apiKey = process.env.GUPSHUP_API_KEY;
  const baseUrl = process.env.GUPSHUP_BASE_URL;

  if (!apiKey || !baseUrl) {
    return { skipped: true };
  }

  const payload = buildGupshupOutboundPayload(phone, text);

  const response = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      apikey: apiKey
    },
    body: new URLSearchParams(payload as Record<string, string>)
  });

  return response.json();
}
