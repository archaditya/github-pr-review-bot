const mergeService = require('../services/merge.service');

async function mergePullRequest(req, res, next) {
  try {
    const result = await mergeService.mergePullRequest(req.user.id, req.params.id, {
      mergeMethod: req.body.mergeMethod || 'merge',
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { mergePullRequest };
