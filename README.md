# 🎵 SyncPlay

Real-time, multi-device audio synchronization app. One host uploads a track;
every connected device plays it in tight sync with drift correction.

## Structure

```
resonance-music-app/
├── backend/                # Express + Socket.IO server
│   ├── index.js            # Server: rooms, uploads, sync, host transfer
│   ├── uploads/            # Runtime audio files (git-ignored)
│   ├── package.json
│   └── README.md
└── frontend/               # Vanilla JS Socket.IO client
    ├── client/
    │   └── index.html      # The working web app
    └── package.json
```

## Run

```bash
cd backend
npm install
npm start
```

Then open `http://localhost:5000` (served by the backend itself).
Connect from other devices on the same WiFi using the server's network URL.

## How it works

1. **Clock sync** — each client samples 20 round-trips to compute offset + RTT.
2. **Upload** — host uploads audio; server stores it in `uploads/`.
3. **Play** — host triggers play; server schedules `now + syncBuffer` and
   broadcasts it so every device starts at the same wall-clock instant.
4. **Drift correction** — host sends a heartbeat every 300ms; clients resync
   on >100ms drift or nudge playback rate on >15ms drift.
5. **Audio graph** — Web Audio API applies echo / bass / treble and 8D / 16D /
   Atmos spatial effects via an HRTF panner.
