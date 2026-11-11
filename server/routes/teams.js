const router = require('express').Router();
const Team = require('../models/Team');
const Idea = require('../models/Idea');
const { protect, requirePro } = require('../middleware/auth');
const { asyncRoute } = require('../utils/http');
const teams = require('../services/teams');
const social = require('../services/social');

const { fail, oid } = social;
router.use(protect);

router.get('/', asyncRoute(async (req, res) => res.json({ teams: await teams.listMine(req.user) })));
router.post('/', asyncRoute(async (req, res) => {
  const team = await teams.createTeam(req.user, req.body || {});
  res.status(201).json({ team: await teams.view(team, req.user) });
}));

// Tracker -> "share this hackathon with a teammate": finds or creates your team for it, then invites (id or email)
router.post('/share', asyncRoute(async (req, res) => res.json(await teams.shareListing(req.user, req.body || {}))));

router.get('/:id', asyncRoute(async (req, res) => res.json({ team: await teams.view(await teams.loadTeam(req.params.id, req.user), req.user) })));
router.put('/:id', asyncRoute(async (req, res) => {
  const team = await teams.loadTeam(req.params.id, req.user, { owner: true });
  await teams.update(team, req.user, req.body || {});
  res.json({ team: await teams.view(team, req.user) });
}));
router.delete('/:id', asyncRoute(async (req, res) => { await teams.disband(await teams.loadTeam(req.params.id, req.user, { owner: true })); res.json({ ok: true }); }));

router.post('/:id/invite', asyncRoute(async (req, res) => {
  const team = await teams.loadTeam(req.params.id, req.user, { owner: true });
  res.json(await teams.inviteToTeam(team, req.user, req.body || {}));
}));
router.post('/:id/leave', asyncRoute(async (req, res) => { await teams.leave(await teams.loadTeam(req.params.id, req.user), req.user); res.json({ ok: true }); }));
router.delete('/:id/members/:userId', asyncRoute(async (req, res) => {
  const team = await teams.loadTeam(req.params.id, req.user, { owner: true });
  await teams.removeMember(team, req.user, req.params.userId); res.json({ ok: true });
}));
router.post('/:id/transfer', asyncRoute(async (req, res) => {
  const team = await teams.loadTeam(req.params.id, req.user, { owner: true });
  await teams.transfer(team, req.user, req.body?.userId); res.json({ ok: true });
}));

// Pro: ask to join a public team
router.post('/:id/request', requirePro, asyncRoute(async (req, res) => {
  const team = oid(req.params.id) ? await Team.findById(req.params.id) : null;
  if (!team) throw fail(404, 'Team not found');
  res.json(await teams.requestToJoin(team, req.user, req.body?.message));
}));

// ---- Pro: idea board with ranked voting (rank 1 = 10 points, rank 2 = 5 points; two votes per member per team)
const POINTS = { 1: 10, 2: 5 };
const shapeIdea = (i, uid) => {
  const mine = i.votes.find((v) => String(v.user) === String(uid));
  return { id: String(i._id), title: i.title, description: i.description, author: String(i.author), score: i.votes.reduce((n, v) => n + (v.points || 0), 0), voteCount: i.votes.length, myRank: mine?.rank || null, at: i.createdAt };
};
router.get('/:id/ideas', requirePro, asyncRoute(async (req, res) => {
  const team = await teams.loadTeam(req.params.id, req.user);
  const ideas = await Idea.find({ team: team._id }).lean();
  res.json({ ideas: ideas.map((i) => shapeIdea(i, req.user._id)).sort((a, b) => b.score - a.score || new Date(a.at) - new Date(b.at)) });
}));
router.post('/:id/ideas', requirePro, asyncRoute(async (req, res) => {
  const team = await teams.loadTeam(req.params.id, req.user);
  if ((await Idea.countDocuments({ team: team._id, author: req.user._id })) >= 5) throw fail(400, 'Each member can add up to 5 ideas');
  const i = await Idea.create({ team: team._id, author: req.user._id, title: String(req.body?.title || '').trim(), description: String(req.body?.description || '').slice(0, 500) });
  res.status(201).json({ idea: shapeIdea(i, req.user._id) });
}));
router.post('/:id/ideas/:ideaId/vote', requirePro, asyncRoute(async (req, res) => {
  const team = await teams.loadTeam(req.params.id, req.user);
  const rank = Number(req.body?.rank);
  if (!POINTS[rank]) throw fail(400, 'Vote with rank 1 (10 points) or rank 2 (5 points)');
  const idea = oid(req.params.ideaId) ? await Idea.findOne({ _id: req.params.ideaId, team: team._id }) : null;
  if (!idea) throw fail(404, 'Idea not found');
  if (String(idea.author) === String(req.user._id)) throw fail(400, 'You cannot vote for your own idea');
  // a member has one vote per rank per team, and cannot rank the same idea twice: moving a vote removes the old one
  await Idea.updateMany({ team: team._id }, { $pull: { votes: { user: req.user._id, rank } } });
  await Idea.updateOne({ _id: idea._id }, { $pull: { votes: { user: req.user._id } } });
  await Idea.updateOne({ _id: idea._id }, { $push: { votes: { user: req.user._id, rank, points: POINTS[rank] } } });
  const ideas = await Idea.find({ team: team._id }).lean();
  res.json({ ideas: ideas.map((i) => shapeIdea(i, req.user._id)).sort((a, b) => b.score - a.score) });
}));
router.delete('/:id/ideas/:ideaId', requirePro, asyncRoute(async (req, res) => {
  const team = await teams.loadTeam(req.params.id, req.user);
  const idea = oid(req.params.ideaId) ? await Idea.findOne({ _id: req.params.ideaId, team: team._id }) : null;
  if (!idea) throw fail(404, 'Idea not found');
  if (String(idea.author) !== String(req.user._id) && !teams.isOwner(team, req.user._id)) throw fail(403, 'Only the author or the team owner can delete an idea');
  await idea.deleteOne(); res.json({ ok: true });
}));

module.exports = router;
