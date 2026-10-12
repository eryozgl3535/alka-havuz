import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabase';

// Ana sayfadaki sesli asistan: konuş → Gemini anlar → sesli cevap verir.
// Hatırlatma ekleyebilir / tamamlayabilir (onay alarak), hatırlatmalar hakkında soru cevaplar.
const MODEL = 'gemini-3.8-flash';
const TUR_ACIK = 'hatirlatma';
const TUR_BITTI = 'hatirlatma-bitti';
const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

const yerel = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function sonrakiTarih(t, tekrar) {
  const d = new Date(t + 'T00:00:00');
  if (tekrar === 'aylik') d.setMonth(d.getMonth() + 1);
  else if (tekrar === 'haftalik') d.setDate(d.getDate() + 7);
  else if (tekrar === 'yillik') d.setFullYear(d.getFullYear() + 1);
  return yerel(d);
}

function veriCoz(mesaj) {
  try { return JSON.parse(mesaj || '{}'); } catch { return { baslik: mesaj || '' }; }
}

const kucuk = (x) => String(x || '').toLocaleLowerCase('tr-TR').trim();
const EVET = /^(evet|olur|tamam|onayl[ıi]yorum|onay|kaydet|ekle|do[gğ]ru|aynen|tabii|tabi|evet kaydet)\b/;
const HAYIR = /^(hay[ıi]r|iptal|vazge[cç]|yok|yanl[ıi][sş]|dur|bo[sş]ver)\b/;

const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

// Gemini sohbeti kullanıcıyla başlamalı ve sırayla ilerlemeli: ardışık aynı tarafı birleştir.
function sirala(gecmis) {
  const sonuc = [];
  for (const m of gecmis) {
    const role = m.kim === 'ben' ? 'user' : 'model';
    if (!sonuc.length && role === 'model') continue;
    const son = sonuc[sonuc.length - 1];
    if (son && son.role === role) son.parts[0].text += '\n' + m.yazi;
    else sonuc.push({ role, parts: [{ text: m.yazi }] });
  }
  return sonuc;
}

async function geminiSor(sistem, gecmis) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('VITE_GEMINI_API_KEY Vercel ayarlarında yok');
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey.trim() },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: sistem }] },
      contents: sirala(gecmis),
      generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
    }),
  });
  if (!res.ok) {
    let detay = '';
    try { detay = (await res.json())?.error?.message || ''; } catch { /* yok */ }
    throw new Error('Gemini ' + res.status + (detay ? ': ' + detay : ''));
  }
  const data = await res.json();
  const icerik = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  const temiz = icerik.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try { return JSON.parse(temiz); } catch { return { cevap: temiz, islem: null }; }
}

