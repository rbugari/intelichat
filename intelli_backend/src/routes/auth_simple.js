const express = require('express');
const router = express.Router();
const authSimpleController = require('../controllers/authSimpleController');

// POST /auth-simple/start
router.post('/start', authSimpleController.start);

// GET /auth-simple/verify
router.get('/verify', authSimpleController.verify);

module.exports = router;
