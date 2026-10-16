import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabase';
import { ARACLAR, YAZAN_ARACLAR, aracCalistir } from '../asistanAraclar';
import { Ikon } from '../ikonlar';

// Ana sayfadaki yapay zeka asistanı: normal bir sohbet gibi konuşur (yazarak ya da sesle),
// arkada uygulamanın tamamına hâkimdir. Yapay zekâ (Claude) hangi aracı kullanacağına kendi karar verir
// (müşteri ara, iş emri aç, hatırlatma kur, not ekle...). Onay sormaz; yaptığı her kaydın
// altında "Geri al" düğmesi çıkar. Silme yetkisi yoktur.
//
// Hız notları (13 Eki 2026):
//  - Bitmiş konuşmalar modele sadece "soru + cevap" metni olarak geri gider; araç sonuçları
//    (müşteri detayları vb.) her seferinde tekrar gönderilmez. Eskiden her mesajda geçmiş
//    büyüyor, 1-2 mesaj sonra hem yavaşlıyor hem dakikalık kotayı dolduruyordu.
//  - Geçmiş yüzünden hata olursa
//    sadece son soruyla bir kez daha denenir (sunucu yoğunlukta kendisi bir kez daha dener).
//  - Sesli okuma telefonun kendi sesiyle anında başlar (indirme yok, cızırtı yok, ses hep aynı).
const VAPID_PUBLIC = 'BJUQaPBgiZZBfiwUVprGm_uZvvPJyL1O8LRkSB7SA9-5ZteuaLGbskvnKIZ4cGfyd7oZq4Ye7Ge_edz6pfKfT6I';
const TUR_BITTI = 'hatirlatma-bitti';
const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

const yerel = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function veriCoz(mesaj) {
  try { return JSON.parse(mesaj || '{}'); } catch { return { baslik: mesaj || '' }; }
}

const kucuk = (x) => String(x || '').toLocaleLowerCase('tr-TR').trim();
const BITIR = /^(g[öo]r[üu][şs][üu]r[üu]z|kapat|bitir|sohbeti bitir|tamam bu kadar|bu kadar|ho[şs][çc]a kal|g[üu]le g[üu]le|ba[şs]ka bir [şs]ey yok)\b/;
const MAX_TUR = 5;          // bir mesajda en fazla kaç araç turu
const MAX_SOHBET = 10;      // modele hatırlatılan en fazla önceki soru-cevap sayısı

const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

function base64Uint8(b64) {
  const dolgu = '='.repeat((4 - (b64.length % 4)) % 4);
  const ham = atob((b64 + dolgu).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...ham].map((c) => c.charCodeAt(0)));
}

const pushDestek = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const iosMu = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
const yukluMu = () => typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);

// ------------------------------------------------------------ ses
// Tek ses kaynağı: telefonun kendi Türkçe sesi. İnternetten ses indirilmez, bu yüzden
//  - yazı çıktığı anda konuşmaya başlar (bekleme yok),
//  - ses dosyası bitişindeki cızırtı olmaz,
//  - oturum boyunca hep AYNI ses kullanılır (bir kez seçilip kilitlenir; erkek ses Cem tercih edilir).
// iPhone'da ses ancak bir dokunuştan sonra açılır: ilk dokunuşta sessiz bir söz söyletilir.
let sesKilidiAcik = false;
function sesKilidiAc() {
  if (sesKilidiAcik || typeof window === 'undefined' || !window.speechSynthesis) return;
  sesKilidiAcik = true;
  try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; window.speechSynthesis.speak(u); } catch { /* yok */ }
}

// Eray'ın tercihi: erkek ses "Cem". Telefonda Cem yoksa diğer Türkçe erkek sesler, o da yoksa herhangi bir Türkçe ses.
const ERKEK = /\b(cem|tolga|emre|ahmet|mehmet|male|erkek)\b/i;
let seciliSes = null;   // bir kez seçilince oturum boyunca değişmez
function sesSec() {
  if (seciliSes || typeof window === 'undefined' || !window.speechSynthesis) return seciliSes;
  const tr = window.speechSynthesis.getVoices().filter((v) => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith('tr'));
  if (!tr.length) return null;
  const kaliteli = (l) => l.find((v) => /premium|enhanced|geli[sş]mi[sş]|natural|neural/i.test(v.name));
  const cem = tr.filter((v) => /\bcem\b/i.test(v.name));
  const erkek = tr.filter((v) => ERKEK.test(v.name));
  seciliSes = kaliteli(cem) || cem[0] || kaliteli(erkek) || erkek[0] || kaliteli(tr) || tr[0];
  return seciliSes;
}
if (typeof window !== 'undefined' && window.speechSynthesis) {
  try { sesSec(); window.speechSynthesis.addEventListener?.('voiceschanged', sesSec); } catch { /* yok */ }
}

function sesiSustur() {
  try { window.speechSynthesis?.cancel(); } catch { /* yok */ }
}

