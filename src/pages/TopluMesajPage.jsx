import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

const KATEGORILER = ['Havuz', 'Kuyu', 'Hidrofor', 'Sulama', 'Tesisat', 'Elektrik'];
const KUYRUK_ANAHTAR = 'alkaTopluKuyruk3';
const DIGER = '__diger__';

const BAKIMLAR = [
  { grup: 'Hidrofor & Kuyu', ad: 'Hava küresi / genleşme tankı hava basıncı', periyot: '3 ayda bir',
    anahtar: ['hava küresi', 'ön şarj', 'hava basıncı', 'genleşme'],
    aciklama: 'Hava küresi, su sisteminizin kalbi gibi çalışır: içindeki hava yastığı basıncı dengeler ve pompanın gereksiz yere çalışmasını önler. Bu hava zamanla azalır; azaldığında pompa her musluk açılışında devreye girip çıkar, motor, şalter ve kontaktörler hızla yıpranır ve pompa yanabilir. 3 ayda bir yapılan basit bir hava kontrolü, pahalı bir pompa arızasının önüne geçer.' },
  { grup: 'Hidrofor & Kuyu', ad: 'Basınç şalteri ayarı', periyot: '6 ayda bir',
    anahtar: ['basınç şalteri', 'şalter'],
    aciklama: 'Basınç şalteri, pompanın ne zaman çalışıp duracağına karar verir. Ayarı kaydığında ya da kontakları yıprandığında evde su basıncı düşer veya pompa gereksiz yere çalışır. Düzenli ayar ve kontrol, hem konforunuzu hem de pompanızın ömrünü korur.' },
  { grup: 'Hidrofor & Kuyu', ad: 'Motor akım (amper) ölçümü', periyot: '6 ayda bir',
    anahtar: ['amper', 'akım ölçüm'],
    aciklama: 'Motorun çektiği akım, sağlığının en net göstergesidir. Akım yükselmeye başladıysa motor zorlanıyor, aşınma ya da tıkanma var demektir. Düzenli ölçümle arızayı pompa yanmadan görür, planlı ve daha ucuz bir müdahaleyle çözeriz.' },
  { grup: 'Hidrofor & Kuyu', ad: 'Motor ve kablo izolasyon ölçümü', periyot: 'yılda bir',
    anahtar: ['izolasyon', 'megger'],
    aciklama: 'Kuyu motoru ve kablosu sürekli suyla temas halindedir. İzolasyon zayıfladığında kaçak akım, sigorta atması ve motor sargısının yanması riski doğar. Yıllık izolasyon ölçümü hem güvenliğiniz hem de motorunuzun ömrü için önemlidir.' },
  { grup: 'Hidrofor & Kuyu', ad: 'Kontaktör ve termik röle kontrolü', periyot: '6 ayda bir',
    anahtar: ['kontaktör', 'termik', 'pano'],
    aciklama: 'Kontaktör ve termik röle, motoru elektrik tarafında koruyan parçalardır. Gevşeyen bağlantılar ısınmaya, yanlış ayarlanmış termik ise motorun korumasız kalmasına yol açar. Düzenli kontrol, pano kaynaklı arızaları ve yangın riskini azaltır.' },
  { grup: 'Hidrofor & Kuyu', ad: 'Kuyu su seviyesi ölçümü', periyot: '6 ayda bir (özellikle yaz öncesi)',
    anahtar: ['seviye', 'statik'],
    aciklama: 'Yaz aylarında kuyulardaki su seviyesi düşer. Pompa suyun üstünde kalıp kuru çalışırsa kısa sürede yanar. Seviye ölçümüyle pompanın doğru derinlikte olduğunu kontrol eder, gerekirse kuru çalışma koruması öneririz.' },
  { grup: 'Hidrofor & Kuyu', ad: 'Kuyu pompası genel kontrolü', periyot: 'yılda bir',
    anahtar: ['pompa genel', 'dalgıç', 'kuyu pompası', 'kuyu kontrol'],
    aciklama: 'Dalgıç pompa suyun altında, gözden uzakta çalıştığı için sorunları dışarıdan fark edilmez. Yıllık kontrolde basınç, debi ve çalışma durumu ölçülerek aşınma ve kum kaynaklı sorunlar erkenden yakalanır; arıza büyümeden müdahale etmek, pompanın kuyudan çıkarılma masrafını da önler.' },
  { grup: 'Hidrofor & Kuyu', ad: 'Su debisi ölçümü', periyot: 'yılda bir',
    anahtar: ['debi'],
    aciklama: 'Kuyunuzdan gelen su miktarı zamanla değişebilir. Debi ölçümü, kuyunun verimini ve pompanın doğru seçilip seçilmediğini gösterir; düşüş varsa tıkanma veya aşınmayı erkenden fark ederiz.' },

  { grup: 'Havuz', ad: 'Havuz periyodik bakım', periyot: 'ayda bir (sezonda daha sık)',
    anahtar: ['periyodik bakım', 'havuz bakım'],
    aciklama: 'Düzenli bakımda havuz suyunun kimyasal dengesi ayarlanır, dip ve yüzey temizliği yapılır, filtre ve pompa kontrol edilir. Böylece su berrak ve sağlıklı kalır, yosun ve bulanıklık oluşmadan önlenir.' },
  { grup: 'Havuz', ad: 'Su analizi (pH / klor)', periyot: 'ayda bir',
    anahtar: ['su analizi', 'ph'],
    aciklama: 'Doğru pH ve klor seviyesi hem sağlığınız hem de havuzunuz için önemlidir. Dengesiz su göz ve cilt tahrişine, kaplamada lekelere ve ekipmanlarda korozyona yol açar.' },
  { grup: 'Havuz', ad: 'Filtre ters yıkama', periyot: 'ayda bir',
    anahtar: ['ters yıkama', 'backwash'],
    aciklama: 'Filtre, havuz suyundaki kiri tutar ve zamanla dolar. Ters yıkama yapılmazsa suyun temizlenmesi zayıflar, pompa zorlanır ve elektrik tüketimi artar.' },
  { grup: 'Havuz', ad: 'Filtre kumu değişimi', periyot: '2 yılda bir',
    anahtar: ['filtre kumu', 'kum değişimi', 'medya değişimi'],
    aciklama: 'Filtre kumu zamanla aşınıp yuvarlaklaşır ve kiri tutma özelliğini kaybeder. Kum değişmezse kimyasal ne kadar kullanılsa da su bulanık kalır. Değişim, filtrenin ilk günkü performansına dönmesini sağlar.' },
  { grup: 'Havuz', ad: 'Pompa ön filtre sepeti temizliği', periyot: 'ayda bir',
    anahtar: ['ön filtre', 'sepet'],
    aciklama: 'Ön filtre sepeti yaprak ve kiri pompaya girmeden tutar. Tıkandığında pompa hava yapar, susuz çalışır ve salmastrası zarar görür.' },
  { grup: 'Havuz', ad: 'Havuz motoru kontrolü', periyot: 'yılda bir',
    anahtar: ['havuz motoru', 'salmastra', 'rulman'],
    aciklama: 'Havuz motoru sezon boyunca her gün saatlerce çalışır. Salmastra sızıntısı ve rulman sesi erken fark edilmezse motor yanabilir. Yıllık kontrol, sezon ortasında havuzsuz kalmanızı önler.' },
  { grup: 'Havuz', ad: 'Isı pompası bakımı', periyot: 'yılda bir',
    anahtar: ['ısı pompası', 'evaporatör', 'lamel', 'gaz basıncı'],
    aciklama: 'Isı pompasının lamelleri toz ve tuzla kaplandıkça ısıtma verimi düşer, elektrik faturası artar. Temizlik ve gaz basıncı kontrolüyle cihaz daha az enerjiyle daha hızlı ısıtır.' },
  { grup: 'Havuz', ad: 'Tuz klor hücresi temizliği', periyot: '3 ayda bir',
    anahtar: ['hücre', 'tuz'],
    aciklama: 'Tuz klor jeneratörünün hücresi zamanla kireç tutar ve klor üretimi düşer. Temizlik yapılmazsa hücre ömrü kısalır; hücre değişimi ise yüksek maliyetlidir.' },

  { grup: 'Sulama', ad: 'Sulama sezon açılışı', periyot: 'her yıl Nisan',
    anahtar: ['sulama sezon açılış', 'sulamasını açma'],
    aciklama: 'Kış sonrası sulama hatlarında tıkanma, kırık başlık ve kaçaklar olabilir. Sezon başında sistemi kontrol edip programı ayarlayarak bahçenizin ilk sıcaklarda susuz kalmasını önleriz.' },
  { grup: 'Sulama', ad: 'Sulama sezon kapanışı ve boşaltma', periyot: 'her yıl Ekim',
    anahtar: ['sulama sezon kapan', 'boşaltma', 'sulamayı kapatma'],
    aciklama: 'Kışın hatlarda kalan su donarak boruları, vanaları ve pompayı çatlatabilir. Sezon sonunda sistemi boşaltıp kapatmak, baharda sürpriz masrafları önler.' },
  { grup: 'Sulama', ad: 'Sulama filtresi ve damla uç temizliği', periyot: '3 ayda bir',
    anahtar: ['sulama filtre', 'damla', 'nozul', 'hat yıkama'],
    aciklama: 'Tıkanan filtre ve damlatıcılar bitkilerin eşit su almasını engeller; bazı bölgeler kururken bazıları fazla su alır. Düzenli temizlik hem bahçenizi hem de suyunuzu korur.' },

  { grup: 'Havuz', ad: 'Havuz sezon açılışı', periyot: 'her yıl Mayıs',
    anahtar: ['sezon açılış', 'yaz öncesi', 'sezon öncesi'],
    aciklama: 'Kış boyunca bekleyen havuzda su dengesi bozulur, ekipmanlar uzun süre çalışmamıştır. Sezon açılışında temizlik, kimyasal ayar ve tüm ekipman kontrolüyle havuzunuzu yaza hazır hale getiririz.' },
  { grup: 'Havuz', ad: 'Havuz sezon kapanışı', periyot: 'her yıl Kasım',
    anahtar: ['sezon kapanış', 'kapatma', 'koruma modu'],
    aciklama: 'Doğru yapılmayan kapanış, kışın donma ve yosun nedeniyle bahar aylarında pahalı onarımlara yol açar. Kapanışta su seviyesi, kimyasallar ve ekipmanlar kışa uygun şekilde hazırlanır.' },

  { grup: 'Genel', ad: 'Kış (don) kontrolü', periyot: 'her yıl kış öncesi',
    anahtar: ['kış', 'don'],
    aciklama: 'Don olan gecelerde açıktaki borular, pompa gövdeleri ve hidrofor tankları çatlayabilir. Kış öncesi yalıtım ve kontrolle bu hasarları önleriz.' },
  { grup: 'Genel', ad: 'Su deposu temizliği', periyot: 'yılda bir',
    anahtar: ['depo', 'dezenfeksiyon'],
    aciklama: 'Depolarda zamanla tortu birikir ve bakteri üreyebilir. Yıllık temizlik ve dezenfeksiyon, evinize gelen suyun temiz ve sağlıklı olmasını sağlar.' },
  { grup: 'Genel', ad: 'Termosifon anot kontrolü', periyot: 'yılda bir',
    anahtar: ['anot', 'termosifon', 'emniyet ventili', 'kireç'],
    aciklama: 'Termosifonun içindeki magnezyum anot, tankın paslanmasını önlemek için kendini feda eder. Anot bittiğinde tank delinir; zamanında değişim cihazın ömrünü yıllarca uzatır.' },
  { grup: 'Genel', ad: 'Su arıtma filtre değişimi', periyot: '6 ayda bir',
    anahtar: ['kartuş', 'membran', 'arıtma'],
    aciklama: 'Süresi dolan filtreler kiri tutamaz, hatta biriktirdiği kiri suya geri verebilir. Zamanında değişim, içtiğiniz suyun kalitesini korur.' },
  { grup: 'Genel', ad: 'Kaçak akım ve topraklama testi', periyot: 'yılda bir',
    anahtar: ['kaçak akım', 'topraklama'],
    aciklama: 'Kaçak akım rölesi ve topraklama, su ile elektriğin bir arada olduğu havuz ve kuyu sistemlerinde hayati güvenlik önlemleridir. Yıllık test, sizi ve ailenizi elektrik çarpmasına karşı korur.' },
];

