import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import pkg from 'pg';
import nodemailer from 'nodemailer';
import axios from 'axios';
import puppeteer from 'puppeteer';


const { Pool } = pkg;
const app = express();
const port = process.env.PORT || 5000;

app.use(bodyParser.json());
app.use(cors());


const pool = new Pool({
  connectionString: 'postgresql://postgres:XsPMpWWepOgNFyOghdChoCEzJEEsOhTu@nozomi.proxy.rlwy.net:31144/railway',
  ssl: {
    rejectUnauthorized: false,
  },
});

// const pool = new Pool({
//   user: 'postgres',
//   host: 'localhost',
//   database: 'SDapp',
//   password: 'Karthik@2812',
//   port: 5432
// });
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'sdapp2025@gmail.com',      // <-- CHANGE THIS
    pass:  'vvym ntxl rhxi tuzl'       // <-- CHANGE THIS
  },
 tls: {
    rejectUnauthorized: false
  }
});

const WHATSAPP_PHONE_NUMBER_ID = '825611950625039';
const WHATSAPP_TOKEN = 'EAFaDzMhQxQwBPCMSdDu2nZCkV5KKVpGZAltXkZCPd3I0lDELlHfncH3PnDcbtUZCZA1B0vMuiZC0hnehxwdM1P2nbfoXUdCfI41oYyLOrv6PDyP9MEIPY485dDOFnoUvdxZB9ZCGGQOLeHYmoHaKqL6sJlD7juDxl7T3fdopVcmUrXq69iNFHxWjXReD7RQtxcKZC9itkwUJC6uM4p7u278ItdWZB30GYO2f4pBg8BEM40rI7XV24ZD'; // Use env var ideally
const WHATSAPP_TEMPLATE_NAME = 'receipt_notification_'; // Update to your approved template name
const WHATSAPP_LANG_CODE = 'en_US'; // Template language


async function getOrCreateReceiptNo(client, houseno, name) {
  // 1. Check if mapping exists
  const existing = await client.query(
    'SELECT receipt_no FROM ReceiptMapping WHERE houseno = $1 AND name = $2',
    [houseno, name]
  );
  if (existing.rows.length > 0) return existing.rows[0].receipt_no;

  // 2. Get max current receipt_no, generate next (always at least 100001)
  const res = await client.query('SELECT MAX(receipt_no) AS max_receipt FROM ReceiptMapping');
  let nextNum = 100001; // Start at 100001
  if (res.rows[0].max_receipt) {
    const currentNum = parseInt(res.rows[0].max_receipt.replace('E-', ''), 10);
    nextNum = Math.max(currentNum + 1, 100001); // Always at least 100001
  }
  if (nextNum > 999999) throw new Error('Receipt number overflow');
  const nextReceiptNo = `E-${nextNum.toString().padStart(6, '0')}`;  // <-- 6 digits

  // 3. Insert new mapping
  await client.query(
    'INSERT INTO ReceiptMapping (houseno, name, receipt_no) VALUES ($1, $2, $3)',
    [houseno, name, nextReceiptNo]
  );
  return nextReceiptNo;
}




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

