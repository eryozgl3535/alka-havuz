// Asistan sunucusu: Claude Haiku 5.5. Son güncelleme: 15 Ekim 2026
// Tarayıcı Claude'a doğrudan değil bu sunucu üzerinden bağlanır (anahtar tarayıcıya gitmez).
// Tarayıcı tarafı sohbeti kendi biçiminde (role/parts) yollar; Claude'a çeviri burada yapılır.
export const config = { maxDuration: 60 };

const TOPLAM_SURE = 52000;   // Vercel 60 sn'de keser; ondan önce kendimiz bitirelim

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

// ------------------------------------------------------------ Claude
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-5-5';

// Araç şeması (type: 'OBJECT', 'STRING'...) → JSON Schema (küçük harf)
function semaCevir(x) {
  if (Array.isArray(x)) return x.map(semaCevir);
  if (!x || typeof x !== 'object') return x;
  const o = {};
  for (const [k, v] of Object.entries(x)) o[k] = k === 'type' && typeof v === 'string' ? v.toLowerCase() : semaCevir(v);
  return o;
}

// Tarayıcının sohbet biçimi → Claude mesajları. Araç çağrılarına kimlik verilir, ardışık aynı roller birleştirilir.
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

// Başarılıysa cevabı yollar ve true döner; olmazsa sebebi döner ('kredi' | 'anahtar' | false).
async function claudeIle(res, anahtar, { sistem, contents, tools, akis }, baslangic) {
  const aracli = Array.isArray(tools) && tools.length > 0;
  const araclar = aracli ? tools.map((t) => ({
    name: t.name, description: t.description || '',
    input_schema: t.parameters ? semaCevir(t.parameters) : { type: 'object', properties: {} },
  })) : undefined;
  // Sabit kısımlar (talimat + müşteri listesi + araçlar) önbelleğe alınır: her soruda tekrar ödenmez, daha hızlı okunur
  if (araclar?.length) araclar[araclar.length - 1].cache_control = { type: 'ephemeral' };
  const govde = {
    model: CLAUDE_MODEL,
    max_tokens: 500,       // cevaplar kısa olmalı; araç çağrıları için de yeterli
    thinking: { type: 'disabled' },  // günlük işler için uzun düşünmeye gerek yok: en hızlı cevap
    system: sistem ? [{ type: 'text', text: String(sistem), cache_control: { type: 'ephemeral' } }] : undefined,
    messages: mesajCevir(contents),
    ...(araclar ? { tools: araclar } : {}),
  };
  if (!govde.messages.length) { cevap(res, 400, { hata: 'Mesaj yok.' }); return true; }
  if (akis && await claudeAkis(res, anahtar, govde, baslangic)) return true;

  let son = '';
  for (let deneme = 0; deneme < 2; deneme++) {
    const kalan = TOPLAM_SURE - (Date.now() - baslangic);
    if (kalan < 5000) break;
    if (deneme) await new Promise((r) => setTimeout(r, 600));
    try {
      // Tek deneme en fazla 20 sn; takılırsa ikinci deneme için zaman kalsın
      const { r, veri } = await claudeCagir(anahtar, govde, Math.min(deneme ? 25000 : 20000, kalan));
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
      if (r.status === 401 || r.status === 403) { console.error(son); return 'anahtar'; }   // anahtar sorunu
      if (r.status === 402 || /credit|balance|billing/i.test(son)) { console.error(son); return 'kredi'; } // kredi bitti
      // 429 / 500 / 529 (yoğunluk): kısa bekleyip bir kez daha dene
    } catch (e) {
      son = e?.name === 'TimeoutError' ? 'Claude zaman aşımı' : (e?.message || 'Claude hatası');
    }
  }
  console.error(son);
  return false;
}

