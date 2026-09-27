import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import CustomersPage from './pages/CustomersPage.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import WorkOrdersPage from './pages/WorkOrdersPage.jsx';
import GelislerPage from './pages/GelislerPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import RaporPage from './pages/RaporPage.jsx';

const MENU = [
  { id: 'anasayfa', ad: 'Ana Sayfa', kisa: 'Ana Sayfa', ikon: '🏠' },
  { id: 'musteriler', ad: 'Müşteriler', kisa: 'Müşteriler', ikon: '👥' },
  { id: 'takvim', ad: 'Bakım Takvimi', kisa: 'Takvim', ikon: '📅' },
  { id: 'isemirleri', ad: 'İş Emirleri', kisa: 'İş Emri', ikon: '📋' },
  { id: 'gelisler', ad: 'Geliş Planı', kisa: 'Geliş', ikon: '🏡' },
  { id: 'raporlar', ad: 'Raporlar', kisa: 'Raporlar', ikon: '📊' },
  { id: 'ayarlar', ad: 'Ayarlar', kisa: 'Ayarlar', ikon: '⚙️' },
];

const ALT_MENU = ['anasayfa', 'musteriler', 'takvim', 'isemirleri'];

const yerel = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function kullaniciBilgisi(session) {
  const meta = session?.user?.user_metadata || {};
  const e = session?.user?.email || '';
  const kisa = e.split('@')[0];
  const yedekAd = kisa ? kisa.charAt(0).toLocaleUpperCase('tr-TR') + kisa.slice(1) : '';
  return { ad: meta.ad || yedekAd, rol: meta.rol || 'Kullanıcı' };
}

