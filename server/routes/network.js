const router = require('express').Router();
const { protect, requirePro } = require('../middleware/auth');
const { asyncRoute } = require('../utils/http');
const social = require('../services/social');
const teams = require('../services/teams');
const match = require('../services/teamMatch');

router.use(protect);

// Everything the Network page needs in one call: connections, pending requests both ways, and invitations
router.get('/overview', asyncRoute(async (req, res) => {
  const [o, invites] = await Promise.all([social.overview(req.user), teams.invitesFor(req.user)]);
  res.json({ ...o, invites });
}));

// Free: find people by name among those who opted in to being found. Pro: plain-English search ("react designers looking for a team").
router.get('/people', asyncRoute(async (req, res) => {
  res.json({ people: await match.searchPeople(req.user, req.query.q, { pro: req.user.isPro() }), smart: req.user.isPro() });
}));

// Send a connection request by id (from search/recommendations) or by exact email. By email the answer never reveals whether the
// address has an account.
const SENT = { ok: true, message: 'If that person is on HackElite, they have been sent your request.' };
router.post('/requests', asyncRoute(async (req, res) => {
  const { userId, email, message } = req.body || {};
  const target = await social.findTarget({ userId, email });
  if (userId) {
    if (!target) return res.status(404).json({ error: 'Person not found' });
    const r = await social.request(req.user, target, { message });
    return res.json({ ok: true, status: r.status });
  }
  if (target && String(target._id) !== String(req.user._id) && !(await social.isBlocked(req.user._id, target._id))) await social.request(req.user, target, { message }).catch(() => {});
  res.json(SENT);
}));
router.post('/requests/:id/accept', asyncRoute(async (req, res) => { await social.accept(req.params.id, req.user); res.json({ ok: true }); }));
router.post('/requests/:id/decline', asyncRoute(async (req, res) => { await social.decline(req.params.id, req.user); res.json({ ok: true }); }));
router.delete('/requests/:id', asyncRoute(async (req, res) => { await social.cancel(req.params.id, req.user); res.json({ ok: true }); }));
router.delete('/connections/:userId', asyncRoute(async (req, res) => { await social.remove(req.user, req.params.userId); res.json({ ok: true }); }));

router.get('/blocked', asyncRoute(async (req, res) => res.json({ blocked: await social.blockedList(req.user) })));
router.post('/block', asyncRoute(async (req, res) => { await social.block(req.user, req.body?.userId); res.json({ ok: true }); }));
router.delete('/block/:userId', asyncRoute(async (req, res) => { await social.unblock(req.user, req.params.userId); res.json({ ok: true }); }));

// Invitations (team invites, join requests to my teams, room invites)
router.post('/invites/:id/accept', asyncRoute(async (req, res) => res.json(await teams.respond(req.params.id, req.user, true))));
router.post('/invites/:id/decline', asyncRoute(async (req, res) => res.json(await teams.respond(req.params.id, req.user, false))));
router.delete('/invites/:id', asyncRoute(async (req, res) => { await teams.cancelInvite(req.params.id, req.user); res.json({ ok: true }); }));

// Pro: the recommendation engine for people and teams
router.get('/recommendations/teammates', requirePro, asyncRoute(async (req, res) => {
  const limit = Math.min(20, parseInt(req.query.limit, 10) || 8);
  res.json({ discoverable: !!req.user.social?.discoverable, teammates: await match.recommendTeammates(req.user, { limit }) });
}));
router.get('/recommendations/teams', requirePro, asyncRoute(async (req, res) => {
  const limit = Math.min(20, parseInt(req.query.limit, 10) || 8);
  res.json({ teams: await match.recommendTeams(req.user, { limit }) });
}));

module.exports = router;