// Uzun metni cümlelere böler (bazı tarayıcılar uzun konuşmayı yarıda kesiyor)
function cumleler(metin) {
  const parca = String(metin).replace(/\s+/g, ' ').match(/[^.!?…]+[.!?…]*/g) || [metin];
  const sonuc = [];
  for (const c of parca.map((x) => x.trim()).filter(Boolean)) {
    if (sonuc.length && (sonuc[sonuc.length - 1] + ' ' + c).length < 160) sonuc[sonuc.length - 1] += ' ' + c;
    else sonuc.push(c);
  }
  return sonuc;
}

// ------------------------------------------------------------ model
async function modelSor(sistem, contents, model) {
  let res;
  try {
    res = await fetch('/api/asistan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sistem, contents, tools: ARACLAR, model }),
      signal: AbortSignal.timeout ? AbortSignal.timeout(58000) : undefined,
    });
  } catch (e) {
    if (e?.name === 'TimeoutError' || e?.name === 'AbortError') throw Object.assign(new Error('Cevap çok gecikti. Tekrar dene.'), { kod: 'zaman' });
    throw Object.assign(new Error('Sunucuya ulaşılamadı. İnternet bağlantını kontrol et.'), { kod: 'ag' });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.hata || 'Sunucu hatası ' + res.status), { kod: data.kod || 'sunucu' });
  return data;
}

function sistemMetni(musteriler, ad, sesli) {
  const b = new Date();
  const bugun = `${yerel(b)} (${GUNLER[b.getDay()]}, ${b.getDate()} ${AYLAR[b.getMonth()]} ${b.getFullYear()})`;
  const ilkAd = String(ad || '').split(' ')[0];
  const hitap = /^volkan/i.test(ilkAd) ? 'Volkan abi' : ilkAd || 'ekip arkadaşım';
  const liste = musteriler.slice(0, 600).map((m) => `${m.id}|${m.name}`).join('\n') || '(henüz müşteri yok)';
  return `Sen ALKA Mekanik ve Havuz Sistemleri'nin asistanısın. ALKA, Çeşme/İzmir'de yazlık villalara havuz, kuyu pompası, hidrofor, sulama, tesisat ve elektrik bakım-servisi yapan bir firma. Bu uygulama firmanın iş takip sistemi; sen de içindeki verilere erişen bir çalışma arkadaşısın.
Konuştuğun kişi: ${ad || 'ekip üyesi'} (ona "${hitap}" de). Bugün: ${bugun}. Saat dilimi İstanbul.

UYGULAMADAKİ KAVRAMLAR
- Müşteri: villa sahibi ya da site (ad, telefon, adres/bölge: Alaçatı, Ilıca, Reisdere, Dalyan vb.).
- Cihaz: müşterideki ekipman (havuz pompası, kum filtresi, hidrofor, kuyu pompası, ısı pompası, pano, sulama).
- Bakım: cihazın periyodik bakımı; her bakımın bir sonraki tarihi var (gecikmiş / yaklaşan).
- İş emri: yapılacak somut iş (arıza, montaj, bakım ziyareti); durumu bekliyor / başladı / tamamlandı; işçilik ve tahsilat tutulur.
- Hatırlatma: tarihli hatırlatma, çoğunlukla ödeme/tahsilat ("X'in 20'sinde 30 bin ödemesi var"); tekrarlı olabilir.
- Not: ekibin ortak not defteri. Geliş: yazlıkçının villaya geliş tarihi; öncesinde hazırlık işi açılır.
- Araçların: genel_ozet (bugün/durum), musteri_ara, musteri_detay, is_emirleri, bakimlar, hatirlatmalar, gelisler, notlar; kayıt için musteri_ekle/guncelle, cihaz_ekle, hatirlatma_ekle/tamamla, is_emri_ac/guncelle, tahsilat_ekle, not_ekle, gelis_ekle.

NASIL KONUŞURSUN
- ${sesli ? 'Cevabın sesli okunuyor: EN FAZLA 1-2 KISA CÜMLE. Liste yok, giriş cümlesi yok, tekrar yok. Bir sayı ya da isim yeterliyse sadece onu söyle.' : 'Cevap ekranda okunuyor: kısa ve net; en fazla birkaç satır.'}
- "Tabii", "Hemen bakıyorum", "Merak etme" gibi dolgu sözler kullanma; doğrudan cevap ver.
- Markdown, yıldız, madde işareti, emoji yok. Tutarlar "30 bin lira", tarihler "20 Ekim Salı" gibi.
- Önceki konuşmayı bağlamdan anla ("onun telefonu", "aynısını Ahmet Bey'e de yap").
- Havuz kimyası, pompa, hidrofor, tesisat, elektrik gibi teknik sorulara araç kullanmadan pratik, kısa cevap ver.

SESLİ KOMUTLAR (ÖNEMLİ)
- Kullanıcının sözü telefonun ses tanımasıyla yazıya çevriliyor; kelimeler yanlış duyulmuş olabilir. İsimleri ve terimleri SESÇE en yakın anlama göre yorumla (ör. "hidro for" → hidrofor, "Köstek çi" → Köstekçi); müşteri adını listedeki en yakın isimle eşleştir.
- Cümle anlamsız, yarım ya da işle alakasız görünüyorsa TAHMİNLE İŞ YAPMA: "Tam anlayamadım, tekrar söyler misin?" de.
- Kayıt yapan işlerde (ekle/aç/tamamla) duyduğun isim listede yoksa ya da birden fazla adaya uyuyorsa önce kısaca sor.

UYGULAMAYA HÂKİMSİN
- Firma verisiyle ilgili her soruda araçları kullan; tahmin etme, uydurma. Bulamazsan "kayıtlarda yok" de.
- Bir şey yapmanı isterse ve bilgi yeterliyse ONAY SORMADAN yap, sonra tek cümleyle ne yaptığını söyle.
- Müşteri id'sini aşağıdaki listeden bul; emin değilsen musteri_ara kullan. Yeni müşteri eklemeden önce listede aynı kişi var mı bak.
- Tarih: "20'sinde" → bu ayın 20'si, geçtiyse gelecek ayın. "yarın", "cuma", "haftaya" bugüne göre. "30 bin" = 30000.
- Birden fazla iş istenirse hepsini yap; araçları mümkünse aynı turda birlikte çağır.
- Silme yetkin yok; silmek isterse ilgili sayfadan silebileceğini söyle.

MÜŞTERİ LİSTESİ (id|ad):
${liste}`;
}

