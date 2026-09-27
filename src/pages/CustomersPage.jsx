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

const MARKALAR = ['Impo', 'Coverco', 'Diğer'];
const URUN_TURLERI = ['Dalgıç pompa', 'Dalgıç motor', 'Santrifüj pompa', 'Havuz pompası', 'Hidrofor seti',
  'Drenaj pompası', 'Sirkülasyon pompası'];
const GUCLER = ['0.5', '0.75', '1', '1.5', '2', '3', '4', '5.5', '7.5', '10', '15'];

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

function ozelKural(ad, secim) {
  const [tur, sayi] = secim.split('-');
  const n = parseInt(sayi, 10);
  return tur === 'm' ? { ad, ayNo: n, mevsim: true } : { ad, ay: n };
}

function kuralSatiri(k, cihazId, tarih) {
  return k.mevsim
    ? { equipment_id: cihazId, rule_name: k.ad, period_months: 12, last_service_date: null, next_due_date: mevsimTarihi(k.ayNo) }
    : { equipment_id: cihazId, rule_name: k.ad, period_months: k.ay, last_service_date: tarih || yerel(new Date()) };
}

const bosCihaz = () => ({
  kategori: '', cihaz: '', digerCihaz: '', marka: '', digerMarka: '', urunTuru: '', guc: '', model: '',
  konum: '', tarih: yerel(new Date()), kurallar: [],
});

async function cihazKaydet(musteriId, c) {
  const cihazAdi = c.cihaz === 'Diğer' ? c.digerCihaz.trim() : c.cihaz;
  if (!c.kategori || !cihazAdi) return 'Kategori ve cihaz / iş seçin.';
  const marka = c.marka === 'Diğer' ? c.digerMarka.trim() : c.marka;
  const model = [c.urunTuru, c.guc ? `${c.guc} HP` : '', c.model.trim()].filter(Boolean).join(' · ');
  const { data: yeni, error } = await supabase
    .from('equipment')
    .insert([{
      customer_id: musteriId,
      category: c.kategori,
      equipment_type: cihazAdi,
      location: c.konum || null,
      brand: marka || null,
      model: model || null,
      install_date: c.tarih || null,
    }])
    .select()
    .single();
  if (error) return error.message;
  if (c.kurallar.length) {
    const { error: kHata } = await supabase
      .from('maintenance_rules')
      .insert(c.kurallar.map((k) => kuralSatiri(k, yeni.id, c.tarih)));
    if (kHata) return kHata.message;
  }
  return null;
}

function whatsappLink(tel) {
  if (!tel) return null;
  let n = tel.replace(/\D/g, '');
  if (n.startsWith('0')) n = '9' + n;
  if (!n.startsWith('90')) n = '90' + n;
  return `https://wa.me/${n}`;
}

