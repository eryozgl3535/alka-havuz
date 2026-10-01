import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase';

// ---- vCard (.vcf) okuma ----

function qpCoz(metin) {
  // Quoted-printable (eski Android rehberleri) -> UTF-8
  const temiz = metin.replace(/=\r?\n/g, '');
  const baytlar = [];
  for (let i = 0; i < temiz.length; i++) {
    if (temiz[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(temiz.substr(i + 1, 2))) {
      baytlar.push(parseInt(temiz.substr(i + 1, 2), 16));
      i += 2;
    } else {
      baytlar.push(temiz.charCodeAt(i));
    }
  }
  try { return new TextDecoder('utf-8').decode(new Uint8Array(baytlar)); } catch { return temiz; }
}

function degerCoz(param, deger) {
  let v = deger;
  if (/ENCODING=QUOTED-PRINTABLE/i.test(param)) v = qpCoz(v);
  return v.replace(/\\n/gi, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\').trim();
}

function telefonDuzelt(ham) {
  let r = String(ham || '').replace(/\D/g, '');
  if (r.startsWith('0090')) r = r.slice(4);
  else if (r.startsWith('90') && r.length === 12) r = r.slice(2);
  if (r.length === 10 && r.startsWith('5')) r = '0' + r;
  if (r.length === 11 && r.startsWith('0')) {
    return `${r.slice(0, 4)} ${r.slice(4, 7)} ${r.slice(7, 9)} ${r.slice(9)}`;
  }
  return String(ham || '').trim();
}

const telAnahtar = (t) => String(t || '').replace(/\D/g, '').slice(-10);

function vcfOku(metin) {
  // Boşlukla devam eden (katlanmış) satırları birleştir
  const duz = metin.replace(/\r?\n[ \t]/g, '');
  const kartlar = duz.split(/BEGIN:VCARD/i).slice(1);
  const sonuc = [];

  kartlar.forEach((kart, i) => {
    const satirlar = kart.split(/\r?\n/);
    let fn = '', n = '', org = '', adres = '';
    const tel = [];
    let qpTampon = null;

    const isle = (satir) => {
      const iki = satir.indexOf(':');
      if (iki < 0) return;
      const sol = satir.slice(0, iki);
      const deger = satir.slice(iki + 1);
      const anahtar = sol.split(';')[0].replace(/^item\d+\./i, '').toUpperCase();
      if (anahtar === 'FN') fn = degerCoz(sol, deger);
      else if (anahtar === 'N') n = degerCoz(sol, deger).split(';').filter(Boolean).reverse().join(' ');
      else if (anahtar === 'ORG') org = degerCoz(sol, deger).replace(/;/g, ' ').trim();
      else if (anahtar === 'TEL') tel.push(degerCoz(sol, deger));
      else if (anahtar === 'ADR' && !adres) {
        adres = degerCoz(sol, deger).split(';').map((x) => x.trim()).filter(Boolean).join(', ');
      }
    };

    satirlar.forEach((satir) => {
      if (qpTampon !== null) {
        qpTampon += '\n' + satir;
        if (!satir.endsWith('=')) { isle(qpTampon); qpTampon = null; }
        return;
      }
      if (/ENCODING=QUOTED-PRINTABLE/i.test(satir) && satir.endsWith('=')) { qpTampon = satir; return; }
      isle(satir);
    });

    const ad = (fn || n || org).trim();
    const telefonlar = [...new Set(tel.map(telefonDuzelt).filter(Boolean))];
    if (!ad && telefonlar.length === 0) return;
    sonuc.push({
      id: i,
      ad: ad || 'İsimsiz',
      telefonlar,
      telefon: telefonlar.find((t) => t.startsWith('05')) || telefonlar[0] || '',
      adres,
      not: org && org !== ad ? org : '',
    });
  });

  return sonuc.sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
}

// ---- Sayfa ----

export default function RehberPage() {
  const [kisiler, setKisiler] = useState([]);
  const [secili, setSecili] = useState({});
  const [mevcutTel, setMevcutTel] = useState(new Set());
  const [arama, setArama] = useState('');
  const [dosyaAdi, setDosyaAdi] = useState('');
  const [mesaj, setMesaj] = useState('');
  const [hata, setHata] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);

  async function mevcutlariGetir() {
    const { data, error } = await supabase.from('customers').select('phone');
    if (error) { setHata(error.message); return; }
    setMevcutTel(new Set((data || []).map((m) => telAnahtar(m.phone)).filter((t) => t.length === 10)));
  }

  useEffect(() => { mevcutlariGetir(); }, []);

  const kayitliMi = (k) => k.telefonlar.some((t) => mevcutTel.has(telAnahtar(t)));

  function dosyaSec(e) {
    const dosya = e.target.files?.[0];
    if (!dosya) return;
    setHata(''); setMesaj(''); setSecili({});
    setDosyaAdi(dosya.name);
    const okuyucu = new FileReader();
    okuyucu.onload = () => {
      const liste = vcfOku(String(okuyucu.result || ''));
      if (liste.length === 0) setHata('Dosyada kişi bulunamadı. Rehberden dışa aktarılan .vcf dosyasını seçtiğinizden emin olun.');
      setKisiler(liste);
    };
    okuyucu.onerror = () => setHata('Dosya okunamadı.');
    okuyucu.readAsText(dosya, 'utf-8');
    e.target.value = '';
  }

  const gorunen = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase('tr-TR');
    const qTel = arama.replace(/\D/g, '');
    return kisiler.filter((k) =>
      !q ||
      k.ad.toLocaleLowerCase('tr-TR').includes(q) ||
      (qTel.length >= 3 && k.telefonlar.some((t) => t.replace(/\D/g, '').includes(qTel)))
    );
  }, [kisiler, arama]);

  const secilebilir = gorunen.filter((k) => k.telefon && !kayitliMi(k));
  const seciliSayi = Object.values(secili).filter(Boolean).length;

  function tumunuSec() {
    const yeni = { ...secili };
    const hepsiSecili = secilebilir.length > 0 && secilebilir.every((k) => yeni[k.id]);
    secilebilir.forEach((k) => { yeni[k.id] = !hepsiSecili; });
    setSecili(yeni);
  }

  async function aktar() {
    const liste = kisiler.filter((k) => secili[k.id] && !kayitliMi(k));
    if (liste.length === 0) { setHata('Önce aktarılacak kişileri seçin.'); return; }
    if (!window.confirm(`${liste.length} kişi müşteri olarak eklensin mi?`)) return;
    setYukleniyor(true); setHata(''); setMesaj('');
    const satirlar = liste.map((k) => ({ name: k.ad, phone: k.telefon, address: k.adres, notes: k.not }));
    let eklenen = 0;
    for (let i = 0; i < satirlar.length; i += 200) {
      const { error } = await supabase.from('customers').insert(satirlar.slice(i, i + 200));
      if (error) { setHata(`Hata: ${error.message} (${eklenen} kişi eklendi)`); break; }
      eklenen += Math.min(200, satirlar.length - i);
    }
    setYukleniyor(false);
    if (eklenen > 0) setMesaj(`✅ ${eklenen} kişi müşterilere eklendi.`);
    setSecili({});
    mevcutlariGetir();
  }

  return (
    <div style={s.sayfa}>
      <h1 style={s.baslik}>📇 Rehberden Aktar</h1>
      <p style={s.altBaslik}>Telefon rehberinizdeki kişileri seçip tek seferde müşteri olarak ekleyin.</p>

      <div style={s.kart}>
        <div style={s.bilgiBaslik}>iPhone'dan rehberi dışa aktarma</div>
        <ol style={s.adimlar}>
          <li>Kişiler uygulamasını açın, sol üstteki <b>Listeler</b>'e dokunun.</li>
          <li><b>Tüm Kişiler</b>'in üzerine basılı tutun → <b>Dışa Aktar</b> → <b>Dosyalar'a Kaydet</b>.</li>
          <li>Aşağıdaki butonla kaydettiğiniz <b>.vcf</b> dosyasını seçin.</li>
        </ol>
        <label style={s.anaBtn}>
          📂 Rehber dosyası seç (.vcf)
          <input type="file" accept=".vcf,text/vcard,text/x-vcard" onChange={dosyaSec} style={{ display: 'none' }} />
        </label>
        {dosyaAdi && <div style={s.kucuk}>Seçilen dosya: {dosyaAdi} · {kisiler.length} kişi bulundu</div>}
      </div>

      {hata && <div style={s.hata}>{hata}</div>}
      {mesaj && <div style={s.basari}>{mesaj}</div>}

      {kisiler.length > 0 && (
        <>
          <input
            style={{ ...s.input, marginBottom: 12 }}
            placeholder="İsim veya numara ile ara..."
            value={arama}
            onChange={(e) => setArama(e.target.value)}
          />
          <div style={s.aracCubugu}>
            <button style={s.ikincilBtn} onClick={tumunuSec}>
              {secilebilir.length > 0 && secilebilir.every((k) => secili[k.id]) ? 'Seçimi kaldır' : `Görünenleri seç (${secilebilir.length})`}
            </button>
            <span style={s.kucuk}>{seciliSayi} kişi seçili</span>
          </div>

          <div style={s.liste}>
            {gorunen.map((k) => {
              const kayitli = kayitliMi(k);
              const telYok = !k.telefon;
              const pasif = kayitli || telYok;
              return (
                <label key={k.id} style={{ ...s.satir, ...(pasif ? s.satirPasif : {}), ...(secili[k.id] ? s.satirSecili : {}) }}>
                  <input
                    type="checkbox"
                    disabled={pasif}
                    checked={!!secili[k.id]}
                    onChange={(e) => setSecili({ ...secili, [k.id]: e.target.checked })}
                    style={s.kutu}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={s.isim}>{k.ad}</div>
                    <div style={s.kucuk}>{k.telefon ? `📞 ${k.telefon}` : 'Numara yok'}{k.not ? ` · ${k.not}` : ''}</div>
                    {k.adres && <div style={s.kucuk}>📍 {k.adres}</div>}
                  </div>
                  {kayitli && <span style={s.rozet}>Zaten müşteri</span>}
                </label>
              );
            })}
            {gorunen.length === 0 && <div style={s.kucuk}>Aramaya uyan kişi yok.</div>}
          </div>

          <div style={s.altSabit}>
            <button style={{ ...s.anaBtn, width: '100%', opacity: yukleniyor || seciliSayi === 0 ? 0.6 : 1 }}
              disabled={yukleniyor || seciliSayi === 0} onClick={aktar}>
              {yukleniyor ? 'Ekleniyor...' : `✅ Seçilen ${seciliSayi} kişiyi müşteri olarak ekle`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const s = {
  sayfa: { padding: 20, maxWidth: 900, margin: '0 auto', fontFamily: 'system-ui, sans-serif' },
  baslik: { margin: 0, fontSize: 26, color: '#0f2d4a' },
  altBaslik: { margin: '4px 0 18px', color: '#64748b', fontSize: 14 },
  kart: { background: '#fff', borderRadius: 16, padding: 20, marginBottom: 14, boxShadow: '0 2px 12px rgba(15,45,74,0.08)' },
  bilgiBaslik: { fontWeight: 700, color: '#0f2d4a', fontSize: 16, marginBottom: 8 },
  adimlar: { margin: '0 0 16px', paddingLeft: 20, color: '#334155', fontSize: 14, lineHeight: 1.7 },
  anaBtn: { display: 'inline-block', textAlign: 'center', background: 'linear-gradient(135deg,#1e5a82,#0f2d4a)', color: '#fff',
    border: 'none', borderRadius: 12, padding: '13px 18px', fontWeight: 600, cursor: 'pointer', fontSize: 15, boxSizing: 'border-box' },
  ikincilBtn: { background: '#fff', color: '#1e5a82', border: '1px solid #1e5a82', borderRadius: 10, padding: '9px 14px',
    fontWeight: 600, cursor: 'pointer', fontSize: 14 },
  input: { padding: '11px 12px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 15, width: '100%', boxSizing: 'border-box', background: '#fff' },
  aracCubugu: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10 },
  liste: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 90 },
  satir: { display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 12, padding: '12px 14px',
    border: '2px solid transparent', boxShadow: '0 1px 6px rgba(15,45,74,0.06)', cursor: 'pointer' },
  satirSecili: { borderColor: '#1d6fe0', background: '#eff6ff' },
  satirPasif: { opacity: 0.55, cursor: 'default' },
  kutu: { width: 22, height: 22, flexShrink: 0, accentColor: '#1d6fe0' },
  isim: { fontWeight: 700, color: '#0f2d4a', fontSize: 15 },
  kucuk: { color: '#64748b', fontSize: 13, marginTop: 4 },
  rozet: { background: '#dcfce7', color: '#166534', fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '4px 9px', whiteSpace: 'nowrap' },
  altSabit: { position: 'sticky', bottom: 'calc(90px + env(safe-area-inset-bottom))', zIndex: 5 },
  hata: { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 12, padding: 12, marginBottom: 12, fontSize: 14 },
  basari: { background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: 12, padding: 12, marginBottom: 12, fontSize: 14 },
};
