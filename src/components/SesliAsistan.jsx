import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabase';
import { ARACLAR, YAZAN_ARACLAR, aracCalistir } from '../asistanAraclar';
import { Ikon } from '../ikonlar';

// Ana sayfadaki yapay zeka asistanı: normal bir sohbet gibi konuşur (yazarak ya da sesle),
// arkada uygulamanın tamamına hâkimdir. Gemini hangi aracı kullanacağına kendi karar verir
// (müşteri ara, iş emri aç, hatırlatma kur, not ekle...). Onay sormaz; yaptığı her kaydın
// altında "Geri al" düğmesi çıkar. Silme yetkisi yoktur.
//
// Hız notları (13 Eki 2026):
//  - Bitmiş konuşmalar modele sadece "soru + cevap" metni olarak geri gider; araç sonuçları
//    (müşteri detayları vb.) her seferinde tekrar gönderilmez. Eskiden her mesajda geçmiş
//    büyüyor, 1-2 mesaj sonra hem yavaşlıyor hem dakikalık kotayı dolduruyordu.
//  - Sunucu kota dolunca kendiliğinden başka modele geçer; geçmiş yüzünden hata olursa
//    sadece son soruyla bir kez daha denenir.
//  - Sesli okuma cevabı bekletmez; ses gelmezse en geç 10 sn'de telefonun kendi sesine geçer.
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
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------ ses
// iPhone/Android: ses ancak kullanıcı dokunuşuyla açılır; ilk dokunuşta sessiz bir çalma ile kilidi aç.
const SESSIZ = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
const oynatici = typeof Audio !== 'undefined' ? new Audio() : null;
let sesKilidiAcik = false;
function sesKilidiAc() {
  if (sesKilidiAcik || typeof window === 'undefined') return;
  sesKilidiAcik = true;
  try { if (window.speechSynthesis) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; window.speechSynthesis.speak(u); } } catch { /* yok */ }
  try { if (oynatici) { oynatici.src = SESSIZ; oynatici.play().catch(() => {}); } } catch { /* yok */ }
}
// Doğal ses arka arkaya 3 kez gelmezse (ör. kota) bu oturumda hep telefonun sesiyle devam edilir;
// böylece ses tonu cümleden cümleye gidip gelmez.
let dogalSesBozuk = false;
let sesHataSayac = 0;
let sesSira = 0;
// Doğal sesle oku; bitince döner. Ses alınamazsa false döner (telefonun kendi sesi kullanılır).
async function dogalSesle(metin) {
  if (!oynatici || dogalSesBozuk) return false;
  const benim = ++sesSira;
  let url;
  try {
    const r = await fetch('/api/ses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ metin }),
      signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined,
    });
    if (!r.ok) throw new Error('ses ' + r.status);
    url = URL.createObjectURL(await r.blob());
    sesHataSayac = 0;
  } catch {
    sesHataSayac += 1;
    if (sesHataSayac >= 3) dogalSesBozuk = true;
    return benim !== sesSira; // bu arada başka konuşma başladıysa sorun yok
  }
  if (benim !== sesSira) { URL.revokeObjectURL(url); return true; }
  try {
    try { window.speechSynthesis?.cancel(); } catch { /* yok */ }
    oynatici.pause();
    oynatici.src = url;
    // Bazı telefonlarda play() hiç cevap vermeyebiliyor: 4 sn'de vazgeç
    await Promise.race([oynatici.play(), bekle(4000).then(() => { throw new Error('play'); })]);
    await new Promise((bitti) => {
      const son = () => { oynatici.onended = null; oynatici.onerror = null; bitti(); };
      oynatici.onended = son; oynatici.onerror = son;
      setTimeout(son, Math.min(60000, 2500 + metin.length * 110));
    });
    return true;
  } catch {
    return benim !== sesSira;
  } finally {
    URL.revokeObjectURL(url);
  }
}
function sesiSustur() {
  sesSira++;
  try { oynatici?.pause(); } catch { /* yok */ }
  try { window.speechSynthesis?.cancel(); } catch { /* yok */ }
}
function enIyiTrSes() {
  const tr = (window.speechSynthesis?.getVoices() || []).filter((v) => v.lang && v.lang.toLowerCase().startsWith('tr'));
  return tr.find((v) => /premium|enhanced|geli[sş]mi[sş]|natural|neural|google/i.test(v.name)) || tr.find((v) => /yelda|cem/i.test(v.name)) || tr[0] || null;
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
  return `Sen ALKA Mekanik ve Havuz Sistemleri'nin yapay zeka asistanısın. Çeşme/İzmir'de havuz, kuyu, hidrofor, sulama, tesisat ve elektrik servisi veren bir firma; yazlık villalara bakım ve servis yapıyor.
Konuştuğun kişi: ${ad || 'ekip üyesi'} (ona "${hitap}" diye hitap et). Bugün: ${bugun}. Saat dilimi İstanbul.

NASIL KONUŞURSUN
- İşi bilen bir çalışma arkadaşı gibi kısa, doğal, samimi Türkçe.
- ${sesli ? 'Cevapların sesli okunuyor: 1-2 cümle, liste yapma.' : 'Cevaplar ekranda okunuyor: kısa ve net, gerekirse satır satır.'}
- Markdown, yıldız, madde işareti, emoji kullanma. Tutarları "30 bin lira", tarihleri "20 Ekim Salı" gibi söyle.
- Önceki konuşmayı bağlamdan anla ("onun telefonu", "aynısını Ahmet Bey'e de yap").
- Havuz kimyası, pompa, hidrofor, tesisat, elektrik, müşteri mesajı taslağı gibi genel sorulara araç kullanmadan pratik cevap ver.

UYGULAMAYA HÂKİMSİN
- Firmanın verileriyle ilgili her soruda araçları kullan; tahmin etme, uydurma. Bulamazsan "kayıtlarda yok" de.
- Bir şey yapmanı isterse (müşteri ekle, hatırlatma kur, iş emri aç, ödeme işle, not al, geliş kaydet) bilgi yeterliyse ONAY SORMADAN hemen yap, sonra ne yaptığını tek cümleyle söyle.
- Sadece gerçekten eksik bilgi varsa sor (tarih hiç yok, aynı isimde iki müşteri var gibi).
- Müşteri id'sini aşağıdaki listeden bul; emin değilsen musteri_ara aracını kullan. Yeni müşteri eklemeden önce listede aynı kişi var mı bak.
- Tarih: "20'sinde" → bu ayın 20'si, geçtiyse gelecek ayın. "yarın", "cuma", "haftaya" bugüne göre. "30 bin" = 30000.
- Birden fazla iş istenirse hepsini yap; mümkünse araçları aynı turda birlikte çağır.
- Silme yetkin yok; silmek isterse ilgili sayfadan silebileceğini söyle.

MÜŞTERİ LİSTESİ (id|ad):
${liste}`;
}

