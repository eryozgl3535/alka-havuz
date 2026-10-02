import { useEffect, useState } from 'react';

// Arka plan ve başlık rengi ayarları — her cihazda ayrı saklanır (localStorage)

const DALGA = encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='120' height='40' viewBox='0 0 120 40'>" +
  "<path d='M0 20 Q15 8 30 20 T60 20 T90 20 T120 20' fill='none' stroke='#cfe3f5' stroke-width='2'/></svg>"
);

export const ARKA_PLANLAR = [
  { id: 'sade', ad: 'Sade', css: '#eef3f9' },
  { id: 'buz', ad: 'Buz Mavisi', css: 'linear-gradient(180deg,#dcecfa 0%,#eef5fc 45%,#f5f8fc 100%)' },
  { id: 'havuz', ad: 'Havuz', css: 'radial-gradient(120% 55% at 50% 0%,#bfe6fa 0%,rgba(191,230,250,0) 70%),linear-gradient(180deg,#e2f3fb 0%,#f0f7fb 100%)' },
  { id: 'dalga', ad: 'Dalga', css: `url("data:image/svg+xml,${DALGA}") 0 0/120px 40px, linear-gradient(180deg,#e8f2fb,#f3f8fc)` },
  { id: 'nokta', ad: 'Noktalı', css: 'radial-gradient(#cddcee 1.2px, transparent 1.2px) 0 0/18px 18px, #f2f6fb' },
  { id: 'kum', ad: 'Kum', css: 'linear-gradient(180deg,#f8efe3 0%,#f6f1ea 60%,#f3efe9 100%)' },
  { id: 'gunbatimi', ad: 'Gün Batımı', css: 'linear-gradient(180deg,#fde3d6 0%,#f7ebf1 45%,#eef2f9 100%)' },
  { id: 'yesil', ad: 'Zeytin', css: 'linear-gradient(180deg,#e4efe4 0%,#eff5ee 50%,#f3f6f2 100%)' },
];

export const BASLIK_RENKLERI = [
  { id: 'lacivert', ad: 'Lacivert', renk: ['#0b2a4a', '#063a63'] },
  { id: 'okyanus', ad: 'Okyanus', renk: ['#0c4a6e', '#0369a1'] },
  { id: 'turkuaz', ad: 'Turkuaz', renk: ['#134e4a', '#0f766e'] },
  { id: 'gece', ad: 'Gece', renk: ['#0f172a', '#1e293b'] },
  { id: 'zumrut', ad: 'Zümrüt', renk: ['#052e16', '#166534'] },
  { id: 'bordo', ad: 'Bordo', renk: ['#3b0d17', '#7f1d1d'] },
];

const ANAHTAR = 'alkaTema1';
const VARSAYILAN = { arka: 'sade', baslik: 'lacivert', foto: null, fotoBelirgin: 0.45, baslikFoto: null };

export function temaOku() {
  try {
    return { ...VARSAYILAN, ...JSON.parse(localStorage.getItem(ANAHTAR) || '{}') };
  } catch {
    return { ...VARSAYILAN };
  }
}

export function temaKaydet(t) {
  localStorage.setItem(ANAHTAR, JSON.stringify(t));
  window.dispatchEvent(new Event('alka-tema'));
}

export function temaSifirla() {
  try { localStorage.removeItem(ANAHTAR); } catch { /* yoksay */ }
  window.dispatchEvent(new Event('alka-tema'));
}

export function arkaPlanCss(t) {
  if (t.arka === 'foto' && t.foto) {
    const ortu = (1 - (t.fotoBelirgin ?? 0.45)).toFixed(2);
    return `linear-gradient(rgba(238,243,249,${ortu}),rgba(238,243,249,${ortu})), url(${t.foto}) center / cover no-repeat`;
  }
  return (ARKA_PLANLAR.find((a) => a.id === t.arka) || ARKA_PLANLAR[0]).css;
}

export function baslikRenk(t) {
  return (BASLIK_RENKLERI.find((b) => b.id === t.baslik) || BASLIK_RENKLERI[0]).renk;
}

export function useTema() {
  const [tema, setTema] = useState(temaOku);
  useEffect(() => {
    const f = () => setTema(temaOku());
    window.addEventListener('alka-tema', f);
    window.addEventListener('storage', f);
    return () => { window.removeEventListener('alka-tema', f); window.removeEventListener('storage', f); };
  }, []);
  useEffect(() => {
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', baslikRenk(tema)[0]);
  }, [tema]);
  return tema;
}

// Telefondan seçilen fotoğrafı küçültüp kaydedilebilir hale getirir
export function fotoKucult(dosya, enBuyuk = 1280) {
  return new Promise((coz, red) => {
    const okuyucu = new FileReader();
    okuyucu.onerror = () => red(new Error('Fotoğraf okunamadı'));
    okuyucu.onload = () => {
      const img = new Image();
      img.onerror = () => red(new Error('Fotoğraf açılamadı'));
      img.onload = () => {
        const oran = Math.min(1, enBuyuk / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * oran);
        c.height = Math.round(img.height * oran);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        coz(c.toDataURL('image/jpeg', 0.78));
      };
      img.src = okuyucu.result;
    };
    okuyucu.readAsDataURL(dosya);
  });
}
