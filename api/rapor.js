function cevap(res, kod, veri) {
  res.statusCode = kod;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(veri));
}

export default async function handler(req, res) {
  try {
    const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
    const anahtar = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anahtar) return cevap(res, 500, { hata: 'Sunucu ayarları eksik.' });

    const istek = new URL(req.url, 'http://yerel');
    const token = (istek.searchParams.get('t') || '').trim();
    if (!/^[a-f0-9]{32}$/i.test(token)) return cevap(res, 400, { hata: 'Geçersiz rapor bağlantısı.' });

    const secim = [
      'order_no', 'title', 'description', 'yapilanlar', 'status', 'scheduled_date', 'completed_date',
      'assigned_to', 'materials', 'fotograflar', 'category', 'created_at',
      'customers(name,address)',
      'equipment(category,equipment_type,brand,model,notes,location,maintenance_rules(rule_name,next_due_date,active))',
    ].join(',');

    const yanit = await fetch(
      `${url}/rest/v1/work_orders?rapor_token=eq.${token}&select=${encodeURIComponent(secim)}&limit=1`,
      { headers: { apikey: anahtar, Authorization: `Bearer ${anahtar}` } }
    );
    if (!yanit.ok) {
      const metin = await yanit.text();
      return cevap(res, 500, { hata: 'Rapor okunamadı: ' + metin.slice(0, 200) });
    }

    const liste = await yanit.json();
    const is = liste[0];
    if (!is) return cevap(res, 404, { hata: 'Rapor bulunamadı.' });

    const bugun = new Date().toISOString().slice(0, 10);
    const e = is.equipment || null;
    const sonrakiBakimlar = e
      ? (e.maintenance_rules || [])
          .filter((k) => k.active !== false && k.next_due_date && k.next_due_date >= bugun)
          .sort((a, b) => a.next_due_date.localeCompare(b.next_due_date))
          .map((k) => ({ ad: k.rule_name, tarih: k.next_due_date }))
      : [];

    return cevap(res, 200, {
      rapor: {
        no: is.order_no,
        baslik: is.title,
        aciklama: is.description,
        yapilanlar: is.yapilanlar,
        durum: is.status,
        planlanan: is.scheduled_date,
        tamamlanan: is.completed_date,
        olusturma: is.created_at,
        personel: is.assigned_to,
        malzemeler: (is.materials || []).map((m) => ({ ad: m.ad, adet: m.adet })),
        fotograflar: (is.fotograflar || []).map((f) => ({ url: f.url, tur: f.tur })),
        musteri: is.customers ? { ad: is.customers.name, adres: is.customers.address } : null,
        cihaz: e
          ? {
              kategori: e.category,
              tur: e.equipment_type,
              marka: e.brand,
              model: e.model,
              parcalar: e.notes,
              konum: e.location,
            }
          : null,
        sonrakiBakimlar,
      },
    });
  } catch (err) {
    return cevap(res, 500, { hata: 'Sunucu hatası: ' + (err.message || 'bilinmeyen') });
  }
}
