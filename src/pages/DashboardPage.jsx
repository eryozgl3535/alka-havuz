import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabase';
import { FIRMA } from '../firma';
import { Ikon as SIkon, IkonKutu } from '../ikonlar';
import { bakimBul, kisisel, BILGI_SABLON, telefonWa } from './TopluMesajPage.jsx';

const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const KATEGORI_IKON = { Havuz: '🏊', Kuyu: '💧', Hidrofor: '🔵', Sulama: '🌱', Tesisat: '🔧', Elektrik: '⚡' };
const HIZLI_ANAHTAR = 'alkaHizliErisim6';

const yerel = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function kalanGun(tarih) {
  if (!tarih) return null;
  const hedef = new Date(tarih + 'T00:00:00');
  const bugun = new Date(yerel(new Date()) + 'T00:00:00');
  return Math.round((hedef - bugun) / 86400000);
}

function trTarih(t) {
  if (!t) return '-';
  const d = new Date(t + 'T00:00:00');
  return `${d.getDate()} ${AYLAR[d.getMonth()]} ${d.getFullYear()}`;
}

function kalanYazi(g) {
  if (g === null) return { yazi: '-', renk: '#94a3b8' };
  if (g < 0) return { yazi: `${-g} gün gecikti`, renk: '#dc2626' };
  if (g === 0) return { yazi: 'Bugün', renk: '#ea580c' };
  if (g <= 7) return { yazi: `${g} gün kaldı`, renk: '#f59e0b' };
  return { yazi: `${g} gün kaldı`, renk: '#1d6fe0' };
}

function havaBilgi(kod) {
  if (kod === 0) return { ikon: '☀️', ad: 'Açık' };
  if (kod <= 2) return { ikon: '🌤️', ad: 'Az bulutlu' };
  if (kod === 3) return { ikon: '☁️', ad: 'Bulutlu' };
  if (kod <= 48) return { ikon: '🌫️', ad: 'Sisli' };
  if (kod <= 67 || (kod >= 80 && kod <= 82)) return { ikon: '🌧️', ad: 'Yağmurlu' };
  if (kod <= 77 || kod === 85 || kod === 86) return { ikon: '🌨️', ad: 'Karlı' };
  return { ikon: '⛈️', ad: 'Fırtınalı' };
}

// ---- Simgeler ----
function Svg({ children, boyut = 26 }) {
  return <svg width={boyut} height={boyut} viewBox="0 0 24 24" style={{ display: 'block' }}>{children}</svg>;
}
const cizgi = (renk, k = 2) => ({ fill: 'none', stroke: renk, strokeWidth: k, strokeLinecap: 'round', strokeLinejoin: 'round' });

const SIMGE = {
  pano: (r) => <Svg><rect x="5" y="4" width="14" height="17" rx="2.5" fill={r} /><rect x="9" y="2.5" width="6" height="3.5" rx="1.2" fill={r} stroke="#fff" strokeWidth="1.2" /><path d="M8.5 11h7M8.5 14.5h7M8.5 18h4" {...cizgi('#fff', 1.8)} /></Svg>,
  kumSaati: (r) => <Svg><path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9" {...cizgi(r, 2.2)} /><path d="M9.5 18.5h5l-2.5-3z" fill={r} /></Svg>,
  tik: (r) => <Svg><path d="m4.5 12.5 5 5 10-11" {...cizgi(r, 3)} /></Svg>,
  kisiler: (r) => <Svg><circle cx="12" cy="8" r="3.2" fill={r} /><path d="M5.5 19c.5-3.5 3.2-5.3 6.5-5.3s6 1.8 6.5 5.3z" fill={r} /><circle cx="5.5" cy="9.5" r="2.3" fill={r} /><circle cx="18.5" cy="9.5" r="2.3" fill={r} /><path d="M1.5 18c.3-2.3 1.8-3.6 4-3.8M22.5 18c-.3-2.3-1.8-3.6-4-3.8" {...cizgi(r, 2.2)} /></Svg>,
  kisiEkle: (r) => <Svg><circle cx="10" cy="8" r="4" fill={r} /><path d="M2.5 20.5c.6-4.2 3.6-6.3 7.5-6.3 1.6 0 3 .3 4.2 1" fill={r} /><path d="M18.5 13v7M15 16.5h7" {...cizgi(r, 2.4)} /></Svg>,
  artiKare: (r) => <Svg><rect x="3" y="3" width="18" height="18" rx="4" fill={r} /><path d="M12 7.5v9M7.5 12h9" {...cizgi('#fff', 2.6)} /></Svg>,
  takvim: (r) => <Svg><rect x="3.5" y="5" width="17" height="15.5" rx="3" {...cizgi(r, 2.2)} /><path d="M3.5 10h17M8 3v4M16 3v4" {...cizgi(r, 2.2)} /></Svg>,
  gelis: (r) => <Svg><rect x="2.5" y="5" width="15" height="14" rx="2.5" {...cizgi(r, 2)} /><path d="M2.5 9.5h15M6.5 3v4M13.5 3v4" {...cizgi(r, 2)} /><circle cx="17" cy="17" r="5" fill="#fff" stroke={r} strokeWidth="2" /><path d="M17 14.8V17l1.5 1" {...cizgi(r, 1.8)} /></Svg>,
  grafik: (r) => <Svg><rect x="4" y="12" width="4" height="9" rx="1.3" fill={r} /><rect x="10" y="4" width="4" height="17" rx="1.3" fill={r} /><rect x="16" y="9" width="4" height="12" rx="1.3" fill={r} /></Svg>,
  ayar: (r) => <Svg><path d="M12 2.5l2 2.2 2.9-.6.9 2.8 2.8.9-.6 2.9 2.2 2-2.2 2 .6 2.9-2.8.9-.9 2.8-2.9-.6-2 2.2-2-2.2-2.9.6-.9-2.8-2.8-.9.6-2.9L1.8 12.7l2.2-2-.6-2.9 2.8-.9.9-2.8 2.9.6z" fill={r} /><circle cx="12" cy="12" r="3.3" fill="#fff" /></Svg>,
  mesaj: (r) => <Svg><path d="M4 4h16a1.5 1.5 0 0 1 1.5 1.5v10A1.5 1.5 0 0 1 20 17H9l-5 4v-4H4a1.5 1.5 0 0 1-1.5-1.5v-10A1.5 1.5 0 0 1 4 4z" fill={r} /><path d="M7 9h10M7 12.5h6" {...cizgi('#fff', 1.8)} /></Svg>,
  rehber: (r) => <Svg><rect x="4" y="2.5" width="15" height="19" rx="2.5" fill={r} /><circle cx="11.5" cy="9.5" r="2.6" fill="#fff" /><path d="M7.5 17c.4-2.3 1.9-3.5 4-3.5s3.6 1.2 4 3.5" fill="#fff" /><path d="M21 6v3M21 12v3" {...cizgi(r, 2)} /></Svg>,
  konum: (r) => <Svg boyut={16}><path d="M12 22s7-6.3 7-12a7 7 0 1 0-14 0c0 5.7 7 12 7 12z" fill={r} /><circle cx="12" cy="10" r="2.6" fill="#fff" /></Svg>,
  ok: (r) => <Svg boyut={20}><path d="m9 6 6 6-6 6" {...cizgi(r, 2.4)} /></Svg>,
  kalem: (r) => <Svg boyut={18}><path d="M4 20h4L19 9l-4-4L4 16z" {...cizgi(r, 2)} /></Svg>,
  takvimKucuk: (r) => <Svg boyut={16}><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" {...cizgi(r, 2)} /><path d="M3.5 10h17M8 3v4M16 3v4" {...cizgi(r, 2)} /></Svg>,
};

const TUM_HIZLI = [
  { id: 'musteriler', hedef: 'musteriler', ad: 'Müşteriler', ik: 'kisiler', renk: '#2563eb' },
  { id: 'harita', hedef: 'harita', ad: 'Harita', ik: 'harita', renk: '#0284c7' },
  { id: 'notlar', hedef: 'notlar', ad: 'Notlar', ik: 'kalem', renk: '#d97706' },
  { id: 'takvim', hedef: 'takvim', ad: 'Takvim', ik: 'takvim', renk: '#7c3aed' },
  { id: 'raporlar', hedef: 'raporlar', ad: 'Raporlar', ik: 'grafik', renk: '#16a34a' },
  { id: 'ayarlar', hedef: 'ayarlar', ad: 'Ayarlar', ik: 'ayar', renk: '#475569' },
  { id: 'isEmirleri', hedef: 'isemirleri', ad: 'İş Emirleri', ik: 'pano', renk: '#ea580c' },
  { id: 'gelisler', hedef: 'gelisler', ad: 'Geliş Planı', ik: 'takvimSaat', renk: '#0d9488' },
  { id: 'toplumesaj', hedef: 'toplumesaj', ad: 'Toplu Mesaj', ik: 'hoparlor', renk: '#db2777' },
  { id: 'rehber', hedef: 'rehber', ad: 'Rehber', ik: 'rehber', renk: '#0891b2' },
];
const VARSAYILAN_HIZLI = ['musteriler', 'harita', 'notlar', 'raporlar'];