const GRUPLAR = ['Hidrofor & Kuyu', 'Havuz', 'Sulama', 'Genel'];
const GENEL_ACIKLAMA = 'Düzenli bakım, arızaları büyümeden fark etmemizi sağlar ve cihazlarınızın ömrünü uzatır.';

function bakimBul(konu) {
  if (!konu) return null;
  const tam = BAKIMLAR.find((b) => b.ad === konu);
  if (tam) return tam;
  const k = konu.toLocaleLowerCase('tr-TR');
  return BAKIMLAR.find((b) => b.anahtar.some((a) => k.includes(a))) || null;
}

const BILGI_SABLON =
  'Merhaba {ad},\n\n🔧 *{bakim}* zamanınız yaklaşıyor.\n\n{aciklama}\n\n📅 Önerilen sıklık: {periyot}\n\nRandevu için bu mesajı yanıtlamanız yeterli.\n\nALKA Havuz · 0533 371 39 35';

const SABLONLAR = [
  { ad: 'Bakım hatırlatması (bilgilendirici)', metin: BILGI_SABLON },
  { ad: 'Kısa bakım hatırlatması', metin:
    'Merhaba {ad}, {bakim} zamanınız yaklaşıyor. Uygun olduğunuz bir gün için bu mesajı yanıtlamanız yeterli.\n\nALKA Havuz · 0533 371 39 35' },
  { ad: 'Sezon açılışı', metin:
    'Merhaba {ad}, yaz sezonu yaklaşıyor ☀️ Havuzunuzun sezon açılışı ve genel bakımı için randevu oluşturmak ister misiniz? Bu mesajı yanıtlamanız yeterli.\n\nALKA Havuz · 0533 371 39 35' },
  { ad: 'Kış öncesi kontrol', metin:
    'Merhaba {ad}, soğuklar yaklaşıyor ❄️ Kuyu pompası, hidrofor ve sulama hatlarınızın dona karşı kontrolü için randevu oluşturabiliriz.\n\nALKA Havuz · 0533 371 39 35' },
  { ad: 'Geliş tarihi sorma', metin:
    "Merhaba {ad}, Çeşme'ye ne zaman geleceğinizi bize bildirirseniz, siz gelmeden havuzunuzu ve sistemlerinizi hazırlayalım 🏡\n\nALKA Havuz · 0533 371 39 35" },
  { ad: 'Kampanya / indirim', metin:
    'Merhaba {ad}, bu aya özel {bakim} hizmetimizde indirim fırsatı var! Detaylar için bu mesajı yanıtlayabilirsiniz.\n\nALKA Havuz · 0533 371 39 35' },
  { ad: 'Bayram tebriği', metin:
    'Merhaba {ad}, bayramınızı en içten dileklerimizle kutlar, sağlıklı ve mutlu günler dileriz.\n\nALKA Havuz · Volkan Gülcemal' },
];