// ------------------------------------------------------------ bileşen
const ORNEKLER = [
  { ik: 'pano', yazi: 'Bugün ne var?' },
  { ik: 'takvim', yazi: 'Bu hafta bakımı gelen müşteriler kim?' },
  { ik: 'zil', yazi: 'İhsan Köstekçi\'nin 20\'sinde 30 bin TL ödemesi var' },
];

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

  async function konus(metin) {
    if (!sesAcik || !metin || typeof window === 'undefined') { sonraDinle(); return; }
    setKonusuyor(true);
    if (await dogalSesle(metin)) { sonraDinle(); return; }
    if (!window.speechSynthesis) { sonraDinle(); return; }
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(metin);
      u.lang = 'tr-TR';
      const ses = enIyiTrSes();
      if (ses) u.voice = ses;
      u.rate = 1.05;
      let bitti = false;
      const devam = () => { if (bitti) return; bitti = true; sonraDinle(); };
      u.onend = devam;
      u.onerror = devam;
      setTimeout(devam, Math.min(45000, 1500 + metin.length * 85));
      sozRef.current = u;
      window.speechSynthesis.speak(u);
    } catch { sonraDinle(); }
  }

  function sohbetBaslat() {
    sesKilidiAc();
    setHata(''); setBilgi('');
    hataSayac.current = 0;
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
      sesiSustur();
      setKonusuyor(false);
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

  async function gonder(metin) {
    const t = String(metin || '').trim();
    if (!t || mesgulRef.current) return;
    setHata('');
    ekle('ben', t);

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
      asistanDer(son, eylemler.length ? { eylemler } : {});
      if (eylemler.length) { await veriYukle(); onDegisti && onDegisti(); }
    } catch (e) {
      if (eylemler.length) ekle('asistan', 'İşlem yarıda kaldı ama şunları yaptım:', { eylemler });
      setHata(e?.message || 'Bir hata oldu, tekrar dene.');
      hataSayac.current += 1;
      if (sohbetRef.current) {
        if (hataSayac.current >= 2) { sohbetRef.current = false; setSohbet(false); }
        else konus('Bir aksilik oldu, tekrar söyler misin?');
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
    r.onresult = (e) => {
      let metin = '';
      for (let i = 0; i < e.results.length; i++) metin += e.results[i][0].transcript;
      sonMetin.current = metin;
      setAraMetin(metin);
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { setHata('Mikrofon izni verilmedi. Tarayıcı ayarlarından bu siteye mikrofon izni ver.'); sohbetRef.current = false; setSohbet(false); }
      else if (e.error === 'no-speech') {
        if (sohbetRef.current) { sohbetRef.current = false; setSohbet(false); setBilgi('Bir süre ses gelmedi, sesli sohbeti durdurdum.'); }
        else setHata('Ses duyulmadı, tekrar dene.');
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
    try { r.start(); } catch { r._aktif = false; setDinliyor(false); }
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
  const bos = mesajlar.length === 0 && !dinliyor && !dusunuyor;
  const durum = dinliyor ? 'dinliyor' : dusunuyor ? 'dusunuyor' : konusuyor ? 'konusuyor' : 'hazir';
  const durumMetin = { dinliyor: 'Dinliyorum', dusunuyor: durumYazi || 'Düşünüyorum', konusuyor: 'Konuşuyor', hazir: 'Yaz ya da konuş' }[durum];
  const yaziVar = yaziMetin.trim().length > 0;

  return (
    <section style={s.kart} aria-label="Yapay zeka asistanı">
      <style>{ASISTAN_CSS}</style>

      <div style={s.ust}>
        <Kure durum={durum} boyut={42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.baslik}>Asistan</div>
          <div style={s.durum} aria-live="polite">{durumMetin}{durum !== 'hazir' && <span className="as-nokta" />}</div>
        </div>
        <button className="as-ikonbtn" style={s.ikonBtn} onClick={bildirimAc}
          title={bildirim === 'acik' ? 'Bildirimler açık (10:00 ve 21:00)' : 'Hatırlatma bildirimlerini aç'}
          aria-label={bildirim === 'acik' ? 'Bildirimler açık' : 'Bildirimleri aç'}>
          <Ikon ad={bildirim === 'acik' ? 'zil' : 'zilKapali'} boyut={18} renk={bildirim === 'acik' ? '#0b2a4a' : '#94a3b8'} />
        </button>
        <button className="as-ikonbtn" style={s.ikonBtn} onClick={sesDegis}
          title={sesAcik ? 'Sesli okumayı kapat' : 'Sesli okumayı aç'} aria-label={sesAcik ? 'Sesli okumayı kapat' : 'Sesli okumayı aç'}>
          <Ikon ad={sesAcik ? 'sesAcik' : 'sesKapali'} boyut={18} renk={sesAcik ? '#0b2a4a' : '#94a3b8'} />
        </button>
      </div>

      {sohbet && (
        <div style={s.sohbetAlan}>
          <Kure durum={durum} boyut={92} buyuk />
          <div style={s.sohbetDurum}>
            {dinliyor ? (araMetin || 'Dinliyorum…') : dusunuyor ? `${durumYazi || 'Düşünüyorum'}…` : konusuyor ? 'Konuşuyor…' : 'Hazır'}
          </div>
          <button className="as-bitir" style={s.bitirBtn} onClick={() => sohbetBitir(false)}>
            <Ikon ad="kapat" boyut={16} kalin={2.4} /> Sesli sohbeti bitir
          </button>
        </div>
      )}

      {bilgi && <div style={s.bilgi}>{bilgi}</div>}

      {!bos && (
        <div ref={listeRef} style={s.liste}>
          {mesajlar.map((m, i) => (
            <div key={i} className="as-giris" style={{ display: 'flex', flexDirection: 'column', alignItems: m.kim === 'ben' ? 'flex-end' : 'flex-start', gap: 6 }}>
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
          {dinliyor && !sohbet && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ ...s.benBalon, opacity: 0.6 }}>{araMetin || 'Dinliyorum…'}</div>
            </div>
          )}
          {dusunuyor && (
            <div style={s.yaziyor} aria-label={durumYazi || 'Düşünüyorum'}>
              <span className="as-dot" /><span className="as-dot" /><span className="as-dot" />
              <span style={{ marginLeft: 8, color: '#64748b', fontSize: 13 }}>{durumYazi || 'Düşünüyorum'}</span>
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

      {bos && (
        <div style={s.ornekler}>
          {ORNEKLER.map((o) => (
            <button key={o.yazi} className="as-ornek" style={s.ornek} onClick={() => { sesKilidiAc(); gonder(o.yazi); }}>
              <Ikon ad={o.ik} boyut={16} renk="#2563eb" />
              <span style={{ flex: 1, minWidth: 0 }}>{o.yazi}</span>
              <Ikon ad="sag" boyut={16} renk="#cbd5e1" />
            </button>
          ))}
        </div>
      )}

      <form onSubmit={yaziGonder} style={s.yazmaAlan} className="as-yazma">
        <input
          style={s.input}
          value={yaziMetin}
          onChange={(e) => setYaziMetin(e.target.value)}
          placeholder={dinliyor ? 'Dinliyorum…' : 'Asistana yaz…'}
          disabled={dusunuyor}
          aria-label="Asistana mesaj"
          enterKeyHint="send"
        />
        {yaziVar ? (
          <button type="submit" className="as-anabtn" style={s.anaBtn} disabled={dusunuyor} aria-label="Gönder">
            <Ikon ad="yukari" boyut={20} renk="#fff" kalin={2.5} />
          </button>
        ) : (
          <button type="button" className="as-anabtn" style={{ ...s.anaBtn, ...(dinliyor && !sohbet ? s.anaBtnAktif : {}) }}
            onClick={() => dinle(false)} disabled={dusunuyor || sohbet} aria-label={dinliyor ? 'Dinlemeyi durdur' : 'Sesle sor'}>
            <Ikon ad={dinliyor && !sohbet ? 'durdur' : 'mikrofon'} boyut={20} renk="#fff" kalin={2.2} dolgu={dinliyor && !sohbet ? '#fff' : 'none'} />
          </button>
        )}
      </form>

      {SR && !sohbet && (
        <button className="as-sohbetbtn" style={s.sohbetBtn} onClick={sohbetBaslat} disabled={dusunuyor}>
          <Ikon ad="dalga" boyut={17} renk="#0b2a4a" /> Eller serbest sesli sohbet
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
.as-sohbetbtn:hover:not(:disabled){background:#e8eef6!important}
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
  sohbetAlan: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '18px 8px 16px', marginBottom: 12, borderRadius: 18, background: 'linear-gradient(180deg,#f0f7ff,#ffffff)', border: '1px solid #e0ecfa' },
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
