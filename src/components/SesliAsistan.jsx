import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabase';
import { ARACLAR, YAZAN_ARACLAR, aracCalistir } from '../asistanAraclar';

// Ana sayfadaki yapay zeka asistanı: normal bir sohbet gibi konuşur (yazarak ya da sesle),
// arkada uygulamanın tamamına hâkimdir. Gemini hangi aracı kullanacağına kendi karar verir
// (müşteri ara, iş emri aç, hatırlatma kur, not ekle...). Onay sormaz; yaptığı her kaydın
// altında "Geri al" düğmesi çıkar. Silme yetkisi yoktur.
const VAPID_PUBLIC = 'BJUQaPBgiZZBfiwUVprGm_uZvvPJyL1O8LRkSB7SA9-5ZteuaLGbskvnKIZ4cGfyd7oZq4Ye7Ge_edz6pfKfT6I';
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
const BITIR = /^(g[öo]r[üu][şs][üu]r[üu]z|kapat|bitir|sohbeti bitir|tamam bu kadar|bu kadar|ho[şs][çc]a kal|g[üu]le g[üu]le|ba[şs]ka bir [şs]ey yok)\b/;
const MAX_TUR = 6;          // bir mesajda en fazla kaç araç turu
const MAX_GECMIS = 40;      // modele gönderilen en fazla sohbet parçası

const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

function base64Uint8(b64) {
  const dolgu = '='.repeat((4 - (b64.length % 4)) % 4);
  const ham = atob((b64 + dolgu).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...ham].map((c) => c.charCodeAt(0)));
}

const pushDestek = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const iosMu = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
const yukluMu = () => typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);

// iPhone/Android: sesli okuma ancak kullanıcı dokunuşuyla açılır; ilk dokunuşta boş bir konuşmayla kilidi aç.
let sesKilidiAcik = false;
function sesKilidiAc() {
  if (sesKilidiAcik || typeof window === 'undefined' || !window.speechSynthesis) return;
  try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; window.speechSynthesis.speak(u); sesKilidiAcik = true; } catch { /* yok */ }
}

// Sohbet geçmişi çok uzarsa baştan kırp; geçmiş her zaman kullanıcının yazdığı bir mesajla başlamalı
function kirp(gecmis) {
  let g = gecmis.slice(-MAX_GECMIS);
  while (g.length && !(g[0].role === 'user' && g[0].parts?.some((p) => p.text))) g = g.slice(1);
  return g;
}

// Gemini'ye kendi sunucumuz (/api/asistan) üzerinden bağlanır; 55 sn içinde cevap gelmezse vazgeçer.
async function modelSor(sistem, contents) {
  const kontrol = new AbortController();
  const zaman = setTimeout(() => kontrol.abort(), 55000);
  let res;
  try {
    res = await fetch('/api/asistan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sistem, contents, tools: ARACLAR }),
      signal: kontrol.signal,
    });
  } catch (e) {
    if (e?.name === 'AbortError') throw new Error('Cevap çok gecikti. İnternet bağlantını kontrol edip tekrar dene.');
    throw new Error('Sunucuya ulaşılamadı. İnternet bağlantını kontrol et.');
  } finally {
    clearTimeout(zaman);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.hata || 'Sunucu hatası ' + res.status);
  return data;
}

