import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

const KATEGORILER = ['Havuz', 'Kuyu', 'Hidrofor', 'Sulama', 'Tesisat', 'Elektrik'];
const KUYRUK_ANAHTAR = 'alkaTopluKuyruk';

const SABLONLAR = [
  { ad: 'Sezon açılışı', tur: 'bilgilendirme', metin:
    "Merhaba {ad}, yaz sezonu yaklaşıyor ☀️ Havuzunuzun sezon açılışı ve genel bakımı için randevu oluşturmak ister misiniz? Bu mesajı yanıtlamanız yeterli.\n\nALKA Havuz · 0533 371 39 35" },
  { ad: 'Bakım hatırlatması', tur: 'bilgilendirme', metin:
    'Merhaba {ad}, sistemlerinizin periyodik bakım zamanı yaklaşıyor. Uygun olduğunuz bir gün için bu mesajı yanıtlayabilirsiniz.\n\nALKA Havuz · 0533 371 39 35' },
  { ad: 'Kış öncesi kontrol', tur: 'bilgilendirme', metin:
    'Merhaba {ad}, soğuklar yaklaşıyor ❄️ Kuyu pompası, hidrofor ve sulama hatlarınızın dona karşı kontrolü için randevu oluşturabiliriz.\n\nALKA Havuz · 0533 371 39 35' },
  { ad: 'Geliş tarihi sorma', tur: 'bilgilendirme', metin:
    "Merhaba {ad}, Çeşme'ye ne zaman geleceğinizi bize bildirirseniz, siz gelmeden havuzunuzu ve sistemlerinizi hazırlayalım 🏡\n\nALKA Havuz · 0533 371 39 35" },
  { ad: 'Bayram tebriği', tur: 'bilgilendirme', metin:
    'Merhaba {ad}, bayramınızı en içten dileklerimizle kutlar, sağlıklı ve mutlu günler dileriz.\n\nALKA Havuz · Volkan Gülcemal' },
  { ad: 'Kampanya (izinli müşteriler)', tur: 'kampanya', metin:
    'Merhaba {ad}, bu aya özel havuz bakım paketimizde indirim fırsatı var! Detaylar için bu mesajı yanıtlayabilirsiniz.\n\nALKA Havuz · 0533 371 39 35\n(Mesaj almak istemiyorsanız "RET" yazabilirsiniz.)' },
];

const OZEL_FILTRELER = [
  { id: 'hepsi', ad: 'Tümü' },
  { id: 'bakim30', ad: 'Bakımı 30 gün içinde / gecikmiş' },
  { id: 'gecikmis', ad: 'Sadece bakımı gecikmiş' },
  { id: 'gelis', ad: 'Önümüzdeki 60 günde gelecekler' },
];

const yerel = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function gunEkle(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return yerel(d);
}

function telefonWa(tel) {
  if (!tel) return null;
  let n = tel.replace(/\D/g, '');
  if (n.length < 10) return null;
  if (n.startsWith('0')) n = '9' + n;
  if (!n.startsWith('90')) n = '90' + n;
  return n;
}

