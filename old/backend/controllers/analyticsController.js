const Opportunity = require('../models/Opportunity');
const Application = require('../models/Application');
const User = require('../models/User');

// @desc    Get comprehensive system analytics & KPIs
// @route   GET /api/analytics/overview
// @access  Public / Private
const getAnalyticsOverview = async (req, res, next) => {
  try {
    const { domain, locationType, type } = req.query;

    const oppFilter = {};
    if (domain && domain !== 'All') oppFilter.domain = domain;
    if (locationType && locationType !== 'All') oppFilter.locationType = locationType;
    if (type && type !== 'All') oppFilter.type = type;

    // High level counts
    const totalOpportunities = await Opportunity.countDocuments(oppFilter);
    const activeOpportunities = await Opportunity.countDocuments({
      ...oppFilter,
      status: 'Active',
    });
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalApplications = await Application.countDocuments();

    // Accepted count for success rate
    const acceptedApplications = await Application.countDocuments({ status: 'Accepted' });
    const acceptanceRate = totalApplications > 0
      ? ((acceptedApplications / totalApplications) * 100).toFixed(1)
      : '0.0';

    // Domain distribution
    const domainBreakdown = await Opportunity.aggregate([
      { $match: oppFilter },
      { $group: { _id: '$domain', count: { $sum: 1 }, totalApplicants: { $sum: '$applicantCount' } } },
      { $sort: { count: -1 } },
    ]);

    // Type distribution
    const typeBreakdown = await Opportunity.aggregate([
      { $match: oppFilter },
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Location distribution
    const locationBreakdown = await Opportunity.aggregate([
      { $match: oppFilter },
      { $group: { _id: '$locationType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Application status funnel
    const applicationStatusFunnel = await Application.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Top companies posting opportunities
    const topCompanies = await Opportunity.aggregate([
      { $match: oppFilter },
      { $group: { _id: '$company', count: { $sum: 1 }, totalApplicants: { $sum: '$applicantCount' } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]);

    // Upcoming deadlines in next 30 days
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    const upcomingDeadlines = await Opportunity.find({
      ...oppFilter,
      deadline: { $gte: now, $lte: thirtyDaysFromNow },
      status: 'Active',
    })
      .select('title company deadline type domain reward')
      .sort({ deadline: 1 })
      .limit(8);

    res.json({
      success: true,
      kpis: {
        totalOpportunities,
        activeOpportunities,
        totalStudents,
        totalApplications,
        acceptanceRate: `${acceptanceRate}%`,
      },
      charts: {
        domainBreakdown: domainBreakdown.map((d) => ({ label: d._id, count: d.count, applicants: d.totalApplicants })),
        typeBreakdown: typeBreakdown.map((t) => ({ label: t._id, count: t.count })),
        locationBreakdown: locationBreakdown.map((l) => ({ label: l._id, count: l.count })),
        applicationStatusFunnel: applicationStatusFunnel.map((a) => ({ status: a._id, count: a.count })),
        topCompanies: topCompanies.map((c) => ({ company: c._id, listings: c.count, applicants: c.totalApplicants })),
      },
      upcomingDeadlines,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAnalyticsOverview };
