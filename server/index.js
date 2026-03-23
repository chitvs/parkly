const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./database/db'); 

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Server di Parkly operativo!');
});

// test 
app.get('/test-db', (req, res) => {
  db.any('SELECT NOW()')
    .then(data => {
      console.log('Risultati della query:', data);
      res.json({ success: true, orario: data[0].now });
    })
    .catch(error => {
      console.error('Errore nella query:', error);
      res.status(500).json({ success: false, error: 'Connessione fallita' });
    });
});

app.listen(port, () => {
  console.log(`Server in ascolto sulla porta ${port}...`);
});