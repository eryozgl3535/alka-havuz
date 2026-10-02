import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabase';
import { FIRMA } from '../firma';

const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const KATEGORI_IKON = { Havuz: '🏊', Kuyu: '💧', Hidrofor: '🔵', Sulama: '🌱', Tesisat: '🔧', Elektrik: '⚡' };
const HIZLI_ANAHTAR = 'alkaHizliIslemler2';

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
const VARSAYILAN_HIZLI = ['yeniIs', 'yeniMusteri', 'gelisler', 'toplumesaj'];

function hizliOku() {
  try {
    const v = JSON.parse(localStorage.getItem(HIZLI_ANAHTAR) || 'null');
    if (Array.isArray(v) && v.length) return v.filter((id) => TUM_HIZLI.some((h) => h.id === id));
  } catch { /* yoksay */ }
  return VARSAYILAN_HIZLI;
}

export default function DashboardPage({ onNavigate }) {
  const [kurallar, setKurallar] = useState([]);
  const [tamamlanan, setTamamlanan] = useState(0);
  const [musteriSayi, setMusteriSayi] = useState(0);
  const [hizli, setHizli] = useState(hizliOku);
  const [duzenle, setDuzenle] = useState(false);

  const git = (id) => onNavigate && onNavigate(id);

  useEffect(() => {
    (async () => {
      const bugun = new Date();
      const ayBas = yerel(new Date(bugun.getFullYear(), bugun.getMonth(), 1));
      const [k, t, m] = await Promise.all([
        supabase.from('maintenance_rules').select('*, equipment(category, equipment_type, customers(name, address))'),
        supabase.from('work_orders').select('id', { count: 'exact', head: true }).eq('status', 'tamamlandi').gte('completed_date', ayBas),
        supabase.from('customers').select('id', { count: 'exact', head: true }),
      ]);
      setKurallar((k.data || []).filter((x) => x.active !== false && x.next_due_date));
      setTamamlanan(t.count || 0);
      setMusteriSayi(m.count || 0);
    })();

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

  return (
    <div style={s.sayfa}>
      <HavaKarti />

      {/* Özet kartları */}
      <div style={s.istIzgara}>
        {istatistik.map((k) => (
          <button key={k.ad} style={{ ...s.istKart, background: k.zemin, borderColor: k.kenar }} onClick={() => git(k.hedef)}>
            <div style={{ ...s.istIkon, background: k.ikonZemin }}>{SIMGE[k.simge](k.renk)}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ ...s.istSayi, color: k.sayi > 0 && k.ad === 'Bakımı Geçmiş' ? '#dc2626' : '#0b1730' }}>{k.sayi}</div>
              <div style={s.istAd}>{k.ad}</div>
            </div>
          </button>
        ))}
      </div>

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

    </div>
  );
}

const kartGolge = '0 4px 18px rgba(15,45,74,0.07)';

const s = {
  sayfa: { padding: '0 14px 20px', maxWidth: 900, margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' },
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
  tahminSerit: {
    position: 'relative', display: 'flex', gap: 6, overflowX: 'auto', margin: '0 12px 12px',
    padding: 6, borderRadius: 16, background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)', boxShadow: '0 4px 14px rgba(15,45,74,0.12)', scrollbarWidth: 'none',
  },
  tahminGun: {
    flex: '1 0 54px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    padding: '6px 2px', borderRadius: 12,
  },
  tahminBugun: { background: '#dbeafe' },
  tahminAd: { fontSize: 12, fontWeight: 700, color: '#334155' },
  tahminDerece: { fontSize: 12.5, color: '#0b1730', whiteSpace: 'nowrap' },
  tahminEk: { fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap' },
  havaDerece: { fontSize: 18, fontWeight: 800, lineHeight: 1.1 },
  havaSehir: { fontSize: 12, opacity: 0.9 },
  istIzgara: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(158px, 1fr))', gap: 10, marginBottom: 14 },
  istKart: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 12px', borderRadius: 18, border: '1px solid',
    cursor: 'pointer', textAlign: 'left', minWidth: 0, boxShadow: kartGolge,
  },
  istIkon: { width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  istSayi: { fontSize: 24, fontWeight: 900, lineHeight: 1 },
  istAd: { fontSize: 12, color: '#475569', lineHeight: 1.2, marginTop: 3, fontWeight: 600 },
  kutu: { background: '#fff', borderRadius: 18, padding: '14px 12px', marginBottom: 14, boxShadow: kartGolge },
  kutuUst: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '0 4px' },
  kutuBaslik: { margin: 0, fontSize: 17, fontWeight: 800, color: '#0b1730' },
  linkBtn: {
    display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', color: '#1d6fe0',
    fontSize: 15, fontWeight: 600, cursor: 'pointer', padding: 4,
  },
  ipucu: { fontSize: 13, color: '#64748b', margin: '-4px 4px 10px' },
  hizliIzgara: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 },
  hizliBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '16px 4px', borderRadius: 16, border: 'none', cursor: 'pointer', minHeight: 84, minWidth: 0,
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

