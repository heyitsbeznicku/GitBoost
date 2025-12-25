#!/usr/bin/env node

/**
 * GitBoost Pre-Launch Database Checker
 * Quick way to see how many emails and blueprints are in the database
 * 
 * Usage: node check-db.js
 */

const Database = require('sql.js');
const fs = require('fs');

async function checkDatabase() {
  try {
    // Check if database exists
    if (!fs.existsSync('prelaunch.db')) {
      console.log('❌ Database not found. Start server first: npm start');
      return;
    }

    const data = fs.readFileSync('prelaunch.db');
    const SQL = await Database();
    const db = new SQL.Database(data);

    console.log('\n📊 GitBoost Pre-Launch Database Stats\n');
    console.log('=' .repeat(50));

    // Total emails
    const emailCount = db.exec('SELECT COUNT(*) as count FROM emails;');
    const totalEmails = emailCount[0]?.values[0]?.[0] || 0;
    console.log(`📧 Total Early Access Signups: ${totalEmails}`);

    // Total generations
    const genCount = db.exec('SELECT COUNT(*) as count FROM generations;');
    const totalGenerations = genCount[0]?.values[0]?.[0] || 0;
    console.log(`⚡ Total Blueprint Generations: ${totalGenerations}`);

    // Today's generations
    const todayGen = db.exec(`SELECT COUNT(*) as count FROM generations WHERE date(created_at) = date('now');`);
    const todayGenerations = todayGen[0]?.values[0]?.[0] || 0;
    console.log(`📅 Today's Generations: ${todayGenerations}`);

    console.log('=' .repeat(50));

    // List ALL emails
    console.log('\n📬 All Email Signups:\n');
    const emails = db.exec('SELECT email, created_at FROM emails ORDER BY created_at DESC;');
    if (emails[0]?.values.length > 0) {
      emails[0].values.forEach((row, i) => {
        console.log(`  ${i + 1}. ${row[0]}`);
        console.log(`     Signed up: ${row[1]}`);
      });
    } else {
      console.log('  No signups yet');
    }

    // Popular blueprints
    console.log('\n🎯 Most Popular Blueprints:\n');
    const popular = db.exec(`SELECT blueprint_title, COUNT(*) as count FROM generations GROUP BY blueprint_title ORDER BY count DESC LIMIT 5;`);
    if (popular[0]?.values.length > 0) {
      popular[0].values.forEach((row, i) => {
        console.log(`  ${i + 1}. ${row[0]} - ${row[1]} generates`);
      });
    } else {
      console.log('  No generations yet');
    }

    // Unique IPs
    const ips = db.exec('SELECT COUNT(DISTINCT ip_address) as count FROM generations;');
    const uniqueIPs = ips[0]?.values[0]?.[0] || 0;
    console.log(`\n👥 Unique IPs: ${uniqueIPs}`);

    console.log('\n' + '=' .repeat(50));
    console.log('\n💡 For detailed queries, use:');
    console.log('   sqlite3 prelaunch.db "SELECT * FROM emails;"');
    console.log('   sqlite3 prelaunch.db "SELECT * FROM generations;"');
    console.log('\n');

  } catch (error) {
    console.error('❌ Error reading database:', error.message);
    process.exit(1);
  }
}

checkDatabase();
