const repositoryService = require('../services/repository.service');

async function list(req, res, next) {
  try {
    const repositories = await repositoryService.listForUser(req.user.sub);
    res.json({ data: repositories });
  } catch (err) {
    next(err);
  }
}

async function get(req, res, next) {
  try {
    const repository = await repositoryService.getForUser(req.user.sub, req.params.id);
    res.json({ data: repository });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const repository = await repositoryService.setActive(
      req.user.sub,
      req.params.id,
      req.body.isActive,
    );
    res.json({ data: repository });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, get, update };
