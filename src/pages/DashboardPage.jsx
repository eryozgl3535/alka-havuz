import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { FIRMA } from '../firma';

const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const KATEGORI_IKON = { Havuz: '🏊', Kuyu: '💧', Hidrofor: '🔵', Sulama: '🌱', Tesisat: '🔧', Elektrik: '⚡' };
const HIZLI_ANAHTAR = 'alkaHizliIslemler1';

const yerel = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function kalanGun(tarih) {
  if (!tarih) return null;
  const hedef = new Date(tarih + 'T00:00:00');
  const bugun = new Date(yerel(new Date()) + 'T00:00:00');
  return Math.round((hedef - bugun) / 86400000);
}

function trTarih(t) {
  if (!t) return '-';
  const d = new Date(t + 'T00:00:00');
  return `${d.getDate()} ${AYLAR[d.getMonth()]} ${d.getFullYear()}`;
}

function kalanYazi(g) {
  if (g === null) return { yazi: '-', renk: '#94a3b8' };
  if (g < 0) return { yazi: `${-g} gün gecikti`, renk: '#dc2626' };
  if (g === 0) return { yazi: 'Bugün', renk: '#ea580c' };
  if (g <= 7) return { yazi: `${g} gün kaldı`, renk: '#f59e0b' };
  return { yazi: `${g} gün kaldı`, renk: '#1d6fe0' };
}

function havaBilgi(kod) {
  if (kod === 0) return { ikon: '☀️', ad: 'Açık' };
  if (kod <= 2) return { ikon: '🌤️', ad: 'Az bulutlu' };
  if (kod === 3) return { ikon: '☁️', ad: 'Bulutlu' };
  if (kod <= 48) return { ikon: '🌫️', ad: 'Sisli' };
  if (kod <= 67 || (kod >= 80 && kod <= 82)) return { ikon: '🌧️', ad: 'Yağmurlu' };
  if (kod <= 77 || kod === 85 || kod === 86) return { ikon: '🌨️', ad: 'Karlı' };
  return { ikon: '⛈️', ad: 'Fırtınalı' };
}

// ---- Simgeler ----
function Svg({ children, boyut = 26 }) {
  return <svg width={boyut} height={boyut} viewBox="0 0 24 24" style={{ display: 'block' }}>{children}</svg>;
}
const cizgi = (renk, k = 2) => ({ fill: 'none', stroke: renk, strokeWidth: k, strokeLinecap: 'round', strokeLinejoin: 'round' });