function CihazFormu({ deger, setDeger, baslangic, onHata }) {
  const [ozelAd, setOzelAd] = useState('');
  const [ozelSecim, setOzelSecim] = useState('p-12');
  const kat = deger.kategori ? KATEGORI[deger.kategori] : null;
  const set = (alan, v) => setDeger({ ...deger, [alan]: v });

  function kategoriSec(k) {
    setDeger({ ...deger, kategori: deger.kategori === k ? '' : k, cihaz: '', digerCihaz: '', kurallar: [] });
  }

  function kuralSec(k) {
    const secili = deger.kurallar.find((x) => x.ad === k.ad);
    set('kurallar', secili ? deger.kurallar.filter((x) => x.ad !== k.ad) : [...deger.kurallar, k]);
  }

  function ozelEkle() {
    if (!ozelAd.trim()) {
      if (onHata) onHata('Özel bakım için bir ad yazın.');
      return;
    }
    set('kurallar', [...deger.kurallar, ozelKural(ozelAd.trim(), ozelSecim)]);
    setOzelAd('');
  }

  const ekstralar = kat ? deger.kurallar.filter((k) => !kat.bakimlar.find((b) => b.ad === k.ad)) : [];

  return (
    <>
      <div style={s.adim}><span style={s.adimNo}>{baslangic}</span> Ne için gidiyoruz?</div>
      <div style={s.kategoriler}>
        {Object.keys(KATEGORI).map((k) => (
          <button type="button" key={k} onClick={() => kategoriSec(k)}
            style={{ ...s.kategoriBtn, ...(deger.kategori === k ? s.kategoriSecili : {}) }}>
            <span style={{ fontSize: 28 }}>{KATEGORI[k].ikon}</span>
            <span>{k}</span>
          </button>
        ))}
      </div>

      {kat && (
        <>
          <div style={s.adim}><span style={s.adimNo}>{baslangic + 1}</span> Hangi cihaz / iş?</div>
          <div style={s.chipler}>
            {[...kat.cihazlar, 'Diğer'].map((c) => (
              <button type="button" key={c} onClick={() => set('cihaz', c)}
                style={{ ...s.chip, ...(deger.cihaz === c ? s.chipSecili : {}) }}>
                {c}
              </button>
            ))}
          </div>
          {deger.cihaz === 'Diğer' && (
            <input style={{ ...s.input, marginTop: 10 }} placeholder="Cihaz / iş adını yazın"
              value={deger.digerCihaz} onChange={(e) => set('digerCihaz', e.target.value)} />
          )}

          <div style={s.adim}><span style={s.adimNo}>{baslangic + 2}</span> Marka ve model (isteğe bağlı)</div>
          <div style={s.chipler}>
            {MARKALAR.map((mk) => (
              <button type="button" key={mk} onClick={() => set('marka', deger.marka === mk ? '' : mk)}
                style={{ ...s.chip, ...(deger.marka === mk ? s.chipSecili : {}) }}>
                {mk}
              </button>
            ))}
          </div>
          {deger.marka === 'Diğer' && (
            <input style={{ ...s.input, marginTop: 10 }} placeholder="Marka adını yazın"
              value={deger.digerMarka} onChange={(e) => set('digerMarka', e.target.value)} />
          )}
          <div style={{ ...s.grid, marginTop: 12 }}>
            <label style={s.etiket}>Ürün türü
              <select style={s.input} value={deger.urunTuru} onChange={(e) => set('urunTuru', e.target.value)}>
                <option value="">Seçilmedi</option>
                {URUN_TURLERI.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label style={s.etiket}>Güç
              <select style={s.input} value={deger.guc} onChange={(e) => set('guc', e.target.value)}>
                <option value="">Seçilmedi</option>
                {GUCLER.map((g) => <option key={g} value={g}>{g.replace('.', ',')} HP</option>)}
              </select>
            </label>
            <label style={s.etiket}>Model / seri kodu
              <input style={s.input} placeholder="Katalogdaki model" value={deger.model}
                onChange={(e) => set('model', e.target.value)} />
            </label>
            <label style={s.etiket}>Konum
              <input style={s.input} placeholder="Örn: Makine dairesi, Bahçe" value={deger.konum}
                onChange={(e) => set('konum', e.target.value)} />
            </label>
            <label style={s.etiket}>Kurulum / Son bakım tarihi
              <input type="date" style={s.input} value={deger.tarih}
                onChange={(e) => set('tarih', e.target.value)} />
            </label>
          </div>

          <div style={s.adim}><span style={s.adimNo}>{baslangic + 3}</span> Hangi bakımları takip edelim?</div>
          <div style={s.lejant}>
            <span><span style={{ ...s.lejNokta, background: '#1e5a82' }} /> Periyodik (son bakımdan itibaren)</span>
            <span><span style={{ ...s.lejNokta, background: '#b45309' }} /> Mevsimlik (her yıl aynı ay)</span>
          </div>
          <div style={s.chipler}>
            {kat.bakimlar.map((b) => {
              const secili = deger.kurallar.find((x) => x.ad === b.ad);
              return (
                <button type="button" key={b.ad} onClick={() => kuralSec(b)}
                  style={{ ...s.chip, ...(secili ? (b.mevsim ? s.chipMevsim : s.chipSecili) : {}),
                    borderColor: b.mevsim ? '#f59e0b' : '#93c5fd' }}>
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
            <input style={{ ...s.input, flex: 2, minWidth: 170 }} placeholder="Listede yoksa: bakım adı yazın"
              value={ozelAd} onChange={(e) => setOzelAd(e.target.value)} />
            <select style={{ ...s.input, flex: 1, minWidth: 140 }} value={ozelSecim}
              onChange={(e) => setOzelSecim(e.target.value)}>
              {OZEL_SECENEKLER.map((o) => <option key={o.deger} value={o.deger}>{o.yazi}</option>)}
            </select>
            <button type="button" style={s.ekleBtn} onClick={ozelEkle}>+ Ekle</button>
          </div>
        </>
      )}
    </>
  );
}

function MusteriKarti({ m, yenile }) {
  const [duzenle, setDuzenle] = useState(false);
  const [bilgi, setBilgi] = useState({ name: '', phone: '', address: '', notes: '' });
  const [yeniCihazAcik, setYeniCihazAcik] = useState(false);
  const [yeniCihaz, setYeniCihaz] = useState(bosCihaz());
  const [bakimEkleId, setBakimEkleId] = useState('');
  const [ozelAd, setOzelAd] = useState('');
  const [ozelSecim, setOzelSecim] = useState('p-12');
  const [mesaj, setMesaj] = useState(null);
  const [calisiyor, setCalisiyor] = useState(false);

  const hata = (yazi) => setMesaj({ tur: 'hata', yazi });
  const tamam = (yazi) => setMesaj({ tur: 'ok', yazi });

  function duzenleAc() {
    setBilgi({ name: m.name || '', phone: m.phone || '', address: m.address || '', notes: m.notes || '' });
    setMesaj(null);
    setYeniCihazAcik(false);
    setBakimEkleId('');
    setDuzenle(true);
  }

  async function bilgiKaydet() {
    if (!bilgi.name.trim()) { hata('Müşteri adı boş olamaz.'); return; }
    setCalisiyor(true);
    const { error } = await supabase.from('customers')
      .update({ name: bilgi.name.trim(), phone: bilgi.phone, address: bilgi.address, notes: bilgi.notes })
      .eq('id', m.id);
    setCalisiyor(false);
    if (error) hata(error.message);
    else { tamam('Müşteri bilgileri kaydedildi.'); yenile(); }
  }

  async function musteriSil() {
    if (!window.confirm(`${m.name} silinsin mi? Cihazları ve bakım kayıtları da silinir.`)) return;
    const cihazIdleri = (m.equipment || []).map((e) => e.id);
    if (cihazIdleri.length) await supabase.from('maintenance_rules').delete().in('equipment_id', cihazIdleri);
    await supabase.from('equipment').delete().eq('customer_id', m.id);
    const { error } = await supabase.from('customers').delete().eq('id', m.id);
    if (error) hata(error.message);
    yenile();
  }

  async function cihazSil(e) {
    if (!window.confirm(`"${e.equipment_type}" ve bakım takipleri silinsin mi?`)) return;
    await supabase.from('maintenance_rules').delete().eq('equipment_id', e.id);
    const { error } = await supabase.from('equipment').delete().eq('id', e.id);
    if (error) hata(error.message);
    else tamam('Cihaz silindi.');
    yenile();
  }

  async function kuralSil(k) {
    if (!window.confirm(`"${k.rule_name}" takibi kaldırılsın mı?`)) return;
    const { error } = await supabase.from('maintenance_rules').delete().eq('id', k.id);
    if (error) hata(error.message);
    yenile();
  }

  async function kuralEkle(e, k) {
    const { error } = await supabase.from('maintenance_rules').insert([kuralSatiri(k, e.id, yerel(new Date()))]);
    if (error) hata(error.message);
    else tamam(`"${k.ad}" eklendi.`);
    yenile();
  }

  async function ozelKuralEkle(e) {
    if (!ozelAd.trim()) { hata('Özel bakım için bir ad yazın.'); return; }
    await kuralEkle(e, ozelKural(ozelAd.trim(), ozelSecim));
    setOzelAd('');
  }

  async function yeniCihazKaydet() {
    setCalisiyor(true);
    const h = await cihazKaydet(m.id, yeniCihaz);
    setCalisiyor(false);
    if (h) { hata(h); return; }
    setYeniCihaz(bosCihaz());
    setYeniCihazAcik(false);
    tamam('Cihaz eklendi.');
    yenile();
  }

  const cihazlar = m.equipment || [];

  return (
    <div style={{ ...s.kart, ...(duzenle ? s.kartDuzenle : {}) }}>
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
          {duzenle ? (
            <button style={s.bittiBtn} onClick={() => setDuzenle(false)}>✓ Bitti</button>
          ) : (
            <button style={s.duzenleBtn} onClick={duzenleAc}>✏️ Düzenle</button>
          )}
          <button style={s.silBtn} onClick={musteriSil}>Sil</button>
        </div>
      </div>

      {mesaj && (
        <div style={{ ...s.mesaj, ...(mesaj.tur === 'ok' ? s.mesajOk : s.mesajHata) }}>
          {mesaj.tur === 'ok' ? '✓ ' : ''}{mesaj.yazi}
        </div>
      )}

      {duzenle && (
        <div style={s.duzenleAlan}>
          <div style={s.bolumBaslik}>👤 Müşteri bilgileri</div>
          <div style={s.grid}>
            <label style={s.etiket}>Ad Soyad
              <input style={s.input} value={bilgi.name} onChange={(e) => setBilgi({ ...bilgi, name: e.target.value })} />
            </label>
            <label style={s.etiket}>Telefon
              <input style={s.input} type="tel" value={bilgi.phone} onChange={(e) => setBilgi({ ...bilgi, phone: e.target.value })} />
            </label>
            <label style={s.etiket}>Adres
              <input style={s.input} value={bilgi.address} onChange={(e) => setBilgi({ ...bilgi, address: e.target.value })} />
            </label>
            <label style={s.etiket}>Not
              <input style={s.input} value={bilgi.notes} onChange={(e) => setBilgi({ ...bilgi, notes: e.target.value })} />
            </label>
          </div>
          <button style={{ ...s.kaydetBtn, opacity: calisiyor ? 0.6 : 1 }} disabled={calisiyor} onClick={bilgiKaydet}>
            Bilgileri Kaydet
          </button>

          <div style={{ ...s.bolumBaslik, marginTop: 22 }}>🛠️ Cihazlar ve bakımlar</div>
          {cihazlar.length === 0 && <p style={s.kucuk}>Bu müşteriye bağlı cihaz yok.</p>}
          {cihazlar.map((e) => {
            const kat = KATEGORI[e.category];
            const mevcutAdlar = (e.maintenance_rules || []).map((k) => k.rule_name);
            const eklenebilir = (kat?.bakimlar || []).filter((b) => !mevcutAdlar.includes(b.ad));
            return (
              <div key={e.id} style={s.cihazKutuDuzenle}>
                <div style={s.cihazUst}>
                  <div>
                    <div style={s.cihazAd}>
                      {kat?.ikon || '🛠️'} {e.category} · {e.equipment_type}{e.location ? ` (${e.location})` : ''}
                    </div>
                    {(e.brand || e.model) && (
                      <div style={s.kucuk}>🏷️ {[e.brand, e.model].filter(Boolean).join(' · ')}</div>
                    )}
                  </div>
                  <button style={s.silBtn} onClick={() => cihazSil(e)}>Cihazı sil</button>
                </div>

                {(e.maintenance_rules || []).map((k) => {
                  const d = durum(kalanGun(k.next_due_date));
                  return (
                    <div key={k.id} style={s.kuralSatir}>
                      <span style={{ flex: 1 }}>
                        {d.ikon} {k.rule_name} · {trTarih(k.next_due_date)} ·{' '}
                        <span style={{ color: d.renk, fontWeight: 600 }}>{d.yazi}</span>
                      </span>
                      <button style={s.xBtn} onClick={() => kuralSil(k)} title="Takibi kaldır">✕</button>
                    </div>
                  );
                })}

                {bakimEkleId === e.id ? (
                  <div style={s.bakimPanel}>
                    {eklenebilir.length > 0 && (
                      <div style={s.chipler}>
                        {eklenebilir.map((b) => (
                          <button key={b.ad} type="button" onClick={() => kuralEkle(e, b)}
                            style={{ ...s.chip, borderColor: b.mevsim ? '#f59e0b' : '#93c5fd' }}>
                            + {b.ad} · <b>{kuralYazi(b)}</b>
                          </button>
                        ))}
                      </div>
                    )}
                    <div style={s.ozelSatir}>
                      <input style={{ ...s.input, flex: 2, minWidth: 160 }} placeholder="Özel bakım adı"
                        value={ozelAd} onChange={(ev) => setOzelAd(ev.target.value)} />
                      <select style={{ ...s.input, flex: 1, minWidth: 130 }} value={ozelSecim}
                        onChange={(ev) => setOzelSecim(ev.target.value)}>
                        {OZEL_SECENEKLER.map((o) => <option key={o.deger} value={o.deger}>{o.yazi}</option>)}
                      </select>
                      <button type="button" style={s.ekleBtn} onClick={() => ozelKuralEkle(e)}>+ Ekle</button>
                    </div>
                    <button style={s.linkBtn} onClick={() => setBakimEkleId('')}>Kapat</button>
                  </div>
                ) : (
                  <button style={s.ikincilBtn} onClick={() => { setBakimEkleId(e.id); setOzelAd(''); }}>
                    + Bakım ekle
                  </button>
                )}
              </div>
            );
          })}

          {yeniCihazAcik ? (
            <div style={s.yeniCihazAlan}>
              <CihazFormu deger={yeniCihaz} setDeger={setYeniCihaz} baslangic={1} onHata={hata} />
              <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                <button style={{ ...s.kaydetBtn, marginTop: 0, opacity: calisiyor ? 0.6 : 1 }} disabled={calisiyor}
                  onClick={yeniCihazKaydet}>
                  Cihazı Kaydet
                </button>
                <button style={s.vazgecBtn} onClick={() => { setYeniCihazAcik(false); setYeniCihaz(bosCihaz()); }}>
                  Vazgeç
                </button>
              </div>
            </div>
          ) : (
            <button style={{ ...s.ikincilBtn, marginTop: 12 }} onClick={() => setYeniCihazAcik(true)}>
              + Yeni cihaz / iş ekle
            </button>
          )}
        </div>
      )}

      {!duzenle && cihazlar.map((e) => (
        <div key={e.id} style={s.cihazKutu}>
          <div style={s.cihazAd}>
            {KATEGORI[e.category]?.ikon || '🛠️'} {e.category} · {e.equipment_type}
            {e.location ? ` (${e.location})` : ''}
          </div>
          {(e.brand || e.model) && (
            <div style={s.kucuk}>🏷️ {[e.brand, e.model].filter(Boolean).join(' · ')}</div>
          )}
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
  );
}

const bosMusteri = { name: '', phone: '', address: '', notes: '' };

export default function CustomersPage() {
  const [musteriler, setMusteriler] = useState([]);
  const [musteri, setMusteri] = useState(bosMusteri);
  const [yeniCihaz, setYeniCihaz] = useState(bosCihaz());
  const [formAcik, setFormAcik] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [hata, setHata] = useState('');
  const [arama, setArama] = useState('');

  async function yukle() {
    const { data, error } = await supabase
      .from('customers')
      .select('*, equipment(*, maintenance_rules(*))')
      .order('created_at', { ascending: false });
    if (error) setHata(error.message);
    setMusteriler(data || []);
    setYukleniyor(false);
  }

  useEffect(() => { yukle(); }, []);

  function formuKapat() {
    setMusteri(bosMusteri);
    setYeniCihaz(bosCihaz());
    setFormAcik(false);
  }

  async function kaydet(e) {
    e.preventDefault();
    setHata('');
    if (!musteri.name.trim()) { setHata('Müşteri adı zorunlu.'); return; }
    const cihazAdi = yeniCihaz.cihaz === 'Diğer' ? yeniCihaz.digerCihaz.trim() : yeniCihaz.cihaz;
    if (yeniCihaz.kategori && !cihazAdi) { setHata('Kategori seçtiyseniz cihaz / iş de seçin.'); return; }
    setKaydediliyor(true);

    const { data: yeniMusteri, error: mHata } = await supabase
      .from('customers').insert([{ ...musteri, name: musteri.name.trim() }]).select().single();
    if (mHata) { setHata(mHata.message); setKaydediliyor(false); return; }

    if (yeniCihaz.kategori) {
      const h = await cihazKaydet(yeniMusteri.id, yeniCihaz);
      if (h) setHata(h);
    }

    setKaydediliyor(false);
    formuKapat();
    yukle();
  }

  const filtreli = musteriler.filter((m) => {
    const q = arama.toLowerCase();
    const cihazlar = (m.equipment || []).map((e) => `${e.category} ${e.equipment_type} ${e.brand || ''} ${e.model || ''}`).join(' ');
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

      {hata && <div style={{ ...s.mesaj, ...s.mesajHata }}>{hata}</div>}

      {formAcik && (
        <form onSubmit={kaydet} style={s.kart}>
          <div style={{ ...s.adim, marginTop: 0 }}><span style={s.adimNo}>1</span> Müşteri bilgileri</div>
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

          <CihazFormu deger={yeniCihaz} setDeger={setYeniCihaz} baslangic={2} onHata={setHata} />

          <button type="submit" disabled={kaydediliyor}
            style={{ ...s.anaBtn, marginTop: 24, width: '100%', padding: 16, fontSize: 17, opacity: kaydediliyor ? 0.6 : 1 }}>
            {kaydediliyor ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </form>
      )}

      <input style={{ ...s.input, marginBottom: 16 }} placeholder="İsim, telefon, adres, cihaz veya marka ara..."
        value={arama} onChange={(e) => setArama(e.target.value)} />

      {yukleniyor ? (
        <p style={s.altBaslik}>Yükleniyor...</p>
      ) : filtreli.length === 0 ? (
        <div style={s.kart}><p style={s.altBaslik}>Henüz müşteri kaydı yok.</p></div>
      ) : (
        filtreli.map((m) => <MusteriKarti key={m.id} m={m} yenile={yukle} />)
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
  kartDuzenle: { boxShadow: '0 0 0 2px #1d6fe0, 0 6px 20px rgba(29,111,224,0.15)' },
  adim: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 17, fontWeight: 700, color: '#0f2d4a',
    margin: '22px 0 12px' },
  adimNo: { width: 28, height: 28, borderRadius: '50%', background: '#1d6fe0', color: '#fff', fontSize: 14,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 },
  etiket: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, color: '#334155' },
  input: { padding: '11px 12px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 15,
    width: '100%', boxSizing: 'border-box', background: '#fff' },
  kategoriler: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: 10 },
  kategoriBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '14px 6px',
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
  mesaj: { marginTop: 12, marginBottom: 12, padding: 12, borderRadius: 10, fontSize: 14 },
  mesajOk: { background: '#dcfce7', color: '#166534' },
  mesajHata: { background: '#fee2e2', color: '#991b1b' },
  kartUst: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' },
  isim: { fontSize: 18, fontWeight: 700, color: '#0f2d4a', marginBottom: 4 },
  kucuk: { fontSize: 14, color: '#64748b', marginTop: 2 },
  butonlar: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  araBtn: { background: '#1e5a82', color: '#fff', borderRadius: 8, padding: '8px 12px',
    textDecoration: 'none', fontSize: 13, fontWeight: 600 },
  waBtn: { background: '#16a34a', color: '#fff', borderRadius: 8, padding: '8px 12px',
    textDecoration: 'none', fontSize: 13, fontWeight: 600 },
  duzenleBtn: { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 8,
    padding: '8px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 700 },
  bittiBtn: { background: '#1d6fe0', color: '#fff', border: 'none', borderRadius: 8,
    padding: '8px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 700 },
  silBtn: { background: 'transparent', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8,
    padding: '8px 12px', cursor: 'pointer', fontSize: 13 },
  duzenleAlan: { marginTop: 16, paddingTop: 16, borderTop: '1px dashed #cbd5e1' },
  bolumBaslik: { fontSize: 16, fontWeight: 700, color: '#0f2d4a', marginBottom: 12 },
  kaydetBtn: { marginTop: 12, background: 'linear-gradient(135deg,#1e5a82,#0f2d4a)', color: '#fff', border: 'none',
    borderRadius: 10, padding: '11px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 14 },
  vazgecBtn: { background: '#fff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: 10,
    padding: '11px 18px', fontWeight: 600, cursor: 'pointer', fontSize: 14 },
  cihazKutu: { background: '#f8fafc', borderLeft: '4px solid #1e5a82', borderRadius: 10,
    padding: '10px 12px', marginTop: 10 },
  cihazKutuDuzenle: { background: '#f8fafc', border: '1px solid #e2e8f0', borderLeft: '4px solid #1d6fe0',
    borderRadius: 12, padding: 14, marginBottom: 12 },
  cihazUst: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap', marginBottom: 8 },
  cihazAd: { fontWeight: 700, color: '#1e293b', fontSize: 15 },
  kuralSatir: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid #e2e8f0',
    fontSize: 14, color: '#475569' },
  xBtn: { width: 32, height: 32, borderRadius: 8, border: '1px solid #fecaca', background: '#fff', color: '#dc2626',
    cursor: 'pointer', fontSize: 14, flexShrink: 0 },
  ikincilBtn: { marginTop: 8, background: '#eff6ff', color: '#1e5a82', border: '1px solid #bfdbfe', borderRadius: 10,
    padding: '9px 14px', fontWeight: 600, cursor: 'pointer', fontSize: 14 },
  bakimPanel: { marginTop: 10, padding: 12, background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0' },
  linkBtn: { marginTop: 10, background: 'none', border: 'none', color: '#1d6fe0', fontWeight: 600, cursor: 'pointer', padding: 0 },
  yeniCihazAlan: { marginTop: 12, padding: 16, background: '#f8fafc', borderRadius: 12, border: '1px dashed #93c5fd' },
};