function sistemMetni(hatirlatmalar, musteriler, ad) {
  const b = new Date();
  const bugun = `${yerel(b)} (${GUNLER[b.getDay()]}, ${b.getDate()} ${AYLAR[b.getMonth()]} ${b.getFullYear()})`;
  const hatListe = hatirlatmalar.length
    ? hatirlatmalar.map((h) => `- id=${h.id} | ${h.v.baslik} | tarih=${h.v.tarih || 'yok'} | tutar=${h.v.tutar ?? 'yok'} | tekrar=${h.v.tekrar || 'tek'} | durum=${h.tur === TUR_BITTI ? 'tamamlandı' : 'açık'}${h.customers?.name ? ' | müşteri=' + h.customers.name : ''}`).join('\n')
    : '(kayıt yok)';
  const musteriListe = musteriler.slice(0, 400).map((m) => m.name).join(', ') || '(yok)';
  return `Sen ALKA Mekanik ve Havuz Sistemleri'nin sesli asistanısın. Konuştuğun kişi: ${ad || 'ekip üyesi'}.
Bugün: ${bugun}.
Cevapların sesli okunacak: kısa, doğal, konuşma dilinde Türkçe yaz. Madde işareti, yıldız, emoji, markdown KULLANMA. Tutarları "30 bin lira" gibi söyle, tarihleri "20 Ekim Salı" gibi söyle.

Kayıtlı hatırlatmalar:
${hatListe}

Müşteri adları: ${musteriListe}

YAPABİLDİKLERİN:
1) Yeni hatırlatma ekleme. Kullanıcı bir ödeme, tahsilat, iş veya hatırlatılacak bir şey söylerse islem doldur:
   {"tur":"hatirlatma_ekle","baslik":"...","tarih":"YYYY-MM-DD","tutar":sayı veya null,"tekrar":"tek|aylik|haftalik|yillik","musteri_adi":"müşteri listesinde eşleşen ad veya null","aciklama":""}
   - "20'sinde" gibi sadece gün söylenirse bu ayın o günü; geçmişte kaldıysa gelecek ayın o günü.
   - "30 bin" = 30000. Tekrar söylenmemişse "tek". "her ay" = aylik.
   - baslik kısa olsun, örn: "İhsan Köstekçi ödemesi".
   - cevap alanında ne kaydedeceğini tek cümleyle söyle ve "Onaylıyor musun?" diye sor. Kaydettim DEME, kayıt onaydan sonra yapılır.
2) Hatırlatmayı tamamlama. "X'in ödemesini aldım", "X tamam" gibi bir şey derse listeden doğru kaydı bul:
   {"tur":"hatirlatma_tamamla","id":"listedeki id","baslik":"..."} ve cevapta onay sor.
3) Soru cevaplama: "bu hafta kimin ödemesi var", "toplam ne kadar alacak var" gibi sorulara yukarıdaki listeye bakarak cevap ver (islem null). Uydurma bilgi verme; listede yoksa yok de.
4) Genel sohbet ve iş soruları (havuz bakımı, kimya, tesisat, mesaj taslağı vb.): kısa ve faydalı cevap ver (islem null).

Eksik bilgi varsa (örn. tarih yok) islem null bırak ve eksik olanı sor.

YALNIZCA şu JSON'u döndür: {"cevap":"sesli okunacak metin","islem":null veya yukarıdaki nesnelerden biri}`;
}

