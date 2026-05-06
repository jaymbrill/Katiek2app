const express = require('express');
const router = express.Router();
const espn = require('../services/espn');

function handle(fn) {
  return async (req, res) => {
    try {
      const result = await fn(req);
      res.json(result);
    } catch (err) {
      console.error(err.message);
      res.status(502).json({ error: 'Unable to fetch sports data. Please try again.' });
    }
  };
}

router.get('/scores/:sport', handle(req => espn.getScores(req.params.sport)));

router.get('/standings/:sport', handle(req => espn.getStandings(req.params.sport)));

router.get('/rankings/:sport', handle(req => espn.getRankings(req.params.sport)));

router.get('/schedule/:sport', handle(req => espn.getSchedule(req.params.sport)));

router.get('/teams', (_req, res) => res.json(espn.BIG_TEN_TEAMS));

router.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

module.exports = router;
