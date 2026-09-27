const CSS = `
@keyframes eraiRenkAkis {
  0% { background-position: 0% 50%; }
  100% { background-position: -200% 50%; }
}
@keyframes eraiParilti {
  0%, 100% { filter: drop-shadow(0 0 3px rgba(56,189,248,0.75)); }
  50% { filter: drop-shadow(0 0 3px rgba(236,72,153,0.75)); }
}
@keyframes eraiCizgiRenk {
  0%, 100% { background-color: #38bdf8; box-shadow: 0 0 4px #38bdf8; }
  50% { background-color: #ec4899; box-shadow: 0 0 4px #ec4899; }
}
`;

export default function EraiImza({ boyut = 14 }) {
  const cizgi = (yon) => ({
    width: Math.round(boyut * 2.6),
    height: 1.5,
    borderRadius: 2,
    animation: 'eraiCizgiRenk 4s ease-in-out infinite',
    WebkitMaskImage: `linear-gradient(${yon}, transparent, #000)`,
    maskImage: `linear-gradient(${yon}, transparent, #000)`,
  });

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(boyut * 0.8) }}>
      <style>{CSS}</style>

      <span style={cizgi('90deg')} />

      <span
        style={{
          fontSize: boyut,
          fontWeight: 800,
          letterSpacing: Math.round(boyut * 0.35),
          lineHeight: 1.3,
          whiteSpace: 'nowrap',
          display: 'inline-block',
          backgroundImage:
            'linear-gradient(90deg, #1d4ed8 0%, #38bdf8 25%, #ec4899 50%, #f9a8d4 75%, #1d4ed8 100%)',
          backgroundSize: '200% 100%',
          backgroundRepeat: 'repeat',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          color: 'transparent',
          animation: 'eraiRenkAkis 4s linear infinite, eraiParilti 4s ease-in-out infinite',
        }}
      >
        BUILT BY ERAİ
      </span>

      <span style={cizgi('270deg')} />
    </span>
  );
}
