// Doğal Türkçe ses: asistanın cevabını Gemini'nin konuşma modeliyle okur, WAV olarak döner.
// Tarayıcının yerleşik sesi Türkçe isimleri bozuk okuduğu için kullanılıyor.
export const config = { maxDuration: 15 };

// TEK ses modeli ve TEK ses: model değişince konuşma tonu da değişiyordu. Meşgulse aynı modelle bir kez daha denenir.
const MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-tts';
const TOPLAM_SURE = 9000;
// Her cümlede aynı karakter için sabit üslup tarifi
const USLUP = 'Sakin, sıcak ve güven veren, her zaman aynı tonda, orta hızda, doğal Türkçe konuş. Abartılı vurgu yapma. Şunu söyle: ';
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
  const t = String(metin || '').trim().slice(0, 600);
  if (!t) return hata(res, 400, 'Metin yok');
  let son = '';
  const bas = Date.now();
  for (let deneme = 0; deneme < 2; deneme++) {
    const kalan = TOPLAM_SURE - (Date.now() - bas);
    if (kalan < 2500) break;
    if (deneme) await new Promise((r) => setTimeout(r, 800));
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': anahtar },
        body: JSON.stringify({
          contents: [{ parts: [{ text: USLUP + t }] }],
          generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: SES } } } },
        }),
        signal: AbortSignal.timeout(kalan),
      });
      const v = await r.json().catch(() => null);
      if (!r.ok) { son = `${r.status} ${v?.error?.message || ''}`; if ([429, 500, 503, 504].includes(r.status)) continue; break; }
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