// ------------------------------------------------------------ bileşen

export default function SesliAsistan({ ad, onDegisti }) {
  const [mesajlar, setMesajlar] = useState([]);
  const [dinliyor, setDinliyor] = useState(false);
  const [araMetin, setAraMetin] = useState('');
  const [yaziMetin, setYaziMetin] = useState('');
  const [dusunuyor, setDusunuyor] = useState(false);
  const [konusuyor, setKonusuyor] = useState(false);
  const [sesAcik, setSesAcik] = useState(() => { try { return localStorage.getItem('alkaAsistanSes') !== '0'; } catch { return true; } });
  const [hata, setHata] = useState('');
  const [bildirim, setBildirim] = useState('bilinmiyor'); // bilinmiyor | acik | kapali | desteklenmiyor
  const [bilgi, setBilgi] = useState('');
  const [hatirlatmalar, setHatirlatmalar] = useState([]);
  const [musteriler, setMusteriler] = useState([]);
  const [durumYazi, setDurumYazi] = useState('');
  const [sohbet, setSohbet] = useState(false);
  const tanima = useRef(null);
  const sonMetin = useRef('');
  const listeRef = useRef(null);
  const mesajRef = useRef([]);
  const gecmisRef = useRef([]);   // önceki soru-cevaplar (sadece metin)
  const notRef = useRef('');      // bir sonraki mesaja eklenecek bilgi (örn. geri alınan işlem)
  const sohbetRef = useRef(false);
  const dinleRef = useRef(null);
  const sozRef = useRef(null);
  const hataSayac = useRef(0);
  const sessizSayac = useRef(0);   // sohbette art arda kaç kez ses gelmedi
  const mesgulRef = useRef(false);

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
      setBilgi('Bildirimler açık. Her gün 10:00 ve 21:00\'de o günün hatırlatmaları gelecek. Bir deneme bildirimi gönderildi.');
    } catch (e) {
      setHata('Bildirim açılamadı: ' + (e?.message || e));
    }
  }

  useEffect(() => {
    if (listeRef.current) listeRef.current.scrollTop = listeRef.current.scrollHeight;
  }, [mesajlar, dusunuyor, araMetin]);

  useEffect(() => () => {
    try { tanima.current?.abort(); } catch { /* yok */ }
    sesiSustur();
  }, []);

  // Sohbet modunda: konuşma bitince mikrofonu kendiliğinden tekrar aç
  function sonraDinle() {
    setKonusuyor(false);
    if (!sohbetRef.current) return;
    setTimeout(() => { if (sohbetRef.current && dinleRef.current) dinleRef.current(true); }, 300);
  }

  // Sesle sorulan soruya her zaman sesli cevap verilir; yazıyla sorulanda hoparlör düğmesine bakılır.
  function konus(metin, zorla) {
    const ss = typeof window !== 'undefined' ? window.speechSynthesis : null;
    if ((!sesAcik && !zorla) || !metin || !ss) { sonraDinle(); return; }
    setKonusuyor(true);
    try {
      ss.cancel();
      const ses = sesSec();
      const liste = cumleler(metin);
      let bitti = false;
      const devam = () => { if (bitti) return; bitti = true; sonraDinle(); };
      // Bazı telefonlarda "bitti" olayı gelmiyor: tahmini süre dolunca yine de devam et
      const emniyet = setTimeout(devam, Math.min(60000, 2000 + metin.length * 90));
      liste.forEach((c, k) => {
        const u = new SpeechSynthesisUtterance(c);
        u.lang = 'tr-TR';
        if (ses) u.voice = ses;
        u.rate = 1.02;
        u.pitch = 1;
        if (k === liste.length - 1) {
          u.onend = () => { clearTimeout(emniyet); devam(); };
          u.onerror = () => { clearTimeout(emniyet); devam(); };
        }
        sozRef.current = u; // Chrome konuşmayı yarıda unutmasın
        ss.speak(u);
      });
    } catch { sonraDinle(); }
  }

  function sohbetBaslat() {
    sesKilidiAc();
    setHata(''); setBilgi('');
    hataSayac.current = 0;
    sessizSayac.current = 0;
    sohbetRef.current = true;
    setSohbet(true);
    // Uzun selamlama yok: direkt dinlemeye geçer
    const isim = String(ad || '').split(' ')[0];
    asistanDer(`Buyur${isim ? ' ' + isim : ''}, dinliyorum.`);
  }

  function sohbetBitir(sesli) {
    sohbetRef.current = false;
    setSohbet(false);
    try { tanima.current?.abort(); } catch { /* yok */ }
    if (sesli) {
      const isim = String(ad || '').split(' ')[0];
      asistanDer(`Görüşürüz${isim ? ' ' + isim : ''}.`);
    } else {
      sesiSustur();
      setKonusuyor(false);
    }
  }

  function ekle(kim, yazi, ek = {}) {
    setMesajlar((l) => [...l, { kim, yazi, ...ek }].slice(-30));
  }

  function asistanDer(yazi, ek, sesli) {
    ekle('asistan', yazi, ek);
    konus(yazi, sesli || sohbetRef.current);
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

  // Bir soruyu araç turlarıyla birlikte çözer; sadece metin cevabı ve yapılan işlemleri döndürür.
  async function coz(sistem, onceki, soru, eylemler) {
    let gecmis = [...onceki, { role: 'user', parts: [{ text: soru }] }];
    let model;
    for (let tur = 0; tur < MAX_TUR; tur++) {
      const r = await modelSor(sistem, gecmis, model);
      model = r.model; // araç turunun devamı aynı modelde kalsın
      const icerik = r.icerik && Array.isArray(r.icerik.parts) ? r.icerik : { role: 'model', parts: [{ text: r.metin || '' }] };
      gecmis = [...gecmis, icerik];
      const cagrilar = icerik.parts.filter((p) => p.functionCall);
      if (!cagrilar.length) return String(r.metin || '').trim();
      const yazar = cagrilar.some((p) => YAZAN_ARACLAR.has(p.functionCall.name));
      setDurumYazi(yazar ? 'Kaydediyorum' : 'Kayıtlara bakıyorum');
      const sonuclar = yazar
        ? await cagrilar.reduce(async (o, p) => [...(await o), await aracCalistir(p.functionCall.name, p.functionCall.args, { ad })], Promise.resolve([]))
        : await Promise.all(cagrilar.map((p) => aracCalistir(p.functionCall.name, p.functionCall.args, { ad })));
      const cevaplar = cagrilar.map((p, k) => {
        const { name, id } = p.functionCall, sonuc = sonuclar[k];
        if (sonuc.geriAl) eylemler.push({ yazi: sonuc.eylem || name, geriAl: sonuc.geriAl, durum: '' });
        return { functionResponse: { ...(id ? { id } : {}), name, response: { sonuc: sonuc.sonuc } } };
      });
      gecmis = [...gecmis, { role: 'user', parts: cevaplar }];
      setDurumYazi('Cevabı hazırlıyorum');
    }
    return '';
  }

  async function gonder(metin, sesle = false) {
    const t = String(metin || '').trim();
    if (!t || mesgulRef.current) return;
    setHata('');
    ekle('ben', t, sesle ? { sesle: true } : {});

    if (sohbetRef.current && BITIR.test(kucuk(t))) { sohbetBitir(true); return; }

    mesgulRef.current = true;
    setDusunuyor(true);
    setDurumYazi('Düşünüyorum');
    const eylemler = [];
    const soru = notRef.current + t;
    notRef.current = '';
    try {
      const sistem = sistemMetni(musteriler, ad, sohbetRef.current);
      let son;
      try {
        son = await coz(sistem, gecmisRef.current, soru, eylemler);
      } catch (e) {
        // Geçmiş yüzünden reddedildiyse (ya da geçici hata) ve henüz kayıt yapılmadıysa: geçmişsiz bir kez daha dene
        if (eylemler.length || !['istek', 'zaman', 'sunucu'].includes(e.kod)) throw e;
        gecmisRef.current = [];
        son = await coz(sistem, [], soru, eylemler);
      }
      if (!son) son = eylemler.length ? 'Tamam, hallettim.' : 'Anlayamadım, tekrar söyler misin?';
      // Sonraki mesajlar için sadece soru + cevap metnini sakla (hızlı ve hafif)
      gecmisRef.current = [...gecmisRef.current,
        { role: 'user', parts: [{ text: soru }] },
        { role: 'model', parts: [{ text: son + (eylemler.length ? ` [Yapılanlar: ${eylemler.map((x) => x.yazi).join('; ')}]` : '') }] },
      ].slice(-MAX_SOHBET * 2);
      hataSayac.current = 0;
      asistanDer(son, eylemler.length ? { eylemler } : {}, sesle);
      if (eylemler.length) { await veriYukle(); onDegisti && onDegisti(); }
    } catch (e) {
      if (eylemler.length) ekle('asistan', 'İşlem yarıda kaldı ama şunları yaptım:', { eylemler });
      setHata(e?.message || 'Bir hata oldu, tekrar dene.');
      hataSayac.current += 1;
      if (sohbetRef.current) {
        if (hataSayac.current >= 2) { sohbetRef.current = false; setSohbet(false); }
        else konus('Bir aksilik oldu, tekrar söyler misin?', true);
      }
    } finally {
      mesgulRef.current = false;
      setDusunuyor(false);
      setDurumYazi('');
    }
  }

  function dinle(otomatik) {
    if (!otomatik) sesKilidiAc();
    if (otomatik && (dinliyor || tanima.current?._aktif)) return;
    if (!SR) { setHata('Bu tarayıcı sesli komutu desteklemiyor. Chrome veya Safari kullan, ya da yazarak sor.'); return; }
    if (tanima.current?._aktif) { try { tanima.current.stop(); } catch { /* yok */ } return; }
    sesiSustur();
    setKonusuyor(false);
    setHata('');
    const r = new SR();
    r.lang = 'tr-TR';
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    sonMetin.current = '';
    // Telefonun kendi "konuşma bitti" algısı geç kalabiliyor: söz kesildikten ~1.2 sn sonra biz bitiriyoruz
    let susmaZamani = null;
    const susmaBekle = (ms) => { clearTimeout(susmaZamani); susmaZamani = setTimeout(() => { try { r.stop(); } catch { /* yok */ } }, ms); };
    r.onresult = (e) => {
      let metin = '';
      let tamam = true;
      for (let i = 0; i < e.results.length; i++) { metin += e.results[i][0].transcript; if (!e.results[i].isFinal) tamam = false; }
      sonMetin.current = metin;
      setAraMetin(metin);
      if (metin.trim()) susmaBekle(tamam ? 700 : 1200);
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { setHata('Mikrofon izni verilmedi. Tarayıcı ayarlarından bu siteye mikrofon izni ver.'); sohbetRef.current = false; setSohbet(false); }
      else if (e.error === 'no-speech') {
        if (sohbetRef.current) sessizSayac.current += 1;   // sohbette sessizlik normal: onend tekrar dinler
        else setHata('Ses duyulmadı, tekrar dene.');
      }
      else if (e.error !== 'aborted') setHata('Ses tanıma hatası: ' + e.error);
    };
    r.onend = () => {
      clearTimeout(susmaZamani);
      r._aktif = false;
      setDinliyor(false);
      setAraMetin('');
      const m = sonMetin.current;
      sonMetin.current = '';
      if (m.trim()) { sessizSayac.current = 0; gonder(m, true); return; }
      // Sohbetteyken hiçbir şey söylenmediyse bir süre daha dinlemeye devam et (yaklaşık yarım dakika)
      if (sohbetRef.current) {
        if (sessizSayac.current < 4) setTimeout(() => { if (sohbetRef.current && dinleRef.current) dinleRef.current(true); }, 250);
        else { sohbetBitir(false); setBilgi('Bir süredir ses gelmedi, sohbeti kapattım. Devam etmek için tekrar Konuş\'a bas.'); }
      }
    };
    tanima.current = r;
    r._aktif = true;
    setDinliyor(true);
    try { r.start(); } catch { r._aktif = false; setDinliyor(false); }
  }

  function kureDokun() {
    if (!sohbetRef.current) { sohbetBaslat(); return; }
    if (konusuyor) { sesiSustur(); setKonusuyor(false); sessizSayac.current = 0; setTimeout(() => dinle(true), 150); return; }
    if (dinliyor) { try { tanima.current?.stop(); } catch { /* yok */ } }
  }

  function sesDegis() {
    const yeni = !sesAcik;
    setSesAcik(yeni);
    try { localStorage.setItem('alkaAsistanSes', yeni ? '1' : '0'); } catch { /* yok */ }
    if (!yeni) { sesiSustur(); setKonusuyor(false); }
  }

  function yaziGonder(e) {
    e.preventDefault();
    sesKilidiAc();
    const t = yaziMetin;
    setYaziMetin('');
    gonder(t);
  }

  dinleRef.current = dinle;
  const durum = dinliyor ? 'dinliyor' : dusunuyor ? 'dusunuyor' : konusuyor ? 'konusuyor' : 'hazir';
  const yaziVar = yaziMetin.trim().length > 0;

  const sohbetYazi = dinliyor ? (araMetin || 'Dinliyorum…') : dusunuyor ? `${durumYazi || 'Düşünüyorum'}…` : konusuyor ? 'Konuşuyorum…' : 'Hazırım';
  const sohbetIpucu = dinliyor ? 'Konuş, bitince ben cevap veririm' : konusuyor ? 'Sözümü kesmek için küreye dokun' : dusunuyor ? '' : 'Konuşmak için küreye dokun';

  return (
    <section style={s.kart} aria-label="Yapay zeka asistanı">
      <style>{ASISTAN_CSS}</style>

      <div style={s.ust}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.baslik}>Asistan</div>
          <div style={s.durum} aria-live="polite">
            {sohbet ? 'Sesli sohbet açık' : dusunuyor ? `${durumYazi || 'Düşünüyorum'}…` : 'Sor, söyle, kaydetsin'}
          </div>
        </div>
        <button className="as-ikonbtn" style={s.ikonBtn} onClick={sesDegis}
          title={sesAcik ? 'Yazılı cevapları sesli okuma: açık' : 'Yazılı cevapları sesli okuma: kapalı'}
          aria-label={sesAcik ? 'Sesli okumayı kapat' : 'Sesli okumayı aç'}>
          <Ikon ad={sesAcik ? 'sesAcik' : 'sesKapali'} boyut={18} renk={sesAcik ? '#0b2a4a' : '#94a3b8'} />
        </button>
      </div>

      {sohbet ? (
        <div style={s.sohbetAlan}>
          <button type="button" className="as-kurebtn" onClick={kureDokun} aria-label={konusuyor ? 'Sözünü kes ve dinle' : 'Konuş'} style={s.kureBtn}>
            <Kure durum={durum} boyut={112} buyuk />
            <span style={s.kureMik}><Ikon ad="mikrofon" boyut={30} renk="#fff" kalin={2} /></span>
          </button>
          <div style={s.sohbetDurum} aria-live="polite">{sohbetYazi}</div>
          {sohbetIpucu && <div style={s.sohbetIpucu}>{sohbetIpucu}</div>}
          <button className="as-bitir" style={s.bitirBtn} onClick={() => sohbetBitir(false)}>
            <Ikon ad="kapat" boyut={15} kalin={2.4} /> Bitir
          </button>
        </div>
      ) : SR ? (
        <button type="button" className="as-konus" style={s.konusBtn} onClick={sohbetBaslat} disabled={dusunuyor}>
          <span style={s.konusKure}><Kure durum="hazir" boyut={46} /></span>
          <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <span style={s.konusBaslik}>Konuş</span>
            <span style={s.konusAlt}>Bir kez bas, karşılıklı konuşalım</span>
          </span>
          <Ikon ad="mikrofon" boyut={22} renk="#fff" kalin={2.2} />
        </button>
      ) : null}

      {bilgi && <div style={s.bilgi}>{bilgi}</div>}

      {mesajlar.length > 0 && (
        <div ref={listeRef} style={s.liste}>
          {mesajlar.map((m, i) => (
            <div key={i} className="as-giris" style={{ display: 'flex', flexDirection: 'column', alignItems: m.kim === 'ben' ? 'flex-end' : 'flex-start', gap: 6 }}>
              {m.sesle && (
                <div style={s.duyulan}><Ikon ad="mikrofon" boyut={12} renk="#64748b" kalin={2.2} /> Duyduğum</div>
              )}
              <div style={m.kim === 'ben' ? s.benBalon : s.asBalon}>{m.yazi}</div>
              {(m.eylemler || []).map((e, j) => {
                const geri = e.durum === 'geri alındı';
                return (
                  <div key={j} style={{ ...s.eylem, ...(geri ? s.eylemGeri : {}) }}>
                    <Ikon ad={geri ? 'geriAl' : 'tik'} boyut={15} renk={geri ? '#94a3b8' : '#15803d'} kalin={2.3} />
                    <span style={{ flex: 1, minWidth: 0, textDecoration: geri ? 'line-through' : 'none' }}>{e.yazi}</span>
                    {geri
                      ? <span style={s.eylemNot}>Geri alındı</span>
                      : <button className="as-geri" style={s.geriBtn} disabled={e.durum === 'bekliyor'} onClick={() => geriAl(i, j)}>{e.durum === 'bekliyor' ? 'Bekle…' : 'Geri al'}</button>}
                  </div>
                );
              })}
            </div>
          ))}
          {dusunuyor && !sohbet && (
            <div style={s.yaziyor} aria-label={durumYazi || 'Düşünüyorum'}>
              <span className="as-dot" /><span className="as-dot" /><span className="as-dot" />
            </div>
          )}
        </div>
      )}

      {hata && (
        <div style={s.hata} role="alert">
          <span style={{ flex: 1 }}>{hata}</span>
          <button style={s.hataKapat} onClick={() => setHata('')} aria-label="Kapat"><Ikon ad="kapat" boyut={15} renk="#b91c1c" /></button>
        </div>
      )}

      {!sohbet && (
        <form onSubmit={yaziGonder} style={s.yazmaAlan} className="as-yazma">
          <input
            style={s.input}
            value={yaziMetin}
            onChange={(e) => setYaziMetin(e.target.value)}
            placeholder="veya buraya yaz…"
            disabled={dusunuyor}
            aria-label="Asistana yaz"
            enterKeyHint="send"
          />
          {yaziVar && (
            <button type="submit" className="as-anabtn" style={s.anaBtn} disabled={dusunuyor} aria-label="Gönder">
              <Ikon ad="yukari" boyut={18} renk="#fff" kalin={2.5} />
            </button>
          )}
        </form>
      )}

      {!sohbet && bildirim === 'kapali' && (
        <button className="as-link" style={s.bildirimLink} onClick={bildirimAc}>
          <Ikon ad="zil" boyut={14} renk="#2563eb" /> Hatırlatmalar telefonuma bildirim olarak gelsin
        </button>
      )}
    </section>
  );
}

