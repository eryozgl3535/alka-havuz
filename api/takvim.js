// Hatırlatmayı telefonun takvimine alarmlı etkinlik olarak ekler (.ics dosyası).
// iPhone'da açılınca "Takvime ekle" ekranı çıkar; alarm, uygulama kapalıyken ve internet yokken bile
// telefonun kendi takvim uyarısıyla (sesli) çalar.
// Örnek: /api/takvim?b=İhsan Köstekçi ödemesi&t=2026-10-20&s=15:00&r=aylik&a=30.000 TL
const ics = (x) => String(x || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const iki = (n) => String(n).padStart(2, '0');

export default function handler(req, res) {
  const q = new URL(req.url || '/', 'http://x').searchParams;
  const baslik = (q.get('b') || 'Hatırlatma').slice(0, 120);
  const tarih = q.get('t') || '';
  const saat = /^\d{1,2}:\d{2}$/.test(q.get('s') || '') ? q.get('s').padStart(5, '0') : '09:00';
  const aciklama = (q.get('a') || '').slice(0, 300);
  const tekrar = q.get('r') || 'tek';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih)) { res.statusCode = 400; return res.end('Tarih yok'); }

  // Türkiye sabit UTC+3 (yaz saati yok): yerel saati UTC'ye çevir
  const [y, m, d] = tarih.split('-').map(Number);
  const [hh, mm] = saat.split(':').map(Number);
  const bas = new Date(Date.UTC(y, m - 1, d, hh - 3, mm));
  const bit = new Date(bas.getTime() + 30 * 60000);
  const utc = (t) => `${t.getUTCFullYear()}${iki(t.getUTCMonth() + 1)}${iki(t.getUTCDate())}T${iki(t.getUTCHours())}${iki(t.getUTCMinutes())}00Z`;
  const rrule = { aylik: 'FREQ=MONTHLY', haftalik: 'FREQ=WEEKLY', yillik: 'FREQ=YEARLY' }[tekrar];

  const satirlar = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ALKA//Hatirlatma//TR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:alka-${tarih}-${saat.replace(':', '')}-${Buffer.from(baslik).toString('hex').slice(0, 16)}@alka`,
    `DTSTAMP:${utc(new Date())}`,
    `DTSTART:${utc(bas)}`,
    `DTEND:${utc(bit)}`,
    ...(rrule ? [`RRULE:${rrule}`] : []),
    `SUMMARY:${ics('⏰ ' + baslik)}`,
    ...(aciklama ? [`DESCRIPTION:${ics(aciklama)}`] : []),
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${ics(baslik)}`, 'TRIGGER:-PT0M', 'END:VALARM',
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${ics(baslik)}`, 'TRIGGER:-PT1H', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ];
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `inline; filename="hatirlatma.ics"`);
  res.setHeader('Cache-Control', 'no-store');
  res.end(satirlar.join('\r\n'));
}