export default function App() {
  const eslesme = window.location.pathname.match(/^\/rapor\/([^/?#]+)/);
  if (eslesme) return <RaporPage token={eslesme[1]} />;
  return <AnaUygulama />;
}

function AnaUygulama() {
  const [session, setSession] = useState(null);
  const [hazir, setHazir] = useState(false);
  const [sayfa, setSayfa] = useState('anasayfa');
  const [genis, setGenis] = useState(window.innerWidth >= 900);
  const [menuAcik, setMenuAcik] = useState(false);
  const [gecikmis, setGecikmis] = useState(0);
  const [arama, setArama] = useState('');
  const [aramaAnahtar, setAramaAnahtar] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setHazir(true);
    });
    const { data: dinleyici } = supabase.auth.onAuthStateChange((_olay, yeni) => {
      setSession(yeni);
    });
    return () => dinleyici.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const f = () => setGenis(window.innerWidth >= 900);
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);

  useEffect(() => {
    if (!session) return;
    supabase
      .from('maintenance_rules')
      .select('id', { count: 'exact', head: true })
      .lt('next_due_date', yerel(new Date()))
      .then(({ count }) => setGecikmis(count || 0));
  }, [session, sayfa]);

  function git(id) {
    const hedef = id === 'ekipman' ? 'musteriler' : id;
    setSayfa(hedef);
    setMenuAcik(false);
    window.scrollTo(0, 0);
  }

  function aramaYap(e) {
    e.preventDefault();
    if (!arama.trim()) return;
    sessionStorage.setItem('alkaArama', arama.trim());
    setArama('');
    setAramaAnahtar((n) => n + 1);
    git('musteriler');
  }

  async function cikisYap() {
    if (!window.confirm('Çıkış yapılsın mı?')) return;
    await supabase.auth.signOut();
    setSayfa('anasayfa');
    setMenuAcik(false);
  }

  if (!hazir) {
    return <div style={s.yukleme}>Yükleniyor...</div>;
  }

  if (!session) {
    return <LoginPage />;
  }

  const { ad, rol } = kullaniciBilgisi(session);
  const avatarRenk = rol === 'Patron' ? '#b45309' : '#1d6fe0';

  const sayfaIcerik = (
    <>
      {sayfa === 'anasayfa' && <DashboardPage onNavigate={git} ad={ad} />}
      {sayfa === 'musteriler' && <CustomersPage key={aramaAnahtar} />}
      {sayfa === 'takvim' && <CalendarPage />}
      {sayfa === 'isemirleri' && <WorkOrdersPage />}
      {sayfa === 'gelisler' && <GelislerPage />}
      {sayfa === 'raporlar' && <ReportsPage />}
      {sayfa === 'ayarlar' && <SettingsPage session={session} />}
    </>
  );

  const zil = (
    <button style={s.zil} onClick={() => git('takvim')} title="Gecikmiş bakımlar">
      🔔
      {gecikmis > 0 && <span style={s.zilRozet}>{gecikmis > 99 ? '99+' : gecikmis}</span>}
    </button>
  );

  const kullaniciKart = (
    <div style={s.kullaniciKart}>
      <div style={s.kullaniciSatir}>
        <div style={{ ...s.avatar, background: avatarRenk }}>{ad.charAt(0)}</div>
        <div style={{ minWidth: 0 }}>
          <div style={s.kullaniciAd}>{ad}</div>
          <div style={s.kullaniciRol}>{rol === 'Patron' ? '👑 ' : ''}{rol}</div>
        </div>
      </div>
      <button style={s.cikisBtn} onClick={cikisYap}>⎋ Çıkış</button>
    </div>
  );

  if (genis) {
    return (
      <div style={s.kok}>
        <aside style={s.yan}>
          <div style={s.logoAlan}>
            <img src="/logopng.jpg" alt="ALKA Havuz" style={s.logo} />
          </div>
          <nav style={{ flex: 1 }}>
            {MENU.map((m) => (
              <button
                key={m.id}
                onClick={() => git(m.id)}
                style={{ ...s.menuBtn, ...(sayfa === m.id ? s.menuAktif : {}) }}
              >
                <span style={{ fontSize: 20, width: 26, textAlign: 'center' }}>{m.ikon}</span>
                <span>{m.ad}</span>
              </button>
            ))}
          </nav>
          {kullaniciKart}
        </aside>

        <div style={{ marginLeft: 260, minHeight: '100vh' }}>
          <header style={s.ustCubuk}>
            <form onSubmit={aramaYap} style={s.aramaKutu}>
              <span style={{ fontSize: 17, opacity: 0.6 }}>🔍</span>
              <input
                style={s.aramaInput}
                value={arama}
                onChange={(e) => setArama(e.target.value)}
                placeholder="Müşteri, adres, cihaz veya marka ara... (Enter)"
              />
            </form>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {zil}
              <button style={s.yeniIsBtn} onClick={() => git('isemirleri')}>+ Yeni İş Emri</button>
            </div>
          </header>
          <main>{sayfaIcerik}</main>
        </div>
      </div>
    );
  }

  const menudeMi = !ALT_MENU.includes(sayfa);

  return (
    <div style={s.kok}>
      <header style={s.mobilUst}>
        {zil}
        <img src="/logopng.jpg" alt="ALKA Havuz" style={s.mobilLogo} onClick={() => git('anasayfa')} />
        <button style={{ ...s.mobilAvatar, background: avatarRenk }} onClick={() => git('ayarlar')}>
          {ad.charAt(0)}
        </button>
      </header>

      <form onSubmit={aramaYap} style={s.mobilArama}>
        <span style={{ fontSize: 16, opacity: 0.6 }}>🔍</span>
        <input
          style={s.aramaInput}
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          placeholder="Müşteri, adres, cihaz ara..."
        />
      </form>

      <main style={s.mobilIcerik}>{sayfaIcerik}</main>

      {menuAcik && (
        <>
          <div style={s.karartma} onClick={() => setMenuAcik(false)} />
          <div style={s.altPanel}>
            <div style={s.panelTutamac} />
            <div style={s.panelBaslik}>Menü</div>
            <div style={s.panelIzgara}>
              {MENU.map((m) => (
                <button
                  key={m.id}
                  onClick={() => git(m.id)}
                  style={{ ...s.panelBtn, ...(sayfa === m.id ? s.panelBtnAktif : {}) }}
                >
                  <span style={{ fontSize: 26 }}>{m.ikon}</span>
                  <span>{m.ad}</span>
                </button>
              ))}
            </div>
            <div style={{ marginTop: 14 }}>{kullaniciKart}</div>
          </div>
        </>
      )}

      <nav style={s.altMenu}>
        {ALT_MENU.map((id) => {
          const m = MENU.find((x) => x.id === id);
          const aktif = sayfa === id && !menuAcik;
          return (
            <button key={id} onClick={() => git(id)} style={{ ...s.altBtn, ...(aktif ? s.altBtnAktif : {}) }}>
              <span style={{ fontSize: 22 }}>{m.ikon}</span>
              <span>{m.kisa}</span>
            </button>
          );
        })}
        <button
          onClick={() => setMenuAcik(!menuAcik)}
          style={{ ...s.altBtn, ...(menuAcik || menudeMi ? s.altBtnAktif : {}) }}
        >
          <span style={{ fontSize: 22 }}>☰</span>
          <span>Menü</span>
        </button>
      </nav>
    </div>
  );
}

