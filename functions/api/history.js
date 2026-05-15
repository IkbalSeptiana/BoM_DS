export async function onRequestGet(context) {
  const SPREADSHEET_ID = context.env.VITE_SPREADSHEET_ID;
  const GOOGLE_API_KEY = context.env.VITE_GOOGLE_API_KEY;

  const googleUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?key=${GOOGLE_API_KEY}&fields=sheets.properties`;

  try {
    // Tambahkan header Referer saat melakukan fetch ke Google
    const response = await fetch(googleUrl, {
      headers: {
        'Referer': 'https://bom-ds.top/'
      }
    });
    
    const jsonData = await response.text();

    return new Response(jsonData, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
  } catch (err) {
    return new Response("Gagal mengambil history", { status: 500 });
  }
}