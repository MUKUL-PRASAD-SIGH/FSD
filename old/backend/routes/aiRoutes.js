const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { chatWithAi } = require('../controllers/aiController');

// Soft auth helper to recognize user for personalization if token provided
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
      // Ignore invalid token on open AI endpoint
    }
  }
  next();
};

router.post('/chat', softAuth, chatWithAi);

module.exports = router;
