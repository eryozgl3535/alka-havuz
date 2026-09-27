const KONULAR = {
  havuz: {
    ad: 'Havuz',
    sorgular: [
      ['havuz teknolojisi', 'tr'],
      ['havuz ekipmanı', 'tr'],
      ['yüzme havuzu yenilik', 'tr'],
      ['pool equipment new product', 'en'],
      ['swimming pool technology innovation', 'en'],
    ],
    anahtar: ['havuz', 'yüzme', 'jakuzi', 'spa ', 'pool', 'swimming', 'hot tub', 'klor', 'chlorin'],
  },
  pompa: {
    ad: 'Pompa & Kuyu',
    sorgular: [
      ['dalgıç pompa', 'tr'],
      ['su pompası teknoloji', 'tr'],
      ['hidrofor', 'tr'],
      ['submersible pump new technology', 'en'],
      ['water pump innovation', 'en'],
    ],
    anahtar: ['pompa', 'pump', 'kuyu', 'hidrofor', 'booster', 'borehole', 'well water', 'dalgıç', 'submersible'],
  },
  sulama: {
    ad: 'Sulama',
    sorgular: [
      ['akıllı sulama', 'tr'],
      ['sulama teknolojisi', 'tr'],
      ['damla sulama', 'tr'],
      ['smart irrigation technology', 'en'],
    ],
    anahtar: ['sulama', 'damla', 'irrigation', 'drip', 'sprinkler', 'fıskiye', 'yağmurlama'],
  },
  enerji: {
    ad: 'Enerji & Isı Pompası',
    sorgular: [
      ['ısı pompası', 'tr'],
      ['güneş enerjili pompa', 'tr'],
      ['enerji verimli pompa', 'tr'],
      ['pool heat pump', 'en'],
      ['heat pump innovation', 'en'],
    ],
    anahtar: ['ısı pompası', 'heat pump', 'güneş enerjili', 'solar pump', 'solar-powered pump', 'enerji verimli', 'inverter'],
  },
};

const HARIC = [
  'benzin', 'motorin', 'akaryakıt', 'mazot', 'yakıt', 'lpg', 'petrol', 'fuel', 'gasoline',
  'maç', 'futbol', 'basketbol', 'spor', 'sports', 'football', 'soccer', 'lig ',
  'borsa', 'hisse', 'dolar', 'altın fiyat', 'stock', 'shares',
  'seçim', 'belediye başkan', 'milletvekili', 'election',
  'cinayet', 'kaza', 'yangın', 'deprem', 'murder', 'crash',
  'burç', 'magazin', 'dizi', 'film',
];

const TR_HARIC_SORGU = ' -benzin -motorin -akaryakıt -zam -maç';

const DIL = {
  tr: 'hl=tr&gl=TR&ceid=TR:tr',
  en: 'hl=en-US&gl=US&ceid=US:en',
};

