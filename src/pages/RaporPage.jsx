import { useEffect, useState } from 'react';
import EraiImza from '../components/EraiImza.jsx';

const FIRMA_TEL = '0533 371 39 35';
const FIRMA_WA = '905333713935';

const trTarih = (t) => (t ? new Date(t.length <= 10 ? t + 'T00:00:00' : t).toLocaleDateString('tr-TR', {
  day: 'numeric', month: 'long', year: 'numeric',
}) : '-');

const BASKI_CSS = `
@media print {
  .rapor-gizle { display: none !important; }
  body { background: #fff !important; }
  .rapor-kart { box-shadow: none !important; border: 1px solid #e2e8f0 !important; }
  .rapor-foto { break-inside: avoid; }
}
`;

function FotoGrup({ baslik, liste, renk, onAc }) {
  if (!liste.length) return null;
  return (
    <div style={{ flex: 1, minWidth: 260 }}>
      <div style={{ ...s.fotoBaslik, color: renk, borderColor: renk }}>{baslik}</div>
      <div style={s.fotoIzgara}>
        {liste.map((f, i) => (
          <img
            key={i}
            src={f.url}
            alt={baslik}
            className="rapor-foto"
            style={s.foto}
            onClick={() => onAc(f.url)}
            loading="lazy"
          />
        ))}
      </div>
    </div>
  );
}

export default function RaporPage({ token }) {
  const [rapor, setRapor] = useState(null);
  const [hata, setHata] = useState('');
  const [buyuk, setBuyuk] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const y = await fetch(`/api/rapor?t=${encodeURIComponent(token)}`);
        const v = await y.json();
        if (!y.ok) throw new Error(v.hata || 'Rapor açılamadı.');
        setRapor(v.rapor);
      } catch (e) {
        setHata(e.message);
      }
    })();
  }, [token]);

  if (hata) {
    return (
      <div style={s.zemin}>
        <div style={{ ...s.kart, textAlign: 'center' }}>
          <img src="/logopng.jpg" alt="ALKA Havuz" style={s.kucukLogo} />
          <h2 style={{ color: '#0b2a4a' }}>Rapor bulunamadı</h2>
          <p style={s.soluk}>{hata}</p>
          <p style={s.soluk}>Bilgi için: {FIRMA_TEL}</p>
        </div>
      </div>
    );
  }

  if (!rapor) {
    return <div style={{ ...s.zemin, color: '#fff', fontSize: 18 }}>Rapor yükleniyor...</div>;
  }

  const oncesi = rapor.fotograflar.filter((f) => f.tur === 'oncesi');
  const sonrasi = rapor.fotograflar.filter((f) => f.tur === 'sonrasi');
  const diger = rapor.fotograflar.filter((f) => f.tur !== 'oncesi' && f.tur !== 'sonrasi');
  const tamam = rapor.durum === 'tamamlandi';
  const tarih = rapor.tamamlanan || rapor.planlanan || rapor.olusturma;
  const c = rapor.cihaz;

  return (
    <div style={s.zemin}>
      <style>{BASKI_CSS}</style>
      <div style={s.sayfa}>
        <div className="rapor-kart" style={s.ust}>
          <img src="/logopng.jpg" alt="ALKA Havuz" style={s.logo} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={s.ustEtiket}>SERVİS RAPORU</div>
            <h1 style={s.baslik}>{rapor.baslik}</h1>
            <div style={s.soluk}>
              No: <b>IS-{String(rapor.no).padStart(4, '0')}</b> · {trTarih(tarih)}
            </div>
            <span style={{ ...s.durum, ...(tamam ? s.durumTamam : s.durumDevam) }}>
              {tamam ? '✓ İş tamamlandı' : '⏳ İş devam ediyor'}
            </span>
          </div>
        </div>

        <div className="rapor-kart" style={s.kart}>
          <div style={s.izgara}>
            {rapor.musteri && (
              <div>
                <div style={s.etiket}>Müşteri</div>
                <div style={s.deger}>{rapor.musteri.ad}</div>
                {rapor.musteri.adres && <div style={s.soluk}>📍 {rapor.musteri.adres}</div>}
              </div>
            )}
            {c && (
              <div>
                <div style={s.etiket}>Sistem / cihaz</div>
                <div style={s.deger}>{c.kategori} · {c.tur}</div>
                {(c.marka || c.model) && <div style={s.soluk}>{[c.marka, c.model].filter(Boolean).join(' · ')}</div>}
                {c.konum && <div style={s.soluk}>Konum: {c.konum}</div>}
              </div>
            )}
            {rapor.personel && (
              <div>
                <div style={s.etiket}>İşi yapan</div>
                <div style={s.deger}>{rapor.personel}</div>
              </div>
            )}
          </div>
        </div>

        {(rapor.yapilanlar || rapor.aciklama) && (
          <div className="rapor-kart" style={s.kart}>
            <h2 style={s.bolum}>🛠️ Yapılan işlemler</h2>
            <p style={s.metin}>{rapor.yapilanlar || rapor.aciklama}</p>
          </div>
        )}

        {rapor.malzemeler.length > 0 && (
          <div className="rapor-kart" style={s.kart}>
            <h2 style={s.bolum}>🔩 Kullanılan malzemeler</h2>
            {rapor.malzemeler.map((m, i) => (
              <div key={i} style={s.malzemeSatir}>
                <span>{m.ad}</span>
                <b>{m.adet} adet</b>
              </div>
            ))}
          </div>
        )}

        {rapor.fotograflar.length > 0 && (
          <div className="rapor-kart" style={s.kart}>
            <h2 style={s.bolum}>📷 Fotoğraflar</h2>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
              <FotoGrup baslik="İŞLEM ÖNCESİ" liste={oncesi} renk="#b45309" onAc={setBuyuk} />
              <FotoGrup baslik="İŞLEM SONRASI" liste={sonrasi} renk="#15803d" onAc={setBuyuk} />
            </div>
            {diger.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <FotoGrup baslik="DİĞER" liste={diger} renk="#1d4ed8" onAc={setBuyuk} />
              </div>
            )}
          </div>
        )}

        {rapor.sonrakiBakimlar.length > 0 && (
          <div className="rapor-kart" style={{ ...s.kart, background: 'linear-gradient(135deg,#eff6ff,#e0f2fe)' }}>
            <h2 style={s.bolum}>📅 Sonraki bakımlarınız</h2>
            {rapor.sonrakiBakimlar.map((b, i) => (
              <div key={i} style={s.malzemeSatir}>
                <span>{b.ad}</span>
                <b style={{ color: '#1d4ed8' }}>{trTarih(b.tarih)}</b>
              </div>
            ))}
            <p style={{ ...s.soluk, marginTop: 10 }}>Tarih yaklaştığında sizi hatırlatacağız.</p>
          </div>
        )}

        <div className="rapor-kart" style={{ ...s.kart, textAlign: 'center' }}>
          <div style={{ ...s.deger, marginBottom: 12 }}>Sorunuz ya da yeni bir talebiniz mi var?</div>
          <div className="rapor-gizle" style={s.butonlar}>
            <a href={`tel:${FIRMA_TEL.replace(/\s/g, '')}`} style={s.araBtn}>📞 Bizi arayın</a>
            <a href={`https://wa.me/${FIRMA_WA}`} target="_blank" rel="noreferrer" style={s.waBtn}>💬 WhatsApp</a>
            <button style={s.pdfBtn} onClick={() => window.print()}>📄 PDF olarak kaydet</button>
          </div>
          <div style={{ ...s.soluk, marginTop: 14 }}>ALKA Havuz · Volkan Gülcemal · {FIRMA_TEL}</div>
          <div style={{ marginTop: 10 }}><EraiImza boyut={12} /></div>
        </div>
      </div>

      {buyuk && (
        <div className="rapor-gizle" style={s.buyukArka} onClick={() => setBuyuk('')}>
          <img src={buyuk} alt="Büyük fotoğraf" style={s.buyukFoto} />
          <div style={s.kapatYazi}>Kapatmak için dokunun</div>
        </div>
      )}
    </div>
  );
}