const OZEL_FILTRELER = [
  { id: 'hepsi', ad: 'Tümü' },
  { id: 'bakim30', ad: 'Bakımı 30 gün içinde / gecikmiş' },
  { id: 'gecikmis', ad: 'Sadece bakımı gecikmiş' },
  { id: 'gelis', ad: 'Önümüzdeki 60 günde gelecekler' },
];

const yerel = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function gunEkle(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return yerel(d);
}

function telefonWa(tel) {
  if (!tel) return null;
  let n = tel.replace(/\D/g, '');
  if (n.length < 10) return null;
  if (n.startsWith('0')) n = '9' + n;
  if (!n.startsWith('90')) n = '90' + n;
  return n;
}

function kisisel(metin, ad, konu) {
  const b = bakimBul(konu);
  return metin
    .replace(/\{ad\}/g, ad || '')
    .replace(/\{bakim\}/g, konu || b?.ad || 'Periyodik bakım')
    .replace(/\{aciklama\}/g, b?.aciklama || GENEL_ACIKLAMA)
    .replace(/\{periyot\}/g, b?.periyot || 'düzenli aralıklarla');
}

const trSaat = (t) => new Date(t).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function enYakinBakim(m) {
  const kurallar = (m.equipment || []).flatMap((e) =>
    (e.maintenance_rules || []).filter((k) => k.active !== false && k.next_due_date)
  );
  kurallar.sort((a, b) => a.next_due_date.localeCompare(b.next_due_date));
  const ad = kurallar[0]?.rule_name || '';
  const eslesen = bakimBul(ad);
  return eslesen ? eslesen.ad : ad;
}

