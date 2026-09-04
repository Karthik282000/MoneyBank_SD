import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import pkg from 'pg';
import nodemailer from 'nodemailer';
import axios from 'axios';

import crypto from 'crypto';

import dotenv from 'dotenv';
dotenv.config();


import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Put your Durga Devi image at ./assets/durga-bg.png (or .jpg) relative to server.js
const DURGA_BG_PATH = path.join(__dirname, 'assets', 'DurgaMAAIMAGE.jpg');
const RECEIPT_LOGO_PATH = path.join(__dirname, 'assets', 'Logo.jpeg');
const GURUS_KITCHEN_LOGO_PATH = path.join(__dirname, 'assets', 'GurusKitchen.png');

let DURGA_BG_DATA_URI = '';
try {
  const imgBuffer = fs.readFileSync(DURGA_BG_PATH);
  const ext = path.extname(DURGA_BG_PATH).slice(1).toLowerCase(); // 'png' or 'jpg'
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
  DURGA_BG_DATA_URI = `data:${mime};base64,${imgBuffer.toString('base64')}`;
  console.log('✅ Durga background image loaded for receipts');
} catch (err) {
  console.warn('⚠️ Durga background image not found — receipts will render without it:', err.message);
}

let RECEIPT_LOGO_DATA_URI = '';
try {
  const logoBuffer = fs.readFileSync(RECEIPT_LOGO_PATH);
  RECEIPT_LOGO_DATA_URI = `data:image/jpeg;base64,${logoBuffer.toString('base64')}`;
  console.log('✅ Receipt logo loaded');
} catch (err) {
  console.warn('⚠️ Receipt logo not found — receipts will render without it:', err.message);
}

let GURUS_KITCHEN_DATA_URI = '';
try {
  const kitchenBuffer = fs.readFileSync(GURUS_KITCHEN_LOGO_PATH);
  GURUS_KITCHEN_DATA_URI = `data:image/png;base64,${kitchenBuffer.toString('base64')}`;
  console.log('✅ Guru\'s Kitchen logo loaded for receipt page 2');
} catch (err) {
  console.warn('⚠️ Guru\'s Kitchen logo not found — page 2 will render without it:', err.message);
}

const { Pool } = pkg;
const app = express();
const port = process.env.PORT || 5000;

// Unique id generated on every server boot. The frontend stores this at login
// and re-validates it on load — so a server restart forces every client to log in again.
const SERVER_SESSION_ID = crypto.randomUUID();

app.use(bodyParser.json());
app.use(cors());


// ✅ SUPABASE CONNECTION (Session Pooler, port 5432)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Supabase Storage (for receipt images)
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const RECEIPTS_BUCKET = process.env.SUPABASE_RECEIPTS_BUCKET || 'receipts';



async function ensureReceiptImageColumn() {
  try {
    await pool.query(`
      ALTER TABLE Receipts
      ADD COLUMN IF NOT EXISTS receipt_image_url TEXT
    `);
    await pool.query(`
      ALTER TABLE Receipts
      ADD COLUMN IF NOT EXISTS receipt_view_url TEXT
    `);
    // Also store the receipt image + viewer URL directly on the transaction row
    await pool.query(`
      ALTER TABLE TransactionalDetails
      ADD COLUMN IF NOT EXISTS receipt_image_url TEXT
    `);
    await pool.query(`
      ALTER TABLE TransactionalDetails
      ADD COLUMN IF NOT EXISTS receipt_view_url TEXT
    `);
    // Snapshot of the signatory names as they were WHEN the receipt was created,
    // so editing the config later never changes older receipts.
    await pool.query(`ALTER TABLE Receipts ADD COLUMN IF NOT EXISTS president TEXT`);
    await pool.query(`ALTER TABLE Receipts ADD COLUMN IF NOT EXISTS secretary1 TEXT`);
    await pool.query(`ALTER TABLE Receipts ADD COLUMN IF NOT EXISTS secretary2 TEXT`);
    await pool.query(`ALTER TABLE Receipts ADD COLUMN IF NOT EXISTS treasurer TEXT`);
    // Optional "Bhog packets" count captured at transaction time
    await pool.query(`ALTER TABLE TransactionalDetails ADD COLUMN IF NOT EXISTS bhog INTEGER`);
    // Mirror bhog + status onto the Receipts row so the receipts list/preview can render them
    await pool.query(`ALTER TABLE Receipts ADD COLUMN IF NOT EXISTS bhog INTEGER`);
    await pool.query(`ALTER TABLE Receipts ADD COLUMN IF NOT EXISTS status TEXT`);
    await pool.query(`ALTER TABLE Receipts ADD COLUMN IF NOT EXISTS reference_receipt_no TEXT`);
    await pool.query(`ALTER TABLE TransactionalDetails ADD COLUMN IF NOT EXISTS reference_receipt_no TEXT`);
    await pool.query(`ALTER TABLE TransactionalDetails ADD COLUMN IF NOT EXISTS transaction_reference TEXT`);
    await pool.query(`ALTER TABLE TransactionalDetails ADD COLUMN IF NOT EXISTS transaction_dated DATE`);
    await pool.query(`ALTER TABLE TransactionalDetails ADD COLUMN IF NOT EXISTS bank_name TEXT`);
    await pool.query(`ALTER TABLE Logincredentials ADD COLUMN IF NOT EXISTS collector_name TEXT`);
    await pool.query(`ALTER TABLE Logincredentials ADD COLUMN IF NOT EXISTS collection_block TEXT`);
    await pool.query(`ALTER TABLE TransactionalDetails ADD COLUMN IF NOT EXISTS collector_email TEXT`);
    // Due entries may be saved without a payment mode
    try {
      await pool.query(`ALTER TABLE TransactionalDetails ALTER COLUMN modeofpayment DROP NOT NULL`);
    } catch (e) { /* already nullable */ }
    try {
      await pool.query(`ALTER TABLE Receipts ALTER COLUMN payment_mode DROP NOT NULL`);
    } catch (e) { /* already nullable */ }
    // One-time copy from older tables if they still have a reference number
    try {
      await pool.query(`
        UPDATE Receipts r
        SET reference_receipt_no = src.reference_receipt_no
        FROM ReceiptMapping src
        WHERE r.receipt_no = src.receipt_no
          AND NULLIF(TRIM(r.reference_receipt_no), '') IS NULL
          AND NULLIF(TRIM(src.reference_receipt_no), '') IS NOT NULL
      `);
    } catch (e) { /* ReceiptMapping may not exist */ }
    try {
      await pool.query(`
        UPDATE TransactionalDetails t
        SET reference_receipt_no = r.reference_receipt_no
        FROM Receipts r
        WHERE t.receipt_no = r.receipt_no
          AND NULLIF(TRIM(t.reference_receipt_no), '') IS NULL
          AND NULLIF(TRIM(r.reference_receipt_no), '') IS NOT NULL
      `);
    } catch (e) { /* optional backfill */ }
  } catch (err) {
    console.error('Could not ensure receipt_image_url column:', err.message);
  }
}

// Normalize a Postgres allowed_blocks value (text[] OR a text literal like
// '{"A","B"}') into a clean JS array, so the client always receives an array.
function normalizeBlocks(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value == null) return [];
  if (typeof value === 'string') {
    const s = value.trim();
    try {
      const j = JSON.parse(s);
      if (Array.isArray(j)) return j.filter(Boolean);
    } catch { /* fall through */ }
    return s
      .replace(/^\{|\}$/g, '')
      .split(',')
      .map(x => x.replace(/["']/g, '').trim())
      .filter(Boolean);
  }
  return [];
}

const SOCIETY_BLOCKS = ['A', 'B', 'C', 'D'];
const OUTSIDE_BLOCK = 'Outside';
const NO_OUTSIDE_FLAG = 'NO_OUTSIDE';

function isOutsideBlock(block) {
  const v = String(block || '').trim();
  return v === OUTSIDE_BLOCK || v.toUpperCase() === 'OUTSIDE';
}

function canonicalizeBlock(block) {
  if (isOutsideBlock(block)) return OUTSIDE_BLOCK;
  return block;
}

function hasSocietyAccess(list) {
  return list.includes('ALLBLOCKS') || list.some((b) => SOCIETY_BLOCKS.includes(b));
}

function withDefaultOutsideAccess(blocks) {
  const list = [...new Set(normalizeBlocks(blocks).map(canonicalizeBlock))];
  if (list.includes(NO_OUTSIDE_FLAG)) {
    return list.filter((b) => b !== NO_OUTSIDE_FLAG && !isOutsideBlock(b));
  }
  if (hasSocietyAccess(list) && !list.some(isOutsideBlock)) {
    return [...list, OUTSIDE_BLOCK];
  }
  return list;
}

function blocksForStorage(blocks) {
  const list = [...new Set(normalizeBlocks(blocks))];
  if (list.includes('ALLBLOCKS')) return ['ALLBLOCKS'];
  const wantsOutside = list.some(isOutsideBlock);
  const cleaned = list.filter((b) => b !== NO_OUTSIDE_FLAG && !isOutsideBlock(b));
  if (wantsOutside) return [...cleaned, OUTSIDE_BLOCK];
  if (hasSocietyAccess(cleaned)) return [...cleaned, NO_OUTSIDE_FLAG];
  return cleaned;
}

function normalizeCollectorEmail(value) {
  const v = String(value || '').trim().toLowerCase();
  return v || null;
}

function blankToNull(value) {
  const s = String(value ?? '').trim();
  return s === '' ? null : s;
}

function normalizeCollectionBlock(value) {
  const v = canonicalizeBlock(String(value || '').trim());
  if (!v || v === 'ALLBLOCKS' || v === NO_OUTSIDE_FLAG) return '';
  return v;
}

const COLLECTION_BLOCK_OPTIONS = [...SOCIETY_BLOCKS, OUTSIDE_BLOCK];

function isAllowedCollectionBlock(block) {
  return COLLECTION_BLOCK_OPTIONS.includes(canonicalizeBlock(block));
}

// Fetch the current signatory config (names shown on receipts).
async function getReceiptConfig(executor = pool) {
  try {
    const result = await executor.query('SELECT * FROM ReceiptConfig ORDER BY id DESC LIMIT 1');
    return result.rows[0] || {};
  } catch (err) {
    console.error('Could not fetch receipt config:', err.message);
    return {};
  }
}

async function ensureReceiptsBucket() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('⚠️ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — receipt image upload disabled.');
    return;
  }

  try {
    await axios.post(
      `${SUPABASE_URL}/storage/v1/bucket`,
      { id: RECEIPTS_BUCKET, name: RECEIPTS_BUCKET, public: true },
      {
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          'Content-Type': 'application/json',
        },
        validateStatus: (s) => s < 500,
      }
    );
  } catch (err) {
    console.warn('Bucket ensure warning:', err.response?.data || err.message);
  }
}

// Create indexes on the hot query paths (joins/filters used by the dashboard & search)
async function ensureIndexes() {
  const statements = [
    `CREATE INDEX IF NOT EXISTS idx_collection_block ON CollectionDetails (block)`,
    `CREATE INDEX IF NOT EXISTS idx_collection_state ON CollectionDetails (state)`,
    `CREATE INDEX IF NOT EXISTS idx_collection_receiptstatus ON CollectionDetails (receiptstatus)`,
    `CREATE INDEX IF NOT EXISTS idx_subscription_subscriberid ON SubscriptionDetails (subscriberid)`,
    `CREATE INDEX IF NOT EXISTS idx_transaction_subscriptionid ON TransactionalDetails (subscriptionid)`,
    `CREATE INDEX IF NOT EXISTS idx_transaction_receiptstatus ON TransactionalDetails (receiptstatus)`,
    `CREATE INDEX IF NOT EXISTS idx_transaction_reference_receipt_no ON TransactionalDetails (reference_receipt_no)`,
    `CREATE INDEX IF NOT EXISTS idx_transaction_collector_email ON TransactionalDetails (collector_email)`,
  ];
  for (const sql of statements) {
    try {
      await pool.query(sql);
    } catch (err) {
      console.warn('Index ensure warning:', err.message);
    }
  }
}


// const pool = new Pool({
//   user: process.env.DB_USER,
//   host: process.env.DB_HOST,
//   database: process.env.DB_NAME,
//   password: process.env.DB_PASSWORD,
//   port: process.env.DB_PORT
// });



// const transporter = nodemailer.createTransport({
//   host: 'smtp.gmail.com',
//   port: 465,
//   secure: true,
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS
//   },
//   tls: {
//     rejectUnauthorized: false   // ✅ FIX
//   }
// });


const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // IMPORTANT
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

transporter.on('error', (err) => {
  console.error('❌ SMTP ERROR:', err.code || '', err.message || err);
});

transporter.verify((error, success) => {
  if (error) {
    console.error('❌ SMTP ERROR:', error);
  } else {
    console.log('✅ SMTP READY');
  }
});

