import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

const AYLAR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const IKON = { Havuz: '🏊', Kuyu: '💧', Hidrofor: '🔵', Sulama: '🌱', Tesisat: '🔧', Elektrik: '⚡' };

const DONEMLER = [
  { id: 'buay', ad: 'Bu ay' },
  { id: 'gecenay', ad: 'Geçen ay' },
  { id: 'buyil', ad: 'Bu yıl' },
  { id: 'tumu', ad: 'Tümü' },
];

const yerel = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const tl = (n) => `${Number(n || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL`;
const sayi = (v) => Number(v) || 0;
const toplamTutar = (x) => sayi(x.material_cost) + sayi(x.labor_cost);
const isTarihi = (x) => x.completed_date || x.scheduled_date || (x.created_at || '').slice(0, 10);

function donemAraligi(id) {
  const b = new Date();
  if (id === 'buay') return [yerel(new Date(b.getFullYear(), b.getMonth(), 1)), yerel(new Date(b.getFullYear(), b.getMonth() + 1, 0))];
  if (id === 'gecenay') return [yerel(new Date(b.getFullYear(), b.getMonth() - 1, 1)), yerel(new Date(b.getFullYear(), b.getMonth(), 0))];
  if (id === 'buyil') return [`${b.getFullYear()}-01-01`, `${b.getFullYear()}-12-31`];
  return ['0000-01-01', '9999-12-31'];
}

