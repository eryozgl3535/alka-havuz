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

async function geminiAyristir(metin) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const bugun = yerel(new Date());
  const prompt = `Bugünün tarihi: ${bugun}. Aşağıdaki Türkçe metinden bir hatırlatma oluştur. Şu alanları JSON formatında çıkar:
- baslik: kişi adı ve ödeme/iş açıklaması (örn: "Ahmet Bey ödemesi")
- tarih: YYYY-MM-DD formatında, eğer "ayın 15'i" gibi bir ifade varsa bu ayki o gün, geçmişte kaldıysa gelecek ay
- tutar: sadece sayı olarak TL tutarı (örn: 30000), yoksa null
- tekrar: "tek", "aylik", "haftalik" veya "yillik", belirtilmemişse "tek"

Sadece JSON döndür, başka bir şey yazma.

Metin: "${metin}"`;

  if (!apiKey) throw new Error('VITE_GEMINI_API_KEY Vercel ayarlarında yok');
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey.trim() },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  );
  if (!res.ok) {
    let detay = '';
    try { detay = (await res.json())?.error?.message || ''; } catch { /* yok */ }
    throw new Error('Gemini ' + res.status + (detay ? ': ' + detay : ''));
  }
  const data = await res.json();
  const icerik = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const temiz = icerik.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(temiz);
}

export default function HatirlatmalarPage({ ad }) {
  const [ham, setHam] = useState([]);
  const [musteriler, setMusteriler] = useState([]);
  const [sekme, setSekme] = useState('yaklasan');
  const [form, setForm] = useState(bosForm);
  const [formAcik, setFormAcik] = useState(false);
  const [duzenlenenId, setDuzenlenenId] = useState(null);
  const [hata, setHata] = useState('');
  const [kaydediliyor, setKaydediliyor] = useState(false);

  // Yapay zeka kutusu
  const [yapayzakaAcik, setYapayzakaAcik] = useState(false);
  const [yzMetin, setYzMetin] = useState('');
  const [yzYukleniyor, setYzYukleniyor] = useState(false);
  const [yzHata, setYzHata] = useState('');

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

  async function yzGonder() {
    if (!yzMetin.trim()) return;
    setYzYukleniyor(true);
    setYzHata('');
    try {
      const sonuc = await geminiAyristir(yzMetin.trim());
      setDuzenlenenId(null);
      setForm({
        baslik: sonuc.baslik || '',
        tarih: sonuc.tarih || yerel(new Date()),
        tutar: sonuc.tutar != null ? String(sonuc.tutar) : '',
        tekrar: sonuc.tekrar || 'tek',
        aciklama: '',
        customer_id: '',
      });
      setYapayzakaAcik(false);
      setYzMetin('');
      setFormAcik(true);
    } catch (e) {
      setYzHata('Anlaşılamadı, tekrar dene. (' + e.message + ')');
    }
    setYzYukleniyor(false);
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
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={s.yzBtn} onClick={() => { setYapayzakaAcik(!yapayzakaAcik); setYzHata(''); setYzMetin(''); }}>
            ✨ Yapay Zeka
          </button>
          <button style={s.yeniBtn} onClick={() => formAc(null)}>
            <Ikon ad="arti" boyut={18} renk="#fff" kalin={2.6} /> Yeni
          </button>
        </div>
      </div>
      <p style={s.alt}>Ödeme ve iş hatırlatmaları. Günü gelen hatırlatma ana sayfanın en üstünde çıkar.</p>

      {/* Yapay Zeka Kutusu */}
      {yapayzakaAcik && (
        <div style={s.yzKart}>
          <div style={s.yzBaslik}>✨ Yapay Zeka ile Ekle</div>
          <p style={s.yzAciklama}>Serbest metin yaz, otomatik ayrıştırır ve formu doldurur.</p>
          <div style={s.yzOrnek}>Örnek: "İhsan Köstekçi'nin 20'sinde 30 bin TL ödemesi var"</div>
          <textarea
            style={s.yzInput}
            value={yzMetin}
            onChange={(e) => setYzMetin(e.target.value)}
            placeholder="Hatırlatmayı buraya yaz..."
            rows={3}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) yzGonder(); }}
          />
          {yzHata && <div style={s.hata}>{yzHata}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button style={{ ...s.kaydetBtn, opacity: yzYukleniyor ? 0.6 : 1, flex: 1 }} disabled={yzYukleniyor} onClick={yzGonder}>
              {yzYukleniyor ? '⏳ Anlaşılıyor...' : '✨ Ayrıştır ve Forma Aktar'}
            </button>
            <button style={s.vazgecBtn} onClick={() => setYapayzakaAcik(false)}>İptal</button>
          </div>
        </div>
      )}

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
            {musteriler.map((m) => <option key={m.id}
