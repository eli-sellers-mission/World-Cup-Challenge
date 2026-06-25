# Implementation Verification Checklist

Use this checklist to verify all components are correctly installed and working.

## File Structure ✓
- [x] package.json — Dependencies configuration
- [x] server.js — Express server with /api endpoints
- [x] normalize.js — Team name mapping (48 teams)
- [x] index.html — Modified frontend with fetch API
- [x] test.js — Merge logic tests
- [x] .env.example — Environment template
- [x] README.md — Full documentation
- [x] DEPLOYMENT.md — PTX deployment guide

## Backend API Endpoints

### GET /api/state
**Purpose**: Retrieve current pool state
**Response**: 
```json
{
  "v": 2,
  "scores": {"A-0-1": {"h": 2, "a": 1}, ...},
  "winners": {"73": "USA", ...},
  "ratings": {"Spain": 2100, ...},
  "slotOv": {},
  "updatedAt": 1704067200000
}
```

### PUT /api/state
**Purpose**: Save pool state
**Body**: Full state object (same structure as GET response)
**Response**: `{"success": true, "updatedAt": 1704067200000}`

### GET /api/feed
**Purpose**: Fetch live results from OpenLigaDB (cached 60s)
**Response**:
```json
[
  {
    "group": "A",
    "team1": "Mexico",
    "team2": "South Africa",
    "goals1": 2,
    "goals2": 0,
    "finished": true
  }
]
```

## Frontend Features

### Scores Tab
- Manual entry of group match results
- Stepper inputs for each match
- Saves on every change

### Bracket Tab
- R32 (Round of 32) bracket
- Click-to-select winner for each match
- Auto-populates from group standings
- Knockout bracket flows through Finals

### Projections Tab
- Monte Carlo simulation (1000+ runs)
- Editable power ratings drive predictions
- Updates on every manual change
- Shows win probability for each team

### Settings Tab
- **Live sync toggle** (NEW) — Auto-import results from OpenLigaDB
- Power ratings editor — Edit team strength ratings
- Reset ratings button — Restore defaults

## Live Feed System

### Polling
- Runs every 65 seconds (when Live sync = ON)
- Fetches from /api/feed
- Server caches for 60s

### Merge Logic
1. Match feed results by group + team names
2. Normalize team names (USA → United States, etc.)
3. Handle reverse matchups (team1 vs team2 swapped)
4. Only apply finished matches
5. Idempotent (safe to run multiple times)
6. Never overwrite manual entries

### Example Flow
1. OpenLigaDB: "Mexico 2 - 0 South Africa"
2. Server normalizes, caches
3. Browser polls /api/feed
4. Matches fixture "A-0-1" (Mexico vs South Africa)
5. Sets state.scores["A-0-1"] = {h: 2, a: 0}
6. Recalculates standings and bracket
7. Re-renders UI

## Scoring Logic (Extracted from Original HTML)

### Group Stage
- 3 pts: Win
- 1 pt: Draw
- 0 pts: Loss
- Teams ranked by: pts, goal diff, goals for

### Qualification
- Group winners (12 teams)
- Group runners-up (12 teams)
- Best third-place teams (4 teams)
- Total: 32 teams → Round of 32

### Knockout
- R32: 4 pts per win
- R16: 6 pts per win
- QF: 8 pts per win
- SF: 10 pts per win
- 3rd Place: 3 pts
- Final: 14 pts per win

### Draft Picks
- 8 drafters assigned to 2-letter abbreviations
- Each drafter owns 6 teams
- Leaderboard scores based on team performance

## State Persistence

**Where**: `state.json` (auto-created on first save)

**Format**: Human-readable JSON
- `scores`: Group match results {matchId: {h, a}}
- `winners`: Bracket winners {matchNum: teamName}
- `ratings`: Edited power ratings {teamName: rating}
- `slotOv`: Override assignments (advanced)
- `updatedAt`: Unix timestamp of last change
- `v`: Schema version (always 2)

**Reliability**:
- Auto-saved on every change via PUT /api/state
- Survives server restart
- Can be edited directly if needed
- Backed up by periodic snapshots

## Error Handling

### If Live sync fails
- No error on screen
- Check browser console (F12)
- Check server logs
- Manual entry still works
- Toggle Live sync OFF/ON to retry

### If server fails
- State persists in `state.json`
- Manual entry still works (locally)
- Rejoin when server is back up

## Team Name Normalization Examples

| OpenLigaDB | Canonical |
|---|---|
| Korea Republic | South Korea |
| Côte d'Ivoire | Ivory Coast |
| Türkiye | Türkiye |
| Curaçao | Curaçao |
| Bosnia and Herzegovina | Bosnia-Herzegovina |
| Congo DR | DR Congo |
| USA | United States |

(See normalize.js for full mapping of 48 teams)

## Performance Notes

- Group stage results: ~40-50 API calls (72 matches)
- Knockout: ~35-40 matches
- Live feed polling: Every 65s (configurable)
- Cache: 60s on server
- Typical state.json size: 2-5 KB
- Projections: 1-2s compute time (1000 simulations)

## Next Steps After Deployment

1. [ ] Copy wc-leaderboard-service to deployment server
2. [ ] Run `npm install`
3. [ ] Set PORT and NODE_ENV environment variables
4. [ ] Run `npm start` or configure with PM2/systemd
5. [ ] Access http://localhost:3000 (or configured port)
6. [ ] Have 8 drafters open the same URL
7. [ ] Enter initial group match results manually
8. [ ] Toggle Live sync ON to auto-import OpenLigaDB results
9. [ ] Make bracket picks as tournament progresses
10. [ ] Verify leaderboard updates in real-time across all browsers
