import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const GUNLER = ['P', 'S', 'Ç', 'P', 'C', 'C', 'P'];
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
  if (g < 0) return { etiket: 'Gecikti', renk: '#dc2626', zemin: '#fee2e2' };
  if (g <= 30) return { etiket: 'Yaklaşıyor', renk: '#b45309', zemin: '#fef3c7' };
  return { etiket: 'Planlandı', renk: '#1d4ed8', zemin: '#dbeafe' };
}

function Dalga({ renk, style }) {
  return (
    <svg viewBox="0 0 400 120" preserveAspectRatio="none" style={{ position: 'absolute', pointerEvents: 'none', ...style }}>
      <path d="M0,70 C80,30 160,110 240,70 C300,40 350,60 400,50 L400,120 L0,120 Z" fill={renk} opacity="0.35" />
      <path d="M0,90 C90,60 170,120 260,88 C320,68 360,84 400,76 L400,120 L0,120 Z" fill={renk} opacity="0.5" />
    </svg>
  );
}

const HIZLI = [
  { id: 'isemirleri', ikon: '📝', baslik: 'Yeni İş Emri', alt: 'Bakım, arıza veya kontrol oluştur', zemin: '#dbeafe' },
  { id: 'musteriler', ikon: '👥', baslik: 'Yeni Müşteri', alt: 'Müşteri ve cihaz kaydı oluştur', zemin: '#e0e7ff' },
  { id: 'takvim', ikon: '📅', baslik: 'Bakım Takvimi', alt: 'Yaklaşan bakımları görüntüle', zemin: '#dcfce7' },
  { id: 'raporlar', ikon: '📊', baslik: 'Raporları Gör', alt: 'Ciro, tahsilat ve alacaklar', zemin: '#f3e8ff' },
  { id: 'ayarlar', ikon: '⚙️', baslik: 'Ayarlar', alt: 'Kullanıcılar ve şifre', zemin: '#f1f5f9' },
];

