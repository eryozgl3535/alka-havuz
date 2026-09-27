import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

const YETKILI = ['Patron', 'Sistem Yöneticisi'];
const ROLLER = ['Patron', 'Sistem Yöneticisi', 'Çalışan'];

function turkceTemizle(metin) {
  const harita = { ç: 'c', ş: 's', ğ: 'g', ı: 'i', ö: 'o', ü: 'u', İ: 'i', Ç: 'c', Ş: 's', Ğ: 'g', Ö: 'o', Ü: 'u' };
  return metin
    .split('')
    .map((h) => harita[h] ?? h)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '');
}

async function apiCagir(metod, govde) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const yanit = await fetch('/api/kullanicilar', {
    method: metod,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: govde ? JSON.stringify(govde) : undefined,
  });
  let sonuc = {};
  try { sonuc = await yanit.json(); } catch { sonuc = {}; }
  if (!yanit.ok) throw new Error(sonuc.hata || 'İşlem başarısız.');
  return sonuc;
}

const trTarihSaat = (t) =>
  t ? new Date(t).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Hiç giriş yapmadı';

function KullaniciYonetimi() {
  const [liste, setListe] = useState([]);
  const [benimId, setBenimId] = useState('');
  const [yukleniyor, setYukleniyor] = useState(true);
  const [mesaj, setMesaj] = useState(null);
  const [formAcik, setFormAcik] = useState(false);
  const [yeni, setYeni] = useState({ ad: '', kullanici: '', sifre: '', rol: 'Çalışan' });
  const [kaydediliyor, setKaydediliyor] = useState(false);

  async function yukle() {
    setYukleniyor(true);
    try {
      const s = await apiCagir('GET');
      setListe(s.kullanicilar || []);
      setBenimId(s.benimId || '');
    } catch (e) {
      setMesaj({ tur: 'hata', yazi: e.message });
    }
    setYukleniyor(false);
  }

  useEffect(() => { yukle(); }, []);

  async function ekle(e) {
    e.preventDefault();
    setMesaj(null);
    if (!yeni.ad.trim() || !yeni.kullanici || yeni.sifre.length < 6) {
      setMesaj({ tur: 'hata', yazi: 'Ad soyad, kullanıcı adı ve en az 6 karakterli şifre gerekli.' });
      return;
    }
    setKaydediliyor(true);
    try {
      await apiCagir('POST', yeni);
      setMesaj({ tur: 'ok', yazi: `${yeni.ad} eklendi. Giriş bilgisi: kullanıcı adı "${yeni.kullanici}".` });
      setYeni({ ad: '', kullanici: '', sifre: '', rol: 'Çalışan' });
      setFormAcik(false);
      yukle();
    } catch (err) {
      setMesaj({ tur: 'hata', yazi: err.message });
    }
    setKaydediliyor(false);
  }

  async function sifreSifirla(k) {
    const sifre = window.prompt(`${k.ad || k.kullanici} için yeni şifre (en az 6 karakter):`);
    if (sifre === null) return;
    if (sifre.length < 6) {
      setMesaj({ tur: 'hata', yazi: 'Şifre en az 6 karakter olmalı.' });
      return;
    }
    try {
      await apiCagir('PATCH', { id: k.id, sifre });
      setMesaj({ tur: 'ok', yazi: `${k.ad || k.kullanici} kullanıcısının şifresi değiştirildi.` });
    } catch (err) {
      setMesaj({ tur: 'hata', yazi: err.message });
    }
  }

  async function rolDegistir(k, rol) {
    if (rol === k.rol) return;
    if (!window.confirm(`${k.ad || k.kullanici} kullanıcısının unvanı "${rol}" olarak değiştirilsin mi?`)) return;
    try {
      await apiCagir('PATCH', { id: k.id, rol });
      setMesaj({ tur: 'ok', yazi: 'Unvan güncellendi. Değişiklik, kullanıcının bir sonraki girişinde görünür.' });
      yukle();
    } catch (err) {
      setMesaj({ tur: 'hata', yazi: err.message });
    }
  }

  async function sil(k) {
    if (!window.confirm(`${k.ad || k.kullanici} sistemden çıkarılsın mı? Bu kişi artık giriş yapamaz.`)) return;
    try {
      await apiCagir('DELETE', { id: k.id });
      setMesaj({ tur: 'ok', yazi: `${k.ad || k.kullanici} sistemden çıkarıldı.` });
      yukle();
    } catch (err) {
      setMesaj({ tur: 'hata', yazi: err.message });
    }
  }

  return (
    <div style={s.kart}>
      <div style={s.bolumUst}>
        <h2 style={{ ...s.bolum, margin: 0 }}>👥 Kullanıcı Yönetimi</h2>
        <button style={s.kucukAnaBtn} onClick={() => setFormAcik(!formAcik)}>
          {formAcik ? 'Kapat' : '+ Kullanıcı Ekle'}
        </button>
      </div>

      {mesaj && (
        <div style={{ ...s.mesaj, ...(mesaj.tur === 'ok' ? s.mesajOk : s.mesajHata) }}>
          {mesaj.tur === 'ok' ? '✓ ' : ''}{mesaj.yazi}
        </div>
      )}

      {formAcik && (
        <form onSubmit={ekle} style={s.ekleForm}>
          <div style={s.grid}>
            <label style={s.etiket}>Ad Soyad
              <input style={s.input} placeholder="Örn: Ahmet Kaya" value={yeni.ad}
                onChange={(e) => setYeni({ ...yeni, ad: e.target.value })} />
            </label>
            <label style={s.etiket}>Kullanıcı adı (girişte yazılacak)
              <input style={s.input} placeholder="Örn: ahmet" value={yeni.kullanici} autoCapitalize="none"
                onChange={(e) => setYeni({ ...yeni, kullanici: turkceTemizle(e.target.value) })} />
            </label>
            <label style={s.etiket}>Şifre (en az 6 karakter)
              <input style={s.input} type="text" value={yeni.sifre}
                onChange={(e) => setYeni({ ...yeni, sifre: e.target.value })} />
            </label>
            <label style={s.etiket}>Unvan
              <select style={s.input} value={yeni.rol} onChange={(e) => setYeni({ ...yeni, rol: e.target.value })}>
                {ROLLER.map((r) => <option key={r}>{r}</option>)}
              </select>
            </label>
          </div>
          <button type="submit" disabled={kaydediliyor} style={{ ...s.anaBtn, opacity: kaydediliyor ? 0.6 : 1 }}>
            {kaydediliyor ? 'Ekleniyor...' : 'Kullanıcıyı Ekle'}
          </button>
        </form>
      )}

      {yukleniyor ? (
        <p style={s.bos}>Yükleniyor...</p>
      ) : (
        liste.map((k) => {
          const benMi = k.id === benimId;
          return (
            <div key={k.id} style={s.kSatir}>
              <div style={{ ...s.kAvatar, background: k.rol === 'Patron' ? '#b45309' : k.rol === 'Çalışan' ? '#64748b' : '#1d6fe0' }}>
                {(k.ad || k.kullanici).charAt(0).toLocaleUpperCase('tr-TR')}
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={s.kAd}>
                  {k.ad || k.kullanici} {benMi && <span style={s.senRozet}>Sen</span>}
                </div>
                <div style={s.kucuk}>Kullanıcı adı: <b>{k.kullanici}</b></div>
                <div style={s.kucuk}>Son giriş: {trTarihSaat(k.sonGiris)}</div>
              </div>
              <select style={s.rolSec} value={k.rol} onChange={(e) => rolDegistir(k, e.target.value)}>
                {ROLLER.map((r) => <option key={r}>{r}</option>)}
              </select>
              <button style={s.ikincilBtn} onClick={() => sifreSifirla(k)}>🔑 Şifre</button>
              {!benMi && <button style={s.silBtn} onClick={() => sil(k)}>Çıkar</button>}
            </div>
          );
        })
      )}
    </div>
  );
}