export default function ReportsPage() {
  const [isler, setIsler] = useState([]);
  const [kurallar, setKurallar] = useState([]);
  const [musteriSayisi, setMusteriSayisi] = useState(0);
  const [donem, setDonem] = useState('buay');
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState('');

  useEffect(() => {
    (async () => {
      const [w, r, c] = await Promise.all([
        supabase.from('work_orders').select('*, customers(name, phone), equipment(category)'),
        supabase.from('maintenance_rules').select('next_due_date, active'),
        supabase.from('customers').select('id', { count: 'exact', head: true }),
      ]);
      if (w.error) setHata(w.error.message);
      setIsler(w.data || []);
      setKurallar(r.data || []);
      setMusteriSayisi(c.count || 0);
      setYukleniyor(false);
    })();
  }, []);

  const [bas, bit] = donemAraligi(donem);
  const donemIsleri = isler.filter((x) => {
    const t = isTarihi(x);
    return t >= bas && t <= bit;
  });
  const tamamlanan = donemIsleri.filter((x) => x.status === 'tamamlandi');

  const ciro = tamamlanan.reduce((t, x) => t + toplamTutar(x), 0);
  const tahsil = donemIsleri.reduce((t, x) => t + sayi(x.paid_amount), 0);
  const malzeme = tamamlanan.reduce((t, x) => t + sayi(x.material_cost), 0);
  const iscilik = tamamlanan.reduce((t, x) => t + sayi(x.labor_cost), 0);

  const borclular = {};
  isler.forEach((x) => {
    const kalan = toplamTutar(x) - sayi(x.paid_amount);
    if (kalan > 0 && x.status === 'tamamlandi') {
      const ad = x.customers?.name || '-';
      if (!borclular[ad]) borclular[ad] = { ad, tel: x.customers?.phone, tutar: 0, adet: 0 };
      borclular[ad].tutar += kalan;
      borclular[ad].adet += 1;
    }
  });
  const borcListe = Object.values(borclular).sort((a, b) => b.tutar - a.tutar);
  const toplamAlacak = borcListe.reduce((t, x) => t + x.tutar, 0);

  const musteriCiro = {};
  tamamlanan.forEach((x) => {
    const ad = x.customers?.name || '-';
    if (!musteriCiro[ad]) musteriCiro[ad] = { ad, tutar: 0, adet: 0 };
    musteriCiro[ad].tutar += toplamTutar(x);
    musteriCiro[ad].adet += 1;
  });
  const enIyiMusteriler = Object.values(musteriCiro).sort((a, b) => b.tutar - a.tutar).slice(0, 5);

  const kategoriCiro = {};
  tamamlanan.forEach((x) => {
    const k = x.equipment?.category || x.category || 'Diğer';
    kategoriCiro[k] = (kategoriCiro[k] || 0) + toplamTutar(x);
  });
  const kategoriListe = Object.entries(kategoriCiro).sort((a, b) => b[1] - a[1]);
  const kategoriMax = Math.max(1, ...kategoriListe.map((k) => k[1]));

  const bugun = new Date();
  const aylik = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(bugun.getFullYear(), bugun.getMonth() - i, 1);
    const ab = yerel(d);
    const ae = yerel(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    const tutar = isler
      .filter((x) => x.status === 'tamamlandi' && isTarihi(x) >= ab && isTarihi(x) <= ae)
      .reduce((t, x) => t + toplamTutar(x), 0);
    aylik.push({ ad: AYLAR[d.getMonth()], tutar });
  }
  const aylikMax = Math.max(1, ...aylik.map((a) => a.tutar));

  const bugunStr = yerel(bugun);
  const gecikmis = kurallar.filter((k) => k.active !== false && k.next_due_date && k.next_due_date < bugunStr).length;
  const aktifIs = isler.filter((x) => x.status !== 'tamamlandi').length;

  function waLink(tel) {
    if (!tel) return null;
    let n = tel.replace(/\D/g, '');
    if (n.startsWith('0')) n = '9' + n;
    if (!n.startsWith('90')) n = '90' + n;
    return `https://wa.me/${n}`;
  }

  if (yukleniyor) return <div style={s.sayfa}><p style={s.altBaslik}>Yükleniyor...</p></div>;

  return (
    <div style={s.sayfa}>
      <h1 style={s.baslik}>Raporlar</h1>
      <p style={s.altBaslik}>Ciro, tahsilat ve iş özeti</p>

      {hata && <div style={s.hata}>{hata}</div>}

      <div style={s.donemler}>
        {DONEMLER.map((d) => (
          <button key={d.id} onClick={() => setDonem(d.id)}
            style={{ ...s.donemBtn, ...(donem === d.id ? s.donemAktif : {}) }}>
            {d.ad}
          </button>
        ))}
      </div>

      <div style={s.kartlar}>
        <div style={{ ...s.ozet, background: '#eff6ff' }}>
          <div style={s.ozetEtiket}>💰 Ciro (tamamlanan işler)</div>
          <div style={{ ...s.ozetSayi, color: '#1d4ed8' }}>{tl(ciro)}</div>
        </div>
        <div style={{ ...s.ozet, background: '#f0fdf4' }}>
          <div style={s.ozetEtiket}>✅ Tahsil edilen</div>
          <div style={{ ...s.ozetSayi, color: '#15803d' }}>{tl(tahsil)}</div>
        </div>
        <div style={{ ...s.ozet, background: '#fef2f2' }}>
          <div style={s.ozetEtiket}>⏳ Bekleyen alacak (toplam)</div>
          <div style={{ ...s.ozetSayi, color: '#dc2626' }}>{tl(toplamAlacak)}</div>
        </div>
        <div style={{ ...s.ozet, background: '#fffbeb' }}>
          <div style={s.ozetEtiket}>🔧 Tamamlanan iş</div>
          <div style={{ ...s.ozetSayi, color: '#b45309' }}>{tamamlanan.length}</div>
        </div>
      </div>

      <div style={s.miniKartlar}>
        <div style={s.mini}>👥 <b>{musteriSayisi}</b> müşteri</div>
        <div style={s.mini}>📋 <b>{aktifIs}</b> aktif iş</div>
        <div style={s.mini}>🔴 <b>{gecikmis}</b> gecikmiş bakım</div>
      </div>

      <div style={s.izgara}>
        <div style={s.kart}>
          <h2 style={s.kartBaslik}>Son 6 ay ciro</h2>
          <div style={s.grafik}>
            {aylik.map((a, i) => (
              <div key={i} style={s.grafikKolon}>
                <div style={s.grafikDeger}>{a.tutar > 0 ? tl(a.tutar).replace(' TL', '') : ''}</div>
                <div style={{ ...s.cubuk, height: `${Math.max(4, (a.tutar / aylikMax) * 160)}px` }} />
                <div style={s.grafikAy}>{a.ad}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={s.kart}>
          <h2 style={s.kartBaslik}>Malzeme / İşçilik</h2>
          {ciro === 0 ? (
            <p style={s.bos}>Bu dönemde tamamlanan iş yok.</p>
          ) : (
            <>
              <div style={s.oranCubuk}>
                <div style={{ ...s.oranParca, width: `${(malzeme / ciro) * 100}%`, background: '#1e5a82' }} />
                <div style={{ ...s.oranParca, width: `${(iscilik / ciro) * 100}%`, background: '#f59e0b' }} />
              </div>
              <div style={s.oranSatir}><span style={{ ...s.nokta, background: '#1e5a82' }} /> Malzeme: <b>{tl(malzeme)}</b></div>
              <div style={s.oranSatir}><span style={{ ...s.nokta, background: '#f59e0b' }} /> İşçilik: <b>{tl(iscilik)}</b></div>
            </>
          )}

          <h2 style={{ ...s.kartBaslik, marginTop: 22 }}>Kategoriye göre</h2>
          {kategoriListe.length === 0 ? (
            <p style={s.bos}>Veri yok.</p>
          ) : (
            kategoriListe.map(([k, t]) => (
              <div key={k} style={{ marginBottom: 10 }}>
                <div style={s.katUst}><span>{IKON[k] || '🛠️'} {k}</span><b>{tl(t)}</b></div>
                <div style={s.katArka}><div style={{ ...s.katOn, width: `${(t / kategoriMax) * 100}%` }} /></div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={s.izgara}>
        <div style={s.kart}>
          <h2 style={s.kartBaslik}>🏆 En çok iş yapılan müşteriler</h2>
          {enIyiMusteriler.length === 0 ? (
            <p style={s.bos}>Bu dönemde tamamlanan iş yok.</p>
          ) : (
            enIyiMusteriler.map((m, i) => (
              <div key={m.ad} style={s.listeSatir}>
                <span style={s.sira}>{i + 1}</span>
                <span style={{ flex: 1 }}>{m.ad} <span style={s.kucuk}>· {m.adet} iş</span></span>
                <b>{tl(m.tutar)}</b>
              </div>
            ))
          )}
        </div>

        <div style={s.kart}>
          <h2 style={s.kartBaslik}>💸 Borcu olan müşteriler</h2>
          {borcListe.length === 0 ? (
            <p style={s.bos}>Bekleyen alacak yok. 👍</p>
          ) : (
            borcListe.map((m) => (
              <div key={m.ad} style={s.listeSatir}>
                <span style={{ flex: 1 }}>{m.ad} <span style={s.kucuk}>· {m.adet} iş</span></span>
                <b style={{ color: '#dc2626' }}>{tl(m.tutar)}</b>
                {waLink(m.tel) && (
                  <a href={waLink(m.tel)} target="_blank" rel="noreferrer" style={s.waBtn}>WhatsApp</a>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const s = {
  sayfa: { padding: 20, maxWidth: 1050, margin: '0 auto', fontFamily: 'system-ui, sans-serif' },
  baslik: { margin: 0, fontSize: 26, color: '#0f2d4a' },
  altBaslik: { margin: '4px 0 16px', color: '#64748b', fontSize: 14 },
  hata: { background: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 10, marginBottom: 14 },
  donemler: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 },
  donemBtn: { padding: '10px 18px', borderRadius: 20, border: '1px solid #cbd5e1', background: '#fff',
    cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#334155' },
  donemAktif: { background: '#0f2d4a', color: '#fff', borderColor: '#0f2d4a' },
  kartlar: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 14, marginBottom: 14 },
  ozet: { borderRadius: 16, padding: 18 },
  ozetEtiket: { fontSize: 14, color: '#475569', fontWeight: 600 },
  ozetSayi: { fontSize: 28, fontWeight: 800, marginTop: 6 },
  miniKartlar: { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 },
  mini: { background: '#fff', borderRadius: 12, padding: '10px 16px', fontSize: 14, color: '#334155',
    boxShadow: '0 2px 8px rgba(15,45,74,0.06)' },
  izgara: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16, marginBottom: 16 },
  kart: { background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 2px 12px rgba(15,45,74,0.08)' },
  kartBaslik: { margin: '0 0 14px', fontSize: 18, color: '#0f2d4a' },
  bos: { color: '#64748b', fontSize: 14, margin: 0 },
  grafik: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, height: 220 },
  grafikKolon: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  grafikDeger: { fontSize: 11, color: '#475569', fontWeight: 600, whiteSpace: 'nowrap' },
  cubuk: { width: '100%', maxWidth: 46, borderRadius: '8px 8px 0 0',
    background: 'linear-gradient(180deg,#1d6fe0,#0f2d4a)' },
  grafikAy: { fontSize: 13, color: '#334155', fontWeight: 600 },
  oranCubuk: { display: 'flex', height: 18, borderRadius: 9, overflow: 'hidden', background: '#eef2f6', marginBottom: 12 },
  oranParca: { height: '100%' },
  oranSatir: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#334155', marginBottom: 6 },
  nokta: { width: 10, height: 10, borderRadius: '50%', display: 'inline-block' },
  katUst: { display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#334155', marginBottom: 4 },
  katArka: { height: 10, borderRadius: 5, background: '#eef2f6', overflow: 'hidden' },
  katOn: { height: '100%', borderRadius: 5, background: '#1d6fe0' },
  listeSatir: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid #eef2f6',
    fontSize: 15, color: '#1e293b' },
  sira: { width: 26, height: 26, borderRadius: '50%', background: '#eff6ff', color: '#1d4ed8', fontWeight: 700,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 },
  kucuk: { fontSize: 13, color: '#64748b' },
  waBtn: { background: '#16a34a', color: '#fff', borderRadius: 8, padding: '6px 10px',
    textDecoration: 'none', fontSize: 12, fontWeight: 600 },
};
