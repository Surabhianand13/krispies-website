'use strict';

const nodemailer = require('nodemailer');

let transporter = null;

// User-supplied fields (contact form, checkout) get interpolated straight
// into HTML email bodies below -- escape them so a malicious name/message
// can't inject markup, links, or tracking content into the admin's inbox.
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Subject lines end up in a raw SMTP header -- strip CR/LF so a crafted name
// can't inject additional headers (e.g. a forged Bcc) into the message.
function safeSubject(str) {
  return String(str).replace(/[\r\n]+/g, ' ');
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
  return transporter;
}

async function sendEmail({ to, subject, html }) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('Email not configured — skipping notification.');
    return;
  }
  try {
    await getTransporter().sendMail({
      from: `"Krispie's Website" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error('Email send failed:', err.message);
  }
}

// ── Email templates ────────────────────────────────────────────────────────────
const baseStyle = `
  font-family: Georgia, serif; background:#0A0A0A; color:#FAF7F0;
  max-width:600px; margin:0 auto; border-radius:8px; overflow:hidden;
`;
const headerStyle = `
  background:#111; padding:28px 32px; border-bottom:1px solid rgba(201,168,112,0.3);
`;
const bodyStyle   = `padding:28px 32px;`;
const labelStyle  = `color:#C9A870; font-size:11px; letter-spacing:0.1em; text-transform:uppercase; margin-bottom:4px;`;
const valueStyle  = `color:#FAF7F0; font-size:15px; margin:0 0 18px;`;
const footerStyle = `
  background:#0A0A0A; border-top:1px solid rgba(201,168,112,0.15);
  padding:16px 32px; font-size:12px; color:#666; text-align:center;
`;

function newMessageEmail(msg) {
  return sendEmail({
    to:      process.env.ADMIN_EMAIL,
    subject: safeSubject(`📋 New Enquiry from ${msg.name} — Krispie's`),
    html: `
      <div style="${baseStyle}">
        <div style="${headerStyle}">
          <p style="color:#C9A870;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 4px">Krispie's Admin</p>
          <h2 style="color:#FAF7F0;margin:0;font-size:22px">New Enquiry Received</h2>
        </div>
        <div style="${bodyStyle}">
          <p style="${labelStyle}">Name</p><p style="${valueStyle}">${esc(msg.name)}</p>
          <p style="${labelStyle}">Phone</p><p style="${valueStyle}">${esc(msg.phone) || '—'}</p>
          <p style="${labelStyle}">Email</p><p style="${valueStyle}">${esc(msg.email) || '—'}</p>
          <p style="${labelStyle}">Event Type</p><p style="${valueStyle}">${esc(msg.event_type) || '—'}</p>
          <p style="${labelStyle}">Event Date</p><p style="${valueStyle}">${esc(msg.event_date) || '—'}</p>
          <p style="${labelStyle}">Outlet Preference</p><p style="${valueStyle}">${esc(msg.outlet) || '—'}</p>
          <p style="${labelStyle}">Quantity / Guests</p><p style="${valueStyle}">${esc(msg.quantity) || '—'}</p>
          <p style="${labelStyle}">Products Requested</p><p style="${valueStyle}">${esc(msg.products) || '—'}</p>
          <p style="${labelStyle}">Message</p><p style="${valueStyle}">${esc(msg.message) || '—'}</p>
        </div>
        <div style="${footerStyle}">
          Reply directly to this email, or log in to your admin panel to respond.<br>
          <a href="${process.env.FRONTEND_URL}/admin/" style="color:#C9A870">Open Admin Panel →</a>
        </div>
      </div>`,
  });
}

function newOrderEmail(order) {
  // Extract delivery address and mode from notes
  const notes = order.notes || '';
  const addrMatch = notes.match(/Address:\s*([^|[\]]+)/i);
  const deliveryAddress = addrMatch ? addrMatch[1].trim() : null;
  const modeMatch = notes.match(/Mode:\s*([^|[\]]+)/i);
  const deliveryMode = modeMatch ? modeMatch[1].trim() : null;

  // Payment status — once /verify succeeds status becomes 'confirmed'
  const isPaid = order.status === 'confirmed' || order.status === 'ready' || order.status === 'delivered';
  const paymentBadge = isPaid
    ? `<span style="background:#1a3a25;color:#3aac6e;border:1px solid #2d6043;padding:3px 10px;border-radius:4px;font-size:13px;font-weight:700;">✓ PAID via Razorpay</span>`
    : `<span style="background:#2d1f06;color:#d97706;border:1px solid #7c4a0c;padding:3px 10px;border-radius:4px;font-size:13px;font-weight:700;">⏳ Payment Pending</span>`;

  return sendEmail({
    to:      process.env.ADMIN_EMAIL,
    subject: safeSubject(`${isPaid ? '✅ PAID' : '⏳ PENDING'} — New Order from ${order.customer_name} | Krispie's`),
    html: `
      <div style="${baseStyle}">
        <div style="${headerStyle}">
          <p style="color:#C9A870;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 4px">Krispie's Admin</p>
          <h2 style="color:#FAF7F0;margin:0 0 10px;font-size:22px">New Order</h2>
          ${paymentBadge}
        </div>
        <div style="${bodyStyle}">
          <p style="${labelStyle}">Customer</p><p style="${valueStyle}">${esc(order.customer_name)}</p>
          <p style="${labelStyle}">Phone</p><p style="${valueStyle}">${esc(order.customer_phone) || '—'}</p>
          ${order.customer_email ? `<p style="${labelStyle}">Email</p><p style="${valueStyle}">${esc(order.customer_email)}</p>` : ''}
          <p style="${labelStyle}">Items</p><p style="${valueStyle}">${esc(order.items)}</p>
          <p style="${labelStyle}">Amount</p><p style="${valueStyle}" style="font-weight:700;font-size:18px;">${order.amount ? '₹' + esc(String(order.amount)) : '—'}</p>
          <p style="${labelStyle}">Outlet</p><p style="${valueStyle}">${esc(order.outlet) || '—'}</p>
          <p style="${labelStyle}">Delivery Date</p><p style="${valueStyle}">${esc(order.delivery_date) || '—'}</p>
          ${deliveryMode ? `<p style="${labelStyle}">Mode</p><p style="${valueStyle}">${esc(deliveryMode)}</p>` : ''}
          ${deliveryAddress ? `<p style="${labelStyle}">Delivery Address</p><p style="${valueStyle};color:#E8D9C0;">${esc(deliveryAddress)}</p>` : ''}
          ${order.notes ? `<p style="${labelStyle}">Full Notes</p><p style="${valueStyle};font-size:12px;color:#aaa;">${esc(order.notes)}</p>` : ''}
        </div>
        <div style="${footerStyle}">
          <a href="${process.env.FRONTEND_URL}/admin/orders.html" style="color:#C9A870">View in Admin Panel →</a>
        </div>
      </div>`,
  });
}

function customerOrderConfirmationEmail(order) {
  const frontendUrl = process.env.FRONTEND_URL || 'https://www.krispies.in';

  // Extract delivery address from notes (stored as "Mode: delivery | Address: … | …")
  const addrMatch = (order.notes || '').match(/Address:\s*([^|]+)/);
  const deliveryAddress = addrMatch ? addrMatch[1].trim() : null;

  // Humanise delivery date
  let deliveryDateDisplay = order.delivery_date || null;
  if (deliveryDateDisplay) {
    try {
      deliveryDateDisplay = new Date(deliveryDateDisplay + 'T00:00:00').toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      });
    } catch (_) {}
  }

  const imgBlock = order.product_image_url
    ? `<div style="text-align:center;margin:0 0 24px;">
        <img src="${esc(order.product_image_url)}" alt="${esc(order.items)}"
          style="width:220px;height:220px;object-fit:cover;border-radius:12px;border:3px solid #C9A870;">
       </div>`
    : '';

  const rowStyle = `display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(201,168,112,0.15);font-size:14px;`;
  const labelCol = `color:#C9A870;`;
  const valueCol = `color:#FAF7F0;text-align:right;font-weight:500;`;

  return sendEmail({
    to:      order.customer_email,
    subject: safeSubject(`Order Confirmed 🎂 Your Krispie's cake is on its way!`),
    html: `
      <div style="${baseStyle}">

        <!-- Header -->
        <div style="${headerStyle}">
          <p style="color:#C9A870;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;margin:0 0 6px">Krispie's — Since 1996</p>
          <h2 style="color:#FAF7F0;margin:0 0 6px;font-size:24px;font-family:Georgia,serif">
            Order Confirmed! 🎂
          </h2>
          <p style="color:rgba(250,247,240,0.82);margin:0;font-size:14px;line-height:1.6;">
            Hi ${esc(order.customer_name)}, your order has been received and is being crafted with love.<br>
            We'll send you more details shortly.
          </p>
        </div>

        <!-- Cake image -->
        <div style="${bodyStyle}padding-bottom:4px;">
          ${imgBlock}

          <!-- Invoice table -->
          <div style="background:#1A1A1A;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
            <p style="color:#C9A870;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;margin:0 0 12px;">Order Summary</p>
            <div style="${rowStyle}">
              <span style="${labelCol}">Order ID</span>
              <span style="${valueCol}">#${esc(order.id)}</span>
            </div>
            <div style="${rowStyle}">
              <span style="${labelCol}">Item</span>
              <span style="${valueCol}">${esc(order.items)}</span>
            </div>
            ${order.amount != null ? `
            <div style="${rowStyle}">
              <span style="${labelCol}">Amount Paid</span>
              <span style="${valueCol};color:#4CAF50;font-size:16px;">₹${Number(order.amount).toLocaleString('en-IN')}</span>
            </div>` : ''}
            ${deliveryDateDisplay ? `
            <div style="${rowStyle}">
              <span style="${labelCol}">Delivery Date</span>
              <span style="${valueCol}">${esc(deliveryDateDisplay)}</span>
            </div>` : ''}
            ${order.outlet ? `
            <div style="${rowStyle}">
              <span style="${labelCol}">Store / Outlet</span>
              <span style="${valueCol}">${esc(order.outlet)}</span>
            </div>` : ''}
            ${deliveryAddress ? `
            <div style="padding:10px 0;font-size:14px;border-bottom:1px solid rgba(201,168,112,0.15);">
              <span style="${labelCol}display:block;margin-bottom:4px;">Delivery Address</span>
              <span style="${valueCol}text-align:left;">${esc(deliveryAddress)}</span>
            </div>` : ''}
            <div style="padding:10px 0;font-size:14px;">
              <span style="${labelCol}">Status</span>
              <span style="color:#4CAF50;font-weight:700;text-transform:uppercase;font-size:12px;float:right;">✓ Confirmed</span>
            </div>
          </div>

          <!-- What's next -->
          <div style="background:#111;border-radius:10px;padding:16px 20px;margin-bottom:4px;">
            <p style="color:#C9A870;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;margin:0 0 10px;">What happens next?</p>
            <p style="color:rgba(250,247,240,0.78);font-size:13px;line-height:1.7;margin:0;">
              Our team will reach out on <strong style="color:#FAF7F0;">${esc(order.customer_phone || 'your phone')}</strong> to confirm customisation details and delivery time.
              Your cake will be freshly baked and delivered with care. 🎂
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div style="${footerStyle}">
          Questions? Call us at <strong>+91 79752 18850</strong> or reply to this email.<br>
          <a href="${frontendUrl}" style="color:#C9A870;text-decoration:none;">www.krispies.in</a>
          &nbsp;·&nbsp;
          <a href="https://www.instagram.com/krispies.in" style="color:#C9A870;text-decoration:none;">@krispies.in</a>
        </div>
      </div>`,
  });
}

function otpLoginEmail(email, otp) {
  return sendEmail({
    to:      email,
    subject: `${otp} is your Krispie's login code`,
    html: `
      <div style="${baseStyle}">
        <div style="${headerStyle}">
          <p style="color:#C9A870;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 4px">Krispie's</p>
          <h2 style="color:#FAF7F0;margin:0;font-size:22px">Your login code</h2>
        </div>
        <div style="${bodyStyle}">
          <p style="${valueStyle}margin-bottom:6px;">Enter this code to log in:</p>
          <p style="font-family:Georgia,serif;font-size:36px;letter-spacing:0.2em;color:#C9A870;font-weight:700;margin:0 0 18px;">${esc(otp)}</p>
          <p style="${valueStyle}font-size:13px;opacity:0.75;">This code expires in 10 minutes. If you didn't request it, you can safely ignore this email.</p>
        </div>
        <div style="${footerStyle}">
          <a href="${process.env.FRONTEND_URL}" style="color:#C9A870">www.krispies.in</a>
        </div>
      </div>`,
  });
}

module.exports = { sendEmail, newMessageEmail, newOrderEmail, customerOrderConfirmationEmail, otpLoginEmail };
