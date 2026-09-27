import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

const KATEGORILER = ['Havuz', 'Kuyu', 'Hidrofor', 'Sulama', 'Tesisat', 'Elektrik'];

const HAZIR_KURALLAR = [
  { ad: 'Hidrofor hava kontrolü', ay: 3 },
  { ad: 'Pompa genel kontrolü', ay: 12 },
  { ad: 'Havuz filtre kumu değişimi', ay: 24 },
  { ad: 'Havuz sezon açılışı', ay: 12 },
  { ad: 'Havuz sezon kapanışı', ay: 12 },
  { ad: 'Havuz periyodik bakım', ay: 1 },
];

const yerel = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function kalanGun(tarih) {
  if (!tarih) return null;
  const hedef = new Date(tarih + 'T00:00:00');
  const bugun = new Date(yerel(new Date()) + 'T00:00:00');
  return Math.round((hedef - bugun) / 86400000);
}

function durum(g) {
  if (g === null) return { ikon: '⚪', renk: '#94a3b8', yazi: 'Tarih yok' };
  if (g < 0) return { ikon: '🔴', renk: '#dc2626', yazi: `${Math.abs(g)} gün gecikti` };
  if (g <= 30) return { ikon: '🟡', renk: '#b45309', yazi: `${g} gün kaldı` };
  return { ikon: '🟢', renk: '#16a34a', yazi: `${g} gün kaldı` };
}

const trTarih = (t) => (t ? new Date(t + 'T00:00:00').toLocaleDateString('tr-TR') : '-');

const bosMusteri = { name: '', phone: '', address: '', notes: '' };
const bosIs = { category: 'Havuz', equipment_type: '', location: '', brand: '', install_date: yerel(new Date()) };

