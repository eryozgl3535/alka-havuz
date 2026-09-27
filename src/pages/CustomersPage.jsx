import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

const bosForm = { name: '', phone: '', address: '', notes: '' };

export default function CustomersPage() {
  const [musteriler, setMusteriler] = useState([]);
  const [form, setForm] = useState(bosForm);
  const [formAcik, setFormAcik] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState('');
  const [arama, setArama] = useState('');

  async function yukle() {
    setYukleniyor(true);
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('name', { ascending: true });
    if (error) setHata(error.message);
    setMusteriler(data || []);
    setYukleniyor(false);
  }

  useEffect(() => { yukle(); }, []);

  async function kaydet(e) {
    e.preventDefault();
    setHata('');
    if (!form.name.trim()) {
      setHata('Müşteri adı zorunlu.');
      return;
    }
    const { error } = await supabase.from('customers').insert([form]);
    if (error) { setHata(error.message); return; }
    setForm(bosForm);
    setFormAcik(false);
    yukle();
  }

  async function sil(id) {
    if (!window.confirm('Bu müşteri silinsin mi? Müşteriye ait ekipmanlar da silinir.')) return;
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
    return !q || [m.name, m.phone, m.address].join(' ').toLowerCase().includes(q);
  });

  const s = stiller;

  return (
    <div style={s.sayfa}>
      <div style={s.ust}>
        <div>
          <h1 style={s.baslik}>Müşteriler</h1>
          <p style={s.altBaslik}>{musteriler.length} kayıtlı müşteri</p>
        </div>
        <button style={s.anaBtn} onClick={() => setFormAcik(!formAcik)}>
          {formAcik ? 'Kapat' : '+ Müşteri Ekle'}
        </button>
      </div>

      {hata && <div style={s.hata}>{hata}</div>}

      {formAcik && (
        <form onSubmit={kaydet} style={s.kart}>
          <div style={s.grid}>
            <label style={s.etiket}>Ad Soyad *
              <input style={s.input} placeholder="Örn: Mehmet Yılmaz"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label style={s.etiket}>Telefon
              <input style={s.input} placeholder="05XX XXX XX XX" type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>
            <label style={s.etiket}>Adres
              <input style={s.input} placeholder="Örn: Alaçatı, Çeşme"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </label>
            <label style={s.etiket}>Not
              <input style={s.input}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
          </div>
          <button type="submit" style={{ ...s.anaBtn, marginTop: 16, width: '100%' }}>
            Kaydet
          </button>
        </form>
      )}

      <input style={{ ...s.input, marginBottom: 16 }} placeholder="İsim, telefon veya adres ara..."
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
                {m.phone && (
                  <a href={`tel:${m.phone}`} style={s.araBtn}>Ara</a>
                )}
                {whatsappLink(m.phone) && (
                  <a href={whatsappLink(m.phone)} target="_blank" rel="noreferrer" style={s.waBtn}>
                    WhatsApp
                  </a>
                )}
                <button style={s.silBtn} onClick={() => sil(m.id)}>Sil</button>
              </div>
            </div>
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
};
