// Sesli canlı asistan (ElevenLabs Agents + beyin olarak Claude Haiku 5.5).
// Uygulamadaki "Konuş" düğmesi buraya gelir; bu sunucu:
//  1. ElevenLabs'te "ALKA Asistan" adlı sesli ajanı bulur, yoksa KENDİSİ kurar (ilk kullanımda),
//     ajanın ayarları koddaki talimat/araçlarla aynı değilse günceller;
//  2. tarayıcıya tek kullanımlık güvenli bağlantı linki (signed URL) döndürür.
// Ajanın araçları "client" türündedir: müşteri arama, hatırlatma kurma, not, silme vb. TARAYICIDA,
// giriş yapmış kullanıcının yetkisiyle çalışır (yazılı asistanla aynı kod: src/asistanAraclar.js).
// Anahtar: Vercel ortam değişkeni ELEVENLABS_API_KEY. İsteğe bağlı: ELEVENLABS_VOICE_ID (ses seçimi).
import { createHash } from 'node:crypto';
import { ARACLAR, promptOlustur } from '../src/asistanTanimlar.js';

export const config = { maxDuration: 30 };

const API = 'https://api.elevenlabs.io';
const AJAN_ADI = 'ALKA Asistan';
const SES_ADI = 'ALKA Erkek Ses Pro';
const SES_SURUM = 'ses-2'; // ses seçimi değişince mevcut ajanın sesi de yenilenir
const YEDEK_SES = 'pNInz6obpgDQGcFmaJgB'; // ElevenLabs hazır erkek ses (Adam); Türkçe ses bulunamazsa
let onbellek = null; // { ajanId, surum } — sıcak sunucuda tekrar tekrar aramamak için

function cevap(res, kod, veri) {
  res.statusCode = kod;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(veri));
}

async function el(anahtar, yol, secenek = {}) {
  const r = await fetch(API + yol, {
    ...secenek,
    headers: { 'xi-api-key': anahtar, ...(secenek.body ? { 'Content-Type': 'application/json' } : {}), ...(secenek.headers || {}) },
    signal: AbortSignal.timeout(12000),
  });
  const veri = await r.json().catch(() => null);
  if (!r.ok) {
    const mesaj = veri?.detail?.message || veri?.detail?.[0]?.msg || (typeof veri?.detail === 'string' ? veri.detail : '') || JSON.stringify(veri || {}).slice(0, 200);
    const e = new Error(`ElevenLabs ${r.status}: ${mesaj}`);
    e.durum = r.status;
    throw e;
  }
  return veri;
}

// Uygulamanın araç şeması (type: 'OBJECT' / 'STRING'...) → ElevenLabs şeması (küçük harf, her alanın açıklaması olmalı)
function alanCevir(a, ad) {
  const tip = String(a.type || 'string').toLowerCase();
  const aciklama = a.description || ad || 'değer';
  if (tip === 'array') return { type: 'array', description: aciklama, items: alanCevir({ ...(a.items || { type: 'STRING' }), description: a.items?.description || aciklama }, ad) };
  if (tip === 'object') return nesneCevir(a, aciklama);
  return { type: tip, description: aciklama, ...(a.enum ? { enum: a.enum } : {}) };
}
function nesneCevir(p, aciklama) {
  const properties = {};
  for (const [ad, a] of Object.entries(p?.properties || {})) properties[ad] = alanCevir(a, ad);
  return { type: 'object', ...(aciklama ? { description: aciklama } : {}), properties, required: p?.required || [] };
}

function araclar() {
  const liste = ARACLAR.map((t) => ({
    type: 'client',
    name: t.name,
    description: t.description || t.name,
    parameters: nesneCevir(t.parameters || { properties: {} }),
    expects_response: true,
    response_timeout_secs: 20,
  }));
  // Sesli silme onayı: kayıt ancak kullanıcı sesle açıkça "evet" dediyse silinir (kontrol tarayıcıda, kodla)
  liste.push({
    type: 'client',
    name: 'silmeyi_onayla',
    description: 'kayit_sil ile onay istenen silme için kullanıcının cevabını iletir. Kullanıcı "evet / sil / onaylıyorum" derse onay=true, "hayır / vazgeç" derse onay=false ile çağır. Kayıt sadece kullanıcı gerçekten evet dediyse silinir.',
    parameters: { type: 'object', properties: { onay: { type: 'boolean', description: 'Kullanıcı silmeyi onayladı mı' } }, required: ['onay'] },
    expects_response: true,
    response_timeout_secs: 20,
  });
  return liste;
}

