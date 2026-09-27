import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

const KOVA = 'servis-fotolari';

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

function telefonWa(tel) {
  if (!tel) return null;
  let n = tel.replace(/\D/g, '');
  if (n.startsWith('0')) n = '9' + n;
  if (!n.startsWith('90')) n = '90' + n;
  return n;
}

function kucult(dosya, max = 1600, kalite = 0.8) {
  return new Promise((coz, reddet) => {
    const adres = URL.createObjectURL(dosya);
    const img = new Image();
    img.onload = () => {
      const oran = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * oran);
      const h = Math.round(img.height * oran);
      const tuval = document.createElement('canvas');
      tuval.width = w;
      tuval.height = h;
      tuval.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(adres);
      tuval.toBlob((b) => (b ? coz(b) : reddet(new Error('Görsel dönüştürülemedi'))), 'image/jpeg', kalite);
    };
    img.onerror = () => {
      URL.revokeObjectURL(adres);
      reddet(new Error('Görsel okunamadı'));
    };
    img.src = adres;
  });
}

const bosForm = {
  customer_id: '', equipment_id: '', maintenance_rule_id: '', title: '', description: '',
  scheduled_date: yerel(new Date()), assigned_to: '', labor_cost: '',
};

function FotoAlan({ baslik, renk, liste, yukleniyor, onSec, onSil }) {
  return (
    <div style={{ flex: 1, minWidth: 240 }}>
      <div style={{ ...s.fotoBaslik, color: renk, borderColor: renk }}>
        {baslik} ({liste.length})
      </div>
      <div style={s.fotoIzgara}>
        {liste.map((f) => (
          <div key={f.url} style={s.fotoKutu}>
            <img src={f.url} alt={baslik} style={s.foto} onClick={() => window.open(f.url, '_blank')} />
            <button style={s.fotoSil} onClick={() => onSil(f)} title="Sil">✕</button>
          </div>
        ))}
        <label style={{ ...s.fotoEkle, borderColor: renk, color: renk, opacity: yukleniyor ? 0.6 : 1 }}>
          {yukleniyor ? 'Yükleniyor...' : '+ Fotoğraf'}
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={yukleniyor}
            style={{ display: 'none' }}
            onChange={(e) => {
              const dosyalar = Array.from(e.target.files || []);
              e.target.value = '';
              onSec(dosyalar);
            }}
          />
        </label>
      </div>
    </div>
  );
}

