import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

const KATEGORILER = ['Havuz', 'Kuyu', 'Hidrofor', 'Sulama', 'Tesisat', 'Elektrik'];

const HAZIR_KURALLAR = [
  { ad: 'Hidrofor hava kontrolü', ay: 3 },
  { ad: 'Pompa genel kontrolü', ay: 12 },
  { ad: 'Havuz filtre kumu değişimi', ay: 24 },
  { ad: 'Havuz sezon açılışı', ay: 12 },
  { ad: 'Havuz sezon kapanışı', ay: 12 },
];

const bugun = () => new Date().toISOString().slice(0, 10);

function kalanGun(tarih) {
  if (!tarih) return null;
  const fark = new Date(tarih) - new Date(bugun());
  return Math.round(fark / (1000 * 60 * 60 * 24));
}

function durum(tarih) {
  const g = kalanGun(tarih);
  if (g === null) return { renk: '#94a3b8', etiket: 'Tarih yok', ikon: '⚪' };
  if (g < 0) return { renk: '#dc2626', etiket: `${Math.abs(g)} gün gecikti`, ikon: '🔴' };
  if (g <= 30) return { renk: '#d97706', etiket: `${g} gün kaldı`, ikon: '🟡' };
  return { renk: '#16a34a', etiket: `${g} gün kaldı`, ikon: '🟢' };
}

const trTarih = (t) => (t ? new Date(t).toLocaleDateString('tr-TR') : '-');

const bosForm = {
  customer_id: '', category: 'Havuz', location: '', equipment_type: '',
  brand: '', model: '', install_date: bugun(), notes: '',
};