const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN; // Use env var ideally
const WHATSAPP_TEMPLATE_NAME = 'receipt_notification_'; // Update to your approved template name
const WHATSAPP_LANG_CODE = 'en_US'; // Template language


// async function getOrCreateReceiptNo(client, houseno, name) {
//   // 1. Check if mapping exists
//   const existing = await client.query(
//     'SELECT receipt_no FROM ReceiptMapping WHERE houseno = $1 AND name = $2',
//     [houseno, name]
//   );
//   if (existing.rows.length > 0) return existing.rows[0].receipt_no;

//   // 2. Get max current receipt_no, generate next (always at least 100001)
//   const res = await client.query('SELECT MAX(receipt_no) AS max_receipt FROM ReceiptMapping');
//   let nextNum = 100001; // Start at 100001
//   if (res.rows[0].max_receipt) {
//     const currentNum = parseInt(res.rows[0].max_receipt.replace('E-', ''), 10);
//     nextNum = Math.max(currentNum + 1, 100001); // Always at least 100001
//   }
//   if (nextNum > 999999) throw new Error('Receipt number overflow');
//   const nextReceiptNo = `E-${nextNum.toString().padStart(6, '0')}`;  // <-- 6 digits

//   // 3. Insert new mapping
//   await client.query(
//     'INSERT INTO ReceiptMapping (houseno, name, receipt_no) VALUES ($1, $2, $3)',
//     [houseno, name, nextReceiptNo]
//   );
//   return nextReceiptNo;
// }

async function generateReceiptNo(client) {
  const res = await client.query(`SELECT nextval('receipt_seq') as seq`);
  const nextNum = res.rows[0].seq;

  if (nextNum > 999999) {
    throw new Error('Receipt number overflow');
  }

  return `E-${nextNum.toString().padStart(6, '0')}`;
}

function paymentModeForDb(paymentMode) {
  const raw = paymentMode == null ? '' : String(paymentMode).trim();
  return raw;
}

// Peek the next receipt number WITHOUT consuming the sequence (for form preview).
async function peekNextReceiptNo() {
  try {
    const res = await pool.query(`
      SELECT CASE WHEN is_called THEN last_value + 1 ELSE last_value END AS seq
      FROM receipt_seq
    `);
    const nextNum = Number(res.rows[0]?.seq || 1);
    return `E-${nextNum.toString().padStart(6, '0')}`;
  } catch (err) {
    console.warn('Could not peek next receipt number:', err.message);
    return '';
  }
}

app.get('/api/next-receipt-no', async (req, res) => {
  try {
    const receiptNo = await peekNextReceiptNo();
    res.json({ receiptNo });
  } catch (err) {
    res.status(500).json({ error: 'Failed to peek next receipt number' });
  }
});


function buildMailHtml(formData) {
  return `
    <h2>Thank you for your submission!</h2>
    <ul>
      <li><b>House No:</b> ${formData.houseNo || ''}</li>
      <li><b>Name:</b> ${formData.name || ''}</li>
      <li><b>Contact:</b> ${formData.contact || ''}</li>
      <li><b>Email:</b> ${formData.email || ''}</li>
      <li><b>Block:</b> ${formData.block || ''}</li>
      <li><b>Amount Paid Last Year:</b> ${formData.amountPaidLastYear || ''}</li>
      <li><b>Amount Paid:</b> ${formData.amountPaid || ''}</li>
      <li><b>Year Of Payment:</b> ${formData.yearOfPayment || ''}</li>
      <li><b>Payment Mode:</b> ${formData.paymentMode || ''}</li>
      <li><b>UTR Number:</b> ${formData.utrNumber || ''}</li>
      <li><b>Reference Details:</b> ${formData.referenceDetails || ''}</li>
    </ul>
    <p>Thank you,<br/>Team</p>
  `;
}



