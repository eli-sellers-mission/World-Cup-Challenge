const express = require('express');
const fs = require('fs');
const path = require('path');
const { normalize } = require('./normalize');

const app = express();
const PORT = process.env.PORT || 3000;
const STATE_FILE = path.join(__dirname, 'state.json');
const FEED_CACHE_FILE = path.join(__dirname, 'feed-cache.json');
const CACHE_TTL = 60000; // 60s cache

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

// GET /api/feed - fetches & caches from OpenLigaDB
app.get('/api/feed', async (req, res) => {
  try {
    const cached = loadFeedCache();
    if (cached) {
      console.log('[FEED] Returning cached');
      return res.json(cached);
    }

    console.log('[FEED] Fetching from OpenLigaDB...');
    const response = await fetch('https://api.openligadb.de/getmatchdata/wm26/2026/3');
    if (!response.ok) throw new Error(`OpenLigaDB: ${response.status}`);
    const matches = await response.json();

    // Normalize & simplify
    const feed = matches
      .filter(m => m.MatchIsFinished)
      .map(m => ({
        group: m.Group?.GroupName || '?',
        team1: normalize(m.Team1?.TeamName),
        team2: normalize(m.Team2?.TeamName),
        goals1: m.MatchResults?.[0]?.ResultOfTeam1 ?? null,
        goals2: m.MatchResults?.[0]?.ResultOfTeam2 ?? null,
        finished: true
      }));

    saveFeedCache(feed);
    res.json(feed);
  } catch (err) {
    console.error('[FEED] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Leaderboard running on http://localhost:${PORT}`);
  console.log(`  /               → leaderboard UI`);
  console.log(`  GET /api/state  → shared pool state`);
  console.log(`  PUT /api/state  → save state`);
  console.log(`  GET /api/feed   → live results (cached 60s)`);
});
