import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

const DURUMLAR = {
  bekliyor: { ad: 'Bekliyor', renk: '#b45309', zemin: '#fef3c7' },
  basladi: { ad: 'Başlandı', renk: '#1d4ed8', zemin: '#dbeafe' },
  tamamlandi: { ad: 'Tamamlandı', renk: '#15803d', zemin: '#dcfce7' },
};

const ODEME = {
  bekliyor: { ad: 'Ödeme bekliyor', renk: '#dc2626', zemin: '#fee2e2' },
  kismi: { ad: 'Kısmi ödendi', renk: '#b45309', zemin: '#fef3c7' },
  odendi: { ad: 'Ödendi', renk: '#15803d', zemin: '#dcfce7' },
};

const SEKMELER = [
  { id: 'aktif', ad: 'Aktif' },
  { id: 'bekliyor', ad: 'Bekliyor' },
  { id: 'basladi', ad: 'Başlandı' },
  { id: 'tamamlandi', ad: 'Tamamlandı' },
  { id: 'tumu', ad: 'Tümü' },
];

const yerel = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const trTarih = (t) => (t ? new Date(t + 'T00:00:00').toLocaleDateString('tr-TR') : '-');
const tl = (n) => `${Number(n || 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} TL`;
const sayi = (v) => {
  const n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? 0 : n;
};

function odemeDurumu(odenen, toplam) {
  if (odenen <= 0) return 'bekliyor';
  if (odenen < toplam) return 'kismi';
  return 'odendi';
}

const bosForm = {
  customer_id: '', equipment_id: '', maintenance_rule_id: '', title: '', description: '',
  scheduled_date: yerel(new Date()), assigned_to: '', labor_cost: '',
};

