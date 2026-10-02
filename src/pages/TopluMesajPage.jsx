import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

const KATEGORILER = ['Havuz', 'Kuyu', 'Hidrofor', 'Sulama', 'Tesisat', 'Elektrik'];
const KUYRUK_ANAHTAR = 'alkaTopluKuyruk3';
const DIGER = '__diger__';

const BAKIMLAR = [
  { grup: 'Hidrofor & Kuyu', ad: 'Hava küresi / genleşme tankı hava basıncı', periyot: '3 ayda bir',
    anahtar: ['hava küresi', 'ön şarj', 'hava basıncı', 'genleşme'],
    giris: "Evinizdeki su konforunun ve kuyu-havuz su sistemlerinizin \"kalbi\" aslında görünmeyen bir detayda saklıdır: Genleşme (hidrofor) tankları. İçlerindeki hava yastığı su basıncını dengeler ve pompanın gereksiz yere çalışmasını önler. Sisteminizin kusursuz ve uzun ömürlü çalışması için bu tankların hava basıncının *3 ayda bir* kontrol edilip tazelenmesi hayati önem taşır.",
    riskler: [
      ["Sürekli \"dur-kalk\" ve sargı yanması", "Tanktaki hava azaldığında sistem yastıklama yapamaz; her musluk açılışında motor anlık olarak devreye girip çıkar. Bu durum motor sargılarını yakar, elektrik faturanızı yükseltir."],
      ["Membran (iç lastik) patlaması", "Hava yastığı kalmayan tankın membranı sürekli zorlanarak kısa sürede yırtılır. Tank tamamen suyla dolar ve işlevini yitirir."],
      ["Zincirleme arızalar", "Dengesiz su basıncı vanalarınızı, armatürlerinizi ve pompanızı yorar; sizi bir gün susuz ve yüksek tamir masraflarıyla baş başa bırakır."],
    ] },
  { grup: 'Hidrofor & Kuyu', ad: 'Basınç şalteri ayarı', periyot: '6 ayda bir',
    anahtar: ['basınç şalteri', 'şalter'],
    giris: "Basınç şalteri, su sisteminizin \"beyni\"dir: pompanın ne zaman çalışıp ne zaman duracağına o karar verir. Zamanla ayarı kayar, kontakları yıpranır. Evinizde her zaman dengeli ve güçlü su basıncı olması için şalterin *6 ayda bir* kontrol edilip ayarlanması gerekir.",
    riskler: [
      ["Düşük ve dengesiz basınç", "Ayarı kayan şalter pompayı geç devreye sokar; duşta ve muslukta su bir güçlü bir zayıf akar, konforunuz bozulur."],
      ["Durmayan pompa", "Şalter doğru basınçta kesmezse pompa durmadan çalışır; motor aşırı ısınır, elektrik tüketimi katlanır."],
      ["Kontak yanması ve susuz kalma", "Yıpranan kontaklar ark yaparak yanar ve pompa hiç çalışmaz hale gelir. Arıza çoğu zaman en ihtiyaç duyduğunuz anda ortaya çıkar."],
    ] },
  { grup: 'Hidrofor & Kuyu', ad: 'Motor akım (amper) ölçümü', periyot: '6 ayda bir',
    anahtar: ['amper', 'akım ölçüm'],
    giris: "Bir motorun çektiği akım, tıpkı insanın nabzı gibi sağlığının en net göstergesidir. Akım yükselmeye başladıysa motor zorlanıyor, içeride aşınma ya da tıkanma başlamış demektir. *6 ayda bir* yapılan amper ölçümüyle sorunu motor yanmadan önce görürüz.",
    riskler: [
      ["Fark edilmeden ilerleyen zorlanma", "Aşınmış rulman veya kum yüzünden zorlanan motor dışarıdan normal çalışıyor gibi görünür ama her gün biraz daha yıpranır."],
      ["Ani motor yanması", "Yüksek akımla çalışmaya devam eden motorun sargıları ısınır ve bir gün aniden yanar; motor sarımı veya değişimi gerekir."],
      ["Plansız ve pahalı müdahale", "Erken fark edilen sorun basit bir bakımla çözülürken, yanan motor acil servis, parça ve işçilik masrafı demektir."],
    ] },
  { grup: 'Hidrofor & Kuyu', ad: 'Motor ve kablo izolasyon ölçümü', periyot: 'yılda bir',
    anahtar: ['izolasyon', 'megger'],
    giris: "Kuyu motorunuz ve kablosu yıl boyu suyun içinde, gözden uzakta çalışır. Zamanla kablo ve ek yerlerindeki izolasyon zayıflar. Hem güvenliğiniz hem de motorunuzun ömrü için izolasyonun *yılda bir* ölçülmesi gerekir.",
    riskler: [
      ["Kaçak akım ve can güvenliği", "İzolasyonu zayıflayan kablodan suya akım kaçar; bu durum su ve elektriğin bir arada olduğu sistemlerde ciddi bir güvenlik riskidir."],
      ["Sürekli atan sigortalar", "Kaçak akım rölesi ve sigortalar sık sık atar, sistem sebepsiz yere durur ve evde su kesilir."],
      ["Motor sargısının yanması", "Nem alan sargılar kısa devre yaparak yanar. Bu noktada motorun kuyudan çıkarılması ve sarılması gibi yüksek maliyetli işlemler kaçınılmaz olur."],
    ] },
  { grup: 'Hidrofor & Kuyu', ad: 'Kontaktör ve termik röle kontrolü', periyot: '6 ayda bir',
    anahtar: ['kontaktör', 'termik', 'pano'],
    giris: "Elektrik panonuzdaki kontaktör ve termik röle, motorunuzun \"koruma kalkanı\"dır. Motoru aşırı akıma karşı korur, güvenli şekilde açıp kapatır. Bağlantıların gevşememesi ve korumanın doğru çalışması için *6 ayda bir* kontrol edilmeleri gerekir.",
    riskler: [
      ["Gevşek bağlantı ve ısınma", "Titreşimle gevşeyen klemensler ısınır, kararır ve erir; panoda koku ve duman başlar."],
      ["Korumasız kalan motor", "Yanlış ayarlı veya arızalı termik röle, motor zorlandığında devreyi kesmez ve motor kendini koruyamadan yanar."],
      ["Yangın riski", "Isınan pano parçaları yangına kadar varan tehlikeli sonuçlar doğurabilir. Düzenli kontrol bu riski en aza indirir."],
    ] },
  { grup: 'Hidrofor & Kuyu', ad: 'Kuyu su seviyesi ölçümü', periyot: '6 ayda bir (özellikle yaz öncesi)',
    anahtar: ['seviye', 'statik'],
    giris: "Kuyunuzdaki su seviyesi mevsimden mevsime değişir; özellikle yaz aylarında belirgin şekilde düşer. Pompanın her zaman suyun içinde, doğru derinlikte çalıştığından emin olmak için seviyenin *6 ayda bir*, özellikle yaz öncesinde ölçülmesi gerekir.",
    riskler: [
      ["Kuru çalışma", "Su seviyesi pompanın altına indiğinde pompa susuz çalışır. Soğutulamayan motor dakikalar içinde ısınır."],
      ["Pompanın yanması", "Kuru çalışmaya devam eden dalgıç pompa kısa sürede yanar; kuyudan çıkarma ve değişim masrafı doğar."],
      ["Yazın ortasında susuz kalma", "Sorun genellikle suya en çok ihtiyaç duyduğunuz sıcak günlerde ortaya çıkar; bahçe, havuz ve ev aynı anda susuz kalır."],
    ] },
  { grup: 'Hidrofor & Kuyu', ad: 'Kuyu pompası genel kontrolü', periyot: 'yılda bir',
    anahtar: ['pompa genel', 'dalgıç', 'kuyu pompası', 'kuyu kontrol'],
    giris: "Dalgıç pompanız suyun metrelerce altında, hiç görmediğiniz bir yerde çalışır; bu yüzden sorunlar dışarıdan fark edilmez. Basınç, debi ve çalışma değerlerinin *yılda bir* kontrol edilmesi, arızayı büyümeden yakalamanın tek yoludur.",
    riskler: [
      ["Kum ve aşınma", "Kuyudan gelen kum pompa çarklarını zamanla aşındırır; pompa çalışır ama suyu basamaz hale gelir."],
      ["Verimsiz çalışma ve yüksek fatura", "Aşınmış pompa aynı suyu çıkarmak için daha uzun çalışır ve daha fazla elektrik harcar."],
      ["Kuyudan çıkarma masrafı", "Arıza büyüdüğünde pompanın vinçle kuyudan çıkarılması gerekir; bu, bakım maliyetinin çok üstünde bir masraftır."],
    ] },
  { grup: 'Hidrofor & Kuyu', ad: 'Su debisi ölçümü', periyot: 'yılda bir',
    anahtar: ['debi'],
    giris: "Kuyunuzun verdiği su miktarı yıllar içinde değişebilir. Debi ölçümü, kuyunuzun verimini ve pompanızın kuyuya uygun olup olmadığını gösteren en önemli veridir. Bu ölçümün *yılda bir* yapılması, kuyunuzun sağlığını takip etmemizi sağlar.",
    riskler: [
      ["Fark edilmeyen verim kaybı", "Tıkanan filtre borusu veya azalan kuyu suyu yavaş yavaş debiyi düşürür; fark ettiğinizde sorun büyümüş olur."],
      ["Pompa ile kuyu uyumsuzluğu", "Kuyunun verdiğinden fazla su çeken pompa kuyuyu boşaltır, kuru çalışır ve yıpranır."],
      ["Ani su yetersizliği", "Havuz doldurma veya bahçe sulama gibi yoğun kullanımda su birden kesilir ve sistem durur."],
    ] },
  { grup: 'Havuz', ad: 'Havuz periyodik bakım', periyot: 'ayda bir (sezonda daha sık)',
    anahtar: ['periyodik bakım', 'havuz bakım'],
    giris: "Havuzunuzun berrak, sağlıklı ve davetkâr kalmasının sırrı düzenli bakımdır. Su kimyası, dip ve yüzey temizliği, filtre ve pompa kontrolü bir bütündür. Bu bakımın *ayda bir, sezonda daha sık* yapılması gerekir.",
    riskler: [
      ["Yosun ve bulanıklık", "Dengesi bozulan su birkaç gün içinde yeşillenir; temizlemek için çok daha fazla kimyasal, zaman ve masraf gerekir."],
      ["Sağlık riski", "Yeterince dezenfekte edilmeyen havuz suyu bakteri barındırır; göz, cilt ve kulak enfeksiyonlarına yol açabilir."],
      ["Ekipman ve kaplama hasarı", "Dengesiz su; pompa, filtre ve merdivenleri aşındırır, kaplamada kalıcı lekeler bırakır."],
    ] },
  { grup: 'Havuz', ad: 'Su analizi (pH / klor)', periyot: 'ayda bir',
    anahtar: ['su analizi', 'ph'],
    giris: "Havuz suyunun pH ve klor dengesi, gözle görülmeyen ama her şeyi belirleyen bir ayardır. Doğru denge hem sizin sağlığınızı hem de havuzunuzu korur. Analizin *ayda bir* yapılması, suyun her zaman güvenli kalmasını sağlar.",
    riskler: [
      ["Göz ve cilt tahrişi", "Yüksek veya düşük pH; gözlerde yanma, ciltte kuruluk ve kaşıntıya neden olur."],
      ["Etkisiz klor", "pH dengesi bozulduğunda klor işe yaramaz hale gelir; ne kadar kimyasal atılırsa atılsın su temizlenmez."],
      ["Korozyon ve kireç", "Dengesiz su metal aksamları paslandırır, ısı pompası ve tuz hücresinde kireçlenme yapar, kaplamayı yıpratır."],
    ] },
  { grup: 'Havuz', ad: 'Filtre ters yıkama', periyot: 'ayda bir',
    anahtar: ['ters yıkama', 'backwash'],
    giris: "Filtre, havuzunuzun \"böbreği\"dir; sudaki tüm kiri ve partikülleri tutar. Zamanla dolar ve temizlenmesi gerekir. Filtrenin *ayda bir* ters yıkanması, suyun berrak kalması için şarttır.",
    riskler: [
      ["Bulanık su", "Dolu filtre kiri tutamaz; su bulanıklaşır ve kimyasal tüketimi artar."],
      ["Zorlanan pompa", "Tıkalı filtre pompanın suyu basmasını zorlaştırır; motor ısınır, ömrü kısalır."],
      ["Artan elektrik faturası", "Verimsiz çalışan sistem suyu temizlemek için çok daha uzun süre çalışmak zorunda kalır."],
    ] },
  { grup: 'Havuz', ad: 'Filtre kumu değişimi', periyot: '2 yılda bir',
    anahtar: ['filtre kumu', 'kum değişimi', 'medya değişimi'],
    giris: "Filtrenizdeki kum, binlerce litre suyu süzerken zamanla aşınır, yuvarlaklaşır ve kir tutma özelliğini kaybeder. Filtrenin ilk günkü performansına dönmesi için kumun *2 yılda bir* değiştirilmesi gerekir.",
    riskler: [
      ["Kimyasala rağmen bulanık su", "Eskiyen kum kiri geçirir; ne kadar kimyasal kullanılırsa kullanılsın su berraklaşmaz."],
      ["Kanallaşma ve bakteri", "Topaklanan kumun içinde su kanallar açar ve filtrelenmeden geçer; kumun içinde bakteri yuvalanır."],
      ["Boşa giden kimyasal ve zaman", "Sorunu kimyasalla çözmeye çalışmak her ay daha fazla masraf demektir; kök neden ise filtre kumudur."],
    ] },
  { grup: 'Havuz', ad: 'Pompa ön filtre sepeti temizliği', periyot: 'ayda bir',
    anahtar: ['ön filtre', 'sepet'],
    giris: "Ön filtre sepeti; yaprak, saç ve kirleri pompaya girmeden yakalayan ilk savunma hattıdır. Özellikle rüzgârlı ve yapraklı dönemlerde hızla dolar. Sepetin *ayda bir* temizlenmesi pompanızı korur.",
    riskler: [
      ["Pompanın hava yapması", "Tıkanan sepet su akışını keser; pompa hava emer ve verimi düşer."],
      ["Kuru çalışma ve salmastra hasarı", "Susuz kalan pompa ısınır; salmastrası bozulur ve su kaçırmaya başlar."],
      ["Motor arızası", "Uzun süre zorlanan motor sonunda yanar; basit bir temizlikle önlenebilecek bir arıza pahalı bir değişime dönüşür."],
    ] },
  { grup: 'Havuz', ad: 'Havuz motoru kontrolü', periyot: 'yılda bir',
    anahtar: ['havuz motoru', 'salmastra', 'rulman'],
    giris: "Havuz motorunuz sezon boyunca her gün saatlerce çalışan, sistemin \"kalbi\"dir. Salmastra, rulman ve elektrik bağlantılarının *yılda bir* kontrol edilmesi, sezon ortasında havuzsuz kalmanızı önler.",
    riskler: [
      ["Salmastra sızıntısı", "Fark edilmeyen küçük bir su kaçağı motorun içine ilerler ve sargılara ulaşır."],
      ["Rulman sesi ve kilitlenme", "Aşınan rulmanlar önce ses yapar, sonra motoru kilitler; motor tamamen durur."],
      ["Sezon ortasında havuzsuz kalma", "Arıza genellikle yazın en yoğun döneminde çıkar; parça beklerken havuz suyu birkaç günde bozulur."],
    ] },
  { grup: 'Havuz', ad: 'Isı pompası bakımı', periyot: 'yılda bir',
    anahtar: ['ısı pompası', 'evaporatör', 'lamel', 'gaz basıncı'],
    giris: "Isı pompanız, havuzunuzun sezonunu uzatan en değerli cihazlardan biridir. Ancak lamelleri toz, polen ve deniz havasının tuzuyla kaplandıkça verimi düşer. Temizlik ve gaz basıncı kontrolünün *yılda bir* yapılması gerekir.",
    riskler: [
      ["Düşen ısıtma verimi", "Kirli lameller havadaki ısıyı alamaz; havuz geç ısınır veya istenen sıcaklığa hiç ulaşmaz."],
      ["Yükselen elektrik faturası", "Verimsiz çalışan cihaz aynı ısıyı üretmek için çok daha uzun çalışır."],
      ["Kompresör arızası", "Zorlanan kompresör ve tuz kaynaklı korozyon, cihazın en pahalı parçasının arızalanmasına yol açabilir."],
    ] },
  { grup: 'Havuz', ad: 'Tuz klor hücresi temizliği', periyot: '3 ayda bir',
    anahtar: ['hücre', 'tuz'],
    giris: "Tuz klor jeneratörünüz, havuzunuzu kimyasal taşıma derdi olmadan dezenfekte eden akıllı bir sistemdir. Ancak hücresi zamanla kireç tutar. Hücrenin *3 ayda bir* temizlenmesi, klor üretiminin düzenli devam etmesini sağlar.",
    riskler: [
      ["Klor üretiminin düşmesi", "Kireçlenen hücre yeterli klor üretemez; su yeşillenir ve bulanıklaşır."],
      ["Hücre ömrünün kısalması", "Kireçli hücre daha fazla zorlanır; plakaları erken yıpranır."],
      ["Yüksek değişim maliyeti", "Tuz klor hücresi pahalı bir parçadır; basit bir temizlik, erken değişim masrafını önler."],
    ] },
  { grup: 'Sulama', ad: 'Sulama sezon açılışı', periyot: 'her yıl Nisan',
    anahtar: ['sulama sezon açılış', 'sulamasını açma'],
    giris: "Kış boyunca kullanılmayan sulama sisteminizde tıkanmalar, kırık başlıklar ve gizli kaçaklar oluşabilir. Bahçenizin ilk sıcaklarda susuz kalmaması için sistemin *her yıl Nisan ayında* kontrol edilip programının ayarlanması gerekir.",
    riskler: [
      ["Kuruyan bitkiler", "Çalışmayan veya eksik sulayan hatlar yüzünden çim ve bitkiler ilk sıcak haftada sararır."],
      ["Gizli su kaçakları", "Toprak altındaki kırık borular fark edilmeden su kaçırır; su faturası ve kuyu tüketimi artar."],
      ["Pompaya binen yük", "Kaçaklı hatta basınç tutmadığı için pompa sürekli çalışır ve yıpranır."],
    ] },
  { grup: 'Sulama', ad: 'Sulama sezon kapanışı ve boşaltma', periyot: 'her yıl Ekim',
    anahtar: ['sulama sezon kapan', 'boşaltma', 'sulamayı kapatma'],
    giris: "Sulama hatlarında kalan su, kışın donduğunda genleşir ve sistemi içeriden çatlatır. Baharda sürpriz masraflarla karşılaşmamak için sistemin *her yıl Ekim ayında* boşaltılıp kapatılması gerekir.",
    riskler: [
      ["Çatlayan borular ve vanalar", "Donan su boruları, vanaları ve bağlantıları çatlatır; tüm hattın kazılması gerekebilir."],
      ["Pompa gövdesinin kırılması", "İçinde su kalan pompa gövdesi dona dayanamaz ve kırılır."],
      ["Baharda büyük masraf", "Kışın oluşan hasar ancak bahar açılışında fark edilir; onarım hem masraflı hem zaman alıcıdır."],
    ] },
  { grup: 'Sulama', ad: 'Sulama filtresi ve damla uç temizliği', periyot: '3 ayda bir',
    anahtar: ['sulama filtre', 'damla', 'nozul', 'hat yıkama'],
    giris: "Damla sulama ve fıskiye sistemleri, suyu doğru miktarda doğru yere ulaştırmak için küçük ve hassas uçlar kullanır. Kireç ve tortu bu uçları kolayca tıkar. Filtre ve uçların *3 ayda bir* temizlenmesi gerekir.",
    riskler: [
      ["Eşit olmayan sulama", "Tıkanan uçlar yüzünden bahçenin bazı bölgeleri kururken bazıları fazla su alır."],
      ["Kuruyan bitkiler", "Emek verdiğiniz bitkiler, sistem çalışıyor görünse de susuz kalır."],
      ["Boşa giden su ve emek", "Tıkalı sistem daha uzun çalıştırılır; hem su hem de elektrik israf edilir."],
    ] },
  { grup: 'Havuz', ad: 'Havuz sezon açılışı', periyot: 'her yıl Mayıs',
    anahtar: ['sezon açılış', 'yaz öncesi', 'sezon öncesi'],
    giris: "Kış boyunca bekleyen havuzunuzda su dengesi bozulur, ekipmanlar aylarca çalışmamıştır. Yaz sezonunu sorunsuz geçirmeniz için havuzun *her yıl Mayıs ayında* temizlik, kimyasal ayar ve tam ekipman kontrolüyle açılması gerekir.",
    riskler: [
      ["Yeşil ve bulanık başlangıç", "Hazırlıksız açılan havuzda yosun hızla yayılır; temizlenmesi günler sürer."],
      ["Uzun beklemeden kaynaklanan arızalar", "Aylarca çalışmayan pompa, filtre ve ısı pompasında sızıntı ve sıkışmalar ortaya çıkar."],
      ["Yazın ilk günlerinde havuzsuz kalma", "Sorunlar ilk sıcak günlerde fark edildiğinde servis yoğunluğu nedeniyle beklemek zorunda kalabilirsiniz."],
    ] },
  { grup: 'Havuz', ad: 'Havuz sezon kapanışı', periyot: 'her yıl Kasım',
    anahtar: ['sezon kapanış', 'kapatma', 'koruma modu'],
    giris: "Doğru yapılmayan bir kapanış, havuzunuzu kışın dona ve yosuna karşı savunmasız bırakır. Baharda pahalı onarımlarla karşılaşmamak için havuzun *her yıl Kasım ayında* uygun su seviyesi, kimyasal ve ekipman hazırlığıyla kapatılması gerekir.",
    riskler: [
      ["Donma hasarı", "Hatlarda ve ekipmanlarda kalan su donarak boru, pompa ve filtreyi çatlatabilir."],
      ["Baharda yosun ve leke", "Kimyasal koruması yapılmayan havuz kış boyunca yosun tutar; kaplamada kalıcı lekeler oluşur."],
      ["Pahalı bahar açılışı", "Korunmayan havuzun açılışı çok daha fazla temizlik, kimyasal ve onarım gerektirir."],
    ] },
  { grup: 'Genel', ad: 'Kış (don) kontrolü', periyot: 'her yıl kış öncesi',
    anahtar: ['kış', 'don'],
    giris: "Çeşme'nin kış geceleri sanıldığından soğuk olabilir. Açıkta kalan borular, pompa gövdeleri ve hidrofor tankları tek bir don gecesinde zarar görebilir. Bu kontrolün *her yıl kış öncesinde* yapılması gerekir.",
    riskler: [
      ["Patlayan borular", "Donan su boruları ve bağlantıları çatlatır; çözüldüğünde ev ve bahçede su baskını yaşanabilir."],
      ["Kırılan pompa ve tanklar", "İçinde su kalan pompa gövdesi ve hidrofor tankı dona dayanamaz ve kırılır."],
      ["Yokluğunuzda büyüyen hasar", "Evde değilken oluşan hasar günlerce fark edilmez; su kaybı ve onarım masrafı katlanır."],
    ] },
  { grup: 'Genel', ad: 'Su deposu temizliği', periyot: 'yılda bir',
    anahtar: ['depo', 'dezenfeksiyon'],
    giris: "Su deposu, evinize gelen tüm suyun beklediği yerdir. Zamanla dibinde tortu birikir ve bakteri üreyebilir. Ailenizin sağlığı için deponun *yılda bir* temizlenip dezenfekte edilmesi gerekir.",
    riskler: [
      ["Sağlık riski", "Tortu ve biyofilm içinde üreyen bakteriler suya karışır; bu suyla yıkanmak ve temizlik yapmak sağlık sorunlarına yol açabilir."],
      ["Kötü koku ve tat", "Bakımsız depodaki su bulanıklaşır, kötü koku ve tat yapar."],
      ["Tıkanan tesisat ve cihazlar", "Depodan gelen tortu armatürleri, filtreleri ve şofben-termosifon gibi cihazları tıkar."],
    ] },
  { grup: 'Genel', ad: 'Termosifon anot kontrolü', periyot: 'yılda bir',
    anahtar: ['anot', 'termosifon', 'emniyet ventili', 'kireç'],
    giris: "Termosifonunuzun içindeki magnezyum anot, tankın paslanmaması için kendini feda eden küçük bir parçadır. Anot tükendiğinde korozyon doğrudan tankı aşındırmaya başlar. Anotun *yılda bir* kontrol edilmesi cihazınızın ömrünü yıllarca uzatır.",
    riskler: [
      ["Tankın delinmesi", "Anotu biten tank içten paslanır ve sonunda delinir; cihazın tamamen değişmesi gerekir."],
      ["Su kaçağı ve hasar", "Delinen tanktan sızan su bulunduğu alana, dolaplara ve duvarlara zarar verir."],
      ["Kireç ve verim kaybı", "Biriken kireç rezistansın ısıtma verimini düşürür, elektrik tüketimini artırır."],
    ] },
  { grup: 'Genel', ad: 'Su arıtma filtre değişimi', periyot: '6 ayda bir',
    anahtar: ['kartuş', 'membran', 'arıtma'],
    giris: "Arıtma cihazınızın filtreleri, içtiğiniz suyun kalitesini belirleyen en önemli parçalardır. Süresi dolan filtre kiri tutamaz, hatta biriktirdiğini suya geri verebilir. Filtrelerin *6 ayda bir* değiştirilmesi gerekir.",
    riskler: [
      ["Sağlıksız içme suyu", "Dolan filtrede bakteri ürer; arıtılmış sandığınız su aslında daha kirli hale gelebilir."],
      ["Membran hasarı", "Ön filtreleri değişmeyen cihazın pahalı membranı kısa sürede tıkanır ve bozulur."],
      ["Düşen su miktarı ve tat bozulması", "Tıkalı filtreler su akışını yavaşlatır; suyun tadı ve kokusu bozulur."],
    ] },
  { grup: 'Genel', ad: 'Kaçak akım ve topraklama testi', periyot: 'yılda bir',
    anahtar: ['kaçak akım', 'topraklama'],
    giris: "Havuz ve kuyu sistemlerinde su ve elektrik her gün yan yana çalışır. Kaçak akım rölesi ve topraklama, sizi ve ailenizi elektrik çarpmasına karşı koruyan görünmez güvenlik kalkanıdır. Bu sistemlerin *yılda bir* test edilmesi gerekir.",
    riskler: [
      ["Çalışmayan koruma", "Test edilmeyen kaçak akım rölesi arızalı olabilir ve tehlike anında devreyi kesmez."],
      ["Can güvenliği riski", "Zayıflayan topraklama, havuz merdiveni veya pompa gövdesi gibi metal yüzeylerde elektrik kaçağına yol açabilir."],
      ["Cihaz arızaları", "Topraklaması bozuk sistemde elektronik kartlar ve motorlar daha kolay arızalanır."],
    ] },
];

