const Opportunity = require('../models/Opportunity');
const SavedItem = require('../models/SavedItem');
const Application = require('../models/Application');

// @desc    Get all opportunities with search, filter, and sort
// @route   GET /api/opportunities
// @access  Public / Private
const getOpportunities = async (req, res, next) => {
  try {
    const {
      search,
      domain,
      type,
      locationType,
      status,
      sort = 'deadline_asc',
    } = req.query;

    const queryObj = {};

    // Filter by domain
    if (domain && domain !== 'All') {
      queryObj.domain = domain;
    }

    // Filter by type
    if (type && type !== 'All') {
      queryObj.type = type;
    }

    // Filter by location type
    if (locationType && locationType !== 'All') {
      queryObj.locationType = locationType;
    }

    // Filter by status (default active unless specified)
    if (status && status !== 'All') {
      queryObj.status = status;
    }

    // Keyword Search across title, description, company, skills
    if (search && search.trim() !== '') {
      const regex = new RegExp(search.trim(), 'i');
      queryObj.$or = [
        { title: regex },
        { company: regex },
        { description: regex },
        { skillsRequired: regex },
        { tags: regex },
      ];
    }

    // Sorting logic
    let sortOption = {};
    if (sort === 'deadline_asc') sortOption = { deadline: 1 };
    else if (sort === 'deadline_desc') sortOption = { deadline: -1 };
    else if (sort === 'newest') sortOption = { createdAt: -1 };
    else if (sort === 'popularity') sortOption = { applicantCount: -1 };
    else sortOption = { deadline: 1 };

    const opportunities = await Opportunity.find(queryObj)
      .populate('postedBy', 'name email')
      .sort(sortOption);

    res.json({
      success: true,
      count: opportunities.length,
      opportunities,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single opportunity by ID
// @route   GET /api/opportunities/:id
// @access  Public / Private
const getOpportunityById = async (req, res, next) => {
  try {
    const opportunity = await Opportunity.findById(req.params.id).populate(
      'postedBy',
      'name email'
    );

    if (!opportunity) {
      return res.status(404).json({
        success: false,
        message: 'Opportunity not found',
      });
    }

    // Check if user is logged in to return their personal applied/saved status
    let userApplication = null;
    let isSaved = false;

    if (req.user) {
      userApplication = await Application.findOne({
        opportunityId: opportunity._id,
        studentId: req.user._id,
      });

      const saved = await SavedItem.findOne({
        opportunityId: opportunity._id,
        studentId: req.user._id,
      });
      isSaved = !!saved;
    }

    res.json({
      success: true,
      opportunity,
      userStatus: {
        applied: !!userApplication,
        application: userApplication,
        isSaved,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new opportunity (Admin only)
// @route   POST /api/opportunities
// @access  Private (Admin)
const createOpportunity = async (req, res, next) => {
  try {
    const {
      title,
      company,
      description,
      type,
      domain,
      locationType,
      locationName,
      reward,
      deadline,
      startDate,
      eligibility,
      skillsRequired,
      tags,
      bannerImage,
      status,
    } = req.body;

    const newOpportunity = await Opportunity.create({
      title,
      company,
      description,
      type,
      domain,
      locationType,
      locationName: locationName || 'Global',
      reward: reward || 'Certificates & Prizes',
      deadline,
      startDate,
      eligibility,
      skillsRequired: Array.isArray(skillsRequired)
        ? skillsRequired
        : skillsRequired
        ? skillsRequired.split(',').map((s) => s.trim())
        : [],
      tags: Array.isArray(tags)
        ? tags
        : tags
        ? tags.split(',').map((t) => t.trim())
        : [],
      bannerImage: bannerImage || '',
      status: status || 'Active',
      postedBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: 'Opportunity created successfully',
      opportunity: newOpportunity,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update an opportunity (Admin only)
// @route   PUT /api/opportunities/:id
// @access  Private (Admin)
const updateOpportunity = async (req, res, next) => {
  try {
    let opportunity = await Opportunity.findById(req.params.id);

    if (!opportunity) {
      return res.status(404).json({
        success: false,
        message: 'Opportunity not found',
      });
    }

    // Format skills and tags if provided as comma-separated string
    const updateData = { ...req.body };
    if (updateData.skillsRequired && !Array.isArray(updateData.skillsRequired)) {
      updateData.skillsRequired = updateData.skillsRequired
        .split(',')
        .map((s) => s.trim());
    }
    if (updateData.tags && !Array.isArray(updateData.tags)) {
      updateData.tags = updateData.tags.split(',').map((t) => t.trim());
    }

    opportunity = await Opportunity.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Opportunity updated successfully',
      opportunity,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete an opportunity (Admin only)
// @route   DELETE /api/opportunities/:id
// @access  Private (Admin)
const deleteOpportunity = async (req, res, next) => {
  try {
    const opportunity = await Opportunity.findById(req.params.id);

    if (!opportunity) {
      return res.status(404).json({
        success: false,
        message: 'Opportunity not found',
      });
    }

    await Opportunity.findByIdAndDelete(req.params.id);
    // Cleanup cascade
    await Application.deleteMany({ opportunityId: req.params.id });
    await SavedItem.deleteMany({ opportunityId: req.params.id });

    res.json({
      success: true,
      message: 'Opportunity and linked records deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle save/bookmark opportunity (Student)
// @route   POST /api/opportunities/:id/save
// @access  Private (Student/Admin)
const toggleSaveOpportunity = async (req, res, next) => {
  try {
    const opportunityId = req.params.id;
    const studentId = req.user._id;

    const existing = await SavedItem.findOne({ opportunityId, studentId });

    if (existing) {
      await SavedItem.findByIdAndDelete(existing._id);
      return res.json({
        success: true,
        saved: false,
        message: 'Opportunity removed from bookmarks',
      });
    } else {
      await SavedItem.create({ opportunityId, studentId });
      return res.json({
        success: true,
        saved: true,
        message: 'Opportunity saved to bookmarks',
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Get all saved opportunities for current student
// @route   GET /api/opportunities/saved/all
// @access  Private
const getSavedOpportunities = async (req, res, next) => {
  try {
    const saved = await SavedItem.find({ studentId: req.user._id })
      .populate('opportunityId')
      .sort({ savedAt: -1 });

    const opportunities = saved
      .filter((s) => s.opportunityId) // filter out deleted
      .map((s) => ({
        ...s.opportunityId._doc,
        savedAt: s.savedAt,
      }));

    res.json({
      success: true,
      count: opportunities.length,
      opportunities,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOpportunities,
  getOpportunityById,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
  toggleSaveOpportunity,
  getSavedOpportunities,
};