export default function EquipmentPage() {
  const [musteriler, setMusteriler] = useState([]);
  const [ekipmanlar, setEkipmanlar] = useState([]);
  const [form, setForm] = useState(bosForm);
  const [secilenKurallar, setSecilenKurallar] = useState([]);
  const [formAcik, setFormAcik] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState('');
  const [arama, setArama] = useState('');

  async function yukle() {
    setYukleniyor(true);
    const { data: m } = await supabase.from('customers').select('*');
    const { data: e, error } = await supabase
      .from('equipment')
      .select('*, maintenance_rules(*)')
      .order('created_at', { ascending: false });
    if (error) setHata(error.message);
    setMusteriler(m || []);
    setEkipmanlar(e || []);
    setYukleniyor(false);
  }

  useEffect(() => { yukle(); }, []);

  const musteriAdi = (id) => {
    const m = musteriler.find((x) => x.id === id);
    return m ? (m.name || m.full_name || m.ad_soyad || 'İsimsiz') : '-';
  };

  function kuralSec(k) {
    setSecilenKurallar((onceki) =>
      onceki.find((x) => x.ad === k.ad) ? onceki.filter((x) => x.ad !== k.ad) : [...onceki, k]
    );
  }

  async function kaydet(e) {
    e.preventDefault();
    setHata('');
    if (!form.customer_id || !form.equipment_type) {
      setHata('Müşteri ve ekipman tipi zorunlu.');
      return;
    }
    const { data: yeni, error } = await supabase
      .from('equipment').insert([form]).select().single();
    if (error) { setHata(error.message); return; }

    if (secilenKurallar.length) {
      const kurallar = secilenKurallar.map((k) => ({
        equipment_id: yeni.id,
        rule_name: k.ad,
        period_months: k.ay,
        last_service_date: form.install_date,
      }));
      const { error: kHata } = await supabase.from('maintenance_rules').insert(kurallar);
      if (kHata) setHata(kHata.message);
    }
    setForm(bosForm);
    setSecilenKurallar([]);
    setFormAcik(false);
    yukle();
  }

  async function bakimYapildi(kural) {
    if (!window.confirm(`"${kural.rule_name}" bugün yapıldı olarak işaretlensin mi?`)) return;
    const { error } = await supabase
      .from('maintenance_rules')
      .update({ last_service_date: bugun() })
      .eq('id', kural.id);
    if (error) setHata(error.message);
    yukle();
  }

  async function ekipmanSil(id) {
    if (!window.confirm('Bu ekipman ve bakım kuralları silinsin mi?')) return;
    await supabase.from('equipment').delete().eq('id', id);
    yukle();
  }

  const filtreli = ekipmanlar.filter((e) => {
    const q = arama.toLowerCase();
    return !q || [musteriAdi(e.customer_id), e.equipment_type, e.brand, e.category]
      .join(' ').toLowerCase().includes(q);
  });

  const s = stiller;

  return (
    <div style={s.sayfa}>
      <div style={s.ust}>
        <div>
          <h1 style={s.baslik}>Ekipman Sicili</h1>
          <p style={s.altBaslik}>Her cihazın dijital bakım karnesi</p>
        </div>
        <button style={s.anaBtn} onClick={() => setFormAcik(!formAcik)}>
          {formAcik ? 'Kapat' : '+ Ekipman Ekle'}
        </button>
      </div>

      {hata && <div style={s.hata}>{hata}</div>}

      {formAcik && (
        <form onSubmit={kaydet} style={s.kart}>
          <div style={s.grid}>
            <label style={s.etiket}>Müşteri *
              <select style={s.input} value={form.customer_id}
                onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
                <option value="">Seçin</option>
                {musteriler.map((m) => (
                  <option key={m.id} value={m.id}>{m.name || m.full_name || m.ad_soyad}</option>
                ))}
              </select>
            </label>
            <label style={s.etiket}>Kategori
              <select style={s.input} value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {KATEGORILER.map((k) => <option key={k}>{k}</option>)}
              </select>
            </label>
            <label style={s.etiket}>Ekipman tipi *
              <input style={s.input} placeholder="Örn: Kum Filtresi, Dalgıç Pompa"
                value={form.equipment_type}
                onChange={(e) => setForm({ ...form, equipment_type: e.target.value })} />
            </label>
            <label style={s.etiket}>Konum
              <input style={s.input} placeholder="Örn: Makine Dairesi"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </label>
            <label style={s.etiket}>Marka
              <input style={s.input} value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            </label>
            <label style={s.etiket}>Model
              <input style={s.input} value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })} />
            </label>
            <label style={s.etiket}>Kurulum tarihi
              <input type="date" style={s.input} value={form.install_date}
                onChange={(e) => setForm({ ...form, install_date: e.target.value })} />
            </label>
            <label style={s.etiket}>Not
              <input style={s.input} value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={s.etiket}>Bakım periyotları (otomatik hatırlatma)</div>
            <div style={s.chipler}>
              {HAZIR_KURALLAR.map((k) => {
                const secili = secilenKurallar.find((x) => x.ad === k.ad);
                return (
                  <button type="button" key={k.ad} onClick={() => kuralSec(k)}
                    style={{ ...s.chip, ...(secili ? s.chipSecili : {}) }}>
                    {k.ad} · {k.ay} ay
                  </button>
                );
              })}
            </div>
          </div>

          <button type="submit" style={{ ...s.anaBtn, marginTop: 16, width: '100%' }}>
            Kaydet
          </button>
        </form>
      )}

      <input style={{ ...s.input, marginBottom: 16 }} placeholder="Müşteri, cihaz veya marka ara..."
        value={arama} onChange={(e) => setArama(e.target.value)} />

      {yukleniyor ? (
        <p style={s.altBaslik}>Yükleniyor...</p>
      ) : filtreli.length === 0 ? (
        <div style={s.kart}><p style={s.altBaslik}>Henüz ekipman kaydı yok.</p></div>
      ) : (
        filtreli.map((e) => (
          <div key={e.id} style={s.kart}>
            <div style={s.kartUst}>
              <div>
                <div style={s.kucuk}>{e.category}{e.location ? ` → ${e.location}` : ''}</div>
                <div style={s.cihaz}>{e.equipment_type}</div>
                <div style={s.kucuk}>Müşteri: {musteriAdi(e.customer_id)}</div>
                <div style={s.kucuk}>
                  {[e.brand, e.model].filter(Boolean).join(' ') || 'Marka/model yok'} · Kurulum: {trTarih(e.install_date)}
                </div>
              </div>
              <button style={s.silBtn} onClick={() => ekipmanSil(e.id)}>Sil</button>
            </div>

            {(e.maintenance_rules || []).map((k) => {
              const d = durum(k.next_due_date);
              return (
                <div key={k.id} style={{ ...s.kural, borderLeftColor: d.renk }}>
                  <div>
                    <div style={s.kuralAd}>{d.ikon} {k.rule_name}</div>
                    <div style={s.kucuk}>
                      Son: {trTarih(k.last_service_date)} · Sonraki: {trTarih(k.next_due_date)}
                    </div>
                    <div style={{ ...s.kucuk, color: d.renk, fontWeight: 600 }}>{d.etiket}</div>
                  </div>
                  <button style={s.yapildiBtn} onClick={() => bakimYapildi(k)}>✓ Yapıldı</button>
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}

const stiller = {
  sayfa: { padding: 20, maxWidth: 900, margin: '0 auto', fontFamily: 'system-ui, sans-serif' },
  ust: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12 },
  baslik: { margin: 0, fontSize: 26, color: '#0f2d4a' },
  altBaslik: { margin: '4px 0 0', color: '#64748b', fontSize: 14 },
  anaBtn: { background: 'linear-gradient(135deg,#1e5a82,#0f2d4a)', color: '#fff', border: 'none',
    borderRadius: 12, padding: '12px 18px', fontWeight: 600, cursor: 'pointer', fontSize: 15 },
  kart: { background: '#fff', borderRadius: 16, padding: 18, marginBottom: 14,
    boxShadow: '0 2px 12px rgba(15,45,74,0.08)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 },
  etiket: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, color: '#334155' },
  input: { padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 15,
    width: '100%', boxSizing: 'border-box' },
  chipler: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { padding: '8px 12px', borderRadius: 20, border: '1px solid #cbd5e1', background: '#f8fafc',
    cursor: 'pointer', fontSize: 13 },
  chipSecili: { background: '#1e5a82', color: '#fff', borderColor: '#1e5a82' },
  hata: { background: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 10, marginBottom: 14 },
  kartUst: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cihaz: { fontSize: 18, fontWeight: 700, color: '#0f2d4a', margin: '2px 0' },
  kucuk: { fontSize: 13, color: '#64748b' },
  kural: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
    background: '#f8fafc', borderLeft: '4px solid', borderRadius: 10, padding: '10px 12px', marginTop: 8 },
  kuralAd: { fontWeight: 600, color: '#1e293b', fontSize: 14 },
  yapildiBtn: { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8,
    padding: '8px 12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  silBtn: { background: 'transparent', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8,
    padding: '6px 10px', cursor: 'pointer', fontSize: 13 },
};
