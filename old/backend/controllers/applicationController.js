const Application = require('../models/Application');
const Opportunity = require('../models/Opportunity');

// @desc    Apply to an opportunity (Student)
// @route   POST /api/applications/:opportunityId
// @access  Private (Student)
const applyToOpportunity = async (req, res, next) => {
  try {
    const { opportunityId } = req.params;
    const { coverNote, portfolioLinks, resumeUrl } = req.body;
    const studentId = req.user._id;

    // Check if opportunity exists and is active
    const opportunity = await Opportunity.findById(opportunityId);
    if (!opportunity) {
      return res.status(404).json({
        success: false,
        message: 'Opportunity not found',
      });
    }

    if (opportunity.status === 'Closed') {
      return res.status(400).json({
        success: false,
        message: 'Applications for this opportunity are currently closed',
      });
    }

    // Check if user already applied
    const existing = await Application.findOne({ opportunityId, studentId });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted an application for this opportunity',
      });
    }

    // Handle resume from uploaded file or body
    let finalResumeUrl = resumeUrl || req.user.resumeUrl || '';
    if (req.file) {
      finalResumeUrl = `/uploads/${req.file.filename}`;
    }

    const application = await Application.create({
      opportunityId,
      studentId,
      resumeUrl: finalResumeUrl,
      coverNote: coverNote || '',
      portfolioLinks: Array.isArray(portfolioLinks)
        ? portfolioLinks
        : portfolioLinks
        ? portfolioLinks.split(',').map((l) => l.trim())
        : [],
      status: 'Applied',
      timeline: [
        {
          status: 'Applied',
          timestamp: new Date(),
          note: 'Application successfully submitted by student.',
        },
      ],
    });

    // Increment applicant count on Opportunity
    opportunity.applicantCount += 1;
    await opportunity.save();

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully!',
      application,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current student's applications (Tracker)
// @route   GET /api/applications/my
// @access  Private (Student)
const getMyApplications = async (req, res, next) => {
  try {
    const applications = await Application.find({ studentId: req.user._id })
      .populate('opportunityId')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: applications.length,
      applications,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all applications (Admin view)
// @route   GET /api/applications/admin/all
// @access  Private (Admin)
const getAllApplicationsAdmin = async (req, res, next) => {
  try {
    const { status, opportunityId } = req.query;
    const query = {};

    if (status && status !== 'All') {
      query.status = status;
    }
    if (opportunityId) {
      query.opportunityId = opportunityId;
    }

    const applications = await Application.find(query)
      .populate('opportunityId', 'title company domain type deadline')
      .populate('studentId', 'name email skills college avatar bio')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: applications.length,
      applications,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update application status & feedback (Admin)
// @route   PUT /api/applications/:id/status
// @access  Private (Admin)
const updateApplicationStatus = async (req, res, next) => {
  try {
    const { status, feedback, note } = req.body;
    const application = await Application.findById(req.params.id)
      .populate('opportunityId', 'title company')
      .populate('studentId', 'name email');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found',
      });
    }

    if (status) application.status = status;
    if (feedback !== undefined) application.feedback = feedback;

    // Append entry to timeline
    application.timeline.push({
      status: status || application.status,
      timestamp: new Date(),
      note: note || `Application status changed to ${status} by Administrator.`,
    });

    await application.save();

    res.json({
      success: true,
      message: `Application marked as ${application.status}`,
      application,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Withdraw application (Student)
// @route   DELETE /api/applications/:id
// @access  Private (Student)
const withdrawApplication = async (req, res, next) => {
  try {
    const application = await Application.findOne({
      _id: req.params.id,
      studentId: req.user._id,
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found or not owned by you',
      });
    }

    // Decrement applicant count
    await Opportunity.findByIdAndUpdate(application.opportunityId, {
      $inc: { applicantCount: -1 },
    });

    await Application.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Application withdrawn successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  applyToOpportunity,
  getMyApplications,
  getAllApplicationsAdmin,
  updateApplicationStatus,
  withdrawApplication,
};