// Havuz suyu küresi: sadece asistan bir şey yaparken hareket eder (dinliyor / düşünüyor / konuşuyor)
function Kure({ durum, boyut, buyuk }) {
  return (
    <span className={`as-kure as-${durum}${buyuk ? ' as-buyuk' : ''}`} style={{ width: boyut, height: boyut }} aria-hidden="true">
      <span className="as-su" />
      <span className="as-isik" />
      {!buyuk && <span className="as-simge"><Ikon ad="parilti" boyut={Math.round(boyut * 0.44)} renk="#fff" kalin={1.8} /></span>}
    </span>
  );
}

const ASISTAN_CSS = `
.as-kure{position:relative;flex-shrink:0;border-radius:50%;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;
  background:radial-gradient(circle at 30% 25%,#7dd3fc 0%,#0ea5e9 38%,#1d4ed8 72%,#0b2a4a 100%);
  box-shadow:inset 0 -6px 14px rgba(11,42,74,.45),0 6px 16px rgba(14,116,184,.28)}
.as-su{position:absolute;inset:-40%;background:
  radial-gradient(closest-side,rgba(255,255,255,.35),transparent 70%) 20% 30%/45% 45% no-repeat,
  radial-gradient(closest-side,rgba(186,230,253,.45),transparent 70%) 70% 65%/55% 55% no-repeat;opacity:.55}
.as-isik{position:absolute;top:10%;left:18%;width:34%;height:22%;border-radius:50%;background:rgba(255,255,255,.55);filter:blur(3px)}
.as-simge{position:relative;display:inline-flex}
.as-dinliyor{box-shadow:inset 0 -6px 14px rgba(11,42,74,.45),0 0 0 0 rgba(14,165,233,.5);animation:as-nabiz 1.4s ease-out infinite}
.as-dinliyor .as-su,.as-konusuyor .as-su{animation:as-dalga 2.6s linear infinite;opacity:.9}
.as-dusunuyor .as-su{animation:as-dalga 1.2s linear infinite;opacity:.9}
.as-konusuyor{animation:as-soluk 1s ease-in-out infinite}
.as-buyuk{box-shadow:inset 0 -14px 30px rgba(11,42,74,.5),0 14px 34px rgba(14,116,184,.35)}
@keyframes as-dalga{to{transform:rotate(360deg)}}
@keyframes as-nabiz{0%{box-shadow:inset 0 -6px 14px rgba(11,42,74,.45),0 0 0 0 rgba(14,165,233,.45)}100%{box-shadow:inset 0 -6px 14px rgba(11,42,74,.45),0 0 0 16px rgba(14,165,233,0)}}
@keyframes as-soluk{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
.as-nokta{display:inline-block;width:6px;height:6px;border-radius:50%;background:#0ea5e9;margin-left:7px;vertical-align:1px;animation:as-yanip 1s ease-in-out infinite}
@keyframes as-yanip{50%{opacity:.25}}
.as-dot{width:7px;height:7px;border-radius:50%;background:#94a3b8;display:inline-block;margin-right:4px;animation:as-zipla 1.1s ease-in-out infinite}
.as-dot:nth-child(2){animation-delay:.15s}.as-dot:nth-child(3){animation-delay:.3s}
@keyframes as-zipla{0%,60%,100%{transform:translateY(0);opacity:.5}30%{transform:translateY(-4px);opacity:1}}
.as-giris{animation:as-gir .22s ease-out}
@keyframes as-gir{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.as-ikonbtn:hover{background:#f1f5f9!important}
.as-ornek:hover{border-color:#bfdbfe!important;background:#f8fbff!important}
.as-anabtn:hover:not(:disabled){filter:brightness(1.08)}
.as-anabtn:disabled{opacity:.5;cursor:default}
.as-konus:hover:not(:disabled){filter:brightness(1.08)}
.as-konus:disabled{opacity:.6;cursor:default}
.as-konus:active,.as-kurebtn:active{transform:scale(.98)}
.as-yazma:focus-within{border-color:#93c5fd!important;box-shadow:0 0 0 3px rgba(59,130,246,.15)}
.as-kure+div,.as-geri,.as-bitir{font-family:inherit}
section[aria-label="Yapay zeka asistanı"] button:focus-visible{outline:2px solid #2563eb;outline-offset:2px}
@media (prefers-reduced-motion:reduce){.as-kure,.as-su,.as-dot,.as-nokta,.as-giris{animation:none!important}}
`;