export default function DashboardPage({ onNavigate, ad = '' }) {
  const [kurallar, setKurallar] = useState([]);
  const [tamamlananIs, setTamamlananIs] = useState(0);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [takvimAy, setTakvimAy] = useState(new Date());
  const [genislik, setGenislik] = useState(window.innerWidth);

  const git = (id) => onNavigate && onNavigate(id);

  useEffect(() => {
    const f = () => setGenislik(window.innerWidth);
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);

  useEffect(() => {
    (async () => {
      const bugun = new Date();
      const ayBas = yerel(new Date(bugun.getFullYear(), bugun.getMonth(), 1));
      const [k, w] = await Promise.all([
        supabase.from('maintenance_rules').select('*, equipment(category, equipment_type, customers(name, address))'),
        supabase
          .from('work_orders')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'tamamlandi')
          .gte('completed_date', ayBas),
      ]);
      setKurallar((k.data || []).filter((x) => x.active !== false && x.next_due_date));
      setTamamlananIs(w.count || 0);
      setYukleniyor(false);
    })();
  }, []);

  const bugun = new Date();
  const gecikmis = kurallar.filter((k) => kalanGun(k.next_due_date) < 0);
  const yaklasan = kurallar.filter((k) => {
    const g = kalanGun(k.next_due_date);
    return g >= 0 && g <= 30;
  });
  const liste = [...kurallar].sort((a, b) => a.next_due_date.localeCompare(b.next_due_date)).slice(0, 6);

  const y = takvimAy.getFullYear();
  const a = takvimAy.getMonth();
  const ilkGun = (new Date(y, a, 1).getDay() + 6) % 7;
  const gunSayisi = new Date(y, a + 1, 0).getDate();
  const hucreler = [];
  for (let i = 0; i < ilkGun; i++) hucreler.push(null);
  for (let d = 1; d <= gunSayisi; d++) hucreler.push(d);

  function gunNokta(d) {
    const t = yerel(new Date(y, a, d));
    if (!kurallar.some((k) => k.next_due_date === t)) return null;
    return durum(kalanGun(t)).renk;
  }

  const ilkAd = ad.split(' ')[0];
  const tarihYazi = bugun.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });
  const genis = genislik >= 1100;
  const sloganGoster = genislik >= 760;

  const istatistik = [
    { baslik: 'Bakımı Geçmiş', sayi: gecikmis.length, ikon: '📅', renk: '#dc2626', ikonZemin: '#fee2e2',
      zemin: 'linear-gradient(135deg,#fff5f5,#ffe4e6)', dalga: '#fda4af', hedef: 'takvim', uyari: gecikmis.length > 0 },
    { baslik: 'Bakım Yaklaşıyor', sayi: yaklasan.length, alt: 'Önümüzdeki 30 gün', ikon: '⏳', renk: '#c2410c',
      ikonZemin: '#ffedd5', zemin: 'linear-gradient(135deg,#fffbeb,#fef3c7)', dalga: '#fcd34d', hedef: 'takvim' },
    { baslik: 'Bu Ay Tamamlanan', sayi: tamamlananIs, alt: 'İş emri', ikon: '🔧', renk: '#1d4ed8',
      ikonZemin: '#dbeafe', zemin: 'linear-gradient(135deg,#f5f9ff,#e0ecff)', dalga: '#93c5fd', hedef: 'isemirleri' },
  ];

  return (
    <div style={s.sayfa}>
      <section style={s.hero}>
        <Dalga renk="#ffffff" style={{ left: 0, right: 0, bottom: 0, width: '100%', height: 70 }} />
        <div style={s.heroSol}>
          <div style={s.heroUstYazi}>ALKA HAVUZ SİSTEMİ</div>
          <h1 style={s.heroBaslik}>
            Hoş geldin{ilkAd ? `, ${ilkAd}` : ''} <span style={s.heroDalga}>≈</span>
          </h1>
          <div style={s.heroTarih}>{tarihYazi}</div>
          <p style={s.heroAciklama}>
            Havuz, kuyu ve tesisat bakımlarını tek yerden yönetin; müşterilerinize kesintisiz ve kaliteli hizmet sunun.
          </p>
        </div>
        {sloganGoster && (
          <div style={s.slogan}>
            <div>Daha temiz</div>
            <div style={{ paddingLeft: 24 }}>daha sağlıklı</div>
            <div style={s.sloganAlt}><span style={s.sloganCizgi} /> havuzlar...</div>
          </div>
        )}
      </section>

      <div style={s.istatistikler}>
        {istatistik.map((k) => (
          <button key={k.baslik} style={{ ...s.istKart, background: k.zemin }} onClick={() => git(k.hedef)}>
            <Dalga renk={k.dalga} style={{ right: 0, bottom: 0, width: '70%', height: 60 }} />
            {k.uyari && <span style={s.uyari}>!</span>}
            <div style={{ ...s.istIkon, background: k.ikonZemin }}>{k.ikon}</div>
            <div style={{ flex: 1, position: 'relative' }}>
              <div style={{ ...s.istBaslik, color: k.renk }}>{k.baslik}</div>
              <div style={s.istSatir}>
                <span style={s.istSayi}>{k.sayi}</span>
                {k.alt && <span style={s.istAlt}>{k.alt}</span>}
              </div>
            </div>
            <span style={{ ...s.okDaire, color: k.renk }}>›</span>
          </button>
        ))}
      </div>

      <div style={{ ...s.izgara, gridTemplateColumns: genis ? 'minmax(0,1.6fr) minmax(320px,1fr)' : '1fr' }}>
        <div style={s.kart}>
          <div style={s.kartBaslikSatir}>
            <h2 style={s.kartBaslik}>📆 Yaklaşan Bakımlar</h2>
            <button style={s.linkBtn} onClick={() => git('takvim')}>Tümünü Gör →</button>
          </div>

          {yukleniyor ? (
            <p style={s.bos}>Yükleniyor...</p>
          ) : liste.length === 0 ? (
            <div style={s.bosAlan}>
              <div style={s.bosResim}>
                <span style={{ fontSize: 46 }}>🏊</span>
                <span style={{ fontSize: 38, marginLeft: -8 }}>🧰</span>
                <span style={{ fontSize: 34, marginLeft: -6 }}>💧</span>
              </div>
              <div style={s.bosBaslik}>Henüz planlanmış bakım yok.</div>
              <div style={s.bosYazi}>
                Müşterilerinize cihaz ve bakım ekleyin; tarihleri sistem sizin yerinize takip etsin.
              </div>
              <button style={s.planlaBtn} onClick={() => git('musteriler')}>📅 Bakım Planla</button>
            </div>
          ) : (
            liste.map((k) => {
              const g = kalanGun(k.next_due_date);
              const d = durum(g);
              const e = k.equipment || {};
              const m = e.customers || {};
              const t = new Date(k.next_due_date + 'T00:00:00');
              return (
                <div key={k.id} style={s.satir}>
                  <div style={s.tarihKutu}>
                    <div style={s.tarihGun}>{t.getDate()} {AYLAR[t.getMonth()].slice(0, 3)}</div>
                    <div style={s.tarihYil}>{t.getFullYear()}</div>
                  </div>
                  <div style={s.ikonKutu}>{IKON[e.category] || '🛠️'}</div>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={s.musteri}>{m.name || '-'}</div>
                    {m.address && <div style={s.kucuk}>📍 {m.address}</div>}
                  </div>
                  <div style={{ flex: 1, minWidth: 130 }}>
                    <div style={s.orta}>{k.rule_name}</div>
                    <div style={s.kucuk}>{e.category} · {e.equipment_type}</div>
                  </div>
                  <div style={{ ...s.rozet, color: d.renk, background: d.zemin }}>
                    {g < 0 ? `${Math.abs(g)} gün geçti` : g === 0 ? 'Bugün' : `${g} gün`}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={s.kart}>
          <div style={s.kartBaslikSatir}>
            <h2 style={s.kartBaslik}>{AYLAR[a]} {y}</h2>
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={s.okBtn} onClick={() => setTakvimAy(new Date(y, a - 1, 1))}>‹</button>
              <button style={s.okBtn} onClick={() => setTakvimAy(new Date(y, a + 1, 1))}>›</button>
            </div>
          </div>
          <div style={s.takvim}>
            {GUNLER.map((g, i) => <div key={i} style={s.takvimBaslik}>{g}</div>)}
            {hucreler.map((d, i) => {
              if (!d) return <div key={i} />;
              const bugunMu = y === bugun.getFullYear() && a === bugun.getMonth() && d === bugun.getDate();
              const nokta = gunNokta(d);
              return (
                <div key={i} style={s.takvimHucre}>
                  <div style={bugunMu ? s.bugun : s.gunNo}>{d}</div>
                  <div style={{ ...s.nokta, background: nokta || 'transparent' }} />
                </div>
              );
            })}
          </div>
          <div style={s.lejant}>
            <span><span style={{ ...s.lejNokta, background: '#dc2626' }} /> Geçmiş</span>
            <span><span style={{ ...s.lejNokta, background: '#b45309' }} /> Yaklaşıyor</span>
            <span><span style={{ ...s.lejNokta, background: '#1d4ed8' }} /> Planlandı</span>
          </div>
        </div>
      </div>

      <div style={{ ...s.kart, marginTop: 20 }}>
        <div style={s.kartBaslikSatir}>
          <h2 style={s.kartBaslik}>⚡ Hızlı İşlemler</h2>
          {sloganGoster && <span style={s.kucuk}>Günlük işlemlerinizi hızlıca yönetin</span>}
        </div>
        <div style={s.hizliIzgara}>
          {HIZLI.map((h) => (
            <button key={h.id} style={s.hizliBtn} onClick={() => git(h.id)}>
              <span style={{ ...s.hizliIkon, background: h.zemin }}>{h.ikon}</span>
              <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <span style={s.hizliBaslik}>{h.baslik}</span>
                <span style={s.hizliAlt}>{h.alt}</span>
              </span>
              <span style={s.hizliOk}>›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const s = {
  sayfa: { padding: '8px 28px 28px', fontFamily: 'system-ui, sans-serif' },

  hero: {
    position: 'relative', overflow: 'hidden', borderRadius: 22, minHeight: 210, marginBottom: 20,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, padding: '30px 34px 44px',
    background:
      'linear-gradient(90deg, rgba(255,255,255,0.97) 0%, rgba(255,255,255,0.9) 36%, rgba(255,255,255,0.1) 62%, rgba(255,255,255,0) 100%),' +
      'url(/hero.jpg) right center / cover no-repeat,' +
      'linear-gradient(160deg,#cdeafc 0%,#7cc4ef 40%,#2f95d3 70%,#0e6aa8 100%)',
    boxShadow: '0 4px 20px rgba(15,45,74,0.10)',
  },
  heroSol: { position: 'relative', maxWidth: 560 },
  heroUstYazi: { fontSize: 12, letterSpacing: 4, color: '#1d6fe0', fontWeight: 700, marginBottom: 8 },
  heroBaslik: { margin: 0, fontSize: 40, fontWeight: 900, color: '#0b2a4a', lineHeight: 1.1 },
  heroDalga: { color: '#38bdf8', fontWeight: 400 },
  heroTarih: { fontSize: 17, fontWeight: 700, color: '#0f2d4a', marginTop: 8 },
  heroAciklama: { margin: '8px 0 0', fontSize: 15, color: '#475569', lineHeight: 1.5 },
  slogan: {
    position: 'relative', color: '#fff', fontSize: 24, lineHeight: 1.4, textAlign: 'left',
    textShadow: '0 2px 10px rgba(0,0,0,0.35)', paddingRight: 10,
  },
  sloganAlt: { display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, fontSize: 26 },
  sloganCizgi: { display: 'inline-block', width: 56, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.85)' },

  istatistikler: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 18, marginBottom: 20 },
  istKart: {
    position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 16, padding: '22px 20px',
    borderRadius: 18, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.8)', textAlign: 'left',
    fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(15,45,74,0.08)',
  },
  uyari: {
    position: 'absolute', top: 12, right: 14, width: 26, height: 26, borderRadius: '50%', background: '#ef4444',
    color: '#fff', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
  },
  istIkon: {
    position: 'relative', width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 30, flexShrink: 0,
  },
  istBaslik: { fontSize: 15, fontWeight: 800 },
  istSatir: { display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 },
  istSayi: { fontSize: 38, fontWeight: 900, color: '#0b2a4a', lineHeight: 1 },
  istAlt: { fontSize: 13, color: '#64748b' },
  okDaire: {
    position: 'relative', width: 38, height: 38, borderRadius: '50%', background: '#fff', display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700,
    boxShadow: '0 2px 8px rgba(15,45,74,0.12)', flexShrink: 0,
  },

  izgara: { display: 'grid', gap: 20, alignItems: 'start' },
  kart: { background: '#fff', borderRadius: 18, padding: 22, boxShadow: '0 4px 16px rgba(15,45,74,0.07)' },
  kartBaslikSatir: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14 },
  kartBaslik: { margin: 0, fontSize: 20, color: '#0b2a4a' },
  linkBtn: { background: 'none', border: 'none', color: '#1d6fe0', fontWeight: 700, cursor: 'pointer', fontSize: 14 },
  bos: { color: '#64748b', fontSize: 14, margin: 0 },

  bosAlan: {
    textAlign: 'center', padding: '26px 16px 22px', borderRadius: 16,
    background: 'linear-gradient(180deg,#f8fbff,#eef6ff)', border: '1px solid #e2ecf8',
  },
  bosResim: {
    width: 170, height: 110, margin: '0 auto 14px', borderRadius: 60, display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: 'radial-gradient(ellipse at center, #dbeefe 0%, #eef6ff 70%)',
  },
  bosBaslik: { fontSize: 17, fontWeight: 800, color: '#0b2a4a' },
  bosYazi: { fontSize: 14, color: '#64748b', margin: '6px auto 16px', maxWidth: 420, lineHeight: 1.5 },
  planlaBtn: {
    background: 'linear-gradient(135deg,#1d6fe0,#2563eb)', color: '#fff', border: 'none', borderRadius: 12,
    padding: '12px 24px', fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: '0 6px 16px rgba(29,111,224,0.3)',
  },

  satir: { display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderTop: '1px solid #eef2f6', flexWrap: 'wrap' },
  tarihKutu: { minWidth: 64 },
  tarihGun: { fontWeight: 800, color: '#0b2a4a' },
  tarihYil: { fontSize: 13, color: '#64748b' },
  ikonKutu: {
    width: 52, height: 52, borderRadius: 12, background: '#eef6ff', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 26,
  },
  musteri: { fontWeight: 700, color: '#0b2a4a' },
  orta: { fontSize: 14, color: '#334155', fontWeight: 600 },
  kucuk: { fontSize: 13, color: '#64748b' },
  rozet: { padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' },

  okBtn: { width: 34, height: 34, borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 18 },
  takvim: { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, textAlign: 'center' },
  takvimBaslik: { fontWeight: 800, fontSize: 13, color: '#0b2a4a', padding: '6px 0', borderBottom: '1px solid #eef2f6' },
  takvimHucre: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '5px 0' },
  gunNo: { fontSize: 14, color: '#334155', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  bugun: {
    fontSize: 14, color: '#fff', background: '#1d6fe0', borderRadius: '50%', width: 34, height: 34,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800,
    boxShadow: '0 4px 10px rgba(29,111,224,0.4)',
  },
  nokta: { width: 6, height: 6, borderRadius: '50%', marginTop: 2 },
  lejant: { display: 'flex', gap: 16, fontSize: 13, color: '#475569', marginTop: 14, flexWrap: 'wrap' },
  lejNokta: { display: 'inline-block', width: 10, height: 10, borderRadius: '50%', marginRight: 5 },

  hizliIzgara: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 },
  hizliBtn: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '14px 14px', borderRadius: 14,
    border: '1px solid #e2ecf8', background: '#fff', cursor: 'pointer', fontFamily: 'inherit',
    boxShadow: '0 2px 8px rgba(15,45,74,0.05)',
  },
  hizliIkon: {
    width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 22, flexShrink: 0,
  },
  hizliBaslik: { display: 'block', fontSize: 15, fontWeight: 800, color: '#0b2a4a' },
  hizliAlt: { display: 'block', fontSize: 12, color: '#64748b', marginTop: 2 },
  hizliOk: { fontSize: 22, color: '#1d6fe0', fontWeight: 700 },
};
