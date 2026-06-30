const express = require('express');
const fs = require('fs');
const path = require('path');
const { normalize } = require('./normalize');

const app = express();
const PORT = process.env.PORT || 3000;
const STATE_FILE = path.join(__dirname, 'state.json');
const FEED_CACHE_FILE = path.join(__dirname, 'feed-cache.json');
const SCHEDULE_CACHE_FILE = path.join(__dirname, 'schedule-cache.json');
const CACHE_TTL = 60000; // 60s cache

const TEAM_GROUP = {
  'Czechia': 'A','Mexico': 'A','South Africa': 'A','South Korea': 'A',
  'Bosnia-Herzegovina': 'B','Canada': 'B','Qatar': 'B','Switzerland': 'B',
  'Brazil': 'C','Haiti': 'C','Morocco': 'C','Scotland': 'C',
  'Australia': 'D','Paraguay': 'D','Türkiye': 'D','United States': 'D',
  'Curaçao': 'E','Ecuador': 'E','Germany': 'E','Ivory Coast': 'E',
  'Japan': 'F','Netherlands': 'F','Sweden': 'F','Tunisia': 'F',
  'Belgium': 'G','Egypt': 'G','Iran': 'G','New Zealand': 'G',
  'Cape Verde': 'H','Saudi Arabia': 'H','Spain': 'H','Uruguay': 'H',
  'France': 'I','Iraq': 'I','Norway': 'I','Senegal': 'I',
  'Algeria': 'J','Argentina': 'J','Austria': 'J','Jordan': 'J',
  'Colombia': 'K','DR Congo': 'K','Portugal': 'K','Uzbekistan': 'K',
  'Croatia': 'L','England': 'L','Ghana': 'L','Panama': 'L'
};

app.use(express.json());
app.use(express.static(__dirname));

// Load or init state
function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  }
  return { v: 2, scores: {}, winners: {}, ratings: {}, slotOv: {}, updatedAt: 0 };
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function loadFeedCache() {
  if (fs.existsSync(FEED_CACHE_FILE)) {
    const cached = JSON.parse(fs.readFileSync(FEED_CACHE_FILE, 'utf8'));
    if (Date.now() - cached.fetchedAt < CACHE_TTL) return cached.data;
  }
  return null;
}

function saveFeedCache(data) {
  fs.writeFileSync(FEED_CACHE_FILE, JSON.stringify({ fetchedAt: Date.now(), data }, null, 2));
}

function loadScheduleCache() {
  if (fs.existsSync(SCHEDULE_CACHE_FILE)) {
    const cached = JSON.parse(fs.readFileSync(SCHEDULE_CACHE_FILE, 'utf8'));
    if (Date.now() - cached.fetchedAt < CACHE_TTL) return cached.data;
  }
  return null;
}

function saveScheduleCache(data) {
  fs.writeFileSync(SCHEDULE_CACHE_FILE, JSON.stringify({ fetchedAt: Date.now(), data }, null, 2));
}

// GET /api/state
app.get('/api/state', (req, res) => {
  const state = loadState();
  res.json(state);
});

// PUT /api/state
app.put('/api/state', (req, res) => {
  const state = req.body;
  state.updatedAt = Date.now();
  saveState(state);
  res.json({ success: true, updatedAt: state.updatedAt });
});

// World Cup 2026 group stage runs June 11–27, 2026 (fixed FIFA schedule).
// We only auto-import GROUP-STAGE results; knockout picks stay manual via the
// bracket. Restricting to these dates also prevents a later knockout rematch of
// a group pairing from overwriting the saved group result.
const ESPN_FEED_URL =
  'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260627';

