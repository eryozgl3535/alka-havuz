import { useState } from 'react';
import { supabase } from '../supabase';
import EraiImza from '../components/EraiImza.jsx';

export default function LoginPage() {
  const [kullanici, setKullanici] = useState('');
  const [sifre, setSifre] = useState('');
  const [sifreGoster, setSifreGoster] = useState(false);
  const [hata, setHata] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);

  async function girisYap(e) {
    e.preventDefault();
    setHata('');
    if (!kullanici.trim() || !sifre) {
      setHata('Kullanıcı adı ve şifre gerekli.');
      return;
    }
    setYukleniyor(true);
    const email = kullanici.trim().toLowerCase() + '@alka.app';
    const { error } = await supabase.auth.signInWithPassword({ email, password: sifre });
    setYukleniyor(false);
    if (error) setHata('Kullanıcı adı veya şifre hatalı.');
  }

  return (
    <div style={s.zemin}>
      <form onSubmit={girisYap} style={s.kart}>
        <div style={s.logoAlan}>
          <div style={s.logoCerceve}>
            <img src="/logo-alka.png" alt="ALKA" style={s.logo} />
            <div style={s.logoYazi}>MEKANİK VE HAVUZ SİSTEMLERİ</div>
          </div>
          <h1 style={s.baslik}>Hoş geldiniz</h1>
          <p style={s.altBaslik}>Operasyon sistemine giriş yapın</p>
        </div>

        <label style={s.etiket}>Kullanıcı adı</label>
        <input
          style={s.input}
          value={kullanici}
          onChange={(e) => setKullanici(e.target.value)}
          placeholder="örnek: volkan"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="username"
        />

        <label style={s.etiket}>Şifre</label>
        <div style={{ position: 'relative' }}>
          <input
            style={{ ...s.input, paddingRight: 80 }}
            type={sifreGoster ? 'text' : 'password'}
            value={sifre}
            onChange={(e) => setSifre(e.target.value)}
            placeholder="••••••"
            autoComplete="current-password"
          />
          <button type="button" style={s.gosterBtn} onClick={() => setSifreGoster(!sifreGoster)}>
            {sifreGoster ? 'Gizle' : 'Göster'}
          </button>
        </div>

        {hata && <div style={s.hata}>{hata}</div>}

        <button type="submit" disabled={yukleniyor} style={{ ...s.girisBtn, opacity: yukleniyor ? 0.6 : 1 }}>
          {yukleniyor ? 'Giriş yapılıyor...' : 'Giriş Yap'}
        </button>

        <div style={s.alt}>ALKA Mekanik ve Havuz Sistemleri<br />0533 371 39 35</div>

        <div style={s.imzaSatir}>
          <EraiImza boyut={15} />
        </div>
      </form>
    </div>
  );
}

const s = {
  zemin: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    background: 'linear-gradient(135deg,#0f2d4a 0%,#1e5a82 60%,#0b2440 100%)',
    fontFamily: 'system-ui, sans-serif', boxSizing: 'border-box',
  },
  kart: {
    width: '100%', maxWidth: 420, background: '#fff', borderRadius: 24, padding: '36px 30px 24px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.35)', boxSizing: 'border-box',
  },
  logoAlan: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 26 },
  logoCerceve: {
    width: '100%', maxWidth: 300, borderRadius: 24, overflow: 'hidden', boxSizing: 'border-box',
    padding: '26px 22px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center',
    background:
      'radial-gradient(ellipse at 50% 130%, rgba(56,189,248,0.45) 0%, transparent 60%),' +
      'linear-gradient(180deg,#0b2a4a 0%,#0a2440 55%,#063a63 100%)',
    boxShadow: '0 12px 30px rgba(11,42,74,0.35)',
  },
  logo: { width: '86%', height: 'auto', display: 'block', filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.35))' },
  logoYazi: { marginTop: 12, color: '#e2e8f0', fontSize: 10.5, fontWeight: 800, letterSpacing: 1.5, textAlign: 'center', whiteSpace: 'nowrap' },
  baslik: { margin: '20px 0 2px', fontSize: 24, color: '#0f2d4a' },
  altBaslik: { margin: 0, color: '#64748b', fontSize: 15 },
  etiket: { display: 'block', fontSize: 14, fontWeight: 600, color: '#334155', marginBottom: 6 },
  input: {
    width: '100%', padding: '14px 14px', border: '1px solid #cbd5e1', borderRadius: 12,
    fontSize: 16, marginBottom: 16, boxSizing: 'border-box',
  },
  gosterBtn: {
    position: 'absolute', right: 8, top: 8, border: 'none', background: '#eff6ff', color: '#1e5a82',
    borderRadius: 8, padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  hata: { background: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 10, marginBottom: 14, fontSize: 14 },
  girisBtn: {
    width: '100%', padding: 16, border: 'none', borderRadius: 12, fontSize: 17, fontWeight: 700, color: '#fff',
    background: 'linear-gradient(135deg,#1e5a82,#0f2d4a)', cursor: 'pointer',
  },
  alt: { textAlign: 'center', color: '#94a3b8', fontSize: 12, marginTop: 20 },
  imzaSatir: {
    display: 'flex', justifyContent: 'center', marginTop: 14, paddingTop: 14, borderTop: '1px solid #eef2f6',
  },
};