function hizliOku() {
  try {
    const v = JSON.parse(localStorage.getItem(HIZLI_ANAHTAR) || 'null');
    if (Array.isArray(v) && v.length) return v.filter((id) => TUM_HIZLI.some((h) => h.id === id));
  } catch { /* yoksay */ }
  return VARSAYILAN_HIZLI;
}

export default function DashboardPage({ onNavigate, ad }) {
  const [kurallar, setKurallar] = useState([]);
  const [tamamlanan, setTamamlanan] = useState(0);
  const [musteriSayi, setMusteriSayi] = useState(0);
  const [hizli, setHizli] = useState(hizliOku);
  const [sonMesajlar, setSonMesajlar] = useState([]);
  const [hatirlatmalar, setHatirlatmalar] = useState([]);
  const [gonderilen, setGonderilen] = useState([]);
  const [duzenle, setDuzenle] = useState(false);

  const git = (id) => onNavigate && onNavigate(id);

  useEffect(() => {
    (async () => {
      const bugun = new Date();
      const ayBas = yerel(new Date(bugun.getFullYear(), bugun.getMonth(), 1));
      const ucHafta = new Date(); ucHafta.setDate(ucHafta.getDate() - 21);
      supabase.from('mesaj_kayitlari').select('customer_id, baslik, tur, created_at').gte('created_at', ucHafta.toISOString())
        .then((r) => setSonMesajlar((r.data || []).filter((x) => !String(x.tur || '').startsWith('not') && !String(x.tur || '').startsWith('hatirlatma'))));
      supabase.from('mesaj_kayitlari').select('id, tur, mesaj, customers(name)').eq('tur', 'hatirlatma')
        .then((r) => setHatirlatmalar(r.data || []));
      const [k, t, m] = await Promise.all([
        supabase.from('maintenance_rules').select('*, equipment(category, equipment_type, customers(id, name, phone, address))'),
        supabase.from('work_orders').select('id', { count: 'exact', head: true }).eq('status', 'tamamlandi').gte('completed_date', ayBas),
        supabase.from('customers').select('id', { count: 'exact', head: true }),
      ]);
      setKurallar((k.data || []).filter((x) => x.active !== false && x.next_due_date));
      setTamamlanan(t.count || 0);
      setMusteriSayi(m.count || 0);
    })();

  }, []);

  function hizliDegis(id) {
    const yeni = hizli.includes(id) ? hizli.filter((x) => x !== id) : [...hizli, id];
    if (yeni.length === 0) return;
    setHizli(yeni);
    try { localStorage.setItem(HIZLI_ANAHTAR, JSON.stringify(yeni)); } catch { /* yoksay */ }
  }

  const gecikmis = kurallar.filter((k) => kalanGun(k.next_due_date) < 0).length;
  const yaklasan = kurallar.filter((k) => { const g = kalanGun(k.next_due_date); return g >= 0 && g <= 30; }).length;
  const liste = [...kurallar].sort((a, b) => a.next_due_date.localeCompare(b.next_due_date)).slice(0, 5);

  const istatistik = [
    { ad: 'Gecikmiş', alt: 'bakım', sayi: gecikmis, ik: 'pano', renk: '#dc2626', hedef: 'takvim' },
    { ad: 'Yaklaşan', alt: '30 gün içinde', sayi: yaklasan, ik: 'kumSaati', renk: '#d97706', hedef: 'takvim' },
    { ad: 'Tamamlanan', alt: 'bu ay', sayi: tamamlanan, ik: 'tik', renk: '#16a34a', hedef: 'isemirleri' },
    { ad: 'Müşteri', alt: 'toplam', sayi: musteriSayi, ik: 'kisiler', renk: '#2563eb', hedef: 'musteriler' },
  ];

  const gorunenHizli = duzenle ? TUM_HIZLI : hizli.map((id) => TUM_HIZLI.find((h) => h.id === id)).filter(Boolean);
  const genis = typeof window !== 'undefined' && window.innerWidth >= 900;

  const bugunHatirlatma = hatirlatmalar
    .map((h) => { let v = {}; try { v = JSON.parse(h.mesaj || '{}'); } catch { v = {}; }
      const g = v.tarih ? Math.round((new Date(v.tarih + 'T00:00:00') - new Date(new Date().toDateString())) / 86400000) : null;
      return { h, v, g }; })
    .filter((x) => x.g != null && x.g <= 2)
    .sort((a, b) => a.g - b.g);

  const mesajAdaylari = kurallar
    .map((k) => ({ k, g: kalanGun(k.next_due_date), m: k.equipment?.customers }))
    .filter(({ k, g, m }) => {
      if (!m?.phone || g > 7 || g < -60 || gonderilen.includes(k.id)) return false;
      const bakimAd = bakimBul(k.rule_name)?.ad || k.rule_name;
      return !sonMesajlar.some((x) => x.customer_id === m.id && (String(x.baslik || '').includes(bakimAd) || (Date.now() - new Date(x.created_at)) < 7 * 86400000));
    })
    .sort((a, b) => a.g - b.g);

  async function hatirlatmaGonder({ k, m }) {
    const bakimAd = bakimBul(k.rule_name)?.ad || k.rule_name;
    const mesaj = kisisel(BILGI_SABLON, m.name, bakimAd);
    const numara = telefonWa(m.phone);
    if (!numara) return;
    window.open(`https://wa.me/${numara}?text=${encodeURIComponent(mesaj)}`, '_blank');
    setGonderilen((l) => [...l, k.id]);
    await supabase.from('mesaj_kayitlari').insert([{
      customer_id: m.id, kanal: 'whatsapp', tur: 'bilgilendirme', baslik: `Bakım hatırlatması · ${bakimAd}`, mesaj, gonderen: ad || '',
    }]);
  }

  function uyariAksiyon(hedef) {
    if (hedef === 'harita') { git('harita'); return; }
    sessionStorage.setItem('alkaSablon', hedef);
    git('toplumesaj');
  }

  function aramaGit(q) {
    sessionStorage.setItem('alkaArama', q);
    git('musteriler');
  }

  return (
    <div style={s.sayfa}>

      <HavaKarti onAra={aramaGit} ustuneBin onUyari={uyariAksiyon} />

      {bugunHatirlatma.length > 0 && (
        <section style={s.hatSerit}>
          <div style={s.hatSeritBaslik}>
            <span style={{ display: 'inline-flex', verticalAlign: '-4px', marginRight: 7 }}><SIkon ad="zil" boyut={17} renk="#b91c1c" /></span>
            Hatırlatmalar
            <span style={s.hatSeritRozet}>{bugunHatirlatma.length}</span>
          </div>
          {bugunHatirlatma.slice(0, 3).map((x) => {
            const gec = x.g < 0;
            return (
              <button key={x.h.id} style={s.hatSeritSatir} onClick={() => git('hatirlatmalar')}>
                <span style={{ ...s.hatNokta, background: gec ? '#dc2626' : '#f59e0b' }} />
                <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <span style={s.hatSeritAd}>{x.v.baslik || 'Hatırlatma'}</span>
                  <span style={s.hatSeritAlt}>{gec ? `${-x.g} gün geçti` : x.g === 0 ? 'Bugün' : x.g === 1 ? 'Yarın' : `${x.g} gün kaldı`}{x.h.customers?.name ? ` · ${x.h.customers.name}` : ''}</span>
                </span>
                {x.v.tutar != null && <span style={s.hatSeritTutar}>{Number(x.v.tutar).toLocaleString('tr-TR')} ₺</span>}
              </button>
            );
          })}
          {bugunHatirlatma.length > 3 && <button style={s.hatSeritHepsi} onClick={() => git('hatirlatmalar')}>+{bugunHatirlatma.length - 3} tane daha · Tümünü gör</button>}
        </section>
      )}

      {/* Ana işlemler */}
      <div style={s.anaIzgara}>
        {ANA_ISLEMLER.map((x) => (
          <button key={x.ad} style={{ ...s.anaKutu, background: x.zemin }} onClick={() => git(x.hedef)}>
            <span style={s.anaIkon}><SIkon ad={x.ik} boyut={21} renk="#fff" kalin={2.2} /></span>
            <span style={s.anaAd}>{x.etiket}</span>
          </button>
        ))}
      </div>

      {/* Özet */}
      <div style={s.istKutu}>
        {istatistik.map((k, i) => (
          <button key={k.ad} style={{ ...s.istHucre, ...(i > 0 ? { borderLeft: '1px solid #eef1f5' } : {}) }} onClick={() => git(k.hedef)}>
            <IkonKutu ad={k.ik} renk={k.renk} boyut={34} yaricap={10} />
            <span style={{ ...s.istSayi, color: k.sayi > 0 && k.ad === 'Gecikmiş' ? '#dc2626' : '#0b1730' }}>{k.sayi}</span>
            <span style={s.istAd}>{k.ad}</span>
            <span style={s.istAlt}>{k.alt}</span>
          </button>
        ))}
      </div>

      {/* Bugün mesaj atılacaklar */}
      <section style={s.kutu}>
        <div style={s.kutuUst}>
          <h2 style={s.kutuBaslik}>
            Mesaj atılacaklar
            {mesajAdaylari.length > 0 && <span style={s.sayiRozet}>{mesajAdaylari.length}</span>}
          </h2>
          <button style={s.linkBtn} onClick={() => git('toplumesaj')}>Toplu Mesaj <SIkon ad="sag" boyut={16} renk="#2563eb" kalin={2.4} /></button>
        </div>
        {mesajAdaylari.length === 0 ? (
          <div style={s.bosKutu}>
            <IkonKutu ad="tik" renk="#16a34a" boyut={44} yaricap={14} />
            <div>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14.5 }}>Bekleyen hatırlatma yok</div>
              <div style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>Bakımı 7 gün içinde gelen müşteriler burada listelenir.</div>
            </div>
          </div>
        ) : (
          mesajAdaylari.slice(0, 6).map((x, i) => {
            const kat = KATEGORI_IK[x.k.equipment?.category] || KATEGORI_IK.varsayilan;
            const ky = kalanYazi(x.g);
            return (
              <div key={x.k.id} style={{ ...s.mesajSatir, ...(i === 0 ? { borderTop: 'none' } : {}) }}>
                <IkonKutu ad={kat.ik} renk={kat.renk} boyut={40} yaricap={12} />
                <div style={s.bakimOrta}>
                  <div style={s.bakimAd}>{x.m.name}</div>
                  <div style={s.bakimKural}>{x.k.rule_name} · <span style={{ color: ky.renk, fontWeight: 700 }}>{ky.yazi}</span></div>
                </div>
                <button style={s.waBtn} onClick={() => hatirlatmaGonder(x)}>
                  <SIkon ad="gonder" boyut={15} renk="#fff" kalin={2.2} /> Gönder
                </button>
              </div>
            );
          })
        )}
        {mesajAdaylari.length > 6 && (
          <button style={{ ...s.linkBtn, margin: '4px auto 6px' }} onClick={() => git('toplumesaj')}>+{mesajAdaylari.length - 6} kişi daha · Toplu Mesaj'da gönder</button>
        )}
      </section>

      {/* Yaklaşan Bakımlar */}
      <section style={s.kutu}>
        <div style={s.kutuUst}>
          <h2 style={s.kutuBaslik}>Yaklaşan Bakımlar</h2>
          <button style={s.linkBtn} onClick={() => git('takvim')}>Tümü <SIkon ad="sag" boyut={16} renk="#2563eb" kalin={2.4} /></button>
        </div>
        {liste.length === 0 && (
          <div style={s.bosKutu}>
            <IkonKutu ad="takvim" renk="#2563eb" boyut={44} yaricap={14} />
            <div>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14.5 }}>Takipte bakım yok</div>
              <div style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>Müşteri kartından cihaz ve bakım ekleyebilirsin.</div>
            </div>
          </div>
        )}
        {liste.map((k, i) => {
          const e = k.equipment || {};
          const m = e.customers || {};
          const g = kalanGun(k.next_due_date);
          const kalan = kalanYazi(g);
          const tema = g < 0 ? { r: '#dc2626', z: '#fef2f2' } : g <= 14 ? { r: '#c2410c', z: '#fff7ed' } : { r: '#1d4ed8', z: '#eff6ff' };
          const kat = KATEGORI_IK[e.category] || KATEGORI_IK.varsayilan;
          const konum = String(m.address || '').split(',')[0].trim();
          return (
            <button key={k.id} style={{ ...s.bakimSatir, ...(i === 0 ? { borderTop: 'none' } : {}) }} onClick={() => git('takvim')}>
              <IkonKutu ad={kat.ik} renk={kat.renk} boyut={44} yaricap={13} />
              <div style={s.bakimOrta}>
                <div style={s.bakimAd}>{m.name || 'Müşteri'}</div>
                <div style={s.bakimKural}>{k.rule_name}</div>
                <div style={s.bakimMeta}>
                  <SIkon ad="takvim" boyut={13} renk="#94a3b8" /><span>{trTarih(k.next_due_date)}</span>
                  {konum && <><span style={{ color: '#cbd5e1' }}>·</span><SIkon ad="konum" boyut={13} renk="#94a3b8" /><span style={s.tekSatir}>{konum}</span></>}
                </div>
              </div>
              <span style={{ ...s.kalanHap, color: tema.r, background: tema.z }}>{kalan.yazi}</span>
            </button>
          );
        })}
      </section>

      {/* Hızlı Erişim */}
      <section style={s.kutu}>
        <div style={s.kutuUst}>
          <h2 style={s.kutuBaslik}>Hızlı Erişim</h2>
          <button style={s.linkBtn} onClick={() => setDuzenle(!duzenle)}>
            {duzenle ? 'Bitti' : <>Düzenle <SIkon ad="kalem" boyut={14} renk="#2563eb" /></>}
          </button>
        </div>
        {duzenle && <div style={s.ipucu}>Görmek istediğin kutulara dokunarak seç.</div>}
        <div style={s.hizliIzgara}>
          {gorunenHizli.map((h) => {
            const secili = hizli.includes(h.id);
            return (
              <button
                key={h.id}
                style={{ ...s.hizliBtn, ...(duzenle && !secili ? { opacity: 0.4 } : {}), ...(duzenle && secili ? { boxShadow: '0 0 0 2px #2563eb' } : {}) }}
                onClick={() => (duzenle ? hizliDegis(h.id) : git(h.hedef))}
              >
                <IkonKutu ad={h.ik} renk={h.renk} boyut={42} yaricap={13} />
                <span style={s.hizliAd}>{h.ad}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

const beyazIkon = {
  arti: <svg width="34" height="34" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#fff" /><path d="M12 7v10M7 12h10" stroke="#1d4ed8" strokeWidth="2.6" strokeLinecap="round" /></svg>,
  kisi: <svg width="34" height="34" viewBox="0 0 24 24"><circle cx="10" cy="8" r="4" fill="#fff" /><path d="M2.5 20.5c.6-4.2 3.6-6.3 7.5-6.3 1.6 0 3 .3 4.2 1V20.5z" fill="#fff" /><path d="M18.5 12.5v7M15 16h7" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" /></svg>,
  takvim: <svg width="32" height="32" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="3" fill="none" stroke="#fff" strokeWidth="2.2" /><path d="M3.5 10h17M8 3v4M16 3v4" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" /><circle cx="8.5" cy="14.5" r="1.3" fill="#fff" /><circle cx="12" cy="14.5" r="1.3" fill="#fff" /><circle cx="15.5" cy="14.5" r="1.3" fill="#fff" /></svg>,
  mesaj: <svg width="32" height="32" viewBox="0 0 24 24"><path d="M4 3.5h16A1.5 1.5 0 0 1 21.5 5v10a1.5 1.5 0 0 1-1.5 1.5H10l-5 4v-4H4A1.5 1.5 0 0 1 2.5 15V5A1.5 1.5 0 0 1 4 3.5z" fill="#fff" /><path d="M7 8.5h10M7 12h6" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" /></svg>,
};

const ANA_ISLEMLER = [
  { ad: 'Yeni İş Kaydı', etiket: 'Yeni\nİş Kaydı', hedef: 'isemirleri', ik: 'arti', zemin: 'linear-gradient(150deg,#2f6bff 0%,#1d4ed8 55%,#1e3a8a 100%)' },
  { ad: 'Yeni Müşteri', etiket: 'Yeni\nMüşteri', hedef: 'musteriler', ik: 'kisiEkle', zemin: 'linear-gradient(150deg,#14b8a6 0%,#0d9488 55%,#115e59 100%)' },
  { ad: 'Geliş Planı', etiket: 'Geliş\nPlanı', hedef: 'gelisler', ik: 'takvimSaat', zemin: 'linear-gradient(150deg,#f59e0b 0%,#ea7a0c 55%,#c2410c 100%)' },
  { ad: 'Toplu Mesaj', etiket: 'Toplu\nMesaj', hedef: 'toplumesaj', ik: 'mesaj', zemin: 'linear-gradient(150deg,#8b5cf6 0%,#7c3aed 55%,#5b21b6 100%)' },
  { ad: 'Hatırlatma', etiket: 'Hatır-\nlatma', hedef: 'hatirlatmalar', ik: 'zil', zemin: 'linear-gradient(150deg,#f87171 0%,#dc2626 55%,#991b1b 100%)' },
];

const KATEGORI_IK = {
  Havuz: { ik: 'dalga', renk: '#0284c7' },
  Kuyu: { ik: 'damla', renk: '#0891b2' },
  Hidrofor: { ik: 'gosterge', renk: '#2563eb' },
  Sulama: { ik: 'filiz', renk: '#16a34a' },
  Tesisat: { ik: 'anahtar', renk: '#d97706' },
  Elektrik: { ik: 'simsek', renk: '#ca8a04' },
  varsayilan: { ik: 'anahtar', renk: '#64748b' },
};

const KATEGORI_ZEMIN = {
  Havuz: 'linear-gradient(160deg,#7dd3fc 0%,#0ea5e9 55%,#0369a1 100%)',
  Kuyu: 'linear-gradient(160deg,#cbd5e1 0%,#94a3b8 60%,#64748b 100%)',
  Hidrofor: 'linear-gradient(160deg,#bfdbfe 0%,#60a5fa 60%,#2563eb 100%)',
  Sulama: 'linear-gradient(160deg,#bbf7d0 0%,#4ade80 60%,#16a34a 100%)',
  Tesisat: 'linear-gradient(160deg,#fde68a 0%,#fbbf24 60%,#d97706 100%)',
  Elektrik: 'linear-gradient(160deg,#fef08a 0%,#facc15 60%,#ca8a04 100%)',
  varsayilan: 'linear-gradient(160deg,#e2e8f0 0%,#94a3b8 100%)',
};

function selamla() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Günaydın';
  if (h >= 12 && h < 18) return 'İyi günler';
  if (h >= 18 && h < 23) return 'İyi akşamlar';
  return 'İyi geceler';
}

function bugunYazi() {
  const d = new Date();
  const gun = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'][d.getDay()];
  return `${d.getDate()} ${AYLAR[d.getMonth()]} ${d.getFullYear()}, ${gun}`;
}

const kartGolge2 = '0 1px 2px rgba(16,24,40,.04), 0 6px 18px rgba(16,24,40,.06)';
const kartGolge = '0 4px 18px rgba(15,45,74,0.07)';

const s = {
  sayfa: { padding: '0 14px 20px', maxWidth: 900, margin: '0 auto', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" },
  bugunKart: {
    position: 'relative', overflow: 'hidden', borderRadius: 24, minHeight: 190, background: '#fff',
    boxShadow: '0 8px 26px rgba(15,45,74,0.12)', border: '2px solid #fff', marginBottom: 14,
  },
  bugunFoto: {
    position: 'absolute', top: 0, right: 0, bottom: 0, width: '68%',
    background: 'url(/hero.jpg) center / cover no-repeat, linear-gradient(160deg,#7cc4ef 0%,#3b9fe0 45%,#22c3d6 100%)',
    WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, #000 45%)',
    maskImage: 'linear-gradient(90deg, transparent 0%, #000 45%)',
  },
  bugunSol: { position: 'relative', padding: '20px 20px 18px', maxWidth: '62%' },
  bugunEtiket: { fontSize: 17, fontWeight: 700, color: '#334155' },
  bugunSatir: { display: 'flex', alignItems: 'baseline', gap: 14 },
  bugunSayi: { fontSize: 62, fontWeight: 900, color: '#0b1730', lineHeight: 1.05 },
  bugunBirim: { fontSize: 20, fontWeight: 800, color: '#0b1730' },
  bugunAlt: { fontSize: 14, color: '#475569', margin: '6px 0 12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  yeniIsBtn: {
    border: 'none', background: '#dbe9fd', color: '#0b1730', fontWeight: 800, fontSize: 15, borderRadius: 12,
    padding: '10px 18px', cursor: 'pointer',
  },
  havaCip: {
    position: 'absolute', top: 14, right: 14, display: 'flex', alignItems: 'center', gap: 8,
    background: 'rgba(15,23,42,0.72)', color: '#fff', borderRadius: 26, padding: '8px 16px 8px 12px',
    border: '1.5px solid rgba(255,255,255,0.7)', backdropFilter: 'blur(6px)',
  },
  tahminSerit: {
    position: 'relative', display: 'flex', gap: 6, overflowX: 'auto', margin: '0 12px 12px',
    padding: 6, borderRadius: 16, background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)', boxShadow: '0 4px 14px rgba(15,45,74,0.12)', scrollbarWidth: 'none',
  },
  tahminGun: {
    flex: '1 0 54px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    padding: '6px 2px', borderRadius: 12,
  },
  tahminBugun: { background: '#dbeafe' },
  tahminAd: { fontSize: 12, fontWeight: 700, color: '#334155' },
  tahminDerece: { fontSize: 12.5, color: '#0b1730', whiteSpace: 'nowrap' },
  tahminEk: { fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap' },
  havaDerece: { fontSize: 18, fontWeight: 800, lineHeight: 1.1 },
  havaSehir: { fontSize: 12, opacity: 0.9 },
  istIzgara: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginBottom: 14 },
  istKart: {
    position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, padding: '10px 10px 10px',
    borderRadius: 18, border: '1px solid', cursor: 'pointer', textAlign: 'left', minWidth: 0, boxShadow: kartGolge,
  },
  anaIzgara: { display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 7, margin: '14px 0 12px' },
  anaKutu: {
    position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-start', height: 92,
    padding: '11px 10px', borderRadius: 18, border: 'none', cursor: 'pointer', textAlign: 'left', color: '#fff', minWidth: 0,
    boxShadow: '0 6px 14px rgba(15,23,42,0.14), inset 0 1px 0 rgba(255,255,255,0.18)', fontFamily: 'inherit',
  },
  anaIkon: { width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  anaAlt: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', width: '100%', gap: 2, marginTop: 8 },
  anaAd: { display: 'block', fontSize: 11, fontWeight: 700, lineHeight: 1.2, whiteSpace: 'pre-line', letterSpacing: -0.2 },
  istAlt: { fontSize: 10.5, color: '#94a3b8', fontWeight: 500, whiteSpace: 'nowrap' },
  bakimKural: { fontSize: 13, color: '#64748b', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  bakimMeta: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#64748b', marginTop: 4, minWidth: 0, whiteSpace: 'nowrap' },
  kalanHap: { fontSize: 11.5, fontWeight: 700, borderRadius: 8, padding: '5px 8px', whiteSpace: 'nowrap', flexShrink: 0 },
  istKutu: {
    display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', background: '#fff', borderRadius: 20, marginBottom: 14,
    boxShadow: kartGolge2, border: '1px solid #eef1f5', overflow: 'hidden',
  },
  istHucre: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '14px 4px 12px', border: 'none', background: 'transparent',
    cursor: 'pointer', minWidth: 0, fontFamily: 'inherit',
  },
  bosKutu: { display: 'flex', alignItems: 'center', gap: 12, padding: '6px 4px 2px' },
  hatSerit: { background: '#fff', border: '1px solid #fde0e0', borderRadius: 18, padding: '12px 12px 8px', marginBottom: 12, boxShadow: '0 1px 2px rgba(16,24,40,.04), 0 6px 18px rgba(220,38,38,.07)' },
  hatSeritBaslik: { fontSize: 14.5, fontWeight: 800, color: '#0b1730', marginBottom: 8, display: 'flex', alignItems: 'center' },
  hatSeritRozet: { marginLeft: 'auto', background: '#dc2626', color: '#fff', fontSize: 11.5, fontWeight: 800, borderRadius: 10, padding: '2px 8px' },
  hatSeritSatir: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 'none', background: 'transparent', borderTop: '1px solid #f6eaea', padding: '10px 0', cursor: 'pointer', fontFamily: 'inherit' },
  hatNokta: { width: 9, height: 9, borderRadius: '50%', flexShrink: 0 },
  hatSeritAd: { display: 'block', fontSize: 14, fontWeight: 700, color: '#0b1730', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  hatSeritAlt: { display: 'block', fontSize: 12, color: '#64748b', marginTop: 2 },
  hatSeritTutar: { fontSize: 14, fontWeight: 800, color: '#16a34a', whiteSpace: 'nowrap', flexShrink: 0 },
  hatSeritHepsi: { border: 'none', background: 'transparent', color: '#2563eb', fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: '6px 0 2px', fontFamily: 'inherit' },
  sayiRozet: { marginLeft: 8, background: '#dc2626', color: '#fff', fontSize: 11.5, fontWeight: 800, borderRadius: 10, padding: '2px 7px', verticalAlign: 2 },
  mesajSatir: { display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderTop: '1px solid #f1f4f8' },
  waBtn: {
    display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, border: 'none', borderRadius: 11, padding: '9px 12px',
    background: 'linear-gradient(145deg,#22c55e,#16a34a)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
    boxShadow: '0 4px 10px rgba(22,163,74,.3)', fontFamily: 'inherit',
  },
  istUst: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  selam: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', margin: '2px 2px 12px' },
  selamYazi: { fontSize: 20, fontWeight: 800, color: '#0b1730', letterSpacing: -0.3 },
  selamTarih: { fontSize: 13, color: '#64748b', marginTop: 2, fontWeight: 500 },
  istIkon: { width: 36, height: 36, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  istSayi: { fontSize: 22, fontWeight: 800, lineHeight: 1.1, marginTop: 8, letterSpacing: -0.5 },
  istAd: { fontSize: 12, color: '#0f172a', fontWeight: 700 },
  kutu: { background: '#fff', borderRadius: 20, padding: '14px 14px 10px', marginBottom: 14, boxShadow: kartGolge2, border: '1px solid #eef1f5' },
  kutuUst: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, padding: '0 2px' },
  kutuBaslik: { margin: 0, fontSize: 16, fontWeight: 700, color: '#0b1730', letterSpacing: -0.2 },
  linkBtn: {
    display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap', flexShrink: 0, border: 'none', background: 'transparent', color: '#2563eb',
    fontSize: 13.5, fontWeight: 600, cursor: 'pointer', padding: 4, fontFamily: 'inherit',
  },
  ipucu: { fontSize: 13, color: '#64748b', margin: '-4px 4px 10px' },
  hizliIzgara: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6, paddingBottom: 4 },
  hizliBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 7,
    padding: '10px 2px', borderRadius: 14, border: 'none', background: 'transparent', cursor: 'pointer', minWidth: 0, fontFamily: 'inherit',
  },
  hizliAd: { fontSize: 12, fontWeight: 600, color: '#334155', textAlign: 'center', lineHeight: 1.2 },
  bos: { color: '#64748b', fontSize: 14, padding: '6px 4px 4px' },
  bakimSatir: {
    display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 0', border: 'none',
    borderTop: '1px solid #f1f4f8', background: 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
  },
  bakimResim: { width: 56, height: 50, borderRadius: 14, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 -8px 14px rgba(255,255,255,.25), 0 2px 6px rgba(15,45,74,.15)' },
  bakimOrta: { flex: 1, minWidth: 0 },
  bakimAd: { fontSize: 14.5, fontWeight: 700, color: '#0b1730', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  bakimKonum: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#64748b', marginTop: 3, minWidth: 0 },
  tekSatir: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  bakimSag: { flexShrink: 0, textAlign: 'left' },
  bakimTarih: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: '#64748b' },
  bakimKalan: { fontSize: 13.5, fontWeight: 800, marginTop: 3 },
};

// ================= HAVA DURUMU KARTI =================

const GUN_TAM = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const GUN_KISA = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const SAAT_GENISLIK = 50;
const YENILEME_DK = 10;

function havaTip(kod) {
  if (kod === 0) return 'acik';
  if (kod <= 2) return 'azBulut';
  if (kod === 3) return 'bulut';
  if (kod <= 48) return 'sis';
  if (kod <= 67 || (kod >= 80 && kod <= 82)) return 'yagmur';
  if (kod <= 77 || kod === 85 || kod === 86) return 'kar';
  return 'firtina';
}

const TIP_AD = {
  acik: { gun: 'Güneşli', gece: 'Açık' },
  azBulut: { gun: 'Parçalı bulutlu', gece: 'Parçalı bulutlu' },
  bulut: { gun: 'Bulutlu', gece: 'Bulutlu' },
  sis: { gun: 'Sisli', gece: 'Sisli' },
  yagmur: { gun: 'Yağmurlu', gece: 'Yağmurlu' },
  kar: { gun: 'Karlı', gece: 'Karlı' },
  firtina: { gun: 'Gök gürültülü', gece: 'Gök gürültülü' },
};

const saatYazi = (iso) => iso.slice(11, 16);

const HAVA_CSS = `
.hv-kart{position:relative;overflow:hidden;border-radius:20px;color:#fff;margin-bottom:14px;
  box-shadow:0 8px 24px rgba(15,45,74,.18);transition:background 1.2s ease;isolation:isolate}
.hv-katman{position:absolute;inset:0;pointer-events:none;z-index:0}
.hv-bulut{position:absolute;border-radius:50%;background:radial-gradient(closest-side,rgba(255,255,255,.18),rgba(255,255,255,0));
  filter:blur(6px);animation:hv-suz linear infinite}
@keyframes hv-suz{from{transform:translateX(-40vw)}to{transform:translateX(140vw)}}
.hv-gunes-isik{position:absolute;top:-110px;right:-70px;width:260px;height:260px;border-radius:50%;
  background:radial-gradient(circle,rgba(255,236,150,.45) 0%,rgba(255,214,90,.18) 35%,rgba(255,214,90,0) 70%);
  animation:hv-nefes 6s ease-in-out infinite}
@keyframes hv-nefes{0%,100%{transform:scale(1);opacity:.9}50%{transform:scale(1.12);opacity:1}}
.hv-isinlar{position:absolute;top:-55px;right:-15px;width:160px;height:160px;
  background:repeating-conic-gradient(rgba(255,255,255,.1) 0 6deg,transparent 6deg 24deg);
  border-radius:50%;mask:radial-gradient(circle,#000 20%,transparent 70%);-webkit-mask:radial-gradient(circle,#000 20%,transparent 70%);
  animation:hv-don 40s linear infinite}
.hv-yagmur{position:absolute;inset:-50% 0 0 0;
  background-image:repeating-linear-gradient(105deg,rgba(255,255,255,.0) 0 14px,rgba(255,255,255,.28) 14px 15px,rgba(255,255,255,0) 15px 34px);
  animation:hv-yagis .7s linear infinite}
@keyframes hv-yagis{from{transform:translateY(0)}to{transform:translateY(34%)}}
.hv-yildiz{position:absolute;inset:0;
  background-image:radial-gradient(1.5px 1.5px at 20% 30%,#fff,transparent),radial-gradient(1px 1px at 60% 20%,#fff,transparent),
  radial-gradient(1.5px 1.5px at 80% 60%,#fff,transparent),radial-gradient(1px 1px at 35% 70%,#fff,transparent),
  radial-gradient(1px 1px at 90% 15%,#fff,transparent),radial-gradient(1.5px 1.5px at 10% 80%,#fff,transparent),
  radial-gradient(1px 1px at 50% 50%,#fff,transparent),radial-gradient(1px 1px at 70% 85%,#fff,transparent);
  animation:hv-parilti 3s ease-in-out infinite alternate}
@keyframes hv-parilti{from{opacity:.35}to{opacity:1}}
.hv-simsek{position:absolute;inset:0;background:#fff;opacity:0;animation:hv-cak 7s infinite}
@keyframes hv-cak{0%,91%,95%,100%{opacity:0}92%{opacity:.45}93%{opacity:.05}94%{opacity:.3}}
.hv-icerik{position:relative;z-index:1;padding:14px 16px 10px}
.hv-cam{background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.16);backdrop-filter:blur(12px);
  -webkit-backdrop-filter:blur(12px);border-radius:14px}
.hv-gir{animation:hv-gir .55s cubic-bezier(.2,.8,.2,1)}
@keyframes hv-gir{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.hv-kaydir{overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;scroll-behavior:smooth}
.hv-kaydir::-webkit-scrollbar{display:none}
.hv-gunbtn{transition:transform .2s,background .3s,color .3s}
.hv-gunbtn:hover{transform:translateY(-2px)}
.hv-cizgi{stroke-dasharray:2000;stroke-dashoffset:2000;animation:hv-ciz 1.4s ease forwards}
@keyframes hv-ciz{to{stroke-dashoffset:0}}
.hv-nokta{animation:hv-belir .5s ease both}
@keyframes hv-belir{from{opacity:0;transform:scale(.3)}to{opacity:1;transform:none}}
.hv-don{animation:hv-don 12s linear infinite;transform-origin:center;transform-box:fill-box}
@keyframes hv-don{to{transform:rotate(360deg)}}
.hv-sall{animation:hv-sall 4s ease-in-out infinite alternate}
@keyframes hv-sall{from{transform:translateX(-2.5px)}to{transform:translateX(2.5px)}}
.hv-damla{animation:hv-damla 1.1s linear infinite}
@keyframes hv-damla{0%{transform:translateY(-3px);opacity:0}30%{opacity:1}100%{transform:translateY(9px);opacity:0}}
.hv-kar{animation:hv-karyag 2.2s linear infinite}
@keyframes hv-karyag{0%{transform:translate(0,-3px);opacity:0}30%{opacity:1}100%{transform:translate(2px,9px);opacity:0}}
.hv-yanip{animation:hv-yanip 2.4s infinite}
@keyframes hv-yanip{0%,70%,100%{opacity:1}75%{opacity:.15}80%{opacity:1}85%{opacity:.2}}
.hv-sis{animation:hv-sis 3.5s ease-in-out infinite alternate}
@keyframes hv-sis{from{transform:translateX(-3px)}to{transform:translateX(3px)}}
.hv-nabiz{animation:hv-nabiz 3s ease-in-out infinite}
@keyframes hv-nabiz{0%,100%{opacity:.85}50%{opacity:1;filter:drop-shadow(0 0 6px rgba(255,230,140,.9))}}
.hv-yenile.donuyor{animation:hv-don .9s linear infinite}
.hv-iskelet{background:linear-gradient(90deg,rgba(255,255,255,.12),rgba(255,255,255,.3),rgba(255,255,255,.12));
  background-size:200% 100%;animation:hv-parla 1.4s linear infinite;border-radius:12px}
@keyframes hv-parla{from{background-position:200% 0}to{background-position:-200% 0}}
@media (prefers-reduced-motion: reduce){.hv-kart *{animation:none!important}}
`;

const BULUT_YOL = 'M18 50h30a11 11 0 0 0 1-22 15 15 0 0 0-28.5-4A11.5 11.5 0 0 0 18 50z';

function HavaIkon({ tip, gece, boyut = 40 }) {
  const gunes = (cx, cy, r) => (
    <g className="hv-nabiz">
      <g className="hv-don">
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i * Math.PI) / 4;
          return <line key={i} x1={cx + Math.cos(a) * (r + 4)} y1={cy + Math.sin(a) * (r + 4)}
            x2={cx + Math.cos(a) * (r + 9)} y2={cy + Math.sin(a) * (r + 9)} stroke="#FFC93C" strokeWidth="3.2" strokeLinecap="round" />;
        })}
      </g>
      <circle cx={cx} cy={cy} r={r} fill="url(#hvGunes)" />
    </g>
  );
  const ay = (cx, cy, r) => (
    <g className="hv-nabiz">
      <path d={`M${cx + r * 0.3} ${cy - r} a${r} ${r} 0 1 0 ${r * 0.7} ${r * 1.55} a${r * 0.8} ${r * 0.8} 0 1 1 ${-r * 0.7} ${-r * 1.55}z`} fill="#FDE68A" />
    </g>
  );
  const bulut = (renk = '#fff', ek = '') => (
    <g className="hv-sall"><path d={BULUT_YOL} fill={renk} stroke="rgba(15,45,74,.08)" strokeWidth="1" transform={ek} /></g>
  );
  let icerik;
  if (tip === 'acik') icerik = gece ? ay(32, 32, 15) : gunes(32, 32, 13);
  else if (tip === 'azBulut') icerik = <>{gece ? ay(24, 22, 11) : gunes(24, 22, 10)}{bulut('#fff', 'translate(4 4)')}</>;
  else if (tip === 'bulut') icerik = <>{bulut('#cbd5e1', 'translate(-8 -6) scale(.85)')}{bulut('#fff', 'translate(4 4)')}</>;
  else if (tip === 'sis') icerik = <>{bulut('#e2e8f0', 'translate(0 -6)')}<g className="hv-sis" stroke="#e2e8f0" strokeWidth="3.2" strokeLinecap="round"><line x1="12" y1="50" x2="44" y2="50" /><line x1="20" y1="57" x2="52" y2="57" /></g></>;
  else if (tip === 'yagmur' || tip === 'firtina' || tip === 'kar') {
    icerik = (
      <>
        {bulut(tip === 'firtina' ? '#94a3b8' : '#e2e8f0', 'translate(0 -8)')}
        {tip === 'yagmur' && [20, 31, 42].map((x, i) => (
          <line key={x} className="hv-damla" style={{ animationDelay: `${i * 0.35}s` }} x1={x} y1="47" x2={x - 2} y2="53" stroke="#60a5fa" strokeWidth="3" strokeLinecap="round" />
        ))}
        {tip === 'kar' && [20, 31, 42].map((x, i) => (
          <circle key={x} className="hv-kar" style={{ animationDelay: `${i * 0.6}s` }} cx={x} cy="50" r="2.6" fill="#fff" />
        ))}
        {tip === 'firtina' && <path className="hv-yanip" d="M33 42l-7 11h6l-3 9 10-13h-6l4-7z" fill="#FACC15" />}
      </>
    );
  }
  return (
    <svg width={boyut} height={boyut} viewBox="0 0 64 64" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <radialGradient id="hvGunes" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#FFF3B0" /><stop offset="55%" stopColor="#FFC93C" /><stop offset="100%" stopColor="#F59E0B" />
        </radialGradient>
      </defs>
      {icerik}
    </svg>
  );
}

