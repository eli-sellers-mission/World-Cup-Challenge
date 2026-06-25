# WC 2026 Leaderboard - Render Deployment Guide

This project is a Node.js web app with a static frontend and a small backend API. Render is a good fit because it can host both the frontend and the backend together.

## Prerequisites
- Node.js 16+ locally if you want to test before deploy
- GitHub repo (for Render to connect)
- Internet access for live feed polling

## Local Setup (5 min)

### 1. Install Dependencies
```bash
cd wc-leaderboard-service
npm install
```

### 2. Run Server Locally
```bash
npm start
# Server starts on http://localhost:3000
```

### 3. Test Locally
- Open browser: `http://localhost:3000`
- Enter sample group scores manually
- Toggle "Live sync" ON in Settings
- Verify live results appear within 65s

## Render Deployment

### 1. Create a GitHub repo
- Create a new GitHub repository for `wc-leaderboard-service`.
- Push the folder contents to that repo.
- Ensure these files are included: `package.json`, `server.js`, `index.html`, `normalize.js`, `render.yaml`, `.gitignore`.

### 2. Connect to Render
- Sign in at https://render.com using GitHub.
- Click **New** → **Web Service**.
- Select your GitHub repo.

### 3. Configure the service
- **Name:** `wc-leaderboard-service`
- **Environment:** `Node`
- **Branch:** `main` (or your chosen branch)
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Publish Directory:** leave blank
- **Instance Type:** `Free` (if available)

### 4. Environment variables
Render automatically provides `PORT`.
Optionally add:
- `NODE_ENV=production`

### 5. Deploy
- Click **Create Web Service**.
- Wait for the build and deploy to finish.
- Open the public URL Render provides.

### 6. Verify
- Visit the Render URL.
- Open DevTools and ensure there are no 404 errors.
- Confirm `/api/state` returns JSON.
- Toggle Live sync in Settings and verify it polls successfully.

## Notes
- `server.js` serves `index.html` and exposes `/api/state` and `/api/feed`.
- `state.json` is created automatically on first save.
- `feed-cache.json` is used for server-side caching of the live feed.

## Optional: Docker on Render
Render can deploy this app using the provided `Dockerfile`.
If you choose Docker:
- Select **Docker** as the environment type in Render
- Use the same GitHub repo
- Render will build from `Dockerfile`

## State Persistence

- `state.json` — automatically created, stores all leaderboard data
- Backed up on every save
- Human-readable JSON (can edit directly if needed)

Example:
```json
{
  "v": 2,
  "scores": {
    "A-0-1": {"h": 2, "a": 1},
    "A-0-2": {"h": 3, "a": 0}
  },
  "winners": {
    "73": "USA",
    "74": "Brazil"
  },
  "ratings": {
    "Spain": 2100,
    "USA": 1850
  },
  "slotOv": {},
  "updatedAt": 1704067200000
}
```

## API Usage

### Get Current State
```bash
curl http://localhost:3000/api/state
```

### Update State
```bash
curl -X PUT http://localhost:3000/api/state \
  -H "Content-Type: application/json" \
  -d @state.json
```

### Fetch Live Feed
```bash
curl http://localhost:3000/api/feed
```

Returns:
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

## Troubleshooting

### Port Already in Use
```bash
PORT=3001 npm start
```

### Feed Not Updating
1. Check server logs: `npm start` (should show FEED output)
2. Verify Internet connection
3. Toggle "Live sync" OFF and ON in Settings

### State Not Persisting
- Ensure write permissions in service directory
- Check disk space
- Look for `state.json` file

## Support

- All scoring logic matches original wc2026_leaderboard.html
- OpenLigaDB provides live 2026 WC data (no API key needed)
- 8-user shared state persists in `state.json` across server restarts