export default function WorkOrdersPage() {
  const [isler, setIsler] = useState([]);
  const [musteriler, setMusteriler] = useState([]);
  const [form, setForm] = useState(bosForm);
  const [malzemeler, setMalzemeler] = useState([]);
  const [formAcik, setFormAcik] = useState(false);
  const [sekme, setSekme] = useState('aktif');
  const [arama, setArama] = useState('');
  const [yukleniyor, setYukleniyor] = useState(true);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [hata, setHata] = useState('');

  async function yukle() {
    setYukleniyor(true);
    const [{ data: w, error: wHata }, { data: m }] = await Promise.all([
      supabase.from('work_orders')
        .select('*, customers(name, phone, address), equipment(category, equipment_type)')
        .order('created_at', { ascending: false }),
      supabase.from('customers')
        .select('id, name, equipment(id, category, equipment_type, maintenance_rules(id, rule_name, next_due_date))')
        .order('name', { ascending: true }),
    ]);
    if (wHata) setHata(wHata.message);
    setIsler(w || []);
    setMusteriler(m || []);
    setYukleniyor(false);
  }

  useEffect(() => { yukle(); }, []);

  const seciliMusteri = musteriler.find((m) => m.id === form.customer_id);
  const cihazlar = seciliMusteri?.equipment || [];
  const seciliCihaz = cihazlar.find((e) => e.id === form.equipment_id);
  const bakimlar = seciliCihaz?.maintenance_rules || [];

  const malzemeToplam = malzemeler.reduce((t, x) => t + sayi(x.adet) * sayi(x.fiyat), 0);
  const genelToplam = malzemeToplam + sayi(form.labor_cost);

  function malzemeEkle() {
    setMalzemeler([...malzemeler, { ad: '', adet: '1', fiyat: '' }]);
  }
  function malzemeDegis(i, alan, deger) {
    setMalzemeler(malzemeler.map((x, j) => (j === i ? { ...x, [alan]: deger } : x)));
  }
  function malzemeSil(i) {
    setMalzemeler(malzemeler.filter((_, j) => j !== i));
  }

  function bakimSec(id) {
    const b = bakimlar.find((x) => x.id === id);
    setForm({ ...form, maintenance_rule_id: id, title: b ? b.rule_name : form.title });
  }

  function formuKapat() {
    setForm(bosForm);
    setMalzemeler([]);
    setFormAcik(false);
  }

  async function kaydet(e) {
    e.preventDefault();
    setHata('');
    if (!form.customer_id) { setHata('Müşteri seçin.'); return; }
    if (!form.title.trim()) { setHata('Yapılacak işi yazın.'); return; }
    setKaydediliyor(true);
    const temizMalzeme = malzemeler
      .filter((x) => x.ad.trim())
      .map((x) => ({ ad: x.ad.trim(), adet: sayi(x.adet), fiyat: sayi(x.fiyat) }));
    const kayit = {
      customer_id: form.customer_id,
      equipment_id: form.equipment_id || null,
      maintenance_rule_id: form.maintenance_rule_id || null,
      category: seciliCihaz?.category || null,
      title: form.title.trim(),
      description: form.description,
      scheduled_date: form.scheduled_date || null,
      assigned_to: form.assigned_to,
      materials: temizMalzeme,
      material_cost: malzemeToplam,
      labor_cost: sayi(form.labor_cost),
    };
    const { error } = await supabase.from('work_orders').insert([kayit]);
    setKaydediliyor(false);
    if (error) { setHata(error.message); return; }
    formuKapat();
    yukle();
  }

  async function durumDegis(is, yeni) {
    const guncelleme = { status: yeni };
    if (yeni === 'tamamlandi') {
      if (!window.confirm('İş tamamlandı olarak işaretlensin mi?')) return;
      guncelleme.completed_date = yerel(new Date());
    }
    const { error } = await supabase.from('work_orders').update(guncelleme).eq('id', is.id);
    if (error) { setHata(error.message); return; }
    if (yeni === 'tamamlandi' && is.maintenance_rule_id) {
      await supabase.from('maintenance_rules')
        .update({ last_service_date: yerel(new Date()) })
        .eq('id', is.maintenance_rule_id);
    }
    yukle();
  }

  async function tahsilat(is) {
    const toplam = sayi(is.material_cost) + sayi(is.labor_cost);
    const kalan = toplam - sayi(is.paid_amount);
    const giris = window.prompt(`Alınan tutar (TL)\nKalan borç: ${tl(kalan)}`, kalan > 0 ? String(kalan) : '');
    if (giris === null) return;
    const tutar = sayi(giris);
    if (tutar <= 0) return;
    const yeniOdenen = sayi(is.paid_amount) + tutar;
    const { error } = await supabase.from('work_orders')
      .update({ paid_amount: yeniOdenen, payment_status: odemeDurumu(yeniOdenen, toplam) })
      .eq('id', is.id);
    if (error) setHata(error.message);
    yukle();
  }

  async function sil(id) {
    if (!window.confirm('Bu iş emri silinsin mi?')) return;
    const { error } = await supabase.from('work_orders').delete().eq('id', id);
    if (error) setHata(error.message);
    yukle();
  }

  const sayac = (id) => isler.filter((x) =>
    id === 'tumu' ? true : id === 'aktif' ? x.status !== 'tamamlandi' : x.status === id
  ).length;

  const filtreli = isler.filter((x) => {
    if (sekme === 'aktif' && x.status === 'tamamlandi') return false;
    if (!['aktif', 'tumu'].includes(sekme) && x.status !== sekme) return false;
    const q = arama.toLowerCase();
    return !q || [x.title, x.customers?.name, x.assigned_to, x.customers?.address]
      .join(' ').toLowerCase().includes(q);
  });

  return (
    <div style={s.sayfa}>
      <div style={s.ust}>
        <div>
          <h1 style={s.baslik}>İş Emirleri</h1>
          <p style={s.altBaslik}>{sayac('aktif')} aktif iş</p>
        </div>
        <button style={s.anaBtn} onClick={() => (formAcik ? formuKapat() : setFormAcik(true))}>
          {formAcik ? 'Kapat' : '+ Yeni İş Emri'}
        </button>
      </div>

      {hata && <div style={s.hata}>{hata}</div>}

      {formAcik && (
        <form onSubmit={kaydet} style={s.kart}>
          <div style={s.adim}><span style={s.adimNo}>1</span> Müşteri ve cihaz</div>
          <div style={s.grid}>
            <label style={s.etiket}>Müşteri *
              <select style={s.input} value={form.customer_id}
                onChange={(e) => setForm({ ...form, customer_id: e.target.value, equipment_id: '', maintenance_rule_id: '' })}>
                <option value="">Seçin</option>
                {musteriler.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
            {cihazlar.length > 0 && (
              <label style={s.etiket}>Cihaz (isteğe bağlı)
                <select style={s.input} value={form.equipment_id}
                  onChange={(e) => setForm({ ...form, equipment_id: e.target.value, maintenance_rule_id: '' })}>
                  <option value="">Seçilmedi</option>
                  {cihazlar.map((c) => (
                    <option key={c.id} value={c.id}>{c.category} · {c.equipment_type}</option>
                  ))}
                </select>
              </label>
            )}
            {bakimlar.length > 0 && (
              <label style={s.etiket}>Bakım (seçerseniz takvim otomatik güncellenir)
                <select style={s.input} value={form.maintenance_rule_id}
                  onChange={(e) => bakimSec(e.target.value)}>
                  <option value="">Bakım değil / seçilmedi</option>
                  {bakimlar.map((b) => (
                    <option key={b.id} value={b.id}>{b.rule_name} · {trTarih(b.next_due_date)}</option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div style={s.adim}><span style={s.adimNo}>2</span> Yapılacak iş</div>
          <div style={s.grid}>
            <label style={s.etiket}>İş tanımı *
              <input style={s.input} placeholder="Örn: Dalgıç pompa değişimi" value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
            <label style={s.etiket}>Tarih
              <input type="date" style={s.input} value={form.scheduled_date}
                onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} />
            </label>
            <label style={s.etiket}>Personel
              <input style={s.input} placeholder="Örn: Eray" value={form.assigned_to}
                onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} />
            </label>
          </div>
          <label style={{ ...s.etiket, marginTop: 12 }}>Açıklama
            <textarea style={{ ...s.input, minHeight: 70, fontFamily: 'inherit' }} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>

          <div style={s.adim}><span style={s.adimNo}>3</span> Malzeme ve ücret</div>
          {malzemeler.map((x, i) => (
            <div key={i} style={s.malzemeSatir}>
              <input style={{ ...s.input, flex: 3, minWidth: 160 }} placeholder="Malzeme (örn: çekvalf)"
                value={x.ad} onChange={(e) => malzemeDegis(i, 'ad', e.target.value)} />
              <input style={{ ...s.input, flex: 1, minWidth: 70 }} placeholder="Adet" inputMode="decimal"
                value={x.adet} onChange={(e) => malzemeDegis(i, 'adet', e.target.value)} />
              <input style={{ ...s.input, flex: 1, minWidth: 100 }} placeholder="Birim fiyat" inputMode="decimal"
                value={x.fiyat} onChange={(e) => malzemeDegis(i, 'fiyat', e.target.value)} />
              <button type="button" style={s.xBtn} onClick={() => malzemeSil(i)}>✕</button>
            </div>
          ))}
          <button type="button" style={s.ekleBtn} onClick={malzemeEkle}>+ Malzeme ekle</button>

          <div style={{ ...s.grid, marginTop: 14 }}>
            <label style={s.etiket}>İşçilik ücreti (TL)
              <input style={s.input} inputMode="decimal" placeholder="0" value={form.labor_cost}
                onChange={(e) => setForm({ ...form, labor_cost: e.target.value })} />
            </label>
          </div>

          <div style={s.ozet}>
            <div>Malzeme: <b>{tl(malzemeToplam)}</b></div>
            <div>İşçilik: <b>{tl(sayi(form.labor_cost))}</b></div>
            <div style={s.toplam}>Toplam: {tl(genelToplam)}</div>
          </div>

          <button type="submit" disabled={kaydediliyor}
            style={{ ...s.anaBtn, marginTop: 16, width: '100%', padding: 16, fontSize: 17, opacity: kaydediliyor ? 0.6 : 1 }}>
            {kaydediliyor ? 'Kaydediliyor...' : 'İş Emrini Kaydet'}
          </button>
        </form>
      )}

      <div style={s.sekmeler}>
        {SEKMELER.map((t) => (
          <button key={t.id} onClick={() => setSekme(t.id)}
            style={{ ...s.sekmeBtn, ...(sekme === t.id ? s.sekmeAktif : {}) }}>
            {t.ad} ({sayac(t.id)})
          </button>
        ))}
      </div>

      <input style={{ ...s.input, marginBottom: 16 }} placeholder="İş, müşteri veya personel ara..."
        value={arama} onChange={(e) => setArama(e.target.value)} />

      {yukleniyor ? (
        <p style={s.altBaslik}>Yükleniyor...</p>
      ) : filtreli.length === 0 ? (
        <div style={s.kart}><p style={s.altBaslik}>Bu bölümde iş emri yok.</p></div>
      ) : (
        filtreli.map((x) => {
          const d = DURUMLAR[x.status] || DURUMLAR.bekliyor;
          const o = ODEME[x.payment_status] || ODEME.bekliyor;
          const toplam = sayi(x.material_cost) + sayi(x.labor_cost);
          const kalan = toplam - sayi(x.paid_amount);
          return (
            <div key={x.id} style={s.kart}>
              <div style={s.kartUst}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={s.no}>IS-{String(x.order_no).padStart(4, '0')}</div>
                  <div style={s.isAd}>{x.title}</div>
                  <div style={s.kucuk}>👤 {x.customers?.name || '-'}{x.customers?.address ? ` · 📍 ${x.customers.address}` : ''}</div>
                  {x.equipment && <div style={s.kucuk}>🛠️ {x.equipment.category} · {x.equipment.equipment_type}</div>}
                  <div style={s.kucuk}>
                    📅 {trTarih(x.scheduled_date)}{x.assigned_to ? ` · 👷 ${x.assigned_to}` : ''}
                    {x.completed_date ? ` · ✓ ${trTarih(x.completed_date)}` : ''}
                  </div>
                  {x.description && <div style={{ ...s.kucuk,
