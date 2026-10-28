// Günlük hatırlatma bildirimi (telefon/bilgisayar bildirimi).
// GET  → Vercel Cron her gün 10:00 ve 21:00'de (İstanbul) çağırır: bugünkü + gecikmiş hatırlatmaları tüm abone cihazlara yollar.
// POST → { abonelik } ile sadece o cihaza deneme bildirimi yollar ("Bildirimleri aç" butonundan sonra).
// GET ?saatli=1 → saati gelmiş hatırlatmaları TEK TEK, alarm gibi bildirir (her hatırlatma bir kez).
//   Birkaç dakikada bir GitHub Actions zamanlayıcısı çağırır (.github/workflows/hatirlatma-saatli.yml).
// Abonelikler her kullanıcının Supabase user_metadata.push listesinde tutulur (ayrı tablo gerekmez).
import webpush from 'web-push';

// Genel anahtar (gizli değil). Gizli eşi Vercel'de VAPID_PRIVATE_KEY olarak durur.
const VAPID_PUBLIC = (process.env.VAPID_PUBLIC_KEY || 'BEXI4-QmOdqpCT1FOuz5fO8hHVeCVuwSc2-W72LIMvuFJfj5cUnpf3twR9c-ypXrieq5aeeA1AkRRKDWMjqCpbY').trim();

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

