const CSS = `
@keyframes eraiKay {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
@keyframes eraiNeonYazi {
  0%, 100% {
    color: #7dd3fc;
    text-shadow: 0 0 2px #e0f2fe, 0 0 6px #38bdf8, 0 0 12px #0ea5e9, 0 0 22px #2563eb;
  }
  50% {
    color: #f9a8d4;
    text-shadow: 0 0 2px #fdf2f8, 0 0 6px #f472b6, 0 0 12px #ec4899, 0 0 22px #db2777;
  }
}
@keyframes eraiNeonCerceve {
  0%, 100% {
    border-color: rgba(56,189,248,0.7);
    box-shadow: 0 0 6px rgba(56,189,248,0.6), inset 0 0 8px rgba(56,189,248,0.35);
  }
  50% {
    border-color: rgba(236,72,153,0.75);
    box-shadow: 0 0 6px rgba(236,72,153,0.6), inset 0 0 8px rgba(236,72,153,0.35);
  }
}
`;

export default function EraiImza({ boyut = 14, genislik }) {
  const panelGenislik = genislik || Math.round(boyut * 15);
  const tekrar = [0, 1, 2, 3];

  const yazi = (anahtar) => (
    <span
      key={anahtar}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        paddingRight: Math.round(boyut * 1.6),
        fontSize: boyut,
        fontWeight: 800,
        letterSpacing: Math.round(boyut * 0.3),
        whiteSpace: 'nowrap',
        animation: 'eraiNeonYazi 4s ease-in-out infinite',
      }}
    >
      BUILT BY&nbsp;&nbsp;ERAİ
      <span style={{ marginLeft: Math.round(boyut * 1.6), opacity: 0.8 }}>✦</span>
    </span>
  );

  return (
    <span
      style={{
        display: 'inline-block',
        width: panelGenislik,
        maxWidth: '100%',
        overflow: 'hidden',
        padding: `${Math.round(boyut * 0.5)}px 0`,
        borderRadius: 10,
        border: '1px solid',
        background: 'radial-gradient(ellipse at center, #111c33 0%, #060b16 100%)',
        animation: 'eraiNeonCerceve 4s ease-in-out infinite',
        WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, #000 12%, #000 88%, transparent 100%)',
        maskImage: 'linear-gradient(90deg, transparent 0%, #000 12%, #000 88%, transparent 100%)',
        verticalAlign: 'middle',
      }}
    >
      <style>{CSS}</style>
      <span
        style={{
          display: 'inline-flex',
          whiteSpace: 'nowrap',
          animation: 'eraiKay 9s linear infinite',
        }}
      >
        {tekrar.map((i) => yazi(`a${i}`))}
        {tekrar.map((i) => yazi(`b${i}`))}
      </span>
    </span>
  );
}
