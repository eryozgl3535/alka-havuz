const CSS = `
@keyframes eraiAkis {
  0% { background-position: 0% 50%; }
  100% { background-position: -300% 50%; }
}
@keyframes eraiCizgi {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
}
`;

const harfStil = (boyut) => ({
  fontSize: boyut,
  fontWeight: 700,
  letterSpacing: Math.round(boyut * 0.35),
  lineHeight: 1.2,
  backgroundSize: '300% 100%',
  backgroundRepeat: 'repeat',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  color: 'transparent',
  whiteSpace: 'nowrap',
  display: 'inline-block',
});

export default function EraiImza({ boyut = 14 }) {
  const cizgiUzunluk = Math.round(boyut * 2.6);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(boyut * 0.7) }}>
      <style>{CSS}</style>

      <span
        style={{
          width: cizgiUzunluk,
          height: 1.5,
          borderRadius: 2,
          backgroundImage: 'linear-gradient(90deg, rgba(59,130,246,0), #3b82f6)',
          animation: 'eraiCizgi 2.4s ease-in-out infinite',
        }}
      />

      <span
        style={{
          ...harfStil(boyut),
          backgroundImage:
            'linear-gradient(90deg, #1e3a8a 0%, #2563eb 20%, #38bdf8 40%, #2563eb 60%, #1e3a8a 80%, #2563eb 100%)',
          animation: 'eraiAkis 4s linear infinite',
        }}
      >
        BUILT BY
      </span>

      <span
        style={{
          ...harfStil(boyut),
          fontWeight: 800,
          backgroundImage:
            'linear-gradient(90deg, #be185d 0%, #ec4899 20%, #f9a8d4 40%, #ec4899 60%, #be185d 80%, #ec4899 100%)',
          animation: 'eraiAkis 3s linear infinite',
        }}
      >
        ERAİ
      </span>

      <span
        style={{
          width: cizgiUzunluk,
          height: 1.5,
          borderRadius: 2,
          backgroundImage: 'linear-gradient(90deg, #ec4899, rgba(236,72,153,0))',
          animation: 'eraiCizgi 2.4s ease-in-out infinite',
          animationDelay: '1.2s',
        }}
      />
    </span>
  );
}