const GRUPLAR = ['Hidrofor & Kuyu', 'Havuz', 'Sulama', 'Genel'];
const GENEL_ACIKLAMA =
  'Evinizdeki havuz, kuyu ve su sistemleri her gün sessizce çalışır; sorunlar ise çoğu zaman en ihtiyaç duyduğunuz anda ortaya çıkar. Düzenli bakım, arızaları büyümeden fark etmemizi sağlar.\n\n' +
  '⚠️ *Bakım ihmal edilirse neler olur?*\n\n' +
  '• *Fark edilmeyen yıpranma:* Küçük aşınmalar ve kaçaklar zamanla büyür, cihazlar verimsiz çalışır.\n' +
  '• *Ani arızalar:* Pompa, motor ve tesisat genellikle en yoğun kullanım döneminde arızalanır.\n' +
  '• *Yüksek masraflar:* Basit bir bakımla önlenebilecek sorunlar, pahalı tamir ve parça değişimlerine dönüşür.';

function bakimAciklama(b) {
  if (!b) return GENEL_ACIKLAMA;
  const maddeler = b.riskler.map(([bas, metin]) => `• *${bas}:* ${metin}`).join('\n');
  return `${b.giris}\n\n⚠️ *Bu bakım ihmal edilirse neler olur?*\n\n${maddeler}`;
}

