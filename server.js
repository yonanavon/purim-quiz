require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const { parse } = require('csv-parse');
const { pool, initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_SECRET = process.env.ADMIN_SECRET || '15641681';

app.use(express.json());
app.use(express.static('public'));

const upload = multer({ storage: multer.memoryStorage() });

// Generate HMAC token from password
function generateToken(password) {
  return crypto.createHmac('sha256', 'purim-quiz-salt').update(password).digest('hex');
}

// Middleware to verify admin token
function requireAdmin(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = auth.slice(7);
  const expected = generateToken(ADMIN_SECRET);
  if (token !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// GET /api/questions/random
app.get('/api/questions/random', async (req, res) => {
  try {
    const exclude = req.query.exclude
      ? req.query.exclude.split(',').map(Number).filter(n => !isNaN(n))
      : [];

    let query, params;
    if (exclude.length > 0) {
      query = 'SELECT * FROM questions WHERE id != ALL($1) ORDER BY RANDOM() LIMIT 1';
      params = [exclude];
    } else {
      query = 'SELECT * FROM questions ORDER BY RANDOM() LIMIT 1';
      params = [];
    }

    const result = await pool.query(query, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No questions available' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/admin/login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'סיסמה שגויה' });
  }
  const token = generateToken(ADMIN_SECRET);
  res.json({ token });
});

// GET /api/admin/questions
app.get('/api/admin/questions', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM questions ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/admin/questions
app.post('/api/admin/questions', requireAdmin, async (req, res) => {
  const { question, option_a, option_b, option_c, option_d, correct_answer } = req.body;
  if (!question || !option_a || !option_b || !option_c || !option_d || !correct_answer) {
    return res.status(400).json({ error: 'כל השדות חובה' });
  }
  if (!['a', 'b', 'c', 'd', 'j'].includes(correct_answer)) {
    return res.status(400).json({ error: 'תשובה נכונה חייבת להיות a/b/c/d או j לשאלה הומוריסטית' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO questions (question, option_a, option_b, option_c, option_d, correct_answer) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [question, option_a, option_b, option_c, option_d, correct_answer]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// PUT /api/admin/questions/:id
app.put('/api/admin/questions/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { question, option_a, option_b, option_c, option_d, correct_answer } = req.body;
  if (!question || !option_a || !option_b || !option_c || !option_d || !correct_answer) {
    return res.status(400).json({ error: 'כל השדות חובה' });
  }
  if (!['a', 'b', 'c', 'd', 'j'].includes(correct_answer)) {
    return res.status(400).json({ error: 'תשובה נכונה חייבת להיות a/b/c/d או j לשאלה הומוריסטית' });
  }
  try {
    const result = await pool.query(
      'UPDATE questions SET question=$1, option_a=$2, option_b=$3, option_c=$4, option_d=$5, correct_answer=$6 WHERE id=$7 RETURNING *',
      [question, option_a, option_b, option_c, option_d, correct_answer, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'שאלה לא נמצאה' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /api/admin/questions/:id
app.delete('/api/admin/questions/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM questions WHERE id=$1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'שאלה לא נמצאה' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/admin/import-csv
app.post('/api/admin/import-csv', requireAdmin, upload.single('csv'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'לא צורף קובץ CSV' });
  }

  // Strip BOM manually and detect delimiter (comma or semicolon)
  let csvContent = req.file.buffer.toString('utf8').replace(/^\uFEFF/, '');
  const delimiter = csvContent.includes(';') && !csvContent.split('\n')[0].includes(',') ? ';' : ',';

  const records = [];
  const errors = [];

  try {
    const data = await new Promise((resolve, reject) => {
      parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        delimiter,
        relax_column_count: true
      }, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });

    data.forEach((row, i) => {
      const { question, option_a, option_b, option_c, option_d, correct_answer } = row;
      if (!question || !option_a || !option_b || !option_c || !option_d || !correct_answer) {
        errors.push(`שורה ${i + 2}: שדות חסרים`);
        return;
      }
      const ca = correct_answer.trim().toLowerCase();
      if (!['a', 'b', 'c', 'd', 'j'].includes(ca)) {
        errors.push(`שורה ${i + 2}: תשובה נכונה לא תקינה "${correct_answer}" — השתמש a/b/c/d או j`);
        return;
      }
      records.push([question, option_a, option_b, option_c, option_d, ca]);
    });

    let inserted = 0;
    for (const rec of records) {
      await pool.query(
        'INSERT INTO questions (question, option_a, option_b, option_c, option_d, correct_answer) VALUES ($1,$2,$3,$4,$5,$6)',
        rec
      );
      inserted++;
    }

    res.json({ inserted, errors, delimiter });
  } catch (err) {
    console.error('CSV import error:', err);
    res.status(500).json({ error: `שגיאה בעיבוד ה-CSV: ${err.message}` });
  }
});

// Start server
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Purim Quiz server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
