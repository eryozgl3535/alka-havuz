// Asistan sunucusu. Son güncelleme: 15 Ekim 2026
// ANTHROPIC_API_KEY varsa Claude Haiku 5.5 kullanılır (ücretli kredi: kota takılması yok, hızlı).
// Yoksa (ya da Claude geçici olarak cevap veremezse) eskisi gibi Gemini ile çalışır.
// Tarayıcı tarafı tek bir biçim bilir (Gemini biçimi); Claude'a çeviri burada yapılır.
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

// ------------------------------------------------------------ Claude
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-5-5';

// Gemini araç şeması (type: 'OBJECT', 'STRING'...) → JSON Schema (küçük harf)
function semaCevir(x) {
  if (Array.isArray(x)) return x.map(semaCevir);
  if (!x || typeof x !== 'object') return x;
  const o = {};
  for (const [k, v] of Object.entries(x)) o[k] = k === 'type' && typeof v === 'string' ? v.toLowerCase() : semaCevir(v);
  return o;
}

// Gemini biçimli sohbet → Claude mesajları. Araç çağrılarına kimlik verilir, ardışık aynı roller birleştirilir.
function mesajCevir(contents) {
  const mesajlar = [];
  let sayac = 0;
  const bekleyen = []; // kimliği olmayan araç çağrıları için sıra
  for (const c of contents) {
    const role = c.role === 'model' ? 'assistant' : 'user';
    const bloklar = [];
    for (const p of c.parts || []) {
      if (p.text && p.text.trim()) bloklar.push({ type: 'text', text: p.text });
      else if (p.functionCall) {
        const id = p.functionCall.id || `toolu_alka_${++sayac}`;
        if (!p.functionCall.id) bekleyen.push(id);
        bloklar.push({ type: 'tool_use', id, name: p.functionCall.name, input: p.functionCall.args || {} });
      } else if (p.functionResponse) {
        const id = p.functionResponse.id || bekleyen.shift() || `toolu_alka_${++sayac}`;
        const icerik = p.functionResponse.response?.sonuc ?? p.functionResponse.response;
        bloklar.push({ type: 'tool_result', tool_use_id: id, content: typeof icerik === 'string' ? icerik : JSON.stringify(icerik ?? '') });
      }
    }
    if (!bloklar.length) continue;
    const son = mesajlar[mesajlar.length - 1];
    if (son && son.role === role) son.content.push(...bloklar);
    else mesajlar.push({ role, content: bloklar });
  }
  while (mesajlar.length && mesajlar[0].role !== 'user') mesajlar.shift();
  return mesajlar;
}

async function claudeCagir(anahtar, govde, sure) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': anahtar, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(govde),
    signal: AbortSignal.timeout(sure),
  });
  const veri = await r.json().catch(() => null);
  return { r, veri };
}

