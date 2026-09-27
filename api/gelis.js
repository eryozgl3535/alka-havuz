const HAZIRLIK = [
  'Havuz hazırlama (temizlik + kimyasal ayar)',
  'Su vanalarını açma',
  'Hidrofor / basınç kontrolü',
  'Kuyu pompası kontrolü',
  'Bahçe sulamasını açma',
  'Isı pompasını çalıştırma',
  'Elektrik panosu kontrolü',
];

const KAPANIS = [
  'Su vanalarını kapatma',
  'Havuzu kapatma / koruma moduna alma',
  'Sulamayı kapatma / boşaltma',
  'Hidrofor ve pompaları kapatma',
  'Genel kontrol ve fotoğraflı rapor',
];

const HAZIRLIK_GUN = 2;

function cevap(res, kod, veri) {
  res.statusCode = kod;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(veri));
}

const bugunIstanbul = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });

function gunEkle(tarih, n) {
  const d = new Date(tarih + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const trTarih = (t) =>
  new Date(t + 'T00:00:00Z').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'short', timeZone: 'UTC' });

const tarihMi = (t) => typeof t === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t) && !isNaN(new Date(t + 'T00:00:00Z'));

async function govdeOku(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return await new Promise((coz) => {
    let veri = '';
    req.on('data', (p) => { veri += p; });
    req.on('end', () => { try { coz(veri ? JSON.parse(veri) : {}); } catch { coz({}); } });
    req.on('error', () => coz({}));
  });
}

export default async function handler(req, res) {
  try {
    const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
    const anahtar = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anahtar) return cevap(res, 500, { hata: 'Sunucu ayarları eksik.' });

    async function supa(yol, secenek = {}) {
      const yanit = await fetch(url + yol, {
        method: secenek.method || 'GET',
        headers: {
          apikey: anahtar,
          Authorization: `Bearer ${anahtar}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: secenek.body ? JSON.stringify(secenek.body) : undefined,
      });
      const metin = await yanit.text();
      let veri = null;
      try { veri = metin ? JSON.parse(metin) : null; } catch { veri = null; }
      if (!yanit.ok) throw new Error((veri && (veri.message || veri.hint)) || `Hata ${yanit.status}`);
      return veri;
    }

    const istek = new URL(req.url, 'http://yerel');
    const govde = req.method === 'POST' ? await govdeOku(req) : {};
    const token = String(req.method === 'POST' ? govde.t || '' : istek.searchParams.get('t') || '').trim();
    if (!/^[a-f0-9]{32}$/i.test(token)) return cevap(res, 400, { hata: 'Geçersiz bağlantı.' });

    const musteriler = await supa(`/rest/v1/customers?gelis_token=eq.${token}&select=id,name&limit=1`);
    const musteri = musteriler && musteriler[0];
    if (!musteri) return cevap(res, 404, { hata: 'Bağlantı bulunamadı.' });

    const bugun = bugunIstanbul();

    if (req.method === 'GET') {
      const mevcut = await supa(
        `/rest/v1/gelisler?customer_id=eq.${musteri.id}&durum=neq.iptal&gelis_tarihi=gte.${bugun}` +
        `&select=gelis_tarihi,ayrilis_tarihi,durum&order=gelis_tarihi.asc`
      );
      return cevap(res, 200, {
        ad: musteri.name,
        hazirlik: HAZIRLIK,
        kapanis: KAPANIS,
        mevcut: mevcut || [],
      });
    }

    if (req.method !== 'POST') return cevap(res, 405, { hata: 'Desteklenmeyen işlem.' });

    const gelis = govde.gelis_tarihi;
    const ayrilis = govde.ayrilis_tarihi || null;
    if (!tarihMi(gelis)) return cevap(res, 400, { hata: 'Geliş tarihini seçin.' });
    if (gelis < bugun) return cevap(res, 400, { hata: 'Geliş tarihi geçmişte olamaz.' });
    if (gelis > gunEkle(bugun, 365)) return cevap(res, 400, { hata: 'En fazla bir yıl sonrası için bildirim yapılabilir.' });
    if (ayrilis && (!tarihMi(ayrilis) || ayrilis < gelis)) return cevap(res, 400, { hata: 'Ayrılış tarihi gelişten önce olamaz.' });

    const istekler = (Array.isArray(govde.istekler) ? govde.istekler : []).filter((x) => HAZIRLIK.includes(x));
    const ayrilisIstekleri = ayrilis
      ? (Array.isArray(govde.ayrilis_istekleri) ? govde.ayrilis_istekleri : []).filter((x) => KAPANIS.includes(x))
      : [];
    if (!istekler.length) return cevap(res, 400, { hata: 'En az bir hazırlık işi seçin.' });
    const notlar = String(govde.notlar || '').trim().slice(0, 500);

    const dun = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const sonGunluk = await supa(
      `/rest/v1/gelisler?customer_id=eq.${musteri.id}&kaynak=eq.musteri&created_at=gte.${encodeURIComponent(dun)}&select=id`
    );
    if ((sonGunluk || []).length >= 5) {
      return cevap(res, 429, { hata: 'Çok sayıda bildirim yapıldı. Lütfen bizi telefonla arayın: 0533 371 39 35' });
    }

    const aciklama = (liste) =>
      liste.map((x) => `• ${x}`).join('\n') + (notlar ? `\n\nMüşteri notu: ${notlar}` : '') + '\n\n(Müşteri linkten bildirdi)';

    let hazirlikTarihi = gunEkle(gelis, -HAZIRLIK_GUN);
    if (hazirlikTarihi < bugun) hazirlikTarihi = bugun;

    const [hazirlikIs] = await supa('/rest/v1/work_orders', {
      method: 'POST',
      body: [{
        customer_id: musteri.id,
        title: `🏡 Geliş hazırlığı (${trTarih(gelis)})`,
        description: aciklama(istekler),
        scheduled_date: hazirlikTarihi,
        materials: [],
      }],
    });

    let kapanisId = null;
    if (ayrilis && ayrilisIstekleri.length) {
      const [kapanisIs] = await supa('/rest/v1/work_orders', {
        method: 'POST',
        body: [{
          customer_id: musteri.id,
          title: `🔒 Ayrılış sonrası kapatma (${trTarih(ayrilis)})`,
          description: aciklama(ayrilisIstekleri),
          scheduled_date: gunEkle(ayrilis, 1),
          materials: [],
        }],
      });
      kapanisId = kapanisIs.id;
    }

    await supa('/rest/v1/gelisler', {
      method: 'POST',
      body: [{
        customer_id: musteri.id,
        gelis_tarihi: gelis,
        ayrilis_tarihi: ayrilis,
        istekler,
        ayrilis_istekleri: ayrilisIstekleri,
        notlar,
        kaynak: 'musteri',
        hazirlik_is_id: hazirlikIs.id,
        kapanis_is_id: kapanisId,
      }],
    });

    return cevap(res, 200, { tamam: true, hazirlikTarihi });
  } catch (e) {
    return cevap(res, 500, { hata: 'Sunucu hatası: ' + (e.message || 'bilinmeyen') });
  }
}