const SIMGE = {
  pano: (r) => <Svg><rect x="5" y="4" width="14" height="17" rx="2.5" fill={r} /><rect x="9" y="2.5" width="6" height="3.5" rx="1.2" fill={r} stroke="#fff" strokeWidth="1.2" /><path d="M8.5 11h7M8.5 14.5h7M8.5 18h4" {...cizgi('#fff', 1.8)} /></Svg>,
  kumSaati: (r) => <Svg><path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9" {...cizgi(r, 2.2)} /><path d="M9.5 18.5h5l-2.5-3z" fill={r} /></Svg>,
  tik: (r) => <Svg><path d="m4.5 12.5 5 5 10-11" {...cizgi(r, 3)} /></Svg>,
  kisiler: (r) => <Svg><circle cx="12" cy="8" r="3.2" fill={r} /><path d="M5.5 19c.5-3.5 3.2-5.3 6.5-5.3s6 1.8 6.5 5.3z" fill={r} /><circle cx="5.5" cy="9.5" r="2.3" fill={r} /><circle cx="18.5" cy="9.5" r="2.3" fill={r} /><path d="M1.5 18c.3-2.3 1.8-3.6 4-3.8M22.5 18c-.3-2.3-1.8-3.6-4-3.8" {...cizgi(r, 2.2)} /></Svg>,
  kisiEkle: (r) => <Svg><circle cx="10" cy="8" r="4" fill={r} /><path d="M2.5 20.5c.6-4.2 3.6-6.3 7.5-6.3 1.6 0 3 .3 4.2 1" fill={r} /><path d="M18.5 13v7M15 16.5h7" {...cizgi(r, 2.4)} /></Svg>,
  artiKare: (r) => <Svg><rect x="3" y="3" width="18" height="18" rx="4" fill={r} /><path d="M12 7.5v9M7.5 12h9" {...cizgi('#fff', 2.6)} /></Svg>,
  takvim: (r) => <Svg><rect x="3.5" y="5" width="17" height="15.5" rx="3" {...cizgi(r, 2.2)} /><path d="M3.5 10h17M8 3v4M16 3v4" {...cizgi(r, 2.2)} /></Svg>,
  gelis: (r) => <Svg><rect x="2.5" y="5" width="15" height="14" rx="2.5" {...cizgi(r, 2)} /><path d="M2.5 9.5h15M6.5 3v4M13.5 3v4" {...cizgi(r, 2)} /><circle cx="17" cy="17" r="5" fill="#fff" stroke={r} strokeWidth="2" /><path d="M17 14.8V17l1.5 1" {...cizgi(r, 1.8)} /></Svg>,
  grafik: (r) => <Svg><rect x="4" y="12" width="4" height="9" rx="1.3" fill={r} /><rect x="10" y="4" width="4" height="17" rx="1.3" fill={r} /><rect x="16" y="9" width="4" height="12" rx="1.3" fill={r} /></Svg>,
  ayar: (r) => <Svg><path d="M12 2.5l2 2.2 2.9-.6.9 2.8 2.8.9-.6 2.9 2.2 2-2.2 2 .6 2.9-2.8.9-.9 2.8-2.9-.6-2 2.2-2-2.2-2.9.6-.9-2.8-2.8-.9.6-2.9L1.8 12.7l2.2-2-.6-2.9 2.8-.9.9-2.8 2.9.6z" fill={r} /><circle cx="12" cy="12" r="3.3" fill="#fff" /></Svg>,
  mesaj: (r) => <Svg><path d="M4 4h16a1.5 1.5 0 0 1 1.5 1.5v10A1.5 1.5 0 0 1 20 17H9l-5 4v-4H4a1.5 1.5 0 0 1-1.5-1.5v-10A1.5 1.5 0 0 1 4 4z" fill={r} /><path d="M7 9h10M7 12.5h6" {...cizgi('#fff', 1.8)} /></Svg>,
  rehber: (r) => <Svg><rect x="4" y="2.5" width="15" height="19" rx="2.5" fill={r} /><circle cx="11.5" cy="9.5" r="2.6" fill="#fff" /><path d="M7.5 17c.4-2.3 1.9-3.5 4-3.5s3.6 1.2 4 3.5" fill="#fff" /><path d="M21 6v3M21 12v3" {...cizgi(r, 2)} /></Svg>,
  konum: (r) => <Svg boyut={16}><path d="M12 22s7-6.3 7-12a7 7 0 1 0-14 0c0 5.7 7 12 7 12z" fill={r} /><circle cx="12" cy="10" r="2.6" fill="#fff" /></Svg>,
  ok: (r) => <Svg boyut={20}><path d="m9 6 6 6-6 6" {...cizgi(r, 2.4)} /></Svg>,
  kalem: (r) => <Svg boyut={18}><path d="M4 20h4L19 9l-4-4L4 16z" {...cizgi(r, 2)} /></Svg>,
  takvimKucuk: (r) => <Svg boyut={16}><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" {...cizgi(r, 2)} /><path d="M3.5 10h17M8 3v4M16 3v4" {...cizgi(r, 2)} /></Svg>,
};