function bakimBul(konu) {
  if (!konu) return null;
  const tam = BAKIMLAR.find((b) => b.ad === konu);
  if (tam) return tam;
  const k = konu.toLocaleLowerCase('tr-TR');
  return BAKIMLAR.find((b) => b.anahtar.some((a) => k.includes(a))) || null;
}

const IMZA = 'Konforunuz ve güvenliğiniz emin ellerde.\n\n*ALKA Mekanik ve Havuz Sistemleri*\nVolkan Gülcemal · 0533 371 39 35';

const TAKIP_PARAGRAF =
  '✅ *Artık bu takibi biz yapıyoruz!*\n' +
  'Sizi teknik detaylarla ya da "acaba bakım zamanı geçti mi?" endişesiyle yormuyoruz. Çeşme bölgesinde bir ilki gerçekleştirerek tüm periyodik takip sürecini üstümüze alıyoruz. Zamanı geldiğinde sisteminizi biz takip ediyor, bütçenizi ve konforunuzu korumak için gerekli müdahaleyi vaktinde yapıyoruz.';

const BILGI_SABLON =
  'Değerli Müşterimiz {ad},\n\n' +
  '🔧 *{bakim}* zamanınız yaklaşıyor.\n\n' +
  '{aciklama}\n\n' +
  TAKIP_PARAGRAF + '\n\n' +
  'Cihazlarınızı korumak ve sürpriz arızalara kapıyı kapatmak için randevu oluşturmak üzere bu mesajı yanıtlamanız yeterli.\n\n' +
  IMZA;

