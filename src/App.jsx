import { useEffect, useState } from 'react';
import DashboardPage from './pages/DashboardPage.jsx';
import CustomersPage from './pages/CustomersPage.jsx';
import EquipmentPage from './pages/EquipmentPage.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import WorkOrdersPage from './pages/WorkOrdersPage.jsx';

const MENU = [
  { id: 'anasayfa', ad: 'Ana Sayfa', ikon: '🏠' },
  { id: 'musteriler', ad: 'Müşteriler', ikon: '👥' },
  { id: 'takvim', ad: 'Bakım Takvimi', ikon: '📅' },
  { id: 'isemirleri', ad: 'İş Emirleri', ikon: '📋' },
  { id: 'ekipman', ad: 'Ekipmanlar', ikon: '🛠️' },
  { id: 'raporlar', ad: 'Raporlar', ikon: '📊', yakinda: true },
  { id: 'ayarlar', ad: 'Ayarlar', ikon: '⚙️', yakinda: true },
];

export default function App() {
  const [sayfa, setSayfa] = useState('anasayfa');
  const [genis, setGenis] = useState(window.innerWidth >= 900);
  const [menuAcik, setMenuAcik] = useState(false);

  useEffect(() => {
    const f = () => setGenis(window.innerWidth >= 900);
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);

  function git(id) {
    setSayfa(id);
    setMenuAcik(false);
    window.scrollTo(0, 0);
  }

  const menuGorunur = genis || menuAcik;

  return (
    <div style={s.kok}>
      {!genis && (
        <div style={s.mobilUst}>
          <button style={s.hamburger} onClick={() => setMenuAcik(!menuAcik)}>☰</button>
          <img src="/logopng.jpg" alt="ALKA" style={{ height: 44, borderRadius: 8 }} />
          <div style={{ width: 44 }} />
        </div>
      )}

      {menuGorunur && (
        <aside style={{ ...s.yan, ...(genis ? {} : s.yanMobil) }}>
          <div style={s.logoAlan}>
            <img src="/logopng.jpg" alt="ALKA Havuz" style={s.logo} />
          </div>
          <nav>
            {MENU.map((m) => {
              const aktif = sayfa === m.id;
              return (
                <button
                  key={m.id}
                  disabled={m.yakinda}
                  onClick={() => git(m.id)}
                  style={{ ...s.menuBtn, ...(aktif ? s.menuAktif : {}), ...(m.yakinda ? s.menuPasif : {}) }}
                >
                  <span style={{ fontSize: 20 }}>{m.ikon}</span>
                  <span>{m.ad}</span>
                  {m.yakinda && <span style={s.yakinda}>yakında</span>}
                </button>
              );
            })}
          </nav>
        </aside>
      )}

      {!genis && menuAcik && <div style={s.karartma} onClick={() => setMenuAcik(false)} />}

      <main style={{ ...s.icerik, marginLeft: genis ? 260 : 0 }}>
        {sayfa === 'anasayfa' && <DashboardPage onNavigate={git} />}
        {sayfa === 'musteriler' && <CustomersPage />}
        {sayfa === 'takvim' && <CalendarPage />}
        {sayfa === 'isemirleri' && <WorkOrdersPage />}
        {sayfa === 'ekipman' && <EquipmentPage />}
      </main>
    </div>
  );
}

const s = {
  kok: { minHeight: '100vh', background: '#f1f5fb', fontFamily: 'system-ui, sans-serif' },
  yan: {
    position: 'fixed', top: 0, left: 0, bottom: 0, width: 260, zIndex: 20,
    background: 'linear-gradient(180deg,#0f2d4a 0%,#0b2440 60%,#082038 100%)',
    padding: '20px 16px', boxSizing: 'border-box', overflowY: 'auto',
  },
  yanMobil: { boxShadow: '4px 0 24px rgba(0,0,0,0.3)' },
  logoAlan: { display: 'flex', justifyContent: 'center', marginBottom: 24 },
  logo: { width: 180, height: 180, borderRadius: 20, objectFit: 'cover' },
  menuBtn: {
    display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '14px 16px',
    marginBottom: 6, border: 'none', borderRadius: 12, background: 'transparent',
    color: '#e2e8f0', fontSize: 16, fontWeight: 500, cursor: 'pointer', textAlign: 'left',
  },
  menuAktif: { background: '#1d6fe0', color: '#fff', fontWeight: 700 },
  menuPasif: { opacity: 0.45, cursor: 'default' },
  yakinda: { marginLeft: 'auto', fontSize: 10, background: 'rgba(255,255,255,0.15)', padding: '2px 6px', borderRadius: 6 },
  icerik: { minHeight: '100vh' },
  mobilUst: {
    position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#0f2d4a', padding: '8px 12px',
  },
  hamburger: { width: 44, height: 44, border: 'none', borderRadius: 10, background: 'rgba(255,255,255,0.12)',
    color: '#fff', fontSize: 22, cursor: 'pointer' },
  karartma: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 15 },
};