// Başarılıysa cevabı yollar ve true döner; geçici hatada false döner (Gemini yedeğine geçilebilir).
async function claudeIle(res, anahtar, { sistem, contents, tools }, baslangic) {
  const aracli = Array.isArray(tools) && tools.length > 0;
  const araclar = aracli ? tools.map((t) => ({
    name: t.name, description: t.description || '',
    input_schema: t.parameters ? semaCevir(t.parameters) : { type: 'object', properties: {} },
  })) : undefined;
  // Sabit kısımlar (talimat + müşteri listesi + araçlar) önbelleğe alınır: her soruda tekrar ödenmez, daha hızlı okunur
  if (araclar?.length) araclar[araclar.length - 1].cache_control = { type: 'ephemeral' };
  const govde = {
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    thinking: { type: 'disabled' },  // günlük işler için uzun düşünmeye gerek yok: en hızlı cevap
    system: sistem ? [{ type: 'text', text: String(sistem), cache_control: { type: 'ephemeral' } }] : undefined,
    messages: mesajCevir(contents),
    ...(araclar ? { tools: araclar } : {}),
  };
  if (!govde.messages.length) { cevap(res, 400, { hata: 'Mesaj yok.' }); return true; }

  let son = '';
  for (let deneme = 0; deneme < 2; deneme++) {
    const kalan = TOPLAM_SURE - (Date.now() - baslangic);
    if (kalan < 5000) break;
    if (deneme) await new Promise((r) => setTimeout(r, 1500));
    try {
      const { r, veri } = await claudeCagir(anahtar, govde, Math.min(30000, kalan));
      if (r.ok) {
        const bloklar = veri?.content || [];
        const parts = [];
        for (const b of bloklar) {
          if (b.type === 'text' && b.text) parts.push({ text: b.text });
          else if (b.type === 'tool_use') parts.push({ functionCall: { id: b.id, name: b.name, args: b.input || {} } });
        }
        const metin = bloklar.filter((b) => b.type === 'text').map((b) => b.text).join('');
        cevap(res, 200, { metin, icerik: { role: 'model', parts }, bitis: veri?.stop_reason || null, model: CLAUDE_MODEL, sure: Date.now() - baslangic });
        return true;
      }
      son = `Claude ${r.status}: ${veri?.error?.message || ''}`;
      if (r.status === 400 && !/credit|balance|billing/i.test(son)) { cevap(res, 400, { hata: son, kod: 'istek' }); return true; }
      if (r.status === 401 || r.status === 403) { console.error(son); return 'anahtar'; }   // anahtar sorunu: Gemini'ye geç
      if (r.status === 402 || /credit|balance|billing/i.test(son)) { console.error(son); return 'kredi'; } // kredi bitti
      // 429 / 500 / 529 (yoğunluk): kısa bekleyip bir kez daha dene
    } catch (e) {
      son = e?.name === 'TimeoutError' ? 'Claude zaman aşımı' : (e?.message || 'Claude hatası');
    }
  }
  console.error(son);
  return false;
}

// ------------------------------------------------------------ giriş
export default async function handler(req, res) {
  if (req.method !== 'POST') return cevap(res, 405, { hata: 'Sadece POST' });
  const baslangic = Date.now();
  const govdeVeri = await govdeOku(req);
  if (!Array.isArray(govdeVeri.contents) || !govdeVeri.contents.length) return cevap(res, 400, { hata: 'Mesaj yok.' });

  const claudeAnahtar = (process.env.ANTHROPIC_API_KEY || '').trim();
  const geminiAnahtar = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim();
  const aracParcasi = govdeVeri.contents.some((c) => (c.parts || []).some((p) => p.functionCall || p.functionResponse));
  const claudeTuru = String(govdeVeri.model || '').startsWith('claude');

  if (claudeAnahtar && (!govdeVeri.model || claudeTuru)) {
    const sonuc = await claudeIle(res, claudeAnahtar, govdeVeri, baslangic);
    if (sonuc === true) return;
    // Claude'un başlattığı bir araç turu Gemini'de sürdürülemez (kimlikler farklı)
    if (aracParcasi || !geminiAnahtar) {
      const hata = sonuc === 'kredi' ? 'Claude kredisi bitmiş. platform.claude.com üzerinden kredi yükle.'
        : sonuc === 'anahtar' ? 'Claude anahtarı geçersiz. Vercel\'deki ANTHROPIC_API_KEY değerini kontrol et.'
        : 'Yapay zekâ şu an cevap veremedi. Birkaç saniye sonra tekrar dene.';
      return cevap(res, 503, { hata, kod: 'zaman' });
    }
  }
  return geminiIle(res, geminiAnahtar, govdeVeri, baslangic);
}

// ------------------------------------------------------------ Gemini (yedek)
async function geminiIle(res, anahtar, govdeVeri, baslangic) {
  if (!anahtar) return cevap(res, 500, { hata: 'Yapay zekâ anahtarı Vercel ayarlarında yok.' });
  try {
    const { sistem, contents, tools, model: tercih } = govdeVeri;
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
