// Microsoft Azure ile doğal Türkçe ses: metni mp3'e çevirir. Asistanın beyni Claude; bu sadece cevabı okur.
// ElevenLabs hakkı bitince (ya da hiç yoksa) tarayıcı cevapları bu sesle okutur.
// Vercel ayarları: AZURE_SPEECH_KEY (gizli), AZURE_SPEECH_REGION (örn. westeurope)
// GET/POST /api/ses-oku?metin=...  → audio/mpeg      GET /api/ses-oku?durum=1 → { var: true/false }
export const config = { maxDuration: 20 };

const SES = process.env.AZURE_SPEECH_VOICE || 'tr-TR-AhmetNeural';
const xml = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function json(res, kod, veri) {
  res.statusCode = kod;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(veri));
}

async function govdeOku(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  const p = []; for await (const x of req) p.push(x);
  try { return JSON.parse(Buffer.concat(p).toString('utf8') || '{}'); } catch { return {}; }
}

export default async function handler(req, res) {
  const anahtar = (process.env.AZURE_SPEECH_KEY || '').trim();
  const bolge = (process.env.AZURE_SPEECH_REGION || 'westeurope').trim().toLowerCase().replace(/\s+/g, '');
  const q = new URL(req.url || '/', 'http://x').searchParams;
  if (q.get('durum')) return json(res, 200, { var: !!anahtar, bolge, ses: SES });
  if (!anahtar) return json(res, 503, { hata: 'Azure ses anahtarı yok', kod: 'yok' });

  const govde = req.method === 'POST' ? await govdeOku(req) : {};
  const metin = String(govde.metin || q.get('metin') || '').slice(0, 1500).trim();
  if (!metin) return json(res, 400, { hata: 'Metin yok' });
  const ses = /^tr-TR-\w+Neural$/.test(govde.ses || q.get('ses') || '') ? (govde.ses || q.get('ses')) : SES;

  const ssml = `<speak version="1.0" xml:lang="tr-TR" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts"><voice name="${ses}"><prosody rate="+6%">${xml(metin)}</prosody></voice></speak>`;
  try {
    const r = await fetch(`https://${bolge}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': anahtar,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'alka-tesisat',
      },
      body: ssml,
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      return json(res, r.status === 401 || r.status === 403 ? 503 : 502, { hata: `Azure ${r.status} ${t.slice(0, 150)}`, kod: r.status === 401 || r.status === 403 ? 'anahtar' : r.status === 429 ? 'kota' : 'hata' });
    }
    const ses2 = Buffer.from(await r.arrayBuffer());
    res.statusCode = 200;
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Length', ses2.length);
    return res.end(ses2);
  } catch (e) {
    return json(res, 502, { hata: 'Azure ses üretilemedi: ' + (e?.message || e), kod: 'hata' });
  }
}
