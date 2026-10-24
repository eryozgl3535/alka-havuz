// Yapay zekâ asistanının araç tanımları (ne yapabileceğinin listesi).
// Hem uygulama içi yazılı asistan (src/asistanAraclar.js) hem de sesli canlı asistan sunucusu (api/ses-asistan.js)
// bu listeyi kullanır. Burada tarayıcıya özel hiçbir şey olmamalı (sunucuda da çalışıyor).
const S = (properties, required = []) => ({ type: 'OBJECT', properties, required });
const str = (description) => ({ type: 'STRING', description });
const num = (description) => ({ type: 'NUMBER', description });
const bool = (description) => ({ type: 'BOOLEAN', description });
const en = (description, list) => ({ type: 'STRING', description, enum: list });

export const ARACLAR = [
  // --- okuma
  { name: 'genel_ozet', description: 'Firmanın anlık durumu: müşteri sayısı, bugünkü ve bekleyen iş emirleri, gecikmiş ve yaklaşan bakımlar, açık hatırlatmalar, tahsil edilmemiş alacak. "Bugün ne var", "durum ne" gibi sorularda kullan.' },
  { name: 'musteri_ara', description: 'Ad, telefon veya adresin bir parçasıyla müşteri arar; cihazlarını da getirir.', parameters: S({ sorgu: str('Aranacak metin, örn. "Köstekçi", "0532", "Alaçatı"') }, ['sorgu']) },
  { name: 'musteri_detay', description: 'Bir müşterinin her şeyi: iletişim, cihazlar, bakım takvimi, son iş emirleri, açık hatırlatmalar, notlar, gelişler.', parameters: S({ musteri_id: str('Müşteri id') }, ['musteri_id']) },
  { name: 'is_emirleri', description: 'İş emirlerini listeler.', parameters: S({
    durum: en('Hangi iş emirleri', ['aktif', 'bekliyor', 'basladi', 'tamamlandi', 'tumu']),
    baslangic: str('Planlanan tarih en erken (YYYY-MM-DD)'), bitis: str('Planlanan tarih en geç (YYYY-MM-DD)'),
    musteri_id: str('Sadece bu müşteri'), odenmemis: bool('Sadece ödemesi tamamlanmamış olanlar'),
  }) },
  { name: 'bakimlar', description: 'Bakım takvimi: tarihi gelmiş/gecikmiş ve önümüzdeki günlerde yapılacak bakımlar (müşteri ve cihazıyla).', parameters: S({ gun: num('Kaç gün ilerisine bakılsın (varsayılan 30)') }) },
  { name: 'hatirlatmalar', description: 'Hatırlatmaları (ödeme, tahsilat, yapılacak iş) listeler.', parameters: S({ durum: en('Hangileri', ['acik', 'tamamlanan', 'tumu']) }) },
  { name: 'gelisler', description: 'Müşteri geliş/ayrılış planları (yazlıkçıların gelişi).', parameters: S({ baslangic: str('YYYY-MM-DD, varsayılan bugün'), bitis: str('YYYY-MM-DD') }) },
  { name: 'notlar', description: 'Ekibin ortak notları (id ile).', parameters: S({ ara: str('Notlarda geçen kelime (isteğe bağlı)'), bitenler: bool('Tamamlanmış notlar da gelsin') }) },
  { name: 'mesaj_gecmisi', description: 'Müşterilere gönderilmiş mesaj kayıtları (WhatsApp/SMS bilgilendirme, bakım hatırlatması) id ile.', parameters: S({ musteri_id: str('Sadece bu müşteri (isteğe bağlı)') }) },

  // --- silme (ONAYLI): bu araç silmez, sadece kullanıcıdan onay ister; onaydan sonra uygulama siler
  { name: 'kayit_sil', description: 'Bir notu, hatırlatmayı/ödemeyi ya da mesaj kaydını silmek için KULLANICIDAN ONAY İSTER. Kaydı hemen silmez: uygulama kullanıcıya "emin misin?" diye sorar, kullanıcı evet derse uygulama siler. Önce notlar / hatirlatmalar / mesaj_gecmisi araçlarıyla doğru kaydın id\'sini bul; birden fazla aday varsa önce hangisi olduğunu sor.', parameters: S({ id: str('Silinecek kaydın id\'si') }, ['id']) },

  // --- yazma (hepsi geri alınabilir)
  { name: 'musteri_ekle', description: 'Yeni müşteri ekler. Önce aynı isimde müşteri var mı diye müşteri listesine bak.', parameters: S({ ad: str('Ad soyad'), telefon: str('Telefon'), adres: str('Adres / site / bölge'), not: str('Not') }, ['ad']) },
  { name: 'musteri_guncelle', description: 'Müşterinin bilgisini değiştirir. Sadece değişecek alanları gönder.', parameters: S({ musteri_id: str('Müşteri id'), ad: str('Yeni ad'), telefon: str('Yeni telefon'), adres: str('Yeni adres'), not: str('Yeni not (eskisinin yerine geçer)') }, ['musteri_id']) },
  { name: 'cihaz_ekle', description: 'Müşteriye cihaz ekler (havuz pompası, hidrofor, kuyu pompası, ısı pompası, filtre, pano vb.).', parameters: S({
    musteri_id: str('Müşteri id'), kategori: str('Kategori: Havuz, Kuyu, Hidrofor, Sulama, Tesisat, Elektrik, Isıtma vb.'), cihaz: str('Cihaz/iş adı, örn. "Havuz pompası"'),
    marka: str('Marka'), model: str('Model, güç, faz vb. serbest yazı'), konum: str('Nerede (bahçe, makine dairesi...)'),
  }, ['musteri_id', 'kategori', 'cihaz']) },
  { name: 'hatirlatma_ekle', description: 'Hatırlatma ekler (ödeme, tahsilat, arama, yapılacak iş). Günü gelince ana sayfada ve bildirimde çıkar.', parameters: S({
    baslik: str('Kısa başlık, örn. "İhsan Köstekçi ödemesi"'), tarih: str('YYYY-MM-DD'), saat: str('Bildirim saati HH:MM (söylenmezse 09:00)'), tutar: num('TL tutar (yoksa gönderme)'),
    tekrar: en('Tekrar', ['tek', 'haftalik', 'aylik', 'yillik']), musteri_id: str('İlgili müşteri id (varsa)'), aciklama: str('Ek açıklama'),
  }, ['baslik', 'tarih']) },
  { name: 'hatirlatma_tamamla', description: 'Hatırlatmayı tamamlandı yapar (ödeme alındı, iş yapıldı). Tekrarlıysa bir sonraki tarihe kurar.', parameters: S({ id: str('Hatırlatma id') }, ['id']) },
  { name: 'is_emri_ac', description: 'Yeni iş emri açar.', parameters: S({
    musteri_id: str('Müşteri id'), baslik: str('Yapılacak iş, örn. "Hidrofor basınç ayarı"'), tarih: str('Planlanan tarih YYYY-MM-DD (söylenmezse bugün)'),
    aciklama: str('Ayrıntı'), iscilik: num('İşçilik ücreti TL'), atanan: str('İşi yapacak kişi'),
  }, ['musteri_id', 'baslik']) },
  { name: 'is_emri_guncelle', description: 'İş emrinin durumunu, tarihini veya işçilik ücretini değiştirir; tamamlandı yapılırsa bağlı bakımın son servis tarihi bugün olur.', parameters: S({
    id: str('İş emri id'), durum: en('Yeni durum', ['bekliyor', 'basladi', 'tamamlandi']), tarih: str('Yeni planlanan tarih YYYY-MM-DD'), iscilik: num('İşçilik ücreti TL'),
  }, ['id']) },
  { name: 'tahsilat_ekle', description: 'İş emrine alınan ödemeyi işler.', parameters: S({ is_emri_id: str('İş emri id'), tutar: num('Alınan tutar TL') }, ['is_emri_id', 'tutar']) },
  { name: 'not_ekle', description: 'Ekibin ortak not defterine not ekler.', parameters: S({ metin: str('Not'), musteri_id: str('İlgili müşteri id (varsa)'), sabit: bool('Üstte sabitlensin mi') }, ['metin']) },
  { name: 'gelis_ekle', description: 'Müşterinin geliş planını kaydeder; gelişten 2 gün önceye hazırlık iş emri otomatik açılır.', parameters: S({
    musteri_id: str('Müşteri id'), gelis_tarihi: str('YYYY-MM-DD'), ayrilis_tarihi: str('YYYY-MM-DD (biliniyorsa)'),
    istekler: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Hazırlık işleri (söylenmezse havuz hazırlama ve su vanalarını açma)' }, notlar: str('Not'),
  }, ['musteri_id', 'gelis_tarihi']) },
];

