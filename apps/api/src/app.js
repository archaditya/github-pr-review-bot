const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { serve } = require('inngest/express');

const config = require('./config');
const requestLogger = require('./middlewares/request-logger.middleware');
const errorHandler = require('./middlewares/error-handler.middleware');
const notFoundHandler = require('./middlewares/not-found.middleware');
const routes = require('./routes');
const { inngest, functions } = require('./jobs');

const app = express();

// Trust the reverse proxy in prod (infra/nginx) so req.ip / rate-limiting see the real client IP
app.set('trust proxy', config.isProduction ? 1 : 0);

app.use(helmet());
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(compression());
app.use(cookieParser());
app.use(requestLogger);

// Global rate limit — a coarse safety net; per-route limits (e.g. tighter on auth) can be
// layered on top later via middlewares/ once those routes exist.
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

// Capture the raw body alongside the parsed JSON — GitHub webhook signature verification
// (integrations/github/webhook-verifier.js) needs the exact raw bytes, not a re-serialized
// object, or the HMAC won't match.
app.use(
  express.json({
    limit: '2mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);
app.use('/', routes);

// Inngest's own endpoint — it introspects/invokes registered functions (ADR-005).
// docker-compose.local.yml's Inngest Dev Server is configured to point at this path.
app.use('/api/inngest', serve({ client: inngest, functions }));

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
