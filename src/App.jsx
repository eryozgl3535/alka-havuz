import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { FIRMA } from './firma';
import { useTema, arkaPlanCss, baslikRenk } from './tema';
import { Ikon as SIkon, IkonKutu } from './ikonlar';
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
import HaritaPage from './pages/HaritaPage.jsx';
import NotlarPage from './pages/NotlarPage.jsx';
import RaporPage from './pages/RaporPage.jsx';

const MENU = [
  { id: 'anasayfa', ad: 'Ana Sayfa', kisa: 'Ana Sayfa', ik: 'ev', renk: '#2563eb' },
  { id: 'musteriler', ad: 'Müşteriler', kisa: 'Müşteriler', ik: 'kisiler', renk: '#2563eb' },
  { id: 'takvim', ad: 'Bakım Takvimi', kisa: 'Takvim', ik: 'takvim', renk: '#7c3aed' },
  { id: 'isemirleri', ad: 'İş Emirleri', kisa: 'İş Emri', ik: 'pano', renk: '#ea580c' },
  { id: 'gelisler', ad: 'Geliş Planı', kisa: 'Geliş', ik: 'takvimSaat', renk: '#0d9488' },
  { id: 'harita', ad: 'Harita ve Rota', kisa: 'Harita', ik: 'harita', renk: '#0284c7' },
  { id: 'notlar', ad: 'Notlar', kisa: 'Notlar', ik: 'kalem', renk: '#d97706' },
  { id: 'toplumesaj', ad: 'Toplu Mesaj', kisa: 'Mesaj', ik: 'hoparlor', renk: '#db2777' },
  { id: 'rehber', ad: 'Rehberden Aktar', kisa: 'Rehber', ik: 'rehber', renk: '#0891b2' },
  { id: 'raporlar', ad: 'Raporlar', kisa: 'Raporlar', ik: 'grafik', renk: '#16a34a' },
  { id: 'ayarlar', ad: 'Ayarlar', kisa: 'Ayarlar', ik: 'ayar', renk: '#475569' },
];

const ALT_MENU = ['anasayfa', 'musteriler', 'takvim'];

const MENU_GRUPLARI = [
  { ad: 'İş Takibi', idler: ['isemirleri', 'takvim', 'gelisler', 'harita', 'notlar'] },
  { ad: 'Müşteriler', idler: ['musteriler', 'rehber', 'toplumesaj'] },
  { ad: 'Yönetim', idler: ['raporlar', 'ayarlar'] },
];

