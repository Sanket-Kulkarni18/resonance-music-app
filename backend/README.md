# AetherSync / SyncPlay backend

Express + Socket.IO server for real-time, multi-device audio synchronization.

## Responsibilities

- Creates and joins named rooms using four-character invite codes
- Stores host-uploaded audio in `uploads/`
- Schedules synchronized play, pause, and seek events
- Responds to client clock-sync samples and relays drift-correction heartbeats
- Broadcasts device placement and shared audio-effect/spatial-mode changes
- Tracks audio-buffer readiness and supports approved host-control transfer

## Run

```bash
cd backend
npm install
npm start
```

The API listens on `http://localhost:5000` by default (or `PORT`). Start the
React UI separately from `../frontend` with `npm run dev`; the Vite dev server
proxies Socket.IO, upload, and uploaded-audio requests to this server.

See the project root `README.md` for full setup instructions.
