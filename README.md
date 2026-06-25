# World Cup 2026 Live Leaderboard Service

Self-hosted office pool leaderboard with live results from OpenLigaDB.

## Quick Start

### Prerequisites
- Node.js 14+

### Installation & Run

```bash
npm install
npm start
```

Visit: `http://localhost:3000`

## Architecture

- **Frontend**: `index.html` — 5 tabs (Scores, Bracket, Projections, Settings)
- **Backend**: `server.js` — Express server with 3 endpoints
- **State**: `state.json` — Shared pool state (scores, bracket picks, ratings)
- **Cache**: `feed-cache.json` — 60s cached live results from OpenLigaDB

## API Endpoints

### `GET /api/state`
Returns current leaderboard state (scores, winners, ratings, draft picks).

### `PUT /api/state`
Update leaderboard state. Body: full state object with `{scores, winners, ratings, slotOv, updatedAt}`.

### `GET /api/feed`
Fetch live group-stage results from OpenLigaDB (free, no auth required).
- Cached 60s on server
- Returns array of finished matches with normalized team names
- Frontend polls every 65s (respects "Live sync" toggle in Settings)

## Live Sync

The "Live sync" toggle in Settings enables/disables automatic result import:
- **On**: Poll OpenLigaDB every 65s, auto-import finished matches
- **Off**: Manual result entry only, no live feed interference

Manual entries are never overwritten by live feed.

## Team Name Normalization

Handles variants across different data sources:
- `USA` ↔ `United States`
- `Korea Republic` ↔ `South Korea`
- `Türkiye` ↔ `Turkey` (and more)

See `normalize.js` for full mapping.

## Deployment

### Self-hosted (PTX or any Linux/Windows server)

```bash
# Set NODE_ENV (optional)
export NODE_ENV=production

# Run with custom port
export PORT=8080
npm start
```

### Docker (optional)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## Scoring & Bracket Logic

All tournament logic (group standings, R32 qualification, bracket resolution, projections) extracted verbatim from original `wc2026_leaderboard.html`. See comments in `index.html` for details.

## File Structure

```
wc-leaderboard-service/
├── server.js          # Express server
├── normalize.js       # Team name mapping
├── test.js           # Merge logic tests
├── index.html        # Frontend UI (modified for /api/)
├── state.json        # Shared state (auto-created)
├── feed-cache.json   # Live feed cache (auto-created)
└── package.json
```

## Testing

```bash
npm test
```

Validates team name normalization and merge idempotency.
