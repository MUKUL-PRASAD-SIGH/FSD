const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const {
  getOpportunities,
  getOpportunityById,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
  toggleSaveOpportunity,
  getSavedOpportunities,
} = require('../controllers/opportunityController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Soft auth helper for public endpoints that can be enhanced by knowing the user
const softAuth = async (req, res, next) => {
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'hackelite_super_secret_jwt_key_2026'
      );
      req.user = await User.findById(decoded.id).select('-password');
    } catch (e) {
      // Ignore token failure for public routes
    }
  }
  next();
};

router.get('/', softAuth, getOpportunities);
router.get('/saved/all', protect, getSavedOpportunities);
router.get('/:id', softAuth, getOpportunityById);
router.post('/', protect, authorize('admin'), createOpportunity);
router.put('/:id', protect, authorize('admin'), updateOpportunity);
router.delete('/:id', protect, authorize('admin'), deleteOpportunity);
router.post('/:id/save', protect, toggleSaveOpportunity);

module.exports = router;