function sistemMetni(musteriler, ad, sesli) {
  const b = new Date();
  const bugun = `${yerel(b)} (${GUNLER[b.getDay()]}, ${b.getDate()} ${AYLAR[b.getMonth()]} ${b.getFullYear()})`;
  const ilkAd = String(ad || '').split(' ')[0];
  const hitap = /^volkan/i.test(ilkAd) ? 'Volkan abi' : ilkAd || 'ekip arkadaşım';
  const liste = musteriler.slice(0, 700).map((m) => `${m.id}|${m.name}`).join('\n') || '(henüz müşteri yok)';
  return `Sen ALKA Mekanik ve Havuz Sistemleri'nin yapay zeka asistanısın. Çeşme/İzmir'de havuz, kuyu, hidrofor, sulama, tesisat ve elektrik servisi veren bir firma; yazlık villalara bakım ve servis yapıyor.
Konuştuğun kişi: ${ad || 'ekip üyesi'} (ona "${hitap}" diye hitap et). Bugün: ${bugun}. Saat dilimi İstanbul.

NASIL KONUŞURSUN
- Normal, samimi, akıllı bir asistan gibi; uzun uzun anlatmadan, işi bilen bir çalışma arkadaşı gibi doğal Türkçe konuş.
- ${sesli ? 'Cevapların sesli okunuyor: kısa tut (genelde 1-3 cümle), liste yapma.' : 'Cevaplar ekranda okunuyor: kısa ve net tut, gerekirse satır satır yaz.'}
- Madde işareti, yıldız, markdown, emoji kullanma. Tutarları "30 bin lira", tarihleri "20 Ekim Salı" gibi söyle.
- Önceki konuşmayı hatırla: "onun telefonu", "aynısını Ahmet Bey'e de yap" gibi sözlerde kimi/neyi kastettiğini bağlamdan anla.
- Havuz kimyası, pompa, hidrofor, tesisat, elektrik, müşteriye mesaj taslağı gibi genel sorulara da bilgili ve pratik cevap ver; bunlar için araç gerekmez.

UYGULAMAYA HÂKİMSİN
- Firmanın verileri hakkında her soruda araçları kullan; asla tahmin etme, uydurma. Bulamazsan "kayıtlarda yok" de.
- Bir şey yapmanı isterse (müşteri ekle, hatırlatma kur, iş emri aç, ödemeyi işle, not al, geliş kaydet...) bilgi yeterliyse ONAY SORMADAN hemen yap, sonra ne yaptığını tek cümleyle söyle. Ekranda "Geri al" düğmesi çıkıyor; kullanıcıya bunu ayrıca söylemene gerek yok.
- Sadece gerçekten eksik/belirsiz bilgi varsa sor (örn. tarih hiç yok, ya da aynı isimde iki müşteri var).
- Müşteri gerektiren işlerde aşağıdaki listeden id'yi bul. İsim tam uymuyorsa ya da emin değilsen musteri_ara aracını kullan. Yeni müşteri eklemeden önce listede aynı kişi var mı bak.
- Tarih kuralları: "20'sinde" → bu ayın 20'si, geçtiyse gelecek ayın 20'si. "yarın", "cuma", "haftaya" gibi ifadeleri bugüne göre hesapla. "30 bin" = 30000.
- Bir mesajda birden fazla iş istenirse hepsini yap.
- Silme yetkin yok. Silmek isterse ilgili sayfadan silebileceğini söyle.
- Araçtan hata dönerse kullanıcıya sade dille ne olduğunu söyle.

MÜŞTERİ LİSTESİ (id|ad):
${liste}`;
}