const SABLONLAR = [
  { ad: 'Bakım hatırlatması (detaylı)',
    bilgi: 'Seçilen bakımın neden önemli olduğunu ve ihmal edilirse oluşacak arızaları anlatan detaylı mesaj. Her bakım türü için açıklama otomatik değişir.',
    metin: BILGI_SABLON },
  { ad: 'Kısa bakım hatırlatması',
    bilgi: 'Bakımı yaklaşan müşteriye kısa ve net hatırlatma. Detaylı mesajı daha önce almış müşteriler için uygundur.',
    metin:
      'Değerli Müşterimiz {ad},\n\n🔧 *{bakim}* zamanınız geldi. Önerilen sıklık: {periyot}.\n\n' +
      'Sisteminizin aksamadan çalışması için uygun olduğunuz bir günü bu mesajı yanıtlayarak bize bildirebilirsiniz.\n\n' + IMZA },
  { ad: 'Sezon açılışı',
    bilgi: 'Yaz öncesi havuz sezon açılışı daveti. Nisan–Mayıs aylarında gönderilmesi önerilir.',
    metin:
      'Değerli Müşterimiz {ad},\n\nYaz sezonu yaklaşıyor ☀️ Kış boyunca bekleyen havuzunuzda su dengesi bozulmuş, pompa, filtre ve ısı pompası aylarca çalışmamış olabilir.\n\n' +
      '⚠️ *Hazırlıksız açılan havuzda neler olur?*\n\n' +
      '• *Yosun ve bulanıklık:* Su hızla yeşillenir, temizlenmesi günler sürer.\n' +
      '• *Uzun beklemeden kaynaklanan arızalar:* Sıkışan pompa, sızdıran contalar ve çalışmayan ısı pompası ilk sıcak günlerde ortaya çıkar.\n' +
      '• *Servis yoğunluğu:* Sezon başında herkes aynı anda servis istediği için beklemek zorunda kalabilirsiniz.\n\n' +
      'Havuzunuzu siz gelmeden temizleyip, kimyasal dengesini ayarlayıp tüm ekipmanlarıyla yaza hazır hale getirelim. Erken randevu için bu mesajı yanıtlamanız yeterli.\n\n' + IMZA },
  { ad: 'Kış öncesi kontrol',
    bilgi: 'Don riskine karşı kuyu, hidrofor, sulama ve açıktaki tesisat kontrolü. Ekim–Kasım aylarında gönderilmesi önerilir.',
    metin:
      'Değerli Müşterimiz {ad},\n\nSoğuklar yaklaşıyor ❄️ Çeşme\'nin kış geceleri sanıldığından soğuk olabilir; tek bir don gecesi bile açıktaki sistemlere zarar verebilir.\n\n' +
      '⚠️ *Kış hazırlığı yapılmazsa neler olur?*\n\n' +
      '• *Patlayan borular:* Hatlarda kalan su donarak boruları çatlatır; çözüldüğünde su baskını yaşanabilir.\n' +
      '• *Kırılan pompa ve tanklar:* İçinde su kalan pompa gövdesi ve hidrofor tankı dona dayanamaz.\n' +
      '• *Yokluğunuzda büyüyen hasar:* Evde değilken oluşan arıza günlerce fark edilmez, masraf katlanır.\n\n' +
      'Kuyu pompası, hidrofor, sulama hatları ve açıktaki tesisatınızı kışa hazırlamak için bu mesajı yanıtlamanız yeterli.\n\n' + IMZA },
  { ad: 'Geliş tarihi sorma',
    bilgi: 'Yazlık müşterilere Çeşme\'ye ne zaman geleceklerini sorma. Gelmeden önce havuz ve sistemler hazırlanır.',
    metin:
      'Değerli Müşterimiz {ad},\n\nÇeşme\'ye ne zaman geleceğinizi bize bildirirseniz, siz gelmeden havuzunuzu, suyunuzu ve tüm sistemlerinizi hazırlayalım 🏡\n\n' +
      'Kapıdan girdiğiniz anda berrak bir havuz, düzgün çalışan bir su sistemi ve hiçbir sürpriz olmadan tatilinize başlamanız için gerekli kontrolleri önceden yapıyoruz.\n\n' +
      'Geliş tarihinizi bu mesajı yanıtlayarak paylaşmanız yeterli.\n\n' + IMZA },
  { ad: 'Kampanya / indirim',
    bilgi: 'Seçilen bakım için dönemsel indirim duyurusu. {bakim} alanı müşterinin bakımına göre değişir.',
    metin:
      'Değerli Müşterimiz {ad},\n\n🎁 Bu aya özel *{bakim}* hizmetimizde indirim fırsatı sunuyoruz!\n\n{aciklama}\n\n' +
      'Kampanya sınırlı süre geçerlidir. Detaylar ve randevu için bu mesajı yanıtlamanız yeterli.\n\n' + IMZA },
  { ad: 'Bayram tebriği',
    bilgi: 'Bayramlarda müşterilere kutlama mesajı. Satış içermez, ilişkiyi güçlendirir.',
    metin:
      'Değerli Müşterimiz {ad},\n\nBayramınızı en içten dileklerimizle kutlar; sevdiklerinizle birlikte sağlıklı, huzurlu ve mutlu günler dileriz 🌸\n\n' +
      '*ALKA Mekanik ve Havuz Sistemleri*\nVolkan Gülcemal' },
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
    .replace(/\{aciklama\}/g, bakimAciklama(b))
    .replace(/\{periyot\}/g, b?.periyot || 'düzenli aralıklarla');
}

