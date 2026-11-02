const express = require('express');
const router = express.Router();
const {
  applyToOpportunity,
  getMyApplications,
  getAllApplicationsAdmin,
  updateApplicationStatus,
  withdrawApplication,
} = require('../controllers/applicationController');
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.post(
  '/:opportunityId',
  protect,
  upload.single('resume'),
  applyToOpportunity
);
router.get('/my', protect, getMyApplications);
router.get('/admin/all', protect, authorize('admin'), getAllApplicationsAdmin);
router.put('/:id/status', protect, authorize('admin'), updateApplicationStatus);
router.delete('/:id', protect, withdrawApplication);

module.exports = router;