// ================= HAVA DURUMU KARTI =================

const GUN_TAM = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const GUN_KISA = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const SAAT_GENISLIK = 50;
const YENILEME_DK = 10;

function havaTip(kod) {
  if (kod === 0) return 'acik';
  if (kod <= 2) return 'azBulut';
  if (kod === 3) return 'bulut';
  if (kod <= 48) return 'sis';
  if (kod <= 67 || (kod >= 80 && kod <= 82)) return 'yagmur';
  if (kod <= 77 || kod === 85 || kod === 86) return 'kar';
  return 'firtina';
}

const TIP_AD = {
  acik: { gun: 'Güneşli', gece: 'Açık' },
  azBulut: { gun: 'Parçalı bulutlu', gece: 'Parçalı bulutlu' },
  bulut: { gun: 'Bulutlu', gece: 'Bulutlu' },
  sis: { gun: 'Sisli', gece: 'Sisli' },
  yagmur: { gun: 'Yağmurlu', gece: 'Yağmurlu' },
  kar: { gun: 'Karlı', gece: 'Karlı' },
  firtina: { gun: 'Gök gürültülü', gece: 'Gök gürültülü' },
};

const saatYazi = (iso) => iso.slice(11, 16);

const HAVA_CSS = `
.hv-kart{position:relative;overflow:hidden;border-radius:20px;color:#fff;margin-bottom:14px;
  box-shadow:0 8px 24px rgba(15,45,74,.18);transition:background 1.2s ease;isolation:isolate}
.hv-katman{position:absolute;inset:0;pointer-events:none;z-index:0}
.hv-bulut{position:absolute;border-radius:50%;background:radial-gradient(closest-side,rgba(255,255,255,.18),rgba(255,255,255,0));
  filter:blur(6px);animation:hv-suz linear infinite}
@keyframes hv-suz{from{transform:translateX(-40vw)}to{transform:translateX(140vw)}}
.hv-gunes-isik{position:absolute;top:-110px;right:-70px;width:260px;height:260px;border-radius:50%;
  background:radial-gradient(circle,rgba(255,236,150,.45) 0%,rgba(255,214,90,.18) 35%,rgba(255,214,90,0) 70%);
  animation:hv-nefes 6s ease-in-out infinite}
@keyframes hv-nefes{0%,100%{transform:scale(1);opacity:.9}50%{transform:scale(1.12);opacity:1}}
.hv-isinlar{position:absolute;top:-55px;right:-15px;width:160px;height:160px;
  background:repeating-conic-gradient(rgba(255,255,255,.1) 0 6deg,transparent 6deg 24deg);
  border-radius:50%;mask:radial-gradient(circle,#000 20%,transparent 70%);-webkit-mask:radial-gradient(circle,#000 20%,transparent 70%);
  animation:hv-don 40s linear infinite}
.hv-yagmur{position:absolute;inset:-50% 0 0 0;
  background-image:repeating-linear-gradient(105deg,rgba(255,255,255,.0) 0 14px,rgba(255,255,255,.28) 14px 15px,rgba(255,255,255,0) 15px 34px);
  animation:hv-yagis .7s linear infinite}
@keyframes hv-yagis{from{transform:translateY(0)}to{transform:translateY(34%)}}
.hv-yildiz{position:absolute;inset:0;
  background-image:radial-gradient(1.5px 1.5px at 20% 30%,#fff,transparent),radial-gradient(1px 1px at 60% 20%,#fff,transparent),
  radial-gradient(1.5px 1.5px at 80% 60%,#fff,transparent),radial-gradient(1px 1px at 35% 70%,#fff,transparent),
  radial-gradient(1px 1px at 90% 15%,#fff,transparent),radial-gradient(1.5px 1.5px at 10% 80%,#fff,transparent),
  radial-gradient(1px 1px at 50% 50%,#fff,transparent),radial-gradient(1px 1px at 70% 85%,#fff,transparent);
  animation:hv-parilti 3s ease-in-out infinite alternate}
@keyframes hv-parilti{from{opacity:.35}to{opacity:1}}
.hv-simsek{position:absolute;inset:0;background:#fff;opacity:0;animation:hv-cak 7s infinite}
@keyframes hv-cak{0%,91%,95%,100%{opacity:0}92%{opacity:.45}93%{opacity:.05}94%{opacity:.3}}
.hv-icerik{position:relative;z-index:1;padding:14px 16px 10px}
.hv-cam{background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.16);backdrop-filter:blur(12px);
  -webkit-backdrop-filter:blur(12px);border-radius:14px}
.hv-gir{animation:hv-gir .55s cubic-bezier(.2,.8,.2,1)}
@keyframes hv-gir{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.hv-kaydir{overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;scroll-behavior:smooth}
.hv-kaydir::-webkit-scrollbar{display:none}
.hv-gunbtn{transition:transform .2s,background .3s,color .3s}
.hv-gunbtn:hover{transform:translateY(-2px)}
.hv-cizgi{stroke-dasharray:2000;stroke-dashoffset:2000;animation:hv-ciz 1.4s ease forwards}
@keyframes hv-ciz{to{stroke-dashoffset:0}}
.hv-nokta{animation:hv-belir .5s ease both}
@keyframes hv-belir{from{opacity:0;transform:scale(.3)}to{opacity:1;transform:none}}
.hv-don{animation:hv-don 12s linear infinite;transform-origin:center;transform-box:fill-box}
@keyframes hv-don{to{transform:rotate(360deg)}}
.hv-sall{animation:hv-sall 4s ease-in-out infinite alternate}
@keyframes hv-sall{from{transform:translateX(-2.5px)}to{transform:translateX(2.5px)}}
.hv-damla{animation:hv-damla 1.1s linear infinite}
@keyframes hv-damla{0%{transform:translateY(-3px);opacity:0}30%{opacity:1}100%{transform:translateY(9px);opacity:0}}
.hv-kar{animation:hv-karyag 2.2s linear infinite}
@keyframes hv-karyag{0%{transform:translate(0,-3px);opacity:0}30%{opacity:1}100%{transform:translate(2px,9px);opacity:0}}
.hv-yanip{animation:hv-yanip 2.4s infinite}
@keyframes hv-yanip{0%,70%,100%{opacity:1}75%{opacity:.15}80%{opacity:1}85%{opacity:.2}}
.hv-sis{animation:hv-sis 3.5s ease-in-out infinite alternate}
@keyframes hv-sis{from{transform:translateX(-3px)}to{transform:translateX(3px)}}
.hv-nabiz{animation:hv-nabiz 3s ease-in-out infinite}
@keyframes hv-nabiz{0%,100%{opacity:.85}50%{opacity:1;filter:drop-shadow(0 0 6px rgba(255,230,140,.9))}}
.hv-yenile.donuyor{animation:hv-don .9s linear infinite}
.hv-iskelet{background:linear-gradient(90deg,rgba(255,255,255,.12),rgba(255,255,255,.3),rgba(255,255,255,.12));
  background-size:200% 100%;animation:hv-parla 1.4s linear infinite;border-radius:12px}
@keyframes hv-parla{from{background-position:200% 0}to{background-position:-200% 0}}
@media (prefers-reduced-motion: reduce){.hv-kart *{animation:none!important}}
`;

