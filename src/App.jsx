import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { FIRMA } from './firma';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import CustomersPage from './pages/CustomersPage.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import WorkOrdersPage from './pages/WorkOrdersPage.jsx';
import GelislerPage from './pages/GelislerPage.jsx';
import TopluMesajPage from './pages/TopluMesajPage.jsx';
import RehberPage from './pages/RehberPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import RaporPage from './pages/RaporPage.jsx';

const MENU = [
  { id: 'anasayfa', ad: 'Ana Sayfa', kisa: 'Ana Sayfa', ikon: '🏠' },
  { id: 'musteriler', ad: 'Müşteriler', kisa: 'Müşteriler', ikon: '👥' },
  { id: 'takvim', ad: 'Bakım Takvimi', kisa: 'Takvim', ikon: '📅' },
  { id: 'isemirleri', ad: 'İş Emirleri', kisa: 'İş Emri', ikon: '📋' },
  { id: 'gelisler', ad: 'Geliş Planı', kisa: 'Geliş', ikon: '🏡' },
  { id: 'toplumesaj', ad: 'Toplu Mesaj', kisa: 'Mesaj', ikon: '📣' },
  { id: 'rehber', ad: 'Rehberden Aktar', kisa: 'Rehber', ikon: '📇' },
  { id: 'raporlar', ad: 'Raporlar', kisa: 'Raporlar', ikon: '📊' },
  { id: 'ayarlar', ad: 'Ayarlar', kisa: 'Ayarlar', ikon: '⚙️' },
];

const ALT_MENU = ['anasayfa', 'musteriler', 'takvim'];

const ARTI_MENU = [
  { id: 'isemirleri', ad: 'Yeni İş Emri', ikon: '📋' },
  { id: 'musteriler', ad: 'Yeni Müşteri', ikon: '👤' },
  { id: 'gelisler', ad: 'Geliş Ekle', ikon: '🏡' },
  { id: 'rehber', ad: 'Rehberden Aktar', ikon: '📇' },
];

const altBaslikYazi = (FIRMA.altBaslik || 'Mekanik ve Havuz Sistemleri').toLocaleUpperCase('tr-TR');