function arkaPlan(tip, gece) {
  // Menüdeki lacivert-mavi tonlarıyla uyumlu
  if (gece) return 'linear-gradient(135deg,#0b2240 0%,#123a63 55%,#1e5a82 100%)';
  switch (tip) {
    case 'acik': return 'linear-gradient(135deg,#0f3d6b 0%,#1e6fae 55%,#3a9ad9 100%)';
    case 'azBulut': return 'linear-gradient(135deg,#123d68 0%,#2366a0 55%,#4a8dc4 100%)';
    case 'bulut': return 'linear-gradient(135deg,#1a3858 0%,#335c85 55%,#5880a6 100%)';
    case 'sis': return 'linear-gradient(135deg,#25405b 0%,#466684 55%,#7290ab 100%)';
    case 'kar': return 'linear-gradient(135deg,#1d4870 0%,#4a7caa 55%,#8bb1d5 100%)';
    default: return 'linear-gradient(135deg,#132a44 0%,#23456b 55%,#3b6288 100%)';
  }
}

function HavaKarti({ onAra, ustuneBin, onUyari }) {
  const [aramaYazi, setAramaYazi] = useState('');
  const [veri, setVeri] = useState(null);
  const [hata, setHata] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [guncel, setGuncel] = useState(null);
  const [secili, setSecili] = useState(0);
  const [simdi, setSimdi] = useState(new Date());
  const [acik, setAcik] = useState(false);
  const saatRef = useRef(null);

  async function getir() {
    setYukleniyor(true);
    try {
      const enlem = FIRMA.enlem || 38.3236;
      const boylam = FIRMA.boylam || 26.3058;
      const r = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${enlem}&longitude=${boylam}` +
        '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day' +
        '&hourly=temperature_2m,weather_code,precipitation_probability,wind_speed_10m,is_day' +
        '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset,uv_index_max' +
        '&forecast_days=7&timezone=Europe%2FIstanbul'
      );
      const d = await r.json();
      if (!d?.current || !d?.daily) throw new Error('veri yok');
      setVeri(d);
      setGuncel(new Date());
      setHata(false);
    } catch {
      setHata(true);
    }
    setYukleniyor(false);
  }

  useEffect(() => {
    getir();
    const yenile = setInterval(getir, YENILEME_DK * 60 * 1000);
    const saat = setInterval(() => setSimdi(new Date()), 60 * 1000);
    const gorunur = () => { if (document.visibilityState === 'visible') getir(); };
    document.addEventListener('visibilitychange', gorunur);
    return () => { clearInterval(yenile); clearInterval(saat); document.removeEventListener('visibilitychange', gorunur); };
  }, []);

  const sehir = FIRMA.sehir || 'Çeşme';

  const aramaKarti = (
    <div style={{ ...hs.aramaKart, ...(ustuneBin ? { marginTop: -36 } : {}) }}>
      <form style={hs.aramaForm} onSubmit={(e) => { e.preventDefault(); if (aramaYazi.trim()) onAra && onAra(aramaYazi.trim()); }}>
        <svg width="22" height="22" viewBox="0 0 24 24" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="7" fill="none" stroke="#334155" strokeWidth="2.2" /><path d="m20 20-3.6-3.6" stroke="#334155" strokeWidth="2.2" strokeLinecap="round" /></svg>
        <input style={hs.aramaInput} value={aramaYazi} onChange={(e) => setAramaYazi(e.target.value)} placeholder="Müşteri ara..." enterKeyHint="search" />
      </form>
      <span style={hs.aramaAyrac} />
      <button style={hs.havaCip} onClick={() => setAcik(!acik)} aria-label="Hava durumu">
        {veri ? (
          <>
            <HavaIkon tip={havaTip(veri.current.weather_code)} gece={veri.current.is_day === 0} boyut={38} />
            <span style={{ textAlign: 'left' }}>
              <span style={{ display: 'block', fontSize: 20, fontWeight: 900, color: '#0b1730', lineHeight: 1 }}>{Math.round(veri.current.temperature_2m)}°</span>
              <span style={{ display: 'block', fontSize: 11.5, color: '#475569', fontWeight: 600, marginTop: 2 }}>{sehir}</span>
            </span>
          </>
        ) : <span style={{ fontSize: 12, color: '#94a3b8' }}>Hava…</span>}
        <svg width="16" height="16" viewBox="0 0 24 24" style={{ transform: acik ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}><path d="m9 6 6 6-6 6" fill="none" stroke="#334155" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </div>
  );

  const uyarilar = veri ? havaUyarilari(veri) : [];
  const uyariAlani = uyarilar.length > 0 && <HavaUyari liste={uyarilar} onUyari={onUyari} />;

  if (!acik) return <div style={{ marginBottom: 12 }}><style>{HAVA_CSS}</style>{aramaKarti}{uyariAlani}</div>;

 if (!veri) {
    return (
      <>{aramaKarti}<div style={{ height: 12 }} />
      <section className="hv-kart" style={{ background: arkaPlan('azBulut', false) }}>
        <style>{HAVA_CSS}</style>
        <div className="hv-icerik">
          {hata ? (
            <div style={{ padding: '30px 0', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Hava durumu şu an alınamadı</div>
              <button onClick={getir} style={hs.tekrarBtn}>Tekrar dene</button>
            </div>
          ) : (
            <>
              <div className="hv-iskelet" style={{ height: 90, marginBottom: 14 }} />
              <div className="hv-iskelet" style={{ height: 110, marginBottom: 14 }} />
              <div className="hv-iskelet" style={{ height: 80 }} />
            </>
          )}
        </div>
      </section>
      </>
    );
  }

  const c = veri.current;
  const anlikTip = havaTip(c.weather_code);
  const anlikGece = c.is_day === 0;
  const gunler = veri.daily.time.map((t, i) => ({
    tarih: t,
    tip: havaTip(veri.daily.weather_code[i]),
    max: Math.round(veri.daily.temperature_2m_max[i]),
    min: Math.round(veri.daily.temperature_2m_min[i]),
    yagmur: veri.daily.precipitation_probability_max?.[i] ?? 0,
    ruzgar: Math.round(veri.daily.wind_speed_10m_max?.[i] ?? 0),
    dogus: veri.daily.sunrise?.[i], batis: veri.daily.sunset?.[i],
    uv: veri.daily.uv_index_max?.[i],
  }));
  const haftaMin = Math.min(...gunler.map((g) => g.min));
  const haftaMax = Math.max(...gunler.map((g) => g.max));
  const sg = gunler[secili];
  const bugunGun = gunler[0];

  const katman = (
    <div className="hv-katman">
        {anlikGece && <div className="hv-yildiz" />}
        {!anlikGece && (anlikTip === 'acik' || anlikTip === 'azBulut') && <><div className="hv-gunes-isik" /><div className="hv-isinlar" /></>}
        {[{ t: 10, w: 260, h: 90, s: 70, d: -10 }, { t: 45, w: 340, h: 110, s: 95, d: -50 }, { t: 70, w: 220, h: 80, s: 60, d: -30 }]
          .slice(0, anlikTip === 'acik' ? 1 : 3)
          .map((b, i) => (
            <div key={i} className="hv-bulut" style={{ top: `${b.t}%`, width: b.w, height: b.h, animationDuration: `${b.s}s`, animationDelay: `${b.d}s`,
              opacity: anlikTip === 'acik' ? 0.5 : 0.9 }} />
          ))}
        {(anlikTip === 'yagmur' || anlikTip === 'firtina') && <div className="hv-yagmur" />}
        {anlikTip === 'firtina' && <div className="hv-simsek" />}
      </div>
  );


  const simdiSaat = `${yerel(simdi)}T${String(simdi.getHours()).padStart(2, '0')}:00`;
  const saatler = veri.hourly.time
    .map((t, i) => ({
      t,
      sicaklik: Math.round(veri.hourly.temperature_2m[i]),
      tip: havaTip(veri.hourly.weather_code[i]),
      gece: veri.hourly.is_day?.[i] === 0,
      yagmur: veri.hourly.precipitation_probability?.[i] ?? 0,
      ruzgar: Math.round(veri.hourly.wind_speed_10m?.[i] ?? 0),
    }))
    .filter((h) => (secili === 0 ? h.t >= simdiSaat : h.t.startsWith(sg.tarih)))
    .slice(0, 24);

  const sMin = Math.min(...saatler.map((h) => h.sicaklik));
  const sMax = Math.max(...saatler.map((h) => h.sicaklik));
  const grafikY = 48;
  const yHesap = (v) => (sMax === sMin ? grafikY / 2 + 10 : 20 + ((sMax - v) / (sMax - sMin)) * (grafikY - 26));
  const noktalar = saatler.map((h, i) => [i * SAAT_GENISLIK + SAAT_GENISLIK / 2, yHesap(h.sicaklik)]);
  let yol = '';
  noktalar.forEach(([x, y], i) => {
    if (i === 0) { yol = `M${x} ${y}`; return; }
    const [px, py] = noktalar[i - 1];
    const cx = (px + x) / 2;
    yol += ` C${cx} ${py} ${cx} ${y} ${x} ${y}`;
  });
  const genislik = saatler.length * SAAT_GENISLIK;
  const alanYol = noktalar.length ? `${yol} L${noktalar[noktalar.length - 1][0]} ${grafikY + 8} L${noktalar[0][0]} ${grafikY + 8} Z` : '';

  const gunEtiket = (i, t) => (i === 0 ? 'Bugün' : i === 1 ? 'Yarın' : GUN_KISA[new Date(t + 'T00:00:00').getDay()]);
  const tamGun = (i, t) => {
    const d = new Date(t + 'T00:00:00');
    return `${i === 0 ? 'Bugün' : i === 1 ? 'Yarın' : GUN_TAM[d.getDay()]} · ${d.getDate()} ${AYLAR[d.getMonth()]}`;
  };

  return (
    <>
    {aramaKarti}
    {uyariAlani}
    <div style={{ height: 12 }} />
    <section className="hv-kart" style={{ background: arkaPlan(anlikTip, anlikGece) }}>
      <style>{HAVA_CSS}</style>

      {katman}

      <div className="hv-icerik">
        {/* Üst: anlık durum + seçili gün özeti */}
        <div style={hs.ust}>
          <div style={{ minWidth: 0 }}>
            <div style={hs.konum}>
              📍 {sehir}
              <button onClick={getir} style={hs.yenileBtn} title="Yenile">
                <span className={`hv-yenile${yukleniyor ? ' donuyor' : ''}`} style={{ display: 'inline-block' }}>⟳</span>
              </button>
              <button onClick={() => setAcik(false)} style={{ ...hs.yenileBtn, width: 'auto', padding: '0 10px', fontSize: 11.5, fontWeight: 700 }}>
                Küçült ⌃
              </button>
            </div>
            <div style={hs.anlik}>
              <HavaIkon tip={anlikTip} gece={anlikGece} boyut={50} />
              <div>
                <div style={hs.buyukDerece}>{Math.round(c.temperature_2m)}°</div>
                <div style={hs.durum}>{TIP_AD[anlikTip][anlikGece ? 'gece' : 'gun']}</div>
              </div>
            </div>
            <div style={hs.detaySatir}>
              <span>🌡️ Hissedilen {Math.round(c.apparent_temperature)}°</span>
              <span>💧 Nem %{c.relative_humidity_2m}</span>
              <span>💨 {Math.round(c.wind_speed_10m)} km/sa</span>
            </div>
          </div>

          <div key={sg.tarih} className="hv-cam hv-gir" style={hs.ozet}>
            <div style={hs.ozetBaslik}>{tamGun(secili, sg.tarih)}</div>
            <div style={hs.ozetDerece}>
              <span style={{ fontSize: 20, fontWeight: 900 }}>{sg.max}°</span>
              <span style={{ opacity: 0.7, fontSize: 15 }}> / {sg.min}°</span>
            </div>
            <div style={hs.ozetDetay}>
              <span>☔ %{sg.yagmur}</span><span>💨 {sg.ruzgar} km/sa</span>
              {sg.uv != null && <span>🔆 UV {Math.round(sg.uv)}</span>}
              {sg.dogus && <span>🌅 {saatYazi(sg.dogus)} · 🌇 {saatYazi(sg.batis)}</span>}
            </div>
          </div>
        </div>

        {/* Saatlik tahmin */}
        <div className="hv-cam" style={{ marginTop: 10, padding: '8px 0 6px' }}>
          <div style={hs.bolumBaslik}>🕒 Saatlik · {secili === 0 ? 'sonraki 24 saat' : tamGun(secili, sg.tarih).split(' · ')[0].toLocaleLowerCase('tr-TR')}</div>
          <div className="hv-kaydir" ref={saatRef}>
            <div key={sg.tarih} className="hv-gir" style={{ position: 'relative', width: Math.max(genislik, 1), padding: '0 6px' }}>
              <div style={{ display: 'flex' }}>
                {saatler.map((h, i) => (
                  <div key={h.t} style={{ ...hs.saatKol, ...(secili === 0 && i === 0 ? hs.saatSimdi : {}) }}>
                    <div style={hs.saatEtiket}>{secili === 0 && i === 0 ? 'Şimdi' : secili === 0 && saatYazi(h.t) === '00:00' ? GUN_KISA[new Date(h.t).getDay()] : saatYazi(h.t)}</div>
                    <HavaIkon tip={h.tip} gece={h.gece} boyut={22} />
                  </div>
                ))}
              </div>
              <svg width={genislik} height={grafikY + 10} style={{ display: 'block' }}>
                <defs>
                  <linearGradient id="hvAlan" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fff" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#fff" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {alanYol && <path d={alanYol} fill="url(#hvAlan)" className="hv-nokta" />}
                <path d={yol} fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" className="hv-cizgi" />
                {noktalar.map(([x, y], i) => (
                  <g key={i} className="hv-nokta" style={{ animationDelay: `${0.2 + i * 0.03}s` }}>
                    <circle cx={x} cy={y} r="2.8" fill="#fff" />
                    <text x={x} y={y - 8} textAnchor="middle" fontSize="11.5" fontWeight="800" fill="#fff"
                      style={{ textShadow: '0 1px 3px rgba(0,0,0,.35)' }}>{saatler[i].sicaklik}°</text>
                  </g>
                ))}
              </svg>
              <div style={{ display: 'flex' }}>
                {saatler.map((h) => (
                  <div key={h.t} style={{ ...hs.saatKol, paddingTop: 0 }}>
                    <div style={{ ...hs.saatYagis, opacity: h.yagmur >= 10 ? 1 : 0.5 }}>💧{h.yagmur}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 7 günlük */}
        <div className="hv-kaydir" style={{ display: 'flex', gap: 6, marginTop: 10, paddingBottom: 2 }}>
          {gunler.map((g, i) => {
            const aktif = i === secili;
            const sol = ((g.min - haftaMin) / Math.max(1, haftaMax - haftaMin)) * 100;
            const gen = ((g.max - g.min) / Math.max(1, haftaMax - haftaMin)) * 100;
            return (
              <button key={g.tarih} className={`hv-gunbtn${aktif ? '' : ' hv-cam'}`} onClick={() => setSecili(i)}
                style={{ ...hs.gunBtn, ...(aktif ? hs.gunBtnAktif : {}) }}>
                <div style={{ fontSize: 11.5, fontWeight: 800 }}>{gunEtiket(i, g.tarih)}</div>
                <div style={aktif ? { filter: 'drop-shadow(0 1px 2px rgba(15,45,74,.45))' } : undefined}>
                  <HavaIkon tip={g.tip} gece={false} boyut={24} />
                </div>
                <div style={{ fontSize: 12, whiteSpace: 'nowrap' }}><b>{g.max}°</b> <span style={{ opacity: 0.7 }}>{g.min}°</span></div>
                <div style={{ ...hs.aralik, background: aktif ? '#dbeafe' : 'rgba(255,255,255,.25)' }}>
                  <div style={{ position: 'absolute', left: `${sol}%`, width: `${Math.max(gen, 8)}%`, top: 0, bottom: 0, borderRadius: 3,
                    background: 'linear-gradient(90deg,#60a5fa,#fbbf24,#f97316)' }} />
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: aktif ? (g.yagmur >= 50 ? '#dc2626' : '#2563eb') : (g.yagmur >= 50 ? '#fecaca' : '#e0f2fe') }}>
                  💧%{g.yagmur}
                </div>
              </button>
            );
          })}
        </div>

        <div style={hs.altBilgi}>
          {guncel && `Son güncelleme ${String(guncel.getHours()).padStart(2, '0')}:${String(guncel.getMinutes()).padStart(2, '0')}`} · {YENILEME_DK} dakikada bir otomatik yenilenir
        </div>
      </div>
    </section>
    </>
  );
}

function havaUyarilari(veri) {
  const d = veri.daily;
  const sonuc = [];
  const gunAdi = (i) => (i === 0 ? 'bugün' : i === 1 ? 'yarın' : GUN_TAM[new Date(d.time[i] + 'T00:00:00').getDay()]);
  const ay = new Date().getMonth();
  const ilk = (sart, n = 4) => { for (let i = 0; i < Math.min(n, d.time.length); i++) if (sart(i)) return i; return -1; };

  let i = ilk((x) => d.temperature_2m_min[x] <= 2, 5);
  if (i >= 0) sonuc.push({ id: 'don', ik: 'kar', renk: '#2563eb', baslik: `Don riski: ${gunAdi(i)} gece ${Math.round(d.temperature_2m_min[i])}°`,
    metin: 'Açıktaki borular, hidrofor tankı ve sulama hatları donabilir. Kış kontrolü için müşterilere haber ver.', aksiyon: 'Kış kontrolü mesajı', hedef: 'Kış öncesi kontrol' });
  else {
    i = ilk((x) => d.temperature_2m_min[x] <= 7, 7);
    if (i >= 0 && (ay >= 9 || ay <= 2)) sonuc.push({ id: 'soguk', ik: 'kar', renk: '#0284c7', baslik: `Soğuklar başlıyor: ${gunAdi(i)} ${Math.round(d.temperature_2m_min[i])}°`,
      metin: 'Sulama sistemlerinin boşaltılıp kapatılma zamanı. Müşterilere hatırlatma gönderebilirsin.', aksiyon: 'Sulama kapanış mesajı', hedef: 'Sulama sezon kapanışı ve boşaltma' });
  }
  i = ilk((x) => (d.wind_speed_10m_max?.[x] ?? 0) >= 45);
  if (i >= 0) sonuc.push({ id: 'ruzgar', ik: 'ruzgar', renk: '#7c3aed', baslik: `Kuvvetli rüzgâr: ${gunAdi(i)} ${Math.round(d.wind_speed_10m_max[i])} km/sa`,
    metin: 'Havuzlara yaprak ve toz dolar, ön filtre sepetleri tıkanabilir.', aksiyon: 'Filtre sepeti mesajı', hedef: 'Pompa ön filtre sepeti temizliği' });
  i = ilk((x) => d.temperature_2m_max[x] >= 33);
  if (i >= 0) sonuc.push({ id: 'sicak', ik: 'gunes', renk: '#ea580c', baslik: `Sıcak hava: ${gunAdi(i)} ${Math.round(d.temperature_2m_max[i])}°`,
    metin: 'Havuzlarda klor tüketimi ve yosun riski artar. Su analizi zamanı.', aksiyon: 'Su analizi mesajı', hedef: 'Su analizi (pH / klor)' });
  i = ilk((x) => (d.precipitation_probability_max?.[x] ?? 0) >= 70, 3);
  if (i >= 0) sonuc.push({ id: 'yagmur', ik: 'yagmur', renk: '#475569', baslik: `Yağış bekleniyor: ${gunAdi(i)} %${d.precipitation_probability_max[i]}`,
    metin: 'Dış saha işlerini buna göre planla.', aksiyon: 'Rotayı aç', hedef: 'harita' });
  return sonuc.slice(0, 3);
}

function HavaUyari({ liste, onUyari }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
      {liste.map((u) => (
        <div key={u.id} style={{ ...hs.uyari, borderLeft: `4px solid ${u.renk}` }}>
          <IkonKutu ad={u.ik} renk={u.renk} boyut={38} yaricap={11} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0b1730' }}>{u.baslik}</div>
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2, lineHeight: 1.4 }}>{u.metin}</div>
            {onUyari && (
              <button style={{ ...hs.uyariBtn, color: u.renk, background: `${u.renk}14` }} onClick={() => onUyari(u.hedef)}>
                {u.aksiyon} <SIkon ad="sag" boyut={14} kalin={2.4} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const hs = {
  uyari: { display: 'flex', alignItems: 'flex-start', gap: 10, background: '#fff', borderRadius: 16, padding: '10px 10px 10px 12px', boxShadow: '0 1px 2px rgba(16,24,40,.04), 0 6px 18px rgba(16,24,40,.06)', flexWrap: 'wrap' },
  uyariBtn: { display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, border: 'none', borderRadius: 10, padding: '7px 10px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  aramaKart: {
    position: 'relative', zIndex: 3, display: 'flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 20,
    padding: '0 10px 0 16px', height: 66, boxShadow: '0 10px 28px rgba(15,45,74,0.16)',
  },
  aramaForm: { flex: 1, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, margin: 0 },
  aramaInput: { flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 16, color: '#0f172a' },
  aramaAyrac: { width: 1, height: 36, background: '#e2e8f0', flexShrink: 0 },
  havaCip: { display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'none', padding: '4px 2px', cursor: 'pointer', flexShrink: 0 },
  acKapa: { width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,.16)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 16, flexShrink: 0, lineHeight: 1, paddingBottom: 4, boxSizing: 'border-box' },
  ust: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  konum: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, opacity: 0.95 },
  yenileBtn: { border: 'none', background: 'rgba(255,255,255,.14)', color: '#fff', borderRadius: 20, width: 24, height: 24,
    cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 },
  anlik: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 },
  buyukDerece: { fontSize: 42, fontWeight: 900, lineHeight: 1, letterSpacing: -1 },
  durum: { fontSize: 13.5, fontWeight: 700, opacity: 0.9, marginTop: 2 },
  detaySatir: { display: 'flex', flexWrap: 'wrap', gap: '2px 12px', fontSize: 12, marginTop: 6, opacity: 0.88 },
  ozet: { padding: '9px 12px', minWidth: 190, flex: '0 1 260px' },
  ozetBaslik: { fontSize: 12, fontWeight: 700, opacity: 0.85 },
  ozetDerece: { margin: '1px 0 4px' },
  ozetDetay: { display: 'flex', flexWrap: 'wrap', gap: '2px 10px', fontSize: 11.5, opacity: 0.92 },
  bolumBaslik: { fontSize: 11.5, fontWeight: 800, padding: '0 12px 4px', opacity: 0.85, letterSpacing: 0.3 },
  saatKol: { width: SAAT_GENISLIK, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, paddingTop: 3, borderRadius: 10 },
  saatSimdi: { background: 'rgba(255,255,255,.16)' },
  saatEtiket: { fontSize: 11, fontWeight: 700, opacity: 0.9 },
  saatYagis: { fontSize: 10, fontWeight: 700, color: '#bfdbfe', whiteSpace: 'nowrap' },
  saatRuzgar: { fontSize: 10, opacity: 0.8 },
  gunBtn: { flex: '1 0 60px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '6px 4px',
    borderRadius: 12, color: '#fff', cursor: 'pointer', border: '1px solid rgba(255,255,255,.16)' },
  gunBtnAktif: { background: '#fff', color: '#0b1730', boxShadow: '0 4px 12px rgba(0,0,0,.18)', border: '1px solid #fff' },
  aralik: { position: 'relative', width: '78%', height: 4, borderRadius: 3, overflow: 'hidden', margin: '1px 0' },
  altBilgi: { fontSize: 10, opacity: 0.65, marginTop: 6, textAlign: 'right' },
  tekrarBtn: { marginTop: 10, border: 'none', background: '#fff', color: '#1d4ed8', fontWeight: 700, borderRadius: 12,
    padding: '9px 16px', cursor: 'pointer' },
};
