// Asistan sunucusu (Gemini). Son güncelleme: 12 Ekim 2026
// Yapay zeka asistanı için Gemini aracısı: tarayıcı Google'a doğrudan değil bu sunucu üzerinden bağlanır.
// (Mobilde bazı ağ/reklam engelleyiciler googleapis adresini kesebiliyor; ayrıca anahtar tarayıcıya gitmez.)
// İki kullanım:
//  - tools ile: Gemini "araç çağırma" yapar; modelin cevabı (parçalarıyla birlikte) olduğu gibi döner,
//    araçları tarayıcı çalıştırır ve sonucu bir sonraki istekte geri yollar.
//  - tools olmadan: eski düz JSON cevap kullanımı.
export const config = { maxDuration: 60 };

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

function cevap(res, kod, veri) {
  res.statusCode = kod;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(veri));
}

async function govdeOku(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  const parcalar = [];
  for await (const p of req) parcalar.push(p);
  try { return JSON.parse(Buffer.concat(parcalar).toString('utf8') || '{}'); } catch { return {}; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return cevap(res, 405, { hata: 'Sadece POST' });
  const anahtar = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim();
  if (!anahtar) return cevap(res, 500, { hata: 'Gemini anahtarı Vercel ayarlarında yok.' });
  try {
    const { sistem, contents, tools } = await govdeOku(req);
    if (!Array.isArray(contents) || !contents.length) return cevap(res, 400, { hata: 'Mesaj yok.' });
    const aracli = Array.isArray(tools) && tools.length > 0;

    const kontrol = new AbortController();
    const zaman = setTimeout(() => kontrol.abort(), 50000);
    let yanit;
    try {
      yanit = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': anahtar },
        body: JSON.stringify({
          systemInstruction: sistem ? { parts: [{ text: String(sistem) }] } : undefined,
          contents,
          ...(aracli
            ? { tools: [{ functionDeclarations: tools }], toolConfig: { functionCallingConfig: { mode: 'AUTO' } }, generationConfig: { temperature: 0.4 } }
            : { generationConfig: { responseMimeType: 'application/json', temperature: 0.3 } }),
        }),
        signal: kontrol.signal,
      });
    } finally {
      clearTimeout(zaman);
    }

    const veri = await yanit.json().catch(() => null);
    if (!yanit.ok) return cevap(res, 502, { hata: `Gemini ${yanit.status}: ${veri?.error?.message || 'bilinmeyen hata'}` });
    const icerik = veri?.candidates?.[0]?.content || { role: 'model', parts: [] };
    const metin = (icerik.parts || []).filter((p) => p.text && !p.thought).map((p) => p.text).join('');
    // Model içeriği (düşünce imzaları dahil) değiştirilmeden geri döner: araç turunda aynen geri yollanmalı.
    return cevap(res, 200, { metin, icerik: { role: 'model', parts: icerik.parts || [] }, bitis: veri?.candidates?.[0]?.finishReason || null });
  } catch (e) {
    const mesaj = e?.name === 'AbortError' ? 'Gemini çok geç cevap verdi, tekrar dene.' : (e?.message || 'Sunucu hatası');
    return cevap(res, 500, { hata: mesaj });
  }
}