const TUM_HIZLI = [
  { id: 'yeniMusteri', hedef: 'musteriler', ad: 'Yeni Müşteri', simge: 'kisiEkle', renk: '#1d6fe0', zemin: '#e8f1ff' },
  { id: 'yeniIs', hedef: 'isemirleri', ad: 'Yeni İş Kaydı', simge: 'artiKare', renk: '#16a34a', zemin: '#e7f8ee' },
  { id: 'isEmirleri', hedef: 'isemirleri', ad: 'İş Emirleri', simge: 'pano', renk: '#f97316', zemin: '#fdecea' },
  { id: 'takvim', hedef: 'takvim', ad: 'Bakım Takvimi', simge: 'takvim', renk: '#7c3aed', zemin: '#f1eafe', yaziRenk: '#6d28d9' },
  { id: 'musteriler', hedef: 'musteriler', ad: 'Müşteriler', simge: 'kisiler', renk: '#1d6fe0', zemin: '#ecf3fb' },
  { id: 'gelisler', hedef: 'gelisler', ad: 'Geliş Planı', simge: 'gelis', renk: '#0e7490', zemin: '#e8f4f4' },
  { id: 'raporlar', hedef: 'raporlar', ad: 'Raporlar', simge: 'grafik', renk: '#1d6fe0', zemin: '#ecf3fb' },
  { id: 'ayarlar', hedef: 'ayarlar', ad: 'Ayarlar', simge: 'ayar', renk: '#475569', zemin: '#eef1f5' },
  { id: 'toplumesaj', hedef: 'toplumesaj', ad: 'Toplu Mesaj', simge: 'mesaj', renk: '#0891b2', zemin: '#e6f6fa' },
  { id: 'rehber', hedef: 'rehber', ad: 'Rehberden Aktar', simge: 'rehber', renk: '#db2777', zemin: '#fdeef5' },
];
const VARSAYILAN_HIZLI = ['yeniMusteri', 'yeniIs', 'isEmirleri', 'takvim', 'musteriler', 'gelisler', 'raporlar', 'ayarlar'];

function hizliOku() {
  try {
    const v = JSON.parse(localStorage.getItem(HIZLI_ANAHTAR) || 'null');
    if (Array.isArray(v) && v.length) return v.filter((id) => TUM_HIZLI.some((h) => h.id === id));
  } catch { /* yoksay */ }
  return VARSAYILAN_HIZLI;
}

