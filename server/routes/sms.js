// POST /api/sms/inbound  Twilio webhook for replies. Point your Twilio number / Messaging Service / WhatsApp sender's
// "incoming message" webhook at  <APP_URL>/api/sms/inbound.  Requests are rejected unless the X-Twilio-Signature
// matches (signed with your auth token over APP_URL + path + params).
// STOP / UNSUBSCRIBE / CANCEL / END / QUIT turn reminders off; START / UNSTOP turn them back on.
const router = require('express').Router();
const express = require('express');
const User = require('../models/User');
const { asyncRoute } = require('../utils/http');
const sms = require('../services/sms');
const { audit } = require('../services/audit');
const { config } = require('../config/env');

const STOP = /^(stop|stopall|unsubscribe|cancel|end|quit)$/i;
const START = /^(start|unstop|yes)$/i;
const twiml = (res, msg) => res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?><Response>${msg ? `<Message>${msg}</Message>` : ''}</Response>`);

router.post('/inbound', express.urlencoded({ extended: false, limit: '20kb' }), asyncRoute(async (req, res) => {
  const url = `${String(config.appUrl).replace(/\/$/, '')}/api/sms/inbound`;
  if (!sms.validSignature(req.get('X-Twilio-Signature'), url, req.body || {})) return res.status(403).send('invalid signature');
  const from = String(req.body.From || '').replace(/^whatsapp:/, '');
  const word = String(req.body.Body || '').trim().split(/\s+/)[0] || '';
  const user = from ? await User.findOne({ 'phone.number': from, 'phone.verifiedAt': { $ne: null } }) : null;
  if (!user) return twiml(res);
  if (STOP.test(word)) {
    user.notify.smsReminders = false; await user.save();
    audit(req, 'phone.sms_stop', { actor: user, target: user._id });
    return twiml(res, 'HackElite reminders are off. Reply START to turn them back on.');
  }
  if (START.test(word)) {
    user.notify.smsReminders = true; await user.save();
    audit(req, 'phone.sms_start', { actor: user, target: user._id });
    return twiml(res, 'HackElite deadline reminders are back on. Reply STOP to stop.');
  }
  return twiml(res);
}));

module.exports = router;
