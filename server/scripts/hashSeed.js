// script di testing per generare gli hash bcrypt per il seed.sql
// per eseguire: node scripts/hashSeed.js

const bcrypt = require('bcrypt');

const utenti = [
  { email: 'alessandro.g@garage.it', password: 'gestore123' },
  { email: 'roberta.r@garage.it',    password: 'gestore123' },
  { email: 'fabio.s@garage.it',      password: 'gestore123' },
  { email: 'sonia.f@garage.it',      password: 'gestore123' },
  { email: 'marco.l@email.com',      password: 'cliente123' },
  { email: 'chiara.v@email.com',     password: 'cliente123' },
  { email: 'paolo.d@email.com',      password: 'cliente123' },
  { email: 'simona.r@email.com',     password: 'cliente123' },
  { email: 'davide.m@email.com',     password: 'cliente123' },
  { email: 'giada.s@email.com',      password: 'cliente123' },
];

async function main() {
  for (const u of utenti) {
    const hash = await bcrypt.hash(u.password, 10);
    console.log(`('${u.email}', '${hash}')`);
  }
}

main();