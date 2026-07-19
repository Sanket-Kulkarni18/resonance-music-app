# 🎵 SyncPlay — Backend

Express + Socket.IO server that powers real-time, multi-device audio synchronization.

## What it does

- Manages rooms (create / join via 4-letter code)
- Stores uploaded audio files in `uploads/`
- Broadcasts synchronized play / pause / seek events
- Runs NTP-like clock sync and drift correction
- Handles host transfer between devices

## Run

```bash
cd backend
npm install
npm start
```

The server listens on `http://localhost:5000` (or `PORT`) and also serves
the frontend from `../frontend/client`, so opening `http://localhost:5000`
loads the app directly.

See the project root `README.md` for the full workspace layout.
