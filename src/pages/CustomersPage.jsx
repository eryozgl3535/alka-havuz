import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

const KATEGORI = {
  Havuz: {
    ikon: '🏊',
    cihazlar: ['Kum filtresi', 'Havuz motoru (pompa)', 'Isı pompası', 'Klor / tuz jeneratörü',
      'Dozaj pompası', 'Havuz aydınlatma', 'Havuz robotu', 'Genel havuz bakımı'],
    bakimlar: [
      { ad: 'Havuz periyodik bakım', ay: 1 },
      { ad: 'Su analizi (pH / klor)', ay: 1 },
      { ad: 'Havuz motoru kontrolü', ay: 12 },
      { ad: 'Filtre kumu değişimi', ay: 24 },
      { ad: 'Yaz öncesi genel kontrol', ayNo: 4, mevsim: true },
      { ad: 'Havuz sezon açılışı', ayNo: 5, mevsim: true },
      { ad: 'Havuz sezon kapanışı', ayNo: 11, mevsim: true },
    ],
  },
  Kuyu: {
    ikon: '💧',
    cihazlar: ['Dalgıç pompa', 'Kuyu motoru', 'Kontrol panosu', 'Çekvalf / vana', 'Kuyu kablosu', 'Genel kuyu bakımı'],
    bakimlar: [
      { ad: 'Pano / elektrik kontrolü', ay: 6 },
      { ad: 'Pompa genel kontrolü', ay: 12 },
      { ad: 'Su debisi ölçümü', ay: 12 },
      { ad: 'Yaz öncesi kuyu kontrolü', ayNo: 4, mevsim: true },
      { ad: 'Kış kontrolü (don)', ayNo: 1, mevsim: true },
    ],
  },
  Hidrofor: {
    ikon: '🔵',
    cihazlar: ['Hidrofor tankı', 'Hidrofor pompası', 'Basınç şalteri', 'Genleşme tankı', 'Genel hidrofor bakımı'],
    bakimlar: [
      { ad: 'Tank hava basıncı kontrolü', ay: 3 },
      { ad: 'Basınç şalteri kontrolü', ay: 6 },
      { ad: 'Pompa genel kontrolü', ay: 12 },
      { ad: 'Kış kontrolü (don)', ayNo: 1, mevsim: true },
    ],
  },
  Sulama: {
    ikon: '🌱',
    cihazlar: ['Sulama pompası', 'Sulama kontrol ünitesi', 'Damla sulama hattı', 'Fıskiye / sprinkler', 'Sulama filtresi'],
    bakimlar: [
      { ad: 'Sulama filtresi temizliği', ay: 3 },
      { ad: 'Sistem genel kontrolü', ay: 12 },
      { ad: 'Sulama sezon açılışı', ayNo: 4, mevsim: true },
      { ad: 'Sulama sezon kapanışı (boşaltma)', ayNo: 10, mevsim: true },
    ],
  },
  Tesisat: {
    ikon: '🔧',
    cihazlar: ['Temiz su tesisatı', 'Gider / pis su hattı', 'Kollektör / vana', 'Su arıtma / filtre', 'Termosifon / şofben'],
    bakimlar: [
      { ad: 'Su filtresi değişimi', ay: 6 },
      { ad: 'Genel tesisat kontrolü', ay: 12 },
      { ad: 'Kış kontrolü (don / boru)', ayNo: 1, mevsim: true },
    ],
  },
  Elektrik: {
    ikon: '⚡',
    cihazlar: ['Elektrik panosu', 'Motor / pompa bağlantısı', 'Kaçak akım rölesi', 'Dış aydınlatma'],
    bakimlar: [
      { ad: 'Pano kontrolü', ay: 6 },
      { ad: 'Kaçak akım testi', ay: 12 },
      { ad: 'Topraklama ölçümü', ay: 12 },
      { ad: 'Kış öncesi elektrik kontrolü', ayNo: 11, mevsim: true },
    ],
  },
};

const OZEL_SECENEKLER = [
  ...[1, 2, 3, 6, 12, 24].map((a) => ({ deger: `p-${a}`, yazi: `${a} ayda bir` })),
  ...AYLAR.map((ay, i) => ({ deger: `m-${i + 1}`, yazi: `Her yıl ${ay}` })),
];

const yerel = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function mevsimTarihi(ayNo) {
  const bugun = new Date();
  let hedef = new Date(bugun.getFullYear(), ayNo - 1, 1);
  if (yerel(hedef) <= yerel(bugun)) hedef = new Date(bugun.getFullYear() + 1, ayNo - 1, 1);
  return yerel(hedef);
}

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
const kuralYazi = (k) => (k.mevsim ? `her yıl ${AYLAR[k.ayNo - 1]}` : `${k.ay} ayda bir`);