const AY_ADLARI = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const trTarihUzun = (t) => { const d = new Date(t + 'T00:00:00'); return `${d.getDate()} ${AY_ADLARI[d.getMonth()]} ${d.getFullYear()}`; };

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

const GRUP_IKON = { 'Hidrofor & Kuyu': '💧', Havuz: '🏊', Sulama: '🌱', Genel: '🏠' };
const GRUP_ACIKLAMA = {
  'Hidrofor & Kuyu': 'Hidrofor, genleşme tankı, kuyu pompası ve elektrik pano kontrolleri',
  Havuz: 'Havuz suyu, filtre, motor, ısı pompası ve sezon işlemleri',
  Sulama: 'Bahçe sulama sistemi açılış, kapanış ve temizlik',
  Genel: 'Don kontrolü, su deposu, termosifon, arıtma ve elektrik güvenliği',
};

function BakimSecici({ baslik, mevcut, onSec, onKapat }) {
  const [arama, setArama] = useState('');
  const [acikGrup, setAcikGrup] = useState(() => bakimBul(mevcut)?.grup || GRUPLAR[0]);
  const q = arama.trim().toLocaleLowerCase('tr-TR');
  const sonuc = q ? BAKIMLAR.filter((b) => b.ad.toLocaleLowerCase('tr-TR').includes(q) || b.grup.toLocaleLowerCase('tr-TR').includes(q)) : null;

  const satir = (b) => {
    const secili = b.ad === mevcut;
    return (
      <button key={b.ad} onClick={() => onSec(b.ad)} style={{ ...s.bsSatir, ...(secili ? s.bsSatirSecili : {}) }}>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#0f2d4a' }}>{b.ad}</div>
          <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 3 }}>
            ⚠️ {b.riskler.slice(0, 2).map((r) => r[0]).join(' · ')}
          </div>
        </div>
        <span style={s.bsPeriyot}>{b.periyot}</span>
        {secili && <span style={{ color: '#1d6fe0', fontWeight: 900, fontSize: 18 }}>✓</span>}
      </button>
    );
  };

  return (
    <div style={s.bsArka} onClick={onKapat}>
      <div style={s.bsPanel} onClick={(e) => e.stopPropagation()}>
        <div style={s.bsTutamac} />
        <div style={s.bsUst}>
          <div style={{ minWidth: 0 }}>
            <div style={s.bsBaslik}>Hangi bakım hakkında bilgilendirilsin?</div>
            <div style={s.bsAlt}>👤 {baslik}</div>
          </div>
          <button style={s.bsKapat} onClick={onKapat} aria-label="Kapat">✕</button>
        </div>

        <input style={{ ...s.input, marginBottom: 10 }} placeholder="🔍 Bakım ara... (örn: filtre, motor, don)" value={arama}
          onChange={(e) => setArama(e.target.value)} />

        <div style={s.bsListe}>
          {sonuc ? (
            sonuc.length ? sonuc.map(satir) : <div style={{ ...s.soluk, padding: 12 }}>Aramaya uyan bakım yok.</div>
          ) : (
            GRUPLAR.map((g) => {
              const acik = acikGrup === g;
              const liste = BAKIMLAR.filter((b) => b.grup === g);
              const seciliVar = liste.some((b) => b.ad === mevcut);
              return (
                <div key={g} style={s.bsGrup}>
                  <button style={{ ...s.bsGrupBtn, ...(acik ? s.bsGrupBtnAcik : {}) }} onClick={() => setAcikGrup(acik ? '' : g)}>
                    <span style={s.bsGrupIkon}>{GRUP_IKON[g]}</span>
                    <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <span style={{ display: 'block', fontWeight: 800, fontSize: 15.5 }}>
                        {g} <span style={{ fontWeight: 600, fontSize: 12.5, color: '#64748b' }}>({liste.length})</span>
                        {seciliVar && <span style={s.bsSeciliRozet}>seçili</span>}
                      </span>
                      <span style={{ display: 'block', fontSize: 12, color: '#64748b', fontWeight: 500, marginTop: 2 }}>{GRUP_ACIKLAMA[g]}</span>
                    </span>
                    <span style={{ fontSize: 18, color: '#94a3b8', transform: acik ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>›</span>
                  </button>
                  {acik && <div style={{ padding: '4px 4px 8px' }}>{liste.map(satir)}</div>}
                </div>
              );
            })
          )}
        </div>

        <button style={s.bsTemizle} onClick={() => onSec('')}>Bakım belirtme — genel bilgilendirme mesajı gönder</button>
      </div>
    </div>
  );
}

const DURUMLAR = [
  { id: 'bekliyor', ad: 'Yanıt bekleniyor', ikon: '⏳', renk: '#92400e', zemin: '#fef3c7' },
  { id: 'dondu', ad: 'Dönüş yaptı', ikon: '💬', renk: '#1e40af', zemin: '#dbeafe' },
  { id: 'randevu', ad: 'Randevu alındı', ikon: '📅', renk: '#6d28d9', zemin: '#ede9fe' },
  { id: 'basladi', ad: 'Bakım başladı', ikon: '🔧', renk: '#c2410c', zemin: '#ffedd5' },
  { id: 'yapildi', ad: 'Bakım yapıldı', ikon: '✅', renk: '#166534', zemin: '#dcfce7' },
  { id: 'istemiyor', ad: 'İlgilenmiyor', ikon: '✖️', renk: '#475569', zemin: '#f1f5f9' },
];
const TAKIP_SEKMELER = [
  { id: 'bekleyen', ad: 'Bekleyen', durumlar: ['bekliyor'] },
  { id: 'gorusulen', ad: 'Görüşülen', durumlar: ['dondu', 'randevu', 'basladi'] },
  { id: 'tamam', ad: 'Tamamlanan', durumlar: ['yapildi', 'istemiyor'] },
  { id: 'hepsi', ad: 'Tümü', durumlar: null },
];
const GRUP_KATEGORI = { 'Hidrofor & Kuyu': 'Hidrofor', Havuz: 'Havuz', Sulama: 'Sulama', Genel: 'Tesisat' };

function kayitDurum(k) {
  if (k.durum) return k.durum;
  if (typeof k.tur === 'string' && k.tur.startsWith('durum:')) return k.tur.slice(6);
  return 'bekliyor';
}

function kayitBakim(k) {
  const parca = String(k.baslik || '').split(' · ');
  const aday = parca[parca.length - 1];
  return bakimBul(aday) ? bakimBul(aday).ad : (parca.length > 1 ? aday : '');
}

function periyotAy(b) {
  const p = String(b?.periyot || '').toLocaleLowerCase('tr-TR');
  let m = p.match(/(\d+)\s*yılda/);
  if (m) return Number(m[1]) * 12;
  m = p.match(/(\d+)\s*ayda/);
  if (m) return Number(m[1]);
  if (p.includes('yılda') || p.includes('her yıl')) return 12;
  if (p.includes('ayda')) return 1;
  return 12;
}

function ayEkle(tarihStr, ay) {
  const d = new Date(tarihStr + 'T00:00:00');
  d.setMonth(d.getMonth() + ay);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function bakimMetni(b) {
  // {ad} müşteriye göre dolar, geri kalanı seçilen bakımın hazır metni
  return BILGI_SABLON
    .replace(/\{bakim\}/g, b.ad)
    .replace(/\{aciklama\}/g, bakimAciklama(b))
    .replace(/\{periyot\}/g, b.periyot);
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
  const [sablonAd, setSablonAd] = useState(SABLONLAR[0].ad);
  const [sablonBakim, setSablonBakim] = useState('');
  const [takipSekme, setTakipSekme] = useState('bekleyen');
  const [acikKayit, setAcikKayit] = useState(null);
  const [takipMesaj, setTakipMesaj] = useState(null);
  const [isleniyor, setIsleniyor] = useState(false);
  const [haric, setHaric] = useState([]);
  const [konular, setKonular] = useState({});
  const [secici, setSecici] = useState(null); // { id } tek müşteri, { toplu: true } hepsi
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
        .select('*, customers(name, phone)')
        .order('created_at', { ascending: false })
        .limit(80),
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
  const konuBul = (m) => (sablonBakim || (konular[m.id] !== undefined ? konular[m.id] : enYakinBakim(m)));
  const bakimsizSayi = alicilar.filter((m) => !konuBul(m)).length;

  function bakimSecildi(ad) {
    if (secici?.toplu) {
      const yeni = { ...konular };
      alicilar.forEach((m) => { yeni[m.id] = ad; });
      setKonular(yeni);
    } else if (secici?.id) {
      setKonular({ ...konular, [secici.id]: ad });
    }
    setSecici(null);
  }

  function sablonSec(ad) {
    const b = BAKIMLAR.find((x) => x.ad === ad);
    if (b) {
      setMetin(bakimMetni(b));
      setBaslik('Bakım hatırlatması');
      setSablonAd(b.ad);
      setSablonBakim(b.ad);
      return;
    }
    const sb = SABLONLAR.find((x) => x.ad === ad);
    if (!sb) return;
    setMetin(sb.metin);
    setBaslik(sb.ad);
    setSablonAd(sb.ad);
    setSablonBakim('');
  }

  async function durumYaz(k, durum) {
    let { error } = await supabase.from('mesaj_kayitlari').update({ durum }).eq('id', k.id);
    if (error) ({ error } = await supabase.from('mesaj_kayitlari').update({ tur: 'durum:' + durum }).eq('id', k.id));
    if (error) throw new Error(error.message);
    setKayitlar((liste) => liste.map((x) => (x.id === k.id ? { ...x, durum, tur: 'durum:' + durum } : x)));
  }

  async function durumDegis(k, durum) {
    setTakipMesaj(null);
    if (durum === 'yapildi') { await bakimYapildi(k); return; }
    try {
      await durumYaz(k, durum);
      setAcikKayit(null);
    } catch (e) {
      setTakipMesaj({ tur: 'hata', yazi: 'Durum kaydedilemedi: ' + e.message });
    }
  }

  async function bakimYapildi(k) {
    const b = bakimBul(kayitBakim(k));
    const ad = k.customers?.name || 'Müşteri';
    if (!window.confirm(b
      ? `${ad} için "${b.ad}" yapıldı olarak işaretlensin mi?\n\nSonraki bakım tarihi otomatik hesaplanacak (${b.periyot}).`
      : `${ad} için bakım yapıldı olarak işaretlensin mi?`)) return;
    setIsleniyor(true);
    try {
      let sonuc = '';
      if (b && k.customer_id) {
        const bugun = gunEkle(0);
        const ay = periyotAy(b);
        const sonraki = ayEkle(bugun, ay);
        const { data: cihazlar, error: cHata } = await supabase.from('equipment')
          .select('id, category, maintenance_rules(id, rule_name)').eq('customer_id', k.customer_id);
        if (cHata) throw new Error(cHata.message);
        let kural = null;
        (cihazlar || []).forEach((c) => (c.maintenance_rules || []).forEach((r) => {
          if (!kural && bakimBul(r.rule_name)?.ad === b.ad) kural = r;
        }));
        if (kural) {
          const { error } = await supabase.from('maintenance_rules')
            .update({ last_service_date: bugun, next_due_date: sonraki, active: true }).eq('id', kural.id);
          if (error) throw new Error(error.message);
        } else {
          let cihaz = (cihazlar || []).find((c) => c.category === GRUP_KATEGORI[b.grup]) || (cihazlar || [])[0];
          if (!cihaz) {
            const { data: yeniC, error } = await supabase.from('equipment')
              .insert([{ customer_id: k.customer_id, category: GRUP_KATEGORI[b.grup], equipment_type: b.grup }]).select().single();
            if (error) throw new Error('Müşteriye cihaz eklenemedi (' + error.message + '). Müşteri kartından cihaz ekleyip tekrar deneyin.');
            cihaz = yeniC;
          }
          const { error } = await supabase.from('maintenance_rules').insert([{
            equipment_id: cihaz.id, rule_name: b.ad, period_months: ay, last_service_date: bugun, next_due_date: sonraki, active: true,
          }]);
          if (error) throw new Error(error.message);
        }
        const gun = Math.round((new Date(sonraki) - new Date(bugun)) / 86400000);
        sonuc = ` Sonraki ${b.ad}: ${trTarihUzun(sonraki)} (${gun} gün sonra). Bakım takvimine işlendi.`;
      } else {
        sonuc = ' Bakım türü belirtilmediği için takvim sayacı güncellenmedi.';
      }
      await durumYaz(k, 'yapildi');
      setAcikKayit(null);
      setTakipMesaj({ tur: 'ok', yazi: `✅ ${ad}: bakım tamamlandı.${sonuc}` });
    } catch (e) {
      setTakipMesaj({ tur: 'hata', yazi: e.message });
    }
    setIsleniyor(false);
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
          <select style={s.input} value={sablonAd} onChange={(e) => sablonSec(e.target.value)}>
            <optgroup label="📋 Genel mesajlar">
              {SABLONLAR.map((sb) => <option key={sb.ad} value={sb.ad}>{sb.ad}</option>)}
            </optgroup>
            {GRUPLAR.map((g) => (
              <optgroup key={g} label={`${GRUP_IKON[g]} ${g} bakım mesajları`}>
                {BAKIMLAR.filter((b) => b.grup === g).map((b) => <option key={b.ad} value={b.ad}>{b.ad}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        {sablonBakim && (
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', borderRadius: 10,
            padding: '10px 12px', fontSize: 13, lineHeight: 1.5, marginTop: 8 }}>
            {GRUP_IKON[bakimBul(sablonBakim)?.grup]} <b>{sablonBakim}</b> mesajı seçili. Tüm alıcılara bu bakım için gönderilir;
            mesajdaki isim her kişiye göre otomatik değişir. Metni aşağıdan düzenleyebilirsin.
          </div>
        )}
        {SABLONLAR.find((x) => x.ad === sablonAd)?.bilgi && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e3a5f', borderRadius: 10,
            padding: '10px 12px', fontSize: 13, lineHeight: 1.5, marginTop: 8 }}>
            ℹ️ {SABLONLAR.find((x) => x.ad === sablonAd).bilgi}
          </div>
        )}
        <label style={{ ...s.etiket, marginTop: 12 }}>Mesaj metni
          <textarea style={{ ...s.input, minHeight: 260, fontFamily: 'inherit', lineHeight: 1.5 }} value={metin}
            onChange={(e) => setMetin(e.target.value)} />
        </label>
        <div style={s.ipucu}>
          Otomatik dolan alanlar: <b>{'{ad}'}</b> müşterinin adı · <b>{'{bakim}'}</b> bakım adı ·
          <b> {'{aciklama}'}</b> o bakımın neden önemli olduğu ve ihmal edilirse oluşacak arızalar · <b>{'{periyot}'}</b> önerilen sıklık
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

        {sablonBakim && uygunlar.length > 0 && (
          <div style={{ ...s.topluBar, background: '#ecfdf5', borderColor: '#a7f3d0' }}>
            <div style={{ fontSize: 13.5, color: '#065f46' }}>{GRUP_IKON[bakimBul(sablonBakim)?.grup]} Herkese <b>{sablonBakim}</b> mesajı gidecek.</div>
          </div>
        )}
        {!sablonBakim && uygunlar.length > 0 && (
          <div style={s.topluBar}>
            <div style={{ flex: '1 1 200px', minWidth: 0 }}>
              <div style={{ fontWeight: 800, color: '#0f2d4a', fontSize: 14 }}>Bakım konusu</div>
              <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>
                {bakimsizSayi > 0
                  ? `${bakimsizSayi} kişide bakım seçilmedi — onlara genel açıklama gider.`
                  : 'Tüm alıcıların bakım konusu seçili ✓'}
              </div>
            </div>
            <button style={s.topluBtn} onClick={() => setSecici({ toplu: true })}>Hepsine aynı bakımı seç</button>
          </div>
        )}

        {uygunlar.map((m) => {
          const dahil = !haric.includes(m.id);
          const konu = konuBul(m);
          const b = bakimBul(konu);
          return (
            <div key={m.id} style={{ ...s.aliciSatir, opacity: dahil ? 1 : 0.5 }}>
              <input type="checkbox" checked={dahil} onChange={() => haricDegistir(m.id)} style={{ width: 22, height: 22, flexShrink: 0, accentColor: '#1d6fe0' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={s.aliciAd}>{m.name}{elleEklenen.includes(m.id) && <span style={s.yeniRozet}>elle eklendi</span>}</div>
                <div style={{ ...s.soluk, fontSize: 13 }}>{m.phone}{m.address ? ` · ${m.address}` : ''}</div>
                {!sablonBakim && <button style={konu ? s.konuCip : s.konuCipBos} onClick={() => setSecici({ id: m.id, ad: m.name })} disabled={!dahil}>
                  {konu ? (
                    <>
                      <span style={{ fontSize: 16 }}>{GRUP_IKON[b?.grup] || '🔧'}</span>
                      <span style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                        <span style={{ display: 'block', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{konu}</span>
                        {b && <span style={{ display: 'block', fontSize: 11.5, color: '#64748b', fontWeight: 500 }}>{b.grup} · {b.periyot}</span>}
                      </span>
                      <span style={{ fontSize: 12, color: '#1d6fe0', fontWeight: 700 }}>Değiştir</span>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 16 }}>🔧</span>
                      <span style={{ flex: 1, textAlign: 'left' }}>Hangi bakım için? <b>Seç</b></span>
                      <span>›</span>
                    </>
                  )}
                </button>}
              </div>
            </div>
          );
        })}
        {eslesenler.length === 0 && <p style={s.soluk}>Bu filtrelere uyan müşteri yok. "+ Numara ekle" ile elle ekleyebilirsiniz.</p>}
      </div>

      <div style={s.kart}>
        <div style={s.bolum}>4. Yanıt takibi</div>
        <p style={{ ...s.soluk, marginTop: -4, marginBottom: 12 }}>
          Mesaj gönderdiğin müşterilerden dönüş gelince buradan işaretle. <b>✅ Bakım yapıldı</b> dediğinde o bakımın bir sonraki tarihi otomatik hesaplanıp takvime işlenir.
        </p>
        <div style={s.sekmeler}>
          {TAKIP_SEKMELER.map((t) => {
            const sayi = kayitlar.filter((k) => !t.durumlar || t.durumlar.includes(kayitDurum(k))).length;
            return (
              <button key={t.id} onClick={() => setTakipSekme(t.id)} style={{ ...s.sekme, ...(takipSekme === t.id ? s.sekmeAktif : {}) }}>
                {t.ad} <span style={s.sekmeSayi}>{sayi}</span>
              </button>
            );
          })}
        </div>
        {takipMesaj && (
          <div style={{ ...(takipMesaj.tur === 'ok' ? s.takipOk : s.takipHata), marginBottom: 10 }}>{takipMesaj.yazi}</div>
        )}
        {(() => {
          const sekme = TAKIP_SEKMELER.find((t) => t.id === takipSekme);
          const liste = kayitlar.filter((k) => !sekme.durumlar || sekme.durumlar.includes(kayitDurum(k)));
          if (!liste.length) return <p style={s.soluk}>Bu bölümde kayıt yok.</p>;
          return liste.map((k) => {
            const d = DURUMLAR.find((x) => x.id === kayitDurum(k)) || DURUMLAR[0];
            const bakim = kayitBakim(k);
            const acik = acikKayit === k.id;
            return (
              <div key={k.id} style={s.takipSatir}>
                <button style={s.takipUst} onClick={() => setAcikKayit(acik ? null : k.id)}>
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <div style={{ fontWeight: 700, color: '#0f2d4a', fontSize: 15 }}>{k.customers?.name || '-'}</div>
                    <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>
                      {bakim ? `${GRUP_IKON[bakimBul(bakim)?.grup] || '🔧'} ${bakim}` : (k.baslik || 'Mesaj')} · {trSaat(k.created_at)}
                    </div>
                  </div>
                  <span style={{ ...s.durumRozet, color: d.renk, background: d.zemin }}>{d.ikon} {d.ad}</span>
                </button>
                {acik && (
                  <div style={s.durumIzgara}>
                    {DURUMLAR.map((x) => (
                      <button key={x.id} disabled={isleniyor} onClick={() => durumDegis(k, x.id)}
                        style={{ ...s.durumBtn, color: x.renk, background: x.zemin, ...(x.id === d.id ? { boxShadow: `inset 0 0 0 2px ${x.renk}` } : {}),
                          ...(x.id === 'yapildi' ? { gridColumn: '1 / -1', fontSize: 14.5, padding: '12px' } : {}) }}>
                        {x.ikon} {x.id === 'yapildi' && bakim ? `${bakim} yapıldı` : x.ad}
                      </button>
                    ))}
                    {k.customers?.phone && (
                      <a href={`https://wa.me/${telefonWa(k.customers.phone)}`} target="_blank" rel="noreferrer" style={s.waLink}>WhatsApp'tan yaz</a>
                    )}
                  </div>
                )}
              </div>
            );
          });
        })()}
      </div>
      {secici && (
        <BakimSecici
          baslik={secici.toplu ? `Seçili ${alicilar.length} kişinin tümü` : secici.ad}
          mevcut={secici.toplu ? '' : konuBul(uygunlar.find((m) => m.id === secici.id) || {})}
          onSec={bakimSecildi}
          onKapat={() => setSecici(null)}
        />
      )}
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
  aliciSatir: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderTop: '1px solid #eef2f6' },
  aliciAd: { fontWeight: 700, color: '#0f2d4a' },
  yeniRozet: { marginLeft: 8, fontSize: 11, background: '#ede9fe', color: '#6d28d9', padding: '2px 8px', borderRadius: 10, fontWeight: 700 },
  sekmeler: { display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 12, paddingBottom: 2 },
  sekme: { flexShrink: 0, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', borderRadius: 20, padding: '7px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  sekmeAktif: { background: '#0f2d4a', color: '#fff', borderColor: '#0f2d4a' },
  sekmeSayi: { marginLeft: 4, opacity: 0.75, fontWeight: 600 },
  takipSatir: { borderTop: '1px solid #eef2f6' },
  takipUst: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 0', border: 'none', background: 'none', cursor: 'pointer' },
  durumRozet: { fontSize: 12, fontWeight: 700, borderRadius: 20, padding: '5px 10px', whiteSpace: 'nowrap', flexShrink: 0 },
  durumIzgara: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '0 0 14px' },
  durumBtn: { border: 'none', borderRadius: 12, padding: '10px 8px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' },
  waLink: { gridColumn: '1 / -1', textAlign: 'center', color: '#15803d', fontWeight: 700, fontSize: 13.5, padding: 8, textDecoration: 'none', border: '1px solid #bbf7d0', borderRadius: 12, background: '#f0fdf4' },
  takipOk: { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', borderRadius: 12, padding: 12, fontSize: 13.5, lineHeight: 1.5 },
  takipHata: { background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 12, padding: 12, fontSize: 13.5, lineHeight: 1.5 },
  topluBar: {
    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: '#f0f6ff', border: '1px solid #cfe0fb',
    borderRadius: 12, padding: '10px 12px', margin: '8px 0 4px',
  },
  topluBtn: { flex: '1 1 auto', border: 'none', background: '#1d6fe0', color: '#fff', fontWeight: 700, fontSize: 13, borderRadius: 10, padding: '9px 12px', cursor: 'pointer' },
  konuCip: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', marginTop: 8, padding: '9px 12px', borderRadius: 12,
    border: '1px solid #bfdbfe', background: '#eff6ff', color: '#0f2d4a', fontSize: 13.5, cursor: 'pointer', boxSizing: 'border-box',
  },
  konuCipBos: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', marginTop: 8, padding: '10px 12px', borderRadius: 12,
    border: '1.5px dashed #f59e0b', background: '#fffbeb', color: '#92400e', fontSize: 13.5, cursor: 'pointer', boxSizing: 'border-box',
  },
  bsArka: { position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(15,23,42,.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  bsPanel: {
    width: '100%', maxWidth: 620, maxHeight: '88vh', background: '#fff', borderRadius: '22px 22px 0 0', padding: '8px 16px',
    paddingBottom: 'calc(16px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
    boxShadow: '0 -10px 40px rgba(0,0,0,.25)',
  },
  bsTutamac: { width: 40, height: 5, borderRadius: 3, background: '#cbd5e1', margin: '4px auto 10px' },
  bsUst: { display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  bsBaslik: { fontSize: 18, fontWeight: 800, color: '#0f2d4a', lineHeight: 1.25 },
  bsAlt: { fontSize: 13, color: '#64748b', marginTop: 4 },
  bsKapat: { marginLeft: 'auto', width: 34, height: 34, borderRadius: '50%', border: 'none', background: '#f1f5f9', fontSize: 15, cursor: 'pointer', flexShrink: 0 },
  bsListe: { overflowY: 'auto', flex: 1, margin: '0 -4px', padding: '0 4px', WebkitOverflowScrolling: 'touch' },
  bsGrup: { border: '1px solid #e2e8f0', borderRadius: 14, marginBottom: 10, overflow: 'hidden', background: '#fff' },
  bsGrupBtn: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px', border: 'none', background: '#fff', color: '#0f2d4a', cursor: 'pointer' },
  bsGrupBtnAcik: { background: '#f8fafc', borderBottom: '1px solid #e2e8f0' },
  bsGrupIkon: { width: 40, height: 40, borderRadius: 12, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21, flexShrink: 0 },
  bsSeciliRozet: { marginLeft: 6, background: '#dbeafe', color: '#1d4ed8', fontSize: 11, fontWeight: 800, borderRadius: 10, padding: '2px 7px', verticalAlign: 'middle' },
  bsSatir: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '11px 10px', border: 'none', borderRadius: 10,
    background: 'transparent', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', boxSizing: 'border-box',
  },
  bsSatirSecili: { background: '#eff6ff', boxShadow: 'inset 0 0 0 1.5px #1d6fe0' },
  bsPeriyot: { fontSize: 11, fontWeight: 700, color: '#0f766e', background: '#ecfdf5', borderRadius: 8, padding: '4px 7px', whiteSpace: 'nowrap', flexShrink: 0, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis' },
  bsTemizle: { marginTop: 10, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', borderRadius: 12, padding: '11px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' },
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
