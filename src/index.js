require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Middleware to authenticate JWT
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.user = user;
    next();
  } catch {
    res.status(403).json({ message: 'Forbidden' });
  }
};

// Middleware for role check
const authorizeAdmin = (req, res, next) => {
  if (req.user.role !== 1) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// Register
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!(username && email && password)) {
    return res.status(400).json({ message: 'Missing fields' });
  }

  const conn = await pool.getConnection();
  try {
    const [existing] = await conn.query('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing.length) return res.status(409).json({ message: 'User already exists' });

    const hash = await bcrypt.hash(password, 10);
    await conn.query(
      'INSERT INTO users (username, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
      [username, email, hash, 0]
    );
    res.json({ message: 'User registered successfully' });
  } finally {
    conn.release();
  }
});

// Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query('SELECT * FROM users WHERE username = ?', [username]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ user_id: user.user_id, username: user.username, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '2h',
    });
    res.json({ token });
  } finally {
    conn.release();
  }
});

// View Profile
app.get('/searchProfile', authenticateToken, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query('SELECT user_id, username, email, role, created_at FROM users WHERE user_id = ?', [
      req.user.user_id,
    ]);
    res.json(rows[0]);
  } finally {
    conn.release();
  }
});

// Update Profile
app.put('/updateProfile', authenticateToken, async (req, res) => {
  const { username, email, password } = req.body;
  const conn = await pool.getConnection();
  try {
    const hash = password ? await bcrypt.hash(password, 10) : undefined;

    await conn.query(
      'UPDATE users SET username = ?, email = ?, password_hash = ?, updated_at = NOW() WHERE user_id = ?',
      [username, email, hash, req.user.user_id]
    );
    res.json({ message: 'Profile updated successfully' });
  } finally {
    conn.release();
  }
});

// Admin Only: Get All Users
app.get('/admin/users', authenticateToken, authorizeAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query('SELECT user_id, username, email, role, created_at FROM users');
    res.json(rows);
  } finally {
    conn.release();
  }
});

// Admin Only: Delete User
app.delete('/admin/users/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.query('DELETE FROM users WHERE user_id = ?', [req.params.id]);
    res.json({ message: 'User deleted' });
  } finally {
    conn.release();
  }
});

// Start server
app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