function talimat() {
  return promptOlustur({ kullanici: '{{kullanici}}', hitap: '{{hitap}}', bugun: '{{bugun}}', musteriListesi: '{{musteri_listesi}}', sesli: true })
    + `

SESLİ GÖRÜŞME KURALLARI
- Gerçek zamanlı sesli konuşuyorsun: kısa, doğal, sıcak bir erkek sesiyle; cümleler kısa olsun.
- Araç çalışırken uzun bekleme olacaksa tek kelimeyle "bakıyorum" diyebilirsin, fazlası değil.
- SİLME: kayit_sil'den sonra "… siliniyor, emin misin?" diye sor. Kullanıcı cevap verince MUTLAKA silmeyi_onayla aracını çağır (evet → onay=true, hayır → onay=false). Araç "silindi" demeden "sildim" deme.`;
}

function ajanAyari(sesId) {
  return {
    name: AJAN_ADI,
    conversation_config: {
      agent: {
        first_message: 'Buyur {{hitap}}, dinliyorum.',
        language: 'tr',
        dynamic_variables: {
          dynamic_variable_placeholders: { kullanici: 'Eray', hitap: 'Eray', bugun: 'bugün', musteri_listesi: '(liste yok)' },
        },
        prompt: {
          prompt: talimat(),
          llm: process.env.ELEVENLABS_LLM || 'claude-haiku-5-5',
          temperature: 0.4,
          max_tokens: 400,
          tools: araclar(),
        },
      },
      // turbo v2.5: Türkçede flash'tan daha net ve doğal, gecikmesi hâlâ çok düşük
      tts: { model_id: 'eleven_turbo_v2_5', voice_id: sesId, stability: 0.6, similarity_boost: 0.75, speed: 1.0 },
      turn: { turn_eagerness: 'normal', silence_end_call_timeout: 90 },
    },
    platform_settings: { auth: { enable_auth: true } },
  };
}

// Ayarların kısa parmak izi: kod değişince ajan kendiliğinden güncellenir
function surum(ayar) {
  const kopya = JSON.parse(JSON.stringify(ayar));
  kopya.conversation_config.tts.voice_id = 'x';
  return 'alka-' + createHash('sha1').update(JSON.stringify(kopya)).digest('hex').slice(0, 10);
}

// Türkçe erkek ses: önce kütüphanemizde var mı, yoksa ElevenLabs ses kütüphanesinden en çok kullanılan Türkçe erkek sesi ekle
async function sesBul(anahtar) {
  if (process.env.ELEVENLABS_VOICE_ID) return process.env.ELEVENLABS_VOICE_ID;
  try {
    const benim = await el(anahtar, `/v1/voices?search=${encodeURIComponent(SES_ADI)}`);
    const var_ = (benim?.voices || []).find((v) => v.name === SES_ADI);
    if (var_) return var_.voice_id;
  } catch { /* devam */ }
  try {
    // Önce stüdyo kalitesindeki (profesyonel kayıtlı) sesler: yankısız, temiz; yoksa yüksek kaliteli olanlar
    let aday = null;
    for (const kategori of ['professional', 'high_quality', '']) {
      const paylasilan = await el(anahtar, `/v1/shared-voices?language=tr&gender=male&page_size=40&sort=cloned_by_count${kategori ? '&category=' + kategori : ''}`);
      aday = (paylasilan?.voices || []).filter((v) => v.free_users_allowed !== false && !/narrat|asmr|whisper|fısıltı|old|yaşlı|radio|radyo/i.test(`${v.name} ${v.descriptive} ${v.use_case} ${v.description || ''}`))
        .sort((a, b) => (b.cloned_by_count || 0) - (a.cloned_by_count || 0))[0];
      if (aday) break;
    }
    if (aday) {
      const eklenen = await el(anahtar, `/v1/voices/add/${aday.public_owner_id}/${aday.voice_id}`, { method: 'POST', body: JSON.stringify({ new_name: SES_ADI }) });
      if (eklenen?.voice_id) return eklenen.voice_id;
    }
  } catch (e) { console.error('Türkçe ses eklenemedi:', e.message); }
  return YEDEK_SES;
}

