/*
 * Middleware di autenticazione e autorizzazione per le route Express.
 */

/*
 * Verifica che l'utente abbia una sessione attiva.
 * Usare su qualsiasi route che richieda il login.
 */
function isLoggato(req, res, next) {
  if (req.session.utente) {
    return next();
  }
  res
    .status(401)
    .json({
      success: false,
      error: "Devi essere loggato per accedere a questa risorsa.",
    });
}

/*
 * Verifica che l'utente loggato abbia il ruolo 'GESTORE'.
 */
function isGestore(req, res, next) {
  if (req.session.utente?.ruolo === "GESTORE") {
    return next();
  }
  res
    .status(403)
    .json({ success: false, error: "Accesso riservato ai gestori." });
}

module.exports = { isLoggato, isGestore };