function temizle(metin) {
  return String(metin || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function al(parca, etiket) {
  const m = parca.match(new RegExp(`<${etiket}[^>]*>([\\s\\S]*?)</${etiket}>`));
  return m ? temizle(m[1]) : '';
}

function alakaliMi(baslik, konu) {
  const t = ' ' + baslik.toLocaleLowerCase('tr-TR') + ' ';
  if (HARIC.some((k) => t.includes(k))) return false;
  return KONULAR[konu].anahtar.some((k) => t.includes(k));
}

async function sorgula(sorgu, dil, konu) {
  const tamSorgu = sorgu + (dil === 'tr' ? TR_HARIC_SORGU : '') + ' when:30d';
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(tamSorgu)}&${DIL[dil]}`;
  const kontrol = new AbortController();
  const zaman = setTimeout(() => kontrol.abort(), 6000);
  try {
    const yanit = await fetch(url, {
      signal: kontrol.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (ALKA Havuz haber okuyucu)' },
    });
    if (!yanit.ok) return [];
    const xml = await yanit.text();
    return xml.split('<item>').slice(1).map((parca) => {
      const kaynak = al(parca, 'source');
      let baslik = al(parca, 'title');
      if (kaynak && baslik.endsWith(' - ' + kaynak)) baslik = baslik.slice(0, -(kaynak.length + 3));
      const tarihHam = al(parca, 'pubDate');
      const t = tarihHam ? new Date(tarihHam) : null;
      const tarih = t && !isNaN(t) ? t.toISOString() : null;
      return { baslik, link: al(parca, 'link'), kaynak, tarih, konu, dil };
    }).filter((h) => h.baslik && h.link && alakaliMi(h.baslik, konu));
  } catch {
    return [];
  } finally {
    clearTimeout(zaman);
  }
}

async function turkceyeCevir(liste) {
  const anahtar = process.env.ANTHROPIC_API_KEY;
  const ingilizce = liste.filter((h) => h.dil === 'en');
  if (!anahtar || !ingilizce.length) return;

  const kontrol = new AbortController();
  const zaman = setTimeout(() => kontrol.abort(), 20000);
  try {
    const istem =
      'Aşağıdaki İngilizce haber başlıklarını doğal ve anlaşılır Türkçeye çevir. ' +
      'Havuz, pompa, kuyu, sulama ve tesisat sektörü terimlerini doğru kullan. ' +
      'Marka, şirket ve ürün adlarını çevirme. ' +
      'Sadece JSON dizisi döndür: aynı sırayla, aynı sayıda metin. Başka hiçbir şey yazma.\n\n' +
      JSON.stringify(ingilizce.map((h) => h.baslik));

    const yanit = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: kontrol.signal,
      headers: {
        'x-api-key': anahtar,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        messages: [{ role: 'user', content: istem }],
      }),
    });
    if (!yanit.ok) return;
    const veri = await yanit.json();
    const metin = (veri.content || []).map((c) => c.text || '').join('');
    const bas = metin.indexOf('[');
    const son = metin.lastIndexOf(']');
    if (bas < 0 || son < 0) return;
    const dizi = JSON.parse(metin.slice(bas, son + 1));
    if (!Array.isArray(dizi) || dizi.length !== ingilizce.length) return;
    ingilizce.forEach((h, i) => {
      if (typeof dizi[i] === 'string' && dizi[i].trim()) {
        h.orijinal = h.baslik;
        h.baslik = dizi[i].trim();
        h.cevrildi = true;
      }
    });
  } catch {
    // Çeviri başarısız olursa İngilizce başlıklar olduğu gibi kalır
  } finally {
    clearTimeout(zaman);
  }
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://yerel');
    const istenen = url.searchParams.get('konu') || 'tumu';
    const konuAnahtarlari = istenen !== 'tumu' && KONULAR[istenen] ? [istenen] : Object.keys(KONULAR);

    const isler = [];
    konuAnahtarlari.forEach((k) => {
      KONULAR[k].sorgular.forEach(([sorgu, dil]) => isler.push(sorgula(sorgu, dil, k)));
    });
    const sonuclar = (await Promise.all(isler)).flat();

    const gorulen = new Set();
    const haberler = sonuclar
      .filter((h) => {
        const anahtar = h.baslik.toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').slice(0, 90);
        if (gorulen.has(anahtar)) return false;
        gorulen.add(anahtar);
        return true;
      })
      .sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''))
      .slice(0, 50);

    await turkceyeCevir(haberler);

    const konular = Object.fromEntries(Object.entries(KONULAR).map(([k, v]) => [k, v.ad]));

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.end(JSON.stringify({
      haberler,
      konular,
      ceviriAcik: Boolean(process.env.ANTHROPIC_API_KEY),
      guncelleme: new Date().toISOString(),
    }));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ hata: 'Haberler alınamadı: ' + (e.message || 'bilinmeyen hata') }));
  }
}