async function ajanHazirla(anahtar) {
  const liste = await el(anahtar, `/v1/convai/agents?search=${encodeURIComponent(AJAN_ADI)}&page_size=30`);
  const mevcut = (liste?.agents || []).find((a) => a.name === AJAN_ADI && !a.archived);
  if (mevcut) {
    const sesYeni = !(mevcut.tags || []).includes(SES_SURUM);
    const ayar = ajanAyari(sesYeni ? await sesBul(anahtar) : (mevcut.voice_id || YEDEK_SES));
    const s = surum(ayar);
    if (sesYeni || !(mevcut.tags || []).includes(s)) {
      const korunan = (mevcut.tags || []).filter((t) => t.startsWith('secim'));
      await el(anahtar, `/v1/convai/agents/${mevcut.agent_id}`, { method: 'PATCH', body: JSON.stringify({ ...ayar, tags: [s, SES_SURUM, ...korunan] }) });
    }
    return { ajanId: mevcut.agent_id, surum: s };
  }
  const ayar = ajanAyari(await sesBul(anahtar));
  const s = surum(ayar);
  const yeni = await el(anahtar, '/v1/convai/agents/create', { method: 'POST', body: JSON.stringify({ ...ayar, tags: [s, SES_SURUM] }) });
  return { ajanId: yeni.agent_id, surum: s };
}

// ------------------------------------------------------------ ses seçici
const ORNEK_METIN = 'Merhaba Eray, ben ALKA asistanınım. Bugün iki bakım randevun var; ilki Alaçatı\'da saat onda.';
const HAZIR_TERCIH = /^(eric|chris|brian|will|daniel|roger|sarah|jessica|matilda|alice|river)\b/i;

async function sesListesi(anahtar) {
  const sesler = [];
  // 1) Stüdyo kayıtlı (profesyonel) Türkçe sesler — Türkçe örnekleri hazır. Sohbete uygun (net, doğal, sakin) olanlar öne.
  const puan = (v) => {
    const t = `${v.name} ${v.descriptive || ''} ${v.use_case || ''} ${v.description || ''}`.toLowerCase();
    let p = 0;
    if (/natural|doğal|clear|net|calm|sakin|steady|conversational|sohbet|warm|sıcak|friendly|samimi|smooth|soft/.test(t)) p += 3;
    if (/conversational|customer|assistant|asistan|support/.test(t)) p += 2;
    if (/energetic|fast|hızlı|game|trailer|creaky|thick|kalın|powerful|storytell|hyped|dramatic|epic|news|haber|advert|reklam/.test(t)) p -= 3;
    return p;
  };
  for (const [cinsiyet, adet] of [['male', 5], ['female', 4]]) {
    try {
      const p = await el(anahtar, `/v1/shared-voices?language=tr&gender=${cinsiyet}&category=professional&page_size=60&sort=cloned_by_count`);
      const uygun = (p?.voices || [])
        .filter((x) => x.free_users_allowed !== false && !/asmr|whisper|fısıltı|narrat|audiobook|kitap|radio|radyo|old|yaşlı|child|çocuk|meditation|meditasyon/i.test(`${x.name} ${x.descriptive} ${x.use_case} ${x.description || ''}`))
        .map((x, k) => ({ x, p: puan(x) - k * 0.05 }))
        .sort((a, b) => b.p - a.p)
        .slice(0, adet);
      for (const { x: v } of uygun) {
        if (sesler.some((y) => y.id === v.voice_id)) continue;
        const tr = (v.verified_languages || []).find((l) => l.language === 'tr' && l.preview_url);
        sesler.push({ id: v.voice_id, sahip: v.public_owner_id, ad: v.name, cinsiyet: v.gender, aciklama: (v.description || v.descriptive || '').slice(0, 90), ornek: tr?.preview_url || v.preview_url, tur: 'turkce' });
      }
    } catch (e) { console.error('Kütüphane sesleri alınamadı:', e.message); }
  }
  if (sesler.length) sesler[0].onerilen = true;
  // 2) ElevenLabs'in kendi stüdyo sesleri (çok temiz; Türkçe örnek anında üretilir)
  try {
    const h = await el(anahtar, '/v2/voices?voice_type=default&page_size=100');
    for (const v of (h?.voices || []).filter((x) => HAZIR_TERCIH.test(x.name || '')).slice(0, 5)) {
      sesler.push({ id: v.voice_id, sahip: null, ad: v.name, cinsiyet: v.labels?.gender, aciklama: (v.labels?.descriptive || v.labels?.description || v.description || '').slice(0, 90), ornek: null, tur: 'hazir' });
    }
  } catch (e) { console.error('Hazır sesler alınamadı:', e.message); }
  return sesler;
}

