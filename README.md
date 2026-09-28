# AetherSync / SyncPlay

A real-time, multi-device audio synchronization app with a spatial studio UI.
One person hosts a room and uploads an audio file; every connected device receives
clock-scheduled playback, drift correction, a shared speaker-placement map, and
the host's spatial/effect profile.

## Highlights

- **Room gateway** — create a named room or join one using a four-character invite code.
- **Calibration view** — place each phone, tablet, or laptop around a 360° speaker map and inspect real clock offset / RTT data.
- **Live spatial studio** — radar visualisation, shared 8D / 16D / ambience modes, effect selection, synchronized transport, upload status, and host handoff controls.
- **Tight playback sync** — clients sample the server clock and the host sends playback heartbeats for drift correction.
- **Real-time collaboration** — Socket.IO broadcasts room membership, device placements, audio settings, readiness, and host-control transfers.

## Project layout

```text
resonance-music-app/
├── backend/                  # Express + Socket.IO sync server
│   ├── index.js              # rooms, uploads, scheduling, host transfers
│   └── uploads/              # runtime audio files (git-ignored)
└── frontend/                 # React + Vite spatial studio
    ├── src/components/       # portal, calibration, radar, live studio UI
    └── src/SyncService.js    # Web Audio + Socket.IO client service
```

## Run locally

Use two terminals:

```bash
# Terminal 1 — sync server
cd backend
npm install
npm start

# Terminal 2 — React UI
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite server proxies `/socket.io`, `/upload`,
and `/uploads` to the backend on port `5000`, so browser requests stay
same-origin during development.

To use a separately hosted backend, set `VITE_SOCKET_URL` to its public origin
before starting or building the frontend:

```bash
VITE_SOCKET_URL=https://api.example.com npm run build
```

## How playback is synchronized

1. Each client collects clock samples to estimate its server offset and round-trip time.
2. The host uploads a file; the backend stores it under `backend/uploads/` and broadcasts the track URL.
3. Once clients decode the audio buffer, the server schedules a shared start time with an RTT-aware buffer.
4. The host sends frequent playback heartbeats. Peers restart or gently adjust their rate when drift crosses the correction thresholds.
5. The Web Audio graph applies the shared tonal effect and device-placement-driven spatial panning locally on each listener.

## Validation

```bash
cd frontend
npm run lint
npm run build
```
