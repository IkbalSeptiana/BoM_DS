export async function onRequestGet(context) {
  const SPREADSHEET_ID = context.env.VITE_SPREADSHEET_ID;
  const GOOGLE_API_KEY = context.env.VITE_GOOGLE_API_KEY;

  // Endpoint Google Drive API untuk mengambil info waktu modifikasi file
  const googleUrl = `https://www.googleapis.com/drive/v3/files/${SPREADSHEET_ID}?fields=modifiedTime&key=${GOOGLE_API_KEY}`;

  try {
    const response = await fetch(googleUrl, {
      headers: {
        'Referer': 'https://bom-ds.top/' // Sesuaikan dengan domain kamu
      }
    });
    
    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Gagal mengambil data" }), { status: response.status });
    }

    const data = await response.json();
    
    return new Response(JSON.stringify({ modifiedTime: data.modifiedTime }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Server Error" }), { status: 500 });
  }
}