const s = {
  zemin: {
    minHeight: '100vh', background: 'linear-gradient(160deg,#0b2a4a 0%,#1e5a82 45%,#e8f1fb 45%,#f1f5fb 100%)',
    fontFamily: 'system-ui, sans-serif', padding: '24px 14px', boxSizing: 'border-box',
    display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
  },
  sayfa: { width: '100%', maxWidth: 820 },
  ust: {
    display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', background: '#fff', borderRadius: 20,
    padding: 22, marginBottom: 14, boxShadow: '0 10px 30px rgba(11,42,74,0.25)',
  },
  logo: { width: 110, height: 110, borderRadius: 18, objectFit: 'cover', flexShrink: 0 },
  kucukLogo: { width: 90, height: 90, borderRadius: 16, objectFit: 'cover' },
  ustEtiket: { fontSize: 12, letterSpacing: 3, color: '#1d6fe0', fontWeight: 800 },
  baslik: { margin: '4px 0 6px', fontSize: 26, color: '#0b2a4a', lineHeight: 1.2 },
  durum: { display: 'inline-block', marginTop: 10, padding: '6px 12px', borderRadius: 20, fontSize: 13, fontWeight: 700 },
  durumTamam: { background: '#dcfce7', color: '#15803d' },
  durumDevam: { background: '#fef3c7', color: '#b45309' },
  kart: { background: '#fff', borderRadius: 18, padding: 20, marginBottom: 14, boxShadow: '0 4px 16px rgba(11,42,74,0.08)' },
  izgara: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 },
  etiket: { fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 },
  deger: { fontSize: 16, fontWeight: 700, color: '#0b2a4a', marginTop: 4 },
  soluk: { fontSize: 14, color: '#64748b', marginTop: 3 },
  bolum: { margin: '0 0 12px', fontSize: 18, color: '#0b2a4a' },
  metin: { margin: 0, fontSize: 15, color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap' },
  malzemeSatir: {
    display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderTop: '1px solid #eef2f6',
    fontSize: 15, color: '#334155',
  },
  fotoBaslik: { fontSize: 13, fontWeight: 800, letterSpacing: 2, borderBottom: '2px solid', paddingBottom: 6, marginBottom: 10 },
  fotoIzgara: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 8 },
  foto: { width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 10, cursor: 'zoom-in', background: '#eef2f6' },
  butonlar: { display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' },
  araBtn: { background: '#1d6fe0', color: '#fff', borderRadius: 12, padding: '12px 18px', textDecoration: 'none', fontWeight: 700 },
  waBtn: { background: '#16a34a', color: '#fff', borderRadius: 12, padding: '12px 18px', textDecoration: 'none', fontWeight: 700 },
  pdfBtn: { background: '#fff', color: '#0b2a4a', border: '1px solid #cbd5e1', borderRadius: 12, padding: '12px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 15 },
  buyukArka: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 50, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', padding: 16, cursor: 'zoom-out',
  },
  buyukFoto: { maxWidth: '100%', maxHeight: '85vh', borderRadius: 12 },
  kapatYazi: { color: '#cbd5e1', marginTop: 12, fontSize: 14 },
};