function BakimSecenekleri({ ekstra }) {
  return (
    <>
      {ekstra && !BAKIMLAR.some((b) => b.ad === ekstra) && <option value={ekstra}>🔧 {ekstra}</option>}
      {GRUPLAR.map((g) => (
        <optgroup key={g} label={g}>
          {BAKIMLAR.filter((b) => b.grup === g).map((b) => <option key={b.ad} value={b.ad}>{b.ad}</option>)}
        </optgroup>
      ))}
    </>
  );
}

const bosYeni = { ad: '', tel: '', adres: '', konu: '', konuDiger: '' };

export default function TopluMesajPage() {
  const [musteriler, setMusteriler] = useState([]);
  const [kayitlar, setKayitlar] = useState([]);
  const [gonderen, setGonderen] = useState('');
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState('');
  const [bilgi, setBilgi] = useState('');

  const [kategori, setKategori] = useState('');
  const [adresArama, setAdresArama] = useState('');
  const [ozel, setOzel] = useState('hepsi');
  const [baslik, setBaslik] = useState('Bakım hatırlatması (bilgilendirici)');
  const [metin, setMetin] = useState(BILGI_SABLON);
  const [haric, setHaric] = useState([]);
  const [konular, setKonular] = useState({});
  const [elleEklenen, setElleEklenen] = useState([]);

  const [yeniAcik, setYeniAcik] = useState(false);
  const [yeni, setYeni] = useState(bosYeni);
  const [ekleniyor, setEkleniyor] = useState(false);

  const [kuyruk, setKuyruk] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KUYRUK_ANAHTAR)) || null; } catch { return null; }
  });

  async function yukle() {
    const [m, k, u] = await Promise.all([
      supabase.from('customers')
        .select('id, name, phone, address, equipment(category, maintenance_rules(rule_name, next_due_date, active)), gelisler(gelis_tarihi, durum)')
        .order('name', { ascending: true }),
      supabase.from('mesaj_kayitlari')
        .select('*, customers(name)')
        .order('created_at', { ascending: false })
        .limit(15),
      supabase.auth.getUser(),
    ]);
    if (m.error) setHata(m.error.message);
    setMusteriler(m.data || []);
    setKayitlar(k.data || []);
    const meta = u.data?.user?.user_metadata || {};
    setGonderen(meta.ad || (u.data?.user?.email || '').split('@')[0]);
    setYukleniyor(false);
  }

  useEffect(() => { yukle(); }, []);

  useEffect(() => {
    if (kuyruk) localStorage.setItem(KUYRUK_ANAHTAR, JSON.stringify(kuyruk));
    else localStorage.removeItem(KUYRUK_ANAHTAR);
  }, [kuyruk]);

  const bugun = yerel(new Date());
  const otuzGun = gunEkle(30);
  const altmisGun = gunEkle(60);

  const filtreyeUyan = musteriler.filter((m) => {
    const cihazlar = m.equipment || [];
    if (kategori && !cihazlar.some((e) => e.category === kategori)) return false;
    if (adresArama.trim() && !(m.address || '').toLocaleLowerCase('tr-TR').includes(adresArama.trim().toLocaleLowerCase('tr-TR'))) return false;
    const tarihler = cihazlar.flatMap((e) => (e.maintenance_rules || []).filter((k) => k.active !== false && k.next_due_date).map((k) => k.next_due_date));
    if (ozel === 'bakim30' && !tarihler.some((t) => t <= otuzGun)) return false;
    if (ozel === 'gecikmis' && !tarihler.some((t) => t < bugun)) return false;
    if (ozel === 'gelis' && !(m.gelisler || []).some((g) => g.durum !== 'iptal' && g.gelis_tarihi >= bugun && g.gelis_tarihi <= altmisGun)) return false;
    return true;
  });

  const eslesenler = [
    ...musteriler.filter((m) => elleEklenen.includes(m.id) && !filtreyeUyan.includes(m)),
    ...filtreyeUyan,
  ];
  const telefonsuz = eslesenler.filter((m) => !telefonWa(m.phone));
  const uygunlar = eslesenler.filter((m) => telefonWa(m.phone));
  const alicilar = uygunlar.filter((m) => !haric.includes(m.id));
  const konuBul = (m) => (konular[m.id] !== undefined ? konular[m.id] : enYakinBakim(m));

  function sablonSec(ad) {
    const sb = SABLONLAR.find((x) => x.ad === ad);
    if (!sb) return;
    setMetin(sb.metin);
    setBaslik(sb.ad);
  }

  function haricDegistir(id) {
    setHaric(haric.includes(id) ? haric.filter((x) => x !== id) : [...haric, id]);
  }

  async function numaraEkle(e) {
    e.preventDefault();
    setHata('');
    setBilgi('');
    const numara = telefonWa(yeni.tel);
    if (!yeni.ad.trim()) { setHata('Ad soyad yazın.'); return; }
    if (!numara) { setHata('Geçerli bir telefon numarası yazın (örn: 0532 111 22 33).'); return; }
    const konu = yeni.konu === DIGER ? yeni.konuDiger.trim() : yeni.konu;

    const mevcut = musteriler.find((m) => telefonWa(m.phone) === numara);
    if (mevcut) {
      setElleEklenen((l) => [...new Set([...l, mevcut.id])]);
      setHaric((h) => h.filter((x) => x !== mevcut.id));
      if (konu) setKonular((k) => ({ ...k, [mevcut.id]: konu }));
      setBilgi(`Bu numara zaten "${mevcut.name}" adıyla kayıtlı; listeye eklendi.`);
      setYeni(bosYeni);
      return;
    }

    setEkleniyor(true);
    const { data, error } = await supabase.from('customers')
      .insert([{ name: yeni.ad.trim(), phone: yeni.tel.trim(), address: yeni.adres.trim() }])
      .select('id')
      .single();
    setEkleniyor(false);
    if (error) { setHata(error.message); return; }
    setElleEklenen((l) => [...l, data.id]);
    if (konu) setKonular((k) => ({ ...k, [data.id]: konu }));
    setBilgi(`${yeni.ad.trim()} müşteri olarak kaydedildi ve listeye eklendi.`);
    setYeni(bosYeni);
    yukle();
  }

  function baslat() {
    setHata('');
    if (!metin.trim()) { setHata('Önce mesajı yazın ya da bir şablon seçin.'); return; }
    if (!alicilar.length) { setHata('Gönderilecek kimse yok.'); return; }
    setKuyruk({
      metin,
      baslik: baslik || 'Toplu mesaj',
      liste: alicilar.map((m) => ({ id: m.id, name: m.name, phone: m.phone, bakim: konuBul(m) })),
      sira: 0,
      gonderilen: [],
      atlanan: [],
    });
    window.scrollTo(0, 0);
  }

  async function gonder() {
    const m = kuyruk.liste[kuyruk.sira];
    const numara = telefonWa(m.phone);
    const mesaj = kisisel(kuyruk.metin, m.name, m.bakim);
    window.open(`https://wa.me/${numara}?text=${encodeURIComponent(mesaj)}`, '_blank');
    await supabase.from('mesaj_kayitlari').insert([{
      customer_id: m.id, kanal: 'whatsapp', tur: 'bilgilendirme',
      baslik: m.bakim ? `${kuyruk.baslik} · ${m.bakim}` : kuyruk.baslik, mesaj, gonderen,
    }]);
    setKuyruk({ ...kuyruk, gonderilen: [...kuyruk.gonderilen, m.id], sira: kuyruk.sira + 1 });
  }

  function atla() {
    const m = kuyruk.liste[kuyruk.sira];
    setKuyruk({ ...kuyruk, atlanan: [...kuyruk.atlanan, m.id], sira: kuyruk.sira + 1 });
  }

  function geri() {
    if (kuyruk.sira > 0) setKuyruk({ ...kuyruk, sira: kuyruk.sira - 1 });
  }

  function bitir() {
    if (kuyruk.sira < kuyruk.liste.length && !window.confirm('Gönderim yarıda kalacak. Bitirilsin mi?')) return;
    setKuyruk(null);
    setHaric([]);
    setElleEklenen([]);
    yukle();
  }

  if (yukleniyor) return <div style={s.sayfa}><p style={s.soluk}>Yükleniyor...</p></div>;

  if (kuyruk) {
    const toplam = kuyruk.liste.length;
    const bitti = kuyruk.sira >= toplam;
    const m = bitti ? null : kuyruk.liste[kuyruk.sira];
    const yuzde = Math.round((kuyruk.sira / toplam) * 100);
    return (
      <div style={s.sayfa}>
        <h1 style={s.baslik}>📣 Toplu Mesaj Gönderiliyor</h1>
        <p style={s.soluk}>{kuyruk.baslik}</p>

        <div style={s.kart}>
          <div style={s.ilerlemeUst}>
            <b>{Math.min(kuyruk.sira, toplam)} / {toplam}</b>
            <span style={s.soluk}>✓ {kuyruk.gonderilen.length} gönderildi · ↷ {kuyruk.atlanan.length} atlandı</span>
          </div>
          <div style={s.ilerlemeArka}><div style={{ ...s.ilerlemeOn, width: `${yuzde}%` }} /></div>

          {bitti ? (
            <div style={{ textAlign: 'center', padding: '24px 0 6px' }}>
              <div style={{ fontSize: 48 }}>🎉</div>
              <div style={s.buyukYazi}>Gönderim tamamlandı</div>
              <p style={s.soluk}>{kuyruk.gonderilen.length} kişiye mesaj açıldı ve kayda geçti.</p>
              <button style={s.anaBtn} onClick={bitir}>Tamam</button>
            </div>
          ) : (
            <>
              <div style={s.siradaki}>
                <div style={s.soluk}>Sıradaki</div>
                <div style={s.buyukYazi}>{m.name}</div>
                <div style={s.soluk}>📞 {m.phone}{m.bakim ? ` · 🔧 ${m.bakim}` : ''}</div>
              </div>
              <div style={s.onizleme}>{kisisel(kuyruk.metin, m.name, m.bakim)}</div>
              <div style={s.kuyrukButonlar}>
                <button style={s.gonderBtn} onClick={gonder}>💬 WhatsApp'ta aç ve sıradakine geç</button>
                <button style={s.atlaBtn} onClick={atla}>↷ Atla</button>
                {kuyruk.sira > 0 && <button style={s.atlaBtn} onClick={geri}>‹ Geri</button>}
              </div>
              <p style={{ ...s.soluk, marginTop: 12 }}>
                WhatsApp açılınca mesaj hazır gelir; gönder tuşuna basıp bu sayfaya dönün, sıradaki kişi hazır olacak.
                Sayfayı kapatsanız bile kaldığınız yerden devam edebilirsiniz.
              </p>
            </>
          )}
          {!bitti && <button style={s.bitirBtn} onClick={bitir}>Gönderimi bitir</button>}
        </div>
      </div>
    );
  }

  return (
    <div style={s.sayfa}>
      <h1 style={s.baslik}>📣 Toplu Mesaj</h1>
      <p style={s.soluk}>Kendi WhatsApp'ınızdan, müşterilerinize sırayla ve kişiye özel mesaj</p>

      {hata && <div style={s.hata}>{hata}</div>}
      {bilgi && <div style={s.basari}>✓ {bilgi}</div>}

      <div style={s.kart}>
        <div style={s.bolum}>1. Kime gönderilecek?</div>
        <div style={s.chipler}>
          <button style={{ ...s.chip, ...(!kategori ? s.chipSecili : {}) }} onClick={() => setKategori('')}>Tüm müşteriler</button>
          {KATEGORILER.map((k) => (
            <button key={k} style={{ ...s.chip, ...(kategori === k ? s.chipSecili : {}) }} onClick={() => setKategori(k)}>
              {k}
            </button>
          ))}
        </div>
        <div style={{ ...s.grid, marginTop: 12 }}>
          <label style={s.etiket}>Adreste geçen kelime
            <input style={s.input} placeholder="Örn: Alaçatı, Ilıca, Dalyan" value={adresArama}
              onChange={(e) => setAdresArama(e.target.value)} />
          </label>
          <label style={s.etiket}>Özel filtre
            <select style={s.input} value={ozel} onChange={(e) => setOzel(e.target.value)}>
              {OZEL_FILTRELER.map((f) => <option key={f.id} value={f.id}>{f.ad}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div style={s.kart}>
        <div style={s.bolum}>2. Mesaj</div>
        <label style={s.etiket}>Hazır şablon
          <select style={s.input} value="" onChange={(e) => sablonSec(e.target.value)}>
            <option value="">Şablon değiştir...</option>
            {SABLONLAR.map((sb) => <option key={sb.ad} value={sb.ad}>{sb.ad}</option>)}
          </select>
        </label>
        <label style={{ ...s.etiket, marginTop: 12 }}>Mesaj metni
          <textarea style={{ ...s.input, minHeight: 170, fontFamily: 'inherit', lineHeight: 1.5 }} value={metin}
            onChange={(e) => setMetin(e.target.value)} />
        </label>
        <div style={s.ipucu}>
          Otomatik dolan alanlar: <b>{'{ad}'}</b> müşterinin adı · <b>{'{bakim}'}</b> bakım adı ·
          <b> {'{aciklama}'}</b> o bakımın neden önemli olduğu · <b>{'{periyot}'}</b> önerilen sıklık
        </div>
        {metin && alicilar[0] && (
          <div style={{ marginTop: 12 }}>
            <div style={s.soluk}>Önizleme ({alicilar[0].name} için):</div>
            <div style={s.onizleme}>{kisisel(metin, alicilar[0].name, konuBul(alicilar[0]))}</div>
          </div>
        )}
      </div>

      <div style={s.kart}>
        <div style={s.bolumSatir}>
          <div style={s.bolum}>3. Alıcılar ({alicilar.length})</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={s.ikincilBtn} onClick={() => { setYeniAcik(!yeniAcik); setBilgi(''); }}>
              {yeniAcik ? 'Kapat' : '+ Numara ekle'}
            </button>
            <button style={s.anaBtn} onClick={baslat} disabled={!alicilar.length}>▶ Gönderimi başlat</button>
          </div>
        </div>

        {yeniAcik && (
          <form onSubmit={numaraEkle} style={s.yeniKutu}>
            <div style={s.grid}>
              <label style={s.etiket}>Ad Soyad *
                <input style={s.input} placeholder="Örn: Mehmet Yılmaz" value={yeni.ad}
                  onChange={(e) => setYeni({ ...yeni, ad: e.target.value })} />
              </label>
              <label style={s.etiket}>Telefon *
                <input style={s.input} type="tel" placeholder="0532 111 22 33" value={yeni.tel}
                  onChange={(e) => setYeni({ ...yeni, tel: e.target.value })} />
              </label>
              <label style={s.etiket}>Adres (isteğe bağlı)
                <input style={s.input} placeholder="Örn: Alaçatı" value={yeni.adres}
                  onChange={(e) => setYeni({ ...yeni, adres: e.target.value })} />
              </label>
              <label style={s.etiket}>Hangi bakım için?
                <select style={s.input} value={yeni.konu} onChange={(e) => setYeni({ ...yeni, konu: e.target.value })}>
                  <option value="">Seçilmedi</option>
                  <BakimSecenekleri />
                  <option value={DIGER}>Diğer (yazacağım)</option>
                </select>
              </label>
            </div>
            {yeni.konu === DIGER && (
              <input style={{ ...s.input, marginTop: 10 }} placeholder="Bakım / iş konusunu yazın" value={yeni.konuDiger}
                onChange={(e) => setYeni({ ...yeni, konuDiger: e.target.value })} />
            )}
            <button type="submit" disabled={ekleniyor} style={{ ...s.anaBtn, marginTop: 12, opacity: ekleniyor ? 0.6 : 1 }}>
              {ekleniyor ? 'Ekleniyor...' : 'Listeye ekle'}
            </button>
            <div style={{ ...s.soluk, marginTop: 8 }}>Eklenen kişi Müşteriler sayfasına da kaydedilir.</div>
          </form>
        )}

        {telefonsuz.length > 0 && (
          <div style={s.uyari}>📵 {telefonsuz.length} müşterinin telefonu kayıtlı olmadığı için listede yok.</div>
        )}

        {uygunlar.map((m) => {
          const dahil = !haric.includes(m.id);
          const konu = konuBul(m);
          return (
            <div key={m.id} style={s.aliciSatir}>
              <input type="checkbox" checked={dahil} onChange={() => haricDegistir(m.id)} style={{ width: 20, height: 20, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 150 }}>
                <div style={s.aliciAd}>{m.name}{elleEklenen.includes(m.id) && <span style={s.yeniRozet}>elle eklendi</span>}</div>
                <div style={s.soluk}>{m.phone}{m.address ? ` · ${m.address}` : ''}</div>
              </div>
              <select style={s.konuSec} value={konu} onChange={(e) => setKonular({ ...konular, [m.id]: e.target.value })}>
                <option value="">🔧 Bakım seçilmedi</option>
                <BakimSecenekleri ekstra={konu} />
              </select>
            </div>
          );
        })}
        {eslesenler.length === 0 && <p style={s.soluk}>Bu filtrelere uyan müşteri yok. "+ Numara ekle" ile elle ekleyebilirsiniz.</p>}
      </div>

      <div style={s.kart}>
        <div style={s.bolum}>🕘 Son gönderilen mesajlar</div>
        {kayitlar.length === 0 ? (
          <p style={s.soluk}>Henüz kayıt yok.</p>
        ) : (
          kayitlar.map((k) => (
            <div key={k.id} style={s.kayitSatir}>
              <span style={{ flex: 1 }}><b>{k.customers?.name || '-'}</b> · {k.baslik || 'Mesaj'}</span>
              <span style={s.soluk}>{trSaat(k.created_at)}{k.gonderen ? ` · ${k.gonderen}` : ''}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const s = {
  sayfa: { padding: 20, maxWidth: 900, margin: '0 auto', fontFamily: 'system-ui, sans-serif' },
  baslik: { margin: 0, fontSize: 26, color: '#0f2d4a' },
  soluk: { fontSize: 14, color: '#64748b', margin: '4px 0 0' },
  hata: { background: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 10, margin: '14px 0' },
  basari: { background: '#dcfce7', color: '#166534', padding: 12, borderRadius: 10, margin: '14px 0' },
  kart: { background: '#fff', borderRadius: 16, padding: 20, marginTop: 16, boxShadow: '0 2px 12px rgba(15,45,74,0.08)' },
  bolum: { fontSize: 17, fontWeight: 800, color: '#0f2d4a', marginBottom: 12 },
  bolumSatir: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 },
  etiket: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, color: '#334155' },
  input: { padding: '11px 12px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 15, width: '100%', boxSizing: 'border-box', background: '#fff' },
  ipucu: { marginTop: 8, fontSize: 12, color: '#64748b', lineHeight: 1.6 },
  chipler: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: { padding: '10px 14px', borderRadius: 22, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 14, color: '#1e293b' },
  chipSecili: { background: '#1d6fe0', color: '#fff', borderColor: '#1d6fe0' },
  onizleme: { marginTop: 6, background: '#dcf8c6', borderRadius: 12, padding: '12px 14px', whiteSpace: 'pre-wrap', fontSize: 15, color: '#111827', lineHeight: 1.5 },
  uyari: { background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 12, fontSize: 14, color: '#92400e', margin: '8px 0 12px' },
  yeniKutu: { background: '#f8fafc', border: '1px dashed #93c5fd', borderRadius: 12, padding: 14, margin: '10px 0 14px' },
  aliciSatir: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid #eef2f6', flexWrap: 'wrap' },
  aliciAd: { fontWeight: 700, color: '#0f2d4a' },
  yeniRozet: { marginLeft: 8, fontSize: 11, background: '#ede9fe', color: '#6d28d9', padding: '2px 8px', borderRadius: 10, fontWeight: 700 },
  konuSec: { padding: '8px 10px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 13, background: '#fff', maxWidth: 300 },
  anaBtn: { background: 'linear-gradient(135deg,#1d6fe0,#2563eb)', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 15 },
  ikincilBtn: { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 12, padding: '12px 16px', fontWeight: 700, cursor: 'pointer', fontSize: 15 },
  kayitSatir: { display: 'flex', gap: 10, flexWrap: 'wrap', padding: '9px 0', borderTop: '1px solid #eef2f6', fontSize: 14, color: '#334155' },
  ilerlemeUst: { display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 8, color: '#0f2d4a' },
  ilerlemeArka: { height: 10, borderRadius: 5, background: '#eef2f6', overflow: 'hidden' },
  ilerlemeOn: { height: '100%', background: 'linear-gradient(90deg,#16a34a,#22c55e)', transition: 'width 0.3s' },
  siradaki: { textAlign: 'center', padding: '22px 0 10px' },
  buyukYazi: { fontSize: 24, fontWeight: 800, color: '#0f2d4a', margin: '4px 0' },
  kuyrukButonlar: { display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 16 },
  gonderBtn: { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 12, padding: '15px 22px', fontWeight: 800, cursor: 'pointer', fontSize: 16 },
  atlaBtn: { background: '#fff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: 12, padding: '15px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 15 },
  bitirBtn: { display: 'block', margin: '18px auto 0', background: 'none', border: 'none', color: '#dc2626', fontWeight: 700, cursor: 'pointer', fontSize: 14 },
};
