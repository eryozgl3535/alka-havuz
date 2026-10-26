// Yapay zeka asistanının "elleri": uygulamadaki verileri okuyan ve kayıt ekleyen/güncelleyen araçlar.
// Yapay zekâ hangi aracı çağıracağına kendi karar verir; araçlar burada, giriş yapmış kullanıcının yetkisiyle çalışır.
// Yazan her araç bir "geriAl" fonksiyonu döndürür: asistan onay sormaz, yanlışsa ekranda tek dokunuşla geri alınır.
// Kural: silme aracı YOK (silme işi sayfalardan elle yapılır).
import { supabase } from './supabase';

const yerel = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const bugun = () => yerel(new Date());
const gunEkle = (t, n) => { const d = new Date(t + 'T00:00:00'); d.setDate(d.getDate() + n); return yerel(d); };
const sayi = (v) => { const n = parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')); return isNaN(n) ? 0 : n; };
const json = (x) => { try { return JSON.parse(x || '{}'); } catch { return { baslik: x || '' }; } };
const trTarih = (t) => (t ? new Date(t + 'T00:00:00').toLocaleDateString('tr-TR') : '');
const kisalt = (s, n = 160) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n) + '…' : t; };
const hataVer = (e) => { if (e) throw new Error(e.message || String(e)); };

function sonrakiTarih(t, tekrar) {
  const d = new Date(t + 'T00:00:00');
  if (tekrar === 'aylik') d.setMonth(d.getMonth() + 1);
  else if (tekrar === 'haftalik') d.setDate(d.getDate() + 7);
  else if (tekrar === 'yillik') d.setFullYear(d.getFullYear() + 1);
  return yerel(d);
}

const HAZIRLIK_VARSAYILAN = ['Havuz hazırlama (temizlik + kimyasal ayar)', 'Su vanalarını açma'];
const DURUM_AD = { bekliyor: 'bekliyor', basladi: 'başlandı', tamamlandi: 'tamamlandı' };

// Araç tanımları ayrı dosyada (sesli canlı asistan sunucusu da aynı listeyi kullanıyor)
import { ARACLAR } from './asistanTanimlar.js';
export { ARACLAR };

// ------------------------------------------------------------ çalıştırıcılar
// Her biri { sonuc } döndürür; yazanlar ayrıca { eylem: "kısa açıklama", geriAl: async () => {} } döndürür.
async function musteriAdi(id) {
  if (!id) return null;
  const { data } = await supabase.from('customers').select('name').eq('id', id).maybeSingle();
  return data?.name || null;
}
const cihazYazi = (e) => [e.equipment_type || e.category, e.brand, e.model].filter(Boolean).join(' · ');

