// Günlük hatırlatma bildirimi (telefon/bilgisayar bildirimi).
// GET  → Vercel Cron her gün 10:00 ve 21:00'de (İstanbul) çağırır: bugünkü + gecikmiş hatırlatmaları tüm abone cihazlara yollar.
// POST → { abonelik } ile sadece o cihaza deneme bildirimi yollar ("Bildirimleri aç" butonundan sonra).
// Abonelikler her kullanıcının Supabase user_metadata.push listesinde tutulur (ayrı tablo gerekmez).
import webpush from 'web-push';

const VAPID_PUBLIC = 'BJUQaPBgiZZBfiwUVprGm_uZvvPJyL1O8LRkSB7SA9-5ZteuaLGbskvnKIZ4cGfyd7oZq4Ye7Ge_edz6pfKfT6I';

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

export default async function handler(req, res) {
  try {
    const ozel = (process.env.VAPID_PRIVATE_KEY || '').trim();
    if (!ozel) return cevap(res, 500, { hata: 'VAPID_PRIVATE_KEY Vercel ayarlarında yok.' });
    webpush.setVapidDetails('mailto:bildirim@alka-tesisat.vercel.app', VAPID_PUBLIC, ozel);

    // Deneme bildirimi: sadece gönderilen cihaza
    if (req.method === 'POST') {
      const { abonelik } = await govdeOku(req);
      if (!abonelik?.endpoint) return cevap(res, 400, { hata: 'Abonelik yok.' });
      await webpush.sendNotification(abonelik, JSON.stringify({
        baslik: 'ALKA bildirimleri açık ✅',
        govde: 'Her gün 10:00 ve 21:00\'de o günün hatırlatmalarını buraya göndereceğim.',
        url: '/',
      }));
      return cevap(res, 200, { tamam: true });
    }

    // Cron çağrısı: CRON_SECRET tanımlıysa doğrula
    const gizli = process.env.CRON_SECRET;
    if (gizli && req.headers.authorization !== `Bearer ${gizli}`) return cevap(res, 401, { hata: 'Yetkisiz' });

    const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
    const anahtar = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anahtar) return cevap(res, 500, { hata: 'Sunucu ayarları eksik.' });
    const basliklar = { apikey: anahtar, Authorization: `Bearer ${anahtar}`, 'Content-Type': 'application/json' };

    // 1) Açık hatırlatmalar
    const hr = await fetch(`${url}/rest/v1/mesaj_kayitlari?tur=eq.hatirlatma&select=id,mesaj,customers(name)&limit=500`, { headers: basliklar });
    const kayitlar = hr.ok ? await hr.json() : [];
    const bugun = bugunIstanbul();
    const liste = kayitlar.map((k) => { let v = {}; try { v = JSON.parse(k.mesaj || '{}'); } catch { v = {}; } return v; })
      .filter((v) => v.tarih && v.tarih <= bugun);
    const bugunku = liste.filter((v) => v.tarih === bugun);
    const geciken = liste.filter((v) => v.tarih < bugun);
    if (!bugunku.length && !geciken.length) return cevap(res, 200, { gonderilen: 0, neden: 'Bugün hatırlatma yok' });

    const satir = (v) => `• ${v.baslik || 'Hatırlatma'}${v.tutar != null ? ' — ' + tl(v.tutar) : ''}`;
    const parcalar = [];
    if (bugunku.length) parcalar.push(...bugunku.slice(0, 5).map(satir));
    if (bugunku.length > 5) parcalar.push(`+${bugunku.length - 5} tane daha`);
    if (geciken.length) parcalar.push(`⚠️ ${geciken.length} gecikmiş hatırlatma var`);
    const sabah = saatIstanbul() < 15;
    const baslik = bugunku.length
      ? `${sabah ? 'Günaydın' : 'Akşam hatırlatması'} · Bugün ${bugunku.length} hatırlatma`
      : `${geciken.length} gecikmiş hatırlatma`;
    const yuk = JSON.stringify({ baslik, govde: parcalar.join('\n'), url: '/' });

    // 2) Abone cihazlar (kullanıcıların user_metadata.push listesi)
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
        try {
          await webpush.sendNotification(a, yuk);
          gonderilen++;
          kalan.push(a);
        } catch (e) {
          if (e.statusCode !== 404 && e.statusCode !== 410) kalan.push(a); // süresi dolmuşları at
        }
      }
      if (kalan.length !== abonelikler.length) {
        await fetch(`${url}/auth/v1/admin/users/${k.id}`, {
          method: 'PUT', headers: basliklar, body: JSON.stringify({ user_metadata: { ...meta, push: kalan } }),
        }).catch(() => {});
      }
    }
    return cevap(res, 200, { gonderilen, bugun: bugunku.length, geciken: geciken.length });
  } catch (e) {
    return cevap(res, 500, { hata: e?.message || 'Sunucu hatası' });
  }
}