const bugunIstanbul = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
const saatIstanbul = () => Number(new Date().toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Europe/Istanbul' }));
const tl = (n) => Number(n).toLocaleString('tr-TR') + ' ₺';
const saatDakikaIstanbul = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Istanbul' });

// Tüm abone cihazlara yükü yollar; süresi dolan abonelikleri temizler
async function herkeseGonder(url, basliklar, yuk) {
  const ur = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=1000`, { headers: basliklar });
  const uv = ur.ok ? await ur.json() : {};
  const kullanicilar = Array.isArray(uv) ? uv : (uv.users || []);
  let gonderilen = 0;
  for (const k of kullanicilar) {
    const meta = k.user_metadata || {};
    const abonelikler = Array.isArray(meta.push) ? meta.push : [];
    if (!abonelikler.length) continue;
    const kalan = [];
    for (const a of abonelikler) {
      try { await webpush.sendNotification(a, yuk, { urgency: 'high', TTL: 3600 }); gonderilen++; kalan.push(a); }
      catch (e) { if (e.statusCode !== 404 && e.statusCode !== 410) kalan.push(a); }
    }
    if (kalan.length !== abonelikler.length) {
      await fetch(`${url}/auth/v1/admin/users/${k.id}`, { method: 'PUT', headers: basliklar, body: JSON.stringify({ user_metadata: { ...meta, push: kalan } }) }).catch(() => {});
    }
  }
  return gonderilen;
}

// Saati gelmiş hatırlatmalar: her biri ayrı, alarm gibi bildirim; bildirilince kayda işaret konur (tekrar gitmez)
async function saatliGonder(url, basliklar) {
  const hr = await fetch(`${url}/rest/v1/mesaj_kayitlari?tur=eq.hatirlatma&select=id,mesaj,customers(name)&limit=500`, { headers: basliklar });
  const kayitlar = hr.ok ? await hr.json() : [];
  const bugun = bugunIstanbul();
  const simdi = saatDakikaIstanbul();
  let gonderilen = 0, hatirlatma = 0;
  for (const k of kayitlar) {
    let v = {}; try { v = JSON.parse(k.mesaj || '{}'); } catch { continue; }
    if (!v.saat || v.tarih !== bugun || v.saat > simdi) continue;
    const anahtar = `${v.tarih} ${v.saat}`;
    if (v.bildirildi === anahtar) continue;
    // Önce işaretle (aynı anda iki çağrı gelirse çift bildirim olmasın)
    const isaret = await fetch(`${url}/rest/v1/mesaj_kayitlari?id=eq.${k.id}`, { method: 'PATCH', headers: basliklar, body: JSON.stringify({ mesaj: JSON.stringify({ ...v, bildirildi: anahtar }) }) });
    if (!isaret.ok) continue;
    hatirlatma++;
    const govde = [v.tutar != null ? tl(v.tutar) : '', k.customers?.name || '', v.aciklama || ''].filter(Boolean).join(' · ') || `Saat ${v.saat} hatırlatması`;
    gonderilen += await herkeseGonder(url, basliklar, JSON.stringify({ baslik: `⏰ ${v.baslik || 'Hatırlatma'}`, govde, url: '/?sayfa=hatirlatmalar', etiket: `alka-hat-${k.id}`, alarm: true }));
  }
  return { hatirlatma, gonderilen, saat: simdi };
}

export default async function handler(req, res) {
  try {
    const ozel = (process.env.VAPID_PRIVATE_KEY || '').trim();
    if (!ozel) return cevap(res, 500, { hata: 'VAPID_PRIVATE_KEY Vercel ayarlarında yok.' });
    webpush.setVapidDetails('mailto:bildirim@alka-tesisat.vercel.app', VAPID_PUBLIC, ozel);

    // Deneme bildirimi: sadece gönderilen cihaza
    if (req.method === 'POST') {
      const { abonelik, gecikme } = await govdeOku(req);
      if (!abonelik?.endpoint) return cevap(res, 400, { hata: 'Abonelik yok.' });
      if (gecikme) await new Promise((r) => setTimeout(r, 8000)); // telefonu kilitleyip görebilsin
      await webpush.sendNotification(abonelik, JSON.stringify({
        baslik: '⏰ ALKA deneme hatırlatması',
        govde: 'Bildirimler çalışıyor. Hatırlatmaların saati gelince böyle gelecek.',
        url: '/', etiket: 'alka-deneme', alarm: true,
      }), { urgency: 'high', TTL: 3600 });
      return cevap(res, 200, { tamam: true });
    }

    const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
    const anahtar = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anahtar) return cevap(res, 500, { hata: 'Sunucu ayarları eksik.' });
    const basliklar = { apikey: anahtar, Authorization: `Bearer ${anahtar}`, 'Content-Type': 'application/json' };

    // Saatli hatırlatmalar: sadece saati gelmiş ve henüz bildirilmemiş olanları yollar (tekrar çağrılması zararsız)
    if (new URL(req.url || '/', 'http://x').searchParams.get('teshis')) {
      // Teşhis: son hatırlatmaların saati ve bildirilip bildirilmediği + abone cihaz sayısı (başlık yok)
      const hr = await fetch(`${url}/rest/v1/mesaj_kayitlari?tur=like.hatirlatma*&select=id,tur,mesaj,created_at&order=created_at.desc&limit=8`, { headers: basliklar });
      const kayit = hr.ok ? await hr.json() : [];
      const ur = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=1000`, { headers: basliklar });
      const uv = ur.ok ? await ur.json() : {};
      const ku = Array.isArray(uv) ? uv : (uv.users || []);
      return cevap(res, 200, {
        simdi: `${bugunIstanbul()} ${saatDakikaIstanbul()}`,
        aboneler: ku.map((k) => ({ cihaz: (k.user_metadata?.push || []).map((a) => String(a.endpoint || '').split('/')[2]) })).filter((x) => x.cihaz.length),
        hatirlatmalar: kayit.map((k) => { let v = {}; try { v = JSON.parse(k.mesaj || '{}'); } catch { /* yok */ } return { tur: k.tur, olusturma: k.created_at, tarih: v.tarih, saat: v.saat, tamam: v.tamamlandi || v.durum, bildirildi: v.bildirildi || null, tekrar: v.tekrar }; }),
      });
    }
    if (new URL(req.url || '/', 'http://x').searchParams.get('saatli')) {
      return cevap(res, 200, await saatliGonder(url, basliklar));
    }

    // Günlük özet (Vercel Cron): CRON_SECRET tanımlıysa doğrula
    const gizli = process.env.CRON_SECRET;
    if (gizli && req.headers.authorization !== `Bearer ${gizli}`) return cevap(res, 401, { hata: 'Yetkisiz' });

    // 1) Açık hatırlatmalar
    const hr = await fetch(`${url}/rest/v1/mesaj_kayitlari?tur=eq.hatirlatma&select=id,mesaj,customers(name)&limit=500`, { headers: basliklar });
    const kayitlar = hr.ok ? await hr.json() : [];
    const bugun = bugunIstanbul();
    const liste = kayitlar.map((k) => { let v = {}; try { v = JSON.parse(k.mesaj || '{}'); } catch { v = {}; } return v; })
      .filter((v) => v.tarih && v.tarih <= bugun);
    const bugunku = liste.filter((v) => v.tarih === bugun);
    const geciken = liste.filter((v) => v.tarih < bugun);
    if (!bugunku.length && !geciken.length) return cevap(res, 200, { gonderilen: 0, neden: 'Bugün hatırlatma yok' });

    const satir = (v) => `• ${v.baslik || 'Hatırlatma'}${v.saat ? ' (' + v.saat + ')' : ''}${v.tutar != null ? ' — ' + tl(v.tutar) : ''}`;
    const parcalar = [];
    if (bugunku.length) parcalar.push('Bugün:', ...bugunku.slice(0, 4).map(satir));
    if (bugunku.length > 4) parcalar.push(`+${bugunku.length - 4} tane daha`);
    if (geciken.length) {
      parcalar.push('Tarihi geçmiş, hâlâ açık:', ...geciken.slice(0, 3).map(satir));
      if (geciken.length > 3) parcalar.push(`+${geciken.length - 3} tane daha`);
      parcalar.push('Yapıldıysa açıp "Tamamlandı" işaretle, bir daha hatırlatmam.');
    }
    const sabah = saatIstanbul() < 15;
    const baslik = `📋 ${sabah ? 'Sabah' : 'Akşam'} hatırlatma özeti · ` + [bugunku.length ? `bugün ${bugunku.length}` : '', geciken.length ? `${geciken.length} gecikmiş` : ''].filter(Boolean).join(', ');
    const yuk = JSON.stringify({ baslik, govde: parcalar.join('\n'), url: '/?sayfa=hatirlatmalar' });

    // 2) Abone cihazlar
    const gonderilen = await herkeseGonder(url, basliklar, yuk);
    return cevap(res, 200, { gonderilen, bugun: bugunku.length, geciken: geciken.length });
  } catch (e) {
    return cevap(res, 500, { hata: e?.message || 'Sunucu hatası' });
  }
}
