import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabase';
import { ARACLAR, YAZAN_ARACLAR, aracCalistir } from '../asistanAraclar';
import { promptOlustur } from '../asistanTanimlar.js';
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
const SON = '(?=\\s|$)';
const EVET = new RegExp('^(evet|eve|aynen|onayl[ıi]yorum|onayla|onay|sil|evet sil|tamam|tamam sil|olur|olur sil|emin[ıi]m|kesinlikle|do[ğg]ru)' + SON);
const HAYIR = new RegExp('^(hay[ıi]r|yok|vazge[çc]|iptal|silme|dur|bekle|istemiyorum|olmaz)' + SON);
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
  const musteriListesi = musteriler.slice(0, 600).map((m) => `${m.id}|${m.name}`).join('\n') || '(henüz müşteri yok)';
  return promptOlustur({ kullanici: ad || 'ekip üyesi', hitap, bugun, musteriListesi, sesli });
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
  // Canlı ses (ElevenLabs + Claude): 'yok' | 'baglaniyor' | 'dinliyor' | 'konusuyor'
  const [canli, setCanli] = useState('yok');
  // Ses seçici
  const [sesPanel, setSesPanel] = useState(false);
  const [sesler, setSesler] = useState(null);      // null: yükleniyor
  const [seciliSes, setSeciliSes] = useState(null);
  const [sesIslem, setSesIslem] = useState('');    // çalan ya da seçilen sesin id'si
  const dinletici = useRef(null);
  const canliRef = useRef(null);       // aktif canlı görüşme
  const sonSoz = useRef('');           // canlı görüşmede kullanıcının son söylediği (silme onayı için)
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
  const bekleyenSil = useRef(null);   // { id, aciklama, satir } — kullanıcı onayı bekleyen silme
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
    if (canliRef.current) return; // canlı görüşmede sesi ElevenLabs veriyor
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

  // ---------------- canlı ses (ElevenLabs)
  function canliAraclar() {
    const tools = {};
    for (const t of ARACLAR) {
      tools[t.name] = async (params) => {
        const r = await aracCalistir(t.name, params || {}, { ad });
        if (r.geriAl) {
          ekle('asistan', null, { eylemler: [{ yazi: r.eylem || t.name, geriAl: r.geriAl, durum: '' }] });
          veriYukle(); onDegisti && onDegisti();
        }
        if (r.silOnay) {
          bekleyenSil.current = r.silOnay;
          ekle('asistan', null, { silOnay: { ...r.silOnay } });
        }
        return typeof r.sonuc === 'string' ? r.sonuc : JSON.stringify(r.sonuc ?? '');
      };
    }
    // Silme ancak kullanıcının SON SÖZÜ açıkça "evet" ise yapılır (yapay zekâ yanlış anlasa bile)
    tools.silmeyi_onayla = async ({ onay } = {}) => {
      if (!bekleyenSil.current) return 'Onay bekleyen bir silme yok.';
      const k = kucuk(sonSoz.current).replace(/[.,!?]/g, ' ').trim();
      const evet = EVET.test(k) && !HAYIR.test(k);
      if (onay && evet) { const a = bekleyenSil.current.aciklama; await silmeyiUygula(true, false); return `Silindi: ${a}. Ekranda Geri al düğmesi var.`; }
      if (!onay || HAYIR.test(k)) { await silmeyiUygula(false, false); return 'Silinmedi, iptal edildi.'; }
      return 'Kullanıcının son sözü açık bir "evet" değildi; SİLİNMEDİ. Kullanıcıya tekrar "emin misin?" diye sor.';
    };
    return tools;
  }

  async function canliBaslat() {
    setCanli('baglaniyor');
    let v = {};
    try {
      const r = await fetch('/api/ses-asistan', { method: 'POST' });
      v = await r.json().catch(() => ({}));
      if (!r.ok || !v.signedUrl) throw Object.assign(new Error(v.hata || 'Canlı ses açılamadı'), { kod: v.kod });
      const { Conversation } = await import('@elevenlabs/client');
      const b = new Date();
      const isim = String(ad || '').split(' ')[0];
      const ortak = {
        dynamicVariables: {
          kullanici: ad || 'ekip üyesi',
          hitap: /^volkan/i.test(isim) ? 'Volkan abi' : isim || 'ekip arkadaşım',
          bugun: `${yerel(b)} (${GUNLER[b.getDay()]}, ${b.getDate()} ${AYLAR[b.getMonth()]} ${b.getFullYear()})`,
          musteri_listesi: musteriler.slice(0, 500).map((m) => `${m.id}|${m.name}`).join('\n') || '(henüz müşteri yok)',
        },
        clientTools: canliAraclar(),
        onMessage: ({ message, role, source }) => {
          const kim = (role || source) === 'user' ? 'ben' : 'asistan';
          if (!message) return;
          if (kim === 'ben') sonSoz.current = message;
          ekle(kim, message, kim === 'ben' ? { sesle: true } : {});
        },
        onModeChange: ({ mode }) => setCanli(mode === 'speaking' ? 'konusuyor' : 'dinliyor'),
        onDisconnect: (d) => {
          canliRef.current = null;
          setCanli('yok');
          sohbetRef.current = false;
          setSohbet(false);
          if (d?.reason === 'error') setHata('Sesli görüşme koptu: ' + (d.message || 'bağlantı hatası'));
        },
        onError: (mesaj) => { if (mesaj) setHata(String(mesaj)); },
      };
      // WebRTC: telefonun yankı engellemesi devrede, ses daha temiz; olmazsa websocket
      let conv;
      if (v.token) {
        try { conv = await Conversation.startSession({ ...ortak, conversationToken: v.token, connectionType: 'webrtc' }); } catch (e) { console.warn('WebRTC açılamadı, websocket deneniyor', e); }
      }
      if (!conv) conv = await Conversation.startSession({ ...ortak, signedUrl: v.signedUrl, connectionType: 'websocket' });
      canliRef.current = conv;
      setCanli('dinliyor');
      return true;
    } catch (e) {
      canliRef.current = null;
      setCanli('yok');
      if (e?.kod === 'anahtar-yok') {
        setBilgi('Doğal ses henüz açık değil: ElevenLabs anahtarı Vercel ayarlarına eklenmemiş. Şimdilik telefonun sesiyle devam ediyorum.');
      } else {
        const izin = /permission|notallowed|denied/i.test(String(e?.name || '') + String(e?.message || ''));
        setBilgi(izin ? 'Mikrofon izni verilmedi. Tarayıcı ayarlarından bu siteye mikrofon izni ver.'
          : `${e?.message || 'Canlı ses açılamadı.'} Şimdilik telefonun kendi sesiyle devam ediyorum.`);
        if (izin) return 'izin';
      }
      return false;
    }
  }

  // ---------------- ses seçici
  async function sesPaneliAc() {
    if (sesPanel) { setSesPanel(false); try { dinletici.current?.pause(); } catch { /* yok */ } return; }
    setSesPanel(true); setSesler(null); setHata('');
    try {
      const r = await fetch('/api/ses-asistan?sesler=1');
      const v = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(v.hata || 'Ses listesi alınamadı');
      setSesler(v.sesler || []); setSeciliSes(v.secili || null);
    } catch (e) { setSesler([]); setHata(e.message); }
  }
  function sesDinle(v) {
    try { dinletici.current?.pause(); } catch { /* yok */ }
    if (sesIslem === 'calan:' + v.id) { setSesIslem(''); return; }
    const a = new Audio(v.ornek || `/api/ses-asistan?ornek=${encodeURIComponent(v.id)}`);
    dinletici.current = a;
    setSesIslem('calan:' + v.id);
    a.onended = () => setSesIslem('');
    a.onerror = () => { setSesIslem(''); setHata('Örnek ses çalınamadı.'); };
    a.play().catch(() => setSesIslem(''));
  }
  async function sesiSec(v) {
    setSesIslem('sec:' + v.id); setHata('');
    try {
      const r = await fetch('/api/ses-asistan?sec=1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: v.id, sahip: v.sahip, ad: v.ad }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.hata || 'Ses değiştirilemedi');
      setSeciliSes(d.sesId || v.id);
      setSesler((l) => (l || []).map((x) => (x.id === v.id ? { ...x, secildi: true } : { ...x, secildi: false })));
      setBilgi(`Asistanın sesi "${v.ad.split(' - ')[0]}" oldu. Konuş'a bastığında bu sesle konuşacak.`);
    } catch (e) { setHata(e.message); }
    setSesIslem('');
  }

  async function sohbetBaslat() {
    // iPhone: mikrofon ve ses ancak dokunuş anında açılabiliyor; ağ beklemeden ÖNCE ikisini de aç
    sesKilidiAc();
    const mikSoz = navigator.mediaDevices?.getUserMedia ? navigator.mediaDevices.getUserMedia({ audio: true }).catch((e) => e) : Promise.resolve(null);
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) { const ac = new AC(); const kaynak = ac.createBufferSource(); kaynak.buffer = ac.createBuffer(1, 1, 22050); kaynak.connect(ac.destination); kaynak.start(0); ac.resume?.(); setTimeout(() => ac.close?.(), 1500); }
    } catch { /* yok */ }
    setHata(''); setBilgi('');
    sohbetRef.current = true;
    setSohbet(true);
    const mik = await mikSoz;
    if (mik instanceof Error) {
      sohbetRef.current = false; setSohbet(false);
      setBilgi('Mikrofon izni verilmedi. Tarayıcı ayarlarından bu siteye mikrofon izni ver.');
      return;
    }
    try { mik?.getTracks?.().forEach((t) => t.stop()); } catch { /* yok */ }
    const sonuc = await canliBaslat();
    if (sonuc === true) return;
    if (sonuc === 'izin') { sohbetRef.current = false; setSohbet(false); return; }
    sesKilidiAc();
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
    if (canliRef.current) {
      const c = canliRef.current;
      canliRef.current = null;
      setCanli('yok');
      try { c.endSession(); } catch { /* yok */ }
      return;
    }
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
        if (sonuc.silOnay) bekleyenSil.current = sonuc.silOnay;
        return { functionResponse: { ...(id ? { id } : {}), name, response: { sonuc: sonuc.sonuc } } };
      });
      gecmis = [...gecmis, { role: 'user', parts: cevaplar }];
      setDurumYazi('Cevabı hazırlıyorum');
    }
    return '';
  }

  // Onaylanan silme: kaydı siler, "Geri al" ile aynı kaydı geri koyar
  async function silmeyiUygula(onay, sesle) {
    const b = bekleyenSil.current;
    try { canliRef.current?.sendContextualUpdate?.(b ? `Kullanıcı "${b.aciklama}" silme isteğini ${onay ? 'onayladı, kayıt silindi' : 'iptal etti, silinmedi'}.` : ''); } catch { /* yok */ }
    bekleyenSil.current = null;
    setMesajlar((l) => l.map((m) => (m.silOnay && m.silOnay.id === b?.id ? { ...m, silOnay: { ...m.silOnay, durum: onay ? 'silindi' : 'iptal' } } : m)));
    if (!b) return;
    if (!onay) {
      gecmisRef.current = [...gecmisRef.current, { role: 'user', parts: [{ text: 'Hayır, silme.' }] }, { role: 'model', parts: [{ text: `Tamam, ${b.aciklama} silinmedi.` }] }].slice(-MAX_SOHBET * 2);
      if (!canliRef.current) asistanDer('Tamam, silmedim.', {}, sesle);
      return;
    }
    const { error } = await supabase.from('mesaj_kayitlari').delete().eq('id', b.id);
    if (error) { setHata('Silinemedi: ' + error.message); asistanDer('Silemedim, bir hata oldu.', {}, sesle); return; }
    const eylem = { yazi: `Silindi: ${b.aciklama}`, durum: '', geriAl: async () => {
      const { error: e2 } = await supabase.from('mesaj_kayitlari').insert([b.satir]);
      if (e2) throw new Error(e2.message);
    } };
    gecmisRef.current = [...gecmisRef.current, { role: 'user', parts: [{ text: 'Evet, sil.' }] }, { role: 'model', parts: [{ text: `Sildim: ${b.aciklama}.` }] }].slice(-MAX_SOHBET * 2);
    if (canliRef.current) ekle('asistan', null, { eylemler: [eylem] }); // canlıda sözlü cevabı sesli ajan veriyor
    else asistanDer('Sildim.', { eylemler: [eylem] }, sesle);
    await veriYukle();
    onDegisti && onDegisti();
  }

  async function gonder(metin, sesle = false) {
    const t = String(metin || '').trim();
    if (!t || mesgulRef.current) return;
    setHata('');
    ekle('ben', t, sesle ? { sesle: true } : {});

    if (sohbetRef.current && BITIR.test(kucuk(t))) { sohbetBitir(true); return; }

    // Silme onayı bekleniyorsa: "evet" → sil, "hayır" → vazgeç (yapay zekâya sorulmadan, kesin)
    if (bekleyenSil.current) {
      const k = kucuk(t).replace(/[.,!?]/g, ' ').trim();
      if (HAYIR.test(k)) { silmeyiUygula(false, sesle); return; }
      if (EVET.test(k)) { silmeyiUygula(true, sesle); return; }
      // başka bir şey söylendi: bekleyen silme iptal
      setMesajlar((l) => l.map((m) => (m.silOnay && m.silOnay.id === bekleyenSil.current.id ? { ...m, silOnay: { ...m.silOnay, durum: 'iptal' } } : m)));
      notRef.current += `(Bilgi: bekleyen "${bekleyenSil.current.aciklama}" silme işlemi onaylanmadı ve iptal edildi.) `;
      bekleyenSil.current = null;
    }

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
      const ek = eylemler.length ? { eylemler } : {};
      if (bekleyenSil.current) ek.silOnay = { ...bekleyenSil.current };
      asistanDer(son, ek, sesle);
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
    if (canliRef.current || canli !== 'yok') return;
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
  const durum = canli === 'dinliyor' ? 'dinliyor' : canli === 'konusuyor' ? 'konusuyor' : canli === 'baglaniyor' ? 'dusunuyor'
    : dinliyor ? 'dinliyor' : dusunuyor ? 'dusunuyor' : konusuyor ? 'konusuyor' : 'hazir';
  const yaziVar = yaziMetin.trim().length > 0;

  const sohbetYazi = canli === 'baglaniyor' ? 'Bağlanıyor…' : canli === 'dinliyor' ? 'Dinliyorum…' : canli === 'konusuyor' ? 'Konuşuyorum…' : dinliyor ? (araMetin || 'Dinliyorum…') : dusunuyor ? `${durumYazi || 'Düşünüyorum'}…` : konusuyor ? 'Konuşuyorum…' : 'Hazırım';
  const sohbetIpucu = canli !== 'yok' ? (canli === 'konusuyor' ? 'Sözümü kesmek için konuşman yeterli' : canli === 'dinliyor' ? 'Konuş, seni dinliyorum' : '') : dinliyor ? 'Konuş, bitince ben cevap veririm' : konusuyor ? 'Sözümü kesmek için küreye dokun' : dusunuyor ? '' : 'Konuşmak için küreye dokun';

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

      {!sohbet && (
        <button className="as-link" style={{ ...s.bildirimLink, margin: '-4px auto 10px' }} onClick={sesPaneliAc}>
          <Ikon ad="sesAcik" boyut={14} renk="#2563eb" /> {sesPanel ? 'Ses seçimini kapat' : 'Asistanın sesini seç'}
        </button>
      )}

      {sesPanel && !sohbet && (
        <div style={s.sesPanel}>
          <div style={s.sesPanelBaslik}>Bir sesi dinle, beğendiğini seç</div>
          {sesler === null && <div style={s.sesSatirAlt}>Sesler yükleniyor…</div>}
          {sesler && sesler.length === 0 && <div style={s.sesSatirAlt}>Ses listesi alınamadı.</div>}
          {(sesler || []).map((v) => {
            const secili = v.secildi || (seciliSes && seciliSes === v.id);
            const caliyor = sesIslem === 'calan:' + v.id;
            return (
              <div key={v.id} style={{ ...s.sesSatir, ...(secili ? s.sesSatirSecili : {}) }}>
                <button style={s.sesDinleBtn} onClick={() => sesDinle(v)} aria-label={caliyor ? 'Durdur' : 'Dinle'}>
                  <Ikon ad={caliyor ? 'durdur' : 'sesAcik'} boyut={16} renk="#0b2a4a" dolgu={caliyor ? '#0b2a4a' : 'none'} />
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={s.sesAd}>{v.ad.split(' - ')[0]} <span style={s.sesEtiket}>{v.cinsiyet === 'female' ? 'Kadın' : v.cinsiyet === 'male' ? 'Erkek' : ''}{v.tur === 'turkce' ? ' · Türkçe' : ' · Uluslararası'}</span>{v.onerilen && <span style={s.onerilen}>Önerilen</span>}</div>
                  {v.aciklama && <div style={s.sesSatirAlt}>{v.aciklama}</div>}
                </div>
                {secili ? <span style={s.sesSeciliYazi}>Seçili</span> : (
                  <button style={s.sesSecBtn} disabled={!!sesIslem && sesIslem.startsWith('sec:')} onClick={() => sesiSec(v)}>
                    {sesIslem === 'sec:' + v.id ? 'Bekle…' : 'Seç'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {bilgi && <div style={s.bilgi}>{bilgi}</div>}

      {mesajlar.length > 0 && (
        <div ref={listeRef} style={s.liste}>
          {mesajlar.map((m, i) => (
            <div key={i} className="as-giris" style={{ display: 'flex', flexDirection: 'column', alignItems: m.kim === 'ben' ? 'flex-end' : 'flex-start', gap: 6 }}>
              {m.sesle && (
                <div style={s.duyulan}><Ikon ad="mikrofon" boyut={12} renk="#64748b" kalin={2.2} /> Duyduğum</div>
              )}
              {m.yazi && <div style={m.kim === 'ben' ? s.benBalon : s.asBalon}>{m.yazi}</div>}
              {m.silOnay && (
                <div style={{ ...s.silKart, ...(m.silOnay.durum ? { opacity: 0.6 } : {}) }}>
                  <div style={s.silBaslik}><Ikon ad="kapat" boyut={14} renk="#b91c1c" kalin={2.4} /> {m.silOnay.aciklama}</div>
                  {m.silOnay.durum ? (
                    <div style={s.silDurum}>{m.silOnay.durum === 'silindi' ? 'Silindi' : 'Silinmedi'}</div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button style={s.silEvet} onClick={() => silmeyiUygula(true, false)}>Evet, sil</button>
                      <button style={s.silHayir} onClick={() => silmeyiUygula(false, false)}>Vazgeç</button>
                    </div>
                  )}
                </div>
              )}
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
  silKart: { display: 'flex', flexDirection: 'column', gap: 8, maxWidth: '92%', background: '#fff7f7', border: '1px solid #fecaca', borderRadius: 14, padding: '10px 12px' },
  silBaslik: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 700, color: '#7f1d1d', lineHeight: 1.35 },
  silDurum: { fontSize: 12.5, fontWeight: 700, color: '#64748b' },
  silEvet: { border: 'none', background: '#dc2626', color: '#fff', borderRadius: 10, padding: '8px 14px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  silHayir: { border: '1px solid #e2e8f0', background: '#fff', color: '#334155', borderRadius: 10, padding: '8px 14px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  duyulan: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 600, color: '#64748b', marginBottom: -2 },
  konusBtn: { display: 'flex', alignItems: 'center', gap: 14, width: '100%', border: 'none', borderRadius: 20, padding: '12px 18px 12px 12px', marginBottom: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#fff', background: 'linear-gradient(135deg,#0b2a4a 0%,#123e6b 60%,#1d4ed8 140%)', boxShadow: '0 10px 24px rgba(11,42,74,.28)' },
  konusKure: { display: 'inline-flex', flexShrink: 0 },
  konusBaslik: { display: 'block', fontSize: 18, fontWeight: 800, letterSpacing: -0.2 },
  konusAlt: { display: 'block', fontSize: 13, opacity: 0.8, marginTop: 2 },
  kureBtn: { position: 'relative', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', borderRadius: '50%', display: 'inline-flex' },
  sesPanel: { border: '1px solid #e6ecf3', borderRadius: 16, padding: 10, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' },
  sesPanelBaslik: { fontSize: 13, fontWeight: 700, color: '#334155', padding: '2px 4px 4px' },
  sesSatir: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px', borderRadius: 12, background: '#f8fafc' },
  sesSatirSecili: { background: '#eff6ff', boxShadow: 'inset 0 0 0 1.5px #93c5fd' },
  sesDinleBtn: { width: 36, height: 36, borderRadius: '50%', border: '1px solid #dbe3ee', background: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, padding: 0 },
  sesAd: { fontSize: 14, fontWeight: 700, color: '#0b1730' },
  sesEtiket: { fontSize: 11.5, fontWeight: 600, color: '#64748b', marginLeft: 4 },
  sesSatirAlt: { fontSize: 12, color: '#64748b', marginTop: 1, lineHeight: 1.35 },
  onerilen: { marginLeft: 6, fontSize: 10.5, fontWeight: 800, color: '#15803d', background: '#dcfce7', borderRadius: 6, padding: '2px 6px', verticalAlign: 1 },
  sesSecBtn: { border: 'none', background: '#0b2a4a', color: '#fff', borderRadius: 10, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 },
  sesSeciliYazi: { fontSize: 12.5, fontWeight: 700, color: '#1d4ed8', flexShrink: 0, paddingRight: 4 },
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
