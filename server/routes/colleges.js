// GET /api/colleges?q=  public: suggestions for the college dropdown (hidden colleges are never returned)
const router = require('express').Router();
const { asyncRoute } = require('../utils/http');
const colleges = require('../services/colleges');

router.get('/', asyncRoute(async (req, res) => {
  res.set('Cache-Control', 'public, max-age=60');
  res.json({ colleges: await colleges.search(req.query.q, { limit: req.query.limit }) });
}));

module.exports = router;