const kisisel = (metin, m) => metin.replace(/\{ad\}/g, m.name || '');
const trSaat = (t) => new Date(t).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function TopluMesajPage() {
  const [musteriler, setMusteriler] = useState([]);
  const [kayitlar, setKayitlar] = useState([]);
  const [gonderen, setGonderen] = useState('');
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState('');

  const [kategori, setKategori] = useState('');
  const [adresArama, setAdresArama] = useState('');
  const [ozel, setOzel] = useState('hepsi');
  const [tur, setTur] = useState('bilgilendirme');
  const [baslik, setBaslik] = useState('');
  const [metin, setMetin] = useState('');
  const [haric, setHaric] = useState([]);

  const [kuyruk, setKuyruk] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KUYRUK_ANAHTAR)) || null; } catch { return null; }
  });

  async function yukle() {
    const [m, k, u] = await Promise.all([
      supabase.from('customers')
        .select('id, name, phone, address, kampanya_izni, equipment(category, maintenance_rules(next_due_date, active)), gelisler(gelis_tarihi, durum)')
        .order('name', { ascending: true }),
      supabase.from('mesaj_kayitlari')
        .select('*, customers(name)')
        .order('created_at', { ascending: false })
        .limit(15),
      supabase.auth.getUser(),
    ]);
    if (m.error) setHata(m.error.message);
    setMusteriler(m.data || []);
    setKayitlar(k.data || []);
    const meta = u.data?.user?.user_metadata || {};
    setGonderen(meta.ad || (u.data?.user?.email || '').split('@')[0]);
    setYukleniyor(false);
  }

  useEffect(() => { yukle(); }, []);

  useEffect(() => {
    if (kuyruk) localStorage.setItem(KUYRUK_ANAHTAR, JSON.stringify(kuyruk));
    else localStorage.removeItem(KUYRUK_ANAHTAR);
  }, [kuyruk]);

  const bugun = yerel(new Date());
  const otuzGun = gunEkle(30);
  const altmisGun = gunEkle(60);

  const eslesenler = musteriler.filter((m) => {
    const cihazlar = m.equipment || [];
    if (kategori && !cihazlar.some((e) => e.category === kategori)) return false;
    if (adresArama.trim() && !(m.address || '').toLocaleLowerCase('tr-TR').includes(adresArama.trim().toLocaleLowerCase('tr-TR'))) return false;
    const tarihler = cihazlar.flatMap((e) => (e.maintenance_rules || []).filter((k) => k.active !== false && k.next_due_date).map((k) => k.next_due_date));
    if (ozel === 'bakim30' && !tarihler.some((t) => t <= otuzGun)) return false;
    if (ozel === 'gecikmis' && !tarihler.some((t) => t < bugun)) return false;
    if (ozel === 'gelis' && !(m.gelisler || []).some((g) => g.durum !== 'iptal' && g.gelis_tarihi >= bugun && g.gelis_tarihi <= altmisGun)) return false;
    return true;
  });

  const telefonsuz = eslesenler.filter((m) => !telefonWa(m.phone));
  const izinsiz = tur === 'kampanya' ? eslesenler.filter((m) => telefonWa(m.phone) && !m.kampanya_izni) : [];
  const uygunlar = eslesenler.filter((m) => telefonWa(m.phone) && (tur !== 'kampanya' || m.kampanya_izni));
  const alicilar = uygunlar.filter((m) => !haric.includes(m.id));

  function sablonSec(ad) {
    const sb = SABLONLAR.find((x) => x.ad === ad);
    if (!sb) return;
    setMetin(sb.metin);
    setTur(sb.tur);
    setBaslik(sb.ad);
  }

  async function izinDegistir(m) {
    const { error } = await supabase.from('customers').update({ kampanya_izni: !m.kampanya_izni }).eq('id', m.id);
    if (error) { setHata(error.message); return; }
    yukle();
  }

  function haricDegistir(id) {
    setHaric(haric.includes(id) ? haric.filter((x) => x !== id) : [...haric, id]);
  }

  function baslat() {
    setHata('');
    if (!metin.trim()) { setHata('Önce mesajı yazın ya da bir şablon seçin.'); return; }
    if (!alicilar.length) { setHata('Gönderilecek müşteri yok.'); return; }
    setKuyruk({
      metin,
      tur,
      baslik: baslik || 'Toplu mesaj',
      liste: alicilar.map((m) => ({ id: m.id, name: m.name, phone: m.phone })),
      sira: 0,
      gonderilen: [],
      atlanan: [],
    });
    window.scrollTo(0, 0);
  }

  async function gonder() {
    const m = kuyruk.liste[kuyruk.sira];
    const numara = telefonWa(m.phone);
    const mesaj = kisisel(kuyruk.metin, m);
    window.open(`https://wa.me/${numara}?text=${encodeURIComponent(mesaj)}`, '_blank');
    await supabase.from('mesaj_kayitlari').insert([{
      customer_id: m.id, kanal: 'whatsapp', tur: kuyruk.tur, baslik: kuyruk.baslik, mesaj, gonderen,
    }]);
    setKuyruk({ ...kuyruk, gonderilen: [...kuyruk.gonderilen, m.id], sira: kuyruk.sira + 1 });
  }

  function atla() {
    const m = kuyruk.liste[kuyruk.sira];
    setKuyruk({ ...kuyruk, atlanan: [...kuyruk.atlanan, m.id], sira: kuyruk.sira + 1 });
  }

  function geri() {
    if (kuyruk.sira > 0) setKuyruk({ ...kuyruk, sira: kuyruk.sira - 1 });
  }

  function bitir() {
    if (kuyruk.sira < kuyruk.liste.length && !window.confirm('Gönderim yarıda kalacak. Bitirilsin mi?')) return;
    setKuyruk(null);
    setHaric([]);
    yukle();
  }

  if (yukleniyor) return <div style={s.sayfa}><p style={s.soluk}>Yükleniyor...</p></div>;

  if (kuyruk) {
    const toplam = kuyruk.liste.length;
    const bitti = kuyruk.sira >= toplam;
    const m = bitti ? null : kuyruk.liste[kuyruk.sira];
    const yuzde = Math.round((kuyruk.sira / toplam) * 100);
    return (
      <div style={s.sayfa}>
        <h1 style={s.baslik}>📣 Toplu Mesaj Gönderiliyor</h1>
        <p style={s.soluk}>{kuyruk.baslik} · {kuyruk.tur === 'kampanya' ? 'Kampanya' : 'Bilgilendirme'}</p>

        <div style={s.kart}>
          <div style={s.ilerlemeUst}>
            <b>{Math.min(kuyruk.sira, toplam)} / {toplam}</b>
            <span style={s.soluk}>✓ {kuyruk.gonderilen.length} gönderildi · ↷ {kuyruk.atlanan.length} atlandı</span>
          </div>
          <div style={s.ilerlemeArka}><div style={{ ...s.ilerlemeOn, width: `${yuzde}%` }} /></div>

          {bitti ? (
            <div style={{ textAlign: 'center', padding: '24px 0 6px' }}>
              <div style={{ fontSize: 48 }}>🎉</div>
              <div style={s.buyukYazi}>Gönderim tamamlandı</div>
              <p style={s.soluk}>{kuyruk.gonderilen.length} müşteriye mesaj açıldı ve kayda geçti.</p>
              <button style={s.anaBtn} onClick={bitir}>Tamam</button>
            </div>
          ) : (
            <>
              <div style={s.siradaki}>
                <div style={s.soluk}>Sıradaki müşteri</div>
                <div style={s.buyukYazi}>{m.name}</div>
                <div style={s.soluk}>📞 {m.phone}</div>
              </div>
              <div style={s.onizleme}>{kisisel(kuyruk.metin, m)}</div>
              <div style={s.kuyrukButonlar}>
                <button style={s.gonderBtn} onClick={gonder}>💬 WhatsApp'ta aç ve sıradakine geç</button>
                <button style={s.atlaBtn} onClick={atla}>↷ Atla</button>
                {kuyruk.sira > 0 && <button style={s.atlaBtn} onClick={geri}>‹ Geri</button>}
              </div>
              <p style={{ ...s.soluk, marginTop: 12 }}>
                WhatsApp açılınca mesaj hazır gelir; gönder tuşuna basıp bu sayfaya dönün, sıradaki müşteri hazır olacak.
                Sayfayı kapatsanız bile kaldığınız yerden devam edebilirsiniz.
              </p>
            </>
          )}
          {!bitti && <button style={s.bitirBtn} onClick={bitir}>Gönderimi bitir</button>}
        </div>
      </div>
    );
  }

  return (
    <div style={s.sayfa}>
      <h1 style={s.baslik}>📣 Toplu Mesaj</h1>
      <p style={s.soluk}>Kendi WhatsApp'ınızdan, müşterilerinize sırayla ve kişiye özel mesaj</p>

      {hata && <div style={s.hata}>{hata}</div>}

      <div style={s.kart}>
        <div style={s.bolum}>1. Kime gönderilecek?</div>
        <div style={s.chipler}>
          <button style={{ ...s.chip, ...(!kategori ? s.chipSecili : {}) }} onClick={() => setKategori('')}>Tüm müşteriler</button>
          {KATEGORILER.map((k) => (
            <button key={k} style={{ ...s.chip, ...(kategori === k ? s.chipSecili : {}) }} onClick={() => setKategori(k)}>
              {k}
            </button>
          ))}
        </div>
        <div style={{ ...s.grid, marginTop: 12 }}>
          <label style={s.etiket}>Adreste geçen kelime
            <input style={s.input} placeholder="Örn: Alaçatı, Ilıca, Dalyan" value={adresArama}
              onChange={(e) => setAdresArama(e.target.value)} />
          </label>
          <label style={s.etiket}>Özel filtre
            <select style={s.input} value={ozel} onChange={(e) => setOzel(e.target.value)}>
              {OZEL_FILTRELER.map((f) => <option key={f.id} value={f.id}>{f.ad}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div style={s.kart}>
        <div style={s.bolum}>2. Mesaj</div>
        <div style={s.chipler}>
          <button style={{ ...s.chip, ...(tur === 'bilgilendirme' ? s.chipSecili : {}) }} onClick={() => setTur('bilgilendirme')}>
            ℹ️ Bilgilendirme
          </button>
          <button style={{ ...s.chip, ...(tur === 'kampanya' ? s.chipKampanya : {}) }} onClick={() => setTur('kampanya')}>
            🏷️ Kampanya (sadece izinliler)
          </button>
        </div>
        <label style={{ ...s.etiket, marginTop: 12 }}>Hazır şablon
          <select style={s.input} value="" onChange={(e) => sablonSec(e.target.value)}>
            <option value="">Şablon seçin (isteğe bağlı)</option>
            {SABLONLAR.map((sb) => <option key={sb.ad} value={sb.ad}>{sb.ad}</option>)}
          </select>
        </label>
        <label style={{ ...s.etiket, marginTop: 12 }}>Mesaj metni ({'{ad}'} yazan yere müşterinin adı gelir)
          <textarea style={{ ...s.input, minHeight: 130, fontFamily: 'inherit', lineHeight: 1.5 }} value={metin}
            onChange={(e) => setMetin(e.target.value)} placeholder="Merhaba {ad}, ..." />
        </label>
        {metin && alicilar[0] && (
          <div style={{ marginTop: 12 }}>
            <div style={s.soluk}>Önizleme ({alicilar[0].name} için):</div>
            <div style={s.onizleme}>{kisisel(metin, alicilar[0])}</div>
          </div>
        )}
      </div>

      <div style={s.kart}>
        <div style={s.bolumSatir}>
          <div style={s.bolum}>3. Alıcılar ({alicilar.length})</div>
          <button style={s.anaBtn} onClick={baslat} disabled={!alicilar.length}>▶ Gönderimi başlat</button>
        </div>
        {(telefonsuz.length > 0 || izinsiz.length > 0) && (
          <div style={s.uyari}>
            {telefonsuz.length > 0 && <div>📵 {telefonsuz.length} müşterinin telefonu kayıtlı olmadığı için listede yok.</div>}
            {izinsiz.length > 0 && <div>🚫 {izinsiz.length} müşterinin kampanya izni olmadığı için listede yok (aşağıdan izin durumunu değiştirebilirsiniz).</div>}
          </div>
        )}
        {(tur === 'kampanya' ? [...uygunlar, ...izinsiz] : uygunlar).map((m) => {
          const dahil = uygunlar.includes(m) && !haric.includes(m.id);
          return (
            <div key={m.id} style={s.aliciSatir}>
              <input type="checkbox" checked={dahil} disabled={!uygunlar.includes(m)} onChange={() => haricDegistir(m.id)}
                style={{ width: 20, height: 20 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={s.aliciAd}>{m.name}</div>
                <div style={s.soluk}>{m.phone}{m.address ? ` · ${m.address}` : ''}</div>
              </div>
              <button style={{ ...s.izinBtn, ...(m.kampanya_izni ? s.izinVar : {}) }} onClick={() => izinDegistir(m)}
                title="Kampanya mesajı izni">
                {m.kampanya_izni ? '✓ Kampanya izni var' : 'Kampanya izni yok'}
              </button>
            </div>
          );
        })}
        {eslesenler.length === 0 && <p style={s.soluk}>Bu filtrelere uyan müşteri yok.</p>}
      </div>

      <div style={s.kart}>
        <div style={s.bolum}>🕘 Son gönderilen mesajlar</div>
        {kayitlar.length === 0 ? (
          <p style={s.soluk}>Henüz kayıt yok.</p>
        ) : (
          kayitlar.map((k) => (
            <div key={k.id} style={s.kayitSatir}>
              <span style={{ flex: 1 }}><b>{k.customers?.name || '-'}</b> · {k.baslik || 'Mesaj'}</span>
              <span style={s.soluk}>{trSaat(k.created_at)}{k.gonderen ? ` · ${k.gonderen}` : ''}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const s = {
  sayfa: { padding: 20, maxWidth: 900, margin: '0 auto', fontFamily: 'system-ui, sans-serif' },
  baslik: { margin: 0, fontSize: 26, color: '#0f2d4a' },
  soluk: { fontSize: 14, color: '#64748b', margin: '4px 0 0' },
  hata: { background: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 10, margin: '14px 0' },
  kart: { background: '#fff', borderRadius: 16, padding: 20, marginTop: 16, boxShadow: '0 2px 12px rgba(15,45,74,0.08)' },
  bolum: { fontSize: 17, fontWeight: 800, color: '#0f2d4a', marginBottom: 12 },
  bolumSatir: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 },
  etiket: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, color: '#334155' },
  input: { padding: '11px 12px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 15, width: '100%', boxSizing: 'border-box', background: '#fff' },
  chipler: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: { padding: '10px 14px', borderRadius: 22, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 14, color: '#1e293b' },
  chipSecili: { background: '#1d6fe0', color: '#fff', borderColor: '#1d6fe0' },
  chipKampanya: { background: '#b45309', color: '#fff', borderColor: '#b45309' },
  onizleme: { marginTop: 6, background: '#dcf8c6', borderRadius: 12, padding: '12px 14px', whiteSpace: 'pre-wrap', fontSize: 15, color: '#111827', lineHeight: 1.5 },
  uyari: { background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 12, fontSize: 14, color: '#92400e', margin: '8px 0 12px' },
  aliciSatir: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid #eef2f6' },
  aliciAd: { fontWeight: 700, color: '#0f2d4a' },
  izinBtn: { border: '1px solid #cbd5e1', background: '#fff', color: '#64748b', borderRadius: 16, padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  izinVar: { background: '#dcfce7', color: '#15803d', borderColor: '#86efac' },
  anaBtn: { background: 'linear-gradient(135deg,#1d6fe0,#2563eb)', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 15 },
  kayitSatir: { display: 'flex', gap: 10, flexWrap: 'wrap', padding: '9px 0', borderTop: '1px solid #eef2f6', fontSize: 14, color: '#334155' },
  ilerlemeUst: { display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 8, color: '#0f2d4a' },
  ilerlemeArka: { height: 10, borderRadius: 5, background: '#eef2f6', overflow: 'hidden' },
  ilerlemeOn: { height: '100%', background: 'linear-gradient(90deg,#16a34a,#22c55e)', transition: 'width 0.3s' },
  siradaki: { textAlign: 'center', padding: '22px 0 10px' },
  buyukYazi: { fontSize: 24, fontWeight: 800, color: '#0f2d4a', margin: '4px 0' },
  kuyrukButonlar: { display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 16 },
  gonderBtn: { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 12, padding: '15px 22px', fontWeight: 800, cursor: 'pointer', fontSize: 16 },
  atlaBtn: { background: '#fff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: 12, padding: '15px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 15 },
  bitirBtn: { display: 'block', margin: '18px auto 0', background: 'none', border: 'none', color: '#dc2626', fontWeight: 700, cursor: 'pointer', fontSize: 14 },
};
