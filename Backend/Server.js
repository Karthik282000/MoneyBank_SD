import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import pkg from 'pg';

const { Pool } = pkg;
const app = express();
const port = 5000;

app.use(bodyParser.json());
app.use(cors());


const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'SDapp',
  password: 'Karthik@2812',
  port: 5432
});

app.get('/api/data', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.houseno, c.name, c.contact, c.block, s.amountpaidlastyear
      FROM CollectionDetails c
      LEFT JOIN SubscriptionDetails s
        ON c.subscriber_id = s.subscriberid
        AND s.yearofsubscription = (
          SELECT MAX(yearofsubscription)
          FROM SubscriptionDetails
          WHERE subscriberid = c.subscriber_id
        )
      WHERE c.state = 'active'
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching data:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get Financial Year
app.get('/api/get-financial-year', (req, res) => {
  const today = new Date();
  const fyYear = (today.getMonth() + 1 >= 4) ? today.getFullYear() : today.getFullYear() - 1;
  res.json({ yearOfPayment: fyYear });
});

// Save Transaction for existing user
app.post('/api/save-transaction', async (req, res) => {
  const { houseNo, name, contact, block, amountPaid, yearOfPayment, paymentMode, utrNumber, referenceDetails } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const subscriberResult = await client.query(
      `SELECT subscriber_id FROM CollectionDetails WHERE houseno = $1 AND state = 'active'`,
      [houseNo]
    );

    if (subscriberResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'House number not found or inactive' });
    }
    const today = new Date();
    let yearOfPayment = (today.getMonth() + 1 >= 4) ? today.getFullYear() : today.getFullYear() - 1;
    const subscriberId = subscriberResult.rows[0].subscriber_id;

    await client.query(
     ` UPDATE CollectionDetails SET name = $1, contact = $2, block = $3 WHERE subscriber_id = $4`,
      [name, contact, block, subscriberId]
    );
    
    let subscriptionResult = await client.query(
      `SELECT subscriptionid FROM SubscriptionDetails WHERE subscriberid = $1 AND yearofsubscription = $2`,
      [subscriberId, yearOfPayment]
    );

    let subscriptionId;
    if (subscriptionResult.rows.length > 0) {
      subscriptionId = subscriptionResult.rows[0].subscriptionid;
    } else {
      const newSub = await client.query(
        `INSERT INTO SubscriptionDetails (subscriberid, yearofsubscription, subscriptiontotalamount, amountpaidlastyear, createdat)
         VALUES ($1, $2, 0, NULL, CURRENT_TIMESTAMP) RETURNING subscriptionid`,
        [subscriberId, yearOfPayment]
      );
      subscriptionId = newSub.rows[0].subscriptionid;
    }

    await client.query(`
      INSERT INTO TransactionalDetails (subscriptionid, yearofpayment, subscriptionamount, modeofpayment, utrnumber, referencenumber, createdat)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [subscriptionId, amountPaid, paymentMode, utrNumber, referenceDetails]
    );

    await client.query(`
      UPDATE SubscriptionDetails SET subscriptiontotalamount = subscriptiontotalamount + $1 WHERE subscriptionid = $2`,
      [amountPaid, subscriptionId]
    );

    await client.query('COMMIT');
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
  const { houseNo, name, contact, block, amountPaid, yearOfPayment, paymentMode, utrNumber, referenceDetails } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const insertCollection = await client.query(`
      INSERT INTO CollectionDetails (houseno, name, contact, block, state)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING subscriber_id`,
      [houseNo, name, contact, block]
    );

    const subscriberId = insertCollection.rows[0].subscriber_id;

    const insertSubscription = await client.query(
     ` INSERT INTO SubscriptionDetails (subscriberid, yearofsubscription, subscriptiontotalamount, amountpaidlastyear, createdat)
       VALUES ($1, $2, $3, NULL, CURRENT_TIMESTAMP) RETURNING subscriptionid`,
      [subscriberId, yearOfPayment, amountPaid]
    );

    const subscriptionId = insertSubscription.rows[0].subscriptionid;

    await client.query(`
      INSERT INTO TransactionalDetails (subscriptionid, yearofpayment, subscriptionamount, modeofpayment, utrnumber, referencenumber, createdat)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [subscriptionId, amountPaid, paymentMode, utrNumber, referenceDetails]
    );

    await client.query('COMMIT');
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
app.get('/api/all-data', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.houseno, c.name, c.contact, s.yearofsubscription, s.subscriptiontotalamount, s.amountpaidlastyear,
             t.yearofpayment, t.subscriptionamount, t.modeofpayment, t.utrnumber, t.referencenumber
      FROM CollectionDetails c
      JOIN SubscriptionDetails s ON c.subscriber_id = s.subscriberid
      JOIN TransactionalDetails t ON s.subscriptionid = t.subscriptionid
      WHERE c.state = 'active'
    `);
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
      res.json({ success: true });
    } else {
      res.json({ success: false });
    }
  } catch (err) {
    console.error('Error validating login:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


app.post('/api/add-user', async (req, res) => {
  const { email, password } = req.body;
  try {
    const checkResult = await pool.query(
      'SELECT * FROM Logincredentials WHERE email = $1',
      [email]
    );

    if (checkResult.rows.length > 0) {
      return res.json({ success: false, message: 'User already exists' });
    }

    await pool.query(
      'INSERT INTO Logincredentials (email, password) VALUES ($1, $2)',
      [email, password]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error adding user:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update user credentials
app.post('/api/update-user', async (req, res) => {
  const { oldEmail, newEmail, newPassword } = req.body;

  try {
    await pool.query(
      'UPDATE Logincredentials SET email = $1, password = $2 WHERE email = $3',
      [newEmail, newPassword, oldEmail]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


app.get('/api/data', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM CollectionDetails');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching data:', err);
    res.status(500).json({ error: 'Database error' });
  }
});


app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});


