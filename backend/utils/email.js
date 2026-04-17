'use strict';

const nodemailer = require('nodemailer');

let transporter = null;

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
    subject: `📋 New Enquiry from ${msg.name} — Krispie's`,
    html: `
      <div style="${baseStyle}">
        <div style="${headerStyle}">
          <p style="color:#C9A870;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 4px">Krispie's Admin</p>
          <h2 style="color:#FAF7F0;margin:0;font-size:22px">New Enquiry Received</h2>
        </div>
        <div style="${bodyStyle}">
          <p style="${labelStyle}">Name</p><p style="${valueStyle}">${msg.name}</p>
          <p style="${labelStyle}">Phone</p><p style="${valueStyle}">${msg.phone || '—'}</p>
          <p style="${labelStyle}">Email</p><p style="${valueStyle}">${msg.email || '—'}</p>
          <p style="${labelStyle}">Event Type</p><p style="${valueStyle}">${msg.event_type || '—'}</p>
          <p style="${labelStyle}">Event Date</p><p style="${valueStyle}">${msg.event_date || '—'}</p>
          <p style="${labelStyle}">Outlet Preference</p><p style="${valueStyle}">${msg.outlet || '—'}</p>
          <p style="${labelStyle}">Quantity / Guests</p><p style="${valueStyle}">${msg.quantity || '—'}</p>
          <p style="${labelStyle}">Products Requested</p><p style="${valueStyle}">${msg.products || '—'}</p>
          <p style="${labelStyle}">Message</p><p style="${valueStyle}">${msg.message || '—'}</p>
        </div>
        <div style="${footerStyle}">
          Reply directly to this email, or log in to your admin panel to respond.<br>
          <a href="${process.env.FRONTEND_URL}/admin/" style="color:#C9A870">Open Admin Panel →</a>
        </div>
      </div>`,
  });
}

function newOrderEmail(order) {
  return sendEmail({
    to:      process.env.ADMIN_EMAIL,
    subject: `📦 New Order from ${order.customer_name} — Krispie's`,
    html: `
      <div style="${baseStyle}">
        <div style="${headerStyle}">
          <p style="color:#C9A870;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 4px">Krispie's Admin</p>
          <h2 style="color:#FAF7F0;margin:0;font-size:22px">New Order Logged</h2>
        </div>
        <div style="${bodyStyle}">
          <p style="${labelStyle}">Customer</p><p style="${valueStyle}">${order.customer_name}</p>
          <p style="${labelStyle}">Phone</p><p style="${valueStyle}">${order.customer_phone || '—'}</p>
          <p style="${labelStyle}">Items</p><p style="${valueStyle}">${order.items}</p>
          <p style="${labelStyle}">Quantity</p><p style="${valueStyle}">${order.quantity || '—'}</p>
          <p style="${labelStyle}">Amount</p><p style="${valueStyle}">${order.amount ? '₹' + order.amount : '—'}</p>
          <p style="${labelStyle}">Platform</p><p style="${valueStyle}">${order.platform || '—'}</p>
          <p style="${labelStyle}">Outlet</p><p style="${valueStyle}">${order.outlet || '—'}</p>
          <p style="${labelStyle}">Order Date</p><p style="${valueStyle}">${order.order_date || '—'}</p>
          <p style="${labelStyle}">Delivery Date</p><p style="${valueStyle}">${order.delivery_date || '—'}</p>
          <p style="${labelStyle}">Status</p><p style="${valueStyle}">${order.status}</p>
          ${order.notes ? `<p style="${labelStyle}">Notes</p><p style="${valueStyle}">${order.notes}</p>` : ''}
        </div>
        <div style="${footerStyle}">
          <a href="${process.env.FRONTEND_URL}/admin/orders.html" style="color:#C9A870">View Orders →</a>
        </div>
      </div>`,
  });
}

module.exports = { sendEmail, newMessageEmail, newOrderEmail };
