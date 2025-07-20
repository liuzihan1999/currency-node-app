const express = require('express');
const fs = require('fs');
const mysql = require('mysql2/promise');
const getSymbolFromCurrency = require('currency-symbol-map');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const cors = require('cors');
app.use(cors());
app.use(bodyParser.json());

const {
    DB_HOST, DB_USER, DB_PASSWORD, DB_NAME,
  } = process.env;

// create database connection pool
const pool = mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    port: 3306,
});

// Initialize currencies data
async function initCurrencyData() {
    // JSON file path
    const filePath = './processed_currencies/processed_currency_data.json';

    try{
        // read JSON
        const jsonData = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(jsonData);

        // link with MySQL database
        const connection = await mysql.createConnection({
            host: DB_HOST,
            user: DB_USER,
            password: DB_PASSWORD,
            database: DB_NAME,
            port:3306
        });

        // insert currency data to currencies table
        for (const row of data) {
            try {
                const isoCode = row.ISOCode || null;
                const name = row.Name || null;
                const symbol = getSymbolFromCurrency(isoCode)|| null;

                const country = JSON.stringify(row.Country || []);
                console.log(country)
                const isActive = 1;

                const query = `
                    INSERT INTO currencies (iso_code, name, symbol, country, is_active)
                    VALUES (?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        name = VALUES(name),
                        symbol = VALUES(symbol),
                        country = VALUES(country),
                        is_active = VALUES(is_active),
                        updated_at = CURRENT_TIMESTAMP
                `;
                const values = [isoCode, name, symbol, country, isActive];
                await connection.execute(query, values);
                console.log(`insert successfully: ${name} (${isoCode})`);
            } catch (error) {
                console.error(`insert failed: ${row.Currency} (${row.AlphabeticCode})`, error);
            }
        }

        await connection.end();
        console.log('Database connection closed');
    } catch (error) {
        console.error('ERROR happened during reading or processing JSON file', error);
    }
}


// GET /currencies → 列出所有启用的货币
app.get('/currencies', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM currencies WHERE is_active = 1');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch currencies' });
    }
});

// GET /currencies?field=value → 根据字段查询货币
app.get('/currencies/search', async (req, res) => {
    const { iso_code, id, name, symbol, country, is_active } = req.query;
    let query = 'SELECT * FROM currencies WHERE 1=1';
    const params = [];

    if (iso_code) {
        query += ' AND iso_code = ?';
        params.push(iso_code);
    }
    if (id) {
        query += ' AND id = ?';
        params.push(id);
    }
    if (name) {
        query += ' AND name = ?';
        params.push(name);
    }
    if (symbol) {
        query += ' AND symbol = ?';
        params.push(symbol);
    }
    if (country) {
        query += ' AND JSON_CONTAINS(country, ?)';
        params.push(`"${country}"`);
    }
    if (is_active) {
        query += ' AND is_active = ?';
        params.push(is_active);
    }

    try {
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch currency' });
    }
});

// POST /currencies/insert → 添加新货币
app.post('/currencies/insert', async (req, res) => {
    const { iso_code, name, symbol, country, is_active } = req.body;

    try {
        const [result] = await pool.query(
            'INSERT INTO currencies (iso_code, name, symbol, country, is_active) VALUES (?, ?, ?, ?, ?)',
            [iso_code, name, symbol, JSON.stringify(country), is_active || 1]
        );
        res.status(201).json({ id: result.insertId, message: 'Currency added successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to add currency' });
    }
});

// GET /currencies/delete → 禁用货币
app.get('/currencies/delete', async (req, res) => {
    const { id } = req.query;

    if (!id) {
        return res.status(400).json({ error: 'Currency ID is required' });
    }

    try {
        await pool.query('UPDATE currencies SET is_active = 0 WHERE id = ?', [id]);
        res.json({ message: 'Currency disabled successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to disable currency' });
    }
});

// POST /currencies/update → 更新货币记录的字段
app.post('/currencies/update', async (req, res) => {
    const { id, iso_code, name, symbol, country, is_active } = req.body;

    if (!id) {
        return res.status(400).json({ error: 'Currency ID is required' });
    }

    const updates = [];
    const params = [];

    if (iso_code) {
        updates.push('iso_code = ?');
        params.push(iso_code);
    }
    if (name) {
        updates.push('name = ?');
        params.push(name);
    }
    if (symbol) {
        updates.push('symbol = ?');
        params.push(symbol);
    }
    if (country) {
        updates.push('country = ?');
        params.push(JSON.stringify(country));
    }
    if (is_active !== undefined) {
        updates.push('is_active = ?');
        params.push(is_active);
    }

    params.push(id);

    try {
        await pool.query(`UPDATE currencies SET ${updates.join(', ')} WHERE id = ?`, params);
        res.json({ message: 'Currency updated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update currency' });
    }
});

// start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});