export default function SesliAsistan({ ad, onDegisti }) {
  const [mesajlar, setMesajlar] = useState([]);
  const [dinliyor, setDinliyor] = useState(false);
  const [araMetin, setAraMetin] = useState('');
  const [yaziMetin, setYaziMetin] = useState('');
  const [dusunuyor, setDusunuyor] = useState(false);
  const [bekleyen, setBekleyen] = useState(null);
  const [sesAcik, setSesAcik] = useState(() => { try { return localStorage.getItem('alkaAsistanSes') !== '0'; } catch { return true; } });
  const [hata, setHata] = useState('');
  const [hatirlatmalar, setHatirlatmalar] = useState([]);
  const [musteriler, setMusteriler] = useState([]);
  const tanima = useRef(null);
  const sonMetin = useRef('');
  const listeRef = useRef(null);
  const mesajRef = useRef([]);
  const bekleyenRef = useRef(null);

  mesajRef.current = mesajlar;
  bekleyenRef.current = bekleyen;

  async function veriYukle() {
    const [h, m] = await Promise.all([
      supabase.from('mesaj_kayitlari').select('id, tur, mesaj, customer_id, customers(name)').like('tur', 'hatirlatma%').order('created_at', { ascending: false }).limit(200),
      supabase.from('customers').select('id, name').order('name', { ascending: true }),
    ]);
    setHatirlatmalar((h.data || []).map((x) => ({ ...x, v: veriCoz(x.mesaj) })));
    setMusteriler(m.data || []);
  }
  useEffect(() => { veriYukle(); }, []);

  useEffect(() => {
    if (listeRef.current) listeRef.current.scrollTop = listeRef.current.scrollHeight;
  }, [mesajlar, dusunuyor, araMetin]);

  useEffect(() => () => {
    try { tanima.current?.abort(); } catch { /* yok */ }
    try { window.speechSynthesis?.cancel(); } catch { /* yok */ }
  }, []);

  function konus(metin) {
    if (!sesAcik || !metin || typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(metin);
      u.lang = 'tr-TR';
      const ses = window.speechSynthesis.getVoices().find((v) => v.lang && v.lang.toLowerCase().startsWith('tr'));
      if (ses) u.voice = ses;
      u.rate = 1.03;
      window.speechSynthesis.speak(u);
    } catch { /* yok */ }
  }

  function ekle(kim, yazi, ek = {}) {
    setMesajlar((l) => [...l, { kim, yazi, ...ek }].slice(-30));
  }

  function asistanDer(yazi, ek) {
    ekle('asistan', yazi, ek);
    konus(yazi);
  }

  async function islemYap(islem) {
    if (islem.tur === 'hatirlatma_ekle') {
      const musteri = islem.musteri_adi ? musteriler.find((m) => kucuk(m.name) === kucuk(islem.musteri_adi)) : null;
      const icerik = JSON.stringify({
        baslik: String(islem.baslik || 'Hatırlatma').trim(),
        tarih: islem.tarih || null,
        tutar: islem.tutar != null && islem.tutar !== '' ? Number(String(islem.tutar).replace(/[^\d.]/g, '')) : null,
        tekrar: islem.tekrar || 'tek',
        aciklama: String(islem.aciklama || '').trim(),
      });
      const { error } = await supabase.from('mesaj_kayitlari').insert([{
        tur: TUR_ACIK, kanal: 'hatirlatma', baslik: 'Hatırlatma', mesaj: icerik, gonderen: ad || '', customer_id: musteri?.id || null,
      }]);
      if (error) throw new Error('Kaydedilemedi: ' + error.message);
      return 'Kaydettim. Hatırlatmalar sayfasına ekledim.';
    }
    if (islem.tur === 'hatirlatma_tamamla') {
      const h = hatirlatmalar.find((x) => String(x.id) === String(islem.id));
      if (!h) throw new Error('Bu hatırlatmayı bulamadım.');
      if (h.v.tekrar && h.v.tekrar !== 'tek' && h.v.tarih) {
        const yeni = sonrakiTarih(h.v.tarih, h.v.tekrar);
        const { error } = await supabase.from('mesaj_kayitlari').update({ mesaj: JSON.stringify({ ...h.v, tarih: yeni }) }).eq('id', h.id);
        if (error) throw new Error('Güncellenemedi: ' + error.message);
        const d = new Date(yeni + 'T00:00:00');
        return `Tamam, işaretledim. Tekrarlı olduğu için bir sonrakini ${d.getDate()} ${AYLAR[d.getMonth()]} tarihine kurdum.`;
      }
      const { error } = await supabase.from('mesaj_kayitlari').update({ tur: TUR_BITTI }).eq('id', h.id);
      if (error) throw new Error('Güncellenemedi: ' + error.message);
      return 'Tamam, tamamlandı olarak işaretledim.';
    }
    throw new Error('Bu işlemi yapamıyorum.');
  }

  async function onayla() {
    const b = bekleyenRef.current;
    if (!b) return;
    setBekleyen(null);
    setDusunuyor(true);
    try {
      const sonuc = await islemYap(b);
      asistanDer(sonuc);
      await veriYukle();
      onDegisti && onDegisti();
    } catch (e) {
      asistanDer(e.message);
    }
    setDusunuyor(false);
  }

  function iptal() {
    setBekleyen(null);
    asistanDer('Tamam, iptal ettim.');
  }

  async function gonder(metin) {
    const t = String(metin || '').trim();
    if (!t || dusunuyor) return;
    setHata('');
    ekle('ben', t);

    // Bekleyen bir işlem varsa evet/hayır cevabını burada yakala
    if (bekleyenRef.current) {
      const k = kucuk(t);
      if (EVET.test(k)) { await onayla(); return; }
      if (HAYIR.test(k)) { iptal(); return; }
      setBekleyen(null);
    }

    setDusunuyor(true);
    try {
      const gecmis = [...mesajRef.current, { kim: 'ben', yazi: t }].slice(-12);
      const sonuc = await geminiSor(sistemMetni(hatirlatmalar, musteriler, ad), gecmis);
      const cevap = String(sonuc.cevap || '').trim() || 'Anlayamadım, tekrar söyler misin?';
      const islem = sonuc.islem && typeof sonuc.islem === 'object' && sonuc.islem.tur ? sonuc.islem : null;
      if (islem) setBekleyen(islem);
      asistanDer(cevap, islem ? { islem } : {});
    } catch (e) {
      setHata(e.message);
    }
    setDusunuyor(false);
  }

  function dinle() {
    if (!SR) { setHata('Bu tarayıcı sesli komutu desteklemiyor. Chrome veya Edge kullan, ya da aşağıya yazarak sor.'); return; }
    if (dinliyor) { try { tanima.current?.stop(); } catch { /* yok */ } return; }
    try { window.speechSynthesis?.cancel(); } catch { /* yok */ }
    setHata('');
    const r = new SR();
    r.lang = 'tr-TR';
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    sonMetin.current = '';
    r.onresult = (e) => {
      let metin = '';
      for (let i = 0; i < e.results.length; i++) metin += e.results[i][0].transcript;
      sonMetin.current = metin;
      setAraMetin(metin);
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setHata('Mikrofon izni verilmedi. Adres çubuğundaki kilit simgesinden mikrofona izin ver.');
      else if (e.error === 'no-speech') setHata('Ses duyamadım, tekrar dene.');
      else if (e.error !== 'aborted') setHata('Ses tanıma hatası: ' + e.error);
    };
    r.onend = () => {
      setDinliyor(false);
      setAraMetin('');
      const m = sonMetin.current;
      sonMetin.current = '';
      if (m.trim()) gonder(m);
    };
    tanima.current = r;
    setDinliyor(true);
    try { r.start(); } catch { setDinliyor(false); }
  }

  function sesDegis() {
    const yeni = !sesAcik;
    setSesAcik(yeni);
    try { localStorage.setItem('alkaAsistanSes', yeni ? '1' : '0'); } catch { /* yok */ }
    if (!yeni) { try { window.speechSynthesis?.cancel(); } catch { /* yok */ } }
  }

  function yaziGonder(e) {
    e.preventDefault();
    const t = yaziMetin;
    setYaziMetin('');
    gonder(t);
  }

  const bos = mesajlar.length === 0 && !dinliyor && !dusunuyor;

  return (
    <section style={s.kart}>
      <div style={s.ust}>
        <div>
          <div style={s.baslik}>✨ Sesli Asistan</div>
          <div style={s.alt}>Mikrofona bas ve konuş. Hatırlatma ekler, soruları cevaplar.</div>
        </div>
        <button style={s.sesBtn} onClick={sesDegis} title={sesAcik ? 'Sesli okumayı kapat' : 'Sesli okumayı aç'}>
          {sesAcik ? '🔊' : '🔇'}
        </button>
      </div>

      {(!bos || hata) && (
        <div ref={listeRef} style={s.liste}>
          {mesajlar.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.kim === 'ben' ? 'flex-end' : 'flex-start' }}>
              <div style={m.kim === 'ben' ? s.benBalon : s.asBalon}>{m.yazi}</div>
            </div>
          ))}
          {dinliyor && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ ...s.benBalon, opacity: 0.65 }}>{araMetin || 'Dinliyorum…'}</div>
            </div>
          )}
          {dusunuyor && <div style={s.asBalon}>⏳ Düşünüyorum…</div>}
        </div>
      )}

      {bekleyen && !dusunuyor && (
        <div style={s.onaySatir}>
          <button style={s.onayBtn} onClick={onayla}>✓ Onayla</button>
          <button style={s.iptalBtn} onClick={iptal}>İptal</button>
        </div>
      )}

      {hata && <div style={s.hata}>{hata}</div>}

      {bos && !hata && (
        <div style={s.ornekler}>
          {['İhsan Köstekçi\'nin 20\'sinde 30 bin TL ödemesi var', 'Bu hafta kimin ödemesi var?'].map((o) => (
            <button key={o} style={s.ornek} onClick={() => gonder(o)}>“{o}”</button>
          ))}
        </div>
      )}

      <div style={s.altSatir}>
        <button style={{ ...s.mikBtn, ...(dinliyor ? s.mikAktif : {}) }} onClick={dinle} disabled={dusunuyor}
          title={dinliyor ? 'Durdur' : 'Konuş'}>
          {dinliyor ? '■' : '🎤'}
        </button>
        <form onSubmit={yaziGonder} style={{ flex: 1, display: 'flex', gap: 8, minWidth: 0 }}>
          <input style={s.input} value={yaziMetin} onChange={(e) => setYaziMetin(e.target.value)}
            placeholder={dinliyor ? 'Dinliyorum…' : 'veya buraya yaz…'} disabled={dusunuyor} />
          <button type="submit" style={s.gonderBtn} disabled={dusunuyor || !yaziMetin.trim()}>Gönder</button>
        </form>
      </div>
    </section>
  );
}