function buildReceiptHtml(receiptData = {}) {
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
    <div class="receipt-header">
      <div class="receipt-title">Sarbojanin Durgotsab, 2025</div>
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
      as subscription/donation for Sri Sri Durga Puja, Laxmi Puja and Kali Puja 2025.
    </div>
    <div class="rupee-box">
      ₹ ${receiptData.amountFigure || ""}
    </div>
    <!-- Stamp overlay (optional) -->
    <!-- <img class="stamp" src="file:///absolute/path/to/stamp.png" /> -->
    <div class="sign-row">
      <div class="sign-col">
        <b>Sarbani Basu Roy</b><br>
        <span class="sign-role">President</span>
      </div>
      <div class="sign-col">
        <b>Moumita Shome</b><br>
        <b>Ragesri Choudhury</b><br>
        <span class="sign-role">Jt. General Secretaries</span>
      </div>
      <div class="sign-col">
        <b>${receiptData.collector || "Sayan Mitra"}</b><br>
        <span class="sign-role">Treasurer</span>
      </div>
    </div>
  </div>
</body>
</html>
`;
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

// async function sendWhatsAppMessage(contactNumber, name, amount, receiptNo) {
//   try {
//     const response = await axios.post(
//      `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
//       {
//         messaging_product: 'whatsapp',
//         to: `91${contactNumber}`,
//         type: 'template',
//         template: {
//           name: WHATSAPP_TEMPLATE_NAME,
//           language: {
//             code: WHATSAPP_LANG_CODE
//           },
//           components: [
//             {
//               type: 'body',
//               parameters: [
//                 { type: 'text', text: name || '' },
//                 { type: 'text', text: `₹${amount}` },
//                 { type: 'text', text: receiptNo || '' }
//               ]
//             }
//           ]
//         }
//       },
//       {
//         headers: {
//           Authorization: `Bearer ${WHATSAPP_TOKEN}`,
//           'Content-Type': 'application/json'
//         }
//       }
//     );
//     console.log('WhatsApp API response:', response.data);
//   } catch (error) {
//     console.error('WhatsApp message failed:', error.response?.data || error.message);
//   }
// }


app.post('/api/send-receipt', async (req, res) => {
  const { email, formData, receiptData } = req.body;
  console.log('Received receipt:', email, receiptData);
  if (!email) {
    return res.status(400).json({ error: 'No email provided.' });
  }
  if (!receiptData) {
    return res.status(400).json({ error: 'No receipt data provided.' });
  }
  try {
    // 1. Build the HTML for the receipt (for PDF)
    const htmlReceiptAttachment = buildReceiptHtml(receiptData);

    // 2. Generate PDF from HTML using Puppeteer
    const puppeteer = (await import('puppeteer')).default;
    const browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(htmlReceiptAttachment, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    // 3. Compose the email body (form data, NOT PDF)
    const buildFormDataHtml = (formData) => `
      <h2>Transaction/Customer Details</h2>
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
      <p>Thank you,<br/>Sarbojanin Durgotsab Team</p>
    `;

    // 4. Send the mail: HTML form data in body, PDF as attachment
    await transporter.sendMail({
      from: 'sdapp2025@gmail.com',
      to: email,
      subject: 'Your Submission and Receipt - Sarbojanin Durgotsab 2025',
      html: buildFormDataHtml(formData),
      attachments: [
        {
          filename: 'Receipt.pdf',
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    });
//      if (formData?.contact?.length === 10) {
//   // sendWhatsAppMessage(
//   //   formData.contact,
//   //   receiptData.name,
//   //   receiptData.amountFigure,
//   //   receiptData.receiptNo
//   // );
// }

    res.json({ message: 'Combined details and PDF receipt sent successfully!' });
  } catch (err) {
    console.error('Error sending mail:', err);
    res.status(500).json({ error: 'Sending failed.' });
  }
});




// server.js
app.post('/api/data', async (req, res) => {
  const { allowedBlocks } = req.body;
  try {
    const values = [];
    let query = `
      SELECT c.houseno, c.name, c.contact, c.email, c.block, c.amountpaidlastyear, c.receiptstatus, c.previousyearreceiptnumber, r.receipt_no
      FROM CollectionDetails c
      LEFT JOIN ReceiptMapping r ON c.houseno = r.houseno AND c.name = r.name
      WHERE c.state = 'active'
    `;
    if (!allowedBlocks.includes('ALLBLOCKS')) {
      query += ` AND c.block = ANY($1)`;
      values.push(allowedBlocks);
    }
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
  const { houseNo, name, contact, block, email, amountPaid, yearOfPayment, paymentMode, utrNumber, referenceDetails, receiptStatus } = req.body;
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
    const receiptNo = await getOrCreateReceiptNo(client, houseNo, name);

    await client.query(
      `INSERT INTO TransactionalDetails (subscriptionid, yearofpayment, subscriptionamount, modeofpayment, utrnumber, referencenumber, receiptstatus, receipt_no, createdat)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
      [subscriptionId, amountPaid, paymentMode, utrNumber, referenceDetails, receiptStatus || 'due', receiptNo]
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
    res.json({ message: 'Transaction saved successfully', receiptNo });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error saving transaction:', err);
    res.status(500).json({ error: 'Transaction failed' });
  } finally {
    client.release();
  }
});




// Create new house + transaction
app.post('/api/create-new-house', async (req, res) => {
  const { houseNo, name, contact, email, block, amountPaid, amountPaidLastYear, yearOfPayment, paymentMode, utrNumber, referenceDetails, receiptStatus, previousYearReceiptNumber } = req.body;
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
    const receiptNo = await getOrCreateReceiptNo(client, houseNo, name);

    await client.query(
      `INSERT INTO TransactionalDetails (subscriptionid, yearofpayment, subscriptionamount, modeofpayment, utrnumber, referencenumber, receiptstatus, receipt_no, createdat)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
      [subscriptionId, amountPaid, paymentMode, utrNumber, referenceDetails, receiptStatus || 'due', receiptNo]
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
    res.json({ message: 'New house, subscription, and transaction saved!', receiptNo });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating new house:', err);
    res.status(500).json({ error: 'Operation failed' });
  } finally {
    client.release();
  }
});

//


// Update customer state
app.post('/api/update-customer-state', async (req, res) => {
  const { houseNo, state } = req.body;
  try {
    await pool.query(`UPDATE CollectionDetails SET state = $1 WHERE houseno = $2`,[state, houseNo]);
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
        t.transaction_timestamp,
        t.subscriptionamount,
        t.modeofpayment,
        t.utrnumber,
        t.referencenumber,
        t.receiptstatus,
        t.receipt_no    -- <-- ADD THIS FIELD
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
    if (receiptStatus && receiptStatus.toLowerCase() !== 'all') {
      query += ` AND (t.receiptstatus = $${values.length + 1})`;
      values.push(receiptStatus.toLowerCase() === "collected" ? "collected" : "due");
    } else {
      query += ` AND (t.receiptstatus = 'collected' OR t.receiptstatus = 'completed')`;
    }
    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching combined data:', err);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});




// Update the state of a CollectionDetails entry (active/inactive)
app.post('/api/update-customer-state', async (req, res) => {
  const { houseNo, state } = req.body;
  try {
    await pool.query(
      'UPDATE CollectionDetails SET state = $1 WHERE houseno = $2',
      [state, houseNo]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating state:', err);
    res.status(500).json({ success: false, message: 'Failed to update state' });
  }
});
// Get subscribers
app.get('/api/subscribers', async (req, res) => {
  try {
    const result = await pool.query('SELECT subscriber_id, houseno, name FROM CollectionDetails');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching subscribers:', err);
    res.status(500).json({ error: 'Failed to fetch subscribers' });
  }
});

// Endpoint to get combined data from CollectionDetails, SubscriptionDetails, TransactionalDetails

// In your server.js

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query(
      'SELECT * FROM Logincredentials WHERE email = $1 AND password = $2',
      [email, password]
    );

    if (result.rows.length > 0) {
      const user = result.rows[0];
      res.json({ success: true, allowedBlocks: user.allowed_blocks || [] });
    } else {
      res.json({ success: false });
    }
  } catch (err) {
    console.error('Error validating login:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


app.post('/api/add-user', async (req, res) => {
  const { email, password, blocks } = req.body;
  try {
    const checkResult = await pool.query(
      'SELECT * FROM Logincredentials WHERE email = $1',
      [email]
    );

    if (checkResult.rows.length > 0) {
      return res.json({ success: false, message: 'User already exists' });
    }

    await pool.query(
      'INSERT INTO Logincredentials (email, password, allowed_blocks) VALUES ($1, $2, $3)',
      [email, password, blocks]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error adding user:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


// Update user credentials
app.post('/api/update-user', async (req, res) => {
  const { email, password, blocks } = req.body;

  try {
    await pool.query(
      'UPDATE Logincredentials SET password = $1, allowed_blocks = $2 WHERE email = $3',
      [password, blocks, email]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ success: false, message: 'Server error' });
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
    console.log(paidRes);
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


// Dashboard: Receipt Status Chart
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
    // 1. Update CollectionDetails status to 'collected'
    await client.query(
      `UPDATE CollectionDetails SET receiptstatus = 'collected' WHERE houseno = $1`,
      [houseno]
    );
    // 2. Get all subscriber_id(s) for this house
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







app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});


