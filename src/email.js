const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

function buildEmailHtml(newItems, pollIntervalMinutes) {
  const rows = newItems.map((item) => {
    const price = item.price?.amount ?? '?';
    const currency = item.price?.currency_code ?? 'EUR';
    const imgTag = item.photo?.url
      ? `<img src="${item.photo.url}" width="80" style="border-radius:4px;display:block;" />`
      : '';
    return `
      <tr>
        <td style="padding:12px;border-bottom:1px solid #eee;vertical-align:top;width:90px;">${imgTag}</td>
        <td style="padding:12px;border-bottom:1px solid #eee;vertical-align:top;">
          <strong style="font-size:15px;">
            <a href="${item.url}" style="color:#111;text-decoration:none;">${item.title}</a>
          </strong><br/>
          <span style="color:#555;font-size:13px;">
            ${currency} ${price}
            ${item.brand_title ? `&nbsp;·&nbsp; ${item.brand_title}` : ''}
            ${item.size_title  ? `&nbsp;·&nbsp; ${item.size_title}`  : ''}
          </span><br/>
          <a href="${item.url}"
             style="display:inline-block;margin-top:8px;padding:6px 14px;
                    background:#111;color:#fff;font-size:12px;
                    border-radius:4px;text-decoration:none;">
            View on Vinted
          </a>
        </td>
      </tr>`;
  }).join('');

  return `
    <div style="font-family:sans-serif;max-width:600px;margin:auto;color:#111;">
      <h2 style="border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:0;">
        New Brut listing${newItems.length > 1 ? 's' : ''} on Vinted
      </h2>
      <table style="width:100%;border-collapse:collapse;">${rows}</table>
      <p style="color:#aaa;font-size:11px;margin-top:16px;">
        vinted-brut-notifier · polling every ${pollIntervalMinutes} min
      </p>
    </div>`;
}

async function sendNotification(newItems, pollIntervalMinutes) {
  const count = newItems.length;
  await transporter.sendMail({
    from: `"Vinted Notifier" <${process.env.GMAIL_USER}>`,
    to: process.env.NOTIFY_EMAIL,
    subject: `[Vinted] ${count} new Brut listing${count > 1 ? 's' : ''}`,
    html: buildEmailHtml(newItems, pollIntervalMinutes),
  });
  console.log(`[email] Sent — ${count} new item(s) → ${process.env.NOTIFY_EMAIL}`);
}

module.exports = { sendNotification };
