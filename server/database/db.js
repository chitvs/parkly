const pgp = require("pg-promise")();
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

/*
 * Configurazione della connessione a PostgreSQL.
 * Tutte le credenziali provengono dalle variabili d'ambiente (.env)
 */
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
};

const db = pgp(dbConfig);

/*
 * Verifica la connessione al DB all'avvio del server.
 * In caso di errore viene loggato, ma il processo non viene killato
 * perchè il server potrebbe comunque rispondere su endpoint che non usano il db.
 */
db.connect()
  .then((obj) => {
    console.log(
      `[DB] Connesso al database: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`,
    );
    obj.done(); // rilascia subito la connessione di test
  })
  .catch((err) => {
    console.error("[DB] Errore di connessione al database:", err.message);
  });

module.exports = db;