async function sesSec(anahtar, { id, sahip, ad }) {
  let sesId = id;
  if (sahip) {
    // Kütüphaneye ekle (ücretsiz planda yer az: önce eski ALKA seslerini temizle)
    const benim = await el(anahtar, '/v1/voices?search=ALKA').catch(() => ({ voices: [] }));
    const ajan = onbellek?.ajanId ? await el(anahtar, `/v1/convai/agents/${onbellek.ajanId}`).catch(() => null) : null;
    const kullanilan = ajan?.conversation_config?.tts?.voice_id;
    for (const v of (benim?.voices || [])) {
      if (/^ALKA/.test(v.name || '') && v.voice_id !== kullanilan) await el(anahtar, `/v1/voices/${v.voice_id}`, { method: 'DELETE' }).catch(() => {});
    }
    const eklenen = await el(anahtar, `/v1/voices/add/${sahip}/${id}`, { method: 'POST', body: JSON.stringify({ new_name: `ALKA Ses - ${String(ad || 'Seçilen').slice(0, 30)}` }) });
    sesId = eklenen?.voice_id || id;
  }
  if (!onbellek) onbellek = await ajanHazirla(anahtar);
  const ayar = ajanAyari(sesId);
  const s = surum(ayar);
  await el(anahtar, `/v1/convai/agents/${onbellek.ajanId}`, { method: 'PATCH', body: JSON.stringify({ ...ayar, tags: [s, SES_SURUM, 'secim'] }) });
  onbellek = { ajanId: onbellek.ajanId, surum: s };
  return sesId;
}

async function govdeOku(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  const p = []; for await (const x of req) p.push(x);
  try { return JSON.parse(Buffer.concat(p).toString('utf8') || '{}'); } catch { return {}; }
}

export default async function handler(req, res) {
  const sorgu = new URL(req.url || '/', 'http://x').searchParams;
  const anahtarS = (process.env.ELEVENLABS_API_KEY || '').trim();
  if (anahtarS && sorgu.get('sesler')) {
    try {
      if (!onbellek) onbellek = await ajanHazirla(anahtarS);
      const a = await el(anahtarS, `/v1/convai/agents/${onbellek.ajanId}`);
      const secili = a?.conversation_config?.tts?.voice_id;
      let seciliAd = null;
      try { seciliAd = (await el(anahtarS, `/v1/voices/${secili}`))?.name; } catch { /* yok */ }
      return cevap(res, 200, { secili, seciliAd, sesler: await sesListesi(anahtarS) });
    } catch (e) { return cevap(res, 502, { hata: 'Ses listesi alınamadı: ' + e.message }); }
  }
  if (anahtarS && sorgu.get('ornek')) {
    // Hazır ses için Türkçe örnek cümle üret (mp3)
    try {
      const r = await fetch(`${API}/v1/text-to-speech/${encodeURIComponent(sorgu.get('ornek'))}?output_format=mp3_44100_64`, {
        method: 'POST', headers: { 'xi-api-key': anahtarS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: ORNEK_METIN, model_id: 'eleven_turbo_v2_5', voice_settings: { stability: 0.6, similarity_boost: 0.75 } }),
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) return cevap(res, 502, { hata: 'Örnek ses üretilemedi (' + r.status + ')' });
      res.statusCode = 200; res.setHeader('Content-Type', 'audio/mpeg'); res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.end(Buffer.from(await r.arrayBuffer()));
    } catch (e) { return cevap(res, 502, { hata: 'Örnek ses üretilemedi: ' + e.message }); }
  }
  if (anahtarS && sorgu.get('sec') && req.method === 'POST') {
    try {
      const b = await govdeOku(req);
      if (!b?.id) return cevap(res, 400, { hata: 'Ses seçilmedi.' });
      const sesId = await sesSec(anahtarS, b);
      return cevap(res, 200, { tamam: true, sesId });
    } catch (e) { return cevap(res, 502, { hata: 'Ses değiştirilemedi: ' + e.message }); }
  }
  return anaIslem(req, res);
}

