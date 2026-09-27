import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const GUNLER = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
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
  if (g < 0) return { etiket: `${Math.abs(g)} gün gecikti`, renk: '#dc2626', zemin: '#fee2e2' };
  if (g === 0) return { etiket: 'Bugün', renk: '#b45309', zemin: '#fef3c7' };
  if (g <= 30) return { etiket: `${g} gün kaldı`, renk: '#b45309', zemin: '#fef3c7' };
  return { etiket: `${g} gün kaldı`, renk: '#1d4ed8', zemin: '#dbeafe' };
}

const trTarih = (t) => (t ? new Date(t + 'T00:00:00').toLocaleDateString('tr-TR') : '-');

function whatsappLink(tel, musteriAdi, bakimAdi, tarih) {
  if (!tel) return null;
  let n = tel.replace(/\D/g, '');
  if (n.startsWith('0')) n = '9' + n;
  if (!n.startsWith('90')) n = '90' + n;
  const mesaj =
    `ALKA Havuz: Sayın ${musteriAdi}, tarafımızdan takip edilen sisteminizin ` +
    `"${bakimAdi}" zamanı ${trTarih(tarih)} itibarıyla gelmektedir. ` +
    `Randevu oluşturmak için bu mesajı yanıtlayabilir veya 0533 371 39 35 numarasından bize ulaşabilirsiniz.`;
  return `https://wa.me/${n}?text=${encodeURIComponent(mesaj)}`;
}

const FILTRELER = [
  { id: 'gecikmis', ad: '🔴 Gecikmiş' },
  { id: 'hafta', ad: 'Bu hafta' },
  { id: 'otuz', ad: '30 gün' },
  { id: 'tumu', ad: 'Tümü' },
];

export default function CalendarPage() {
  const [kurallar, setKurallar] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState('');
  const [ay, setAy] = useState(new Date());
  const [seciliGun, setSeciliGun] = useState(null);
  const [filtre, setFiltre] = useState('otuz');

  async function yukle() {
    setYukleniyor(true);
    const { data, error } = await supabase
      .from('maintenance_rules')
      .select('*, equipment(*, customers(*))')
      .eq('active', true);
    if (error) setHata(error.message);
    setKurallar((data || []).filter((k) => k.next_due_date));
    setYukleniyor(false);
  }

  useEffect(() => { yukle(); }, []);

  async function yapildi(k) {
    if (!window.confirm(`"${k.rule_name}" bugün yapıldı olarak işaretlensin mi?`)) return;
    const { error } = await supabase
      .from('maintenance_rules')
      .update({ last_service_date: yerel(new Date()) })
      .eq('id', k.id);
    if (error) setHata(error.message);
    yukle();
  }

  const y = ay.getFullYear();
  const a = ay.getMonth();
  const ilkGun = (new Date(y, a, 1).getDay() + 6) % 7;
  const gunSayisi = new Date(y, a + 1, 0).getDate();
  const hucreler = [];
  for (let i = 0; i < ilkGun; i++) hucreler.push(null);
  for (let d = 1; d <= gunSayisi; d++) hucreler.push(d);
  const bugunStr = yerel(new Date());

  function gunKurallari(tarihStr) {
    return kurallar.filter((k) => k.next_due_date === tarihStr);
  }

  let liste;
  let listeBaslik;
  if (seciliGun) {
    liste = gunKurallari(seciliGun);
    listeBaslik = `${trTarih(seciliGun)} tarihli bakımlar`;
  } else {
    liste = kurallar.filter((k) => {
      const g = kalanGun(k.next_due_date);
      if (filtre === 'gecikmis') return g < 0;
      if (filtre === 'hafta') return g <= 7;
      if (filtre === 'otuz') return g <= 30;
      return true;
    });
    listeBaslik = FILTRELER.find((f) => f.id === filtre).ad.replace('🔴 ', '') + ' bakımlar';
  }
  liste = [...liste].sort((x, z) => x.next_due_date.localeCompare(z.next_due_date));

  return (
    <div style={s.sayfa}>
      <h1 style={s.baslik}>Bakım Takvimi</h1>
      <p style={s.altBaslik}>Tüm periyodik ve mevsimlik bakımlar</p>

      {hata && <div style={s.hata}>{hata}</div>}

      <div style={s.kart}>
        <div style={s.takvimUst}>
          <button style={s.okBtn} onClick={() => setAy(new Date(y, a - 1, 1))}>‹</button>
          <h2 style={s.ayBaslik}>{AYLAR[a]} {y}</h2>
          <button style={s.okBtn} onClick={() => setAy(new Date(y, a + 1, 1))}>›</button>
        </div>
        <div style={s.takvim}>
          {GUNLER.map((g) => <div key={g} style={s.gunBaslik}>{g}</div>)}
          {hucreler.map((d, i) => {
            if (!d) return <div key={i} />;
            const t = yerel(new Date(y, a, d));
            const o = gunKurallari(t);
            const secili = seciliGun === t;
            const bugunMu = t === bugunStr;
            let nokta = null;
            if (o.length) nokta = durum(kalanGun(t)).renk;
            return (
              <button key={i} onClick={() => setSeciliGun(secili ? null : t)}
                style={{ ...s.hucre, ...(bugunMu ? s.bugun : {}), ...(secili ? s.secili : {}) }}>
                <div>{d}</div>
                {o.length > 0 && (
                  <div style={{ ...s.sayac, background: nokta }}>{o.length}</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div style={s.filtreler}>
        {FILTRELER.map((f) => (
          <button key={f.id}
            onClick={() => { setFiltre(f.id); setSeciliGun(null); }}
            style={{ ...s.filtreBtn, ...(!seciliGun && filtre === f.id ? s.filtreAktif : {}) }}>
            {f.ad}
          </button>
        ))}
      </div>

      <div style={s.kart}>
        <div style={s.listeUst}>
          <h2 style={s.listeBaslik}>{listeBaslik} ({liste.length})</h2>
          {seciliGun && <button style={s.linkBtn} onClick={() => setSeciliGun(null)}>Seçimi kaldır ✕</button>}
        </div>

        {yukleniyor ? (
          <p style={s.bos}>Yükleniyor...</p>
        ) :