function buildReceiptHtml(receiptData = {}, config = {}) {
  // For inline PDF rendering, styles must be as close as possible
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt</title>
  <style>
    body {
      background: #fff;
      font-family: 'Georgia', Times, serif;
      color: #0033cc;
      margin: 0; padding: 0;
    }
    .receipt-container {
      border: 2px dashed #0033cc;
      margin: 30px auto;
      padding: 24px 28px 18px 28px;
      max-width: 750px;
      background: #fff;
      font-size: 1.12em;
      position: relative;
    }
    .receipt-header { text-align: center; margin-bottom: 6px; }
    .receipt-title {
      font-size: 2.0em; font-weight: 700; letter-spacing: 1px; margin-bottom: 0.14em; color: #0033cc;
    }
    .receipt-org-main { color: #0033cc; font-weight: 700; font-size: 1.17em; }
    .receipt-org { font-style: italic; color: #0033cc; font-size: 1.1em; }
    .receipt-org-address { font-size: 1em; color: #0033cc; margin-bottom: 8px; }
    .receipt-row-top { display:flex; justify-content:space-between; margin-bottom: 8px; }
    .receipt-label { font-style:italic; margin-bottom:4px; }
    .receipt-bold { font-weight:700; color: #0033cc; }
    .receipt-value { color: #333; font-weight:600; }
    .rupee-box {
      border: 2px solid #0033cc; border-radius: 8px; width: 110px;
      text-align: center; padding: 6px 0; font-size: 1.18em; font-weight: bold;
      margin: 10px 0 6px 0; background: #fff;
    }
    .sign-row { display:flex; justify-content:space-between; align-items:end; margin-top:36px; font-size:1em;}
    .sign-col { text-align:center; }
    .sign-role { font-style:italic; color:#0033cc; }
    /* Optional watermark/stamp */
    .stamp {
      position: absolute;
      left: 44%; top: 21%; width: 130px; opacity: 0.16; z-index:2;
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="receipt-row-top">
      <div><b>No.</b> <span class="receipt-value">${receiptData.receiptNo || ""}</span></div>
      <div><b>Date:</b> <span class="receipt-value">${receiptData.date || ""}</span></div>
    </div>
    ${String(receiptData.status || '').toLowerCase() === 'due' ? `
    <div style="text-align:center; margin:6px 0;">
      <span style="display:inline-block; border:2px solid #ff0000; color:#ff0000; font-weight:700; letter-spacing:2px; padding:2px 14px; border-radius:6px; background:#ffecec;">DUE</span>
    </div>` : ""}
    <div class="receipt-header">
      <div class="receipt-title">Sarbojanin Durgotsab, 2026</div>
      <div class="receipt-org">Organised by :</div>
      <div class="receipt-org-main">SARBOJANIN DURGOTSAB COMMITTEE, LAKE GARDENS</div>
      <div class="receipt-org-main">Lake Gardens People’s Association</div>
      <div class="receipt-org-address">At Bangur Park, B-202 Lake Gardens, Kolkata - 700 045</div>
    </div>
    <hr style="border:none;border-top:1.5px solid #0033cc; margin: 13px 0 9px 0;" />
    <div class="receipt-label">
      Received with thanks from <span class="receipt-value">${receiptData.name || ""}</span>
    </div>
    <div class="receipt-label">
      of <span class="receipt-value">${receiptData.address || ""}</span>
    </div>
    <div class="receipt-label">
      The sum of Rupees <span class="receipt-value">${receiptData.amountWords || ""} only</span>
    </div>
    <div class="receipt-label">
      by <span class="receipt-value">${receiptData.paymentMode || ""}</span>
      ${receiptData.chequeOrDDNo ? ` | Ref/UTR No: <span class="receipt-value">${receiptData.chequeOrDDNo}</span>` : ""}
    </div>
    <div class="receipt-label">
      as subscription/donation for Sri Sri Durga Puja, Laxmi Puja and Kali Puja 2026.
    </div>
    <div class="rupee-box">
      ₹ ${receiptData.amountFigure || ""}
    </div>
    <div style="display:flex; align-items:center; justify-content:space-between; gap:16px; margin-top:12px;">
      <div style="font-weight:700; color:#0033cc; font-size:0.95em;">
        Please collect your "Mahastmi Bhog" from pandal Between 1 pm to 3 pm
      </div>
      <div style="border:2px solid #0033cc; border-radius:4px; width:92px; height:92px; text-align:center; display:flex; flex-direction:column; justify-content:center;">
        <div style="font-size:0.7em; font-weight:700; color:#0033cc;">BHOG PACKETS</div>
        <div style="font-size:1.8em; font-weight:700; color:#222;">${receiptData.bhog ?? 0}</div>
      </div>
    </div>
    <!-- Stamp overlay (optional) -->
    <!-- <img class="stamp" src="file:///absolute/path/to/stamp.png" /> -->
    <div class="sign-row">
      <div class="sign-col">
        <b>${config.president }</b><br>
        <span class="sign-role">President</span>
      </div>
      <div class="sign-col">
       <b>${config.secretary1}</b><br>
<b>${config.secretary2 || 'Ragesri Choudhury'}</b><br>
        <span class="sign-role">Jt. General Secretaries</span>
      </div>
      <div class="sign-col">
        <b>${config.treasurer }</b><br>
        <span class="sign-role">Treasurer</span>
      </div>
    </div>
  </div>
</body>
</html>
`;
}


async function sendWhatsAppMessage(contactNumber, name, amount, receiptNo) {
  if (!contactNumber) {
    console.warn('⚠️ No contact number provided, skipping WhatsApp message.');
    return;
  }
  try {
    const response = await axios.post(
     `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: `91${contactNumber}`,
        type: 'template',
        template: {
          name: WHATSAPP_TEMPLATE_NAME,
          language: {
            code: WHATSAPP_LANG_CODE
          },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: name || '' },
                { type: 'text', text: `₹${amount}` },
                { type: 'text', text: receiptNo || '' }
              ]
            }
          ]
        }
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('✅ WhatsApp message sent:', response.data);
  } catch (error) {
    console.error('❌ WhatsApp message failed:', error.response?.data || error.message);
  }
}


// async function sendFormEmail(formData) {
//   if (!formData.email) return;
//   try {
//     await transporter.sendMail({
//       from: 'sdapp2025@gmail.com', // <-- SAME AS ABOVE
//       to: formData.email,
//       subject: 'Your Submission Confirmation',
//       html: buildMailHtml(formData)
//     });
//   } catch (err) {
//     console.error('Error sending mail:', err);
//   }
// }



// Browser-free receipt attachment: returns an SVG image buffer of the receipt.
async function generateReceiptSvgBuffer(receiptData) {
  const config = await getReceiptConfig();
  const svg = buildReceiptSvg(receiptData, config);
  return Buffer.from(svg, 'utf-8');
}

// Escape text for safe embedding inside SVG/XML
function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function ornateVerticalDivider(x, y1, y2, blue, gold) {
  const mid = (y1 + y2) / 2;
  const diamond = (cy, scale) => {
    const s = 8 * scale;
    return `<polygon points="${x},${cy - s} ${x + s},${cy} ${x},${cy + s} ${x - s},${cy}" fill="none" stroke="${gold}" stroke-width="1.2"/>`;
  };
  return `
    <line x1="${x}" y1="${y1}" x2="${x}" y2="${mid - 30}" stroke="${blue}" stroke-width="1.35"/>
    ${diamond(mid - 16, 1)}
    <circle cx="${x}" cy="${mid}" r="2.2" fill="${gold}"/>
    ${diamond(mid + 16, 1)}
    <line x1="${x}" y1="${mid + 30}" x2="${x}" y2="${y2}" stroke="${blue}" stroke-width="1.35"/>
  `;
}

function kitchenBrandCard({ x, y, w, h, blue, dark, gold, logoUri }) {
  const cx = x + w / 2;
  const logoSize = 120;
  const logoX = cx - logoSize / 2;
  const logoY = y + 24;
  const logoBlock = logoUri ? `
    <rect x="${logoX - 4}" y="${logoY - 4}" width="${logoSize + 8}" height="${logoSize + 8}" rx="12" fill="#fffaf2" stroke="${blue}" stroke-width="1.5"/>
    <rect x="${logoX - 1.5}" y="${logoY - 1.5}" width="${logoSize + 3}" height="${logoSize + 3}" rx="10.5" fill="none" stroke="${gold}" stroke-width="0.85"/>
    <image href="${logoUri}" x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}"
           preserveAspectRatio="xMidYMid slice" clip-path="url(#gkLogoRound)"/>
  ` : '';
  const textY = logoUri ? logoY + logoSize + 34 : y + 72;
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="#ffffff" stroke="${blue}" stroke-width="1.7"/>
    <rect x="${x + 5}" y="${y + 5}" width="${w - 10}" height="${h - 10}" rx="8" fill="none" stroke="${gold}" stroke-width="0.8"/>
    ${logoBlock}
    <text x="${cx}" y="${textY}" font-size="20" fill="${blue}" font-weight="bold" text-anchor="middle">Guru&apos;s Kitchen</text>
    <text x="${cx}" y="${textY + 24}" font-size="13" fill="${dark}" font-style="italic" text-anchor="middle">By Priyanka</text>
    <line x1="${x + 26}" y1="${textY + 38}" x2="${x + w - 26}" y2="${textY + 38}" stroke="${gold}" stroke-width="1"/>
    <text x="${cx}" y="${textY + 64}" font-size="11.5" fill="${dark}" font-weight="bold" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif">197, JODHPUR GARDENS</text>
    <text x="${cx}" y="${textY + 82}" font-size="11.5" fill="${dark}" font-weight="bold" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif">GR. FLOOR, KOLKATA-700 045</text>
    <text x="${cx}" y="${textY + 110}" font-size="12" fill="${blue}" font-weight="bold" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif">Mobile : 90733 93229</text>
  `;
}

function buildKitchenPartnerPage({ width, height, blue, dark, gold }) {
  const leftCx = 168;
  const cardY = 142;
  const cardH = 360;
  const cardW = 214;
  const watermark = DURGA_BG_DATA_URI ? `
    <image href="${DURGA_BG_DATA_URI}" x="16" y="16" width="${width - 32}" height="${height - 32}"
           opacity="0.07" preserveAspectRatio="xMidYMid slice" clip-path="url(#page2CardClip)"/>
  ` : '';
  return `
    <defs>
      <clipPath id="page2CardClip">
        <rect x="16" y="16" width="${width - 32}" height="${height - 32}" rx="8"/>
      </clipPath>
    </defs>
    <rect x="0" y="0" width="${width}" height="${height}" fill="#fffaf2"/>
    <rect x="16" y="16" width="${width - 32}" height="${height - 32}" fill="#fffaf2" stroke="${blue}" stroke-width="2" stroke-dasharray="8 6" rx="8"/>
    <rect x="22" y="22" width="${width - 44}" height="${height - 44}" fill="none" stroke="${gold}" stroke-width="0.85" rx="6"/>
    ${watermark}

    <text x="${width / 2}" y="56" font-size="11" fill="${blue}" font-weight="bold" text-anchor="middle" letter-spacing="3.2">WITH COMPLIMENTS</text>
    <text x="${width / 2}" y="88" font-size="24" fill="${blue}" font-weight="bold" text-anchor="middle">Sarbojanin Durgotsab, 2026</text>
    <line x1="40" y1="106" x2="${width - 40}" y2="106" stroke="${blue}" stroke-width="1.5"/>

    <text x="${leftCx}" y="250" font-size="15.5" fill="${blue}" text-anchor="middle" font-family="Palatino Linotype, Palatino, Book Antiqua, serif">Enjoy the convenience of</text>
    <text x="${leftCx}" y="280" font-size="22" fill="${dark}" font-weight="bold" text-anchor="middle" font-family="Palatino Linotype, Palatino, Book Antiqua, serif" letter-spacing="0.4">homemade food</text>
    <text x="${leftCx}" y="308" font-size="15.5" fill="${blue}" text-anchor="middle" font-family="Palatino Linotype, Palatino, Book Antiqua, serif">without the hassle of cooking!</text>
    <line x1="${leftCx - 48}" y1="326" x2="${leftCx + 48}" y2="326" stroke="${gold}" stroke-width="1"/>
    <text x="${leftCx}" y="354" font-size="13.5" fill="${dark}" text-anchor="middle" font-family="Candara, Calibri, Segoe UI, sans-serif">Our thalis and a la carte options</text>
    <text x="${leftCx}" y="376" font-size="13.5" fill="${dark}" text-anchor="middle" font-family="Candara, Calibri, Segoe UI, sans-serif">are crafted with love and care</text>
    <text x="${leftCx}" y="398" font-size="13.5" fill="${dark}" text-anchor="middle" font-family="Candara, Calibri, Segoe UI, sans-serif">to bring you a truly satisfying</text>
    <text x="${leftCx}" y="420" font-size="13.5" fill="${dark}" text-anchor="middle" font-family="Candara, Calibri, Segoe UI, sans-serif">meal experience.</text>

    ${ornateVerticalDivider(318, 140, 552, blue, gold)}

    ${kitchenBrandCard({ x: 344, y: cardY, w: cardW, h: cardH, blue, dark, gold, logoUri: GURUS_KITCHEN_DATA_URI })}
    ${kitchenBrandCard({ x: 574, y: cardY, w: cardW, h: cardH, blue, dark, gold, logoUri: GURUS_KITCHEN_DATA_URI })}

    <line x1="40" y1="582" x2="${width - 40}" y2="582" stroke="${blue}" stroke-width="1"/>
    <text x="${width / 2}" y="608" font-size="11" fill="${blue}" font-style="italic" text-anchor="middle">Proud hospitality partner of Sarbojanin Durgotsab Committee, Lake Gardens</text>
  `;
}

// Build a self-contained SVG image of the receipt.
// SVG is a real image format that renders in <img> tags and opens in any browser,
// and it needs NO headless browser — so it works identically on local dev and in production.
function buildReceiptSvg(receiptData = {}, config = {}) {
  const width = 820;
  const pageH = 640;
  const pageGap = 28;
  const height = pageH * 2 + pageGap;
  const blue = '#0033cc';
  const dark = '#222222';
  const gold = '#c5a059';

  const refLine = receiptData.chequeOrDDNo
    ? `by ${receiptData.paymentMode || ''}  |  Ref/UTR No: ${receiptData.chequeOrDDNo}`
    : `by ${receiptData.paymentMode || ''}`;

  // Always show the Mahastmi Bhog line + packet-count square under the amount
  const bhogVal = (receiptData.bhog === null || receiptData.bhog === undefined || receiptData.bhog === '')
    ? 0
    : receiptData.bhog;
  const bhogSection = `
  <text x="40" y="468" font-size="14" fill="${blue}" font-weight="bold">Please collect your &quot;Mahastmi Bhog&quot; from pandal Between 1 pm to 3 pm</text>
  <rect x="694" y="433" width="70" height="70" rx="8" fill="#f4f7ff" stroke="${blue}" stroke-width="1.75"/>
  <text x="729" y="420" font-size="10" fill="${blue}" font-weight="bold" text-anchor="middle" letter-spacing="0.5">BHOG PACKETS</text>
  <text x="729" y="486" font-size="26" fill="${dark}" font-weight="bold" text-anchor="middle">${escapeXml(bhogVal)}</text>
  `;

  // "DUE" is baked into the image when the receipt is saved as due
  const isDue = String(receiptData.status || '').toLowerCase() === 'due';
  const dueSection = isDue ? `
  <text x="${width / 2}" y="370" font-size="140" fill="#ff0000" fill-opacity="0.12" font-weight="bold" text-anchor="middle" transform="rotate(-24 ${width / 2} 340)">DUE</text>
  <rect x="${width / 2 - 70}" y="68" width="140" height="38" fill="#ffecec" stroke="#ff0000" stroke-width="2.5" rx="6"/>
  <text x="${width / 2}" y="95" font-size="22" fill="#ff0000" font-weight="bold" text-anchor="middle" letter-spacing="4">DUE</text>
  ` : '';

  const bgImageSection = DURGA_BG_DATA_URI ? `
  <image href="${DURGA_BG_DATA_URI}" x="16" y="16" width="${width - 32}" height="${pageH - 32}"
         opacity="0.10" preserveAspectRatio="xMidYMid slice" clip-path="url(#page1CardClip)"/>
  ` : '';

  const logoSize = 88;
  const logoX = 40;
  const logoY = 74;
  const logoSection = RECEIPT_LOGO_DATA_URI ? `
  <defs>
    <clipPath id="receiptLogoClip">
      <rect x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}" rx="10"/>
    </clipPath>
    <filter id="receiptLogoShadow" x="-18%" y="-18%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1.25" stdDeviation="1.4" flood-color="${blue}" flood-opacity="0.16"/>
    </filter>
  </defs>
  <rect x="${logoX - 4}" y="${logoY - 4}" width="${logoSize + 8}" height="${logoSize + 8}" rx="12" fill="#fffaf2" stroke="${blue}" stroke-width="1.6" filter="url(#receiptLogoShadow)"/>
  <rect x="${logoX - 1.5}" y="${logoY - 1.5}" width="${logoSize + 3}" height="${logoSize + 3}" rx="10.5" fill="none" stroke="#c5a059" stroke-width="0.85"/>
  <image href="${RECEIPT_LOGO_DATA_URI}" x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}"
         preserveAspectRatio="xMidYMid slice" clip-path="url(#receiptLogoClip)"/>
  ` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Georgia, 'Times New Roman', serif">
  <defs>
    <clipPath id="page1CardClip">
      <rect x="16" y="16" width="${width - 32}" height="${pageH - 32}" rx="8"/>
    </clipPath>
    <clipPath id="gkLogoRound" clipPathUnits="objectBoundingBox">
      <rect x="0" y="0" width="1" height="1" rx="0.08" ry="0.08"/>
    </clipPath>
  </defs>
  <rect x="0" y="0" width="${width}" height="${height}" fill="#e8eef8"/>

  <g id="receipt-page-1">
    <rect x="0" y="0" width="${width}" height="${pageH}" fill="#ffffff"/>
    <rect x="16" y="16" width="${width - 32}" height="${pageH - 32}" fill="#ffffff" stroke="${blue}" stroke-width="2" stroke-dasharray="8 6" rx="8"/>
${bgImageSection}
${logoSection}
${dueSection}
    <text x="40" y="60" font-size="18" fill="${blue}" font-weight="bold">No. <tspan fill="${dark}">${escapeXml(receiptData.receiptNo)}</tspan></text>
    <text x="${width - 40}" y="60" font-size="18" fill="${blue}" font-weight="bold" text-anchor="end">Date: <tspan fill="${dark}">${escapeXml(receiptData.date)}</tspan></text>

    <text x="${width / 2}" y="102" font-size="30" fill="${blue}" font-weight="bold" text-anchor="middle">Sarbojanin Durgotsab, 2026</text>
    <text x="${width / 2}" y="128" font-size="16" fill="${dark}" font-style="italic" text-anchor="middle">Organised by :</text>
    <text x="${width / 2}" y="152" font-size="16" fill="${blue}" font-weight="bold" text-anchor="middle">SARBOJANIN DURGOTSAB COMMITTEE, LAKE GARDENS</text>
    <text x="${width / 2}" y="174" font-size="16" fill="${blue}" font-weight="bold" text-anchor="middle">Lake Gardens People's Association</text>
    <text x="${width / 2}" y="196" font-size="14" fill="${blue}" text-anchor="middle">At Bangur Park, B-202 Lake Gardens, Kolkata - 700 045</text>

    <line x1="40" y1="214" x2="${width - 40}" y2="214" stroke="${blue}" stroke-width="1.5"/>

    <text x="40" y="250" font-size="17" fill="${blue}" font-style="italic">Received with thanks from <tspan fill="${dark}" font-weight="bold" font-style="normal">${escapeXml(receiptData.name)}</tspan></text>
    <text x="40" y="282" font-size="17" fill="${blue}" font-style="italic">of <tspan fill="${dark}" font-weight="bold" font-style="normal">${escapeXml(receiptData.address)}</tspan></text>
    <text x="40" y="314" font-size="17" fill="${blue}" font-style="italic">The sum of Rupees <tspan fill="${dark}" font-weight="bold" font-style="normal">${escapeXml(receiptData.amountWords)} only</tspan></text>
    <text x="40" y="346" font-size="17" fill="${blue}">${escapeXml(refLine)}</text>
    <text x="40" y="378" font-size="15" fill="${blue}" font-style="italic">as subscription/donation for Sri Sri Durga Puja, Laxmi Puja and Kali Puja 2026.</text>

    <rect x="40" y="398" width="150" height="46" fill="#ffffff" stroke="${blue}" stroke-width="2" rx="7"/>
    <text x="115" y="429" font-size="22" fill="${dark}" font-weight="bold" text-anchor="middle">&#8377; ${escapeXml(receiptData.amountFigure)}</text>
${bhogSection}
    <text x="130" y="560" font-size="15" fill="${dark}" font-weight="bold" text-anchor="middle">${escapeXml(config.president )}</text>
    <text x="130" y="580" font-size="13" fill="${blue}" font-style="italic" text-anchor="middle">President</text>

    <text x="${width / 2}" y="548" font-size="15" fill="${dark}" font-weight="bold" text-anchor="middle">${escapeXml(config.secretary1 )}</text>
    <text x="${width / 2}" y="568" font-size="15" fill="${dark}" font-weight="bold" text-anchor="middle">${escapeXml(config.secretary2 )}</text>
    <text x="${width / 2}" y="588" font-size="13" fill="${blue}" font-style="italic" text-anchor="middle">Jt. General Secretaries</text>

    <text x="${width - 130}" y="560" font-size="15" fill="${dark}" font-weight="bold" text-anchor="middle">${escapeXml(config.treasurer)}</text>
    <text x="${width - 130}" y="580" font-size="13" fill="${blue}" font-style="italic" text-anchor="middle">Treasurer</text>
  </g>

  <g id="receipt-page-2" transform="translate(0, ${pageH + pageGap})">
    ${buildKitchenPartnerPage({ width, height: pageH, blue, dark, gold })}
  </g>
</svg>`;
}