const BULUT_YOL = 'M18 50h30a11 11 0 0 0 1-22 15 15 0 0 0-28.5-4A11.5 11.5 0 0 0 18 50z';

function HavaIkon({ tip, gece, boyut = 40 }) {
  const gunes = (cx, cy, r) => (
    <g className="hv-nabiz">
      <g className="hv-don">
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i * Math.PI) / 4;
          return <line key={i} x1={cx + Math.cos(a) * (r + 4)} y1={cy + Math.sin(a) * (r + 4)}
            x2={cx + Math.cos(a) * (r + 9)} y2={cy + Math.sin(a) * (r + 9)} stroke="#FFC93C" strokeWidth="3.2" strokeLinecap="round" />;
        })}
      </g>
      <circle cx={cx} cy={cy} r={r} fill="url(#hvGunes)" />
    </g>
  );
  const ay = (cx, cy, r) => (
    <g className="hv-nabiz">
      <path d={`M${cx + r * 0.3} ${cy - r} a${r} ${r} 0 1 0 ${r * 0.7} ${r * 1.55} a${r * 0.8} ${r * 0.8} 0 1 1 ${-r * 0.7} ${-r * 1.55}z`} fill="#FDE68A" />
    </g>
  );
  const bulut = (renk = '#fff', ek = '') => (
    <g className="hv-sall"><path d={BULUT_YOL} fill={renk} stroke="rgba(15,45,74,.08)" strokeWidth="1" transform={ek} /></g>
  );
  let icerik;
  if (tip === 'acik') icerik = gece ? ay(32, 32, 15) : gunes(32, 32, 13);
  else if (tip === 'azBulut') icerik = <>{gece ? ay(24, 22, 11) : gunes(24, 22, 10)}{bulut('#fff', 'translate(4 4)')}</>;
  else if (tip === 'bulut') icerik = <>{bulut('#cbd5e1', 'translate(-8 -6) scale(.85)')}{bulut('#fff', 'translate(4 4)')}</>;
  else if (tip === 'sis') icerik = <>{bulut('#e2e8f0', 'translate(0 -6)')}<g className="hv-sis" stroke="#e2e8f0" strokeWidth="3.2" strokeLinecap="round"><line x1="12" y1="50" x2="44" y2="50" /><line x1="20" y1="57" x2="52" y2="57" /></g></>;
  else if (tip === 'yagmur' || tip === 'firtina' || tip === 'kar') {
    icerik = (
      <>
        {bulut(tip === 'firtina' ? '#94a3b8' : '#e2e8f0', 'translate(0 -8)')}
        {tip === 'yagmur' && [20, 31, 42].map((x, i) => (
          <line key={x} className="hv-damla" style={{ animationDelay: `${i * 0.35}s` }} x1={x} y1="47" x2={x - 2} y2="53" stroke="#60a5fa" strokeWidth="3" strokeLinecap="round" />
        ))}
        {tip === 'kar' && [20, 31, 42].map((x, i) => (
          <circle key={x} className="hv-kar" style={{ animationDelay: `${i * 0.6}s` }} cx={x} cy="50" r="2.6" fill="#fff" />
        ))}
        {tip === 'firtina' && <path className="hv-yanip" d="M33 42l-7 11h6l-3 9 10-13h-6l4-7z" fill="#FACC15" />}
      </>
    );
  }
  return (
    <svg width={boyut} height={boyut} viewBox="0 0 64 64" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <radialGradient id="hvGunes" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#FFF3B0" /><stop offset="55%" stopColor="#FFC93C" /><stop offset="100%" stopColor="#F59E0B" />
        </radialGradient>
      </defs>
      {icerik}
    </svg>
  );
}

