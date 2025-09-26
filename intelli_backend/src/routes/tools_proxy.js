const express = require('express');
const router = express.Router();

// Simula la lógica para obtener el clima
router.get('/weather', (req, res) => {
    const { city } = req.query;
    if (!city) {
        return res.status(400).json({ error: 'El parámetro "city" es requerido' });
    }

    // Datos de ejemplo
    const weatherData = {
        city: city,
        temp: Math.floor(Math.random() * 20 + 10), // Temp aleatoria entre 10 y 30
        unit: 'celsius',
        description: 'Soleado con algunas nubes'
    };

    console.log(`[TOOLS PROXY] Devolviendo clima para ${city}:`, weatherData);
    res.json(weatherData);
});

// Simula la lógica para obtener el precio de una criptomoneda
router.get('/crypto/price', (req, res) => {
    const { symbol } = req.query;
    if (!symbol) {
        return res.status(400).json({ error: 'El parámetro "symbol" es requerido' });
    }

    // Datos de ejemplo
    const cryptoData = {
        symbol: symbol.toUpperCase(),
        price_usd: parseFloat((Math.random() * 50000 + 1000).toFixed(2))
    };

    console.log(`[TOOLS PROXY] Devolviendo precio para ${symbol}:`, cryptoData);
    res.json(cryptoData);
});

// Simula la lógica para una calculadora
router.post('/math/calc', (req, res) => {
    const { expression } = req.body;
    if (!expression) {
        return res.status(400).json({ error: 'El parámetro "expression" es requerido' });
    }

    try {
        // ¡CUIDADO! eval() es inseguro. Esto es solo para demostración.
        // En un entorno real, se debe usar una librería de parsing matemático seguro.
        const result = eval(expression.replace(/[^0-9+\-*\/(). ]/g, ''));
        console.log(`[TOOLS PROXY] Calculando expresión: ${expression} = ${result}`);
        res.json({ result });
    } catch (e) {
        res.status(400).json({ error: 'Expresión matemática inválida' });
    }
});

// Simula la lógica para conversión de unidades
router.post('/convert/unit', (req, res) => {
    const { value, from, to } = req.body;
    if (value === undefined || !from || !to) {
        return res.status(400).json({ error: 'Los parámetros "value", "from" y "to" son requeridos' });
    }

    // Lógica de conversión simple de ejemplo
    let result;
    if (from === 'metros' && to === 'pies') {
        result = value * 3.28084;
    } else if (from === 'pies' && to === 'metros') {
        result = value / 3.28084;
    } else {
        return res.status(400).json({ error: `Conversión de ${from} a ${to} no soportada.` });
    }

    console.log(`[TOOLS PROXY] Convirtiendo ${value} ${from} a ${to} = ${result}`);
    res.json({ result: parseFloat(result.toFixed(2)) });
});

module.exports = router;