// GET /api/feed - fetches & caches group results from ESPN's scoreboard API
app.get('/api/feed', async (req, res) => {
  try {
    const cached = loadFeedCache();
    if (cached) {
      console.log('[FEED] Returning cached');
      return res.json(cached);
    }

    console.log('[FEED] Fetching from ESPN...');
    const response = await fetch(ESPN_FEED_URL);
    if (!response.ok) throw new Error(`ESPN: ${response.status}`);
    const data = await response.json();
    const events = Array.isArray(data.events) ? data.events : [];

    const feed = events
      .map(ev => {
        const comp = ev.competitions && ev.competitions[0];
        if (!comp || !Array.isArray(comp.competitors)) return null;

        // 'pre' = not started. Skip it so the placeholder 0-0 of an unplayed
        // match never gets imported as a real result. 'in' (live) & 'post'
        // (final) both carry a genuine score.
        const state = comp.status && comp.status.type && comp.status.type.state;
        if (state === 'pre') return null;

        const home = comp.competitors.find(c => c.homeAway === 'home');
        const away = comp.competitors.find(c => c.homeAway === 'away');
        if (!home || !away) return null;

        const team1 = normalize(home.team && (home.team.displayName || home.team.shortDisplayName));
        const team2 = normalize(away.team && (away.team.displayName || away.team.shortDisplayName));

        const goals1 = home.score != null && home.score !== '' ? parseInt(home.score, 10) : null;
        const goals2 = away.score != null && away.score !== '' ? parseInt(away.score, 10) : null;

        // Derive group from the teams (authoritative for our pool); ESPN's own
        // group label isn't reliably present on the scoreboard payload.
        const group = TEAM_GROUP[team1] || TEAM_GROUP[team2] || null;

        return {
          group,
          team1,
          team2,
          goals1,
          goals2,
          finished: Boolean(comp.status && comp.status.type && comp.status.type.completed)
        };
      })
      .filter(m => m && m.group && m.team1 && m.team2 && m.goals1 != null && m.goals2 != null);

    saveFeedCache(feed);
    res.json(feed);
  } catch (err) {
    console.error('[FEED] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Whole-tournament window: group stage (Jun 11) through the final (Jul 19, 2026).
const ESPN_SCHEDULE_URL =
  'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719';

// GET /api/schedule - DISPLAY-ONLY feed of every game (past/live/future) across the
// whole tournament. Unlike /api/feed it keeps 'pre' games and never touches state.json;
// the UI derives the live banner, next-up game, and full schedule from this one payload.
app.get('/api/schedule', async (req, res) => {
  try {
    const cached = loadScheduleCache();
    if (cached) {
      console.log('[SCHEDULE] Returning cached');
      return res.json(cached);
    }

    console.log('[SCHEDULE] Fetching from ESPN...');
    const response = await fetch(ESPN_SCHEDULE_URL);
    if (!response.ok) throw new Error(`ESPN: ${response.status}`);
    const data = await response.json();
    const events = Array.isArray(data.events) ? data.events : [];

    const games = events
      .map(ev => {
        const comp = ev.competitions && ev.competitions[0];
        if (!comp || !Array.isArray(comp.competitors)) return null;

        const status = comp.status || {};
        const type = status.type || {};
        const state = type.state; // 'pre', 'in', 'post'

        const home = comp.competitors.find(c => c.homeAway === 'home');
        const away = comp.competitors.find(c => c.homeAway === 'away');
        if (!home || !away) return null;

        const team1 = normalize(home.team && (home.team.displayName || home.team.shortDisplayName));
        const team2 = normalize(away.team && (away.team.displayName || away.team.shortDisplayName));
        if (!team1 || !team2) return null;

        const goals1 = home.score != null && home.score !== '' ? parseInt(home.score, 10) : null;
        const goals2 = away.score != null && away.score !== '' ? parseInt(away.score, 10) : null;

        // A game is group stage iff both teams sit in the same pool. Knockout ties get
        // their round assigned below (ESPN's payload carries no reliable per-game round).
        const g1 = TEAM_GROUP[team1], g2 = TEAM_GROUP[team2];
        const group = g1 && g1 === g2 ? g1 : null;

        return {
          team1,
          team2,
          goals1,
          goals2,
          group,
          round: group ? `Group ${group}` : null,
          state: state || null,
          startDate: comp.date || ev.date || null,
          clock: status.displayClock || null,
          detail: type.shortDetail || type.description || null,
          finished: Boolean(type.completed)
        };
      })
      .filter(Boolean);

    // ESPN gives no dependable round label and its calendar is empty, so derive knockout
    // rounds from chronological order using the fixed bracket sizes. This self-corrects as
    // ESPN publishes later ties (e.g. today only R32+R16+QF exist → 28 games).
    const KNOCKOUT_LADDER = [
      ['Round of 32', 16], ['Round of 16', 8], ['Quarterfinals', 4],
      ['Semifinals', 2], ['Third place', 1], ['Final', 1]
    ];
    const ko = games.filter(g => !g.group)
      .sort((a, b) => new Date(a.startDate || 0) - new Date(b.startDate || 0));
    let i = 0;
    for (const [label, n] of KNOCKOUT_LADDER) {
      for (let k = 0; k < n && i < ko.length; k++, i++) ko[i].round = label;
    }
    for (; i < ko.length; i++) ko[i].round = 'Knockout';

    saveScheduleCache(games);
    res.json(games);
  } catch (err) {
    console.error('[SCHEDULE] Error:', err.message);
    // Degrade gracefully so the UI just hides the banner / empty schedule.
    res.json([]);
  }
});

app.listen(PORT, () => {
  console.log(`Leaderboard running on http://localhost:${PORT}`);
  console.log(`  /                  → leaderboard UI`);
  console.log(`  GET /api/state     → shared pool state`);
  console.log(`  PUT /api/state     → save state`);
  console.log(`  GET /api/feed      → group-stage results, auto-imported (cached 60s)`);
  console.log(`  GET /api/schedule  → full schedule, display-only (cached 60s)`);
});