export default function SettingsPage({ session }) {
  const meta = session?.user?.user_metadata || {};
  const email = session?.user?.email || '';
  const kullaniciAdi = email.split('@')[0];
  const yetkili = YETKILI.includes(meta.rol);

  const [ad, setAd] = useState(meta.ad || '');
  const [profilMesaj, setProfilMesaj] = useState(null);
  const [profilKaydediliyor, setProfilKaydediliyor] = useState(false);

  const [eskiSifre, setEskiSifre] = useState('');
  const [yeniSifre, setYeniSifre] = useState('');
  const [yeniSifre2, setYeniSifre2] = useState('');
  const [sifreGoster, setSifreGoster] = useState(false);
  const [sifreMesaj, setSifreMesaj] = useState(null);
  const [sifreKaydediliyor, setSifreKaydediliyor] = useState(false);

  async function profilKaydet(e) {
    e.preventDefault();
    setProfilMesaj(null);
    if (!ad.trim()) {
      setProfilMesaj({ tur: 'hata', yazi: 'Ad soyad boş olamaz.' });
      return;
    }
    setProfilKaydediliyor(true);
    const { error } = await supabase.auth.updateUser({ data: { ad: ad.trim() } });
    setProfilKaydediliyor(false);
    if (error) setProfilMesaj({ tur: 'hata', yazi: error.message });
    else setProfilMesaj({ tur: 'ok', yazi: 'Profil güncellendi.' });
  }

  async function sifreDegistir(e) {
    e.preventDefault();
    setSifreMesaj(null);
    if (!eskiSifre || !yeniSifre || !yeniSifre2) {
      setSifreMesaj({ tur: 'hata', yazi: 'Tüm alanları doldurun.' });
      return;
    }
    if (yeniSifre.length < 6) {
      setSifreMesaj({ tur: 'hata', yazi: 'Yeni şifre en az 6 karakter olmalı.' });
      return;
    }
    if (yeniSifre !== yeniSifre2) {
      setSifreMesaj({ tur: 'hata', yazi: 'Yeni şifreler birbiriyle aynı değil.' });
      return;
    }
    if (yeniSifre === eskiSifre) {
      setSifreMesaj({ tur: 'hata', yazi: 'Yeni şifre eskisiyle aynı olamaz.' });
      return;
    }
    setSifreKaydediliyor(true);
    const { error: girisHata } = await supabase.auth.signInWithPassword({ email, password: eskiSifre });
    if (girisHata) {
      setSifreKaydediliyor(false);
      setSifreMesaj({ tur: 'hata', yazi: 'Mevcut şifre hatalı.' });
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: yeniSifre });
    setSifreKaydediliyor(false);
    if (error) {
      setSifreMesaj({ tur: 'hata', yazi: error.message });
      return;
    }
    setEskiSifre('');
    setYeniSifre('');
    setYeniSifre2('');
    setSifreMesaj({ tur: 'ok', yazi: 'Şifreniz değiştirildi. Bir sonraki girişte yeni şifrenizi kullanın.' });
  }

  async function cikisYap() {
    if (!window.confirm('Çıkış yapılsın mı?')) return;
    await supabase.auth.signOut();
  }

  const Mesaj = ({ m }) =>
    m ? (
      <div style={{ ...s.mesaj, ...(m.tur === 'ok' ? s.mesajOk : s.mesajHata) }}>
        {m.tur === 'ok' ? '✓ ' : ''}{m.yazi}
      </div>
    ) : null;

  const tip = sifreGoster ? 'text' : 'password';

  return (
    <div style={s.sayfa}>
      <h1 style={s.baslik}>Ayarlar</h1>
      <p style={s.altBaslik}>Profil, şifre{yetkili ? ', kullanıcılar' : ''} ve sistem bilgileri</p>

      <div style={s.kart}>
        <div style={s.profilUst}>
          <div style={{ ...s.avatar, background: meta.rol === 'Patron' ? '#b45309' : '#1d6fe0' }}>
            {(meta.ad || kullaniciAdi).charAt(0).toLocaleUpperCase('tr-TR')}
          </div>
          <div>
            <div style={s.profilAd}>{meta.ad || kullaniciAdi}</div>
            <div style={s.profilRol}>{meta.rol === 'Patron' ? '👑 ' : ''}{meta.rol || 'Kullanıcı'}</div>
          </div>
        </div>

        <h2 style={s.bolum}>👤 Profil</h2>
        <form onSubmit={profilKaydet}>
          <div style={s.grid}>
            <label style={s.etiket}>Ad Soyad
              <input style={s.input} value={ad} onChange={(e) => setAd(e.target.value)} />
            </label>
            <label style={s.etiket}>Kullanıcı adı (giriş için)
              <input style={{ ...s.input, background: '#f1f5f9', color: '#64748b' }} value={kullaniciAdi} disabled />
            </label>
          </div>
          <Mesaj m={profilMesaj} />
          <button type="submit" disabled={profilKaydediliyor}
            style={{ ...s.anaBtn, opacity: profilKaydediliyor ? 0.6 : 1 }}>
            {profilKaydediliyor ? 'Kaydediliyor...' : 'Profili Kaydet'}
          </button>
        </form>
      </div>

      <div style={s.kart}>
        <h2 style={{ ...s.bolum, marginTop: 0 }}>🔒 Şifre değiştir</h2>
        <form onSubmit={sifreDegistir}>
          <label style={s.etiket}>Mevcut şifre
            <input style={s.input} type={tip} value={eskiSifre}
              onChange={(e) => setEskiSifre(e.target.value)} autoComplete="current-password" />
          </label>
          <div style={{ ...s.grid, marginTop: 12 }}>
            <label style={s.etiket}>Yeni şifre (en az 6 karakter)
              <input style={s.input} type={tip} value={yeniSifre}
                onChange={(e) => setYeniSifre(e.target.value)} autoComplete="new-password" />
            </label>
            <label style={s.etiket}>Yeni şifre (tekrar)
              <input style={s.input} type={tip} value={yeniSifre2}
                onChange={(e) => setYeniSifre2(e.target.value)} autoComplete="new-password" />
            </label>
          </div>
          <label style={s.gosterSatir}>
            <input type="checkbox" checked={sifreGoster} onChange={(e) => setSifreGoster(e.target.checked)} />
            Şifreleri göster
          </label>
          <Mesaj m={sifreMesaj} />
          <button type="submit" disabled={sifreKaydediliyor}
            style={{ ...s.anaBtn, opacity: sifreKaydediliyor ? 0.6 : 1 }}>
            {sifreKaydediliyor ? 'Değiştiriliyor...' : 'Şifreyi Değiştir'}
          </button>
        </form>
      </div>

      {yetkili && <KullaniciYonetimi />}

      <div style={s.kart}>
        <h2 style={{ ...s.bolum, marginTop: 0 }}>ℹ️ Sistem</h2>
        <div style={s.bilgiSatir}><span>Uygulama</span><b>ALKA Tesisat Operasyon Sistemi</b></div>
        <div style={s.bilgiSatir}><span>Sürüm</span><b>1.0</b></div>
        <div style={s.bilgiSatir}><span>Firma</span><b>ALKA Havuz · 0533 371 39 35</b></div>
        <div style={s.bilgiSatir}><span>Geliştirici</span><b style={s.erai}>Built by ERAİ</b></div>
        <button style={s.cikisBtn} onClick={cikisYap}>Çıkış Yap</button>
      </div>
    </div>
  );
}