// Turn arbitrary text into a URL-safe slug (used to build readable file names)
function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

// A readable object base name like "ramesh-kumar-a-101-e-100054"
function buildReceiptSlug(receiptData = {}) {
  const parts = [
    slugify(receiptData.name),
    slugify(receiptData.houseNo || receiptData.address),
    slugify(receiptData.receiptNo),
  ].filter(Boolean);
  return parts.join('-') || slugify(receiptData.receiptNo) || 'receipt';
}

// Generic upload helper → returns the public URL of the stored object
async function uploadObjectToSupabase(objectPath, buffer, contentType) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('⚠️ Supabase not configured — skipping upload.');
    return null;
  }

  await axios.post(
    `${SUPABASE_URL}/storage/v1/object/${RECEIPTS_BUCKET}/${objectPath}`,
    buffer,
    {
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': contentType,
        'x-upsert': 'true',
      },
      maxBodyLength: Infinity,
    }
  );

  return `${SUPABASE_URL}/storage/v1/object/public/${RECEIPTS_BUCKET}/${objectPath}`;
}

// Generates the receipt image (SVG) + a viewer page (HTML), uploads both,
// and returns { imageUrl, viewUrl }. imageUrl is the raw image; viewUrl is the
// human-friendly page (name + house no in the link) sent to the customer.
async function saveReceiptImage(receiptData, config = {}) {
  // Always build the SVG so the client can auto-download even if Supabase is down/unconfigured.
  const svg = buildReceiptSvg(receiptData, config);
  try {
    const base = buildReceiptSlug(receiptData);

    const imageUrl = await uploadObjectToSupabase(`${base}.svg`, Buffer.from(svg, 'utf-8'), 'image/svg+xml');
    if (!imageUrl) return { imageUrl: null, viewUrl: null, svg };

    // The customer link is the SVG itself (openable/downloadable on any device).
    // viewUrl mirrors the SVG so any client (even a cached one) always gets .svg.
    console.log('✅ Receipt uploaded — image:', imageUrl);
    return { imageUrl, viewUrl: imageUrl, svg };
  } catch (err) {
    console.error('❌ Receipt image upload failed:', err.response?.data || err.message);
    return { imageUrl: null, viewUrl: null, svg };
  }
}

// Convert a number to words (Indian system). Returns UPPERCASE for the receipt line
// e.g. 12 → "TWELVE", 1250 → "ONE THOUSAND TWO HUNDRED FIFTY".
function amountToWords(num) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

  function toWords(n) {
    n = Math.floor(Number(n));
    if (!n || Number.isNaN(n)) return '';
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + toWords(n % 100) : '');
    if (n < 100000) return toWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + toWords(n % 1000) : '');
    if (n < 10000000) return toWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + toWords(n % 100000) : '');
    return toWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + toWords(n % 10000000) : '');
  }

  return toWords(num).toUpperCase();
}

// Resolve amount-in-words for a receipt. If a caller already passed real words, keep
// them (uppercased); if they passed a bare number (or empty), convert from amountFigure.
function resolveAmountWords(receiptData = {}) {
  const raw = receiptData.amountWords;
  const figure = receiptData.amountFigure;
  if (raw != null && String(raw).trim() !== '' && /[a-zA-Z]/.test(String(raw))) {
    return String(raw).toUpperCase();
  }
  const n = (raw != null && String(raw).trim() !== '' && !Number.isNaN(Number(raw)))
    ? Number(raw)
    : Number(figure);
  return amountToWords(n) || String(figure ?? '');
}

// Backfill receipt images for existing rows that don't have a URL yet.
// Call once (e.g. open http://localhost:5000/api/backfill-receipt-images in a browser).
app.get('/api/backfill-receipt-images', async (req, res) => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(400).json({ error: 'Supabase Storage is not configured (missing SUPABASE_SERVICE_ROLE_KEY).' });
  }

  try {
    const config = await getReceiptConfig();

    const { rows } = await pool.query(
      `SELECT receipt_no, houseno, name, amount, payment_mode, created_at
       FROM Receipts
       WHERE receipt_image_url IS NULL
       ORDER BY created_at ASC NULLS LAST
       LIMIT 500`
    );

    let updated = 0;
    const failures = [];

    for (const r of rows) {
      const receiptData = {
        receiptNo: r.receipt_no,
        date: r.created_at ? new Date(r.created_at).toLocaleDateString('en-GB') : '',
        name: r.name || '',
        houseNo: r.houseno || '',
        address: r.houseno || '',
        amountFigure: r.amount || '',
        amountWords: amountToWords(r.amount),
        paymentMode: r.payment_mode || '',
        chequeOrDDNo: '',
      };

      const { imageUrl, viewUrl } = await saveReceiptImage(receiptData, config);
      if (imageUrl) {
        await pool.query(`UPDATE Receipts SET receipt_image_url = $1, receipt_view_url = $2 WHERE receipt_no = $3`, [imageUrl, viewUrl, r.receipt_no]);
        await pool.query(`UPDATE TransactionalDetails SET receipt_image_url = $1, receipt_view_url = $2 WHERE receipt_no = $3`, [imageUrl, viewUrl, r.receipt_no]);
        updated++;
      } else {
        failures.push(r.receipt_no);
      }
    }

    res.json({ message: 'Backfill complete', totalFound: rows.length, updated, failures });
  } catch (err) {
    console.error('Backfill failed:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/send-receipt', async (req, res) => {
  const { email, formData, receiptData } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'No email provided.' });
  }

  try {
    const svgBuffer = await generateReceiptSvgBuffer(receiptData);

    // ✅ SEND EMAIL (SVG attachment — no headless browser needed)
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your Submission and Receipt - Sarbojanin Durgotsab 2026',
      html: `<h3>Thank you for your contribution!</h3><p>Your receipt (No. ${receiptData?.receiptNo || ''}) is attached to this email.</p>`,
      attachments: [
        {
          filename: `Receipt-${receiptData?.receiptNo || 'copy'}.svg`,
          content: svgBuffer,
          contentType: 'image/svg+xml'
        }
      ]
    });

    res.json({ message: 'Receipt sent successfully!' });

  } catch (err) {
    console.error('❌ Email send failed:', err);
    res.status(500).json({ error: 'Sending failed.' });
  }
});


app.post('/api/update-receipt-config', async (req, res) => {
  const { president, secretary1, secretary2, treasurer } = req.body;

  try {
    // Upsert the SAME row every read uses (highest id). This avoids the old
    // bug where `WHERE id = 1` updated 0 rows when the config row's id wasn't 1.
    const existing = await pool.query('SELECT id FROM ReceiptConfig ORDER BY id DESC LIMIT 1');

    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE ReceiptConfig
         SET president = $1, secretary1 = $2, secretary2 = $3, treasurer = $4
         WHERE id = $5`,
        [president, secretary1, secretary2, treasurer, existing.rows[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO ReceiptConfig (president, secretary1, secretary2, treasurer)
         VALUES ($1, $2, $3, $4)`,
        [president, secretary1, secretary2, treasurer]
      );
    }

    res.json({ success: true });

  } catch (err) {
    console.error("Error updating config:", err);
    res.status(500).json({ error: 'Failed to update config' });
  }
});


