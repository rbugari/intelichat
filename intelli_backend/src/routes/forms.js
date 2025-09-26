const express = require('express');
const { formsController } = require('../controllers');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Las rutas de formularios no estarán protegidas en desarrollo
router.get('/:codigo', asyncHandler(formsController.getFormByCodigo.bind(formsController)));
router.post('/submit', asyncHandler(formsController.submitForm.bind(formsController)));

module.exports = router;