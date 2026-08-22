const { Router } = require('express');
const healthController = require('../controllers/health.controller');

const router = Router();

// Liveness — "is the process up" — used by Docker's HEALTHCHECK (Dockerfile)
router.get('/', healthController.liveness);

// Readiness — "can it actually serve traffic" — checks DB connectivity
router.get('/ready', healthController.readiness);

module.exports = router;