const s = {
  yukleme: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#0f2d4a', color: '#fff', fontFamily: 'system-ui, sans-serif', fontSize: 18,
  },
  kok: { minHeight: '100vh', background: '#f1f5fb', fontFamily: 'system-ui, sans-serif' },

  yan: {
    position: 'fixed', top: 0, left: 0, bottom: 0, width: 260, zIndex: 20,
    background:
      'radial-gradient(ellipse at 50% 115%, rgba(56,189,248,0.55) 0%, rgba(14,116,184,0.30) 30%, transparent 58%),' +
      'radial-gradient(ellipse at 20% 100%, rgba(125,211,252,0.25) 0%, transparent 40%),' +
      'linear-gradient(180deg,#0b2a4a 0%,#0a2440 50%,#063a63 100%)',
    padding: '22px 16px 18px', boxSizing: 'border-box', overflowY: 'auto',
    display: 'flex', flexDirection: 'column',
  },
  logoAlan: { display: 'flex', justifyContent: 'center', marginBottom: 22 },
  logo: { width: 180, height: 180, borderRadius: 22, objectFit: 'cover', boxShadow: '0 8px 30px rgba(0,0,0,0.35)' },
  menuBtn: {
    display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '13px 18px',
    marginBottom: 5, border: 'none', borderRadius: 14, background: 'transparent',
    color: '#e2e8f0', fontSize: 16, fontWeight: 500, cursor: 'pointer', textAlign: 'left',
  },
  menuAktif: {
    background: 'linear-gradient(135deg,#1d6fe0,#2563eb)', color: '#fff', fontWeight: 700,
    boxShadow: '0 6px 20px rgba(29,111,224,0.45)',
  },
  kullaniciKart: {
    marginTop: 16, padding: 14, background: 'rgba(10,30,55,0.75)', borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(6px)',
  },
  kullaniciSatir: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: '50%', color: '#fff', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18,
  },
  kullaniciAd: { color: '#fff', fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  kullaniciRol: { color: '#94a3b8', fontSize: 12 },
  cikisBtn: {
    width: '100%', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.04)', color: '#e2e8f0',
    borderRadius: 10, padding: '9px 10px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },

  ustCubuk: {
    position: 'sticky', top: 0, zIndex: 15, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 16, padding: '14px 28px', background: 'rgba(241,245,251,0.88)', backdropFilter: 'blur(10px)',
  },
  aramaKutu: {
    flex: 1, maxWidth: 620, display: 'flex', alignItems: 'center', gap: 10, background: '#e8eef7',
    borderRadius: 14, padding: '0 16px', border: '1px solid #dbe4f0',
  },
  aramaInput: {
    flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 15, padding: '13px 0',
    color: '#0f2d4a', minWidth: 0,
  },
  zil: {
    position: 'relative', width: 46, height: 46, borderRadius: '50%', border: 'none', background: '#fff',
    boxShadow: '0 2px 10px rgba(15,45,74,0.12)', fontSize: 20, cursor: 'pointer', flexShrink: 0,
  },
  zilRozet: {
    position: 'absolute', top: -2, right: -2, minWidth: 20, height: 20, borderRadius: 10, background: '#ef4444',
    color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '0 5px', border: '2px solid #fff', boxSizing: 'border-box',
  },
  yeniIsBtn: {
    background: 'linear-gradient(135deg,#1d6fe0,#2563eb)', color: '#fff', border: 'none', borderRadius: 14,
    padding: '13px 22px', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 6px 18px rgba(29,111,224,0.35)',
    whiteSpace: 'nowrap',
  },

  mobilUst: {
    position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: 'linear-gradient(135deg,#0b2a4a,#1e5a82)', padding: '10px 14px',
    paddingTop: 'max(10px, env(safe-area-inset-top))', boxShadow: '0 2px 12px rgba(15,45,74,0.25)',
  },
  mobilLogo: { height: 72, width: 72, borderRadius: 14, objectFit: 'cover', cursor: 'pointer' },
  mobilAvatar: {
    width: 46, height: 46, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.5)', color: '#fff',
    fontWeight: 800, fontSize: 18, cursor: 'pointer',
  },
  mobilArama: {
    display: 'flex', alignItems: 'center', gap: 8, margin: '12px 14px 0', background: '#fff', borderRadius: 12,
    padding: '0 14px', border: '1px solid #dbe4f0',
  },
  mobilIcerik: { paddingBottom: 'calc(84px + env(safe-area-inset-bottom))' },
  altMenu: {
    position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 30, display: 'flex',
    background: '#0b2a4a', borderTop: '1px solid rgba(255,255,255,0.08)',
    paddingBottom: 'env(safe-area-inset-bottom)', boxShadow: '0 -4px 16px rgba(0,0,0,0.2)',
  },
  altBtn: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '10px 2px 8px',
    border: 'none', background: 'transparent', color: '#94a3b8', fontSize: 11, fontWeight: 600, cursor: 'pointer',
  },
  altBtnAktif: { color: '#fff', background: 'rgba(29,111,224,0.35)' },
  karartma: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 25 },
  altPanel: {
    position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 28,
    background: 'linear-gradient(180deg,#0b2a4a,#063a63)', borderRadius: '20px 20px 0 0',
    padding: '10px 16px', paddingBottom: 'calc(84px + env(safe-area-inset-bottom))',
    boxShadow: '0 -8px 30px rgba(0,0,0,0.35)',
  },
  panelTutamac: { width: 44, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.3)', margin: '0 auto 12px' },
  panelBaslik: { color: '#fff', fontWeight: 800, fontSize: 18, marginBottom: 12 },
  panelIzgara: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 },
  panelBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '14px 6px',
    borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)',
    color: '#e2e8f0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  panelBtnAktif: { background: '#1d6fe0', color: '#fff', borderColor: '#1d6fe0' },
};
