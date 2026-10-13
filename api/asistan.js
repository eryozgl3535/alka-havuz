// Asistan sunucusu (Gemini). Son güncelleme: 13 Ekim 2026
// Tarayıcı Google'a doğrudan değil bu sunucu üzerinden bağlanır (anahtar tarayıcıya gitmez,
// mobildeki reklam engelleyiciler googleapis adresini kesemez).
//
// HIZ VE TAKILMA ÇÖZÜMÜ
//  - Önce hızlı model (düşünme en az) denenir; kota dolarsa (429) ya da model meşgulse (503)
//    otomatik olarak sıradaki modele geçilir. Her modelin ücretsiz kotası ayrıdır, böylece
//    "1-2 mesajdan sonra tıkanma" (dakikalık kota dolması) kullanıcıya yansımaz.
//  - Her deneme için kısa süre sınırı vardır; tek bir yavaş cevap tüm sohbeti kilitlemez.
export const config = { maxDuration: 60 };

// Sıra: hızlı ve yeterince akıllı → en hafif → en güçlü (yavaş). GEMINI_MODEL verilmişse en sona yedek olarak eklenir.
const MODELLER = [
  { ad: 'gemini-3.6-flash', dusunme: 'minimal' },
  { ad: 'gemini-3.5-flash-lite', dusunme: 'minimal' },
  { ad: 'gemini-3.8-flash', dusunme: 'low' },
];
if (process.env.GEMINI_MODEL && !MODELLER.some((m) => m.ad === process.env.GEMINI_MODEL)) {
  MODELLER.push({ ad: process.env.GEMINI_MODEL, dusunme: 'low' });
}

const TOPLAM_SURE = 52000;   // Vercel 60 sn'de keser; ondan önce kendimiz bitirelim
const DENEME_SURE = 22000;   // tek bir modele en fazla bu kadar beklenir

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

async function modelCagir(anahtar, model, govde, dusunmeli, sure) {
  const gc = { ...govde.generationConfig };
  if (dusunmeli) gc.thinkingConfig = { thinkingLevel: model.dusunme };
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model.ad}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': anahtar },
    body: JSON.stringify({ ...govde, generationConfig: gc }),
    signal: AbortSignal.timeout(sure),
  });
  const veri = await r.json().catch(() => null);
  return { r, veri };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return cevap(res, 405, { hata: 'Sadece POST' });
  const anahtar = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim();
  if (!anahtar) return cevap(res, 500, { hata: 'Gemini anahtarı Vercel ayarlarında yok.' });

  const baslangic = Date.now();
  try {
    const { sistem, contents, tools, model: tercih } = await govdeOku(req);
    if (!Array.isArray(contents) || !contents.length) return cevap(res, 400, { hata: 'Mesaj yok.' });
    const aracli = Array.isArray(tools) && tools.length > 0;

    const govde = {
      systemInstruction: sistem ? { parts: [{ text: String(sistem) }] } : undefined,
      contents,
      ...(aracli ? { tools: [{ functionDeclarations: tools }], toolConfig: { functionCallingConfig: { mode: 'AUTO' } } } : {}),
      generationConfig: aracli
        ? { temperature: 0.4, maxOutputTokens: 1024 }
        : { responseMimeType: 'application/json', temperature: 0.3, maxOutputTokens: 1024 },
    };

    // Araç turunun devamında aynı modelde kalmak en sağlıklısı (düşünce imzaları o modele ait).
    const sira = tercih ? [...MODELLER.filter((m) => m.ad === tercih), ...MODELLER.filter((m) => m.ad !== tercih)] : MODELLER;
    const notlar = [];

    for (const model of sira) {
      const kalan = TOPLAM_SURE - (Date.now() - baslangic);
      if (kalan < 4000) break;
      const sure = Math.min(DENEME_SURE, kalan);
      try {
        let { r, veri } = await modelCagir(anahtar, model, govde, true, sure);
        // Model düşünme ayarını tanımazsa ayarsız bir kez daha dene
        if (r.status === 400 && /think/i.test(veri?.error?.message || '')) {
          ({ r, veri } = await modelCagir(anahtar, model, govde, false, Math.min(DENEME_SURE, TOPLAM_SURE - (Date.now() - baslangic))));
        }
        if (r.ok) {
          const aday = veri?.candidates?.[0];
          const icerik = aday?.content || { role: 'model', parts: [] };
          const metin = (icerik.parts || []).filter((p) => p.text && !p.thought).map((p) => p.text).join('');
          // İçerik (düşünce imzaları dahil) değiştirilmeden döner: araç turunda aynen geri yollanmalı.
          return cevap(res, 200, {
            metin, icerik: { role: 'model', parts: icerik.parts || [] }, bitis: aday?.finishReason || null,
            model: model.ad, sure: Date.now() - baslangic,
          });
        }
        const mesaj = veri?.error?.message || 'bilinmeyen hata';
        notlar.push(`${model.ad}: ${r.status}`);
        // Kota / meşguliyet / model yok → sıradaki modele geç
        if ([429, 500, 503, 504, 404].includes(r.status)) continue;
        // Diğer 400'ler isteğin kendisinden (ör. eski geçmiş): tarayıcı geçmişi kısaltıp tekrar dener
        return cevap(res, 400, { hata: `Gemini ${r.status}: ${mesaj}`, kod: 'istek', denenen: notlar });
      } catch (e) {
        notlar.push(`${model.ad}: ${e?.name === 'TimeoutError' || e?.name === 'AbortError' ? 'zaman aşımı' : e?.message}`);
        continue;
      }
    }
    const kotaMi = notlar.some((n) => / 429$/.test(n));
    return cevap(res, kotaMi ? 429 : 504, {
      hata: kotaMi
        ? 'Yapay zekânın dakikalık ücretsiz kotası doldu. 30 saniye sonra tekrar dene.'
        : 'Yapay zekâ şu an cevap vermiyor. Biraz sonra tekrar dene.',
      kod: kotaMi ? 'kota' : 'zaman',
      denenen: notlar,
    });
  } catch (e) {
    return cevap(res, 500, { hata: e?.message || 'Sunucu hatası' });
  }
}
