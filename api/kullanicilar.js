const YETKILI = ['Patron', 'Sistem Yöneticisi'];
const ROLLER = ['Patron', 'Sistem Yöneticisi', 'Çalışan'];
const ALAN = '@alka.app';

function cevap(res, kod, veri) {
  res.statusCode = kod;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(veri));
}

async function govdeOku(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return await new Promise((coz) => {
    let veri = '';
    req.on('data', (p) => { veri += p; });
    req.on('end', () => {
      try { coz(veri ? JSON.parse(veri) : {}); } catch { coz({}); }
    });
    req.on('error', () => coz({}));
  });
}

export default async function handler(req, res) {
  try {
    const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
    const anahtar = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anahtar) return cevap(res, 500, { hata: 'Sunucu ayarları eksik (SUPABASE_SERVICE_ROLE_KEY bulunamadı).' });

    async function supa(yol, secenek = {}, kullaniciToken) {
      const yanit = await fetch(url + yol, {
        method: secenek.method || 'GET',
        headers: {
          apikey: anahtar,
          Authorization: `Bearer ${kullaniciToken || anahtar}`,
          'Content-Type': 'application/json',
        },
        body: secenek.body ? JSON.stringify(secenek.body) : undefined,
      });
      let veri = {};
      try { veri = await yanit.json(); } catch { veri = {}; }
      if (!yanit.ok) {
        const mesaj = veri.msg || veri.message || veri.error_description || veri.error || `Hata ${yanit.status}`;
        const h = new Error(mesaj);
        h.kod = yanit.status;
        throw h;
      }
      return veri;
    }

    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return cevap(res, 401, { hata: 'Giriş gerekli.' });

    let ben;
    try {
      ben = await supa('/auth/v1/user', {}, token);
    } catch {
      return cevap(res, 401, { hata: 'Oturum geçersiz, çıkış yapıp tekrar giriş yapın.' });
    }
    if (!YETKILI.includes(ben.user_metadata?.rol)) {
      return cevap(res, 403, { hata: 'Bu işlem için yetkiniz yok.' });
    }

    async function tumKullanicilar() {
      const veri = await supa('/auth/v1/admin/users?page=1&per_page=500');
      return (veri.users || []).filter((u) => (u.email || '').endsWith(ALAN));
    }

    const govde = req.method === 'GET' ? {} : await govdeOku(req);

    if (req.method === 'GET') {
      const liste = (await tumKullanicilar())
        .map((u) => ({
          id: u.id,
          kullanici: u.email.split('@')[0],
          ad: u.user_metadata?.ad || '',
          rol: u.user_metadata?.rol || 'Çalışan',
          sonGiris: u.last_sign_in_at,
          olusturma: u.created_at,
        }))
        .sort((a, b) => (a.ad || a.kullanici).localeCompare(b.ad || b.kullanici, 'tr'));
      return cevap(res, 200, { kullanicilar: liste, benimId: ben.id });
    }

    if (req.method === 'POST') {
      const kullanici = String(govde.kullanici || '').trim().toLowerCase();
      const sifre = String(govde.sifre || '');
      const ad = String(govde.ad || '').trim();
      const rol = String(govde.rol || 'Çalışan');

      if (!/^[a-z0-9._-]{2,30}$/.test(kullanici)) {
        return cevap(res, 400, { hata: 'Kullanıcı adı en az 2 karakter olmalı; sadece küçük harf, rakam, nokta ve tire kullanın (ç, ş, ğ, ı, ö, ü olmadan).' });
      }
      if (sifre.length < 6) return cevap(res, 400, { hata: 'Şifre en az 6 karakter olmalı.' });
      if (!ad) return cevap(res, 400, { hata: 'Ad soyad gerekli.' });
      if (!ROLLER.includes(rol)) return cevap(res, 400, { hata: 'Geçersiz unvan.' });

      try {
        await supa('/auth/v1/admin/users', {
          method: 'POST',
          body: { email: kullanici + ALAN, password: sifre, email_confirm: true, user_metadata: { ad, rol } },
        });
      } catch (e) {
        const mesaj = /already|registered|exists/i.test(e.message) ? 'Bu kullanıcı adı zaten kullanılıyor.' : e.message;
        return cevap(res, 400, { hata: mesaj });
      }
      return cevap(res, 200, { tamam: true });
    }

    if (req.method === 'PATCH') {
      const id = String(govde.id || '');
      if (!id) return cevap(res, 400, { hata: 'Kullanıcı seçilmedi.' });

      const guncelle = {};
      if (govde.sifre !== undefined) {
        const sifre = String(govde.sifre);
        if (sifre.length < 6) return cevap(res, 400, { hata: 'Şifre en az 6 karakter olmalı.' });
        guncelle.password = sifre;
      }
      if (govde.rol !== undefined || govde.ad !== undefined) {
        const mevcut = await supa(`/auth/v1/admin/users/${id}`);
        const meta = { ...(mevcut.user_metadata || {}) };
        if (govde.ad !== undefined) meta.ad = String(govde.ad).trim();
        if (govde.rol !== undefined) {
          if (!ROLLER.includes(govde.rol)) return cevap(res, 400, { hata: 'Geçersiz unvan.' });
          if (id === ben.id && !YETKILI.includes(govde.rol)) {
            return cevap(res, 400, { hata: 'Kendi yönetici yetkinizi kaldıramazsınız.' });
          }
          meta.rol = govde.rol;
        }
        guncelle.user_metadata = meta;
      }
      if (!Object.keys(guncelle).length) return cevap(res, 400, { hata: 'Değişiklik yok.' });

      await supa(`/auth/v1/admin/users/${id}`, { method: 'PUT', body: guncelle });
      return cevap(res, 200, { tamam: true });
    }

    if (req.method === 'DELETE') {
      const id = String(govde.id || '');
      if (!id) return cevap(res, 400, { hata: 'Kullanıcı seçilmedi.' });
      if (id === ben.id) return cevap(res, 400, { hata: 'Kendi hesabınızı silemezsiniz.' });

      const hepsi = await tumKullanicilar();
      const hedef = hepsi.find((u) => u.id === id);
      if (!hedef) return cevap(res, 404, { hata: 'Kullanıcı bulunamadı.' });
      const yetkiliSayisi = hepsi.filter((u) => YETKILI.includes(u.user_metadata?.rol)).length;
      if (YETKILI.includes(hedef.user_metadata?.rol) && yetkiliSayisi <= 1) {
        return cevap(res, 400, { hata: 'Sistemde en az bir yönetici kalmalı.' });
      }

      await supa(`/auth/v1/admin/users/${id}`, { method: 'DELETE' });
      return cevap(res, 200, { tamam: true });
    }

    return cevap(res, 405, { hata: 'Desteklenmeyen işlem.' });
  } catch (e) {
    return cevap(res, 500, { hata: 'Sunucu hatası: ' + (e.message || 'bilinmeyen') });
  }
}