const ARTI_MENU = [
  { id: 'isemirleri', ad: 'Yeni İş Emri', ik: 'pano', renk: '#ea580c' },
  { id: 'musteriler', ad: 'Yeni Müşteri', ik: 'kisiEkle', renk: '#2563eb' },
  { id: 'gelisler', ad: 'Geliş Ekle', ik: 'takvimSaat', renk: '#0d9488' },
  { id: 'notlar', ad: 'Not Ekle', ik: 'kalem', renk: '#d97706' },
  { id: 'rehber', ad: 'Rehberden Aktar', ik: 'rehber', renk: '#0891b2' },
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
  const tema = useTema();
  const [bR1, bR2] = baslikRenk(tema);
  const arkaCss = arkaPlanCss(tema);
  const baslikFotoUrl = tema.baslikFoto === 'yok' ? null : (tema.baslikFoto || '/hero-alka.jpg');
  const baslikZemin = baslikFotoUrl
    ? `linear-gradient(90deg, rgba(5,20,40,.78) 0%, rgba(5,20,40,.42) 50%, rgba(5,20,40,.08) 100%), linear-gradient(180deg, rgba(5,20,40,.45) 0%, rgba(5,20,40,0) 30%, rgba(5,20,40,0) 70%, rgba(5,20,40,.35) 100%), url(${baslikFotoUrl}) right center / cover no-repeat, ${bR1}`
    : `radial-gradient(60% 55% at 85% 25%, rgba(255,214,140,0.18) 0%, transparent 70%),` +
      `radial-gradient(80% 60% at 70% 115%, rgba(56,189,248,0.55) 0%, transparent 65%),` +
      `radial-gradient(40% 30% at 10% 105%, rgba(14,165,233,0.35) 0%, transparent 70%),` +
      `linear-gradient(165deg, ${bR1} 0%, ${bR2} 70%, ${bR2} 100%)`;
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
      {sayfa === 'harita' && <HaritaPage />}
      {sayfa === 'notlar' && <NotlarPage ad={ad} />}
      {sayfa === 'raporlar' && <ReportsPage />}
      {sayfa === 'ayarlar' && <SettingsPage session={session} />}
    </>
  );

  const zil = (
    <button style={s.zil} onClick={() => git('takvim')} title="Gecikmiş bakımlar">
      <SIkon ad="zil" boyut={20} renk="#334155" />
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

  const selamMetni = () => { const h = new Date().getHours(); return h >= 5 && h < 12 ? 'Günaydın' : h < 18 && h >= 12 ? 'İyi günler' : h >= 18 && h < 23 ? 'İyi akşamlar' : 'İyi geceler'; };
  const tarihMetni = () => {
    const d = new Date();
    const aylar = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const gunler = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    return `${d.getDate()} ${aylar[d.getMonth()]} ${d.getFullYear()}, ${gunler[d.getDay()]}`;
  };

  const masaZemin = baslikFotoUrl
    ? `linear-gradient(90deg, ${bR1} 0%, ${bR1} calc(100% - 495px), rgba(8,30,55,0.75) calc(100% - 420px), rgba(8,30,55,0.25) calc(100% - 320px), rgba(8,30,55,0) calc(100% - 240px)), linear-gradient(180deg, rgba(5,20,40,.35) 0%, rgba(5,20,40,0) 30%), url(${baslikFotoUrl}) right center / auto 100% no-repeat, ${bR1}`
    : baslikZemin;

  if (genis) {
    return (
      <div style={s.kok}>
        <aside style={{ ...s.yan, ...(tema.baslik !== 'lacivert' ? { background: `linear-gradient(180deg,${bR1} 0%,${bR2} 100%)` } : {}) }}>
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
                <SIkon ad={m.ik} boyut={20} kalin={2} />
                <span>{m.ad}</span>
              </button>
            ))}
          </nav>
          {kullaniciKart}
        </aside>

        <div style={{ marginLeft: 260, minHeight: '100vh', position: 'relative' }}>
          <div style={{ position: 'fixed', inset: 0, left: 260, zIndex: 0, background: arkaCss }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
          {sayfa === 'anasayfa' ? (
            <div style={s.masaHeroSar}>
              <header style={{ ...s.masaHero, background: masaZemin }}>
                <div style={s.masaHeroUst}>
                  <div style={s.masaLogoAlan}>
                    <img src="/logo-alka.png" alt="ALKA" style={s.masaLogo} />
                    <span style={s.masaLogoYazi}>{altBaslikYazi}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button style={s.masaHeroZil} onClick={() => git('takvim')} title="Gecikmiş bakımlar">
                      <SIkon ad="zil" boyut={20} renk="#fff" />
                      {gecikmis > 0 && <span style={s.zilRozet}>{gecikmis > 99 ? '99+' : gecikmis}</span>}
                    </button>
                    <button style={s.yeniIsBtn} onClick={() => git('isemirleri')}>+ Yeni İş Emri</button>
                  </div>
                </div>
                <div style={s.masaSelam}>{selamMetni()}, {String(ad).split(' ')[0]} 👋</div>
                <div style={s.masaTarih}>{tarihMetni()}</div>
              </header>
            </div>
          ) : (
          <header style={s.ustCubuk}>
            <form onSubmit={aramaYap} style={s.aramaKutu}>
              <SIkon ad="ara" boyut={18} renk="#64748b" />
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
          )}
          <main>{sayfaIcerik}</main>
          </div>
        </div>
      </div>
    );
  }

  const menudeMi = !ALT_MENU.includes(sayfa);

  return (
    <div style={s.mKok}>
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, background: arkaCss }} />
      <header style={{ ...s.mUst, background: baslikZemin, paddingBottom: sayfa === 'anasayfa' ? 54 : 16 }}>
        <div style={s.mUstSatir}>
          <button style={s.mLogoAlan} onClick={() => git('anasayfa')} aria-label="Ana Sayfa">
            <img src="/logo-alka.png" alt="ALKA" style={s.mLogo} />
            <span style={s.mLogoYazi}>{altBaslikYazi}</span>
          </button>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button style={s.mYuvarlak} onClick={() => git('takvim')} aria-label="Gecikmiş bakımlar">
              <SIkon ad="zil" boyut={21} renk="#fff" kalin={2} />
              {gecikmis > 0 && <span style={s.mRozet}>{gecikmis > 99 ? '99+' : gecikmis}</span>}
            </button>
            <button style={{ ...s.mYuvarlak, background: avatarRenk, border: '2px solid rgba(255,255,255,.35)', fontWeight: 800, fontSize: 18, color: '#fff' }}
              onClick={() => git('ayarlar')} aria-label="Profil">
              {ad.charAt(0)}
            </button>
          </div>
        </div>
        {sayfa === 'anasayfa' && (
          <div style={s.mSelam}>
            <div style={s.mSelamYazi}>{selamMetni()}, {String(ad).split(' ')[0]} 👋</div>
            <div style={s.mSelamTarih}>{tarihMetni()}</div>
          </div>
        )}
      </header>

      <main style={{ ...s.mIcerik, position: 'relative', zIndex: 3, ...(sayfa === 'anasayfa' ? { paddingTop: 0 } : {}) }}>{sayfaIcerik}</main>

      {(menuAcik || artiAcik) && (
        <div style={s.karartma} onClick={() => { setMenuAcik(false); setArtiAcik(false); }} />
      )}

      {menuAcik && (
        <div style={s.altPanel}>
          <div style={s.panelTutamac} />
          {MENU_GRUPLARI.map((g) => (
            <div key={g.ad} style={{ marginBottom: 14 }}>
              <div style={s.grupBaslik}>{g.ad}</div>
              <div style={s.grupKutu}>
                {g.idler.map((id, i) => {
                  const m = MENU.find((x) => x.id === id);
                  const aktif = sayfa === id;
                  return (
                    <button key={id} onClick={() => git(id)}
                      style={{ ...s.menuSatir, ...(i > 0 ? { borderTop: '1px solid #eef2f7' } : {}), ...(aktif ? { color: '#1d4ed8' } : {}) }}>
                      <IkonKutu ad={m.ik} renk={m.renk} boyut={36} yaricap={10} />
                      <span style={{ flex: 1, textAlign: 'left' }}>{m.ad}</span>
                      <SIkon ad="sag" boyut={18} renk="#cbd5e1" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div style={s.profilSatir}>
            <span style={{ ...s.profilAvatar, background: avatarRenk }}>{ad.charAt(0)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 15 }}>{ad}</div>
              <div style={{ color: '#64748b', fontSize: 13 }}>{rol === 'Patron' ? '👑 ' : ''}{rol}</div>
            </div>
            <button style={s.mCikis} onClick={cikisYap}><SIkon ad="cikis" boyut={16} /> Çıkış</button>
          </div>
        </div>
      )}

      {artiAcik && (
        <div style={s.altPanel}>
          <div style={s.panelTutamac} />
          <div style={s.grupBaslik}>Hızlı Ekle</div>
          <div style={s.artiIzgara}>
            {ARTI_MENU.map((m) => (
              <button key={m.ad} onClick={() => git(m.id)} style={s.artiKutu}>
                <IkonKutu ad={m.ik} renk={m.renk} boyut={48} yaricap={14} />
                <span>{m.ad}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <nav style={s.altMenu}>
        {altDugme('anasayfa')}
        {altDugme('musteriler')}
        <div style={s.artiYer}>
          <button
            style={{ ...s.artiBtn, ...(artiAcik ? { transform: 'rotate(45deg)' } : {}) }}
            onClick={() => { setMenuAcik(false); setArtiAcik(!artiAcik); }}
            aria-label="Hızlı ekle"
          >
            <SIkon ad="arti" boyut={26} renk="#fff" kalin={2.6} />
          </button>
        </div>
        {altDugme('takvim')}
        <button
          onClick={() => { setArtiAcik(false); setMenuAcik(!menuAcik); }}
          style={{ ...s.altBtn, ...(menuAcik || menudeMi ? s.altBtnAktif : {}) }}
        >
          <SIkon ad="menu" boyut={24} kalin={menuAcik || menudeMi ? 2.4 : 1.9} />
          <span>Menü</span>
          <span style={{ ...s.altNokta, opacity: menuAcik || menudeMi ? 1 : 0 }} />
        </button>
      </nav>
    </div>
  );

  function altDugme(id) {
    const m = MENU.find((x) => x.id === id);
    const aktif = sayfa === id && !menuAcik && !artiAcik;
    return (
      <button key={id} onClick={() => git(id)} style={{ ...s.altBtn, ...(aktif ? s.altBtnAktif : {}) }}>
        <SIkon ad={{ anasayfa: 'ev', musteriler: 'kisiler', takvim: 'takvim' }[id]} boyut={24} kalin={aktif ? 2.4 : 1.9} />
        <span>{m.kisa}</span>
        <span style={{ ...s.altNokta, opacity: aktif ? 1 : 0 }} />
      </button>
    );
  }
}

const s = {
  yukleme: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#0f2d4a', color: '#fff', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: 18,
  },
  kok: { minHeight: '100vh', background: '#f1f5fb', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" },
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
  masaHero: {
    position: 'relative', padding: '24px 28px 84px', borderRadius: 28, minHeight: 340, boxSizing: 'border-box',
    boxShadow: '0 14px 34px rgba(6,40,72,0.28)', color: '#fff', overflow: 'hidden',
  },
  masaHeroSar: { maxWidth: 928, margin: '0 auto', padding: '18px 14px 0', boxSizing: 'border-box' },
  masaLogoAlan: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start' },
  masaLogo: { height: 64, width: 'auto', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.4))' },
  masaLogoYazi: { marginTop: 5, fontSize: 11, fontWeight: 800, letterSpacing: 2, color: '#e2e8f0', textShadow: '0 1px 4px rgba(0,0,0,.4)' },
  masaHeroUst: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  masaHeroArama: {
    flex: 1, maxWidth: 520, display: 'flex', alignItems: 'center', gap: 10, margin: 0, borderRadius: 14, padding: '0 16px',
    background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.25)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
  },
  masaHeroInput: { flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 15, padding: '13px 0', color: '#fff', minWidth: 0, fontFamily: 'inherit' },
  masaHeroZil: {
    position: 'relative', width: 46, height: 46, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(15,30,55,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, backdropFilter: 'blur(6px)',
  },
  masaSelam: { marginTop: 84, fontSize: 30, fontWeight: 800, letterSpacing: -0.5, textShadow: '0 2px 10px rgba(0,0,0,.35)' },
  masaTarih: { marginTop: 6, fontSize: 16, opacity: 0.88, fontWeight: 500, textShadow: '0 1px 6px rgba(0,0,0,.35)' },
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
  mKok: { minHeight: '100vh', position: 'relative', background: '#f3f6fa', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" },
  mUst: {
    position: 'relative', zIndex: 2,
    padding: '0 18px 16px', paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 10px), 56px)',
    borderRadius: '0 0 28px 28px', boxShadow: '0 8px 24px rgba(6,40,72,0.28)',
  },
  mUstSatir: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  mYuvarlak: {
    position: 'relative', width: 48, height: 48, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.22)',
    background: 'rgba(15,30,55,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flexShrink: 0,
  },
  mRozet: {
    position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, background: '#ef4444',
    color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '0 4px', border: '2px solid #0a2440', boxSizing: 'border-box',
  },
  mLogoAlan: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', border: 'none', background: 'none', padding: 0, cursor: 'pointer', minWidth: 0 },
  mLogo: { height: 52, width: 'auto', maxWidth: '62vw', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.4))' },
  mLogoYazi: { marginTop: 4, fontSize: 9.5, fontWeight: 800, letterSpacing: 1.6, color: '#e2e8f0', whiteSpace: 'nowrap', textShadow: '0 1px 4px rgba(0,0,0,.4)' },
  mArama: {
    display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 0', background: '#fff', borderRadius: 14,
    padding: '0 14px', height: 46,
  },
  mAramaInput: { flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 16, color: '#0f172a', minWidth: 0 },
  mBaslik: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, color: '#fff', fontSize: 20, fontWeight: 800 },
  mSelam: { marginTop: 18, color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,.35)' },
  mSelamYazi: { fontSize: 24, fontWeight: 800, letterSpacing: -0.3 },
  mSelamTarih: { fontSize: 14, opacity: 0.88, marginTop: 4, fontWeight: 500 },
  altNokta: { width: 18, height: 3, borderRadius: 2, background: '#1d4ed8', marginTop: 1 },
  mIcerik: { paddingTop: 14, paddingBottom: 'calc(96px + env(safe-area-inset-bottom))' },
  altMenu: {
    position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 30,
    display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', alignItems: 'start',
    paddingTop: 6, paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)', paddingLeft: 6, paddingRight: 6,
    background: 'rgba(255,255,255,0.94)', borderTop: '1px solid rgba(15,23,42,0.08)', boxSizing: 'border-box',
    boxShadow: '0 -4px 20px rgba(15,23,42,0.06)', backdropFilter: 'saturate(180%) blur(16px)', WebkitBackdropFilter: 'saturate(180%) blur(16px)',
  },
  altBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, height: 50,
    border: 'none', background: 'transparent', color: '#94a3b8', fontSize: 10.5, fontWeight: 600, cursor: 'pointer',
    padding: 0, letterSpacing: 0.1, fontFamily: 'inherit',
  },
  altBtnAktif: { color: '#1d4ed8', fontWeight: 700 },
  artiYer: { display: 'flex', justifyContent: 'center' },
  artiBtn: {
    width: 56, height: 56, marginTop: -20, borderRadius: 18,
    background: 'linear-gradient(145deg,#3b82f6 0%,#1d4ed8 55%,#1e3a8a 100%)', boxShadow: '0 10px 22px rgba(29,78,216,0.38), inset 0 1px 0 rgba(255,255,255,.25)',
    border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, transition: 'transform .2s',
  },
  karartma: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 25 },
  altPanel: {
    position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 28, background: '#f4f7fb', borderRadius: '24px 24px 0 0',
    padding: '10px 16px', paddingBottom: 'calc(104px + env(safe-area-inset-bottom))', maxHeight: '85vh', overflowY: 'auto',
    boxShadow: '0 -8px 30px rgba(0,0,0,0.2)', boxSizing: 'border-box',
  },
  panelTutamac: { width: 40, height: 5, borderRadius: 3, background: '#cbd5e1', margin: '0 auto 14px' },
  grupBaslik: { fontSize: 12, fontWeight: 800, color: '#64748b', letterSpacing: 0.8, textTransform: 'uppercase', margin: '0 4px 6px' },
  grupKutu: { background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 10px rgba(15,45,74,0.06)' },
  menuSatir: {
    display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 12px', border: 'none', background: '#fff',
    fontSize: 15, fontWeight: 600, color: '#0f172a', cursor: 'pointer', fontFamily: 'inherit',
  },
  menuIkon: { width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, flexShrink: 0 },
  profilSatir: {
    display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 16, padding: '12px 14px',
    boxShadow: '0 2px 10px rgba(15,45,74,0.06)',
  },
  profilAvatar: { width: 40, height: 40, borderRadius: '50%', color: '#fff', fontWeight: 800, fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  mCikis: { display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontWeight: 700, borderRadius: 10, padding: '8px 12px', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' },
  artiIzgara: { display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 },
  artiKutu: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 6px', borderRadius: 16,
    border: '1px solid #eef1f5', background: '#fff', color: '#0f172a', fontSize: 14, fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(16,24,40,.04)', fontFamily: 'inherit',
  },
};
