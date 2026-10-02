import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabase';
import { Ikon, IkonKutu } from '../ikonlar';

// Harita: Leaflet (OpenStreetMap) — CDN'den yüklenir, ek kurulum gerekmez
const LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
const LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
const MERKEZ = [38.3236, 26.3058]; // Çeşme merkez
const KONUM_ONEK = 'alkaKonum:';
const ELLE_ONEK = 'alkaKonumElle:';

let leafletSoz = null;
function leafletYukle() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletSoz) return leafletSoz;
  leafletSoz = new Promise((coz, red) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = LEAFLET_CSS;
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = LEAFLET_JS;
    js.onload = () => coz(window.L);
    js.onerror = () => red(new Error('Harita yüklenemedi'));
    document.head.appendChild(js);
  });
  return leafletSoz;
}

const yerel = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

function adresAnahtar(adres) {
  return String(adres || '').trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ');
}

function kayitliKonum(m) {
  try {
    const elle = localStorage.getItem(ELLE_ONEK + m.id);
    if (elle) return JSON.parse(elle);
    const v = localStorage.getItem(KONUM_ONEK + adresAnahtar(m.address));
    if (v && v !== 'yok') return JSON.parse(v);
  } catch { /* yoksay */ }
  return null;
}

async function adresBul(adres) {
  const anahtar = KONUM_ONEK + adresAnahtar(adres);
  const onbellek = localStorage.getItem(anahtar);
  if (onbellek) return onbellek === 'yok' ? null : JSON.parse(onbellek);
  const kucuk = adres.toLocaleLowerCase('tr-TR');
  const sorgu = kucuk.includes('izmir') ? adres : kucuk.includes('çeşme') ? `${adres}, İzmir` : `${adres}, Çeşme, İzmir`;
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=tr&accept-language=tr&q=${encodeURIComponent(sorgu)}`);
  if (!r.ok) throw new Error('Adres servisi yanıt vermedi');
  const d = await r.json();
  if (!Array.isArray(d)) throw new Error('Geçersiz yanıt');
  const sonuc = d && d[0] ? [Number(d[0].lat), Number(d[0].lon)] : null;
  try { localStorage.setItem(anahtar, sonuc ? JSON.stringify(sonuc) : 'yok'); } catch { /* yoksay */ }
  return sonuc;
}

function mesafe(a, b) {
  const R = 6371;
  const r = (x) => (x * Math.PI) / 180;
  const dLat = r(b[0] - a[0]);
  const dLon = r(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function rotaSirala(baslangic, duraklar) {
  const kalan = [...duraklar];
  const sira = [];
  let simdi = baslangic;
  while (kalan.length) {
    let enIyi = 0;
    kalan.forEach((d, i) => { if (mesafe(simdi, d.konum) < mesafe(simdi, kalan[enIyi].konum)) enIyi = i; });
    const d = kalan.splice(enIyi, 1)[0];
    sira.push({ ...d, km: mesafe(simdi, d.konum) });
    simdi = d.konum;
  }
  return sira;
}

function haritaLinki(baslangic, sira) {
  if (!sira.length) return '';
  const k = (p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`;
  const hedef = sira[sira.length - 1];
  const ara = sira.slice(0, -1).slice(0, 9).map((d) => k(d.konum)).join('|');
  return `https://www.google.com/maps/dir/?api=1&travelmode=driving${baslangic ? `&origin=${k(baslangic)}` : ''}&destination=${k(hedef.konum)}${ara ? `&waypoints=${encodeURIComponent(ara)}` : ''}`;
}

const tekNokta = (p) => `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${p[0].toFixed(6)},${p[1].toFixed(6)}`;