app.get('/api/receipt-config', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM ReceiptConfig ORDER BY id DESC LIMIT 1'
    );

    if (result.rows.length === 0) {
      return res.json({
        president: '',
        secretary1: '',
        secretary2: '',
        treasurer: ''
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching receipt config:', err);
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

app.get('/api/financial-summary/:houseNo', async (req, res) => {
  const { houseNo } = req.params;

  try {
    const result = await pool.query(`
      SELECT 
        COALESCE(SUM(t.subscriptionamount), 0) AS total_amount,
        STRING_AGG(t.receipt_no, ', ' ORDER BY t.createdat DESC) AS receipts
      FROM CollectionDetails c
      JOIN SubscriptionDetails s ON c.subscriber_id = s.subscriberid
      JOIN TransactionalDetails t ON s.subscriptionid = t.subscriptionid
      WHERE c.houseno = $1
      AND DATE_PART('year', t.createdat) = DATE_PART('year', CURRENT_DATE)
    `, [houseNo]);

    res.json({
      totalAmount: result.rows[0].total_amount || 0,
      receipts: result.rows[0].receipts || ''
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});
// server.js
app.post('/api/data', async (req, res) => {
  const { allowedBlocks } = req.body;
  try {
    const values = [];

    let query = `
      SELECT 
        c.houseno,
        c.name,
        c.contact,
        c.email,
        c.block,
        c.amountpaidlastyear,
        c.receiptstatus,
        c.previousyearreceiptnumber,
        STRING_AGG(t.receipt_no, ', ' ORDER BY t.createdat DESC) AS receipt_no
      FROM CollectionDetails c
      LEFT JOIN SubscriptionDetails s 
        ON c.subscriber_id = s.subscriberid
      LEFT JOIN TransactionalDetails t 
        ON s.subscriptionid = t.subscriptionid
      WHERE c.state = 'active'
    `;

    if (!allowedBlocks.includes('ALLBLOCKS')) {
      query += ` AND c.block = ANY($1)`;
      values.push(allowedBlocks);
    }

    query += `
      GROUP BY 
        c.houseno, c.name, c.contact, c.email, c.block,
        c.amountpaidlastyear, c.receiptstatus, c.previousyearreceiptnumber
    `;

    const result = await pool.query(query, values);
    res.json(result.rows);

  } catch (err) {
    console.error('Error fetching data:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});



// Get Financial Year
app.get('/api/get-financial-year', (req, res) => {
  const today = new Date();
  const fyYear = (today.getMonth() + 1 >= 4) ? today.getFullYear() : today.getFullYear() - 1;
  res.json({ yearOfPayment: fyYear });
});


// Save Transaction for existing user
// Save Transaction for existing user
app.post('/api/save-transaction', async (req, res) => {
  const { houseNo, name, contact, block, email, amountPaid, yearOfPayment, paymentMode, utrNumber, referenceDetails, receiptStatus, bhog, referenceReceiptNumber, transactionReference, transactionDated, bankName, collectorEmail } = req.body;
  const bhogCount = (bhog === '' || bhog === null || bhog === undefined) ? 1 : parseInt(bhog, 10);
  const mode = paymentModeForDb(paymentMode);
  const txnRef = (transactionReference || utrNumber || '').trim() || null;
  const txnDated = transactionDated || null;
  const bank = (bankName || '').trim() || null;
  const collectedBy = normalizeCollectorEmail(collectorEmail);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let subRes = await client.query(
      `SELECT subscriber_id FROM CollectionDetails WHERE houseno = $1 AND name = $2 AND state = 'active'`,
      [houseNo, name]
    );
    let subscriberId;
    if (subRes.rows.length === 0) {
      const insertRes = await client.query(
        `INSERT INTO CollectionDetails (houseno, name, contact, email, block, state, amountpaidlastyear, receiptstatus)
         VALUES ($1, $2, $3, $4, $5, 'active', 0, $6) RETURNING subscriber_id`,
        [houseNo, name, contact, email || null, block, receiptStatus || 'due']
      );
      subscriberId = insertRes.rows[0].subscriber_id;
    } else {
      subscriberId = subRes.rows[0].subscriber_id;
      await client.query(
        `UPDATE CollectionDetails SET contact = $1, email = $2, block = $3, receiptstatus = $4 WHERE subscriber_id = $5`,
        [contact, email || null, block, receiptStatus || 'due', subscriberId]
      );
    }
    let subscriptionRes = await client.query(
      'SELECT subscriptionid FROM SubscriptionDetails WHERE subscriberid = $1 AND yearofsubscription = $2',
      [subscriberId, yearOfPayment]
    );
    let subscriptionId;
    if (subscriptionRes.rows.length > 0) {
      subscriptionId = subscriptionRes.rows[0].subscriptionid;
    } else {
      const newSub = await client.query(
        `INSERT INTO SubscriptionDetails (subscriberid, yearofsubscription, subscriptiontotalamount, createdat)
         VALUES ($1, $2, 0, CURRENT_TIMESTAMP) RETURNING subscriptionid`,
        [subscriberId, yearOfPayment]
      );
      subscriptionId = newSub.rows[0].subscriptionid;
    }

    // ----- GET OR CREATE RECEIPT NUMBER -----
    const receiptNo = await generateReceiptNo(client);
    console.log("NEW RECEIPT GENERATED:", receiptNo);

    await client.query(
      `INSERT INTO TransactionalDetails (subscriptionid, yearofpayment, subscriptionamount, modeofpayment, utrnumber, referencenumber, receiptstatus, receipt_no, bhog, reference_receipt_no, transaction_reference, transaction_dated, bank_name, collector_email, createdat)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)`,
      [subscriptionId, amountPaid, mode, txnRef || utrNumber, referenceDetails, receiptStatus || 'due', receiptNo, bhogCount, referenceReceiptNumber || null, txnRef, txnDated, bank, collectedBy]
    );
    // 🔥 ALWAYS SAVE RECEIPT (CRITICAL FIX)
const receiptPayload = {
  receiptNo,
  date: new Date().toLocaleDateString('en-GB'),
  name,
  houseNo,
  address: `${houseNo}${block ? ', Block ' + block : ''}`,
  amountFigure: amountPaid,
  amountWords: amountToWords(amountPaid),
  paymentMode: mode,
  bhog: bhogCount,
  status: receiptStatus || 'due',
  chequeOrDDNo: utrNumber || referenceDetails || ''
};
// Snapshot the current signatory names so this receipt keeps them forever
const receiptConfig = await getReceiptConfig(client);
const receiptHtml = buildReceiptHtml(receiptPayload, receiptConfig);

await client.query(
  `INSERT INTO Receipts 
   (receipt_no, houseno, name, email, amount, year_of_payment, payment_mode, receipt_html, president, secretary1, secretary2, treasurer, bhog, status, reference_receipt_no, created_at)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW())`,
  [
    receiptNo,
    houseNo,
    name,
    email || null,
    amountPaid,
    yearOfPayment,
    mode,
    receiptHtml,
    receiptConfig.president || null,
    receiptConfig.secretary1 || null,
    receiptConfig.secretary2 || null,
    receiptConfig.treasurer || null,
    bhogCount,
    receiptStatus || 'due',
    referenceReceiptNumber || null
  ]
);
    await client.query(
      `UPDATE SubscriptionDetails
       SET subscriptiontotalamount = (
          SELECT COALESCE(SUM(subscriptionamount),0)
          FROM TransactionalDetails
          WHERE subscriptionid = $1 AND (receiptstatus = 'collected' OR receiptstatus = 'completed')
        )
       WHERE subscriptionid = $1`,
      [subscriptionId]
    );

    await client.query('COMMIT');

    // Upload receipt image + viewer page to Supabase AFTER commit (does not block DB transaction)
    const { imageUrl: receiptImageUrl, viewUrl: receiptViewUrl, svg: receiptSvg } = await saveReceiptImage(receiptPayload, receiptConfig);
    if (receiptImageUrl) {
      try {
        await pool.query(
          `UPDATE Receipts SET receipt_image_url = $1, receipt_view_url = $2 WHERE receipt_no = $3`,
          [receiptImageUrl, receiptViewUrl, receiptNo]
        );
        await pool.query(
          `UPDATE TransactionalDetails SET receipt_image_url = $1, receipt_view_url = $2 WHERE receipt_no = $3`,
          [receiptImageUrl, receiptViewUrl, receiptNo]
        );
      } catch (imgErr) {
        console.error('Failed to save receipt image URLs:', imgErr.message);
      }
    }

    // 📲 WhatsApp is handled on the frontend via a redirect with the receipt link.
    // (Backend Graph API call disabled to avoid OAuth errors / duplicate messages.)
    // sendWhatsAppMessage(contact, name, amountPaid, receiptNo);

    res.json({ message: 'Transaction saved successfully', receiptNo, receiptImageUrl, receiptViewUrl, receiptSvg });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error saving transaction:', err);
    res.status(500).json({ error: err.message || 'Transaction failed' });
  } finally {
    client.release();
  }
});




// Create new house + transaction
app.post('/api/create-new-house', async (req, res) => {
  const { houseNo, name, contact, email, block, amountPaid, amountPaidLastYear, yearOfPayment, paymentMode, utrNumber, referenceDetails, receiptStatus, previousYearReceiptNumber, bhog, referenceReceiptNumber, transactionReference, transactionDated, bankName, collectorEmail } = req.body;
  const bhogCount = (bhog === '' || bhog === null || bhog === undefined) ? 1 : parseInt(bhog, 10);
  const mode = paymentModeForDb(paymentMode);
  const txnRef = (transactionReference || utrNumber || '').trim() || null;
  const txnDated = transactionDated || null;
  const bank = (bankName || '').trim() || null;
  const collectedBy = normalizeCollectorEmail(collectorEmail);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const colRes = await client.query(
      `INSERT INTO CollectionDetails (houseno, name, contact, email, block, state, amountpaidlastyear, receiptstatus, previousyearreceiptnumber)
       VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, $8)
       RETURNING subscriber_id`,
      [houseNo, name, contact, email, block, amountPaidLastYear || 0, receiptStatus || 'due', previousYearReceiptNumber || '']
    );
    const subscriberId = colRes.rows[0].subscriber_id;
    let subRes = await client.query(
      'SELECT subscriptionid FROM SubscriptionDetails WHERE subscriberid = $1 AND yearofsubscription = $2',
      [subscriberId, yearOfPayment]
    );
    let subscriptionId;
    if (subRes.rows.length > 0) {
      subscriptionId = subRes.rows[0].subscriptionid;
    } else {
      const newSub = await client.query(
        'INSERT INTO SubscriptionDetails (subscriberid, yearofsubscription, subscriptiontotalamount, createdat) VALUES ($1, $2, 0, CURRENT_TIMESTAMP) RETURNING subscriptionid',
        [subscriberId, yearOfPayment]
      );
      subscriptionId = newSub.rows[0].subscriptionid;
    }

    // ----- GET OR CREATE RECEIPT NUMBER -----
    const receiptNo = await generateReceiptNo(client);

    await client.query(
      `INSERT INTO TransactionalDetails (subscriptionid, yearofpayment, subscriptionamount, modeofpayment, utrnumber, referencenumber, receiptstatus, receipt_no, bhog, reference_receipt_no, transaction_reference, transaction_dated, bank_name, collector_email, createdat)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)`,
      [subscriptionId, amountPaid, mode, txnRef || utrNumber, referenceDetails, receiptStatus || 'due', receiptNo, bhogCount, referenceReceiptNumber || null, txnRef, txnDated, bank, collectedBy]
    );

    // 🔥 ALWAYS SAVE RECEIPT
const receiptPayload = {
  receiptNo,
  date: new Date().toLocaleDateString('en-GB'),
  name,
  houseNo,
  address: `${houseNo}${block ? ', Block ' + block : ''}`,
  amountFigure: amountPaid,
  amountWords: amountToWords(amountPaid),
  paymentMode: mode,
  bhog: bhogCount,
  status: receiptStatus || 'due',
  chequeOrDDNo: utrNumber || referenceDetails || ''
};
// Snapshot the current signatory names so this receipt keeps them forever
const receiptConfig = await getReceiptConfig(client);
const receiptHtml = buildReceiptHtml(receiptPayload, receiptConfig);

await client.query(
  `INSERT INTO Receipts 
   (receipt_no, houseno, name, email, amount, year_of_payment, payment_mode, receipt_html, president, secretary1, secretary2, treasurer, bhog, status, reference_receipt_no, created_at)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW())`,
  [
    receiptNo,
    houseNo,
    name,
    email || null,
    amountPaid,
    yearOfPayment,
    mode,
    receiptHtml,
    receiptConfig.president || null,
    receiptConfig.secretary1 || null,
    receiptConfig.secretary2 || null,
    receiptConfig.treasurer || null,
    bhogCount,
    receiptStatus || 'due',
    referenceReceiptNumber || null
  ]
);

    await client.query(
      `UPDATE SubscriptionDetails
       SET subscriptiontotalamount = (
          SELECT COALESCE(SUM(subscriptionamount),0)
          FROM TransactionalDetails
          WHERE subscriptionid = $1 AND (receiptstatus = 'collected' OR receiptstatus = 'completed')
        )
       WHERE subscriptionid = $1`,
      [subscriptionId]
    );
    await client.query('COMMIT');

    // Upload receipt image + viewer page to Supabase AFTER commit
    const { imageUrl: receiptImageUrl, viewUrl: receiptViewUrl, svg: receiptSvg } = await saveReceiptImage(receiptPayload, receiptConfig);
    if (receiptImageUrl) {
      try {
        await pool.query(
          `UPDATE Receipts SET receipt_image_url = $1, receipt_view_url = $2 WHERE receipt_no = $3`,
          [receiptImageUrl, receiptViewUrl, receiptNo]
        );
        await pool.query(
          `UPDATE TransactionalDetails SET receipt_image_url = $1, receipt_view_url = $2 WHERE receipt_no = $3`,
          [receiptImageUrl, receiptViewUrl, receiptNo]
        );
      } catch (imgErr) {
        console.error('Failed to save receipt image URLs:', imgErr.message);
      }
    }

    // 📲 WhatsApp is handled on the frontend via a redirect with the receipt link.
    // (Backend Graph API call disabled to avoid OAuth errors / duplicate messages.)
    // sendWhatsAppMessage(contact, name, amountPaid, receiptNo);

    res.json({ message: 'New house, subscription, and transaction saved!', receiptNo, receiptImageUrl, receiptViewUrl, receiptSvg });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating new house:', err);
    res.status(500).json({ error: err.message || 'Operation failed' });
  } finally {
    client.release();
  }
});

//


// Update customer state
app.post('/api/update-customer-state', async (req, res) => {
  const { houseNo } = req.body;
  const state = req.body.state ?? req.body.newState;
  try {
    await pool.query(`UPDATE CollectionDetails SET state = $1 WHERE houseno = $2`, [state, houseNo]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating state:', err);
    res.status(500).json({ success: false });
  }
});

// Get active subscribers
app.get('/api/subscribers', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT subscriber_id, houseno, name FROM CollectionDetails WHERE state = 'active'
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching subscribers:', err);
    res.status(500).json({ error: 'Failed to fetch subscribers' });
  }
});

// Combined data endpoint
app.post('/api/all-data', async (req, res) => {
  const { allowedBlocks, receiptStatus } = req.body;
  try {
    let query = `
      SELECT 
        c.houseno,
        c.name,
        c.contact,
        c.email,
        c.amountpaidlastyear,
        c.block,
        s.yearofsubscription,
        s.subscriptiontotalamount,
        t.yearofpayment,
        t.createdat AS transaction_timestamp,
        t.subscriptionamount,
        t.modeofpayment,
        t.utrnumber,
        t.referencenumber,
        t.receiptstatus,
        t.receipt_no,
        t.reference_receipt_no
      FROM CollectionDetails c
      JOIN SubscriptionDetails s ON c.subscriber_id = s.subscriberid
      JOIN TransactionalDetails t ON s.subscriptionid = t.subscriptionid
      WHERE c.state = 'active'
    `;
    const values = [];
    if (allowedBlocks && Array.isArray(allowedBlocks) && !allowedBlocks.includes('ALLBLOCKS')) {
      query += ` AND c.block = ANY($${values.length + 1})`;
      values.push(allowedBlocks);
    }
    // Status filtering:
    //  - 'collected' → include collected AND completed (completed = collected & finalized)
    //  - 'due'       → only due
    //  - 'all'/empty → no status filter (return everything)
    const rs = (receiptStatus || '').toLowerCase();
    if (rs === 'collected') {
      query += ` AND t.receiptstatus IN ('collected', 'completed')`;
    } else if (rs === 'due') {
      query += ` AND t.receiptstatus = 'due'`;
    }
    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching combined data:', err);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// House-level search: includes houses WITH and WITHOUT transactions.
// Same house + same name:
//   - collected/completed receipts → one row with the cumulative collected amount
//   - due receipts → a separate row whose amount is ONLY the due receipt(s)
// Different names at the same house stay as separate rows.
app.post('/api/search-houses', async (req, res) => {
  const { allowedBlocks } = req.body;
  const blocks = normalizeBlocks(allowedBlocks);
  const values = [];
  let blockSql = '';
  if (blocks.length > 0 && !blocks.includes('ALLBLOCKS')) {
    blockSql = ` AND c.block = ANY($1)`;
    values.push(blocks);
  }
  try {
    const query = `
      SELECT
        c.houseno,
        c.name,
        c.contact,
        c.email,
        c.block,
        c.amountpaidlastyear,
        c.receiptstatus AS collection_receiptstatus,
        FALSE AS has_transaction,
        0::numeric AS total_amount,
        NULL AS yearofpayment,
        NULL AS yearofsubscription,
        NULL::text AS receiptstatus,
        NULL::text AS reference_receipt_no,
        NULL::text AS modeofpayment,
        NULL::text AS transaction_reference,
        NULL::text AS bank_name,
        NULL::date AS transaction_dated
      FROM CollectionDetails c
      WHERE c.state = 'active'
        AND NOT EXISTS (
          SELECT 1
          FROM SubscriptionDetails s
          JOIN TransactionalDetails t ON t.subscriptionid = s.subscriptionid
          WHERE s.subscriberid = c.subscriber_id
        )
        ${blockSql}

      UNION ALL

      SELECT
        c.houseno,
        c.name,
        c.contact,
        c.email,
        c.block,
        c.amountpaidlastyear,
        c.receiptstatus AS collection_receiptstatus,
        TRUE AS has_transaction,
        t.subscriptionamount AS total_amount,
        t.yearofpayment,
        s.yearofsubscription,
        t.receiptstatus,
        t.reference_receipt_no,
        t.modeofpayment,
        COALESCE(
          NULLIF(TRIM(t.transaction_reference), ''),
          NULLIF(TRIM(t.utrnumber), ''),
          NULLIF(TRIM(t.referencenumber), '')
        ) AS transaction_reference,
        t.bank_name,
        t.transaction_dated
      FROM CollectionDetails c
      JOIN SubscriptionDetails s ON c.subscriber_id = s.subscriberid
      JOIN TransactionalDetails t ON s.subscriptionid = t.subscriptionid
      WHERE c.state = 'active'
        AND LOWER(COALESCE(t.receiptstatus, '')) IN ('collected', 'completed')
        ${blockSql}

      UNION ALL

      SELECT
        c.houseno,
        c.name,
        c.contact,
        c.email,
        c.block,
        c.amountpaidlastyear,
        c.receiptstatus AS collection_receiptstatus,
        TRUE AS has_transaction,
        t.subscriptionamount AS total_amount,
        t.yearofpayment,
        s.yearofsubscription,
        t.receiptstatus,
        t.reference_receipt_no,
        t.modeofpayment,
        COALESCE(
          NULLIF(TRIM(t.transaction_reference), ''),
          NULLIF(TRIM(t.utrnumber), ''),
          NULLIF(TRIM(t.referencenumber), '')
        ) AS transaction_reference,
        t.bank_name,
        t.transaction_dated
      FROM CollectionDetails c
      JOIN SubscriptionDetails s ON c.subscriber_id = s.subscriberid
      JOIN TransactionalDetails t ON s.subscriptionid = t.subscriptionid
      WHERE c.state = 'active'
        AND LOWER(COALESCE(t.receiptstatus, '')) = 'due'
        ${blockSql}

      ORDER BY block, houseno, name, receiptstatus
    `;
    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching search houses:', err);
    res.status(500).json({ error: 'Failed to fetch search data' });
  }
});




// Returns the current server-boot session id. Used by the client to detect
// a server restart (id changes) and force a fresh login.
app.get('/api/auth/session', (req, res) => {
  res.json({ sessionId: SERVER_SESSION_ID });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query(
      'SELECT * FROM Logincredentials WHERE email = $1 AND password = $2',
      [email, password]
    );

    if (result.rows.length > 0) {
      const user = result.rows[0];
      res.json({
        success: true,
        allowedBlocks: withDefaultOutsideAccess(user.allowed_blocks),
        collectorName: user.collector_name || '',
        collectionBlock: user.collection_block || '',
        sessionId: SERVER_SESSION_ID,
      });
    } else {
      res.json({ success: false });
    }
  } catch (err) {
    console.error('Error validating login:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


app.post('/api/add-user', async (req, res) => {
  const { email, password, blocks, name, collectionBlock } = req.body;
  const collectorName = String(name || '').trim();
  const homeBlock = normalizeCollectionBlock(collectionBlock);
  try {
    if (!email || !password) {
      return res.json({ success: false, message: 'Email and password are required' });
    }
    if (!collectorName) {
      return res.json({ success: false, message: 'Name is required' });
    }
    if (!homeBlock || !isAllowedCollectionBlock(homeBlock)) {
      return res.json({ success: false, message: 'Please select Collection for the block' });
    }

    const checkResult = await pool.query(
      'SELECT * FROM Logincredentials WHERE email = $1',
      [email]
    );

    if (checkResult.rows.length > 0) {
      return res.json({ success: false, message: 'User already exists' });
    }

    await pool.query(
      `INSERT INTO Logincredentials (email, password, allowed_blocks, collector_name, collection_block)
       VALUES ($1, $2, $3, $4, $5)`,
      [email, password, blocksForStorage(blocks), collectorName, homeBlock]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error adding user:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


// Fetch a user's currently-assigned blocks (used to pre-check the Update User form)
app.get('/api/user-blocks', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  try {
    const result = await pool.query(
      'SELECT allowed_blocks, collector_name, collection_block FROM Logincredentials WHERE email = $1',
      [email]
    );
    if (result.rows.length === 0) {
      return res.json({ found: false, blocks: [], name: '', collectionBlock: '' });
    }
    const row = result.rows[0];
    res.json({
      found: true,
      blocks: withDefaultOutsideAccess(row.allowed_blocks),
      name: row.collector_name || '',
      collectionBlock: row.collection_block || '',
    });
  } catch (err) {
    console.error('Error fetching user blocks:', err);
    res.status(500).json({ error: 'Failed to fetch user blocks' });
  }
});

// Update user credentials
app.post('/api/update-user', async (req, res) => {
  const { email, password, blocks, name, collectionBlock } = req.body;
  const collectorName = String(name || '').trim();
  const homeBlock = normalizeCollectionBlock(collectionBlock);

  try {
    if (!email || !password) {
      return res.json({ success: false, message: 'Email and password are required' });
    }
    if (!collectorName) {
      return res.json({ success: false, message: 'Name is required' });
    }
    if (!homeBlock || !isAllowedCollectionBlock(homeBlock)) {
      return res.json({ success: false, message: 'Please select Collection for the block' });
    }

    const result = await pool.query(
      `UPDATE Logincredentials
       SET password = $1, allowed_blocks = $2, collector_name = $3, collection_block = $4
       WHERE email = $5`,
      [password, blocksForStorage(blocks), collectorName, homeBlock, email]
    );
    if (result.rowCount === 0) {
      return res.json({ success: false, message: 'User not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/individual-collections', async (req, res) => {
  try {
    const usersRes = await pool.query(
      `SELECT email, collector_name, collection_block, allowed_blocks
       FROM Logincredentials
       ORDER BY LOWER(COALESCE(NULLIF(TRIM(collector_name), ''), email))`
    );
    const totalsRes = await pool.query(
      `SELECT
         LOWER(TRIM(t.collector_email)) AS email,
         COALESCE(NULLIF(TRIM(c.block), ''), 'Unassigned') AS block,
         COALESCE(SUM(t.subscriptionamount), 0) AS amount,
         COUNT(*) AS txn_count
       FROM TransactionalDetails t
       JOIN SubscriptionDetails s ON s.subscriptionid = t.subscriptionid
       JOIN CollectionDetails c ON c.subscriber_id = s.subscriberid
       WHERE t.collector_email IS NOT NULL AND TRIM(t.collector_email) <> ''
         AND LOWER(COALESCE(t.receiptstatus, '')) IN ('collected', 'completed')
       GROUP BY 1, 2`
    );

    const byEmail = {};
    for (const row of totalsRes.rows) {
      const email = row.email;
      if (!byEmail[email]) byEmail[email] = { byBlock: [], total: 0, txnCount: 0 };
      const amount = Number(row.amount) || 0;
      const count = Number(row.txn_count) || 0;
      byEmail[email].byBlock.push({ block: row.block, amount, count });
      byEmail[email].total += amount;
      byEmail[email].txnCount += count;
    }

    const collectors = usersRes.rows.map((u) => {
      const stats = byEmail[String(u.email || '').toLowerCase()] || { byBlock: [], total: 0, txnCount: 0 };
      return {
        email: u.email,
        name: String(u.collector_name || '').trim() || u.email,
        collectionBlock: u.collection_block || '',
        allowedBlocks: withDefaultOutsideAccess(u.allowed_blocks),
        totalAmount: stats.total,
        txnCount: stats.txnCount,
        byBlock: stats.byBlock.sort((a, b) => b.amount - a.amount),
      };
    });

    const known = new Set(collectors.map((c) => String(c.email || '').toLowerCase()));
    for (const email of Object.keys(byEmail)) {
      if (known.has(email)) continue;
      const stats = byEmail[email];
      collectors.push({
        email,
        name: email,
        collectionBlock: '',
        allowedBlocks: [],
        totalAmount: stats.total,
        txnCount: stats.txnCount,
        byBlock: stats.byBlock.sort((a, b) => b.amount - a.amount),
      });
    }

    const viewer = normalizeCollectorEmail(req.query.email);
    const isAdmin = viewer === 'admin@sdapp.com';
    const named = (c) => {
      const display = String(c.name || '').trim();
      return display && display.toLowerCase() !== String(c.email || '').toLowerCase();
    };

    let visible = collectors.filter((c) => {
      if (named(c) || String(c.collectionBlock || '').trim()) return true;
      if (isAdmin && Number(c.totalAmount) > 0) return true;
      return false;
    });

    if (!isAdmin) {
      visible = visible.filter((c) => String(c.email || '').toLowerCase() === viewer);
      if (visible.length === 0 && viewer) {
        const self = collectors.find((c) => String(c.email || '').toLowerCase() === viewer);
        if (self) visible = [self];
      }
    }

    res.json({ collectors: visible, isAdmin });
  } catch (err) {
    console.error('Error fetching individual collections:', err);
    res.status(500).json({ error: 'Failed to fetch individual collections' });
  }
});

app.post('/api/filter-block-total', async (req, res) => {
  const { block } = req.body;

  if (!block) {
    return res.status(400).json({ error: 'Block is required' });
  }

  try {
    const result = await pool.query(
      `SELECT 
         c.houseno, 
         c.name, 
         COALESCE(SUM(s.subscriptiontotalamount), 0) AS subscriptiontotalamount
       FROM CollectionDetails c
       LEFT JOIN SubscriptionDetails s ON c.subscriber_id = s.subscriberid
       WHERE c.block = $1 AND c.state = 'active'
       GROUP BY c.houseno, c.name
       ORDER BY c.houseno`,
      [block]
    );

    const total = result.rows.reduce((sum, row) => sum + parseFloat(row.subscriptiontotalamount), 0);

    res.json({
      customers: result.rows,
      total: total.toFixed(2)
    });
  } catch (err) {
    console.error('Error fetching block total:', err);
    res.status(500).json({ error: 'Failed to fetch block data' });
  }
});

// 1. Customer status (Pie Chart 1: Paid / Pending / Overdue)
app.post('/api/dashboard/customer-status', async (req, res) => {
  const { allowedBlocks } = req.body;
  try {
    // Paid: at least one transaction
    let queryPaid = `
      SELECT COUNT(DISTINCT c.subscriber_id) AS paid
      FROM CollectionDetails c
      JOIN SubscriptionDetails s ON c.subscriber_id = s.subscriberid
      JOIN TransactionalDetails t ON s.subscriptionid = t.subscriptionid
      WHERE c.state = 'active'
    `;
    // Pending: has NO transaction
    let queryPending = `
      SELECT COUNT(*) AS pending
      FROM CollectionDetails c
      WHERE c.state = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM SubscriptionDetails s
        JOIN TransactionalDetails t ON s.subscriptionid = t.subscriptionid
        WHERE s.subscriberid = c.subscriber_id
      )
    `;
    // Overdue: [OPTIONAL] You can define logic based on your requirement.
    // For now, we will keep it as 0
    let values = [];
    if (!allowedBlocks.includes('ALLBLOCKS')) {
      queryPaid += ` AND c.block = ANY($1)`;
      queryPending += ` AND c.block = ANY($1)`;
      values = [allowedBlocks];
    }

    const paidRes = await pool.query(queryPaid, values);
    const pendingRes = await pool.query(queryPending, values);

    res.json({
      paid: Number(paidRes.rows[0].paid),
      pending: Number(pendingRes.rows[0].pending)
    });
  } catch (err) {
    res.status(500).json({ error: 'Dashboard customer status failed' });
  }
});

// 2. Payment mode distribution (Pie Chart 2)
app.post('/api/dashboard/payment-modes', async (req, res) => {
  const { allowedBlocks } = req.body;

  try {
    let query = `
      SELECT t.modeofpayment AS mode, COUNT(*) AS count
      FROM CollectionDetails c
      JOIN SubscriptionDetails s ON c.subscriber_id = s.subscriberid
      JOIN TransactionalDetails t ON s.subscriptionid = t.subscriptionid
      WHERE c.state = 'active'
        AND t.modeofpayment IS NOT NULL AND TRIM(t.modeofpayment) <> ''
    `;
    let values = [];

    if (
      allowedBlocks &&
      Array.isArray(allowedBlocks) &&
      allowedBlocks.length > 0 &&
      !allowedBlocks.includes('ALLBLOCKS')
    ) {
      query += ` AND c.block = ANY($1)`;
      values = [allowedBlocks];
    }

    query += ` GROUP BY t.modeofpayment`;

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error('Payment mode query failed:', err);
    res.status(500).json({ error: 'Payment mode query failed' });
  }
});



app.post('/api/dashboard/receipt-status', async (req, res) => {
  const { allowedBlocks } = req.body;
  try {
    let query = `
      SELECT 
        COALESCE(SUM(CASE WHEN receiptstatus = 'collected' THEN 1 ELSE 0 END), 0) AS collected,
        COALESCE(SUM(CASE WHEN receiptstatus = 'due' THEN 1 ELSE 0 END), 0) AS due,
        COALESCE(SUM(CASE WHEN receiptstatus = 'pending' OR receiptstatus IS NULL OR receiptstatus = '' THEN 1 ELSE 0 END), 0) AS pending
      FROM CollectionDetails
      WHERE state = 'active'`;
    const values = [];
    if (allowedBlocks && Array.isArray(allowedBlocks) && !allowedBlocks.includes('ALLBLOCKS')) {
      query += ' AND block = ANY($1)';
      values.push(allowedBlocks);
    }
    const result = await pool.query(query, values);
    res.json({
      collected: parseInt(result.rows[0].collected, 10),
      due: parseInt(result.rows[0].due, 10),
      pending: parseInt(result.rows[0].pending, 10)
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch receipt status dashboard.' });
  }
});


app.post('/api/dashboard/update-receiptstatus', async (req, res) => {
  const { houseno } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE CollectionDetails SET receiptstatus = 'collected' WHERE houseno = $1`,
      [houseno]
    );

    const subRes = await client.query(
      `SELECT subscriber_id FROM CollectionDetails WHERE houseno = $1`,
      [houseno]
    );
    if (subRes.rows.length > 0) {
      for (const row of subRes.rows) {
        const subscriberId = row.subscriber_id;
        // 3. Get all subscriptionids for this subscriber
        const subs = await client.query(
          `SELECT subscriptionid FROM SubscriptionDetails WHERE subscriberid = $1`,
          [subscriberId]
        );
        for (const sub of subs.rows) {
          // 4. Update all relevant TransactionalDetails to 'completed'
          await client.query(
            `UPDATE TransactionalDetails SET receiptstatus = 'completed' WHERE subscriptionid = $1 AND receiptstatus != 'completed'`,
            [sub.subscriptionid]
          );
          // 5. After update, recalculate the subscription sum (collected/completed only)
          await client.query(
            `UPDATE SubscriptionDetails
             SET subscriptiontotalamount = (
                SELECT COALESCE(SUM(subscriptionamount),0)
                FROM TransactionalDetails
                WHERE subscriptionid = $1 AND (receiptstatus = 'collected' OR receiptstatus = 'completed')
              )
             WHERE subscriptionid = $1`,
            [sub.subscriptionid]
          );
        }
      }
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: 'Failed to update status' });
  } finally {
    client.release();
  }
});


app.post('/api/dashboard/due-housenos', async (req, res) => {
  const { allowedBlocks } = req.body;
  try {
    let query = `
      SELECT 
        c.houseno, 
        c.name, 
        c.block, 
        SUM(t.subscriptionamount) AS total_due_amount
      FROM CollectionDetails c
      JOIN SubscriptionDetails s ON c.subscriber_id = s.subscriberid
      JOIN TransactionalDetails t ON s.subscriptionid = t.subscriptionid
      WHERE c.receiptstatus = 'due'
        AND c.state = 'active'
        AND t.receiptstatus = 'due'
    `;
    const values = [];
    if (allowedBlocks && Array.isArray(allowedBlocks) && !allowedBlocks.includes('ALLBLOCKS')) {
      query += ` AND c.block = ANY($1)`;
      values.push(allowedBlocks);
    }
    query += `
      GROUP BY c.houseno, c.name, c.block
      ORDER BY c.houseno
    `;

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch due housenos' });
  }
});


function truthyFlag(v) {
  return v === true || v === 't' || v === 'true' || v === 1;
}

function isRealBlock(value) {
  const b = String(value || '').trim();
  return b.length > 0 && b !== '—' && b !== '-' && b.toUpperCase() !== 'ALLBLOCKS';
}

function buildBlockOverview(rows, allowedBlocks) {
  const grouped = {};
  for (const row of rows) {
    const rawBlock = String(row.block || '').trim();
    const block = isOutsideBlock(rawBlock) ? OUTSIDE_BLOCK : rawBlock;
    if (!isRealBlock(block)) continue;
    if (!grouped[block]) grouped[block] = [];
    const hasCompleted = truthyFlag(row.has_completed);
    const hasDue = truthyFlag(row.has_due);
    const hasTransaction = truthyFlag(row.has_transaction) || hasCompleted || hasDue;
    grouped[block].push({
      houseno: row.houseno,
      name: row.name,
      contact: row.contact,
      email: row.email,
      block,
      collected_amount: Number(row.collected_amount || 0),
      due_amount: Number(row.due_amount || 0),
      has_transaction: hasTransaction,
      has_due: hasDue,
      has_completed: hasCompleted,
    });
  }

  const blocks = normalizeBlocks(allowedBlocks).filter(b => b !== NO_OUTSIDE_FLAG);
  let keys;
  if (blocks.length > 0 && !blocks.includes('ALLBLOCKS')) {
    keys = blocks.filter(b => b && b !== 'ALLBLOCKS');
  } else {
    keys = Object.keys(grouped);
    if (!keys.some(isOutsideBlock)) keys.push(OUTSIDE_BLOCK);
  }
  keys = [...new Set(keys)].sort((a, b) => {
    const order = { A: 1, B: 2, C: 3, D: 4, [OUTSIDE_BLOCK]: 5, OUTSIDE: 5 };
    return (order[a] || 50) - (order[b] || 50) || String(a).localeCompare(String(b));
  });

  return keys.map((block) => {
    const members = grouped[block] || [];
    const completed = members.filter(m => m.has_completed);
    const notCompleted = members.filter(m => !m.has_transaction);
    const due = members.filter(m => m.has_due);
    return {
      block,
      total: members.length,
      completed: completed.length,
      notCompleted: notCompleted.length,
      due: due.length,
      lists: { total: members, completed, notCompleted, due },
    };
  });
}
app.post('/api/dashboard/summary', async (req, res) => {
  const { allowedBlocks } = req.body;
  const scoped =
    allowedBlocks && Array.isArray(allowedBlocks) && !allowedBlocks.includes('ALLBLOCKS');
  const blockValues = scoped ? [allowedBlocks] : [];
  const blockClause = (alias) => (scoped ? ` AND ${alias}.block = ANY($1)` : '');

  try {
    const [paidRes, pendingRes, modesRes, receiptRes, dueRes, membersRes] = await Promise.all([
      pool.query(
        `SELECT COUNT(DISTINCT c.subscriber_id) AS paid
         FROM CollectionDetails c
         JOIN SubscriptionDetails s ON c.subscriber_id = s.subscriberid
         JOIN TransactionalDetails t ON s.subscriptionid = t.subscriptionid
         WHERE c.state = 'active'${blockClause('c')}`,
        blockValues
      ),
      pool.query(
        `SELECT COUNT(*) AS pending
         FROM CollectionDetails c
         WHERE c.state = 'active'
           AND NOT EXISTS (
             SELECT 1 FROM SubscriptionDetails s
             JOIN TransactionalDetails t ON s.subscriptionid = t.subscriptionid
             WHERE s.subscriberid = c.subscriber_id
           )${blockClause('c')}`,
        blockValues
      ),
      pool.query(
        `SELECT t.modeofpayment AS mode, COUNT(*) AS count
         FROM CollectionDetails c
         JOIN SubscriptionDetails s ON c.subscriber_id = s.subscriberid
         JOIN TransactionalDetails t ON s.subscriptionid = t.subscriptionid
         WHERE c.state = 'active'
           AND t.modeofpayment IS NOT NULL AND TRIM(t.modeofpayment) <> ''${blockClause('c')}
         GROUP BY t.modeofpayment`,
        blockValues
      ),
      pool.query(
        `SELECT
           COALESCE(SUM(CASE WHEN receiptstatus = 'collected' THEN 1 ELSE 0 END), 0) AS collected,
           COALESCE(SUM(CASE WHEN receiptstatus = 'due' THEN 1 ELSE 0 END), 0) AS due,
           COALESCE(SUM(CASE WHEN receiptstatus = 'pending' OR receiptstatus IS NULL OR receiptstatus = '' THEN 1 ELSE 0 END), 0) AS pending
         FROM CollectionDetails c
         WHERE c.state = 'active'${blockClause('c')}`,
        blockValues
      ),
      pool.query(
        `SELECT
           t.receipt_no,
           c.houseno,
           c.name,
           c.block,
           c.contact,
           c.email,
           c.amountpaidlastyear,
           c.previousyearreceiptnumber,
           t.subscriptionamount AS amount,
           t.yearofpayment,
           t.bhog,
           t.reference_receipt_no
         FROM CollectionDetails c
         JOIN SubscriptionDetails s ON c.subscriber_id = s.subscriberid
         JOIN TransactionalDetails t ON s.subscriptionid = t.subscriptionid
         WHERE c.state = 'active' AND t.receiptstatus = 'due'${blockClause('c')}
         ORDER BY c.houseno`,
        blockValues
      ),
      pool.query(
        `SELECT
           c.houseno,
           c.name,
           c.contact,
           c.email,
           c.block,
           BOOL_OR(t.subscriptionid IS NOT NULL) AS has_transaction,
           BOOL_OR(LOWER(COALESCE(t.receiptstatus, '')) IN ('collected', 'completed')) AS has_completed,
           BOOL_OR(LOWER(COALESCE(t.receiptstatus, '')) = 'due') AS has_due,
           COALESCE(SUM(t.subscriptionamount) FILTER (
             WHERE LOWER(COALESCE(t.receiptstatus, '')) IN ('collected', 'completed')
           ), 0) AS collected_amount,
           COALESCE(SUM(t.subscriptionamount) FILTER (
             WHERE LOWER(COALESCE(t.receiptstatus, '')) = 'due'
           ), 0) AS due_amount
         FROM CollectionDetails c
         LEFT JOIN SubscriptionDetails s ON c.subscriber_id = s.subscriberid
         LEFT JOIN TransactionalDetails t ON s.subscriptionid = t.subscriptionid
         WHERE c.state = 'active'${blockClause('c')}
         GROUP BY c.subscriber_id, c.houseno, c.name, c.contact, c.email, c.block
         ORDER BY c.block, c.houseno`,
        blockValues
      ),
    ]);

    res.json({
      customerStatus: {
        paid: Number(paidRes.rows[0].paid),
        pending: Number(pendingRes.rows[0].pending),
      },
      paymentModes: modesRes.rows,
      receiptStatus: {
        collected: parseInt(receiptRes.rows[0].collected, 10),
        due: parseInt(receiptRes.rows[0].due, 10),
        pending: parseInt(receiptRes.rows[0].pending, 10),
      },
      dueHousenos: dueRes.rows,
      blockOverview: buildBlockOverview(membersRes.rows, allowedBlocks),
    });
  } catch (err) {
    console.error('Dashboard summary failed:', err);
    res.status(500).json({ error: 'Dashboard summary failed' });
  }
});

// Complete a previously-created DUE transaction: attach the payment mode,
// mark it collected, recompute totals, and regenerate the receipt image.
// Identified by the receipt_no of the due transaction (unique per transaction).
app.post('/api/complete-due', async (req, res) => {
  const { receiptNo, paymentMode, utrNumber, referenceDetails, bhog, contact, email, referenceReceiptNumber, transactionReference, transactionDated, bankName, collectorEmail } = req.body;
  if (!receiptNo) return res.status(400).json({ error: 'receiptNo is required' });
  if (!paymentModeForDb(paymentMode)) return res.status(400).json({ error: 'paymentMode is required to complete a due entry' });

  const bhogCount = (bhog === '' || bhog === null || bhog === undefined) ? null : parseInt(bhog, 10);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Load the due transaction along with the house + existing receipt snapshot
    const txRes = await client.query(
      `SELECT t.subscriptionid, t.subscriptionamount, t.yearofpayment, t.receiptstatus, t.bhog,
              c.subscriber_id, c.houseno, c.name, c.block
       FROM TransactionalDetails t
       JOIN SubscriptionDetails s ON t.subscriptionid = s.subscriptionid
       JOIN CollectionDetails c ON s.subscriberid = c.subscriber_id
       WHERE t.receipt_no = $1`,
      [receiptNo]
    );

    if (txRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Due transaction not found for that receipt number' });
    }

    const tx = txRes.rows[0];
    if (tx.receiptstatus !== 'due') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This transaction is not in a due state.' });
    }

    // 1) Finalize the transaction
    await client.query(
      `UPDATE TransactionalDetails
       SET modeofpayment = $1, utrnumber = $2, referencenumber = $3,
           receiptstatus = 'completed', bhog = COALESCE($4, bhog),
           reference_receipt_no = COALESCE($5, reference_receipt_no),
           transaction_reference = COALESCE($6, transaction_reference),
           transaction_dated = COALESCE($7, transaction_dated),
           bank_name = COALESCE($8, bank_name),
           collector_email = COALESCE($9, collector_email)
       WHERE receipt_no = $10`,
      [
        paymentMode,
        (transactionReference || utrNumber || null),
        referenceDetails || null,
        bhogCount,
        referenceReceiptNumber || null,
        (transactionReference || utrNumber || '').trim() || null,
        transactionDated || null,
        (bankName || '').trim() || null,
        normalizeCollectorEmail(collectorEmail),
        receiptNo
      ]
    );

    // 2) Mark the house collected (+ optionally refresh contact/email)
    await client.query(
      `UPDATE CollectionDetails
       SET receiptstatus = 'collected',
           contact = COALESCE($1, contact),
           email = COALESCE($2, email)
       WHERE subscriber_id = $3`,
      [contact || null, email || null, tx.subscriber_id]
    );

    // 3) Recompute the subscription total from collected/completed rows
    await client.query(
      `UPDATE SubscriptionDetails
       SET subscriptiontotalamount = (
          SELECT COALESCE(SUM(subscriptionamount),0)
          FROM TransactionalDetails
          WHERE subscriptionid = $1 AND (receiptstatus = 'collected' OR receiptstatus = 'completed')
        )
       WHERE subscriptionid = $1`,
      [tx.subscriptionid]
    );

    // Load the existing receipt row (for its snapshot names + amount)
    const rcpt = await client.query(
      `SELECT amount, president, secretary1, secretary2, treasurer FROM Receipts WHERE receipt_no = $1`,
      [receiptNo]
    );
    const existing = rcpt.rows[0] || {};

    await client.query('COMMIT');

    // Rebuild the receipt using the ORIGINAL snapshot names (fallback to current config)
    const snapshotConfig = {
      president: existing.president,
      secretary1: existing.secretary1,
      secretary2: existing.secretary2,
      treasurer: existing.treasurer,
    };
    
    const config = (existing.president || existing.treasurer)
      ? snapshotConfig
      : await getReceiptConfig();

    const receiptPayload = {
      receiptNo,
      date: new Date().toLocaleDateString('en-GB'),
      name: tx.name,
      houseNo: tx.houseno,
      address: `${tx.houseno}${tx.block ? ', Block ' + tx.block : ''}`,
      amountFigure: existing.amount ?? tx.subscriptionamount,
      amountWords: amountToWords(existing.amount ?? tx.subscriptionamount),
      paymentMode,
      bhog: bhogCount ?? tx.bhog,
      status: 'collected',
      chequeOrDDNo: utrNumber || referenceDetails || ''
    };

    const receiptHtml = buildReceiptHtml(receiptPayload, config);
    let receiptImageUrl = '';
    let receiptViewUrl = '';
    let receiptSvg = '';
    try {
      const saved = await saveReceiptImage(receiptPayload, config);
      receiptImageUrl = saved.imageUrl || '';
      receiptViewUrl = saved.viewUrl || '';
      receiptSvg = saved.svg || '';
    } catch (imgErr) {
      console.error('Failed to regenerate receipt image on completion:', imgErr.message);
    }

    // Persist the updated payment mode + regenerated receipt
    await pool.query(
      `UPDATE Receipts
       SET payment_mode = $1, receipt_html = $2,
           receipt_image_url = COALESCE($3, receipt_image_url),
           receipt_view_url = COALESCE($4, receipt_view_url),
           status = 'collected',
           bhog = COALESCE($5, bhog),
           reference_receipt_no = COALESCE($6, reference_receipt_no)
       WHERE receipt_no = $7`,
      [paymentMode, receiptHtml, receiptImageUrl || null, receiptViewUrl || null, bhogCount, referenceReceiptNumber || null, receiptNo]
    );
    if (receiptImageUrl) {
      await pool.query(
        `UPDATE TransactionalDetails SET receipt_image_url = $1, receipt_view_url = $2 WHERE receipt_no = $3`,
        [receiptImageUrl, receiptViewUrl, receiptNo]
      );
    }

    res.json({ success: true, receiptNo, receiptImageUrl, receiptViewUrl, receiptSvg });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('Error completing due transaction:', err);
    res.status(500).json({ error: err.message || 'Failed to complete due transaction' });
  } finally {
    client.release();
  }
});


app.get('/api/receipt-svg/:receiptNo', async (req, res) => {
  const { receiptNo } = req.params;
  try {
    const result = await pool.query(
      `SELECT r.receipt_no, r.houseno, r.name, r.amount, r.payment_mode, r.created_at,
              r.president, r.secretary1, r.secretary2, r.treasurer,
              COALESCE(r.bhog, t.bhog, 0) AS bhog,
              COALESCE(r.status, t.receiptstatus, 'collected') AS status,
              COALESCE(NULLIF(TRIM(t.reference_receipt_no), ''), r.reference_receipt_no) AS reference_receipt_no,
              c.block
       FROM Receipts r
       LEFT JOIN TransactionalDetails t ON t.receipt_no = r.receipt_no
       LEFT JOIN CollectionDetails c ON c.houseno = r.houseno
       WHERE r.receipt_no = $1
       LIMIT 1`,
      [receiptNo]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Receipt not found' });
    }
    const row = result.rows[0];
    const config = {
      president: row.president,
      secretary1: row.secretary1,
      secretary2: row.secretary2,
      treasurer: row.treasurer,
    };
    // Fall back to live config if this receipt has no snapshot names
    const live = (!row.president && !row.treasurer) ? await getReceiptConfig() : config;
    const receiptData = {
      receiptNo: row.receipt_no,
      date: row.created_at ? new Date(row.created_at).toLocaleDateString('en-GB') : '',
      name: row.name,
      houseNo: row.houseno,
      address: `${row.houseno}${row.block ? ', Block ' + row.block : ''}`,
      amountFigure: row.amount,
      amountWords: amountToWords(row.amount),
      paymentMode: row.payment_mode || '',
      bhog: row.bhog ?? 0,
      status: row.status || 'collected',
      chequeOrDDNo: ''
    };
    const svg = buildReceiptSvg(receiptData, live);
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.send(svg);
  } catch (err) {
    console.error('Error building receipt SVG:', err);
    res.status(500).json({ error: 'Failed to build receipt SVG' });
  }
});


// Update reference receipt no / customer contact / customer email on an existing
// receipt. Empty submitted fields are ignored so existing DB values are kept.
app.post('/api/receipts/update-details', async (req, res) => {
  const receiptNo = String(req.body?.receiptNo ?? '').trim();
  if (!receiptNo) {
    return res.status(400).json({ error: 'receiptNo is required' });
  }

  const refNo = blankToNull(req.body?.referenceReceiptNo);
  const contactVal = blankToNull(req.body?.contact);
  const emailVal = blankToNull(req.body?.email);

  if (!refNo && !contactVal && !emailVal) {
    return res.json({ success: true, message: 'No changes' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const found = await client.query(
      `SELECT r.receipt_no, r.houseno, r.name, r.amount, r.year_of_payment, r.payment_mode,
              r.receipt_image_url, r.receipt_view_url,
              t.subscriptionid,
              s.subscriberid
       FROM Receipts r
       LEFT JOIN TransactionalDetails t ON t.receipt_no = r.receipt_no
       LEFT JOIN SubscriptionDetails s ON s.subscriptionid = t.subscriptionid
       WHERE r.receipt_no = $1
       LIMIT 1`,
      [receiptNo]
    );

    if (found.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Receipt not found' });
    }

    const row = found.rows[0];
    let subscriberId = row.subscriberid || null;

    if (!subscriberId && row.houseno && row.name) {
      const subRes = await client.query(
        `SELECT subscriber_id
         FROM CollectionDetails
         WHERE houseno = $1 AND name = $2
         ORDER BY CASE WHEN LOWER(COALESCE(state, '')) = 'active' THEN 0 ELSE 1 END
         LIMIT 1`,
        [row.houseno, row.name]
      );
      subscriberId = subRes.rows[0]?.subscriber_id || null;
    }

    await client.query(
      `UPDATE Receipts
       SET reference_receipt_no = COALESCE($1, reference_receipt_no),
           email = COALESCE($2, email)
       WHERE receipt_no = $3`,
      [refNo, emailVal, receiptNo]
    );

    await client.query(
      `UPDATE TransactionalDetails
       SET reference_receipt_no = COALESCE($1, reference_receipt_no)
       WHERE receipt_no = $2`,
      [refNo, receiptNo]
    );

    if (subscriberId && (contactVal || emailVal)) {
      await client.query(
        `UPDATE CollectionDetails
         SET contact = COALESCE($1, contact),
             email = COALESCE($2, email)
         WHERE subscriber_id = $3`,
        [contactVal, emailVal, subscriberId]
      );
    }

    try {
      await client.query('SAVEPOINT receipt_mapping');
      await client.query(
        `UPDATE ReceiptMapping
         SET reference_receipt_no = COALESCE($1, reference_receipt_no)
         WHERE receipt_no = $2`,
        [refNo, receiptNo]
      );
      await client.query('RELEASE SAVEPOINT receipt_mapping');
    } catch {
      await client.query('ROLLBACK TO SAVEPOINT receipt_mapping');
    }

    await client.query('COMMIT');
    res.json({
      success: true,
      receiptNo: row.receipt_no,
      name: row.name,
      houseno: row.houseno,
      amount: row.amount,
      yearOfPayment: row.year_of_payment,
      paymentMode: row.payment_mode,
      contact: contactVal,
      receiptImageUrl: row.receipt_image_url || '',
      receiptViewUrl: row.receipt_view_url || '',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating receipt details:', err);
    res.status(500).json({ error: 'Failed to update receipt details' });
  } finally {
    client.release();
  }
});

// ✅ GET RECEIPTS — scoped to the caller's allowed blocks so a single-block
// user only ever sees their own block's receipts.
app.get('/api/receipts', async (req, res) => {
  try {
    // allowedBlocks arrives as a JSON string or comma list in the query.
    let allowedBlocks = [];
    if (req.query.allowedBlocks) {
      try {
        allowedBlocks = JSON.parse(req.query.allowedBlocks);
      } catch {
        allowedBlocks = String(req.query.allowedBlocks).split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    const scoped =
      Array.isArray(allowedBlocks) && allowedBlocks.length > 0 && !allowedBlocks.includes('ALLBLOCKS');

    let query = `
      SELECT 
        r.receipt_no,
        r.houseno,
        r.name,
        r.amount,
        r.created_at,
        r.receipt_html,
        r.receipt_image_url,
        r.receipt_view_url,
        r.year_of_payment,
        r.payment_mode,
        COALESCE(NULLIF(TRIM(c.email), ''), r.email) AS email,
        c.contact,
        r.president,
        r.secretary1,
        r.secretary2,
        r.treasurer,
        r.bhog,
        r.status,
        COALESCE(NULLIF(TRIM(t.reference_receipt_no), ''), r.reference_receipt_no) AS reference_receipt_no,
        c.block
      FROM Receipts r
      LEFT JOIN TransactionalDetails t ON t.receipt_no = r.receipt_no`;
    const values = [];
    if (scoped) {
      query += ` JOIN CollectionDetails c ON c.houseno = r.houseno AND c.block = ANY($1)`;
      values.push(allowedBlocks);
    } else {
      query += ` LEFT JOIN CollectionDetails c ON c.houseno = r.houseno AND c.name = r.name AND c.state = 'active'`;
    }
    query += ` ORDER BY r.created_at DESC`;

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching receipts:', err);
    res.status(500).json({ error: 'Failed to fetch receipts' });
  }
});

// 📲 Manually resend a WhatsApp notification for an existing receipt
app.post('/api/resend-whatsapp', async (req, res) => {
  const { contact, name, amount, receiptNo } = req.body;

  if (!contact) {
    return res.status(400).json({ error: 'Contact number is required' });
  }

  try {
    await sendWhatsAppMessage(contact, name, amount, receiptNo);
    res.json({ success: true, message: 'WhatsApp message sent' });
  } catch (err) {
    console.error('Error resending WhatsApp message:', err);
    res.status(500).json({ success: false, error: 'Failed to send WhatsApp message' });
  }
});





(async () => {
  await ensureReceiptImageColumn();
  await ensureReceiptsBucket();
  await ensureIndexes();
  const server = app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Close the other Node process on that port, then start the server again.`);
    } else {
      console.error('Server listen error:', err);
    }
    process.exit(1);
  });
})().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});