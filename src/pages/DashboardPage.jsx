import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

const IKON = { Havuz: '🏊', Kuyu: '💧', Hidrofor: '🔵', Sulama: '🌱', Tesisat: '🔧', Elektrik: '⚡' };
const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const GUNLER = ['P', 'S', 'Ç', 'P', 'C', 'C', 'P'];

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
  const [yukleniyor, setYukleniyor] = useState(true);
  const [takvimAy, setTakvimAy] = useState(new Date());

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('maintenance_rules')
        .select('*, equipment(*, customers(*))')
        .eq('active', true);
      setKurallar(data || []);
      setYukleniyor(false);
    })();
  }, []);

  const bugun = new Date();
  const buAyBas = yerel(new Date(bugun.getFullYear(), bugun.getMonth(), 1));

  const gecikmis = kurallar.filter((k) => { const g = kalanGun(k.next_due_date); return g !== null && g < 0; });
  const yaklasan = kurallar.filter((k) => { const g = kalanGun(k.next_due_date); return g !== null && g >= 0 && g <= 30; });
  const tamamlanan = kurallar.filter((k) =>
    k.last_service_date && k.last_service_date >= buAyBas &&
    k.equipment && k.last_service_date !== k.equipment.install_date
  );

  const liste = [...kurallar]
    .filter((k) => k.next_due_date)
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
    const o = kurallar.filter((k) => k.next_due_date === t);
    if (!o.length) return null;
    const g = kalanGun(t);
    return durum(g).renk;
  }

  const tarihYazi = bugun.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });
  const s = stiller;

  return (
    <div style={s.sayfa}>
      <div style={s.ust}>
        <div>
          <h1 style={s.baslik}>Hoş geldiniz</h1>
          <div style={s.tarih}>{tarihYazi}</div>
        </div>
        <button style={s.anaBtn} onClick={() => onNavigate && onNavigate('ekipman')}>+ Yeni Ekipman</button>
      </div>

      <div style={s.istatistikler}>
        <div style={{ ...s.istKart, background: '#fef2f2' }} onClick={() => onNavigate && onNavigate('ekipman')}>
          <div style={{ ...s.istIkon, background: '#fee2e2' }}>📅</div>
          <div>
            <div style={{ ...s.istSayi, color: '#dc2626' }}>{gecikmis.length}</div>
            <div style={{ ...s.istEtiket, color: '#dc2626' }}>Bakımı Geçmiş</div>
          </div>
        </div>
        <div style={{ ...s.istKart, background: '#fffbeb' }} onClick={() => onNavigate && onNavigate('ekipman')}>
          <div style={{ ...s.istIkon, background: '#fef3c7' }}>⏳</div>
          <div>
            <div style={{ ...s.istSayi, color: '#0f2d4a' }}>{yaklasan.length}</div>
            <div style={s.istEtiket}>Bakım Yaklaşıyor</div>
            <div style={s.istAlt}>(Önümüzdeki 30 gün)</div>
          </div>
        </div>
        <div style={{ ...s.istKart, background: '#eff6ff' }}>
          <div style={{ ...s.istIkon, background: '#dbeafe' }}>🔧</div>
          <div>
            <div style={{ ...s.istSayi, color: '#0f2d4a' }}>{tamamlanan.length}</div>
            <div style={s.istEtiket}>Bu Ay Tamamlanan</div>
          </div>
        </div>
      </div>

      <div style={s.izgara}>
        <div style={s.kart}>
          <div style={s.kartBaslikSatir}>
            <h2 style={s.kartBaslik}>📆 Yaklaşan Bakımlar</h2>
            <button style={s.linkBtn} onClick={() => onNavigate && onNavigate('ekipman')}>Tümünü Gör →</button>
          </div>

          {yukleniyor ? (
            <p style={s.bos}>Yükleniyor...</p>
          ) : liste.length === 0 ? (
            <p style={s.bos}>Henüz planlanmış bakım yok. Ekipman ekleyip bakım periyodu seçince burada görünecek.</p>
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
                  <div style={{ flex:
