const Team = require('../models/Team');

// @desc    Create a new team
// @route   POST /api/teams
// @access  Private (Student)
const createTeam = async (req, res, next) => {
  try {
    const {
      name,
      opportunityId,
      description,
      skillsSeeking,
      maxMembers,
      projectPitch,
    } = req.body;

    let attachmentUrl = '';
    if (req.file) {
      attachmentUrl = `/uploads/${req.file.filename}`;
    }

    const team = await Team.create({
      name,
      leaderId: req.user._id,
      opportunityId: opportunityId || null,
      description: description || '',
      skillsSeeking: Array.isArray(skillsSeeking)
        ? skillsSeeking
        : skillsSeeking
        ? skillsSeeking.split(',').map((s) => s.trim())
        : [],
      maxMembers: maxMembers ? parseInt(maxMembers) : 4,
      projectPitch: projectPitch || '',
      attachmentUrl,
      members: [
        {
          user: req.user._id,
          roleTitle: 'Team Leader',
          joinedAt: new Date(),
        },
      ],
    });

    const populatedTeam = await Team.findById(team._id)
      .populate('leaderId', 'name email skills college avatar')
      .populate('members.user', 'name email skills college avatar')
      .populate('opportunityId', 'title company deadline');

    res.status(201).json({
      success: true,
      message: 'Team successfully created!',
      team: populatedTeam,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all teams
// @route   GET /api/teams
// @access  Public / Private
const getTeams = async (req, res, next) => {
  try {
    const { opportunityId, skill, search } = req.query;
    const query = {};

    if (opportunityId) {
      query.opportunityId = opportunityId;
    }
    if (skill) {
      query.skillsSeeking = { $regex: new RegExp(skill, 'i') };
    }
    if (search) {
      const reg = new RegExp(search, 'i');
      query.$or = [{ name: reg }, { description: reg }, { skillsSeeking: reg }];
    }

    const teams = await Team.find(query)
      .populate('leaderId', 'name email college avatar')
      .populate('members.user', 'name email college avatar skills')
      .populate('opportunityId', 'title company type deadline')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: teams.length,
      teams,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single team by ID
// @route   GET /api/teams/:id
// @access  Public / Private
const getTeamById = async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('leaderId', 'name email college avatar bio skills')
      .populate('members.user', 'name email college avatar bio skills')
      .populate('requests.user', 'name email college avatar bio skills')
      .populate('opportunityId');

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found',
      });
    }

    res.json({
      success: true,
      team,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send a request to join a team
// @route   POST /api/teams/:id/request
// @access  Private (Student)
const requestToJoinTeam = async (req, res, next) => {
  try {
    const { message } = req.body;
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found',
      });
    }

    // Check if team is full
    if (team.members.length >= team.maxMembers) {
      return res.status(400).json({
        success: false,
        message: 'This team has already reached its member capacity',
      });
    }

    // Check if user is already a member
    const isMember = team.members.some(
      (m) => m.user.toString() === req.user._id.toString()
    );
    if (isMember) {
      return res.status(400).json({
        success: false,
        message: 'You are already a member of this team',
      });
    }

    // Check if already requested
    const existingReq = team.requests.find(
      (r) => r.user.toString() === req.user._id.toString()
    );
    if (existingReq) {
      return res.status(400).json({
        success: false,
        message: `You already have a pending or processed request (${existingReq.status})`,
      });
    }

    team.requests.push({
      user: req.user._id,
      message: message || `Hi, I would love to join your team with my skills!`,
      status: 'pending',
      requestedAt: new Date(),
    });

    await team.save();

    res.json({
      success: true,
      message: 'Join request sent to team leader!',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Team leader accepts or rejects join request
// @route   PUT /api/teams/:id/requests/:requestId
// @access  Private (Team Leader)
const manageJoinRequest = async (req, res, next) => {
  try {
    const { status, roleTitle } = req.body; // status: 'accepted' or 'rejected'
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found',
      });
    }

    // Must be leader
    if (team.leaderId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the team leader can manage join requests',
      });
    }

    const request = team.requests.id(req.params.requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found',
      });
    }

    request.status = status;

    if (status === 'accepted') {
      if (team.members.length >= team.maxMembers) {
        return res.status(400).json({
          success: false,
          message: 'Team is already full',
        });
      }

      team.members.push({
        user: request.user,
        roleTitle: roleTitle || 'Member',
        joinedAt: new Date(),
      });

      if (team.members.length >= team.maxMembers) {
        team.status = 'Full';
      }
    }

    await team.save();

    res.json({
      success: true,
      message: `Request has been marked as ${status}`,
      team,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTeam,
  getTeams,
  getTeamById,
  requestToJoinTeam,
  manageJoinRequest,
};
