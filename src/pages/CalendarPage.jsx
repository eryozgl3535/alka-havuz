import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const GUNLER = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const IKON = { Havuz: '🏊', Kuyu: '💧', Hidrofor: '🔵', Sulama: '🌱', Tesisat: '🔧', Elektrik: '⚡' };

const yerel = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function kalanGun(tarih) {
  if (!tarih) return null;
  const hedef = new Date(tarih + 'T00:00:00');
  const bugun = new Date(yerel(new Date()) + 'T00:00:00');
  return Math.round((hedef - bugun) / 86400000);
}

function durum(g) {
  if (g === null) return { etiket: '-', renk: '#94a3b8', zemin: '#f1f5f9' };
  if (g < 0) return { etiket: `${Math.abs(g)} gün gecikti`, renk: '#dc2626', zemin: '#fee2e2' };
  if (g === 0) return { etiket: 'Bugün', renk: '#b45309', zemin: '#fef3c7' };
  if (g <= 30) return { etiket: `${g} gün kaldı`, renk: '#b45309', zemin: '#fef3c7' };
  return { etiket: `${g} gün kaldı`, renk: '#1d4ed8', zemin: '#dbeafe' };
}

const trTarih = (t) => (t ? new Date(t + 'T00:00:00').toLocaleDateString('tr-TR') : '-');

function whatsappLink(tel, musteriAdi, bakimAdi, tarih) {
  if (!tel) return null;
  let n = tel.replace(/\D/g, '');
  if (n.startsWith('0')) n = '9' + n;
  if (!n.startsWith('90')) n = '90' + n;
  const mesaj =
    `ALKA Havuz: Sayın ${musteriAdi}, tarafımızdan takip edilen sisteminizin ` +
    `"${bakimAdi}" zamanı ${trTarih(tarih)} itibarıyla gelmektedir. ` +
    `Randevu oluşturmak için bu mesajı yanıtlayabilir veya 0533 371 39 35 numarasından bize ulaşabilirsiniz.`;
  return `https://wa.me/${n}?text=${encodeURIComponent(mesaj)}`;
}

const FILTRELER = [
  { id: 'gecikmis', ad: '🔴 Gecikmiş' },
  { id: 'hafta', ad: 'Bu hafta' },
  { id: 'otuz', ad: '30 gün' },
  { id: 'tumu', ad: 'Tümü' },
];

