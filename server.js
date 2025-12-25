const path = require('path');
const express = require('express');
const sql = require('sql.js');
const fs = require('fs');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const dbPath = path.join(__dirname, 'prelaunch.db');
let db = null;

// Email configuration (update with your email)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password'
  }
});

// Test email connection (optional, remove if causes issues)
transporter.verify((error, success) => {
  if (error) {
    console.log('⚠️  Email service not configured. Confirmations will not be sent.');
    console.log('   Set EMAIL_USER and EMAIL_PASS environment variables to enable email.');
  } else {
    console.log('✅ Email service ready');
  }
});

// Initialize database
async function initDb() {
  let filebuffer = null;
  try {
    filebuffer = fs.readFileSync(dbPath);
  } catch (e) {
    filebuffer = null;
  }
  const SQL = await sql.default();
  db = filebuffer ? new SQL.Database(filebuffer) : new SQL.Database();

  // Pre-launch schema: emails + generation logs
  db.run(`
    CREATE TABLE IF NOT EXISTS emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS generations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_address TEXT NOT NULL,
      level TEXT,
      stack TEXT,
      goal TEXT,
      blueprint_title TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  saveDb();
}

function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

function dbRun(sqlText, params = []) {
  try {
    const stmt = db.prepare(sqlText);
    stmt.bind(params);
    stmt.step();
    stmt.free();
    saveDb();
    return true;
  } catch (e) {
    console.error('DB Error:', e.message);
    return false;
  }
}

function dbGet(sqlText, params = []) {
  try {
    const stmt = db.prepare(sqlText);
    stmt.bind(params);
    const result = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return result;
  } catch (e) {
    console.error('DB Error:', e.message);
    return null;
  }
}

// Get client IP
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown';
}

// Check if IP can generate today
function canGenerateToday(ip) {
  const today = new Date().toISOString().split('T')[0];
  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM generations 
    WHERE ip_address = ? AND date(created_at) = ?
  `);
  stmt.bind([ip, today]);
  const canGenerate = stmt.step();
  const result = canGenerate ? stmt.getAsObject() : null;
  stmt.free();
  return !result || result.count === 0;
}


function generateBlueprint(level, stack, goal) {
  const blueprint = blueprints[level]?.[stack]?.[goal];
  return blueprint || blueprints.beginner.frontend.portfolio;
}

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// API Routes
app.post('/api/generate', (req, res) => {
  const { level, stack, goal } = req.body;
  const ip = getClientIp(req);

  if (!canGenerateToday(ip)) {
    return res.status(429).json({ error: 'You already generated a blueprint today! Join early access for unlimited generations.' });
  }

  if (!level || !stack || !goal) {
    return res.status(400).json({ error: 'All fields required' });
  }

  const blueprint = generateBlueprint(level, stack, goal);
  dbRun(
    'INSERT INTO generations (ip_address, level, stack, goal, blueprint_title) VALUES (?, ?, ?, ?, ?)',
    [ip, level, stack, goal, blueprint.title]
  );

  res.json({ success: true, blueprint });
});

app.post('/api/email', (req, res) => {
  const { email } = req.body;

  if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  try {
    dbRun('INSERT INTO emails (email) VALUES (?)', [email]);
    
    // Send confirmation email
    const mailOptions = {
      from: `GitBoost <${process.env.EMAIL_USER || 'noreply@gitboost.dev'}>`,
      to: email,
      subject: 'Welcome to GitBoost – Confirmation ✓',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f4; padding: 40px 0;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                  
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #0EA68B 0%, #34D3B5 100%); padding: 40px 40px 30px; text-align: center;">
                      <div style="display: inline-block; background-color: rgba(255,255,255,0.2); padding: 12px 16px; border-radius: 8px; margin-bottom: 16px;">
                        <span style="color: #ffffff; font-size: 24px; font-weight: bold; letter-spacing: 0.5px;">GB</span>
                      </div>
                      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600; line-height: 1.3;">
                        Thank you for signing up!
                      </h1>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px;">
                      <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                        Hello,
                      </p>
                      <p style="margin: 0 0 24px; color: #333333; font-size: 16px; line-height: 1.6;">
                        We're excited to have you onboard with <strong>GitBoost</strong>. Your registration has been confirmed, and you'll be among the first to know when we launch.
                      </p>
                      
                      <div style="background-color: #f8f9fa; border-left: 4px solid #34D3B5; padding: 20px; margin: 24px 0; border-radius: 4px;">
                        <p style="margin: 0 0 16px; color: #0EA68B; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
                          What GitBoost Offers
                        </p>
                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td style="padding: 8px 0;">
                              <span style="color: #34D3B5; font-size: 18px; margin-right: 12px;">✓</span>
                              <span style="color: #333333; font-size: 15px; line-height: 1.5;">Professional project blueprints</span>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0;">
                              <span style="color: #34D3B5; font-size: 18px; margin-right: 12px;">✓</span>
                              <span style="color: #333333; font-size: 15px; line-height: 1.5;">Production-ready starter code</span>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0;">
                              <span style="color: #34D3B5; font-size: 18px; margin-right: 12px;">✓</span>
                              <span style="color: #333333; font-size: 15px; line-height: 1.5;">Bilingual documentation support</span>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0;">
                              <span style="color: #34D3B5; font-size: 18px; margin-right: 12px;">✓</span>
                              <span style="color: #333333; font-size: 15px; line-height: 1.5;">Tools built for developers</span>
                            </td>
                          </tr>
                        </table>
                      </div>
                      
                      <p style="margin: 24px 0 0; color: #333333; font-size: 16px; line-height: 1.6;">
                        We'll keep you updated on our progress. Thank you for supporting the GitBoost team as we build something great together.
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f8f9fa; padding: 30px 40px; border-top: 1px solid #e9ecef;">
                      <p style="margin: 0 0 8px; color: #333333; font-size: 15px; font-weight: 500;">
                        Best regards,
                      </p>
                      <p style="margin: 0 0 20px; color: #333333; font-size: 15px; font-weight: 500;">
                        The GitBoost Team
                      </p>
                      <p style="margin: 0; color: #6c757d; font-size: 13px; line-height: 1.5;">
                        This is an automated confirmation. If you have questions, feel free to reach out to us.
                      </p>
                    </td>
                  </tr>
                  
                </table>
                
                <!-- Footer Links -->
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="margin-top: 20px;">
                  <tr>
                    <td align="center" style="padding: 0 40px;">
                      <p style="margin: 0; color: #6c757d; font-size: 12px; line-height: 1.5;">
                        © 2025 GitBoost. All rights reserved.
                      </p>
                    </td>
                  </tr>
                </table>
                
              </td>
            </tr>
          </table>
        </body>
        </html>
      `
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.log('Email send error:', err.message);
        // Still return success even if email fails - user is in database
      } else {
        console.log('✅ Confirmation email sent to:', email);
      }
    });

    res.json({ success: true, message: 'Email saved! Check your inbox for confirmation.' });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    res.status(500).json({ error: 'Failed to save email' });
  }
});

app.get('/api/email-count', (req, res) => {
  try {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM emails');
    stmt.step();
    const result = stmt.getAsObject();
    stmt.free();
    const count = result?.count || 0;
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get count' });
  }
});

// Start server
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 GitBoost PRE-LAUNCH on http://localhost:${PORT}`);
    console.log(`📧 Features: Blueprint generator (1/IP/day) + email capture`);
  });
}).catch(err => {
  console.error('Failed to initialize:', err);
  process.exit(1);
});
