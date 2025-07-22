import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import pkg from 'pg';
import nodemailer from 'nodemailer';
import puppeteer from 'puppeteer';


const { Pool } = pkg;
const app = express();
const port = process.env.PORT || 5000;

app.use(bodyParser.json());
app.use(cors());


const pool = new Pool({
  connectionString: 'postgresql://sd_app_database_user:boyfzrYD9qnJVRNsTXYsFaJNio83JWU5@dpg-d1vpf32dbo4c73fonq50-a.oregon-postgres.render.com/sd_app_database',
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
    pass: 'tsnp xxjh xmce qket'          // <-- CHANGE THIS
  },
 tls: {
    rejectUnauthorized: false
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

function buildReceiptHtml(receiptData = {}) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt</title>
  <style>
    html, body {
      background: #fffbe7;
      font-family: 'Segoe UI', Arial, sans-serif;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      color-adjust: exact;
    }
    .receipt-container {
      background: #fffbe7;
      border: 2px solid #e7d183;
      border-radius: 16px;
      max-width: 600px;
      padding: 22px 18px 12px 18px;
      margin: 30px auto;
      box-sizing: border-box;
      box-shadow: 0 2px 10px #e3dfb6;
    }
    .receipt-header { text-align: center; margin-bottom: 4px; }
    .receipt-title {
      color: #db621e; font-size: 2.1em; font-weight: 700;
      font-family: 'Georgia', serif; letter-spacing: 1px; margin-bottom: 0.1em;
    }
    .receipt-org { font-weight: 600; font-size: 1.1em; }
    .receipt-org-main { display: block; color: #1846b1; font-size: 1.07em; font-weight: 700; }
    .receipt-org-address { font-size: 1.02em; margin-bottom: 8px; }
    .receipt-hr { border: none; border-top: 1.5px solid #cbbf8f; margin: 4px 0 18px 0; }
    .receipt-row-flex { display: flex; justify-content: space-between; font-size: 1.15em; font-weight: 600; margin-bottom: 9px; max-width: 95%; }
    .receipt-label { font-size: 1.10em; color: #6a5408; font-weight: 700; margin: 9px 0 3px 0; }
    .receipt-value { color: #252324; font-weight: 600; margin-left: 4px; }
    .receipt-bold-indented { margin-left: 4px; color: #383006; font-weight: 700; }
    .receipt-field { margin: 5px 0 0 0; font-size: 1.07em; font-weight: 700; color: #6a5408; }
    .receipt-purpose { margin: 22px 0 7px 0; font-size: 1.04em; color: #85724a; font-style: italic; text-align: center; line-height: 1.5; }
    .receipt-bottom-table { width: 100%; margin-top: 35px; font-size: 1.07em; color: #3d3635; }
    .receipt-bottom-table td { padding: 3px 12px 2px 8px; vertical-align: top; }
    .receipt-bottom-table th { font-weight: 700; text-align: left; color: #004186; padding-bottom: 2px;}
    .receipt-sign { text-align: right; margin-top: 15px; font-size: 1.18em; color: #ccb043; font-weight: 600; }
    .receipt-sign span { color: #e6b30f; font-weight: 800; }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="receipt-header">
      <div class="receipt-title">Sarbojanin Durgotsab 2025</div>
      <div class="receipt-org">
        Organised by:
        <span class="receipt-org-main">Lake Gardens People's Association</span>
      </div>
      <div class="receipt-org-address">
        At Bangur Park, B-202, Lake Gardens, Kolkata - 700 045
      </div>
    </div>
    <hr class="receipt-hr" />
    <div class="receipt-row-flex">
      <div>Receipt No: <span style="color:#383006;font-weight:700;">${receiptData.receiptNo || '[To be assigned]'}</span></div>
      <div>Date: <span style="color:#383006;font-weight:700;">${receiptData.date || ''}</span></div>
    </div>
    <div class="receipt-label">
      Received with thanks from: <span class="receipt-value">${receiptData.name || ''}</span>
    </div>
    <div class="receipt-label" style="color:#524006;">
      Of <span style="font-weight:600;color:#17395a;">${receiptData.address || ''}</span>
    </div>
    <div class="receipt-label">
      The sum of Rupees:<span class="receipt-bold-indented">${receiptData.amountWords || ''} only</span>
    </div>
    <div class="receipt-row-flex" style="margin-top:6px;">
      <div>Amount (₹): <span style="color:#222;font-weight:700;">${receiptData.amountFigure || ''}</span></div>
      <div>Mode: <span style="color:#222;font-weight:700;">${receiptData.paymentMode || ''}</span></div>
    </div>
    ${receiptData.chequeOrDDNo ? `
      <div class="receipt-field">
        Reference/UTR No: <span style="color:#17395a;font-weight:600;">${receiptData.chequeOrDDNo}</span>
      </div>
    ` : ""}
    <div class="receipt-purpose">
      as subscription/donation for Sri Sri Durga Puja, Laxmi Puja and Kali Puja 2024
    </div>

    <!-- Committee Table Section (matches original receipt) -->
    <table class="receipt-bottom-table"> 
      <tr style="font-size:0.97em;color:#6d5e48;">
        <td>President</td>
        <td>Working President</td>
        <td>Chief Patron</td>
        <td>Jt. General Secretary</td>
        <td>Treasurer</td>
        <td>Collector</td>
      </tr>
       <tr>
        <th>Saurabh Nag</th>
        <th>Debojyoti Moitra</th>
        <th>Debabrata Mitra</th>
        <th>Mithun Choudhury</th>
        <th>Priyanka Sengupta</th>
        <th>Sayan Mitra</th>
      </tr>
    </table>
    <div class="receipt-sign">
      Collector: <span>${receiptData.collector || 'Sayan Mitra'}</span>
    </div>
  </div>
</body>
</html>
`;}




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

app.post('/api/send-receipt', async (req, res) => {
  const { email, formData, receiptData } = req.body;
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

    res.json({ message: 'Combined details and PDF receipt sent successfully!' });
  } catch (err) {
    console.error('Error sending mail:', err);
    res.status(500).json({ error: 'Sending failed.' });
  }
});




app.post('/api/data', async (req, res) => {
  const { allowedBlocks } = req.body;
  try {
    const values = [];
    let query = `
      SELECT houseno, name, contact, email, block, amountpaidlastyear
      FROM CollectionDetails
      WHERE state = 'active'
    `;
    if (!allowedBlocks.includes('ALLBLOCKS')) {
      query += ` AND block = ANY($1)`;
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
  const { houseNo, name, contact, block, email, amountPaid, yearOfPayment, paymentMode, utrNumber, referenceDetails } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // 1. Find subscriber by houseNo+name
    let subRes = await client.query(
      `SELECT subscriber_id FROM CollectionDetails WHERE houseno = $1 AND name = $2 AND state = 'active'`,
      [houseNo, name]
    );
    let subscriberId;
    if (subRes.rows.length === 0) {
      // Not found: create new CollectionDetails row for new person in the house
      const insertRes = await client.query(
        `INSERT INTO CollectionDetails (houseno, name, contact, email, block, state, amountpaidlastyear)
         VALUES ($1, $2, $3, $4, $5, 'active', 0) RETURNING subscriber_id`,
        [houseNo, name, contact, email || null, block]
      );
      subscriberId = insertRes.rows[0].subscriber_id;
    } else {
      subscriberId = subRes.rows[0].subscriber_id;
      // Update contact/email/block for the existing person
      await client.query(
        `UPDATE CollectionDetails SET contact = $1, email = $2, block = $3 WHERE subscriber_id = $4`,
        [contact, email || null, block, subscriberId]
      );
    }

    // 2. Upsert subscription for this subscriber and year
    let subscriptionRes = await client.query(
      'SELECT subscriptionid FROM SubscriptionDetails WHERE subscriberid = $1 AND yearofsubscription = $2',
      [subscriberId, yearOfPayment]
    );
    let subscriptionId;
    if (subscriptionRes.rows.length > 0) {
      subscriptionId = subscriptionRes.rows[0].subscriptionid;
      await client.query(
        'UPDATE SubscriptionDetails SET subscriptiontotalamount = subscriptiontotalamount + $1 WHERE subscriptionid = $2',
        [amountPaid, subscriptionId]
      );
    } else {
      const newSub = await client.query(
        `INSERT INTO SubscriptionDetails (subscriberid, yearofsubscription, subscriptiontotalamount, createdat)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP) RETURNING subscriptionid`,
        [subscriberId, yearOfPayment, amountPaid]
      );
      subscriptionId = newSub.rows[0].subscriptionid;
    }

    // 3. Insert transaction for this subscription
    await client.query(
      `INSERT INTO TransactionalDetails (subscriptionid, yearofpayment, subscriptionamount, modeofpayment, utrnumber, referencenumber, createdat)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [subscriptionId, amountPaid, paymentMode, utrNumber, referenceDetails]
    );

    await client.query('COMMIT');
    // --- Send the form by mail! ---

    res.json({ message: 'Transaction saved successfully' });
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
  const { houseNo, name, contact, email, block, amountPaid, amountPaidLastYear, yearOfPayment, paymentMode, utrNumber, referenceDetails } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Insert new collection entry with initial amountpaidlastyear
    const colRes = await client.query(
      'INSERT INTO CollectionDetails (houseno, name, contact, email, block, state, amountpaidlastyear) VALUES ($1, $2, $3, $4, $5, \'active\', $6) RETURNING subscriber_id',
      [houseNo, name, contact, email, block, amountPaidLastYear || 0]
    );
    const subscriberId = colRes.rows[0].subscriber_id;
    // Insert or update subscription
    const subRes = await client.query(
      'SELECT subscriptionid FROM SubscriptionDetails WHERE subscriberid = $1 AND yearofsubscription = $2',
      [subscriberId, yearOfPayment]
    );
    let subscriptionId;
    if (subRes.rows.length > 0) {
      subscriptionId = subRes.rows[0].subscriptionid;
      await client.query(
        'UPDATE SubscriptionDetails SET subscriptiontotalamount = subscriptiontotalamount + $1 WHERE subscriptionid = $2',
        [amountPaid, subscriptionId]
      );
    } else {
      const newSub = await client.query(
        'INSERT INTO SubscriptionDetails (subscriberid, yearofsubscription, subscriptiontotalamount, createdat) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) RETURNING subscriptionid',
        [subscriberId, yearOfPayment, amountPaid]
      );
      subscriptionId = newSub.rows[0].subscriptionid;
    }
    // Insert transactional record
    await client.query(
      `INSERT INTO TransactionalDetails (subscriptionid, yearofpayment, subscriptionamount, modeofpayment, utrnumber, referencenumber, createdat)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [subscriptionId, amountPaid, paymentMode, utrNumber, referenceDetails]
    );
    await client.query('COMMIT');
    // --- Send mail ---
  

    res.json({ message: 'New house, subscription, and transaction saved!' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating new house:', err);
    res.status(500).json({ error: 'Operation failed' });
  } finally {
    client.release();
  }
});
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
  const { allowedBlocks } = req.body;
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
        t.referencenumber
      FROM CollectionDetails c
      JOIN SubscriptionDetails s ON c.subscriber_id = s.subscriberid
      JOIN TransactionalDetails t ON s.subscriptionid = t.subscriptionid
      WHERE c.state = 'active'
    `;
    const values = [];
    if (!allowedBlocks.includes('ALLBLOCKS')) {
      query += ` AND c.block = ANY($1)`;
      values.push(allowedBlocks);
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


app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});