export default function CalendarPage() {
  const [kurallar, setKurallar] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState('');
  const [ay, setAy] = useState(new Date());
  const [seciliGun, setSeciliGun] = useState(null);
  const [filtre, setFiltre] = useState('otuz');

  async function yukle() {
    setYukleniyor(true);
    const { data, error } = await supabase
      .from('maintenance_rules')
      .select('*, equipment(*, customers(*))')
      .eq('active', true);
    if (error) setHata(error.message);
    setKurallar((data || []).filter((k) => k.next_due_date));
    setYukleniyor(false);
  }

  useEffect(() => { yukle(); }, []);

  async function yapildi(k) {
    if (!window.confirm(`"${k.rule_name}" bugün yapıldı olarak işaretlensin mi?`)) return;
    const { error } = await supabase
      .from('maintenance_rules')
      .update({ last_service_date: yerel(new Date()) })
      .eq('id', k.id);
    if (error) setHata(error.message);
    yukle();
  }

  const y = ay.getFullYear();
  const a = ay.getMonth();
  const ilkGun = (new Date(y, a, 1).getDay() + 6) % 7;
  const gunSayisi = new Date(y, a + 1, 0).getDate();
  const hucreler = [];
  for (let i = 0; i < ilkGun; i++) hucreler.push(null);
  for (let d = 1; d <= gunSayisi; d++) hucreler.push(d);
  const bugunStr = yerel(new Date());

  function gunKurallari(tarihStr) {
    return kurallar.filter((k) => k.next_due_date === tarihStr);
  }

  let liste;
  let listeBaslik;
  if (seciliGun) {
    liste = gunKurallari(seciliGun);
    listeBaslik = `${trTarih(seciliGun)} tarihli bakımlar`;
  } else {
    liste = kurallar.filter((k) => {
      const g = kalanGun(k.next_due_date);
      if (filtre === 'gecikmis') return g < 0;
      if (filtre === 'hafta') return g <= 7;
      if (filtre === 'otuz') return g <= 30;
      return true;
    });
    listeBaslik = FILTRELER.find((f) => f.id === filtre).ad.replace('🔴 ', '') + ' bakımlar';
  }
  liste = [...liste].sort((x, z) => x.next_due_date.localeCompare(z.next_due_date));

  return (
    <div style={s.sayfa}>
      <h1 style={s.baslik}>Bakım Takvimi</h1>
      <p style={s.altBaslik}>Tüm periyodik ve mevsimlik bakımlar</p>

      {hata && <div style={s.hata}>{hata}</div>}

      <div style={s.kart}>
        <div style={s.takvimUst}>
          <button style={s.okBtn} onClick={() => setAy(new Date(y, a - 1, 1))}>‹</button>
          <h2 style={s.ayBaslik}>{AYLAR[a]} {y}</h2>
          <button style={s.okBtn} onClick={() => setAy(new Date(y, a + 1, 1))}>›</button>
        </div>
        <div style={s.takvim}>
          {GUNLER.map((g) => <div key={g} style={s.gunBaslik}>{g}</div>)}
          {hucreler.map((d, i) => {
            if (!d) return <div key={i} />;
            const t = yerel(new Date(y, a, d));
            const o = gunKurallari(t);
            const secili = seciliGun === t;
            const bugunMu = t === bugunStr;
            let nokta = null;
            if (o.length) nokta = durum(kalanGun(t)).renk;
            return (
              <button key={i} onClick={() => setSeciliGun(secili ? null : t)}
                style={{ ...s.hucre, ...(bugunMu ? s.bugun : {}), ...(secili ? s.secili : {}) }}>
                <div>{d}</div>
                {o.length > 0 && (
                  <div style={{ ...s.sayac, background: nokta }}>{o.length}</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div style={s.filtreler}>
        {FILTRELER.map((f) => (
          <button key={f.id}
            onClick={() => { setFiltre(f.id); setSeciliGun(null); }}
            style={{ ...s.filtreBtn, ...(!seciliGun && filtre === f.id ? s.filtreAktif : {}) }}>
            {f.ad}
          </button>
        ))}
      </div>

      <div style={s.kart}>
        <div style={s.listeUst}>
          <h2 style={s.listeBaslik}>{listeBaslik} ({liste.length})</h2>
          {seciliGun && <button style={s.linkBtn} onClick={() => setSeciliGun(null)}>Seçimi kaldır ✕</button>}
        </div>

        {yukleniyor ? (
          <p style={s.bos}>Yükleniyor...</p>
        ) : liste.length === 0 ? (
          <p style={s.bos}>Bu aralıkta bakım yok.</p>
        ) : (
          liste.map((k) => {
            const e = k.equipment || {};
            const m = e.customers || {};
            const d = durum(kalanGun(k.next_due_date));
            const wa = whatsappLink(m.phone, m.name, k.rule_name, k.next_due_date);
            return (
              <div key={k.id} style={s.satir}>
                <div style={s.ikon}>{IKON[e.category] || '🛠️'}</div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={s.musteri}>{m.name || '-'}</div>
                  <div style={s.kucuk}>
                    {e.category} · {e.equipment_type}{m.address ? ` · 📍 ${m.address}` : ''}
                  </div>
                  <div style={s.bakim}>{k.rule_name} · {trTarih(k.next_due_date)}</div>
                </div>
                <div style={{ ...s.rozet, color: d.renk, background: d.zemin }}>{d.etiket}</div>
                <div style={s.butonlar}>
                  {wa && <a href={wa} target="_blank" rel="noreferrer" style={s.waBtn}>WhatsApp hatırlat</a>}
                  <button style={s.yapildiBtn} onClick={() => yapildi(k)}>✓ Yapıldı</button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const s = {
  sayfa: { padding: 20, maxWidth: 1000, margin: '0 auto', fontFamily: 'system-ui, sans-serif' },
  baslik: { margin: 0, fontSize: 26, color: '#0f2d4a' },
  altBaslik: { margin: '4px 0 20px', color: '#64748b', fontSize: 14 },
  hata: { background: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 10, marginBottom: 14 },
  kart: { background: '#fff', borderRadius: 16, padding: 18, marginBottom: 16,
    boxShadow: '0 2px 12px rgba(15,45,74,0.08)' },
  takvimUst: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  ayBaslik: { margin: 0, fontSize: 20, color: '#0f2d4a' },
  okBtn: { width: 38, height: 38, borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff',
    cursor: 'pointer', fontSize: 20 },
  takvim: { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 },
  gunBaslik: { textAlign: 'center', fontWeight: 700, fontSize: 13, color: '#0f2d4a', padding: '6px 0' },
  hucre: { minHeight: 58, border: '1px solid #eef2f6', borderRadius: 10, background: '#fff', cursor: 'pointer',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
    fontSize: 15, color: '#334155' },
  bugun: { borderColor: '#1d6fe0', borderWidth: 2, fontWeight: 700, color: '#1d6fe0' },
  secili: { background: '#1d6fe0', color: '#fff', borderColor: '#1d6fe0' },
  sayac: { minWidth: 20, height: 20, borderRadius: 10, color: '#fff', fontSize: 11, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' },
  filtreler: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 },
  filtreBtn: { padding: '10px 16px', borderRadius: 20, border: '1px solid #cbd5e1', background: '#fff',
    cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#334155' },
  filtreAktif: { background: '#0f2d4a', color: '#fff', borderColor: '#0f2d4a' },
  listeUst: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  listeBaslik: { margin: 0, fontSize: 18, color: '#0f2d4a' },
  linkBtn: { background: 'none', border: 'none', color: '#1d6fe0', fontWeight: 600, cursor: 'pointer' },
  bos: { color: '#64748b', fontSize: 14, margin: 0 },
  satir: { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderTop: '1px solid #eef2f6',
    flexWrap: 'wrap' },
  ikon: { width: 50, height: 50, borderRadius: 10, background: '#eef2f6', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 24 },
  musteri: { fontWeight: 700, color: '#0f2d4a', fontSize: 16 },
  kucuk: { fontSize: 13, color: '#64748b', marginTop: 2 },
  bakim: { fontSize: 14, color: '#334155', marginTop: 4, fontWeight: 600 },
  rozet: { padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' },
  butonlar: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  waBtn: { background: '#16a34a', color: '#fff', borderRadius: 8, padding: '9px 12px',
    textDecoration: 'none', fontSize: 13, fontWeight: 600 },
  yapildiBtn: { background: '#0f2d4a', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 12px',
    fontWeight: 600, cursor: 'pointer', fontSize: 13 },
};
