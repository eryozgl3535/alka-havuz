const CSS = `
@keyframes eraiAkis {
  0% { background-position: 0% 50%; }
  100% { background-position: 300% 50%; }
}
@keyframes eraiMaviParilti {
  0%, 100% { filter: drop-shadow(0 0 2px rgba(56,189,248,0.5)); }
  50% { filter: drop-shadow(0 0 7px rgba(56,189,248,1)) drop-shadow(0 0 12px rgba(37,99,235,0.7)); }
}
@keyframes eraiPembeParilti {
  0%, 100% { filter: drop-shadow(0 0 2px rgba(236,72,153,0.5)); }
  50% { filter: drop-shadow(0 0 8px rgba(244,114,182,1)) drop-shadow(0 0 14px rgba(219,39,119,0.7)); }
}
@keyframes eraiNokta {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.25); }
}
`;

const yaziTemel = (boyut) => ({
  fontSize: boyut,
  fontWeight: 800,
  letterSpacing: 2,
  backgroundSize: '300% 100%',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
  WebkitTextFillColor: 'transparent',
  whiteSpace: 'nowrap',
});

const nokta = (renk, gecikme) => ({
  width: 7,
  height: 7,
  borderRadius: '50%',
  background: renk,
  boxShadow: `0 0 8px ${renk}`,
  animation: 'eraiNokta 1.5s ease-in-out infinite',
  animationDelay: gecikme,
  flexShrink: 0,
});

export default function EraiImza({ boyut = 15, noktalar = true }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <style>{CSS}</style>
      {noktalar && <span style={nokta('#22d3ee', '0s')} />}
      <span
        style={{
          ...yaziTemel(boyut),
          background: 'linear-gradient(90deg,#38bdf8,#22d3ee,#3b82f6,#1d4ed8,#38bdf8)',
          animation: 'eraiAkis 3.5s linear infinite, eraiMaviParilti 2s ease-in-out infinite',
        }}
      >
        Built by
      </span>
      <span
        style={{
          ...yaziTemel(boyut),
          fontWeight: 900,
          background: 'linear-gradient(90deg,#f472b6,#ec4899,#f0abfc,#db2777,#f472b6)',
          animation: 'eraiAkis 3s linear infinite, eraiPembeParilti 1.6s ease-in-out infinite',
        }}
      >
        ERAİ
      </span>
      {noktalar && <span style={nokta('#ec4899', '0.75s')} />}
    </span>
  );
}
