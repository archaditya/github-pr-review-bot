const socialService = require('../services/social.service');

async function generateFromPR(req, res, next) {
  try {
    const posts = await socialService.generateFromPR(req.user.id, req.body.pullRequestId);
    res.status(201).json(posts);
  } catch (err) {
    next(err);
  }
}

async function generateStandalone(req, res, next) {
  try {
    const posts = await socialService.generateStandalone(req.user.id, req.body);
    res.status(201).json(posts);
  } catch (err) {
    next(err);
  }
}

async function getPostsForPR(req, res, next) {
  try {
    const posts = await socialService.getPostsForPR(req.user.id, req.params.prId);
    res.json(posts);
  } catch (err) {
    next(err);
  }
}

async function listRecent(req, res, next) {
  try {
    const posts = await socialService.listRecent({
      limit: parseInt(req.query.limit, 10) || 20,
      cursor: req.query.cursor,
    });
    res.json(posts);
  } catch (err) {
    next(err);
  }
}

async function updateDraft(req, res, next) {
  try {
    const post = await socialService.updateDraft(req.user.id, req.params.id, req.body);
    res.json(post);
  } catch (err) {
    next(err);
  }
}

async function publishAll(req, res, next) {
  try {
    const results = await socialService.publishAll(req.user.id, req.body.postIds);
    res.json(results);
  } catch (err) {
    next(err);
  }
}

async function publishPost(req, res, next) {
  try {
    const results = await socialService.publishPost(req.user.id, req.params.id);
    res.json(results);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  generateFromPR,
  generateStandalone,
  getPostsForPR,
  listRecent,
  updateDraft,
  publishAll,
  publishPost,
};