async function anaIslem(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') return cevap(res, 405, { hata: 'Sadece POST' });
  const anahtar = (process.env.ELEVENLABS_API_KEY || '').trim();
  // Teşhis: /api/ses-asistan?durum=1 her zaman 200 döner ve sorunu açıkça yazar (link üretmez)
  if (req.query?.durum || /[?&]durum=/.test(req.url || '')) {
    const d = { anahtarVar: !!anahtar };
    if (anahtar) {
      try { const u = await el(anahtar, '/v1/user/subscription'); d.plan = u?.tier; d.karakter = `${u?.character_count}/${u?.character_limit}`; } catch (e) { d.abonelikHata = e.message; }
      try {
        const h = await ajanHazirla(anahtar); onbellek = h; d.ajan = h;
        const a = await el(anahtar, `/v1/convai/agents/${h.ajanId}`);
        d.ajanEtiket = a?.tags;
        const sesId = a?.conversation_config?.tts?.voice_id;
        d.dil = a?.conversation_config?.agent?.language; d.beyin = a?.conversation_config?.agent?.prompt?.llm;
        try { const v = await el(anahtar, `/v1/voices/${sesId}`); d.ses = { ad: v?.name, cinsiyet: v?.labels?.gender, aksan: v?.labels?.accent, dil: v?.labels?.language, kategori: v?.category, aciklama: (v?.description || '').slice(0, 160), kalite: v?.high_quality_base_model_ids, etiketler: (a?.tags || []).join(',') }; } catch { d.ses = { id: sesId }; }
      } catch (e) { d.ajanHata = e.message; }
    }
    return cevap(res, 200, d);
  }
  if (!anahtar) return cevap(res, 503, { hata: 'Sesli asistan anahtarı Vercel ayarlarında yok (ELEVENLABS_API_KEY).', kod: 'anahtar-yok' });
  try {
    const guncel = surum(ajanAyari('x'));
    if (!onbellek || onbellek.surum !== guncel) onbellek = await ajanHazirla(anahtar);
    let link;
    try {
      link = await el(anahtar, `/v1/convai/conversation/get-signed-url?agent_id=${onbellek.ajanId}`);
    } catch (e) {
      if (e.durum === 404) { onbellek = await ajanHazirla(anahtar); link = await el(anahtar, `/v1/convai/conversation/get-signed-url?agent_id=${onbellek.ajanId}`); }
      else throw e;
    }
    // WebRTC (yankı engelleme, daha temiz ve hızlı ses) için token; olmazsa tarayıcı signedUrl ile websocket'e düşer
    let token = null;
    try { token = (await el(anahtar, `/v1/convai/conversation/token?agent_id=${onbellek.ajanId}`))?.token || null; } catch (e) { console.error('WebRTC token alınamadı:', e.message); }
    return cevap(res, 200, { signedUrl: link.signed_url, token, ajanId: onbellek.ajanId });
  } catch (e) {
    console.error(e);
    const kota = /quota|limit|credit|exceed/i.test(e.message);
    return cevap(res, 502, {
      hata: kota ? 'Sesli asistanın bu ayki ücretsiz dakikaları bitmiş.' : 'Sesli asistan hazırlanamadı: ' + e.message,
      kod: kota ? 'kota' : 'hata',
    });
  }
}
