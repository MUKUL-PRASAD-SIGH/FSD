const express = require('express');
const router = express.Router();
const { getAnalyticsOverview } = require('../controllers/analyticsController');

router.get('/overview', getAnalyticsOverview);

module.exports = router;