const bosMusteri = { name: '', phone: '', address: '', notes: '' };

export default function CustomersPage() {
  const [musteriler, setMusteriler] = useState([]);
  const [musteri, setMusteri] = useState(bosMusteri);
  const [kategori, setKategori] = useState('');
  const [cihaz, setCihaz] = useState('');
  const [digerCihaz, setDigerCihaz] = useState('');
  const [konum, setKonum] = useState('');
  const [marka, setMarka] = useState('');
  const [tarih, setTarih] = useState(yerel(new Date()));
  const [kurallar, setKurallar] = useState([]);
  const [ozelAd, setOzelAd] = useState('');
  const [ozelSecim, setOzelSecim] = useState('p-12');
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

  function kategoriSec(k) {
    setKategori(kategori === k ? '' : k);
    setCihaz('');
    setDigerCihaz('');
    setKurallar([]);
  }

  function kuralSec(k) {
    setKurallar((o) => (o.find((x) => x.ad === k.ad) ? o.filter((x) => x.ad !== k.ad) : [...o, k]));
  }

  function ozelEkle() {
    if (!ozelAd.trim()) { setHata('Özel bakım için bir ad yazın.'); return; }
    const [tur, sayi] = ozelSecim.split('-');
    const n = parseInt(sayi, 10);
    const yeni = tur === 'm' ? { ad: ozelAd.trim(), ayNo: n, mevsim: true } : { ad: ozelAd.trim(), ay: n };
    setKurallar((o) => [...o, yeni]);
    setOzelAd('');
    setHata('');
  }

  function formuKapat() {
    setMusteri(bosMusteri);
    setKategori(''); setCihaz(''); setDigerCihaz('');
    setKonum(''); setMarka(''); setTarih(yerel(new Date()));
    setKurallar([]);
    setFormAcik(false);
  }

  const cihazAdi = cihaz === 'Diğer' ? digerCihaz.trim() : cihaz;

  async function kaydet(e) {
    e.preventDefault();
    setHata('');
    if (!musteri.name.trim()) { setHata('Müşteri adı zorunlu.'); return; }
    if (kategori && !cihazAdi) { setHata('Kategori seçtiyseniz cihaz / iş seçin.'); return; }
    setKaydediliyor(true);

    const { data: yeniMusteri, error: mHata } = await supabase
      .from('customers').insert([musteri]).select().single();
    if (mHata) { setHata(mHata.message); setKaydediliyor(false); return; }

    if (kategori && cihazAdi) {
      const { data: yeniCihaz, error: eHata } = await supabase
        .from('equipment')
        .insert([{
          customer_id: yeniMusteri.id, category: kategori, equipment_type: cihazAdi,
          location: konum, brand: marka, install_date: tarih,
        }])
        .select().single();
      if (eHata) { setHata(eHata.message); setKaydediliyor(false); yukle(); return; }

      if (kurallar.length) {
        const satirlar = kurallar.map((k) =>
          k.mevsim
            ? { equipment_id: yeniCihaz.id, rule_name: k.ad, period_months: 12,
                last_service_date: null, next_due_date: mevsimTarihi(k.ayNo) }
            : { equipment_id: yeniCihaz.id, rule_name: k.ad, period_months: k.ay,
                last_service_date: tarih }
        );
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

  const kat = kategori ? KATEGORI[kategori] : null;
  const ekstralar = kat ? kurallar.filter((k) => !kat.bakimlar.find((b) => b.ad === k.ad)) : [];

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
          <div style={s.adim}><span style={s.adimNo}>1</span> Müşteri bilgileri</div>
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

          <div style={s.adim}><span style={s.adimNo}>2</span> Ne için gidiyoruz?</div>
          <div style={s.kategoriler}>
            {Object.keys(KATEGORI).map((k) => (
              <button type="button" key={k} onClick={() => kategoriSec(k)}
                style={{ ...s.kategoriBtn, ...(kategori === k ? s.kategoriSecili : {}) }}>
                <span style={{ fontSize: 30 }}>{KATEGORI[k].ikon}</span>
                <span>{k}</span>
              </button>
            ))}
          </div>

          {kat && (
            <>
              <div style={s.adim}><span style={s.adimNo}>3</span> Hangi cihaz / iş?</div>
              <div style={s.chipler}>
                {[...kat.cihazlar, 'Diğer'].map((c) => (
                  <button type="button" key={c} onClick={() => setCihaz(c)}
                    style={{ ...s.chip, ...(cihaz === c ? s.chipSecili : {}) }}>
                    {c}
                  </button>
                ))}
              </div>
              {cihaz === 'Diğer' && (
                <input style={{ ...s.input, marginTop: 10 }} placeholder="Cihaz / iş adını yazın"
                  value={digerCihaz} onChange={(e) => setDigerCihaz(e.target.value)} />
              )}

              <div style={{ ...s.grid, marginTop: 14 }}>
                <label style={s.etiket}>Konum (isteğe bağlı)
                  <input style={s.input} placeholder="Örn: Makine dairesi, Bahçe" value={konum}
                    onChange={(e) => setKonum(e.target.value)} />
                </label>
                <label style={s.etiket}>Marka / Model (isteğe bağlı)
                  <input style={s.input} placeholder="Örn: Impo 2 HP" value={marka}
                    onChange={(e) => setMarka(e.target.value)} />
                </label>
                <label style={s.etiket}>Kurulum / Son bakım tarihi
                  <input type="date" style={s.input} value={tarih}
                    onChange={(e) => setTarih(e.target.value)} />
                </label>
              </div>

              <div style={s.adim}><span style={s.adimNo}>4</span> Hangi bakımları takip edelim?</div>
              <div style={s.lejant}>
                <span><span style={{ ...s.lejNokta, background: '#1e5a82' }} /> Periyodik (son bakımdan itibaren)</span>
                <span><span style={{ ...s.lejNokta, background: '#b45309' }} /> Mevsimlik (her yıl aynı ay)</span>
              </div>
              <div style={s.chipler}>
                {kat.bakimlar.map((b) => {
                  const secili = kurallar.find((x) => x.ad === b.ad);
                  const renk = b.mevsim ? s.chipMevsim : s.chipSecili;
                  return (
                    <button type="button" key={b.ad} onClick={() => kuralSec(b)}
                      style={{ ...s.chip, ...(secili ? renk : {}), borderColor: b.mevsim ? '#f59e0b' : '#93c5fd' }}>
                      {secili ? '✓ ' : ''}{b.ad} · <b>{kuralYazi(b)}</b>
                    </button>
                  );
                })}
                {ekstralar.map((b) => (
                  <button type="button" key={b.ad} onClick={() => kuralSec(b)}
                    style={{ ...s.chip, ...(b.mevsim ? s.chipMevsim : s.chipSecili) }}>
                    ✓ {b.ad} · <b>{kuralYazi(b)}</b> ✕
                  </button>
                ))}
              </div>

              <div style={s.ozelSatir}>
                <input style={{ ...s.input, flex: 2, minWidth: 180 }} placeholder="Listede yoksa: bakım adı yazın"
                  value={ozelAd} onChange={(e) => setOzelAd(e.target.value)} />
                <select style={{ ...s.input, flex: 1, minWidth: 150 }} value={ozelSecim}
                  onChange={(e) => setOzelSecim(e.target.value)}>
                  {OZEL_SECENEKLER.map((o) => <option key={o.deger} value={o.deger}>{o.yazi}</option>)}
                </select>
                <button type="button" style={s.ekleBtn} onClick={ozelEkle}>+ Ekle</button>
              </div>
            </>
          )}

          <button type="submit" disabled={kaydediliyor}
            style={{ ...s.anaBtn, marginTop: 24, width: '100%', padding: 16, fontSize: 17, opacity: kaydediliyor ? 0.6 : 1 }}>
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
                  {KATEGORI[e.category]?.ikon || '🛠️'} {e.category} · {e.equipment_type}
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
  kart: { background: '#fff', borderRadius: 16, padding: 20, marginBottom: 14,
    boxShadow: '0 2px 12px rgba(15,45,74,0.08)' },
  adim: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 17, fontWeight: 700, color: '#0f2d4a',
    margin: '22px 0 12px' },
  adimNo: { width: 28, height: 28, borderRadius: '50%', background: '#1d6fe0', color: '#fff', fontSize: 14,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 },
  etiket: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, color: '#334155' },
  input: { padding: '11px 12px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 15,
    width: '100%', boxSizing: 'border-box' },
  kategoriler: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 10 },
  kategoriBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '16px 8px',
    borderRadius: 14, border: '2px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer',
    fontSize: 15, fontWeight: 600, color: '#0f2d4a' },
  kategoriSecili: { borderColor: '#1d6fe0', background: '#eff6ff', boxShadow: '0 0 0 3px rgba(29,111,224,0.15)' },
  chipler: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: { padding: '10px 14px', borderRadius: 22, border: '1px solid #cbd5e1', background: '#fff',
    cursor: 'pointer', fontSize: 14, color: '#1e293b' },
  chipSecili: { background: '#1e5a82', color: '#fff', borderColor: '#1e5a82' },
  chipMevsim: { background: '#b45309', color: '#fff', borderColor: '#b45309' },
  lejant: { display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: '#475569', marginBottom: 10 },
  lejNokta: { display: 'inline-block', width: 10, height: 10, borderRadius: '50%', marginRight: 5 },
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
