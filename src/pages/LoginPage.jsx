import { useState } from 'react';
import { supabase } from '../supabase';

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
          <img src="/logopng.jpg" alt="ALKA Havuz" style={s.logo} />
          <h1 style={s.baslik}>ALKA Tesisat</h1>
          <p style={s.altBaslik}>Operasyon Sistemi</p>
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
            style={{ ...s.input, paddingRight: 70 }}
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

        <div style={s.alt}>ALKA Havuz · 0533 371 39 35</div>
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
    width: '100%', maxWidth: 400, background: '#fff', borderRadius: 20, padding: '32px 28px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.35)', boxSizing: 'border-box',
  },
  logoAlan: { textAlign: 'center', marginBottom: 24 },
  logo: { width: 190, height: 130, borderRadius: 20, objectFit: 'cover' },
  baslik: { margin: '14px 0 2px', fontSize: 24, color: '#0f2d4a' },
  altBaslik: { margin: 0, color: '#64748b', fontSize: 14 },
  etiket: { display: 'block', fontSize: 14, fontWeight: 600, color: '#334155', marginBottom: 6 },
  input: {
    width: '100%', padding: '13px 14px', border: '1px solid #cbd5e1', borderRadius: 12,
    fontSize: 16, marginBottom: 16, boxSizing: 'border-box',
  },
  gosterBtn: {
    position: 'absolute', right: 8, top: 8, border: 'none', background: '#eff6ff', color: '#1e5a82',
    borderRadius: 8, padding: '6px 10px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  hata: { background: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 10, marginBottom: 14, fontSize: 14 },
  girisBtn: {
    width: '100%', padding: 15, border: 'none', borderRadius: 12, fontSize: 17, fontWeight: 700, color: '#fff',
    background: 'linear-gradient(135deg,#1e5a82,#0f2d4a)', cursor: 'pointer',
  },
  alt: { textAlign: 'center', color: '#94a3b8', fontSize: 12, marginTop: 20 },
};
