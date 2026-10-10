import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase';
import { Ikon, IkonKutu } from '../ikonlar';

// Hatırlatmalar ortak kayıt tablosunda (mesaj_kayitlari) saklanır.
// tur: 'hatirlatma' (açık) / 'hatirlatma-bitti'. Tarih, tutar ve tekrar bilgisi mesaj metnine JSON olarak gömülür.
const TUR_ACIK = 'hatirlatma';
const TUR_BITTI = 'hatirlatma-bitti';
const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const AY_KISA = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

const yerel = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function veriCoz(n) {
  let v = {};
  try { v = JSON.parse(n.mesaj || '{}'); } catch { v = { baslik: n.mesaj || '' }; }
  return {
    baslik: v.baslik || 'Hatırlatma',
    tarih: v.tarih || null,
    tutar: v.tutar != null ? Number(v.tutar) : null,
    tekrar: v.tekrar || 'tek',
    aciklama: v.aciklama || '',
  };
}

function tutarYaz(t) {
  if (t == null) return '';
  return t.toLocaleString('tr-TR') + ' ₺';
}

function tarihYaz(t) {
  if (!t) return '';
  const d = new Date(t + 'T00:00:00');
  return `${d.getDate()} ${AYLAR[d.getMonth()]} ${d.getFullYear()}`;
}

function kalanGun(t) {
  if (!t) return null;
  const h = new Date(t + 'T00:00:00');
  const b = new Date(yerel(new Date()) + 'T00:00:00');
  return Math.round((h - b) / 86400000);
}

function kalanYaz(g) {
  if (g == null) return { yazi: 'Tarihsiz', renk: '#94a3b8', zemin: '#f1f5f9' };
  if (g < 0) return { yazi: `${-g} gün geçti`, renk: '#dc2626', zemin: '#fef2f2' };
  if (g === 0) return { yazi: 'Bugün', renk: '#c2410c', zemin: '#fff7ed' };
  if (g === 1) return { yazi: 'Yarın', renk: '#c2410c', zemin: '#fff7ed' };
  if (g <= 7) return { yazi: `${g} gün kaldı`, renk: '#c2410c', zemin: '#fff7ed' };
  return { yazi: `${g} gün kaldı`, renk: '#1d4ed8', zemin: '#eff6ff' };
}

function sonrakiTarih(t, tekrar) {
  const d = new Date(t + 'T00:00:00');
  if (tekrar === 'aylik') d.setMonth(d.getMonth() + 1);
  else if (tekrar === 'haftalik') d.setDate(d.getDate() + 7);
  else if (tekrar === 'yillik') d.setFullYear(d.getFullYear() + 1);
  return yerel(d);
}

const TEKRARLAR = [
  { id: 'tek', ad: 'Tekrar yok' },
  { id: 'aylik', ad: 'Her ay' },
  { id: 'haftalik', ad: 'Her hafta' },
  { id: 'yillik', ad: 'Her yıl' },
];

const bosForm = () => ({ baslik: '', tarih: yerel(new Date()), tutar: '', tekrar: 'tek', aciklama: '', customer_id: '' });