// Asistanın talimatı. Yazılı asistan gerçek değerlerle, sesli canlı asistan {{değişken}} yer tutucularla çağırır.
export function promptOlustur({ kullanici, hitap, bugun, musteriListesi, sesli }) {
  return `Sen ALKA Mekanik ve Havuz Sistemleri'nin asistanısın. ALKA, Çeşme/İzmir'de yazlık villalara havuz, kuyu pompası, hidrofor, sulama, tesisat ve elektrik bakım-servisi yapan bir firma. Bu uygulama firmanın iş takip sistemi; sen de içindeki verilere erişen bir çalışma arkadaşısın.
Konuştuğun kişi: ${kullanici} (ona "${hitap}" de). Bugün: ${bugun}. Saat dilimi İstanbul.

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
- Hatırlatmada saat söylenirse ("öğleden sonra 3'te" → 15:00) saat alanına yaz; söylenmezse 09:00. O saatte telefona bildirim gider.
- Tarih: "20'sinde" → bu ayın 20'si, geçtiyse gelecek ayın. "yarın", "cuma", "haftaya" bugüne göre. "30 bin" = 30000.
- Birden fazla iş istenirse hepsini yap; araçları mümkünse aynı turda birlikte çağır.
- SİLME: Not, hatırlatma/ödeme ve mesaj kaydı silebilirsin ama SADECE kayit_sil aracıyla. Önce notlar / hatirlatmalar / mesaj_gecmisi ile doğru kaydı bul; birden fazla aday varsa hangisi olduğunu sor. kayit_sil kaydı hemen silmez, kullanıcıdan onay ister: sen de "… siliniyor, emin misin?" diye sor. Kullanıcı onaylamadan ASLA "sildim" deme. Müşteri, iş emri, cihaz gibi diğer kayıtları silemezsin; onlar için ilgili sayfayı söyle.
- "Ödemesi yapıldı / alındı" denirse bunu silme olarak değil, hatirlatma_tamamla ile tamamlandı olarak işle; kullanıcı açıkça "sil" derse kayit_sil kullan.

MÜŞTERİ LİSTESİ (id|ad):
${musteriListesi}`;
}
