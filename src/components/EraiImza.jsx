export default function EraiImza({ boyut = 14 }) {
  return (
    <span
      style={{
        fontSize: boyut,
        fontWeight: 700,
        letterSpacing: 1,
        whiteSpace: 'nowrap',
        color: '#1d4ed8',
      }}
    >
      Built by <span style={{ fontWeight: 800 }}>ERA</span>
      <span style={{ color: '#db2777', fontWeight: 800 }}>İ</span>
    </span>
  );
}
