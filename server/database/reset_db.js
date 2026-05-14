const fs = require('fs');
const path = require('path');

const db = require('./db'); 

async function resetAndSeed() {
  try {
    console.log(' Leggendo i file SQL...');
    
    const schemaSql = fs.readFileSync(path.join(__dirname, 'parkly.sql'), 'utf8');
    const seedSql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');

    console.log('Ricreando le tabelle (schema)...');
    await db.none(schemaSql);

    console.log('Inserendo i dati del seed...');
    await db.none(seedSql);

    console.log('Database resettato e popolato con successo!');
    process.exit(0);
  } catch (error) {
    console.error('Errore durante il reset del DB:', error);
    process.exit(1);
  }
}

resetAndSeed();