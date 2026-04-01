function isLoggato(req, res, next) {
    if (req.session.utente) {
        next(); // è loggato, ok
    } else {
        res.status(401).json({ 
            success: false, 
            error: 'Devi essere loggato' 
        });
    }
}

function isGestore(req, res, next) {
    if (req.session.utente && req.session.utente.ruolo === 'GESTORE') {
        next(); // è un gestore, ok
    } else {
        res.status(403).json({ 
            success: false, 
            error: 'Accesso riservato ai gestori' 
        });
    }
}

module.exports = { 
    isLoggato, 
    isGestore 
};
