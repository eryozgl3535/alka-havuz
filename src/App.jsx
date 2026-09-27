import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import CustomersPage from './pages/CustomersPage.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import WorkOrdersPage from './pages/WorkOrdersPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

const MENU = [
  { id: 'anasayfa', ad: 'Ana Sayfa', kisa: 'Ana Sayfa', ikon: '🏠' },
  { id: 'musteriler', ad: 'Müşteriler', kisa: 'Müşteriler', ikon: '👥' },
  { id: 'takvim', ad: 'Bakım Takvimi', kisa: 'Takvim', ikon: '📅' },
  { id: 'isemirleri', ad: 'İş Emirleri', kisa: 'İş Emri', ikon: '📋' },
  { id: 'raporlar', ad: 'Raporlar', kisa: 'Raporlar', ikon: '📊' },
  { id: 'ayarlar', ad: 'Ayarlar', kisa: 'Ayarlar', ikon: '⚙️' },
];

const ALT_MENU = ['anasayfa', 'musteriler', 'takvim', 'isemirleri'];

function kullaniciBilgisi(session) {
  const meta = session?.user?.user_metadata || {};
  const e = session?.user?.email || '';
  const kisa = e.split('@')[0];
  const yedekAd = kisa ? kisa.charAt(0).toLocaleUpperCase('tr-TR') + kisa.slice(1) : '';
  return { ad: meta.ad || yedekAd, rol: meta.rol || 'Kullanıcı' };
}

export default function App() {
  const [session, setSession] = useState(null);
  const [hazir, setHazir] = useState(false);
  const [sayfa, setSayfa] = useState('anasayfa');
  const [genis, setGenis] = useState(window.innerWidth >= 900);
  const [menuAcik, setMenuAcik] = useState(false);

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

  function git(id) {
    const hedef = id === 'ekipman' ? 'musteriler' : id;
    setSayfa(hedef);
    setMenuAcik(false);
    window.scrollTo(0, 0);
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

  const kullaniciKutu = (
    <div style={s.kullaniciKutu}>
      <div style={{ ...s.avatar, background: avatarRenk }}>{ad.charAt(0)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={s.kullaniciAd}>{ad}</div>
        <div style={s.kullaniciRol}>{rol === 'Patron' ? '👑 ' : ''}{rol}</div>
      </div>
      <button style={s.cikisBtn} onClick={cikisYap}>Çıkış</button>
    </div>
  );

  const sayfaIcerik = (
    <>
      {sayfa === 'anasayfa' && <DashboardPage onNavigate={git} />}
      {sayfa === 'musteriler' && <CustomersPage />}
      {sayfa === 'takvim' && <CalendarPage />}
      {sayfa === 'isemirleri' && <WorkOrdersPage />}
      {sayfa === 'raporlar' && <ReportsPage />}
      {sayfa === 'ayarlar' && <SettingsPage session={session} />}
    </>
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
                <span style={{ fontSize: 20 }}>{m.ikon}</span>
                <span>{m.ad}</span>
              </button>
            ))}
          </nav>
          {kullaniciKutu}
        </aside>
        <main style={{ minHeight: '100vh', marginLeft: 260 }}>{sayfaIcerik}</main>
      </div>
    );
  }

  const menudeMi = !ALT_MENU.includes(sayfa);

  return (
    <div style={s.kok}>
      <header style={s.mobilUst}>
        <div style={{ width: 44 }} />
        <img src="/logopng.jpg" alt="ALKA Havuz" style={s.mobilLogo} onClick={() => git('anasayfa')} />
        <button style={{ ...s.mobilAvatar, background: avatarRenk }} onClick={() => git('ayarlar')}>
          {ad.charAt(0)}
        </button>
      </header>

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
            {kullaniciKutu}
          </div>
        </>
      )}

      <nav style={s.altMenu}>
        {ALT_MENU.map((id) => {
          const m = MENU.find((x) => x.id === id);
          const aktif = sayfa === id && !menuAcik;
          return (
            <button key={id} onClick={() => git(id)} style={{ ...s.altBtn, ...(aktif ? s.altBtnAktif : {}) }}>
              <span style={{ fontSize: 22, filter: aktif ? 'none' : 'grayscale(0.4)' }}>{m.ikon}</span>
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
    background: 'linear-gradient(180deg,#0f2d4a 0%,#0b2440 60%,#082038 100%)',
    padding: '20px 16px', boxSizing: 'border-box', overflowY: 'auto',
    display: 'flex', flexDirection: 'column',
  },
  logoAlan: { display: 'flex', justifyContent: 'center', marginBottom: 24 },
  logo: { width: 180, height: 180, borderRadius: 20, objectFit: 'cover' },
  menuBtn: {
    display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '14px 16px',
    marginBottom: 6, border: 'none', borderRadius: 12, background: 'transparent',
    color: '#e2e8f0', fontSize: 16, fontWeight: 500, cursor: 'pointer', textAlign: 'left',
  },
  menuAktif: { background: '#1d6fe0', color: '#fff', fontWeight: 700 },
  kullaniciKutu: {
    display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, padding: 12,
    background: 'rgba(255,255,255,0.08)', borderRadius: 14,
  },
  avatar: {
    width: 40, height: 40, borderRadius: '50%', color: '#fff', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18,
  },
  kullaniciAd: { color: '#fff', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  kullaniciRol: { color: '#94a3b8', fontSize: 12 },
  cikisBtn: {
    border: '1px solid rgba(255,255,255,0.25)', background: 'transparent', color: '#fca5a5',
    borderRadius: 8, padding: '7px 10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
  },

  mobilUst: {
    position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: 'linear-gradient(135deg,#0f2d4a,#1e5a82)', padding: '10px 14px',
    paddingTop: 'max(10px, env(safe-area-inset-top))',
    boxShadow: '0 2px 12px rgba(15,45,74,0.25)',
  },
  mobilLogo: { height: 72, width: 72, borderRadius: 14, objectFit: 'cover', cursor: 'pointer' },
  mobilAvatar: {
    width: 44, height: 44, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.5)', color: '#fff',
    fontWeight: 800, fontSize: 18, cursor: 'pointer',
  },
  mobilIcerik: { paddingBottom: 'calc(84px + env(safe-area-inset-bottom))' },
  altMenu: {
    position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 30, display: 'flex',
    background: '#0f2d4a', borderTop: '1px solid rgba(255,255,255,0.08)',
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
    background: 'linear-gradient(180deg,#0f2d4a,#082038)', borderRadius: '20px 20px 0 0',
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