export default function CustomersPage() {
  const [musteriler, setMusteriler] = useState([]);
  const [musteri, setMusteri] = useState(bosMusteri);
  const [is, setIs] = useState(bosIs);
  const [kurallar, setKurallar] = useState([]);
  const [ozelAd, setOzelAd] = useState('');
  const [ozelAy, setOzelAy] = useState('');
  const [formAcik, setFormAcik] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [hata, setHata] = useState('');
  const [arama, setArama] = useState('');

  async function yukle() {
    setYukleniyor(true);
    const { data, error } = await supabase
      .from('customers')
      .select('*, equipment(*, maintenance_rules(*))')
      .order('created_at', { ascending: false });
    if (error) setHata(error.message);
    setMusteriler(data || []);
    setYukleniyor(false);
  }

  useEffect(() => { yukle(); }, []);

  function kuralSec(k) {
    setKurallar((o) => (o.find((x) => x.ad === k.ad) ? o.filter((x) => x.ad !== k.ad) : [...o, k]));
  }

  function ozelEkle() {
    const ay = parseInt(ozelAy, 10);
    if (!ozelAd.trim() || !ay || ay < 1) {
      setHata('Özel bakım için ad ve ay sayısı girin.');
      return;
    }
    setKurallar((o) => [...o, { ad: ozelAd.trim(), ay }]);
    setOzelAd('');
    setOzelAy('');
    setHata('');
  }

  function formuKapat() {
    setMusteri(bosMusteri);
    setIs(bosIs);
    setKurallar([]);
    setFormAcik(false);
  }

  async function kaydet(e) {
    e.preventDefault();
    setHata('');
    if (!musteri.name.trim()) { setHata('Müşteri adı zorunlu.'); return; }
    if (kurallar.length && !is.equipment_type.trim()) {
      setHata('Bakım seçtiyseniz "Cihaz / İş" alanını da doldurun.');
      return;
    }
    setKaydediliyor(true);

    const { data: yeniMusteri, error: mHata } = await supabase
      .from('customers').insert([musteri]).select().single();
    if (mHata) { setHata(mHata.message); setKaydediliyor(false); return; }

    if (is.equipment_type.trim()) {
      const { data: yeniCihaz, error: eHata } = await supabase
        .from('equipment')
        .insert([{ ...is, customer_id: yeniMusteri.id }])
        .select().single();
      if (eHata) { setHata(eHata.message); setKaydediliyor(false); yukle(); return; }

      if (kurallar.length) {
        const satirlar = kurallar.map((k) => ({
          equipment_id: yeniCihaz.id,
          rule_name: k.ad,
          period_months: k.ay,
          last_service_date: is.install_date,
        }));
        const { error: kHata } = await supabase.from('maintenance_rules').insert(satirlar);
        if (kHata) setHata(kHata.message);
      }
    }

    setKaydediliyor(false);
    formuKapat();
    yukle();
  }

  async function sil(id) {
    if (!window.confirm('Bu müşteri silinsin mi? Cihazları ve bakım kayıtları da silinir.')) return;
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) setHata(error.message);
    yukle();
  }

  function whatsappLink(tel) {
    if (!tel) return null;
    let n = tel.replace(/\D/g, '');
    if (n.startsWith('0')) n = '9' + n;
    if (!n.startsWith('90')) n = '90' + n;
    return `https://wa.me/${n}`;
  }

  const filtreli = musteriler.filter((m) => {
    const q = arama.toLowerCase();
    const cihazlar = (m.equipment || []).map((e) => `${e.category} ${e.equipment_type}`).join(' ');
    return !q || [m.name, m.phone, m.address, cihazlar].join(' ').toLowerCase().includes(q);
  });

  return (
    <div style={s.sayfa}>
      <div style={s.ust}>
        <div>
          <h1 style={s.baslik}>Müşteriler</h1>
          <p style={s.altBaslik}>{musteriler.length} kayıtlı müşteri</p>
        </div>
        <button style={s.anaBtn} onClick={() => (formAcik ? formuKapat() : setFormAcik(true))}>
          {formAcik ? 'Kapat' : '+ Müşteri Ekle'}
        </button>
      </div>

      {hata && <div style={s.hata}>{hata}</div>}

      {formAcik && (
        <form onSubmit={kaydet} style={s.kart}>
          <div style={s.bolumBaslik}>👤 Müşteri Bilgileri</div>
          <div style={s.grid}>
            <label style={s.etiket}>Ad Soyad *
              <input style={s.input} placeholder="Örn: Mehmet Yılmaz" value={musteri.name}
                onChange={(e) => setMusteri({ ...musteri, name: e.target.value })} />
            </label>
            <label style={s.etiket}>Telefon
              <input style={s.input} placeholder="05XX XXX XX XX" type="tel" value={musteri.phone}
                onChange={(e) => setMusteri({ ...musteri, phone: e.target.value })} />
            </label>
            <label style={s.etiket}>Adres
              <input style={s.input} placeholder="Örn: Alaçatı, Çeşme" value={musteri.address}
                onChange={(e) => setMusteri({ ...musteri, address: e.target.value })} />
            </label>
            <label style={s.etiket}>Not
              <input style={s.input} value={musteri.notes}
                onChange={(e) => setMusteri({ ...musteri, notes: e.target.value })} />
            </label>
          </div>

          <div style={{ ...s.bolumBaslik, marginTop: 24 }}>🛠️ Ne için gidiyoruz?</div>
          <div style={s.grid}>
            <label style={s.etiket}>Kategori
              <select style={s.input} value={is.category}
                onChange={(e) => setIs({ ...is, category: e.target.value })}>
                {KATEGORILER.map((k) => <option key={k}>{k}</option>)}
              </select>
            </label>
            <label style={s.etiket}>Cihaz / İş
              <input style={s.input} placeholder="Örn: Kum filtresi, Dalgıç pompa, Hidrofor tankı"
                value={is.equipment_type}
                onChange={(e) => setIs({ ...is, equipment_type: e.target.value })} />
            </label>
            <label style={s.etiket}>Konum
              <input style={s.input} placeholder="Örn: Makine dairesi, Bahçe" value={is.location}
                onChange={(e) => setIs({ ...is, location: e.target.value })} />
            </label>
            <label style={s.etiket}>Marka / Model
              <input style={s.input} value={is.brand}
                onChange={(e) => setIs({ ...is, brand: e.target.value })} />
            </label>
            <label style={s.etiket}>Kurulum / Son bakım tarihi
              <input type="date" style={s.input} value={is.install_date}
                onChange={(e) => setIs({ ...is, install_date: e.target.value })} />
            </label>
          </div>

          <div style={{ ...s.etiket, marginTop: 16 }}>Bakım periyodu (sistem tarihi otomatik hesaplar)</div>
          <div style={s.chipler}>
            {HAZIR_KURALLAR.map((k) => {
              const secili = kurallar.find((x) => x.ad === k.ad);
              return (
                <button type="button" key={k.ad} onClick={() => kuralSec(k)}
                  style={{ ...s.chip, ...(secili ? s.chipSecili : {}) }}>
                  {k.ad} · {k.ay} ay
                </button>
              );
            })}
            {kurallar.filter((k) => !HAZIR_KURALLAR.find((h) => h.ad === k.ad)).map((k) => (
              <button type="button" key={k.ad} onClick={() => kuralSec(k)}
                style={{ ...s.chip, ...s.chipSecili }}>
                {k.ad} · {k.ay} ay ✕
              </button>
            ))}
          </div>

          <div style={s.ozelSatir}>
            <input style={{ ...s.input, flex: 2 }} placeholder="Listede yoksa: özel bakım adı"
              value={ozelAd} onChange={(e) => setOzelAd(e.target.value)} />
            <input style={{ ...s.input, flex: 1 }} placeholder="Kaç ayda bir" type="number" min="1"
              value={ozelAy} onChange={(e) => setOzelAy(e.target.value)} />
            <button type="button" style={s.ekleBtn} onClick={ozelEkle}>+ Ekle</button>
          </div>

          <button type="submit" disabled={kaydediliyor}
            style={{ ...s.anaBtn, marginTop: 20, width: '100%', opacity: kaydediliyor ? 0.6 : 1 }}>
            {kaydediliyor ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </form>
      )}

      <input style={{ ...s.input, marginBottom: 16 }} placeholder="İsim, telefon, adres veya cihaz ara..."
        value={arama} onChange={(e) => setArama(e.target.value)} />

      {yukleniyor ? (
        <p style={s.altBaslik}>Yükleniyor...</p>
      ) : filtreli.length === 0 ? (
        <div style={s.kart}><p style={s.altBaslik}>Henüz müşteri kaydı yok.</p></div>
      ) : (
        filtreli.map((m) => (
          <div key={m.id} style={s.kart}>
            <div style={s.kartUst}>
              <div>
                <div style={s.isim}>{m.name}</div>
                {m.phone && <div style={s.kucuk}>📞 {m.phone}</div>}
                {m.address && <div style={s.kucuk}>📍 {m.address}</div>}
                {m.notes && <div style={s.kucuk}>📝 {m.notes}</div>}
              </div>
              <div style={s.butonlar}>
                {m.phone && <a href={`tel:${m.phone}`} style={s.araBtn}>Ara</a>}
                {whatsappLink(m.phone) && (
                  <a href={whatsappLink(m.phone)} target="_blank" rel="noreferrer" style={s.waBtn}>WhatsApp</a>
                )}
                <button style={s.silBtn} onClick={() => sil(m.id)}>Sil</button>
              </div>
            </div>

            {(m.equipment || []).map((e) => (
              <div key={e.id} style={s.cihazKutu}>
                <div style={s.cihazAd}>
                  {e.category} · {e.equipment_type}
                  {e.location ? ` (${e.location})` : ''}
                </div>
                {(e.maintenance_rules || []).map((k) => {
                  const d = durum(kalanGun(k.next_due_date));
                  return (
                    <div key={k.id} style={{ ...s.kucuk, marginTop: 4 }}>
                      {d.ikon} {k.rule_name} · Sonraki: {trTarih(k.next_due_date)} ·{' '}
                      <span style={{ color: d.renk, fontWeight: 600 }}>{d.yazi}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}

const s = {
  sayfa: { padding: 20, maxWidth: 900, margin: '0 auto', fontFamily: 'system-ui, sans-serif' },
  ust: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12 },
  baslik: { margin: 0, fontSize: 26, color: '#0f2d4a' },
  altBaslik: { margin: '4px 0 0', color: '#64748b', fontSize: 14 },
  anaBtn: { background: 'linear-gradient(135deg,#1e5a82,#0f2d4a)', color: '#fff', border: 'none',
    borderRadius: 12, padding: '12px 18px', fontWeight: 600, cursor: 'pointer', fontSize: 15 },
  kart: { background: '#fff', borderRadius: 16, padding: 18, marginBottom: 14,
    boxShadow: '0 2px 12px rgba(15,45,74,0.08)' },
  bolumBaslik: { fontSize: 16, fontWeight: 700, color: '#0f2d4a', marginBottom: 12 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 },
  etiket: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, color: '#334155' },
  input: { padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 15,
    width: '100%', boxSizing: 'border-box' },
  chipler: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { padding: '8px 12px', borderRadius: 20, border: '1px solid #cbd5e1', background: '#f8fafc',
    cursor: 'pointer', fontSize: 13 },
  chipSecili: { background: '#1e5a82', color: '#fff', borderColor: '#1e5a82' },
  ozelSatir: { display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  ekleBtn: { background: '#eff6ff', color: '#1e5a82', border: '1px solid #bfdbfe', borderRadius: 10,
    padding: '10px 16px', fontWeight: 600, cursor: 'pointer' },
  hata: { background: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 10, marginBottom: 14 },
  kartUst: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' },
  isim: { fontSize: 18, fontWeight: 700, color: '#0f2d4a', marginBottom: 4 },
  kucuk: { fontSize: 14, color: '#64748b', marginTop: 2 },
  butonlar: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  araBtn: { background: '#1e5a82', color: '#fff', borderRadius: 8, padding: '8px 12px',
    textDecoration: 'none', fontSize: 13, fontWeight: 600 },
  waBtn: { background: '#16a34a', color: '#fff', borderRadius: 8, padding: '8px 12px',
    textDecoration: 'none', fontSize: 13, fontWeight: 600 },
  silBtn: { background: 'transparent', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8,
    padding: '8px 12px', cursor: 'pointer', fontSize: 13 },
  cihazKutu: { background: '#f8fafc', borderLeft: '4px solid #1e5a82', borderRadius: 10,
    padding: '10px 12px', marginTop: 10 },
  cihazAd: { fontWeight: 600, color: '#1e293b', fontSize: 14 },
};
