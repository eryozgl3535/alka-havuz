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

export default function DashboardPage({ onNavigate }) {
  const [kurallar, setKurallar] = useState([]);
  const [tamamlananIs, setTamamlananIs] = useState(0);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [takvimAy, setTakvimAy] = useState(new Date());

  const git = (id) => onNavigate && onNavigate(id);

  useEffect(() => {
    (async () => {
      const bugun = new Date();
      const ayBas = yerel(new Date(bugun.getFullYear(), bugun.getMonth(), 1));
      const [k, w] = await Promise.all([
        supabase
          .from('maintenance_rules')
          .select('*, equipment(category, equipment_type, customers(name, address))'),
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

  const liste = [...kurallar]
    .sort((a, b) => a.next_due_date.localeCompare(b.next_due_date))
    .slice(0, 8);

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

  const tarihYazi = bugun.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });

  return (
    <div style={s.sayfa}>
      <div style={s.ust}>
        <h1 style={s.baslik}>Hoş geldiniz</h1>
        <div style={s.tarih}>{tarihYazi}</div>
      </div>

      <div style={s.istatistikler}>
        <button style={{ ...s.istKart, background: '#fef2f2' }} onClick={() => git('takvim')}>
          <div style={{ ...s.istIkon, background: '#fee2e2' }}>📅</div>
          <div>
            <div style={{ ...s.istSayi, color: '#dc2626' }}>{gecikmis.length}</div>
            <div style={{ ...s.istEtiket, color: '#dc2626' }}>Bakımı Geçmiş</div>
          </div>
        </button>
        <button style={{ ...s.istKart, background: '#fffbeb' }} onClick={() => git('takvim')}>
          <div style={{ ...s.istIkon, background: '#fef3c7' }}>⏳</div>
          <div>
            <div style={{ ...s.istSayi, color: '#0f2d4a' }}>{yaklasan.length}</div>
            <div style={s.istEtiket}>Bakım Yaklaşıyor</div>
            <div style={s.istAlt}>(Önümüzdeki 30 gün)</div>
          </div>
        </button>
        <button style={{ ...s.istKart, background: '#eff6ff' }} onClick={() => git('isemirleri')}>
          <div style={{ ...s.istIkon, background: '#dbeafe' }}>🔧</div>
          <div>
            <div style={{ ...s.istSayi, color: '#0f2d4a' }}>{tamamlananIs}</div>
            <div style={s.istEtiket}>Bu Ay Tamamlanan İş</div>
          </div>
        </button>
      </div>

      <div style={s.izgara}>
        <div style={s.kart}>
          <div style={s.kartBaslikSatir}>
            <h2 style={s.kartBaslik}>📆 Yaklaşan Bakımlar</h2>
            <button style={s.linkBtn} onClick={() => git('takvim')}>Tümünü Gör →</button>
          </div>

          {yukleniyor ? (
            <p style={s.bos}>Yükleniyor...</p>
          ) : liste.length === 0 ? (
            <p style={s.bos}>
              Henüz planlanmış bakım yok. Müşteriler sayfasından bir müşteriye cihaz ekleyip bakım seçince burada görünecek.
            </p>
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

        <div style={s.sagKolon}>
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

          <div style={s.kart}>
            <h2 style={{ ...s.kartBaslik, marginBottom: 12 }}>Hızlı İşlemler</h2>
            <button style={s.hizliBtn} onClick={() => git('musteriler')}>👥 Yeni Müşteri / Cihaz</button>
            <button style={s.hizliBtn} onClick={() => git('isemirleri')}>📋 Yeni İş Emri</button>
            <button style={s.hizliBtn} onClick={() => git('takvim')}>📅 Bakım Takvimi</button>
          </div>

          <div style={s.kart}>
            <h2 style={{ ...s.kartBaslik, marginBottom: 8 }}>Son Mesajlar</h2>
            <p style={s.bos}>SMS hatırlatmaları (Verimor) bağlandığında burada görünecek.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const s = {
  sayfa: { padding: 24, fontFamily: 'system-ui, sans-serif' },
  ust: { marginBottom: 20 },
  baslik: { margin: 0, fontSize: 30, color: '#0f2d4a', fontWeight: 800 },
  tarih: { color: '#64748b', fontSize: 15, marginTop: 4 },
  istatistikler: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16, marginBottom: 20 },
  istKart: { display: 'flex', alignItems: 'center', gap: 16, padding: 20, borderRadius: 16, cursor: 'pointer',
    border: 'none', textAlign: 'left', fontFamily: 'inherit' },
  istIkon: { width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 26, flexShrink: 0 },
  istSayi: { fontSize: 32, fontWeight: 800, lineHeight: 1 },
  istEtiket: { fontSize: 15, color: '#334155', marginTop: 4 },
  istAlt: { fontSize: 12, color: '#64748b' },
  izgara: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 20, alignItems: 'start' },
  sagKolon: { display: 'flex', flexDirection: 'column', gap: 20 },
  kart: { background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 2px 12px rgba(15,45,74,0.08)' },
  kartBaslikSatir: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  kartBaslik: { margin: 0, fontSize: 19, color: '#0f2d4a' },
  linkBtn: { background: 'none', border: 'none', color: '#1d6fe0', fontWeight: 600, cursor: 'pointer', fontSize: 14 },
  bos: { color: '#64748b', fontSize: 14, margin: 0 },
  satir: { display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderTop: '1px solid #eef2f6', flexWrap: 'wrap' },
  tarihKutu: { minWidth: 64 },
  tarihGun: { fontWeight: 700, color: '#0f2d4a' },
  tarihYil: { fontSize: 13, color: '#64748b' },
  ikonKutu: { width: 52, height: 52, borderRadius: 10, background: '#eef2f6', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 26 },
  musteri: { fontWeight: 700, color: '#0f2d4a' },
  orta: { fontSize: 14, color: '#334155', fontWeight: 600 },
  kucuk: { fontSize: 13, color: '#64748b' },
  rozet: { padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' },
  okBtn: { width: 30, height: 30, borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 16 },
  takvim: { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, textAlign: 'center' },
  takvimBaslik: { fontWeight: 700, fontSize: 13, color: '#0f2d4a', padding: '4px 0' },
  takvimHucre: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0' },
  gunNo: { fontSize: 14, color: '#334155', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  bugun: { fontSize: 14, color: '#fff', background: '#1d6fe0', borderRadius: '50%', width: 30, height: 30,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 },
  nokta: { width: 6, height: 6, borderRadius: '50%', marginTop: 2 },
  lejant: { display: 'flex', gap: 12, fontSize: 12, color: '#475569', marginTop: 12, flexWrap: 'wrap' },
  lejNokta: { display: 'inline-block', width: 8, height: 8, borderRadius: '50%', marginRight: 4 },
  hizliBtn: { display: 'block', width: '100%', textAlign: 'left', background: '#eff6ff', border: 'none', borderRadius: 10,
    padding: '14px 16px', marginBottom: 10, fontSize: 15, color: '#0f2d4a', cursor: 'pointer', fontWeight: 600 },
};