function Ikon({ ad, boyut = 24, renk = 'currentColor', kalin = 2 }) {
  const p = { fill: 'none', stroke: renk, strokeWidth: kalin, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const yollar = {
    ev: <><path d="M3 10.5 12 3l9 7.5" {...p} /><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" {...p} /></>,
    kisiler: <><circle cx="9" cy="8" r="3.5" {...p} /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" {...p} /><circle cx="17" cy="9" r="2.6" {...p} /><path d="M16.5 14.6c2.6.2 4.4 1.9 5 4.9" {...p} /></>,
    takvim: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" {...p} /><path d="M3.5 10h17M8 3v4M16 3v4" {...p} /></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16" {...p} />,
    arti: <path d="M12 5v14M5 12h14" {...p} />,
    ara: <><circle cx="11" cy="11" r="7" {...p} /><path d="m20 20-3.6-3.6" {...p} /></>,
    filtre: <><path d="M4 7h10M18 7h2M4 17h4M12 17h8" {...p} /><circle cx="16" cy="7" r="2" {...p} /><circle cx="10" cy="17" r="2" {...p} /></>,
    zil: <><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" fill={renk} stroke={renk} strokeWidth={kalin} strokeLinejoin="round" /><path d="M10 20.5a2.2 2.2 0 0 0 4 0" {...p} /></>,
    asagi: <path d="m6 9 6 6 6-6" {...p} />,
  };
  return <svg width={boyut} height={boyut} viewBox="0 0 24 24" style={{ display: 'block', flexShrink: 0 }}>{yollar[ad]}</svg>;
}

const ALT_IKON = { anasayfa: 'ev', musteriler: 'kisiler', takvim: 'takvim' };


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
  const [artiAcik, setArtiAcik] = useState(false);
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
    setArtiAcik(false);
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
      {sayfa === 'toplumesaj' && <TopluMesajPage />}
      {sayfa === 'rehber' && <RehberPage />}
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
            <img src="/logo-alka.png" alt="ALKA" style={s.logo} />
            <div style={s.logoAltYazi}>{altBaslikYazi}</div>
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
    <div style={s.mobilKok}>
      <header style={s.mobilHero}>
        <div style={s.mobilUstSatir}>
          <button style={s.mobilZil} onClick={() => git('takvim')} aria-label="Gecikmiş bakımlar">
            <Ikon ad="zil" boyut={26} renk="#0f172a" />
            {gecikmis > 0 && <span style={s.mobilZilRozet}>{gecikmis > 99 ? '99+' : gecikmis}</span>}
          </button>

          <button style={s.mobilLogoAlan} onClick={() => git('anasayfa')} aria-label="Ana Sayfa">
            <img src="/logo-alka.png" alt="ALKA" style={s.mobilLogo} />
            <span style={s.mobilLogoAltYazi}>{altBaslikYazi}</span>
          </button>

          <button style={s.kullaniciHap} onClick={() => git('ayarlar')}>
            <span style={{ ...s.hapAvatar, background: avatarRenk }}>{ad.charAt(0)}</span>
            <span style={s.hapYazi}>
              <span style={s.hapAd}>{ad}</span>
              <span style={s.hapRol}>{rol}</span>
            </span>
            <Ikon ad="asagi" boyut={16} renk="#334155" kalin={2.4} />
          </button>
        </div>

        <form onSubmit={aramaYap} style={s.mobilArama}>
          <Ikon ad="ara" boyut={24} renk="#0f172a" kalin={2.4} />
          <input
            style={s.mobilAramaInput}
            value={arama}
            onChange={(e) => setArama(e.target.value)}
            placeholder="Müşteri, adres, cihaz ara..."
            enterKeyHint="search"
          />
          <span style={s.aramaAyrac} />
          <button type="submit" style={s.filtreBtn} aria-label="Ara">
            <Ikon ad="filtre" boyut={24} renk="#0f172a" />
          </button>
        </form>
      </header>

      <main style={s.mobilIcerik}>{sayfaIcerik}</main>

      {(menuAcik || artiAcik) && (
        <div style={s.karartma} onClick={() => { setMenuAcik(false); setArtiAcik(false); }} />
      )}

      {menuAcik && (
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
      )}

      {artiAcik && (
        <div style={s.altPanel}>
          <div style={s.panelTutamac} />
          <div style={s.panelBaslik}>Hızlı Ekle</div>
          <div style={{ ...s.panelIzgara, gridTemplateColumns: 'repeat(2,1fr)' }}>
            {ARTI_MENU.map((m) => (
              <button key={m.ad} onClick={() => git(m.id)} style={s.panelBtn}>
                <span style={{ fontSize: 28 }}>{m.ikon}</span>
                <span>{m.ad}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <nav style={s.altMenu}>
        {['anasayfa', 'musteriler'].map((id) => altDugme(id))}
        <div style={s.artiYer}>
          <button
            style={{ ...s.artiBtn, ...(artiAcik ? { transform: 'rotate(45deg)' } : {}) }}
            onClick={() => { setMenuAcik(false); setArtiAcik(!artiAcik); }}
            aria-label="Hızlı ekle"
          >
            <Ikon ad="arti" boyut={34} renk="#fff" kalin={2.6} />
          </button>
        </div>
        {altDugme('takvim')}
        <button
          onClick={() => { setArtiAcik(false); setMenuAcik(!menuAcik); }}
          style={{ ...s.altBtn, ...(menuAcik || menudeMi ? s.altBtnAktif : {}) }}
        >
          <Ikon ad="menu" boyut={26} />
          <span>Menü</span>
        </button>
      </nav>
    </div>
  );

  function altDugme(id) {
    const m = MENU.find((x) => x.id === id);
    const aktif = sayfa === id && !menuAcik && !artiAcik;
    return (
      <button key={id} onClick={() => git(id)} style={{ ...s.altBtn, ...(aktif ? s.altBtnAktif : {}) }}>
        <Ikon ad={ALT_IKON[id]} boyut={26} />
        <span>{m.kisa}</span>
      </button>
    );
  }
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
    padding: '18px 16px 14px', boxSizing: 'border-box', overflowY: 'auto',
    display: 'flex', flexDirection: 'column',
  },
  logoAlan: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 18, paddingTop: 6 },
  logo: { width: 190, height: 'auto', filter: 'drop-shadow(0 6px 18px rgba(0,0,0,0.35))' },
  logoAltYazi: { marginTop: 6, color: '#e2e8f0', fontSize: 10.5, fontWeight: 800, letterSpacing: 1.6, textAlign: 'center' },
  menuBtn: {
    display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '11px 18px',
    marginBottom: 3, border: 'none', borderRadius: 14, background: 'transparent',
    color: '#e2e8f0', fontSize: 16, fontWeight: 500, cursor: 'pointer', textAlign: 'left',
  },
  menuAktif: {
    background: 'linear-gradient(135deg,#1d6fe0,#2563eb)', color: '#fff', fontWeight: 700,
    boxShadow: '0 6px 20px rgba(29,111,224,0.45)',
  },
  kullaniciKart: {
    marginTop: 12, padding: 12, background: 'rgba(10,30,55,0.75)', borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(6px)',
  },
  kullaniciSatir: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 },
  avatar: {
    width: 42, height: 42, borderRadius: '50%', color: '#fff', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18,
  },
  kullaniciAd: { color: '#fff', fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  kullaniciRol: { color: '#94a3b8', fontSize: 12 },
  cikisBtn: {
    width: '100%', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.04)', color: '#e2e8f0',
    borderRadius: 10, padding: '8px 10px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
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
  mobilKok: { minHeight: '100vh', background: '#eef4fb', fontFamily: 'system-ui, -apple-system, sans-serif' },
  mobilHero: {
    position: 'relative', padding: '0 14px 14px', paddingTop: 'max(12px, env(safe-area-inset-top))',
    background:
      'linear-gradient(180deg, rgba(238,244,251,0) 55%, #eef4fb 100%),' +
      'url(/hero.jpg) center 30% / cover no-repeat,' +
      'linear-gradient(180deg,#9fd3f2 0%,#c9e8f8 45%,#e3f3fb 75%,#eef4fb 100%)',
  },
  mobilUstSatir: { display: 'grid', gridTemplateColumns: '52px 1fr auto', alignItems: 'center', gap: 8 },
  mobilZil: {
    position: 'relative', width: 52, height: 52, borderRadius: '50%', border: 'none', background: '#fff',
    boxShadow: '0 4px 14px rgba(15,45,74,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', padding: 0,
  },
  mobilZilRozet: {
    position: 'absolute', top: 2, right: 2, minWidth: 18, height: 18, borderRadius: 9, background: '#ef4444',
    color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '0 4px', border: '2px solid #fff', boxSizing: 'border-box',
  },
  mobilLogoAlan: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', border: 'none', background: 'transparent',
    padding: 0, cursor: 'pointer', minWidth: 0,
  },
  mobilLogo: { width: '100%', maxWidth: 150, height: 'auto', filter: 'drop-shadow(0 2px 6px rgba(255,255,255,0.6))' },
  mobilLogoAltYazi: {
    marginTop: 3, fontSize: 8.5, fontWeight: 900, letterSpacing: 1.1, color: '#0f172a', whiteSpace: 'nowrap',
    textShadow: '0 1px 4px rgba(255,255,255,0.9)',
  },
  kullaniciHap: {
    display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.95)', border: 'none',
    borderRadius: 30, padding: '5px 9px 5px 5px', boxShadow: '0 4px 14px rgba(15,45,74,0.15)', cursor: 'pointer',
    maxWidth: 150, minWidth: 0,
  },
  hapAvatar: {
    width: 38, height: 38, borderRadius: '50%', color: '#fff', fontWeight: 800, fontSize: 17, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  hapYazi: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0, textAlign: 'left' },
  hapAd: { fontSize: 13, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 76 },
  hapRol: { fontSize: 10, color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 76 },
  mobilArama: {
    display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, background: 'rgba(255,255,255,0.96)',
    borderRadius: 18, padding: '0 8px 0 16px', boxShadow: '0 6px 20px rgba(15,45,74,0.12)',
  },
  mobilAramaInput: {
    flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 16, padding: '16px 0',
    color: '#0f2d4a', minWidth: 0,
  },
  aramaAyrac: { width: 1, height: 28, background: '#e2e8f0' },
  filtreBtn: { border: 'none', background: 'transparent', padding: 8, cursor: 'pointer' },
  mobilIcerik: { paddingBottom: 'calc(120px + env(safe-area-inset-bottom))' },
  altMenu: {
    position: 'fixed', left: 10, right: 10, bottom: 'calc(10px + env(safe-area-inset-bottom))', zIndex: 30,
    display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.97)', borderRadius: 28,
    padding: 6, boxShadow: '0 8px 30px rgba(15,45,74,0.18)', backdropFilter: 'blur(10px)',
  },
  altBtn: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '9px 2px 8px',
    border: 'none', background: 'transparent', color: '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer',
    borderRadius: 22,
  },
  altBtnAktif: { color: '#1d6fe0', background: '#dbeafe', fontWeight: 800 },
  artiYer: { flex: 1, display: 'flex', justifyContent: 'center' },
  artiBtn: {
    width: 68, height: 68, marginTop: -40, borderRadius: '50%', border: '6px solid #eef4fb',
    background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', boxShadow: '0 10px 24px rgba(29,78,216,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
    transition: 'transform .2s',
  },
  karartma: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 25 },
  altPanel: {
    position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 28, background: '#fff', borderRadius: '24px 24px 0 0',
    padding: '10px 16px', paddingBottom: 'calc(110px + env(safe-area-inset-bottom))',
    boxShadow: '0 -8px 30px rgba(0,0,0,0.2)',
  },
  panelTutamac: { width: 44, height: 5, borderRadius: 3, background: '#cbd5e1', margin: '0 auto 12px' },
  panelBaslik: { color: '#0f172a', fontWeight: 800, fontSize: 18, marginBottom: 12 },
  panelIzgara: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 },
  panelBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '14px 6px',
    borderRadius: 16, border: '1px solid #e2e8f0', background: '#f8fafc',
    color: '#0f172a', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  panelBtnAktif: { background: '#dbeafe', color: '#1d4ed8', borderColor: '#93c5fd' },
};
