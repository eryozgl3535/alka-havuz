import EquipmentPage from './pages/EquipmentPage.jsx';

export default function App() {
  return (
    <div style={{ minHeight: '100vh', background: '#eef2f6' }}>
      <header
        style={{
          background: 'linear-gradient(135deg,#1e5a82,#0f2d4a)',
          color: '#fff',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <img
          src="/logopng.jpg"
          alt="ALKA Havuz"
          style={{ height: 56, width: 56, borderRadius: 12, objectFit: 'cover' }}
        />
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 1 }}>ALKA HAVUZ</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Havuz · Kuyu · Hidrofor · Sulama</div>
        </div>
      </header>
      <EquipmentPage />
    </div>
  );
}