export default function DashboardPage({ onNavigate }) {
  const [kurallar, setKurallar] = useState([]);
  const [bugunIsler, setBugunIsler] = useState([]);
  const [tamamlanan, setTamamlanan] = useState(0);
  const [musteriSayi, setMusteriSayi] = useState(0);
  const [hava, setHava] = useState(null);
  const [hizli, setHizli] = useState(hizliOku);
  const [duzenle, setDuzenle] = useState(false);

  const git = (id) => onNavigate && onNavigate(id);

  useEffect(() => {
    (async () => {
      const bugun = new Date();
      const bugunStr = yerel(bugun);
      const ayBas = yerel(new Date(bugun.getFullYear(), bugun.getMonth(), 1));
      const [k, b, t, m] = await Promise.all([
        supabase.from('maintenance_rules').select('*, equipment(category, equipment_type, customers(name, address))'),
        supabase.from('work_orders').select('id, title, status, customers(name)').eq('scheduled_date', bugunStr).neq('status', 'tamamlandi'),
        supabase.from('work_orders').select('id', { count: 'exact', head: true }).eq('status', 'tamamlandi').gte('completed_date', ayBas),
        supabase.from('customers').select('id', { count: 'exact', head: true }),
      ]);
      setKurallar((k.data || []).filter((x) => x.active !== false && x.next_due_date));
      setBugunIsler(b.data || []);
      setTamamlanan(t.count || 0);
      setMusteriSayi(m.count || 0);
    })();

    const enlem = FIRMA.enlem || 38.3236;
    const boylam = FIRMA.boylam || 26.3058;
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${enlem}&longitude=${boylam}&current=temperature_2m,weather_code&timezone=auto`)
      .then((r) => r.json())
      .then((d) => d?.current && setHava({ derece: Math.round(d.current.temperature_2m), ...havaBilgi(d.current.weather_code) }))
      .catch(() => {});
  }, []);

  function hizliDegis(id) {
    const yeni = hizli.includes(id) ? hizli.filter((x) => x !== id) : [...hizli, id];
    if (yeni.length === 0) return;
    setHizli(yeni);
    try { localStorage.setItem(HIZLI_ANAHTAR, JSON.stringify(yeni)); } catch { /* yoksay */ }
  }

  const gecikmis = kurallar.filter((k) => kalanGun(k.next_due_date) < 0).length;
  const yaklasan = kurallar.filter((k) => { const g = kalanGun(k.next_due_date); return g >= 0 && g <= 30; }).length;
  const liste = [...kurallar].sort((a, b) => a.next_due_date.localeCompare(b.next_due_date)).slice(0, 5);

  const istatistik = [
    { ad: 'Bakımı Geçmiş', sayi: gecikmis, simge: 'pano', renk: '#dc2626', ikonZemin: '#fecaca', zemin: '#fdecec', kenar: '#fbd5d5', hedef: 'takvim' },
    { ad: 'Yaklaşan Bakım', sayi: yaklasan, simge: 'kumSaati', renk: '#f59e0b', ikonZemin: '#fde9c4', zemin: '#fff8e8', kenar: '#fbeccb', hedef: 'takvim' },
    { ad: 'Bu Ay Tamamlanan', sayi: tamamlanan, simge: 'tik', renk: '#16a34a', ikonZemin: '#c9f0d7', zemin: '#eaf9f0', kenar: '#d3f1de', hedef: 'isemirleri' },
    { ad: 'Toplam Müşteri', sayi: musteriSayi, simge: 'kisiler', renk: '#1d6fe0', ikonZemin: '#d6e6ff', zemin: '#eef4fd', kenar: '#dbe7f7', hedef: 'musteriler' },
  ];

  const gorunenHizli = duzenle ? TUM_HIZLI : hizli.map((id) => TUM_HIZLI.find((h) => h.id === id)).filter(Boolean);
  const isSayi = bugunIsler.length;

  return (
    <div style={s.sayfa}>
      {/* Bugün kartı */}
      <section style={s.bugunKart}>
        <div style={s.bugunFoto} />
        <div style={s.bugunSol}>
          <div style={s.bugunEtiket}>Bugün</div>
          <div style={s.bugunSatir}>
            <span style={s.bugunSayi}>{isSayi}</span>
            <span style={s.bugunBirim}>iş emri</span>
          </div>
          <div style={s.bugunAlt}>
            {isSayi === 0
              ? 'Planlanan işiniz bulunmuyor.'
              : bugunIsler.slice(0, 2).map((x) => x.customers?.name || x.title).filter(Boolean).join(', ') + (isSayi > 2 ? ` +${isSayi - 2}` : '')}
          </div>
          <button style={s.yeniIsBtn} onClick={() => git('isemirleri')}>
            {isSayi === 0 ? '＋ Yeni İş Ekle' : 'İşleri Gör ›'}
          </button>
        </div>
        {hava && (
          <div style={s.havaCip}>
            <span style={{ fontSize: 30, lineHeight: 1 }}>{hava.ikon}</span>
            <div>
              <div style={s.havaDerece}>{hava.derece}°C</div>
              <div style={s.havaSehir}>{FIRMA.sehir || 'Çeşme'}</div>
            </div>
          </div>
        )}
      </section>

      {/* Özet kartları */}
      <div style={s.istIzgara}>
        {istatistik.map((k) => (
          <button key={k.ad} style={{ ...s.istKart, background: k.zemin, borderColor: k.kenar }} onClick={() => git(k.hedef)}>
            <div style={{ ...s.istIkon, background: k.ikonZemin }}>{SIMGE[k.simge](k.renk)}</div>
            <div style={s.istSayi}>{k.sayi}</div>
            <div style={s.istAd}>{k.ad}</div>
          </button>
        ))}
      </div>

      {/* Hızlı İşlemler */}
      <section style={s.kutu}>
        <div style={s.kutuUst}>
          <h2 style={s.kutuBaslik}>Hızlı İşlemler</h2>
          <button style={s.linkBtn} onClick={() => setDuzenle(!duzenle)}>
            {duzenle ? 'Bitti ✓' : <>Düzenle {SIMGE.kalem('#1d6fe0')}</>}
          </button>
        </div>
        {duzenle && <div style={s.ipucu}>Ana sayfada görmek istediğin kutulara dokunarak seç.</div>}
        <div style={s.hizliIzgara}>
          {gorunenHizli.map((h) => {
            const secili = hizli.includes(h.id);
            return (
              <button
                key={h.id}
                style={{ ...s.hizliBtn, background: h.zemin, ...(duzenle && !secili ? { opacity: 0.4 } : {}),
                  ...(duzenle && secili ? { boxShadow: '0 0 0 2px #1d6fe0' } : {}) }}
                onClick={() => (duzenle ? hizliDegis(h.id) : git(h.hedef))}
              >
                {SIMGE[h.simge](h.renk)}
                <span style={{ ...s.hizliAd, ...(h.yaziRenk ? { color: h.yaziRenk } : {}) }}>{h.ad}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Yaklaşan Bakımlar */}
      <section style={s.kutu}>
        <div style={s.kutuUst}>
          <h2 style={s.kutuBaslik}>Yaklaşan Bakımlar</h2>
          <button style={s.linkBtn} onClick={() => git('takvim')}>Tümünü Gör {SIMGE.ok('#1d6fe0')}</button>
        </div>
        {liste.length === 0 && <div style={s.bos}>Takipte bakım yok. Müşteri kartından cihaz ve bakım ekleyebilirsin.</div>}
        {liste.map((k) => {
          const e = k.equipment || {};
          const m = e.customers || {};
          const kalan = kalanYazi(kalanGun(k.next_due_date));
          return (
            <button key={k.id} style={s.bakimSatir} onClick={() => git('takvim')}>
              <div style={s.bakimResim}>
                <span style={{ fontSize: 26 }}>{KATEGORI_IKON[e.category] || '🛠️'}</span>
              </div>
              <div style={s.bakimOrta}>
                <div style={s.bakimAd}>{m.name || 'Müşteri'}</div>
                <div style={s.bakimKonum}>
                  {SIMGE.konum('#94a3b8')}
                  <span style={s.tekSatir}>{m.address || k.rule_name}</span>
                </div>
              </div>
              <div style={s.bakimSag}>
                <div style={s.bakimTarih}>{SIMGE.takvimKucuk('#94a3b8')}<span>{trTarih(k.next_due_date)}</span></div>
                <div style={{ ...s.bakimKalan, color: kalan.renk }}>{kalan.yazi}</div>
              </div>
              {SIMGE.ok('#334155')}
            </button>
          );
        })}
      </section>
    </div>
  );
}

const kartGolge = '0 4px 18px rgba(15,45,74,0.07)';

const s = {
  sayfa: { padding: '4px 14px 20px', maxWidth: 900, margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' },
  bugunKart: {
    position: 'relative', overflow: 'hidden', borderRadius: 24, minHeight: 190, background: '#fff',
    boxShadow: '0 8px 26px rgba(15,45,74,0.12)', border: '2px solid #fff', marginBottom: 14,
  },
  bugunFoto: {
    position: 'absolute', top: 0, right: 0, bottom: 0, width: '68%',
    background: 'url(/hero.jpg) center / cover no-repeat, linear-gradient(160deg,#7cc4ef 0%,#3b9fe0 45%,#22c3d6 100%)',
    WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, #000 45%)',
    maskImage: 'linear-gradient(90deg, transparent 0%, #000 45%)',
  },
  bugunSol: { position: 'relative', padding: '20px 20px 18px', maxWidth: '62%' },
  bugunEtiket: { fontSize: 17, fontWeight: 700, color: '#334155' },
  bugunSatir: { display: 'flex', alignItems: 'baseline', gap: 14 },
  bugunSayi: { fontSize: 62, fontWeight: 900, color: '#0b1730', lineHeight: 1.05 },
  bugunBirim: { fontSize: 20, fontWeight: 800, color: '#0b1730' },
  bugunAlt: { fontSize: 14, color: '#475569', margin: '6px 0 12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  yeniIsBtn: {
    border: 'none', background: '#dbe9fd', color: '#0b1730', fontWeight: 800, fontSize: 15, borderRadius: 12,
    padding: '10px 18px', cursor: 'pointer',
  },
  havaCip: {
    position: 'absolute', top: 14, right: 14, display: 'flex', alignItems: 'center', gap: 8,
    background: 'rgba(15,23,42,0.72)', color: '#fff', borderRadius: 26, padding: '8px 16px 8px 12px',
    border: '1.5px solid rgba(255,255,255,0.7)', backdropFilter: 'blur(6px)',
  },
  havaDerece: { fontSize: 18, fontWeight: 800, lineHeight: 1.1 },
  havaSehir: { fontSize: 12, opacity: 0.9 },
  istIzgara: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 },
  istKart: {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, padding: '12px 10px',
    borderRadius: 18, border: '1.5px solid', cursor: 'pointer', textAlign: 'left', minWidth: 0,
    boxShadow: kartGolge,
  },
  istIkon: { width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  istSayi: { fontSize: 26, fontWeight: 900, color: '#0b1730', lineHeight: 1 },
  istAd: { fontSize: 11.5, color: '#334155', lineHeight: 1.2 },
  kutu: { background: '#fff', borderRadius: 22, padding: '16px 14px', marginBottom: 14, boxShadow: kartGolge },
  kutuUst: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '0 4px' },
  kutuBaslik: { margin: 0, fontSize: 19, fontWeight: 800, color: '#0b1730' },
  linkBtn: {
    display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', color: '#1d6fe0',
    fontSize: 15, fontWeight: 600, cursor: 'pointer', padding: 4,
  },
  ipucu: { fontSize: 13, color: '#64748b', margin: '-4px 4px 10px' },
  hizliIzgara: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 },
  hizliBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '16px 4px', borderRadius: 16, border: 'none', cursor: 'pointer', minHeight: 92, minWidth: 0,
  },
  hizliAd: { fontSize: 12.5, fontWeight: 700, color: '#0b1730', textAlign: 'center', lineHeight: 1.2 },
  bos: { color: '#64748b', fontSize: 14, padding: '6px 4px 4px' },
  bakimSatir: {
    display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 2px', border: 'none',
    borderTop: '1px solid #eef2f7', background: 'transparent', cursor: 'pointer', textAlign: 'left',
  },
  bakimResim: {
    width: 64, height: 46, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(160deg,#9bd7f5,#3aa6e6 60%,#1f8fd1)', boxShadow: 'inset 0 -6px 12px rgba(255,255,255,0.25)',
  },
  bakimOrta: { flex: 1, minWidth: 0 },
  bakimAd: { fontSize: 15, fontWeight: 800, color: '#0b1730', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  bakimKonum: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#64748b', marginTop: 3, minWidth: 0 },
  tekSatir: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  bakimSag: { flexShrink: 0, textAlign: 'left' },
  bakimTarih: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: '#64748b' },
  bakimKalan: { fontSize: 13.5, fontWeight: 800, marginTop: 3 },
};