export default function HaritaPage() {
  const [sekme, setSekme] = useState('rota');
  const [musteriler, setMusteriler] = useState([]);
  const [isler, setIsler] = useState([]);
  const [bakimlar, setBakimlar] = useState([]);
  const [bakimEkle, setBakimEkle] = useState(true);
  const [konumlar, setKonumlar] = useState({});
  const [arananSayi, setArananSayi] = useState(0);
  const [benimKonum, setBenimKonum] = useState(null);
  const [elleId, setElleId] = useState(null);
  const [hata, setHata] = useState('');
  const [hazir, setHazir] = useState(false);
  const haritaDiv = useRef(null);
  const harita = useRef(null);
  const katman = useRef(null);
  const elleRef = useRef(null);
  elleRef.current = elleId;

  // Veri
  useEffect(() => {
    (async () => {
      const bugun = yerel(new Date());
      const [m, w, k] = await Promise.all([
        supabase.from('customers').select('id, name, phone, address').order('name', { ascending: true }),
        supabase.from('work_orders').select('id, title, status, scheduled_date, customers(id, name, phone, address)')
          .eq('scheduled_date', bugun).neq('status', 'tamamlandi'),
        supabase.from('maintenance_rules').select('id, rule_name, next_due_date, active, equipment(category, customers(id, name, phone, address))')
          .lte('next_due_date', bugun),
      ]);
      if (m.error) setHata(m.error.message);
      setMusteriler(m.data || []);
      setIsler(w.data || []);
      setBakimlar((k.data || []).filter((x) => x.active !== false && x.equipment?.customers));
    })();
  }, []);

  // Adreslerden konum bul (önbellekli, saniyede 1 istek)
  useEffect(() => {
    if (!musteriler.length) return;
    let iptal = false;
    (async () => {
      const ilk = {};
      musteriler.forEach((m) => { const p = kayitliKonum(m); if (p) ilk[m.id] = p; });
      setKonumlar(ilk);
      const eksik = musteriler.filter((m) => !ilk[m.id] && m.address && !localStorage.getItem(KONUM_ONEK + adresAnahtar(m.address)));
      for (const m of eksik) {
        if (iptal) return;
        setArananSayi((n) => n + 1);
        try {
          const p = await adresBul(m.address);
          if (p && !iptal) setKonumlar((k) => ({ ...k, [m.id]: p }));
        } catch { /* yoksay */ }
        await bekle(1100);
      }
      setArananSayi(0);
    })();
    return () => { iptal = true; };
  }, [musteriler]);

  // Haritayı kur
  useEffect(() => {
    let iptal = false;
    leafletYukle().then((L) => {
      if (iptal || !haritaDiv.current || harita.current) return;
      harita.current = L.map(haritaDiv.current, { zoomControl: true, attributionControl: true }).setView(MERKEZ, 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '© OpenStreetMap',
      }).addTo(harita.current);
      katman.current = L.layerGroup().addTo(harita.current);
      harita.current.on('click', (e) => {
        const id = elleRef.current;
        if (!id) return;
        const p = [e.latlng.lat, e.latlng.lng];
        try { localStorage.setItem(ELLE_ONEK + id, JSON.stringify(p)); } catch { /* yoksay */ }
        setKonumlar((k) => ({ ...k, [id]: p }));
        setElleId(null);
      });
      setHazir(true);
    }).catch((e) => setHata(e.message));
    return () => { iptal = true; };
  }, []);

  useEffect(() => () => { if (harita.current) { harita.current.remove(); harita.current = null; } }, []);

  // Rota durakları
  const duraklar = useMemo(() => {
    const liste = [];
    const eklenen = new Set();
    isler.forEach((w) => {
      const m = w.customers;
      if (!m || !konumlar[m.id]) return;
      liste.push({ anahtar: 'w' + w.id, musteri: m, konum: konumlar[m.id], is: w.title || 'İş emri', tur: 'is' });
      eklenen.add(m.id);
    });
    if (bakimEkle) {
      bakimlar.forEach((k) => {
        const m = k.equipment.customers;
        if (!konumlar[m.id] || eklenen.has(m.id)) return;
        liste.push({ anahtar: 'b' + k.id, musteri: m, konum: konumlar[m.id], is: k.rule_name, tur: 'bakim', tarih: k.next_due_date });
        eklenen.add(m.id);
      });
    }
    return liste;
  }, [isler, bakimlar, bakimEkle, konumlar]);

  const baslangic = benimKonum || MERKEZ;
  const sira = useMemo(() => rotaSirala(baslangic, duraklar), [baslangic, duraklar]);
  const toplamKm = sira.reduce((t, d) => t + d.km, 0);
  const rotasiz = isler.filter((w) => w.customers && !konumlar[w.customers.id]).length;
  const konumsuzMusteri = musteriler.filter((m) => !konumlar[m.id]);

  // İşaretçileri çiz
  useEffect(() => {
    const L = window.L;
    if (!hazir || !L || !katman.current) return;
    katman.current.clearLayers();
    const sinir = [];
    const isaret = (p, html, popup) => {
      const m = L.marker(p, { icon: L.divIcon({ className: '', html, iconSize: [34, 34], iconAnchor: [17, 34], popupAnchor: [0, -30] }) });
      if (popup) m.bindPopup(popup);
      m.addTo(katman.current);
      sinir.push(p);
    };
    const pin = (renk, ic) => `<div style="width:34px;height:34px;display:flex;align-items:center;justify-content:center;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${renk};border:3px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,.35)"><span style="transform:rotate(45deg);color:#fff;font:800 13px Inter,system-ui,sans-serif">${ic}</span></div>`;
    const yaz = (s) => String(s || '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
    if (sekme === 'rota') {
      isaret(baslangic, `<div style="width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 6px rgba(37,99,235,.25)"></div>`,
        benimKonum ? 'Konumunuz' : 'Başlangıç: Çeşme merkez');
      sira.forEach((d, i) => isaret(d.konum, pin(d.tur === 'is' ? '#ea580c' : '#7c3aed', i + 1),
        `<b>${i + 1}. ${yaz(d.musteri.name)}</b><br>${yaz(d.is)}<br><a href="${tekNokta(d.konum)}" target="_blank">Yol tarifi</a>`));
      if (sira.length) L.polyline([baslangic, ...sira.map((d) => d.konum)], { color: '#2563eb', weight: 4, opacity: 0.75, dashArray: '8 8' }).addTo(katman.current);
    } else {
      musteriler.forEach((m) => {
        if (!konumlar[m.id]) return;
        isaret(konumlar[m.id], pin('#0284c7', (m.name || '?').charAt(0).toLocaleUpperCase('tr-TR')),
          `<b>${yaz(m.name)}</b><br>${yaz(m.address)}<br><a href="${tekNokta(konumlar[m.id])}" target="_blank">Yol tarifi</a>`);
      });
    }
    if (sinir.length > 1) harita.current.fitBounds(sinir, { padding: [40, 40], maxZoom: 15 });
    else if (sinir.length === 1) harita.current.setView(sinir[0], 14);
  }, [hazir, sekme, sira, musteriler, konumlar, baslangic, benimKonum]);

  function konumumuKullan() {
    if (!navigator.geolocation) { setHata('Bu cihaz konum paylaşmıyor.'); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => setBenimKonum([p.coords.latitude, p.coords.longitude]),
      () => setHata('Konum izni verilmedi. Rota Çeşme merkezden hesaplanıyor.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  const link = haritaLinki(benimKonum, sira);

  return (
    <div style={s.sayfa}>
      <div style={s.baslikSatir}>
        <h1 style={s.baslik}>Harita ve Rota</h1>
        <div style={s.sekmeler}>
          {[['rota', 'Bugünün rotası'], ['hepsi', 'Tüm müşteriler']].map(([id, ad]) => (
            <button key={id} onClick={() => setSekme(id)} style={{ ...s.sekme, ...(sekme === id ? s.sekmeAktif : {}) }}>{ad}</button>
          ))}
        </div>
      </div>

      {hata && <div style={s.hata}>{hata}</div>}
      {elleId && (
        <div style={s.bilgi}>
          📍 <b>{musteriler.find((m) => m.id === elleId)?.name}</b> için haritada doğru noktaya dokun.
          <button style={s.kucukBtn} onClick={() => setElleId(null)}>Vazgeç</button>
        </div>
      )}

      <div style={s.haritaKart}>
        <div ref={haritaDiv} style={s.harita} />
        {arananSayi > 0 && <div style={s.haritaUst}>Adresler haritaya yerleştiriliyor…</div>}
      </div>

      {sekme === 'rota' ? (
        <>
          <div style={s.ozet}>
            <div style={s.ozetHucre}><b>{sira.length}</b><span style={s.ozetAd}>durak</span></div>
            <div style={s.ozetHucre}><b>{toplamKm.toFixed(1)} km</b><span style={s.ozetAd}>yaklaşık yol</span></div>
            <div style={s.ozetHucre}><b>{Math.round((toplamKm / 40) * 60 + sira.length * 30)} dk</b><span style={s.ozetAd}>yol + iş süresi</span></div>
          </div>

          <div style={s.butonlar}>
            <button style={s.ikincilBtn} onClick={konumumuKullan}>
              <Ikon ad="konum" boyut={17} /> {benimKonum ? 'Konumum kullanılıyor' : 'Konumumdan başla'}
            </button>
            <label style={s.secim}>
              <input type="checkbox" checked={bakimEkle} onChange={(e) => setBakimEkle(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#7c3aed' }} />
              Bugün ve gecikmiş bakımları ekle
            </label>
          </div>

          {link && (
            <a href={link} target="_blank" rel="noreferrer" style={s.navBtn}>
              <Ikon ad="konum" boyut={20} renk="#fff" /> Rotayı Google Haritalar'da başlat
            </a>
          )}

          <div style={s.kart}>
            {sira.length === 0 && (
              <div style={s.bos}>
                <IkonKutu ad="konum" renk="#2563eb" boyut={44} yaricap={14} />
                <div>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>Bugün için rota yok</div>
                  <div style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>Bugün tarihli iş emri ya da günü gelmiş bakım bulunmuyor.</div>
                </div>
              </div>
            )}
            {sira.map((d, i) => (
              <div key={d.anahtar} style={{ ...s.durak, ...(i === 0 ? { borderTop: 'none' } : {}) }}>
                <span style={{ ...s.sira, background: d.tur === 'is' ? '#ea580c' : '#7c3aed' }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={s.durakAd}>{d.musteri.name}</div>
                  <div style={s.durakAlt}>{d.tur === 'is' ? 'İş emri' : 'Bakım'} · {d.is}</div>
                  <div style={s.durakMeta}>{String(d.musteri.address || '').split(',')[0]} · {d.km.toFixed(1)} km</div>
                </div>
                <a href={tekNokta(d.konum)} target="_blank" rel="noreferrer" style={s.gitBtn}>Git</a>
              </div>
            ))}
            {rotasiz > 0 && <div style={s.not}>{rotasiz} iş emrinin müşteri adresi haritada bulunamadı. "Tüm müşteriler" sekmesinden konumunu işaretleyebilirsin.</div>}
          </div>
        </>
      ) : (
        <div style={s.kart}>
          <div style={s.kartBaslik}>Konumu bulunamayan müşteriler ({konumsuzMusteri.length})</div>
          {konumsuzMusteri.length === 0 && <div style={{ color: '#64748b', fontSize: 14 }}>Tüm müşteriler haritada ✓</div>}
          {konumsuzMusteri.map((m) => (
            <div key={m.id} style={s.durak}>
              <IkonKutu ad="konum" renk="#94a3b8" boyut={38} yaricap={11} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={s.durakAd}>{m.name}</div>
                <div style={s.durakMeta}>{m.address || 'Adres girilmemiş'}</div>
              </div>
              <button style={s.gitBtn} onClick={() => { setElleId(m.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>İşaretle</button>
            </div>
          ))}
          <div style={s.not}>
            Konumlar müşterinin adresinden otomatik bulunur. Yanlış yerdeyse müşterinin işaretine dokunup yol tarifini kontrol edebilir,
            "İşaretle" ile doğru noktayı seçebilirsin. Elle seçilen konum bu cihazda saklanır.
          </div>
          {musteriler.filter((m) => konumlar[m.id]).length > 0 && (
            <>
              <div style={{ ...s.kartBaslik, marginTop: 14 }}>Haritadaki müşteriler</div>
              {musteriler.filter((m) => konumlar[m.id]).map((m) => (
                <div key={m.id} style={s.durak}>
                  <IkonKutu ad="konum" renk="#0284c7" boyut={38} yaricap={11} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={s.durakAd}>{m.name}</div>
                    <div style={s.durakMeta}>{m.address}</div>
                  </div>
                  <button style={s.kucukBtn} onClick={() => { setElleId(m.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Düzelt</button>
                  <a href={tekNokta(konumlar[m.id])} target="_blank" rel="noreferrer" style={s.gitBtn}>Git</a>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const golge = '0 1px 2px rgba(16,24,40,.04), 0 6px 18px rgba(16,24,40,.06)';
const s = {
  sayfa: { padding: '14px 14px 24px', maxWidth: 900, margin: '0 auto', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" },
  baslikSatir: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 },
  baslik: { margin: 0, fontSize: 22, fontWeight: 800, color: '#0b1730', letterSpacing: -0.3 },
  sekmeler: { display: 'flex', background: '#e8eef6', borderRadius: 12, padding: 3 },
  sekme: { border: 'none', background: 'transparent', padding: '8px 12px', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#475569', cursor: 'pointer', fontFamily: 'inherit' },
  sekmeAktif: { background: '#fff', color: '#0b1730', boxShadow: '0 1px 3px rgba(0,0,0,.12)' },
  haritaKart: { position: 'relative', borderRadius: 20, overflow: 'hidden', boxShadow: golge, border: '1px solid #eef1f5', marginBottom: 12, background: '#e5edf5' },
  harita: { height: '48vh', minHeight: 300, width: '100%' },
  haritaUst: { position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 500, background: 'rgba(15,23,42,.8)', color: '#fff', fontSize: 12.5, fontWeight: 600, padding: '6px 12px', borderRadius: 20 },
  ozet: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', background: '#fff', borderRadius: 18, boxShadow: golge, border: '1px solid #eef1f5', marginBottom: 10 },
  ozetHucre: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 4px', gap: 2, fontSize: 17, color: '#0b1730' },
  ozetAd: { fontSize: 11.5, color: '#94a3b8', fontWeight: 500 },
  butonlar: { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 10 },
  ikincilBtn: { display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #dbe3ee', background: '#fff', color: '#1e3a8a', borderRadius: 12, padding: '9px 12px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  secim: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: '#334155', fontWeight: 500 },
  navBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'linear-gradient(145deg,#3b82f6,#1d4ed8)', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 15, borderRadius: 14, padding: '13px', marginBottom: 12, boxShadow: '0 8px 18px rgba(29,78,216,.3)' },
  kart: { background: '#fff', borderRadius: 20, padding: '8px 14px', boxShadow: golge, border: '1px solid #eef1f5' },
  kartBaslik: { fontSize: 14.5, fontWeight: 700, color: '#0b1730', padding: '8px 0' },
  durak: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: '1px solid #f1f4f8' },
  sira: { width: 30, height: 30, borderRadius: '50%', color: '#fff', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  durakAd: { fontWeight: 700, fontSize: 14.5, color: '#0b1730', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  durakAlt: { fontSize: 13, color: '#475569', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  durakMeta: { fontSize: 12, color: '#94a3b8', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  gitBtn: { flexShrink: 0, border: 'none', background: '#eff6ff', color: '#1d4ed8', fontWeight: 700, fontSize: 13, borderRadius: 10, padding: '8px 12px', textDecoration: 'none', cursor: 'pointer', fontFamily: 'inherit' },
  kucukBtn: { flexShrink: 0, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontWeight: 600, fontSize: 12.5, borderRadius: 10, padding: '7px 10px', cursor: 'pointer', marginLeft: 8, fontFamily: 'inherit' },
  bos: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' },
  not: { fontSize: 12.5, color: '#64748b', lineHeight: 1.5, padding: '10px 0 6px' },
  hata: { background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 12, padding: 10, fontSize: 13.5, marginBottom: 10 },
  bilgi: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e3a8a', borderRadius: 12, padding: 10, fontSize: 13.5, marginBottom: 10 },
};