const CALISTIR = {
  async saat_kac() {
    const n = new Date();
    const z = { timeZone: 'Europe/Istanbul' };
    return {
      saat: n.toLocaleTimeString('tr-TR', { ...z, hour: '2-digit', minute: '2-digit' }),
      tarih: n.toLocaleDateString('en-CA', z),
      gun: n.toLocaleDateString('tr-TR', { ...z, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    };
  },
  async genel_ozet() {
    const b = bugun(), ileri = gunEkle(b, 14);
    const [m, isler, bakim, hat] = await Promise.all([
      supabase.from('customers').select('id', { count: 'exact', head: true }),
      supabase.from('work_orders').select('id, title, status, scheduled_date, material_cost, labor_cost, paid_amount, customers(name)').neq('status', 'tamamlandi').order('scheduled_date', { ascending: true }).limit(300),
      supabase.from('maintenance_rules').select('rule_name, next_due_date, equipment(equipment_type, customers(name))').or('active.is.null,active.eq.true').not('next_due_date', 'is', null).lte('next_due_date', ileri).order('next_due_date').limit(200),
      supabase.from('mesaj_kayitlari').select('mesaj').eq('tur', 'hatirlatma').limit(300),
    ]);
    const aktif = isler.data || [];
    const alacak = await supabase.from('work_orders').select('material_cost, labor_cost, paid_amount').or('payment_status.is.null,payment_status.neq.odendi').limit(1000);
    const acikHat = (hat.data || []).map((h) => json(h.mesaj));
    return {
      bugun: b,
      musteri_sayisi: m.count ?? null,
      bugunku_isler: aktif.filter((x) => x.scheduled_date === b).map((x) => `${x.customers?.name || '?'}: ${x.title}`),
      geciken_isler: aktif.filter((x) => x.scheduled_date && x.scheduled_date < b).length,
      bekleyen_toplam_is: aktif.length,
      geciken_bakim: (bakim.data || []).filter((k) => k.next_due_date < b).length,
      onumuzdeki_14_gun_bakim: (bakim.data || []).filter((k) => k.next_due_date >= b).length,
      acik_hatirlatma: acikHat.length,
      bugunku_hatirlatmalar: acikHat.filter((h) => h.tarih === b).map((h) => h.baslik + (h.tutar ? ` (${h.tutar} TL)` : '')),
      geciken_hatirlatma: acikHat.filter((h) => h.tarih && h.tarih < b).length,
      tahsil_edilmemis_alacak_tl: Math.round((alacak.data || []).reduce((a, x) => a + Math.max(0, sayi(x.material_cost) + sayi(x.labor_cost) - sayi(x.paid_amount)), 0)),
    };
  },

  async musteri_ara({ sorgu }) {
    const q = String(sorgu || '').trim().replace(/[%,()]/g, ' ');
    if (!q) return { sonuc: [] };
    const { data, error } = await supabase.from('customers')
      .select('id, name, phone, address, notes, equipment(category, equipment_type, brand, model)')
      .or(`name.ilike.%${q}%,phone.ilike.%${q.replace(/\s/g, '')}%,address.ilike.%${q}%`).limit(10);
    hataVer(error);
    return { sonuc: (data || []).map((c) => ({ id: c.id, ad: c.name, telefon: c.phone, adres: c.address, not: kisalt(c.notes, 120), cihazlar: (c.equipment || []).map(cihazYazi) })) };
  },

  async musteri_detay({ musteri_id }) {
    const [c, isler, hat, gel] = await Promise.all([
      supabase.from('customers').select('*, equipment(*, maintenance_rules(rule_name, next_due_date, last_service_date, period_months, active))').eq('id', musteri_id).maybeSingle(),
      supabase.from('work_orders').select('id, title, status, scheduled_date, completed_date, material_cost, labor_cost, paid_amount, payment_status').eq('customer_id', musteri_id).order('scheduled_date', { ascending: false }).limit(10),
      supabase.from('mesaj_kayitlari').select('id, tur, mesaj, created_at').eq('customer_id', musteri_id).in('tur', ['hatirlatma', 'not', 'not-sabit']).order('created_at', { ascending: false }).limit(20),
      supabase.from('gelisler').select('gelis_tarihi, ayrilis_tarihi, durum').eq('customer_id', musteri_id).order('gelis_tarihi', { ascending: false }).limit(5),
    ]);
    hataVer(c.error);
    if (!c.data) return { sonuc: 'Bu id ile müşteri bulunamadı.' };
    const m = c.data;
    return {
      id: m.id, ad: m.name, telefon: m.phone, adres: m.address, not: m.notes,
      cihazlar: (m.equipment || []).map((e) => ({ cihaz: cihazYazi(e), konum: e.location, kurulum: e.install_date, parcalar: e.notes,
        bakimlar: (e.maintenance_rules || []).filter((k) => k.active !== false).map((k) => ({ bakim: k.rule_name, sonraki: k.next_due_date, son: k.last_service_date, periyot_ay: k.period_months })) })),
      son_is_emirleri: (isler.data || []).map((x) => ({ id: x.id, is: x.title, durum: DURUM_AD[x.status] || x.status, tarih: x.scheduled_date, tamamlanma: x.completed_date,
        toplam_tl: sayi(x.material_cost) + sayi(x.labor_cost), odenen_tl: sayi(x.paid_amount) })),
      hatirlatmalar: (hat.data || []).filter((x) => x.tur === 'hatirlatma').map((x) => ({ id: x.id, ...json(x.mesaj) })),
      notlar: (hat.data || []).filter((x) => x.tur !== 'hatirlatma').map((x) => kisalt(x.mesaj, 200)),
      gelisler: gel.data || [],
    };
  },

  async is_emirleri({ durum = 'aktif', baslangic, bitis, musteri_id, odenmemis } = {}) {
    let q = supabase.from('work_orders').select('id, title, status, scheduled_date, completed_date, assigned_to, material_cost, labor_cost, paid_amount, payment_status, customers(id, name)');
    if (durum === 'aktif') q = q.neq('status', 'tamamlandi');
    else if (durum && durum !== 'tumu') q = q.eq('status', durum);
    if (baslangic) q = q.gte('scheduled_date', baslangic);
    if (bitis) q = q.lte('scheduled_date', bitis);
    if (musteri_id) q = q.eq('customer_id', musteri_id);
    if (odenmemis) q = q.or('payment_status.is.null,payment_status.neq.odendi');
    const { data, error } = await q.order('scheduled_date', { ascending: true }).limit(60);
    hataVer(error);
    return { adet: (data || []).length, sonuc: (data || []).map((x) => ({ id: x.id, musteri: x.customers?.name, musteri_id: x.customers?.id, is: x.title, durum: DURUM_AD[x.status] || x.status,
      tarih: x.scheduled_date, atanan: x.assigned_to || undefined, toplam_tl: sayi(x.material_cost) + sayi(x.labor_cost), odenen_tl: sayi(x.paid_amount) })) };
  },

  async bakimlar({ gun = 30 } = {}) {
    const { data, error } = await supabase.from('maintenance_rules')
      .select('id, rule_name, next_due_date, last_service_date, equipment(equipment_type, brand, customers(id, name, phone))')
      .or('active.is.null,active.eq.true').not('next_due_date', 'is', null).lte('next_due_date', gunEkle(bugun(), Math.min(365, Math.max(1, gun)))).order('next_due_date').limit(80);
    hataVer(error);
    const b = bugun();
    return { sonuc: (data || []).map((k) => ({ bakim: k.rule_name, tarih: k.next_due_date, gecikmis: k.next_due_date < b, son_servis: k.last_service_date,
      musteri: k.equipment?.customers?.name, musteri_id: k.equipment?.customers?.id, telefon: k.equipment?.customers?.phone, cihaz: [k.equipment?.equipment_type, k.equipment?.brand].filter(Boolean).join(' ') })) };
  },

  async hatirlatmalar({ durum = 'acik' } = {}) {
    const turler = durum === 'acik' ? ['hatirlatma'] : durum === 'tamamlanan' ? ['hatirlatma-bitti'] : ['hatirlatma', 'hatirlatma-bitti'];
    const { data, error } = await supabase.from('mesaj_kayitlari').select('id, tur, mesaj, customers(name)').in('tur', turler).order('created_at', { ascending: false }).limit(150);
    hataVer(error);
    return { sonuc: (data || []).map((x) => ({ id: x.id, ...json(x.mesaj), durum: x.tur === 'hatirlatma' ? 'açık' : 'tamamlandı', musteri: x.customers?.name || undefined }))
      .sort((a, b) => String(a.tarih || '9').localeCompare(String(b.tarih || '9'))) };
  },

  async gelisler({ baslangic, bitis } = {}) {
    let q = supabase.from('gelisler').select('id, gelis_tarihi, ayrilis_tarihi, durum, istekler, notlar, customers(id, name, phone)').gte('gelis_tarihi', baslangic || bugun());
    if (bitis) q = q.lte('gelis_tarihi', bitis);
    const { data, error } = await q.order('gelis_tarihi').limit(50);
    hataVer(error);
    return { sonuc: (data || []).map((g) => ({ id: g.id, musteri: g.customers?.name, musteri_id: g.customers?.id, gelis: g.gelis_tarihi, ayrilis: g.ayrilis_tarihi, durum: g.durum, istekler: g.istekler, not: g.notlar })) };
  },

  async notlar({ ara, bitenler } = {}) {
    let q = supabase.from('mesaj_kayitlari').select('id, tur, mesaj, gonderen, created_at, customers(name)').in('tur', bitenler ? ['not', 'not-sabit', 'not-bitti'] : ['not', 'not-sabit']);
    if (ara) q = q.ilike('mesaj', `%${String(ara).replace(/[%]/g, '')}%`);
    const { data, error } = await q.order('created_at', { ascending: false }).limit(30);
    hataVer(error);
    return { sonuc: (data || []).map((n) => ({ id: n.id, not: kisalt(n.mesaj, 300), yazan: n.gonderen, tarih: String(n.created_at).slice(0, 10), sabit: n.tur === 'not-sabit', tamamlandi: n.tur === 'not-bitti' || undefined, musteri: n.customers?.name })) };
  },

  async mesaj_gecmisi({ musteri_id } = {}) {
    let q = supabase.from('mesaj_kayitlari').select('id, tur, kanal, baslik, mesaj, gonderen, created_at, customers(id, name)')
      .not('tur', 'like', 'not%').not('tur', 'like', 'hatirlatma%');
    if (musteri_id) q = q.eq('customer_id', musteri_id);
    const { data, error } = await q.order('created_at', { ascending: false }).limit(40);
    hataVer(error);
    return { sonuc: (data || []).map((m) => ({ id: m.id, baslik: m.baslik, kanal: m.kanal, musteri: m.customers?.name, tarih: String(m.created_at).slice(0, 10), mesaj: kisalt(m.mesaj, 120) })) };
  },

  // ---------------- silme onayı (silmez; uygulama kullanıcıya sorar)
  async kayit_sil({ id }) {
    if (!id) throw new Error('Silinecek kaydın id\'si yok.');
    const { data: satir, error } = await supabase.from('mesaj_kayitlari').select('*, customers(name)').eq('id', id).maybeSingle();
    hataVer(error);
    if (!satir) return { sonuc: { hata: 'Bu id ile kayıt bulunamadı. Önce listeleme aracıyla doğru kaydı bul.' } };
    const musteri = satir.customers?.name;
    const tur = String(satir.tur || '');
    let aciklama;
    if (tur.startsWith('hatirlatma')) {
      const v = json(satir.mesaj);
      aciklama = `"${v.baslik || 'Hatırlatma'}" hatırlatması` + (v.tutar ? ` (${Number(v.tutar).toLocaleString('tr-TR')} TL` + (v.tarih ? `, ${trTarih(v.tarih)})` : ')') : (v.tarih ? ` (${trTarih(v.tarih)})` : ''));
    } else if (tur.startsWith('not')) {
      aciklama = `"${kisalt(satir.mesaj, 60)}" notu`;
    } else {
      aciklama = `${musteri ? musteri + ' için ' : ''}"${kisalt(satir.baslik || satir.mesaj, 50)}" mesaj kaydı`;
    }
    if (musteri && !aciklama.includes(musteri)) aciklama += ` — ${musteri}`;
    const { customers, ...ham } = satir; // geri almak için kaydın kendisi saklanır
    return {
      sonuc: `ONAY BEKLENİYOR, HENÜZ SİLİNMEDİ: ${aciklama}. Kullanıcıya tek cümleyle "${aciklama} siliniyor, emin misin?" diye sor. Kendin "sildim" deme; kullanıcı onaylarsa uygulama siler.`,
      silOnay: { id, aciklama, satir: ham },
    };
  },

  // ---------------- yazanlar
  async musteri_ekle({ ad, telefon, adres, not }) {
    const isim = String(ad || '').trim();
    if (!isim) throw new Error('Müşteri adı boş olamaz.');
    const { data: ayni } = await supabase.from('customers').select('id, name, phone').ilike('name', isim).limit(1);
    if (ayni?.length) return { sonuc: `Bu isimde müşteri zaten var (id=${ayni[0].id}, tel ${ayni[0].phone || 'yok'}). Yeni kayıt açmadım; aynı kişi değilse ayırt edici bir bilgiyle (soyad, bölge) tekrar iste.` };
    const { data, error } = await supabase.from('customers').insert([{ name: isim, phone: String(telefon || '').trim(), address: String(adres || '').trim(), notes: String(not || '').trim() }]).select('id').single();
    hataVer(error);
    return { sonuc: { eklendi: true, musteri_id: data.id }, eylem: `Müşteri eklendi: ${isim}`,
      geriAl: async () => hataVer((await supabase.from('customers').delete().eq('id', data.id)).error) };
  },

  async musteri_guncelle({ musteri_id, ad, telefon, adres, not }) {
    const { data: eski, error: e0 } = await supabase.from('customers').select('name, phone, address, notes').eq('id', musteri_id).maybeSingle();
    hataVer(e0);
    if (!eski) throw new Error('Müşteri bulunamadı.');
    const yeni = {};
    if (ad != null && ad !== '') yeni.name = String(ad).trim();
    if (telefon != null && telefon !== '') yeni.phone = String(telefon).trim();
    if (adres != null && adres !== '') yeni.address = String(adres).trim();
    if (not != null && not !== '') yeni.notes = String(not).trim();
    if (!Object.keys(yeni).length) return { sonuc: 'Değişecek bilgi yok.' };
    hataVer((await supabase.from('customers').update(yeni).eq('id', musteri_id)).error);
    const geri = {}; for (const k of Object.keys(yeni)) geri[k] = eski[k];
    return { sonuc: { guncellendi: Object.keys(yeni) }, eylem: `${eski.name} güncellendi`,
      geriAl: async () => hataVer((await supabase.from('customers').update(geri).eq('id', musteri_id)).error) };
  },

  async cihaz_ekle({ musteri_id, kategori, cihaz, marka, model, konum }) {
    const ad = await musteriAdi(musteri_id);
    if (!ad) throw new Error('Müşteri bulunamadı.');
    const { data, error } = await supabase.from('equipment').insert([{ customer_id: musteri_id, category: String(kategori).trim(), equipment_type: String(cihaz).trim(),
      brand: marka ? String(marka).trim() : null, model: model ? String(model).trim() : null, location: konum ? String(konum).trim() : null, install_date: bugun() }]).select('id').single();
    hataVer(error);
    return { sonuc: { eklendi: true, cihaz_id: data.id, not: 'Bakım periyodu eklenmedi; gerekirse Müşteriler sayfasından cihazı düzenleyerek eklenir.' }, eylem: `${ad}: ${cihaz} eklendi`,
      geriAl: async () => hataVer((await supabase.from('equipment').delete().eq('id', data.id)).error) };
  },

  async hatirlatma_ekle({ baslik, tarih, saat, tutar, tekrar = 'tek', musteri_id, aciklama }, ctx) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(tarih || ''))) throw new Error('Tarih YYYY-MM-DD olmalı.');
    const saatT = /^\d{1,2}:\d{2}$/.test(String(saat || '')) ? String(saat).padStart(5, '0') : '09:00';
    const icerik = JSON.stringify({ baslik: String(baslik || 'Hatırlatma').trim(), tarih, saat: saatT, tutar: tutar != null && tutar !== '' ? sayi(tutar) : null, tekrar: tekrar || 'tek', aciklama: String(aciklama || '').trim() });
    const { data, error } = await supabase.from('mesaj_kayitlari').insert([{ tur: 'hatirlatma', kanal: 'hatirlatma', baslik: 'Hatırlatma', mesaj: icerik, gonderen: ctx.ad || '', customer_id: musteri_id || null }]).select('id').single();
    hataVer(error);
    return { sonuc: { eklendi: true, id: data.id, bildirim_saati: saatT }, eylem: `Hatırlatma: ${baslik} · ${trTarih(tarih)} ${saatT}${tutar ? ' · ' + Number(sayi(tutar)).toLocaleString('tr-TR') + ' TL' : ''}`,
      geriAl: async () => hataVer((await supabase.from('mesaj_kayitlari').delete().eq('id', data.id)).error) };
  },

  async hatirlatma_tamamla({ id }) {
    const { data: h, error: e0 } = await supabase.from('mesaj_kayitlari').select('id, tur, mesaj').eq('id', id).maybeSingle();
    hataVer(e0);
    if (!h || !String(h.tur).startsWith('hatirlatma')) throw new Error('Hatırlatma bulunamadı.');
    const v = json(h.mesaj);
    const geriAl = async () => hataVer((await supabase.from('mesaj_kayitlari').update({ tur: h.tur, mesaj: h.mesaj }).eq('id', id)).error);
    if (v.tekrar && v.tekrar !== 'tek' && v.tarih) {
      const yeni = sonrakiTarih(v.tarih, v.tekrar);
      hataVer((await supabase.from('mesaj_kayitlari').update({ mesaj: JSON.stringify({ ...v, tarih: yeni }) }).eq('id', id)).error);
      return { sonuc: { tamamlandi: true, tekrarli: true, sonraki_tarih: yeni }, eylem: `${v.baslik} tamamlandı · sonraki ${trTarih(yeni)}`, geriAl };
    }
    hataVer((await supabase.from('mesaj_kayitlari').update({ tur: 'hatirlatma-bitti' }).eq('id', id)).error);
    return { sonuc: { tamamlandi: true }, eylem: `${v.baslik} tamamlandı`, geriAl };
  },

  async is_emri_ac({ musteri_id, baslik, tarih, aciklama, iscilik, atanan }) {
    const ad = await musteriAdi(musteri_id);
    if (!ad) throw new Error('Müşteri bulunamadı.');
    const t = /^\d{4}-\d{2}-\d{2}$/.test(String(tarih || '')) ? tarih : bugun();
    const { data, error } = await supabase.from('work_orders').insert([{ customer_id: musteri_id, title: String(baslik).trim(), description: String(aciklama || ''), scheduled_date: t,
      assigned_to: String(atanan || ''), materials: [], material_cost: 0, labor_cost: sayi(iscilik) }]).select('id').single();
    hataVer(error);
    return { sonuc: { acildi: true, id: data.id, tarih: t }, eylem: `İş emri: ${ad} · ${baslik} · ${trTarih(t)}`,
      geriAl: async () => hataVer((await supabase.from('work_orders').delete().eq('id', data.id)).error) };
  },

  async is_emri_guncelle({ id, durum, tarih, iscilik }) {
    const { data: x, error: e0 } = await supabase.from('work_orders').select('id, title, status, completed_date, scheduled_date, labor_cost, maintenance_rule_id, customers(name)').eq('id', id).maybeSingle();
    hataVer(e0);
    if (!x) throw new Error('İş emri bulunamadı.');
    const yeni = {}, geri = {};
    if (durum && durum !== x.status) {
      yeni.status = durum; geri.status = x.status; geri.completed_date = x.completed_date;
      yeni.completed_date = durum === 'tamamlandi' ? bugun() : null;
    }
    if (tarih && tarih !== x.scheduled_date) { yeni.scheduled_date = tarih; geri.scheduled_date = x.scheduled_date; }
    if (iscilik != null && iscilik !== '') { yeni.labor_cost = sayi(iscilik); geri.labor_cost = x.labor_cost; }
    if (!Object.keys(yeni).length) return { sonuc: 'Değişecek bir şey yok.' };
    hataVer((await supabase.from('work_orders').update(yeni).eq('id', id)).error);
    let kuralGeri = null;
    if (yeni.status === 'tamamlandi' && x.maintenance_rule_id) {
      const { data: k } = await supabase.from('maintenance_rules').select('last_service_date').eq('id', x.maintenance_rule_id).maybeSingle();
      kuralGeri = k?.last_service_date ?? null;
      await supabase.from('maintenance_rules').update({ last_service_date: bugun() }).eq('id', x.maintenance_rule_id);
    }
    const ne = [yeni.status && DURUM_AD[yeni.status], yeni.scheduled_date && trTarih(yeni.scheduled_date), yeni.labor_cost != null && yeni.labor_cost + ' TL işçilik'].filter(Boolean).join(', ');
    return { sonuc: { guncellendi: true }, eylem: `${x.customers?.name || ''} · ${x.title}: ${ne}`,
      geriAl: async () => {
        hataVer((await supabase.from('work_orders').update(geri).eq('id', id)).error);
        if (kuralGeri !== null || (yeni.status === 'tamamlandi' && x.maintenance_rule_id)) await supabase.from('maintenance_rules').update({ last_service_date: kuralGeri }).eq('id', x.maintenance_rule_id);
      } };
  },

  async tahsilat_ekle({ is_emri_id, tutar }) {
    const t = sayi(tutar);
    if (t <= 0) throw new Error('Tutar sıfırdan büyük olmalı.');
    const { data: x, error: e0 } = await supabase.from('work_orders').select('title, material_cost, labor_cost, paid_amount, payment_status, customers(name)').eq('id', is_emri_id).maybeSingle();
    hataVer(e0);
    if (!x) throw new Error('İş emri bulunamadı.');
    const toplam = sayi(x.material_cost) + sayi(x.labor_cost), odenen = sayi(x.paid_amount) + t;
    const durum = odenen <= 0 ? 'bekliyor' : odenen < toplam ? 'kismi' : 'odendi';
    hataVer((await supabase.from('work_orders').update({ paid_amount: odenen, payment_status: durum }).eq('id', is_emri_id)).error);
    return { sonuc: { islendi: true, toplam_tl: toplam, odenen_tl: odenen, kalan_tl: Math.max(0, toplam - odenen) }, eylem: `Tahsilat: ${x.customers?.name || ''} · ${t.toLocaleString('tr-TR')} TL`,
      geriAl: async () => hataVer((await supabase.from('work_orders').update({ paid_amount: x.paid_amount, payment_status: x.payment_status }).eq('id', is_emri_id)).error) };
  },

  async not_ekle({ metin, musteri_id, sabit }, ctx) {
    const m = String(metin || '').trim();
    if (!m) throw new Error('Not boş olamaz.');
    const { data, error } = await supabase.from('mesaj_kayitlari').insert([{ tur: sabit ? 'not-sabit' : 'not', kanal: 'not', baslik: 'Not', mesaj: m, gonderen: ctx.ad || '', customer_id: musteri_id || null }]).select('id').single();
    hataVer(error);
    return { sonuc: { eklendi: true }, eylem: `Not eklendi: ${kisalt(m, 50)}`,
      geriAl: async () => hataVer((await supabase.from('mesaj_kayitlari').delete().eq('id', data.id)).error) };
  },

  async gelis_ekle({ musteri_id, gelis_tarihi, ayrilis_tarihi, istekler, notlar }) {
    const ad = await musteriAdi(musteri_id);
    if (!ad) throw new Error('Müşteri bulunamadı.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(gelis_tarihi || ''))) throw new Error('Geliş tarihi YYYY-MM-DD olmalı.');
    const isler = Array.isArray(istekler) && istekler.length ? istekler.map(String) : HAZIRLIK_VARSAYILAN;
    let hz = gunEkle(gelis_tarihi, -2); if (hz < bugun()) hz = bugun();
    const aciklama = isler.map((x) => `• ${x}`).join('\n') + (notlar ? `\n\nNot: ${notlar}` : '');
    const { data: is, error: e1 } = await supabase.from('work_orders').insert([{ customer_id: musteri_id, title: `🏡 Geliş hazırlığı (${trTarih(gelis_tarihi)})`, description: aciklama, scheduled_date: hz, materials: [] }]).select('id').single();
    hataVer(e1);
    const { data: g, error: e2 } = await supabase.from('gelisler').insert([{ customer_id: musteri_id, gelis_tarihi, ayrilis_tarihi: ayrilis_tarihi || null, istekler: isler, ayrilis_istekleri: [],
      notlar: String(notlar || ''), kaynak: 'asistan', hazirlik_is_id: is.id, kapanis_is_id: null }]).select('id').single();
    if (e2) { await supabase.from('work_orders').delete().eq('id', is.id); hataVer(e2); }
    return { sonuc: { kaydedildi: true, hazirlik_is_emri_tarihi: hz }, eylem: `Geliş: ${ad} · ${trTarih(gelis_tarihi)} (hazırlık ${trTarih(hz)})`,
      geriAl: async () => {
        hataVer((await supabase.from('gelisler').delete().eq('id', g.id)).error);
        await supabase.from('work_orders').delete().eq('id', is.id).neq('status', 'tamamlandi');
      } };
  },
};

export async function aracCalistir(ad, args, ctx) {
  const fn = CALISTIR[ad];
  if (!fn) return { sonuc: { hata: 'Böyle bir araç yok: ' + ad } };
  try {
    const r = await fn(args || {}, ctx || {});
    return r && typeof r === 'object' && 'sonuc' in r ? r : { sonuc: r };
  } catch (e) {
    return { sonuc: { hata: e?.message || String(e) } };
  }
}

export const YAZAN_ARACLAR = new Set(['musteri_ekle', 'musteri_guncelle', 'cihaz_ekle', 'hatirlatma_ekle', 'hatirlatma_tamamla', 'is_emri_ac', 'is_emri_guncelle', 'tahsilat_ekle', 'not_ekle', 'gelis_ekle']);