const golge = '0 1px 2px rgba(16,24,40,.04), 0 8px 24px rgba(11,42,74,.07)';
const s = {
  kart: { background: '#fff', borderRadius: 22, padding: 16, boxShadow: golge, border: '1px solid #e6ecf3', margin: '12px 0', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" },
  ust: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 },
  baslik: { fontSize: 16.5, fontWeight: 800, color: '#0b1730', letterSpacing: -0.2 },
  durum: { fontSize: 12.5, color: '#64748b', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  ikonBtn: { width: 36, height: 36, borderRadius: 11, border: '1px solid #e6ecf3', background: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, padding: 0 },
  duyulan: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 600, color: '#64748b', marginBottom: -2 },
  konusBtn: { display: 'flex', alignItems: 'center', gap: 14, width: '100%', border: 'none', borderRadius: 20, padding: '12px 18px 12px 12px', marginBottom: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#fff', background: 'linear-gradient(135deg,#0b2a4a 0%,#123e6b 60%,#1d4ed8 140%)', boxShadow: '0 10px 24px rgba(11,42,74,.28)' },
  konusKure: { display: 'inline-flex', flexShrink: 0 },
  konusBaslik: { display: 'block', fontSize: 18, fontWeight: 800, letterSpacing: -0.2 },
  konusAlt: { display: 'block', fontSize: 13, opacity: 0.8, marginTop: 2 },
  kureBtn: { position: 'relative', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', borderRadius: '50%', display: 'inline-flex' },
  kureMik: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', opacity: 0.9 },
  sohbetIpucu: { fontSize: 12.5, color: '#64748b', marginTop: -4 },
  bildirimLink: { display: 'flex', alignItems: 'center', gap: 6, margin: '10px auto 0', border: 'none', background: 'transparent', color: '#2563eb', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 4 },
  sohbetAlan: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '22px 8px 16px', marginBottom: 12, borderRadius: 18, background: 'linear-gradient(180deg,#f0f7ff,#ffffff)', border: '1px solid #e0ecfa' },
  sohbetDurum: { fontSize: 15, fontWeight: 600, color: '#0b1730', textAlign: 'center', minHeight: 22, maxWidth: '100%', padding: '0 8px', lineHeight: 1.4 },
  bitirBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #fecaca', background: '#fff', color: '#b91c1c', borderRadius: 999, padding: '9px 16px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' },
  bilgi: { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', borderRadius: 12, padding: '9px 11px', fontSize: 13, margin: '0 0 10px', lineHeight: 1.45 },
  liste: { maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, padding: '2px 2px 12px', overscrollBehavior: 'contain' },
  benBalon: { background: '#0b2a4a', color: '#fff', borderRadius: '18px 18px 6px 18px', padding: '10px 13px', fontSize: 14.5, maxWidth: '84%', lineHeight: 1.45, wordBreak: 'break-word' },
  asBalon: { background: '#f1f5f9', color: '#0b1730', borderRadius: '18px 18px 18px 6px', padding: '10px 13px', fontSize: 14.5, maxWidth: '88%', lineHeight: 1.5, wordBreak: 'break-word', whiteSpace: 'pre-wrap' },
  yaziyor: { display: 'flex', alignItems: 'center', alignSelf: 'flex-start', background: '#f1f5f9', borderRadius: '18px 18px 18px 6px', padding: '11px 14px' },
  eylem: { display: 'flex', alignItems: 'center', gap: 8, maxWidth: '92%', background: '#f0fdf4', border: '1px solid #dcfce7', color: '#14532d', borderRadius: 12, padding: '6px 6px 6px 10px', fontSize: 13, fontWeight: 600, lineHeight: 1.35 },
  eylemGeri: { background: '#f8fafc', borderColor: '#e2e8f0', color: '#94a3b8' },
  eylemNot: { fontSize: 12, fontWeight: 600, color: '#94a3b8', whiteSpace: 'nowrap', paddingRight: 4 },
  geriBtn: { border: 'none', background: '#fff', color: '#15803d', borderRadius: 8, padding: '5px 10px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, boxShadow: '0 0 0 1px #bbf7d0' },
  hata: { display: 'flex', alignItems: 'flex-start', gap: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 12, padding: '9px 8px 9px 11px', fontSize: 13, margin: '0 0 10px', lineHeight: 1.45, wordBreak: 'break-word' },
  hataKapat: { border: 'none', background: 'transparent', padding: 2, cursor: 'pointer', flexShrink: 0 },
  ornekler: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 },
  ornek: { display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', border: '1px solid #e6ecf3', background: '#fff', borderRadius: 14, padding: '11px 12px', fontSize: 14, color: '#1e293b', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 },
  yazmaAlan: { display: 'flex', alignItems: 'center', gap: 6, background: '#f6f8fb', border: '1px solid #e2e8f0', borderRadius: 999, padding: '5px 5px 5px 16px', transition: 'border-color .15s, box-shadow .15s' },
  input: { flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 16, padding: '9px 0', fontFamily: 'inherit', color: '#0f172a' },
  anaBtn: { width: 42, height: 42, borderRadius: '50%', border: 'none', background: '#0b2a4a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, padding: 0 },
  anaBtnAktif: { background: '#dc2626', boxShadow: '0 0 0 5px rgba(220,38,38,.15)' },
  sohbetBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', marginTop: 10, border: 'none', background: '#f1f5f9', color: '#0b2a4a', borderRadius: 14, padding: '11px 12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
};
