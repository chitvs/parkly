// client/src/utils/geo.js

/*
 * Calcola la distanza in chilometri tra due punti geografici.
 * @param {number} lat1 - Latitudine punto A
 * @param {number} lon1 - Longitudine punto A
 * @param {number} lat2 - Latitudine punto B
 * @param {number} lon2 - Longitudine punto B
 * @returns {number} Distanza in km
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;

    const R = 6371; // Raggio della Terra in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};