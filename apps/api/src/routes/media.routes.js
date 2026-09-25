const { Router } = require('express');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const router = Router();
const MEDIA_DIR = process.env.MEDIA_CACHE_DIR || '/tmp/pr-review-media';

// Ensure directory exists
if (!fs.existsSync(MEDIA_DIR)) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

/**
 * Public image server for social platforms (Instagram, Facebook, X, LinkedIn)
 * GET /api/media/:filename
 */
router.get('/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(MEDIA_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Media not found' });
  }

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
  fs.createReadStream(filePath).pipe(res);
});

module.exports = router;