export default function HatirlatmalarPage({ ad }) {
  const [ham, setHam] = useState([]);
  const [musteriler, setMusteriler] = useState([]);
  const [sekme, setSekme] = useState('yaklasan');
  const [form, setForm] = useState(bosForm);
  const [formAcik, setFormAcik] = useState(false);
  const [duzenlenenId, setDuzenlenenId] = useState(null);
  const [hata, setHata] = useState('');
  const [kaydediliyor, setKaydediliyor] = useState(false);

  async function yukle() {
    const [n, m] = await Promise.all([
      supabase.from('mesaj_kayitlari').select('*, customers(id, name)').like('tur', 'hatirlatma%').order('created_at', { ascending: false }).limit(300),
      supabase.from('customers').select('id, name').order('name', { ascending: true }),
    ]);
    if (n.error) setHata('Hatırlatmalar yüklenemedi: ' + n.error.message);
    setHam(n.data || []);
    setMusteriler(m.data || []);
  }
  useEffect(() => { yukle(); }, []);

  const liste = useMemo(() => ham.map((n) => ({ ...n, v: veriCoz(n), g: kalanGun(veriCoz(n).tarih), bitti: n.tur === TUR_BITTI })), [ham]);

  const gorunen = useMemo(() => {
    let l = liste;
    if (sekme === 'bugun') l = liste.filter((x) => !x.bitti && x.g != null && x.g <= 0);
    else if (sekme === 'yaklasan') l = liste.filter((x) => !x.bitti);
    else if (sekme === 'tamam') l = liste.filter((x) => x.bitti);
    return [...l].sort((a, b) => {
      if (a.g == null) return 1;
      if (b.g == null) return -1;
      return a.g - b.g;
    });
  }, [liste, sekme]);

  const bugunSayi = liste.filter((x) => !x.bitti && x.g != null && x.g <= 0).length;
  const acikSayi = liste.filter((x) => !x.bitti).length;
  const bittiSayi = liste.filter((x) => x.bitti).length;
  const toplamTutar = liste.filter((x) => !x.bitti && x.v.tutar).reduce((t, x) => t + x.v.tutar, 0);

  function formAc(x) {
    setHata('');
    if (x) {
      setDuzenlenenId(x.id);
      setForm({ baslik: x.v.baslik, tarih: x.v.tarih || yerel(new Date()), tutar: x.v.tutar != null ? String(x.v.tutar) : '',
        tekrar: x.v.tekrar, aciklama: x.v.aciklama, customer_id: x.customer_id || '' });
    } else {
      setDuzenlenenId(null);
      setForm(bosForm());
    }
    setFormAcik(true);
  }

  async function kaydet() {
    if (!form.baslik.trim()) { setHata('Başlık yaz (örn: Memur Baba Ahmet Bey ödeme).'); return; }
    setKaydediliyor(true);
    setHata('');
    const icerik = JSON.stringify({
      baslik: form.baslik.trim(),
      tarih: form.tarih || null,
      tutar: form.tutar !== '' ? Number(String(form.tutar).replace(/[^\d]/g, '')) : null,
      tekrar: form.tekrar,
      aciklama: form.aciklama.trim(),
    });
    const satir = { tur: TUR_ACIK, kanal: 'hatirlatma', baslik: 'Hatırlatma', mesaj: icerik, gonderen: ad || '', customer_id: form.customer_id || null };
    let sonuc;
    if (duzenlenenId) sonuc = await supabase.from('mesaj_kayitlari').update(satir).eq('id', duzenlenenId).select('*, customers(id, name)').single();
    else sonuc = await supabase.from('mesaj_kayitlari').insert([satir]).select('*, customers(id, name)').single();
    setKaydediliyor(false);
    if (sonuc.error) { setHata('Kaydedilemedi: ' + sonuc.error.message); return; }
    if (duzenlenenId) setHam((l) => l.map((x) => (x.id === duzenlenenId ? sonuc.data : x)));
    else setHam((l) => [sonuc.data, ...l]);
    setFormAcik(false);
    setForm(bosForm());
    setDuzenlenenId(null);
  }

  async function sil(x) {
    if (!window.confirm('Bu hatırlatma silinsin mi?')) return;
    const { error } = await supabase.from('mesaj_kayitlari').delete().eq('id', x.id);
    if (error) { setHata('Silinemedi: ' + error.message); return; }
    setHam((l) => l.filter((y) => y.id !== x.id));
  }

  // Tamamla: tekrar varsa bir sonraki tarihe öteler, yoksa tamamlandı yapar
  async function tamamla(x) {
    if (x.v.tekrar && x.v.tekrar !== 'tek' && x.v.tarih) {
      const yeniTarih = sonrakiTarih(x.v.tarih, x.v.tekrar);
      const icerik = JSON.stringify({ ...x.v, tarih: yeniTarih });
      const { data, error } = await supabase.from('mesaj_kayitlari').update({ mesaj: icerik }).eq('id', x.id).select('*, customers(id, name)').single();
      if (error) { setHata('Güncellenemedi: ' + error.message); return; }
      setHam((l) => l.map((y) => (y.id === x.id ? data : y)));
    } else {
      const { error } = await supabase.from('mesaj_kayitlari').update({ tur: TUR_BITTI }).eq('id', x.id);
      if (error) { setHata('Güncellenemedi: ' + error.message); return; }
      setHam((l) => l.map((y) => (y.id === x.id ? { ...y, tur: TUR_BITTI } : y)));
    }
  }

  async function geriAl(x) {
    const { error } = await supabase.from('mesaj_kayitlari').update({ tur: TUR_ACIK }).eq('id', x.id);
    if (error) { setHata('Güncellenemedi: ' + error.message); return; }
    setHam((l) => l.map((y) => (y.id === x.id ? { ...y, tur: TUR_ACIK } : y)));
  }

  return (
    <div style={s.sayfa}>
      <div style={s.ustSatir}>
        <h1 style={s.baslik}>Hatırlatmalar</h1>
        <button style={s.yeniBtn} onClick={() => formAc(null)}>
          <Ikon ad="arti" boyut={18} renk="#fff" kalin={2.6} /> Yeni
        </button>
      </div>
      <p style={s.alt}>Ödeme ve iş hatırlatmaları. Günü gelen hatırlatma ana sayfanın en üstünde çıkar.</p>

      {toplamTutar > 0 && (
        <div style={s.tutarKart}>
          <IkonKutu ad="para" renk="#16a34a" boyut={42} yaricap={13} />
          <div>
            <div style={{ fontSize: 12.5, color: '#64748b', fontWeight: 600 }}>Bekleyen tahsilat</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#0b1730', letterSpacing: -0.5 }}>{tutarYaz(toplamTutar)}</div>
          </div>
        </div>
      )}

      {hata && <div style={s.hata}>{hata}</div>}

      {formAcik && (
        <div style={s.formKart}>
          <div style={s.formBaslik}>{duzenlenenId ? 'Hatırlatmayı düzenle' : 'Yeni hatırlatma'}</div>
          <label style={s.etiket}>Başlık *</label>
          <input style={s.input} value={form.baslik} onChange={(e) => setForm({ ...form, baslik: e.target.value })}
            placeholder="Örn: Memur Baba Ahmet Bey ödemesi" />
          <div style={s.ikili}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={s.etiket}>Tarih</label>
              <input style={s.input} type="date" value={form.tarih || ''} onChange={(e) => setForm({ ...form, tarih: e.target.value })} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={s.etiket}>Tutar (₺)</label>
              <input style={s.input} type="number" inputMode="numeric" value={form.tutar}
                onChange={(e) => setForm({ ...form, tutar: e.target.value })} placeholder="30000" />
            </div>
          </div>
          <label style={s.etiket}>Tekrar</label>
          <div style={s.tekrarSatir}>
            {TEKRARLAR.map((t) => (
              <button key={t.id} onClick={() => setForm({ ...form, tekrar: t.id })}
                style={{ ...s.tekrarBtn, ...(form.tekrar === t.id ? s.tekrarAktif : {}) }}>{t.ad}</button>
            ))}
          </div>
          <label style={s.etiket}>Müşteri (isteğe bağlı)</label>
          <select style={s.input} value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
            <option value="">Seçilmedi</option>
            {musteriler.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <label style={s.etiket}>Açıklama (isteğe bağlı)</label>
          <textarea style={{ ...s.input, minHeight: 60, resize: 'vertical' }} value={form.aciklama}
            onChange={(e) => setForm({ ...form, aciklama: e.target.value })} placeholder="Ek not..." />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button style={{ ...s.kaydetBtn, opacity: kaydediliyor ? 0.6 : 1 }} disabled={kaydediliyor} onClick={kaydet}>
              {kaydediliyor ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
            <button style={s.vazgecBtn} onClick={() => { setFormAcik(false); setDuzenlenenId(null); }}>Vazgeç</button>
          </div>
        </div>
      )}

      <div style={s.sekmeler}>
        {[['bugun', `Bugün (${bugunSayi})`], ['yaklasan', `Açık (${acikSayi})`], ['tamam', `Tamamlanan (${bittiSayi})`]].map(([id, yazi]) => (
          <button key={id} onClick={() => setSekme(id)} style={{ ...s.sekme, ...(sekme === id ? s.sekmeAktif : {}) }}>{yazi}</button>
        ))}
      </div>

      {gorunen.length === 0 && (
        <div style={{ ...s.kart, display: 'flex', alignItems: 'center', gap: 12 }}>
          <IkonKutu ad="zil" renk="#64748b" boyut={44} yaricap={14} />
          <div style={{ color: '#64748b', fontSize: 14 }}>
            {sekme === 'tamam' ? 'Tamamlanan hatırlatma yok.' : sekme === 'bugun' ? 'Bugün için hatırlatma yok.' : 'Hatırlatma yok. "Yeni" ile ekleyebilirsin.'}
          </div>
        </div>
      )}

      {gorunen.map((x) => {
        const k = kalanYaz(x.g);
        return (
          <div key={x.id} style={{ ...s.hat, ...(x.bitti ? { opacity: 0.6 } : {}) }}>
            {!x.bitti && (
              <button style={s.tik} onClick={() => tamamla(x)} title="Tamamlandı / tahsil edildi">
                <span style={{ color: '#cbd5e1', fontSize: 18 }}>○</span>
              </button>
            )}
            {x.bitti && (
              <button style={{ ...s.tik, ...s.tikAktif }} onClick={() => geriAl(x)} title="Geri al">
                <span style={{ color: '#fff', fontWeight: 900, fontSize: 14 }}>✓</span>
              </button>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...s.hatBaslik, ...(x.bitti ? { textDecoration: 'line-through' } : {}) }}>{x.v.baslik}</div>
              <div style={s.hatMeta}>
                {x.v.tarih && <><Ikon ad="takvim" boyut={13} renk="#94a3b8" /><span>{tarihYaz(x.v.tarih)}</span></>}
                {x.v.tekrar && x.v.tekrar !== 'tek' && <span style={s.tekrarRozet}>🔁 {TEKRARLAR.find((t) => t.id === x.v.tekrar)?.ad}</span>}
                {x.customers?.name && <span style={s.musteriRozet}>👤 {x.customers.name}</span>}
              </div>
              {x.v.aciklama && <div style={s.hatAciklama}>{x.v.aciklama}</div>}
              {!x.bitti && (
                <div style={s.islemler}>
                  <button style={s.islem} onClick={() => formAc(x)}>Düzenle</button>
                  <button style={{ ...s.islem, color: '#b91c1c' }} onClick={() => sil(x)}>Sil</button>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
              {x.v.tutar != null && <div style={s.tutar}>{tutarYaz(x.v.tutar)}</div>}
              {!x.bitti && <span style={{ ...s.kalanHap, color: k.renk, background: k.zemin }}>{k.yazi}</span>}
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
  ustSatir: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  baslik: { margin: 0, fontSize: 22, fontWeight: 800, color: '#0b1730', letterSpacing: -0.3 },
  yeniBtn: { display: 'flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 12, padding: '10px 14px', background: 'linear-gradient(145deg,#3b82f6,#1d4ed8)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },
  alt: { margin: '4px 0 14px', color: '#64748b', fontSize: 13.5 },
  tutarKart: { display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 18, padding: 14, boxShadow: golge, border: '1px solid #eef1f5', marginBottom: 12 },
  hata: { background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 12, padding: 10, fontSize: 13.5, marginBottom: 12 },
  formKart: { background: '#fff', borderRadius: 20, padding: 16, boxShadow: golge, border: '1px solid #dbe3ee', marginBottom: 12 },
  formBaslik: { fontSize: 16, fontWeight: 800, color: '#0b1730', marginBottom: 12 },
  etiket: { display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', margin: '10px 0 5px' },
  input: { width: '100%', boxSizing: 'border-box', border: '1px solid #e2e8f0', borderRadius: 12, padding: '11px 12px', fontSize: 16, outline: 'none', fontFamily: 'inherit', color: '#0f172a', background: '#fff' },
  ikili: { display: 'flex', gap: 10 },
  tekrarSatir: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  tekrarBtn: { border: '1px solid #e2e8f0', background: '#fff', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 600, color: '#475569', cursor: 'pointer', fontFamily: 'inherit' },
  tekrarAktif: { background: '#eff6ff', borderColor: '#93c5fd', color: '#1d4ed8' },
  kaydetBtn: { flex: 1, border: 'none', borderRadius: 12, padding: 12, background: 'linear-gradient(145deg,#3b82f6,#1d4ed8)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' },
  vazgecBtn: { border: '1px solid #e2e8f0', background: '#fff', borderRadius: 12, padding: '12px 16px', color: '#475569', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },
  sekmeler: { display: 'flex', background: '#e8eef6', borderRadius: 12, padding: 3, marginBottom: 10 },
  sekme: { flex: 1, border: 'none', background: 'transparent', padding: '9px 6px', borderRadius: 10, fontSize: 12.5, fontWeight: 600, color: '#475569', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  sekmeAktif: { background: '#fff', color: '#0b1730', boxShadow: '0 1px 3px rgba(0,0,0,.12)' },
  kart: { background: '#fff', borderRadius: 18, padding: 14, boxShadow: golge, border: '1px solid #eef1f5' },
  hat: { display: 'flex', gap: 12, background: '#fff', borderRadius: 18, padding: 14, boxShadow: golge, border: '1px solid #eef1f5', marginBottom: 10 },
  tik: { width: 28, height: 28, borderRadius: 9, border: '2px solid #cbd5e1', background: '#fff', flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, marginTop: 1 },
  tikAktif: { background: '#16a34a', borderColor: '#16a34a' },
  hatBaslik: { fontSize: 15.5, fontWeight: 700, color: '#0b1730', lineHeight: 1.35, wordBreak: 'break-word' },
  hatMeta: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12.5, color: '#64748b' },
  tekrarRozet: { background: '#f1f5f9', color: '#475569', borderRadius: 8, padding: '2px 7px', fontWeight: 600 },
  musteriRozet: { background: '#eff6ff', color: '#1d4ed8', borderRadius: 8, padding: '2px 7px', fontWeight: 600 },
  hatAciklama: { fontSize: 13, color: '#475569', marginTop: 6, lineHeight: 1.4, whiteSpace: 'pre-wrap' },
  islemler: { display: 'flex', gap: 14, marginTop: 8 },
  islem: { border: 'none', background: 'none', padding: 0, fontSize: 12.5, fontWeight: 600, color: '#2563eb', cursor: 'pointer', fontFamily: 'inherit' },
  tutar: { fontSize: 16, fontWeight: 800, color: '#16a34a', whiteSpace: 'nowrap', letterSpacing: -0.3 },
  kalanHap: { fontSize: 11.5, fontWeight: 700, borderRadius: 8, padding: '5px 8px', whiteSpace: 'nowrap' },
};
