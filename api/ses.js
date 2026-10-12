// Doğal Türkçe ses: asistanın cevabını Gemini'nin konuşma modeliyle okur, WAV olarak döner.
// Tarayıcının yerleşik sesi Türkçe isimleri bozuk okuduğu için kullanılıyor; hata olursa tarayıcı eski sese döner.
export const config = { maxDuration: 30 };

const MODELLER = [process.env.GEMINI_TTS_MODEL, 'gemini-2.5-flash-preview-tts', 'gemini-2.5-flash-tts'].filter(Boolean);
const SES = process.env.GEMINI_TTS_VOICE || 'Kore';

function hata(res, kod, mesaj) {
  res.statusCode = kod;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ hata: mesaj }));
}
async function govdeOku(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  const p = []; for await (const x of req) p.push(x);
  try { return JSON.parse(Buffer.concat(p).toString('utf8') || '{}'); } catch { return {}; }
}
// Gemini ham ses verir (16 bit, tek kanal); tarayıcının çalabilmesi için WAV başlığı eklenir
function wav(pcm, hz) {
  const b = Buffer.alloc(44);
  b.write('RIFF', 0); b.writeUInt32LE(36 + pcm.length, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(hz, 24);
  b.writeUInt32LE(hz * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([b, pcm]);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return hata(res, 405, 'Sadece POST');
  const anahtar = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim();
  if (!anahtar) return hata(res, 500, 'Gemini anahtarı yok');
  const { metin } = await govdeOku(req);
  const t = String(metin || '').trim().slice(0, 900);
  if (!t) return hata(res, 400, 'Metin yok');
  let son = '';
  for (const model of MODELLER) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': anahtar },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Samimi, sıcak ve akıcı bir Türkçeyle, doğal hızda söyle: ${t}` }] }],
          generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: SES } } } },
        }),
        signal: AbortSignal.timeout(25000),
      });
      const v = await r.json().catch(() => null);
      if (!r.ok) { son = `${model}: ${r.status} ${v?.error?.message || ''}`; if (r.status === 404 || r.status === 400) continue; break; }
      const parca = v?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (!parca) { son = 'Ses gelmedi'; continue; }
      const hz = Number((parca.inlineData.mimeType || '').match(/rate=(\d+)/)?.[1]) || 24000;
      const ses = wav(Buffer.from(parca.inlineData.data, 'base64'), hz);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Cache-Control', 'no-store');
      return res.end(ses);
    } catch (e) { son = e?.message || String(e); }
  }
  return hata(res, 502, 'Doğal ses alınamadı: ' + son.slice(0, 200));
}
