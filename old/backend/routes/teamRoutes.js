const express = require('express');
const router = express.Router();
const {
  createTeam,
  getTeams,
  getTeamById,
  requestToJoinTeam,
  manageJoinRequest,
} = require('../controllers/teamController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.get('/', getTeams);
router.post('/', protect, upload.single('attachment'), createTeam);
router.get('/:id', getTeamById);
router.post('/:id/request', protect, requestToJoinTeam);
router.put('/:id/requests/:requestId', protect, manageJoinRequest);

module.exports = router;
