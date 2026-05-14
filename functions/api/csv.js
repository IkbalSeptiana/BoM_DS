export async function onRequestGet(context) {
  // Mengambil rahasia dari Environment Variables Cloudflare
  const SPREADSHEET_ID = context.env.VITE_SPREADSHEET_ID;
  
  // Mengambil nama sheet dari URL (misal: /api/csv?sheet=BanList)
  const url = new URL(context.request.url);
  const sheetName = url.searchParams.get('sheet') || 'BoM1dice';

  // Membangun URL rahasia ke Google
  const googleUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}&t=${Date.now()}`;

  try {
    const response = await fetch(googleUrl);
    const csvData = await response.text();

    return new Response(csvData, {
      headers: {
        'Content-Type': 'text/csv',
        'Cache-Control': 'no-cache'
      }
    });
  } catch (err) {
    return new Response("Gagal mengambil data", { status: 500 });
  }
}