// ------------------------------------------------------------ akışlı cevap
// Claude yazdıkça parça parça gönderir (satır başına bir JSON): {"d":"metin parçası"} ... sonunda {"son":{...}}
// Böylece tarayıcı ilk cümle gelir gelmez seslendirmeye başlar. Akış açılamazsa false döner (normal yola düşülür).
async function claudeAkis(res, anahtar, govde, baslangic) {
  let r;
  try {
    r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': anahtar, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ ...govde, stream: true }),
      signal: AbortSignal.timeout(30000),
    });
  } catch { return false; }
  if (!r.ok || !r.body) return false;
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Accel-Buffering', 'no');
  const bloklar = [];   // { type, text } | { type:'tool_use', id, name, json }
  let bitis = null, tampon = '';
  const coz = new TextDecoder();
  try {
    for await (const parca of r.body) {
      tampon += coz.decode(parca, { stream: true });
      let i;
      while ((i = tampon.indexOf('\n\n')) >= 0) {
        const olay = tampon.slice(0, i); tampon = tampon.slice(i + 2);
        const veriSatir = olay.split('\n').find((x) => x.startsWith('data:'));
        if (!veriSatir) continue;
        let v; try { v = JSON.parse(veriSatir.slice(5)); } catch { continue; }
        if (v.type === 'content_block_start') {
          const b = v.content_block || {};
          bloklar[v.index] = b.type === 'tool_use' ? { type: 'tool_use', id: b.id, name: b.name, json: '' } : { type: 'text', text: '' };
        } else if (v.type === 'content_block_delta') {
          const b = bloklar[v.index]; if (!b) continue;
          if (v.delta?.type === 'text_delta') { b.text += v.delta.text; res.write(JSON.stringify({ d: v.delta.text }) + '\n'); }
          else if (v.delta?.type === 'input_json_delta') b.json += v.delta.partial_json || '';
        } else if (v.type === 'message_delta') {
          bitis = v.delta?.stop_reason || bitis;
        } else if (v.type === 'error') {
          res.write(JSON.stringify({ hata: v.error?.message || 'Claude hatası' }) + '\n');
          return res.end(), true;
        }
      }
    }
  } catch (e) {
    res.write(JSON.stringify({ hata: e?.message || 'Bağlantı koptu' }) + '\n');
    return res.end(), true;
  }
  const parts = [];
  for (const b of bloklar.filter(Boolean)) {
    if (b.type === 'text' && b.text) parts.push({ text: b.text });
    else if (b.type === 'tool_use') { let args = {}; try { args = b.json ? JSON.parse(b.json) : {}; } catch { /* boş */ } parts.push({ functionCall: { id: b.id, name: b.name, args } }); }
  }
  const metin = bloklar.filter((b) => b?.type === 'text').map((b) => b.text).join('');
  res.write(JSON.stringify({ son: { metin, icerik: { role: 'model', parts }, bitis, model: CLAUDE_MODEL, sure: Date.now() - baslangic } }) + '\n');
  res.end();
  return true;
}

// ------------------------------------------------------------ giriş
export default async function handler(req, res) {
  if (req.method !== 'POST') return cevap(res, 405, { hata: 'Sadece POST' });
  const baslangic = Date.now();
  const anahtar = (process.env.ANTHROPIC_API_KEY || '').trim();
  if (!anahtar) return cevap(res, 500, { hata: 'Claude anahtarı Vercel ayarlarında yok (ANTHROPIC_API_KEY).' });
  const govdeVeri = await govdeOku(req);
  if (!Array.isArray(govdeVeri.contents) || !govdeVeri.contents.length) return cevap(res, 400, { hata: 'Mesaj yok.' });

  const sonuc = await claudeIle(res, anahtar, govdeVeri, baslangic);
  if (sonuc === true) return;
  const hata = sonuc === 'kredi' ? 'Claude kredisi bitmiş. platform.claude.com üzerinden kredi yükle.'
    : sonuc === 'anahtar' ? 'Claude anahtarı geçersiz. Vercel\'deki ANTHROPIC_API_KEY değerini kontrol et.'
    : 'Yapay zekâ şu an cevap veremedi. Birkaç saniye sonra tekrar dene.';
  return cevap(res, 503, { hata, kod: sonuc === 'kredi' || sonuc === 'anahtar' ? 'ayar' : 'zaman' });
}