const golge = '0 1px 2px rgba(16,24,40,.04), 0 6px 18px rgba(16,24,40,.06)';
const s = {
  kart: { background: 'linear-gradient(135deg,#faf5ff,#eef2ff)', borderRadius: 20, padding: 14, boxShadow: golge, border: '1.5px solid #c4b5fd', margin: '12px 0' },
  ust: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  baslik: { fontSize: 16.5, fontWeight: 800, color: '#4c1d95' },
  alt: { fontSize: 12.5, color: '#6d28d9', marginTop: 2 },
  sesBtn: { border: '1px solid #ddd6fe', background: '#fff', borderRadius: 10, width: 36, height: 36, fontSize: 17, cursor: 'pointer', flexShrink: 0 },
  liste: { maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 2px 8px' },
  benBalon: { background: 'linear-gradient(145deg,#3b82f6,#1d4ed8)', color: '#fff', borderRadius: '16px 16px 4px 16px', padding: '9px 12px', fontSize: 14.5, maxWidth: '85%', lineHeight: 1.4, wordBreak: 'break-word' },
  asBalon: { background: '#fff', color: '#1e1b4b', border: '1px solid #e0e7ff', borderRadius: '16px 16px 16px 4px', padding: '9px 12px', fontSize: 14.5, maxWidth: '85%', lineHeight: 1.45, wordBreak: 'break-word', alignSelf: 'flex-start', whiteSpace: 'pre-wrap' },
  onaySatir: { display: 'flex', gap: 8, margin: '4px 0 10px' },
  onayBtn: { flex: 1, border: 'none', borderRadius: 12, padding: 11, background: 'linear-gradient(145deg,#22c55e,#16a34a)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' },
  iptalBtn: { border: '1px solid #e2e8f0', background: '#fff', borderRadius: 12, padding: '11px 16px', color: '#475569', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },
  hata: { background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 12, padding: 10, fontSize: 13, margin: '4px 0 10px', wordBreak: 'break-word' },
  ornekler: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 },
  ornek: { textAlign: 'left', border: '1px dashed #c4b5fd', background: '#fff', borderRadius: 10, padding: '8px 10px', fontSize: 13, color: '#6d28d9', cursor: 'pointer', fontFamily: 'inherit', fontStyle: 'italic' },
  altSatir: { display: 'flex', alignItems: 'center', gap: 8 },
  mikBtn: { width: 52, height: 52, borderRadius: '50%', border: 'none', background: 'linear-gradient(145deg,#8b5cf6,#6d28d9)', color: '#fff', fontSize: 22, cursor: 'pointer', flexShrink: 0, boxShadow: '0 4px 14px rgba(109,40,217,.35)' },
  mikAktif: { background: 'linear-gradient(145deg,#ef4444,#b91c1c)', boxShadow: '0 0 0 6px rgba(239,68,68,.2)', fontSize: 18 },
  input: { flex: 1, minWidth: 0, boxSizing: 'border-box', border: '1.5px solid #ddd6fe', borderRadius: 12, padding: '11px 12px', fontSize: 15, outline: 'none', fontFamily: 'inherit', color: '#0f172a', background: '#fff' },
  gonderBtn: { border: 'none', borderRadius: 12, padding: '0 14px', background: '#6d28d9', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 },
};