function arkaPlan(tip, gece) {
  // Menüdeki lacivert-mavi tonlarıyla uyumlu
  if (gece) return 'linear-gradient(135deg,#0b2240 0%,#123a63 55%,#1e5a82 100%)';
  switch (tip) {
    case 'acik': return 'linear-gradient(135deg,#0f3d6b 0%,#1e6fae 55%,#3a9ad9 100%)';
    case 'azBulut': return 'linear-gradient(135deg,#123d68 0%,#2366a0 55%,#4a8dc4 100%)';
    case 'bulut': return 'linear-gradient(135deg,#1a3858 0%,#335c85 55%,#5880a6 100%)';
    case 'sis': return 'linear-gradient(135deg,#25405b 0%,#466684 55%,#7290ab 100%)';
    case 'kar': return 'linear-gradient(135deg,#1d4870 0%,#4a7caa 55%,#8bb1d5 100%)';
    default: return 'linear-gradient(135deg,#132a44 0%,#23456b 55%,#3b6288 100%)';
  }
}

function HavaKarti() {
  const [veri, setVeri] = useState(null);
  const [hata, setHata] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [guncel, setGuncel] = useState(null);
  const [secili, setSecili] = useState(0);
  const [simdi, setSimdi] = useState(new Date());
  const [acik, setAcik] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 900);
  const saatRef = useRef(null);

  async function getir() {
    setYukleniyor(true);
    try {
      const enlem = FIRMA.enlem || 38.3236;
      const boylam = FIRMA.boylam || 26.3058;
      const r = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${enlem}&longitude=${boylam}` +
        '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day' +
        '&hourly=temperature_2m,weather_code,precipitation_probability,wind_speed_10m,is_day' +
        '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset,uv_index_max' +
        '&forecast_days=7&timezone=Europe%2FIstanbul'
      );
      const d = await r.json();
      if (!d?.current || !d?.daily) throw new Error('veri yok');
      setVeri(d);
      setGuncel(new Date());
      setHata(false);
    } catch {
      setHata(true);
    }
    setYukleniyor(false);
  }

  useEffect(() => {
    getir();
    const yenile = setInterval(getir, YENILEME_DK * 60 * 1000);
    const saat = setInterval(() => setSimdi(new Date()), 60 * 1000);
    const gorunur = () => { if (document.visibilityState === 'visible') getir(); };
    document.addEventListener('visibilitychange', gorunur);
    return () => { clearInterval(yenile); clearInterval(saat); document.removeEventListener('visibilitychange', gorunur); };
  }, []);

  const sehir = FIRMA.sehir || 'Çeşme';

  if (!veri) {
    return (
      <section className="hv-kart" style={{ background: arkaPlan('azBulut', false) }}>
        <style>{HAVA_CSS}</style>
        <div className="hv-icerik">
          {hata ? (
            <div style={{ padding: '30px 0', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Hava durumu şu an alınamadı</div>
              <button onClick={getir} style={hs.tekrarBtn}>Tekrar dene</button>
            </div>
          ) : (
            <>
              <div className="hv-iskelet" style={{ height: 90, marginBottom: 14 }} />
              <div className="hv-iskelet" style={{ height: 110, marginBottom: 14 }} />
              <div className="hv-iskelet" style={{ height: 80 }} />
            </>
          )}
        </div>
      </section>
    );
  }

  const c = veri.current;
  const anlikTip = havaTip(c.weather_code);
  const anlikGece = c.is_day === 0;
  const gunler = veri.daily.time.map((t, i) => ({
    tarih: t,
    tip: havaTip(veri.daily.weather_code[i]),
    max: Math.round(veri.daily.temperature_2m_max[i]),
    min: Math.round(veri.daily.temperature_2m_min[i]),
    yagmur: veri.daily.precipitation_probability_max?.[i] ?? 0,
    ruzgar: Math.round(veri.daily.wind_speed_10m_max?.[i] ?? 0),
    dogus: veri.daily.sunrise?.[i], batis: veri.daily.sunset?.[i],
    uv: veri.daily.uv_index_max?.[i],
  }));
  const haftaMin = Math.min(...gunler.map((g) => g.min));
  const haftaMax = Math.max(...gunler.map((g) => g.max));
  const sg = gunler[secili];
  const bugunGun = gunler[0];

  const katman = (
    <div className="hv-katman">
        {anlikGece && <div className="hv-yildiz" />}
        {!anlikGece && (anlikTip === 'acik' || anlikTip === 'azBulut') && <><div className="hv-gunes-isik" /><div className="hv-isinlar" /></>}
        {[{ t: 10, w: 260, h: 90, s: 70, d: -10 }, { t: 45, w: 340, h: 110, s: 95, d: -50 }, { t: 70, w: 220, h: 80, s: 60, d: -30 }]
          .slice(0, anlikTip === 'acik' ? 1 : 3)
          .map((b, i) => (
            <div key={i} className="hv-bulut" style={{ top: `${b.t}%`, width: b.w, height: b.h, animationDuration: `${b.s}s`, animationDelay: `${b.d}s`,
              opacity: anlikTip === 'acik' ? 0.5 : 0.9 }} />
          ))}
        {(anlikTip === 'yagmur' || anlikTip === 'firtina') && <div className="hv-yagmur" />}
        {anlikTip === 'firtina' && <div className="hv-simsek" />}
      </div>
  );

  if (!acik) {
    return (
      <section className="hv-kart" style={{ background: arkaPlan(anlikTip, anlikGece), cursor: 'pointer' }} onClick={() => setAcik(true)}>
        <style>{HAVA_CSS}</style>
        {katman}
        <div className="hv-icerik" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
          <HavaIkon tip={anlikTip} gece={anlikGece} boyut={46} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1 }}>{Math.round(c.temperature_2m)}°</div>
            <div style={{ fontSize: 12.5, opacity: 0.9, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {TIP_AD[anlikTip][anlikGece ? 'gece' : 'gun']}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 14 }}><b>{bugunGun.max}°</b> <span style={{ opacity: 0.75 }}>/ {bugunGun.min}°</span></div>
            <div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 3 }}>☔ %{bugunGun.yagmur} · 💨 {Math.round(c.wind_speed_10m)}</div>
          </div>
          <span style={hs.acKapa}>⌄</span>
        </div>
      </section>
    );
  }

  const simdiSaat = `${yerel(simdi)}T${String(simdi.getHours()).padStart(2, '0')}:00`;
  const saatler = veri.hourly.time
    .map((t, i) => ({
      t,
      sicaklik: Math.round(veri.hourly.temperature_2m[i]),
      tip: havaTip(veri.hourly.weather_code[i]),
      gece: veri.hourly.is_day?.[i] === 0,
      yagmur: veri.hourly.precipitation_probability?.[i] ?? 0,
      ruzgar: Math.round(veri.hourly.wind_speed_10m?.[i] ?? 0),
    }))
    .filter((h) => (secili === 0 ? h.t >= simdiSaat : h.t.startsWith(sg.tarih)))
    .slice(0, 24);

  const sMin = Math.min(...saatler.map((h) => h.sicaklik));
  const sMax = Math.max(...saatler.map((h) => h.sicaklik));
  const grafikY = 48;
  const yHesap = (v) => (sMax === sMin ? grafikY / 2 + 10 : 20 + ((sMax - v) / (sMax - sMin)) * (grafikY - 26));
  const noktalar = saatler.map((h, i) => [i * SAAT_GENISLIK + SAAT_GENISLIK / 2, yHesap(h.sicaklik)]);
  let yol = '';
  noktalar.forEach(([x, y], i) => {
    if (i === 0) { yol = `M${x} ${y}`; return; }
    const [px, py] = noktalar[i - 1];
    const cx = (px + x) / 2;
    yol += ` C${cx} ${py} ${cx} ${y} ${x} ${y}`;
  });
  const genislik = saatler.length * SAAT_GENISLIK;
  const alanYol = noktalar.length ? `${yol} L${noktalar[noktalar.length - 1][0]} ${grafikY + 8} L${noktalar[0][0]} ${grafikY + 8} Z` : '';

  const gunEtiket = (i, t) => (i === 0 ? 'Bugün' : i === 1 ? 'Yarın' : GUN_KISA[new Date(t + 'T00:00:00').getDay()]);
  const tamGun = (i, t) => {
    const d = new Date(t + 'T00:00:00');
    return `${i === 0 ? 'Bugün' : i === 1 ? 'Yarın' : GUN_TAM[d.getDay()]} · ${d.getDate()} ${AYLAR[d.getMonth()]}`;
  };

  return (
    <section className="hv-kart" style={{ background: arkaPlan(anlikTip, anlikGece) }}>
      <style>{HAVA_CSS}</style>

      {katman}

      <div className="hv-icerik">
        {/* Üst: anlık durum + seçili gün özeti */}
        <div style={hs.ust}>
          <div style={{ minWidth: 0 }}>
            <div style={hs.konum}>
              📍 {sehir}
              <button onClick={getir} style={hs.yenileBtn} title="Yenile">
                <span className={`hv-yenile${yukleniyor ? ' donuyor' : ''}`} style={{ display: 'inline-block' }}>⟳</span>
              </button>
              <button onClick={() => setAcik(false)} style={{ ...hs.yenileBtn, width: 'auto', padding: '0 10px', fontSize: 11.5, fontWeight: 700 }}>
                Küçült ⌃
              </button>
            </div>
            <div style={hs.anlik}>
              <HavaIkon tip={anlikTip} gece={anlikGece} boyut={50} />
              <div>
                <div style={hs.buyukDerece}>{Math.round(c.temperature_2m)}°</div>
                <div style={hs.durum}>{TIP_AD[anlikTip][anlikGece ? 'gece' : 'gun']}</div>
              </div>
            </div>
            <div style={hs.detaySatir}>
              <span>🌡️ Hissedilen {Math.round(c.apparent_temperature)}°</span>
              <span>💧 Nem %{c.relative_humidity_2m}</span>
              <span>💨 {Math.round(c.wind_speed_10m)} km/sa</span>
            </div>
          </div>

          <div key={sg.tarih} className="hv-cam hv-gir" style={hs.ozet}>
            <div style={hs.ozetBaslik}>{tamGun(secili, sg.tarih)}</div>
            <div style={hs.ozetDerece}>
              <span style={{ fontSize: 20, fontWeight: 900 }}>{sg.max}°</span>
              <span style={{ opacity: 0.7, fontSize: 15 }}> / {sg.min}°</span>
            </div>
            <div style={hs.ozetDetay}>
              <span>☔ %{sg.yagmur}</span><span>💨 {sg.ruzgar} km/sa</span>
              {sg.uv != null && <span>🔆 UV {Math.round(sg.uv)}</span>}
              {sg.dogus && <span>🌅 {saatYazi(sg.dogus)} · 🌇 {saatYazi(sg.batis)}</span>}
            </div>
          </div>
        </div>

        {/* Saatlik tahmin */}
        <div className="hv-cam" style={{ marginTop: 10, padding: '8px 0 6px' }}>
          <div style={hs.bolumBaslik}>🕒 Saatlik · {secili === 0 ? 'sonraki 24 saat' : tamGun(secili, sg.tarih).split(' · ')[0].toLocaleLowerCase('tr-TR')}</div>
          <div className="hv-kaydir" ref={saatRef}>
            <div key={sg.tarih} className="hv-gir" style={{ position: 'relative', width: Math.max(genislik, 1), padding: '0 6px' }}>
              <div style={{ display: 'flex' }}>
                {saatler.map((h, i) => (
                  <div key={h.t} style={{ ...hs.saatKol, ...(secili === 0 && i === 0 ? hs.saatSimdi : {}) }}>
                    <div style={hs.saatEtiket}>{secili === 0 && i === 0 ? 'Şimdi' : secili === 0 && saatYazi(h.t) === '00:00' ? GUN_KISA[new Date(h.t).getDay()] : saatYazi(h.t)}</div>
                    <HavaIkon tip={h.tip} gece={h.gece} boyut={22} />
                  </div>
                ))}
              </div>
              <svg width={genislik} height={grafikY + 10} style={{ display: 'block' }}>
                <defs>
                  <linearGradient id="hvAlan" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fff" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#fff" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {alanYol && <path d={alanYol} fill="url(#hvAlan)" className="hv-nokta" />}
                <path d={yol} fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" className="hv-cizgi" />
                {noktalar.map(([x, y], i) => (
                  <g key={i} className="hv-nokta" style={{ animationDelay: `${0.2 + i * 0.03}s` }}>
                    <circle cx={x} cy={y} r="2.8" fill="#fff" />
                    <text x={x} y={y - 8} textAnchor="middle" fontSize="11.5" fontWeight="800" fill="#fff"
                      style={{ textShadow: '0 1px 3px rgba(0,0,0,.35)' }}>{saatler[i].sicaklik}°</text>
                  </g>
                ))}
              </svg>
              <div style={{ display: 'flex' }}>
                {saatler.map((h) => (
                  <div key={h.t} style={{ ...hs.saatKol, paddingTop: 0 }}>
                    <div style={{ ...hs.saatYagis, opacity: h.yagmur >= 10 ? 1 : 0.5 }}>💧{h.yagmur}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 7 günlük */}
        <div className="hv-kaydir" style={{ display: 'flex', gap: 6, marginTop: 10, paddingBottom: 2 }}>
          {gunler.map((g, i) => {
            const aktif = i === secili;
            const sol = ((g.min - haftaMin) / Math.max(1, haftaMax - haftaMin)) * 100;
            const gen = ((g.max - g.min) / Math.max(1, haftaMax - haftaMin)) * 100;
            return (
              <button key={g.tarih} className={`hv-gunbtn${aktif ? '' : ' hv-cam'}`} onClick={() => setSecili(i)}
                style={{ ...hs.gunBtn, ...(aktif ? hs.gunBtnAktif : {}) }}>
                <div style={{ fontSize: 11.5, fontWeight: 800 }}>{gunEtiket(i, g.tarih)}</div>
                <div style={aktif ? { filter: 'drop-shadow(0 1px 2px rgba(15,45,74,.45))' } : undefined}>
                  <HavaIkon tip={g.tip} gece={false} boyut={24} />
                </div>
                <div style={{ fontSize: 12, whiteSpace: 'nowrap' }}><b>{g.max}°</b> <span style={{ opacity: 0.7 }}>{g.min}°</span></div>
                <div style={{ ...hs.aralik, background: aktif ? '#dbeafe' : 'rgba(255,255,255,.25)' }}>
                  <div style={{ position: 'absolute', left: `${sol}%`, width: `${Math.max(gen, 8)}%`, top: 0, bottom: 0, borderRadius: 3,
                    background: 'linear-gradient(90deg,#60a5fa,#fbbf24,#f97316)' }} />
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: aktif ? (g.yagmur >= 50 ? '#dc2626' : '#2563eb') : (g.yagmur >= 50 ? '#fecaca' : '#e0f2fe') }}>
                  💧%{g.yagmur}
                </div>
              </button>
            );
          })}
        </div>

        <div style={hs.altBilgi}>
          {guncel && `Son güncelleme ${String(guncel.getHours()).padStart(2, '0')}:${String(guncel.getMinutes()).padStart(2, '0')}`} · {YENILEME_DK} dakikada bir otomatik yenilenir
        </div>
      </div>
    </section>
  );
}

const hs = {
  acKapa: { width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,.16)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 16, flexShrink: 0, lineHeight: 1, paddingBottom: 4, boxSizing: 'border-box' },
  ust: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  konum: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, opacity: 0.95 },
  yenileBtn: { border: 'none', background: 'rgba(255,255,255,.14)', color: '#fff', borderRadius: 20, width: 24, height: 24,
    cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 },
  anlik: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 },
  buyukDerece: { fontSize: 42, fontWeight: 900, lineHeight: 1, letterSpacing: -1 },
  durum: { fontSize: 13.5, fontWeight: 700, opacity: 0.9, marginTop: 2 },
  detaySatir: { display: 'flex', flexWrap: 'wrap', gap: '2px 12px', fontSize: 12, marginTop: 6, opacity: 0.88 },
  ozet: { padding: '9px 12px', minWidth: 190, flex: '0 1 260px' },
  ozetBaslik: { fontSize: 12, fontWeight: 700, opacity: 0.85 },
  ozetDerece: { margin: '1px 0 4px' },
  ozetDetay: { display: 'flex', flexWrap: 'wrap', gap: '2px 10px', fontSize: 11.5, opacity: 0.92 },
  bolumBaslik: { fontSize: 11.5, fontWeight: 800, padding: '0 12px 4px', opacity: 0.85, letterSpacing: 0.3 },
  saatKol: { width: SAAT_GENISLIK, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, paddingTop: 3, borderRadius: 10 },
  saatSimdi: { background: 'rgba(255,255,255,.16)' },
  saatEtiket: { fontSize: 11, fontWeight: 700, opacity: 0.9 },
  saatYagis: { fontSize: 10, fontWeight: 700, color: '#bfdbfe', whiteSpace: 'nowrap' },
  saatRuzgar: { fontSize: 10, opacity: 0.8 },
  gunBtn: { flex: '1 0 60px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '6px 4px',
    borderRadius: 12, color: '#fff', cursor: 'pointer', border: '1px solid rgba(255,255,255,.16)' },
  gunBtnAktif: { background: '#fff', color: '#0b1730', boxShadow: '0 4px 12px rgba(0,0,0,.18)', border: '1px solid #fff' },
  aralik: { position: 'relative', width: '78%', height: 4, borderRadius: 3, overflow: 'hidden', margin: '1px 0' },
  altBilgi: { fontSize: 10, opacity: 0.65, marginTop: 6, textAlign: 'right' },
  tekrarBtn: { marginTop: 10, border: 'none', background: '#fff', color: '#1d4ed8', fontWeight: 700, borderRadius: 12,
    padding: '9px 16px', cursor: 'pointer' },
};