export default function SesliAsistan({ ad, onDegisti }) {
  const [mesajlar, setMesajlar] = useState([]);
  const [dinliyor, setDinliyor] = useState(false);
  const [araMetin, setAraMetin] = useState('');
  const [yaziMetin, setYaziMetin] = useState('');
  const [dusunuyor, setDusunuyor] = useState(false);
  const [sesAcik, setSesAcik] = useState(() => { try { return localStorage.getItem('alkaAsistanSes') !== '0'; } catch { return true; } });
  const [hata, setHata] = useState('');
  const [bildirim, setBildirim] = useState('bilinmiyor'); // bilinmiyor | acik | kapali | desteklenmiyor
  const [bilgi, setBilgi] = useState('');
  const [hatirlatmalar, setHatirlatmalar] = useState([]);
  const [musteriler, setMusteriler] = useState([]);
  const tanima = useRef(null);
  const sonMetin = useRef('');
  const listeRef = useRef(null);
  const mesajRef = useRef([]);
  const gecmisRef = useRef([]);   // modele giden sohbet (araç çağrıları dahil)
  const notRef = useRef('');      // bir sonraki mesaja eklenecek bilgi (örn. geri alınan işlem)
  const [durumYazi, setDurumYazi] = useState('');
  const [sohbet, setSohbet] = useState(false);
  const sohbetRef = useRef(false);
  const dinleRef = useRef(null);
  const sozRef = useRef(null);

  mesajRef.current = mesajlar;

  async function veriYukle() {
    const [h, m] = await Promise.all([
      supabase.from('mesaj_kayitlari').select('id, tur, mesaj, customer_id, customers(name)').like('tur', 'hatirlatma%').order('created_at', { ascending: false }).limit(200),
      supabase.from('customers').select('id, name').order('name', { ascending: true }),
    ]);
    setHatirlatmalar((h.data || []).map((x) => ({ ...x, v: veriCoz(x.mesaj) })));
    setMusteriler(m.data || []);
  }
  useEffect(() => { veriYukle(); }, []);

  // Bu cihazda bildirim açık mı?
  useEffect(() => {
    (async () => {
      if (!pushDestek()) { setBildirim('desteklenmiyor'); return; }
      try {
        const kayit = await navigator.serviceWorker.getRegistration();
        const abone = kayit && await kayit.pushManager.getSubscription();
        setBildirim(abone && Notification.permission === 'granted' ? 'acik' : 'kapali');
      } catch { setBildirim('kapali'); }
    })();
  }, []);

  async function bildirimAc() {
    setHata(''); setBilgi('');
    if (!pushDestek()) {
      setHata(iosMu() && !yukluMu()
        ? 'iPhone\'da bildirim için önce uygulamayı ana ekrana ekle: Safari\'de Paylaş → Ana Ekrana Ekle. Sonra ana ekrandaki ALKA simgesinden açıp tekrar dene.'
        : 'Bu tarayıcı bildirimleri desteklemiyor. Chrome kullanmayı dene.');
      return;
    }
    try {
      const izin = await Notification.requestPermission();
      if (izin !== 'granted') { setHata('Bildirim izni verilmedi. Tarayıcı ayarlarından bu site için bildirimlere izin ver.'); return; }
      let kayit = await navigator.serviceWorker.getRegistration();
      if (!kayit) kayit = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      let abone = await kayit.pushManager.getSubscription();
      if (!abone) abone = await kayit.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64Uint8(VAPID_PUBLIC) });
      const json = abone.toJSON();
      const { data } = await supabase.auth.getUser();
      const eski = Array.isArray(data?.user?.user_metadata?.push) ? data.user.user_metadata.push : [];
      const liste = [...eski.filter((a) => a.endpoint !== json.endpoint), json].slice(-5);
      const { error } = await supabase.auth.updateUser({ data: { push: liste } });
      if (error) throw new Error(error.message);
      setBildirim('acik');
      const r = await fetch('/api/hatirlatma-bildirim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ abonelik: json }) });
      const v = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(v.hata || 'Deneme bildirimi gönderilemedi.');
      setBilgi('Bildirimler açık. Her gün 10:00 ve 21:00\'de o günün hatırlatmaları gelecek. Az önce bir deneme bildirimi gönderdim.');
    } catch (e) {
      setHata('Bildirim açılamadı: ' + (e?.message || e));
    }
  }

  useEffect(() => {
    if (listeRef.current) listeRef.current.scrollTop = listeRef.current.scrollHeight;
  }, [mesajlar, dusunuyor, araMetin]);

  useEffect(() => () => {
    try { tanima.current?.abort(); } catch { /* yok */ }
    try { window.speechSynthesis?.cancel(); } catch { /* yok */ }
  }, []);

  // Sohbet modunda: konuşma bitince mikrofonu kendiliğinden tekrar aç
  function sonraDinle() {
    if (!sohbetRef.current) return;
    setTimeout(() => { if (sohbetRef.current && dinleRef.current) dinleRef.current(true); }, 350);
  }

  function konus(metin) {
    const sesYok = !sesAcik || !metin || typeof window === 'undefined' || !window.speechSynthesis;
    if (sesYok) { sonraDinle(); return; }
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(metin);
      u.lang = 'tr-TR';
      const ses = window.speechSynthesis.getVoices().find((v) => v.lang && v.lang.toLowerCase().startsWith('tr'));
      if (ses) u.voice = ses;
      u.rate = 1.03;
      // Bazı telefonlarda "bitti" olayı gelmiyor: tahmini süre dolunca yine de devam et
      let bitti = false;
      const devam = () => { if (bitti) return; bitti = true; sonraDinle(); };
      u.onend = devam;
      u.onerror = devam;
      setTimeout(devam, Math.min(60000, 1500 + metin.length * 85));
      sozRef.current = u; // Chrome konuşmayı yarıda unutmasın
      window.speechSynthesis.speak(u);
    } catch { sonraDinle(); }
  }

  function sohbetBaslat() {
    sesKilidiAc();
    setHata(''); setBilgi('');
    sohbetRef.current = true;
    setSohbet(true);
    const bugun = yerel(new Date());
    const acik = hatirlatmalar.filter((h) => h.tur !== TUR_BITTI && h.v.tarih);
    const bugunku = acik.filter((h) => h.v.tarih === bugun);
    const geciken = acik.filter((h) => h.v.tarih < bugun);
    const isim = String(ad || '').split(' ')[0];
    const saat = new Date().getHours();
    const selam = saat < 12 ? 'Günaydın' : saat < 18 ? 'Merhaba' : 'İyi akşamlar';
    let metin = `${selam}${isim ? ' ' + isim : ''}. `;
    if (bugunku.length) {
      const adlar = bugunku.slice(0, 3).map((h) => h.v.baslik + (h.v.tutar ? ', ' + Number(h.v.tutar).toLocaleString('tr-TR') + ' lira' : '')).join('. ');
      metin += `Bugün ${bugunku.length} hatırlatman var. ${adlar}. `;
      if (bugunku.length > 3) metin += `Ve ${bugunku.length - 3} tane daha. `;
    } else {
      metin += 'Bugün için hatırlatman yok. ';
    }
    if (geciken.length) metin += `Ayrıca ${geciken.length} gecikmiş hatırlatma var. `;
    metin += 'Seni dinliyorum.';
    asistanDer(metin);
  }

  function sohbetBitir(sesli) {
    sohbetRef.current = false;
    setSohbet(false);
    try { tanima.current?.abort(); } catch { /* yok */ }
    if (sesli) {
      const isim = String(ad || '').split(' ')[0];
      asistanDer(`Görüşürüz${isim ? ' ' + isim : ''}.`);
    } else {
      try { window.speechSynthesis?.cancel(); } catch { /* yok */ }
    }
  }

  function ekle(kim, yazi, ek = {}) {
    setMesajlar((l) => [...l, { kim, yazi, ...ek }].slice(-30));
  }

  function asistanDer(yazi, ek) {
    ekle('asistan', yazi, ek);
    konus(yazi);
  }

  async function geriAl(mesajNo, eylemNo) {
    const e = mesajRef.current[mesajNo]?.eylemler?.[eylemNo];
    if (!e || e.durum) return;
    const isaretle = (durum) => setMesajlar((l) => l.map((m, i) => (i !== mesajNo ? m : { ...m, eylemler: m.eylemler.map((x, j) => (j === eylemNo ? { ...x, durum } : x)) })));
    isaretle('bekliyor');
    try {
      await e.geriAl();
      isaretle('geri alındı');
      notRef.current += `(Bilgi: kullanıcı "${e.yazi}" işlemini geri aldı, artık o kayıt yok.) `;
      await veriYukle();
      onDegisti && onDegisti();
    } catch (err) {
      isaretle('');
      setHata('Geri alınamadı: ' + (err?.message || err));
    }
  }

  async function gonder(metin) {
    const t = String(metin || '').trim();
    if (!t || dusunuyor) return;
    setHata('');
    ekle('ben', t);

    if (sohbetRef.current && BITIR.test(kucuk(t))) { sohbetBitir(true); return; }

    setDusunuyor(true);
    setDurumYazi('Düşünüyorum…');
    const eylemler = [];
    try {
      const sistem = sistemMetni(musteriler, ad, sohbetRef.current);
      let gecmis = kirp([...gecmisRef.current, { role: 'user', parts: [{ text: notRef.current + t }] }]);
      notRef.current = '';
      let son = '';
      for (let tur = 0; tur < MAX_TUR; tur++) {
        const r = await modelSor(sistem, gecmis);
        const icerik = r.icerik && Array.isArray(r.icerik.parts) ? r.icerik : { role: 'model', parts: [{ text: r.metin || '' }] };
        gecmis = [...gecmis, icerik];
        const cagrilar = icerik.parts.filter((p) => p.functionCall);
        if (!cagrilar.length) { son = String(r.metin || '').trim(); break; }
        const cevaplar = [];
        for (const p of cagrilar) {
          const { name, args, id } = p.functionCall;
          setDurumYazi(YAZAN_ARACLAR.has(name) ? 'Kaydediyorum…' : 'Kayıtlara bakıyorum…');
          const sonuc = await aracCalistir(name, args, { ad });
          if (sonuc.geriAl) eylemler.push({ yazi: sonuc.eylem || name, geriAl: sonuc.geriAl, durum: '' });
          cevaplar.push({ functionResponse: { ...(id ? { id } : {}), name, response: { sonuc: sonuc.sonuc } } });
        }
        gecmis = [...gecmis, { role: 'user', parts: cevaplar }];
      }
      gecmisRef.current = gecmis;
      if (!son) son = eylemler.length ? 'Tamam, hallettim.' : 'Anlayamadım, tekrar söyler misin?';
      asistanDer(son, eylemler.length ? { eylemler } : {});
      if (eylemler.length) { await veriYukle(); onDegisti && onDegisti(); }
    } catch (e) {
      if (eylemler.length) ekle('asistan', 'İşlem yarıda kaldı ama şunları yaptım:', { eylemler });
      setHata(e?.message || 'Bir hata oldu, tekrar dene.');
      if (sohbetRef.current) { sohbetRef.current = false; setSohbet(false); }
    } finally {
      setDusunuyor(false);
      setDurumYazi('');
    }
  }

  function dinle(otomatik) {
    if (!otomatik) sesKilidiAc();
    if (otomatik && (dinliyor || tanima.current?._aktif)) return;
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
      else if (e.error === 'no-speech') {
        if (sohbetRef.current) { sohbetRef.current = false; setSohbet(false); setBilgi('Bir süre ses gelmedi, sohbeti durdurdum. Devam etmek için "Konuşalım"a bas.'); }
        else setHata('Ses duyamadım, tekrar dene.');
      }
      else if (e.error !== 'aborted') setHata('Ses tanıma hatası: ' + e.error);
    };
    r.onend = () => {
      r._aktif = false;
      setDinliyor(false);
      setAraMetin('');
      const m = sonMetin.current;
      sonMetin.current = '';
      if (m.trim()) gonder(m);
    };
    tanima.current = r;
    r._aktif = true;
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
    sesKilidiAc();
    const t = yaziMetin;
    setYaziMetin('');
    gonder(t);
  }

  dinleRef.current = dinle;
  const bos = mesajlar.length === 0 && !dinliyor && !dusunuyor;

  return (
    <section style={s.kart}>
      <div style={s.ust}>
        <div>
          <div style={s.baslik}>✨ Asistan</div>
          <div style={s.alt}>Yaz ya da konuş: her şeyi sorabilirsin. Müşteri, iş emri, hatırlatma, not, geliş ekler.</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button style={{ ...s.sesBtn, ...(bildirim === 'acik' ? s.bildirimAcik : {}) }} onClick={bildirimAc}
          title={bildirim === 'acik' ? 'Bildirimler açık (10:00 ve 21:00)' : 'Hatırlatma bildirimlerini aç'}>
          {bildirim === 'acik' ? '🔔' : '🔕'}
        </button>
        <button style={s.sesBtn} onClick={sesDegis} title={sesAcik ? 'Sesli okumayı kapat' : 'Sesli okumayı aç'}>
          {sesAcik ? '🔊' : '🔇'}
        </button>
        </div>
      </div>

      {bilgi && <div style={s.bilgi}>{bilgi}</div>}

      {SR && (
        sohbet ? (
          <button style={{ ...s.sohbetBtn, ...s.sohbetBitirBtn }} onClick={() => sohbetBitir(false)}>
            ⏹ Sohbeti bitir {dinliyor ? '· dinliyorum…' : dusunuyor ? '· düşünüyorum…' : '· konuşuyorum…'}
          </button>
        ) : (
          <button style={s.sohbetBtn} onClick={sohbetBaslat} disabled={dusunuyor}>🗣️ Konuşalım</button>
        )
      )}

      {(!bos || hata) && (
        <div ref={listeRef} style={s.liste}>
          {mesajlar.map((m, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.kim === 'ben' ? 'flex-end' : 'flex-start', gap: 4 }}>
              <div style={m.kim === 'ben' ? s.benBalon : s.asBalon}>{m.yazi}</div>
              {(m.eylemler || []).map((e, j) => (
                <div key={j} style={{ ...s.eylem, ...(e.durum === 'geri alındı' ? s.eylemGeri : {}) }}>
                  <span style={{ minWidth: 0 }}>{e.durum === 'geri alındı' ? '↩︎ ' : '✓ '}{e.yazi}</span>
                  {e.durum === 'geri alındı'
                    ? <span style={s.eylemNot}>geri alındı</span>
                    : <button style={s.geriBtn} disabled={e.durum === 'bekliyor'} onClick={() => geriAl(i, j)}>{e.durum === 'bekliyor' ? '…' : 'Geri al'}</button>}
                </div>
              ))}
            </div>
          ))}
          {dinliyor && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ ...s.benBalon, opacity: 0.65 }}>{araMetin || 'Dinliyorum…'}</div>
            </div>
          )}
          {dusunuyor && <div style={s.asBalon}>⏳ {durumYazi || 'Düşünüyorum…'}</div>}
        </div>
      )}

      {hata && <div style={s.hata}>{hata}</div>}

      {bos && !hata && (
        <div style={s.ornekler}>
          {['Bugün ne var?', 'İhsan Köstekçi\'nin 20\'sinde 30 bin TL ödemesi var', 'Bu hafta bakımı gelen müşteriler kim?'].map((o) => (
            <button key={o} style={s.ornek} onClick={() => gonder(o)}>“{o}”</button>
          ))}
        </div>
      )}

      <div style={s.altSatir}>
        <button style={{ ...s.mikBtn, ...(dinliyor ? s.mikAktif : {}) }} onClick={() => dinle(false)} disabled={dusunuyor}
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
  sohbetBtn: { width: '100%', border: 'none', borderRadius: 14, padding: '13px 14px', marginBottom: 10, background: 'linear-gradient(145deg,#8b5cf6,#6d28d9)', color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(109,40,217,.3)' },
  sohbetBitirBtn: { background: 'linear-gradient(145deg,#f87171,#dc2626)', boxShadow: '0 4px 14px rgba(220,38,38,.3)', fontSize: 14.5 },
  bildirimAcik: { background: '#f5f3ff', borderColor: '#a78bfa' },
  bilgi: { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', borderRadius: 12, padding: 10, fontSize: 13, margin: '0 0 10px' },
  sesBtn: { border: '1px solid #ddd6fe', background: '#fff', borderRadius: 10, width: 36, height: 36, fontSize: 17, cursor: 'pointer', flexShrink: 0 },
  liste: { maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 2px 8px' },
  benBalon: { background: 'linear-gradient(145deg,#3b82f6,#1d4ed8)', color: '#fff', borderRadius: '16px 16px 4px 16px', padding: '9px 12px', fontSize: 14.5, maxWidth: '85%', lineHeight: 1.4, wordBreak: 'break-word' },
  asBalon: { background: '#fff', color: '#1e1b4b', border: '1px solid #e0e7ff', borderRadius: '16px 16px 16px 4px', padding: '9px 12px', fontSize: 14.5, maxWidth: '85%', lineHeight: 1.45, wordBreak: 'break-word', alignSelf: 'flex-start', whiteSpace: 'pre-wrap' },
  eylem: { display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', maxWidth: '92%', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', borderRadius: 10, padding: '5px 6px 5px 10px', fontSize: 12.5, fontWeight: 600, lineHeight: 1.35 },
  eylemGeri: { background: '#f8fafc', borderColor: '#e2e8f0', color: '#64748b', textDecoration: 'line-through' },
  eylemNot: { fontSize: 11.5, fontWeight: 600, color: '#64748b', textDecoration: 'none', whiteSpace: 'nowrap', paddingRight: 4 },
  geriBtn: { border: '1px solid #86efac', background: '#fff', color: '#15803d', borderRadius: 8, padding: '4px 9px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 },
  hata: { background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 12, padding: 10, fontSize: 13, margin: '4px 0 10px', wordBreak: 'break-word' },
  ornekler: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 },
  ornek: { textAlign: 'left', border: '1px dashed #c4b5fd', background: '#fff', borderRadius: 10, padding: '8px 10px', fontSize: 13, color: '#6d28d9', cursor: 'pointer', fontFamily: 'inherit', fontStyle: 'italic' },
  altSatir: { display: 'flex', alignItems: 'center', gap: 8 },
  mikBtn: { width: 52, height: 52, borderRadius: '50%', border: 'none', background: 'linear-gradient(145deg,#8b5cf6,#6d28d9)', color: '#fff', fontSize: 22, cursor: 'pointer', flexShrink: 0, boxShadow: '0 4px 14px rgba(109,40,217,.35)' },
  mikAktif: { background: 'linear-gradient(145deg,#ef4444,#b91c1c)', boxShadow: '0 0 0 6px rgba(239,68,68,.2)', fontSize: 18 },
  input: { flex: 1, minWidth: 0, boxSizing: 'border-box', border: '1.5px solid #ddd6fe', borderRadius: 12, padding: '11px 12px', fontSize: 15, outline: 'none', fontFamily: 'inherit', color: '#0f172a', background: '#fff' },
  gonderBtn: { border: 'none', borderRadius: 12, padding: '0 14px', background: '#6d28d9', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 },
};
