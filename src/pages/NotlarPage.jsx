import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase';
import { Ikon, IkonKutu } from '../ikonlar';

// Notlar ortak kayıt tablosunda (mesaj_kayitlari) tur = 'not' / 'not-sabit' / 'not-bitti' olarak tutulur.
// Böylece veritabanında ek tablo gerekmeden tüm kullanıcılar aynı notları görür.
const TUR_ACIK = 'not';
const TUR_SABIT = 'not-sabit';
const TUR_BITTI = 'not-bitti';

function zaman(t) {
  const d = new Date(t);
  const fark = (Date.now() - d.getTime()) / 60000;
  if (fark < 1) return 'şimdi';
  if (fark < 60) return `${Math.floor(fark)} dk önce`;
  if (fark < 1440) return `${Math.floor(fark / 60)} saat önce`;
  const aylar = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  return `${d.getDate()} ${aylar[d.getMonth()]} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function NotlarPage({ ad }) {
  const [notlar, setNotlar] = useState([]);
  const [musteriler, setMusteriler] = useState([]);
  const [yazi, setYazi] = useState('');
  const [musteriId, setMusteriId] = useState('');
  const [sabit, setSabit] = useState(false);
  const [sekme, setSekme] = useState('acik');
  const [arama, setArama] = useState('');
  const [hata, setHata] = useState('');
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [duzenlenen, setDuzenlenen] = useState(null);
  const [duzenYazi, setDuzenYazi] = useState('');

  async function yukle() {
    const [n, m] = await Promise.all([
      supabase.from('mesaj_kayitlari').select('*, customers(id, name)').like('tur', 'not%').order('created_at', { ascending: false }).limit(300),
      supabase.from('customers').select('id, name').order('name', { ascending: true }),
    ]);
    if (n.error) setHata('Notlar yüklenemedi: ' + n.error.message);
    setNotlar(n.data || []);
    setMusteriler(m.data || []);
  }

  useEffect(() => { yukle(); }, []);

  async function ekle() {
    const metin = yazi.trim();
    if (!metin) return;
    setKaydediliyor(true);
    setHata('');
    const satir = {
      tur: sabit ? TUR_SABIT : TUR_ACIK, kanal: 'not', baslik: 'Not', mesaj: metin, gonderen: ad || '',
      customer_id: musteriId || null,
    };
    const { data, error } = await supabase.from('mesaj_kayitlari').insert([satir]).select('*, customers(id, name)').single();
    setKaydediliyor(false);
    if (error) { setHata('Not kaydedilemedi: ' + error.message); return; }
    setNotlar((l) => [data, ...l]);
    setYazi('');
    setMusteriId('');
    setSabit(false);
  }

  async function guncelle(n, alanlar) {
    const { error } = await supabase.from('mesaj_kayitlari').update(alanlar).eq('id', n.id);
    if (error) { setHata('Güncellenemedi: ' + error.message); return false; }
    setNotlar((l) => l.map((x) => (x.id === n.id ? { ...x, ...alanlar } : x)));
    return true;
  }

  async function sil(n) {
    if (!window.confirm('Bu not silinsin mi?')) return;
    const { error } = await supabase.from('mesaj_kayitlari').delete().eq('id', n.id);
    if (error) { setHata('Silinemedi: ' + error.message); return; }
    setNotlar((l) => l.filter((x) => x.id !== n.id));
  }

  async function duzenKaydet(n) {
    const metin = duzenYazi.trim();
    if (!metin) return;
    if (await guncelle(n, { mesaj: metin })) setDuzenlenen(null);
  }

  const gorunen = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase('tr-TR');
    return notlar
      .filter((n) => (sekme === 'acik' ? n.tur !== TUR_BITTI : sekme === 'bitti' ? n.tur === TUR_BITTI : true))
      .filter((n) => !q || String(n.mesaj || '').toLocaleLowerCase('tr-TR').includes(q)
        || String(n.customers?.name || '').toLocaleLowerCase('tr-TR').includes(q)
        || String(n.gonderen || '').toLocaleLowerCase('tr-TR').includes(q))
      .sort((a, b) => (b.tur === TUR_SABIT) - (a.tur === TUR_SABIT) || new Date(b.created_at) - new Date(a.created_at));
  }, [notlar, sekme, arama]);

  const acikSayi = notlar.filter((n) => n.tur !== TUR_BITTI).length;
  const bittiSayi = notlar.filter((n) => n.tur === TUR_BITTI).length;

  return (
    <div style={s.sayfa}>
      <h1 style={s.baslik}>Notlar</h1>
      <p style={s.alt}>Ekipçe ortak not defteri. Yazdığın notu herkes görür.</p>

      <div style={s.kart}>
        <textarea
          style={s.giris}
          value={yazi}
          onChange={(e) => setYazi(e.target.value)}
          placeholder="Notunu yaz... (örn: Demir Villası'na yarın conta götürülecek)"
          rows={3}
        />
        <div style={s.secenekler}>
          <select style={s.secim} value={musteriId} onChange={(e) => setMusteriId(e.target.value)}>
            <option value="">Müşteri bağla (isteğe bağlı)</option>
            {musteriler.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <button style={{ ...s.sabitBtn, ...(sabit ? s.sabitBtnAktif : {}) }} onClick={() => setSabit(!sabit)}>
            📌 {sabit ? 'Sabitlenecek' : 'Sabitle'}
          </button>
        </div>
        <button style={{ ...s.ekleBtn, opacity: yazi.trim() && !kaydediliyor ? 1 : 0.55 }} disabled={!yazi.trim() || kaydediliyor} onClick={ekle}>
          <Ikon ad="arti" boyut={18} renk="#fff" kalin={2.6} /> {kaydediliyor ? 'Kaydediliyor...' : 'Notu kaydet'}
        </button>
      </div>

      {hata && <div style={s.hata}>{hata}</div>}

      <div style={s.aracSatir}>
        <div style={s.sekmeler}>
          {[['acik', `Açık (${acikSayi})`], ['bitti', `Tamamlanan (${bittiSayi})`], ['hepsi', 'Tümü']].map(([id, yazi2]) => (
            <button key={id} onClick={() => setSekme(id)} style={{ ...s.sekme, ...(sekme === id ? s.sekmeAktif : {}) }}>{yazi2}</button>
          ))}
        </div>
        <div style={s.aramaKutu}>
          <Ikon ad="ara" boyut={16} renk="#94a3b8" />
          <input style={s.aramaInput} value={arama} onChange={(e) => setArama(e.target.value)} placeholder="Notlarda ara" />
        </div>
      </div>

      {gorunen.length === 0 && (
        <div style={{ ...s.kart, display: 'flex', alignItems: 'center', gap: 12 }}>
          <IkonKutu ad="belge" renk="#64748b" boyut={44} yaricap={14} />
          <div style={{ color: '#64748b', fontSize: 14 }}>{sekme === 'bitti' ? 'Tamamlanan not yok.' : 'Henüz not yok. İlk notu yukarıdan ekleyebilirsin.'}</div>
        </div>
      )}

      {gorunen.map((n) => {
        const bitti = n.tur === TUR_BITTI;
        const sabitMi = n.tur === TUR_SABIT;
        return (
          <div key={n.id} style={{ ...s.not, ...(sabitMi ? s.notSabit : {}), ...(bitti ? { opacity: 0.6 } : {}) }}>
            <button style={{ ...s.tik, ...(bitti ? s.tikAktif : {}) }} onClick={() => guncelle(n, { tur: bitti ? TUR_ACIK : TUR_BITTI })}
              title={bitti ? 'Geri al' : 'Tamamlandı'}>
              {bitti && <span style={{ color: '#fff', fontWeight: 900, fontSize: 14 }}>✓</span>}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              {duzenlenen === n.id ? (
                <>
                  <textarea style={{ ...s.giris, minHeight: 70 }} value={duzenYazi} onChange={(e) => setDuzenYazi(e.target.value)} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    <button style={s.kucukMavi} onClick={() => duzenKaydet(n)}>Kaydet</button>
                    <button style={s.kucuk} onClick={() => setDuzenlenen(null)}>Vazgeç</button>
                  </div>
                </>
              ) : (
                <div style={{ ...s.notYazi, ...(bitti ? { textDecoration: 'line-through' } : {}) }}>{n.mesaj}</div>
              )}
              <div style={s.notAlt}>
                {sabitMi && <span style={s.rozet}>📌 Sabit</span>}
                {n.customers?.name && <span style={{ ...s.rozet, background: '#eff6ff', color: '#1d4ed8' }}>👤 {n.customers.name}</span>}
                <span>{n.gonderen || '—'} · {zaman(n.created_at)}</span>
              </div>
              {duzenlenen !== n.id && (
                <div style={s.islemler}>
                  <button style={s.islem} onClick={() => { setDuzenlenen(n.id); setDuzenYazi(n.mesaj || ''); }}>Düzenle</button>
                  {!bitti && <button style={s.islem} onClick={() => guncelle(n, { tur: sabitMi ? TUR_ACIK : TUR_SABIT })}>{sabitMi ? 'Sabitlemeyi kaldır' : 'Sabitle'}</button>}
                  <button style={{ ...s.islem, color: '#b91c1c' }} onClick={() => sil(n)}>Sil</button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const golge = '0 1px 2px rgba(16,24,40,.04), 0 6px 18px rgba(16,24,40,.06)';
const s = {
  sayfa: { padding: '14px 14px 24px', maxWidth: 900, margin: '0 auto', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" },
  baslik: { margin: 0, fontSize: 22, fontWeight: 800, color: '#0b1730', letterSpacing: -0.3 },
  alt: { margin: '4px 0 14px', color: '#64748b', fontSize: 13.5 },
  kart: { background: '#fff', borderRadius: 20, padding: 14, boxShadow: golge, border: '1px solid #eef1f5', marginBottom: 12 },
  giris: {
    width: '100%', boxSizing: 'border-box', border: '1px solid #e2e8f0', borderRadius: 14, padding: 12, fontSize: 16, lineHeight: 1.45,
    resize: 'vertical', outline: 'none', fontFamily: 'inherit', color: '#0f172a', background: '#f8fafc',
  },
  secenekler: { display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  secim: { flex: '1 1 180px', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px', fontSize: 14, background: '#fff', color: '#334155', fontFamily: 'inherit', minWidth: 0 },
  sabitBtn: { border: '1px solid #e2e8f0', background: '#fff', borderRadius: 12, padding: '10px 12px', fontSize: 13.5, fontWeight: 600, color: '#475569', cursor: 'pointer', fontFamily: 'inherit' },
  sabitBtnAktif: { background: '#fffbeb', borderColor: '#fcd34d', color: '#92400e' },
  ekleBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', marginTop: 10, border: 'none', borderRadius: 14, padding: 12,
    background: 'linear-gradient(145deg,#3b82f6,#1d4ed8)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit',
  },
  hata: { background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 12, padding: 10, fontSize: 13.5, marginBottom: 12 },
  aracSatir: { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 },
  sekmeler: { display: 'flex', background: '#e8eef6', borderRadius: 12, padding: 3 },
  sekme: { border: 'none', background: 'transparent', padding: '8px 10px', borderRadius: 10, fontSize: 12.5, fontWeight: 600, color: '#475569', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  sekmeAktif: { background: '#fff', color: '#0b1730', boxShadow: '0 1px 3px rgba(0,0,0,.12)' },
  aramaKutu: { flex: '1 1 160px', display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '0 10px' },
  aramaInput: { flex: 1, border: 'none', outline: 'none', fontSize: 14, padding: '9px 0', minWidth: 0, fontFamily: 'inherit', background: 'transparent' },
  not: { display: 'flex', gap: 12, background: '#fff', borderRadius: 18, padding: 14, boxShadow: golge, border: '1px solid #eef1f5', marginBottom: 10 },
  notSabit: { background: '#fffbeb', borderColor: '#fde68a' },
  tik: { width: 26, height: 26, borderRadius: 8, border: '2px solid #cbd5e1', background: '#fff', flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, marginTop: 1 },
  tikAktif: { background: '#16a34a', borderColor: '#16a34a' },
  notYazi: { fontSize: 15, color: '#0f172a', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  notAlt: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: '#94a3b8' },
  rozet: { background: '#fef3c7', color: '#92400e', borderRadius: 8, padding: '2px 7px', fontWeight: 600 },
  islemler: { display: 'flex', gap: 14, marginTop: 8 },
  islem: { border: 'none', background: 'none', padding: 0, fontSize: 12.5, fontWeight: 600, color: '#2563eb', cursor: 'pointer', fontFamily: 'inherit' },
  kucuk: { border: '1px solid #e2e8f0', background: '#fff', borderRadius: 10, padding: '7px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#475569', fontFamily: 'inherit' },
  kucukMavi: { border: 'none', background: '#1d4ed8', borderRadius: 10, padding: '7px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#fff', fontFamily: 'inherit' },
};