function IsKarti({ x, yenile, genelHata }) {
  const [panel, setPanel] = useState(false);
  const [yukleniyor, setYukleniyor] = useState('');
  const [yapilanlar, setYapilanlar] = useState(x.yapilanlar || '');
  const [mesaj, setMesaj] = useState(null);

  const d = DURUMLAR[x.status] || DURUMLAR.bekliyor;
  const o = ODEME[x.payment_status] || ODEME.bekliyor;
  const toplam = sayi(x.material_cost) + sayi(x.labor_cost);
  const kalan = toplam - sayi(x.paid_amount);
  const fotolar = x.fotograflar || [];
  const oncesi = fotolar.filter((f) => f.tur === 'oncesi');
  const sonrasi = fotolar.filter((f) => f.tur === 'sonrasi');
  const raporLink = x.rapor_token ? `${window.location.origin}/rapor/${x.rapor_token}` : '';

  const hata = (yazi) => setMesaj({ tur: 'hata', yazi });
  const tamam = (yazi) => setMesaj({ tur: 'ok', yazi });

  async function durumDegis(yeni) {
    const guncelleme = { status: yeni };
    if (yeni === 'tamamlandi') {
      if (!window.confirm('İş tamamlandı olarak işaretlensin mi?')) return;
      guncelleme.completed_date = yerel(new Date());
    }
    const { error } = await supabase.from('work_orders').update(guncelleme).eq('id', x.id);
    if (error) { genelHata(error.message); return; }
    if (yeni === 'tamamlandi' && x.maintenance_rule_id) {
      await supabase.from('maintenance_rules')
        .update({ last_service_date: yerel(new Date()) })
        .eq('id', x.maintenance_rule_id);
    }
    if (yeni === 'tamamlandi') setPanel(true);
    yenile();
  }

  async function tahsilat() {
    const giris = window.prompt(`Alınan tutar (TL)\nKalan borç: ${tl(kalan)}`, kalan > 0 ? String(kalan) : '');
    if (giris === null) return;
    const tutar = sayi(giris);
    if (tutar <= 0) return;
    const yeniOdenen = sayi(x.paid_amount) + tutar;
    const { error } = await supabase.from('work_orders')
      .update({ paid_amount: yeniOdenen, payment_status: odemeDurumu(yeniOdenen, toplam) })
      .eq('id', x.id);
    if (error) genelHata(error.message);
    yenile();
  }

  async function sil() {
    if (!window.confirm('Bu iş emri silinsin mi? Fotoğrafları da silinir.')) return;
    const yollar = fotolar.map((f) => f.path).filter(Boolean);
    if (yollar.length) await supabase.storage.from(KOVA).remove(yollar);
    const { error } = await supabase.from('work_orders').delete().eq('id', x.id);
    if (error) genelHata(error.message);
    yenile();
  }

  async function fotoYukle(tur, dosyalar) {
    if (!dosyalar.length) return;
    setYukleniyor(tur);
    setMesaj(null);
    const yeniler = [];
    try {
      for (const dosya of dosyalar) {
        const blob = await kucult(dosya);
        const yol = `${x.id}/${tur}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await supabase.storage.from(KOVA).upload(yol, blob, { contentType: 'image/jpeg' });
        if (error) throw error;
        const { data } = supabase.storage.from(KOVA).getPublicUrl(yol);
        yeniler.push({ url: data.publicUrl, path: yol, tur });
      }
    } catch (e) {
      hata('Fotoğraf yüklenemedi: ' + e.message);
    }
    if (yeniler.length) {
      const { error } = await supabase.from('work_orders')
        .update({ fotograflar: [...fotolar, ...yeniler] })
        .eq('id', x.id);
      if (error) hata(error.message);
      else tamam(`${yeniler.length} fotoğraf eklendi.`);
      yenile();
    }
    setYukleniyor('');
  }

  async function fotoSil(f) {
    if (!window.confirm('Bu fotoğraf silinsin mi?')) return;
    if (f.path) await supabase.storage.from(KOVA).remove([f.path]);
    const { error } = await supabase.from('work_orders')
      .update({ fotograflar: fotolar.filter((y) => y.url !== f.url) })
      .eq('id', x.id);
    if (error) hata(error.message);
    yenile();
  }

  async function yapilanlarKaydet() {
    const { error } = await supabase.from('work_orders').update({ yapilanlar }).eq('id', x.id);
    if (error) hata(error.message);
    else { tamam('Yapılan işlemler kaydedildi.'); yenile(); }
  }

  function whatsappGonder() {
    const numara = telefonWa(x.customers?.phone);
    if (!numara) { hata('Müşterinin telefon numarası kayıtlı değil. Müşteriler sayfasından ekleyebilirsiniz.'); return; }
    if (!raporLink) { hata('Rapor bağlantısı oluşturulamadı.'); return; }
    const ad = x.customers?.name ? `Sayın ${x.customers.name}, ` : '';
    const metin =
      `${ad}ALKA Havuz olarak "${x.title}" işinizin servis raporu hazır. ` +
      `Yapılan işlemleri, öncesi/sonrası fotoğrafları ve bir sonraki bakım tarihinizi buradan görebilirsiniz:\n${raporLink}`;
    window.open(`https://wa.me/${numara}?text=${encodeURIComponent(metin)}`, '_blank');
  }

  async function linkKopyala() {
    try {
      await navigator.clipboard.writeText(raporLink);
      tamam('Rapor linki kopyalandı.');
    } catch {
      window.prompt('Linki kopyalayın:', raporLink);
    }
  }

  return (
    <div style={s.kart}>
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
          {x.description && <div style={{ ...s.kucuk, marginTop: 6 }}>📝 {x.description}</div>}
          {(x.materials || []).length > 0 && (
            <div style={s.malzemeListe}>
              {x.materials.map((mz, i) => (
                <div key={i}>• {mz.adet} × {mz.ad}{mz.fiyat ? ` (${tl(mz.fiyat)})` : ''}</div>
              ))}
            </div>
          )}
        </div>
        <div style={s.sagTaraf}>
          <span style={{ ...s.rozet, color: d.renk, background: d.zemin }}>{d.ad}</span>
          <div style={s.tutar}>{tl(toplam)}</div>
          <span style={{ ...s.rozet, color: o.renk, background: o.zemin }}>{o.ad}</span>
          {kalan > 0 && sayi(x.paid_amount) > 0 && <div style={s.kucuk}>Kalan: {tl(kalan)}</div>}
        </div>
      </div>

      <div style={s.aksiyonlar}>
        {x.status === 'bekliyor' && <button style={s.mavBtn} onClick={() => durumDegis('basladi')}>▶ Başlat</button>}
        {x.status !== 'tamamlandi' && <button style={s.yesilBtn} onClick={() => durumDegis('tamamlandi')}>✓ Tamamla</button>}
        {x.payment_status !== 'odendi' && toplam > 0 && (
          <button style={s.tahsilBtn} onClick={tahsilat}>💰 Tahsilat gir</button>
        )}
        <button style={{ ...s.raporBtn, ...(panel ? s.raporBtnAcik : {}) }} onClick={() => setPanel(!panel)}>
          📷 Fotoğraf & Rapor{fotolar.length ? ` (${fotolar.length})` : ''}
        </button>
        <button style={s.silBtn} onClick={sil}>Sil</button>
      </div>

      {panel && (
        <div style={s.panel}>
          {mesaj && (
            <div style={{ ...s.mesaj, ...(mesaj.tur === 'ok' ? s.mesajOk : s.mesajHata) }}>
              {mesaj.tur === 'ok' ? '✓ ' : ''}{mesaj.yazi}
            </div>
          )}

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <FotoAlan baslik="İŞLEM ÖNCESİ" renk="#b45309" liste={oncesi} yukleniyor={yukleniyor === 'oncesi'}
              onSec={(f) => fotoYukle('oncesi', f)} onSil={fotoSil} />
            <FotoAlan baslik="İŞLEM SONRASI" renk="#15803d" liste={sonrasi} yukleniyor={yukleniyor === 'sonrasi'}
              onSec={(f) => fotoYukle('sonrasi', f)} onSil={fotoSil} />
          </div>

          <label style={{ ...s.etiket, marginTop: 16 }}>Yapılan işlemler (raporda görünür)
            <textarea style={{ ...s.input, minHeight: 80, fontFamily: 'inherit' }} value={yapilanlar}
              placeholder="Örn: Filtre ters yıkaması yapıldı, pompa ön filtresi temizlendi, pH 7,4'e ayarlandı."
              onChange={(e) => setYapilanlar(e.target.value)} />
          </label>
          <button style={s.kaydetBtn} onClick={yapilanlarKaydet}>Kaydet</button>

          <div style={s.raporSatir}>
            <div style={s.raporBaslik}>📄 Servis raporu</div>
            <div style={s.raporButonlar}>
              <button style={s.acBtn} onClick={() => window.open(raporLink, '_blank')}>🔗 Raporu aç</button>
              <button style={s.waBtn} onClick={whatsappGonder}>💬 WhatsApp'tan gönder</button>
              <button style={s.kopyaBtn} onClick={linkKopyala}>📋 Linki kopyala</button>
            </div>
            {x.status !== 'tamamlandi' && (
              <div style={{ ...s.kucuk, marginTop: 8 }}>
                İpucu: Raporu genelde iş tamamlandıktan sonra gönderin; rapor "iş devam ediyor" olarak görünür.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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

  function malzemeEkle() { setMalzemeler([...malzemeler, { ad: '', adet: '1', fiyat: '' }]); }
  function malzemeDegis(i, alan, deger) {
    setMalzemeler(malzemeler.map((x, j) => (j === i ? { ...x, [alan]: deger } : x)));
  }
  function malzemeSil(i) { setMalzemeler(malzemeler.filter((_, j) => j !== i)); }

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

  const sayac = (id) => isler.filter((x) =>
    id === 'tumu' ? true : id === 'aktif' ? x.status !== 'tamamlandi' : x.status === id
  ).length;

  const filtreli = isler.filter((x) => {
    if (sekme === 'aktif' && x.status === 'tamamlandi') return false;
    if (!['aktif', 'tumu'].includes(sekme) && x.status !== sekme) return false;
    const q = arama.toLocaleLowerCase('tr-TR');
    return !q || [x.title, x.customers?.name, x.assigned_to, x.customers?.address]
      .join(' ').toLocaleLowerCase('tr-TR').includes(q);
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

      {hata && <div style={{ ...s.mesaj, ...s.mesajHata }}>{hata}</div>}

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
                <select style={s.input} value={form.maintenance_rule_id} onChange={(e) => bakimSec(e.target.value)}>
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
        filtreli.map((x) => <IsKarti key={x.id} x={x} yenile={yukle} genelHata={setHata} />)
      )}
    </div>
  );
}

const s = {
  sayfa: { padding: 20, maxWidth: 950, margin: '0 auto', fontFamily: 'system-ui, sans-serif' },
  ust: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12 },
  baslik: { margin: 0, fontSize: 26, color: '#0f2d4a' },
  altBaslik: { margin: '4px 0 0', color: '#64748b', fontSize: 14 },
  anaBtn: { background: 'linear-gradient(135deg,#1e5a82,#0f2d4a)', color: '#fff', border: 'none',
    borderRadius: 12, padding: '12px 18px', fontWeight: 600, cursor: 'pointer', fontSize: 15 },
  kart: { background: '#fff', borderRadius: 16, padding: 20, marginBottom: 14,
    boxShadow: '0 2px 12px rgba(15,45,74,0.08)' },
  adim: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 17, fontWeight: 700, color: '#0f2d4a',
    margin: '18px 0 12px' },
  adimNo: { width: 28, height: 28, borderRadius: '50%', background: '#1d6fe0', color: '#fff', fontSize: 14,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 },
  etiket: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, color: '#334155' },
  input: { padding: '11px 12px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 15,
    width: '100%', boxSizing: 'border-box' },
  malzemeSatir: { display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  xBtn: { width: 42, border: '1px solid #fecaca', background: '#fff', color: '#dc2626', borderRadius: 10,
    cursor: 'pointer', fontSize: 16 },
  ekleBtn: { background: '#eff6ff', color: '#1e5a82', border: '1px solid #bfdbfe', borderRadius: 10,
    padding: '10px 16px', fontWeight: 600, cursor: 'pointer' },
  ozet: { display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center', marginTop: 16, padding: 14,
    background: '#f8fafc', borderRadius: 12, fontSize: 15, color: '#334155' },
  toplam: { marginLeft: 'auto', fontSize: 20, fontWeight: 800, color: '#0f2d4a' },
  mesaj: { marginTop: 4, marginBottom: 12, padding: 12, borderRadius: 10, fontSize: 14 },
  mesajOk: { background: '#dcfce7', color: '#166534' },
  mesajHata: { background: '#fee2e2', color: '#991b1b' },
  sekmeler: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 },
  sekmeBtn: { padding: '10px 16px', borderRadius: 20, border: '1px solid #cbd5e1', background: '#fff',
    cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#334155' },
  sekmeAktif: { background: '#0f2d4a', color: '#fff', borderColor: '#0f2d4a' },
  kartUst: { display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' },
  no: { fontSize: 12, color: '#64748b', fontWeight: 600, letterSpacing: 0.5 },
  isAd: { fontSize: 18, fontWeight: 700, color: '#0f2d4a', margin: '2px 0 6px' },
  kucuk: { fontSize: 14, color: '#64748b', marginTop: 2 },
  malzemeListe: { fontSize: 13, color: '#475569', marginTop: 8, background: '#f8fafc', borderRadius: 8, padding: '8px 10px' },
  sagTaraf: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 },
  rozet: { padding: '6px 12px', borderRadius: 20, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' },
  tutar: { fontSize: 20, fontWeight: 800, color: '#0f2d4a' },
  aksiyonlar: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14, paddingTop: 14, borderTop: '1px solid #eef2f6' },
  mavBtn: { background: '#1d6fe0', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 14px', fontWeight: 600, cursor: 'pointer' },
  yesilBtn: { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 14px', fontWeight: 600, cursor: 'pointer' },
  tahsilBtn: { background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', borderRadius: 8,
    padding: '9px 14px', fontWeight: 600, cursor: 'pointer' },
  raporBtn: { background: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe', borderRadius: 8,
    padding: '9px 14px', fontWeight: 700, cursor: 'pointer' },
  raporBtnAcik: { background: '#6d28d9', color: '#fff', borderColor: '#6d28d9' },
  silBtn: { background: 'transparent', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8,
    padding: '9px 14px', cursor: 'pointer', marginLeft: 'auto' },
  panel: { marginTop: 14, padding: 16, background: '#faf9ff', border: '1px solid #ede9fe', borderRadius: 14 },
  fotoBaslik: { fontSize: 12, fontWeight: 800, letterSpacing: 2, borderBottom: '2px solid', paddingBottom: 6, marginBottom: 10 },
  fotoIzgara: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(96px,1fr))', gap: 8 },
  fotoKutu: { position: 'relative' },
  foto: { width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 10, cursor: 'zoom-in', display: 'block' },
  fotoSil: { position: 'absolute', top: 4, right: 4, width: 26, height: 26, borderRadius: '50%', border: 'none',
    background: 'rgba(0,0,0,0.6)', color: '#fff', cursor: 'pointer', fontSize: 12 },
  fotoEkle: { aspectRatio: '1 / 1', border: '2px dashed', borderRadius: 10, display: 'flex', alignItems: 'center',
    justifyContent: 'center', textAlign: 'center', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#fff', padding: 4 },
  kaydetBtn: { marginTop: 8, background: 'linear-gradient(135deg,#1e5a82,#0f2d4a)', color: '#fff', border: 'none',
    borderRadius: 10, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 14 },
  raporSatir: { marginTop: 18, paddingTop: 14, borderTop: '1px dashed #ddd6fe' },
  raporBaslik: { fontSize: 15, fontWeight: 800, color: '#0f2d4a', marginBottom: 10 },
  raporButonlar: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  acBtn: { background: '#fff', color: '#0f2d4a', border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 14px', fontWeight: 700, cursor: 'pointer' },
  waBtn: { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 14px', fontWeight: 700, cursor: 'pointer' },
  kopyaBtn: { background: '#eff6ff', color: '#1e5a82', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', fontWeight: 700, cursor: 'pointer' },
};