const s = {
  sayfa: { padding: 20, maxWidth: 850, margin: '0 auto', fontFamily: 'system-ui, sans-serif' },
  baslik: { margin: 0, fontSize: 26, color: '#0f2d4a' },
  altBaslik: { margin: '4px 0 18px', color: '#64748b', fontSize: 14 },
  kart: { background: '#fff', borderRadius: 16, padding: 22, marginBottom: 16,
    boxShadow: '0 2px 12px rgba(15,45,74,0.08)' },
  profilUst: { display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 16, borderBottom: '1px solid #eef2f6' },
  avatar: { width: 56, height: 56, borderRadius: '50%', color: '#fff', fontSize: 24, fontWeight: 800,
    display: 'flex', alignItems: 'center', justifyContent: 'center' },
  profilAd: { fontSize: 20, fontWeight: 800, color: '#0f2d4a' },
  profilRol: { fontSize: 14, color: '#64748b', marginTop: 2 },
  bolum: { fontSize: 17, color: '#0f2d4a', margin: '18px 0 12px' },
  bolumUst: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 },
  etiket: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, color: '#334155' },
  input: { padding: '12px 12px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 15,
    width: '100%', boxSizing: 'border-box' },
  gosterSatir: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#475569', marginTop: 12, cursor: 'pointer' },
  anaBtn: { marginTop: 14, background: 'linear-gradient(135deg,#1e5a82,#0f2d4a)', color: '#fff', border: 'none',
    borderRadius: 12, padding: '12px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 15 },
  kucukAnaBtn: { background: 'linear-gradient(135deg,#1e5a82,#0f2d4a)', color: '#fff', border: 'none',
    borderRadius: 10, padding: '10px 16px', fontWeight: 700, cursor: 'pointer', fontSize: 14 },
  ekleForm: { background: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 14 },
  mesaj: { marginTop: 12, marginBottom: 12, padding: 12, borderRadius: 10, fontSize: 14 },
  mesajOk: { background: '#dcfce7', color: '#166534' },
  mesajHata: { background: '#fee2e2', color: '#991b1b' },
  bos: { color: '#64748b', fontSize: 14, margin: 0 },
  kSatir: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', borderTop: '1px solid #eef2f6', flexWrap: 'wrap' },
  kAvatar: { width: 44, height: 44, borderRadius: '50%', color: '#fff', fontWeight: 800, fontSize: 18,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  kAd: { fontWeight: 700, color: '#0f2d4a', fontSize: 16 },
  senRozet: { fontSize: 11, background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: 10, marginLeft: 6 },
  kucuk: { fontSize: 13, color: '#64748b', marginTop: 2 },
  rolSec: { padding: '9px 10px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 14, background: '#fff' },
  ikincilBtn: { background: '#eff6ff', color: '#1e5a82', border: '1px solid #bfdbfe', borderRadius: 10,
    padding: '9px 12px', fontWeight: 600, cursor: 'pointer', fontSize: 14 },
  silBtn: { background: '#fff', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 10,
    padding: '9px 12px', fontWeight: 600, cursor: 'pointer', fontSize: 14 },
  bilgiSatir: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '11px 0',
    borderBottom: '1px solid #eef2f6', fontSize: 14, color: '#475569', flexWrap: 'wrap' },
  erai: { background: 'linear-gradient(90deg,#0ea5e9,#a855f7)', WebkitBackgroundClip: 'text',
    backgroundClip: 'text', color: 'transparent', letterSpacing: 1 },
  cikisBtn: { marginTop: 18, background: '#fff', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 12,
    padding: '12px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 15 },
};
