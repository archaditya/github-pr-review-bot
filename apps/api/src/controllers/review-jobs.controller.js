const reviewJobService = require('../services/review-job.service');

async function listByRepository(req, res, next) {
  try {
    const { repositoryId, limit, cursor } = req.query;
    const jobs = await reviewJobService.listForRepository(req.user.sub, repositoryId, {
      limit,
      cursor,
    });
    res.json({ data: jobs });
  } catch (err) {
    next(err);
  }
}

async function get(req, res, next) {
  try {
    const job = await reviewJobService.getById(req.user.sub, req.params.id);
    res.json({ data: job });
  } catch (err) {
    next(err);
  }
}

async function cancel(req, res, next) {
  try {
    const job = await reviewJobService.cancelJob(req.user.sub, req.params.id);
    res.json({ data: job });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const result = await reviewJobService.deleteJob(req.user.sub, req.params.id);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function retry(req, res, next) {
  try {
    const job = await reviewJobService.retryJob(req.user.sub, req.params.id);
    res.json({ data: job });
  } catch (err) {
    next(err);
  }
}

module.exports = { listByRepository, get, cancel, remove, retry };
