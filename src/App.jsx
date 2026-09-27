import EquipmentPage from './pages/EquipmentPage.jsx';

export default function App() {
  return (
    <div style={{ minHeight: '100vh', background: '#eef2f6' }}>
      <header style={{
        background: 'linear-gradient(135deg,#1e5a82,#0f2d4a)',
        color: '#fff',
        padding: '16px 20px',
        fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 1 }}>ALKA TESİSAT</div>
        <div style={{ fontSize: 12, opacity: 0.8 }}>Havuz · Kuyu · Hidrofor · Sulama</div>
      </header>
      <EquipmentPage />
    </div>
  );
}
