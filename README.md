# 🎵 SyncPlay - Real Multi-Device Setup

This folder contains everything you need to run SyncPlay with real multi-device synchronization.

## Quick Setup (5 minutes)

### Step 1: Copy this folder

Copy the entire `server-setup` folder to your computer:
```
C:\syncplay\
├── package.json
├── index.js
├── README.md
└── client\
    └── index.html
```

### Step 2: Open Terminal

Open Command Prompt or PowerShell and navigate to the folder:
```bash
cd C:\syncplay
```

### Step 3: Install Dependencies

```bash
npm install
```

### Step 4: Start the Server

```bash
npm start
```

You'll see output like this:
```
══════════════════════════════════════════════════
🎵 SyncPlay Server is running!
══════════════════════════════════════════════════

📍 Local:   http://localhost:3000
📱 Network: http://192.168.1.100:3000

👆 Use the Network URL on your mobile phone!
══════════════════════════════════════════════════
```

### Step 5: Connect Your Devices

1. **On Laptop**: Open `http://localhost:3000`
2. **On Mobile**: Open the Network URL (e.g., `http://192.168.1.100:3000`)

> ⚠️ Both devices must be on the **same WiFi network**

## How to Use

1. **Create a Room** (on laptop or mobile)
   - Enter your name
   - Click "Create Room"
   - You'll get a 4-letter code (e.g., `ABCD`)

2. **Join from Other Device**
   - Enter your name
   - Enter the room code
   - Click "Join Room"

3. **Host Uploads Music**
   - The host (room creator) uploads an audio file
   - All devices will load the same track

4. **Play in Sync!**
   - Host clicks Play → everyone hears it at the same time
   - Drift is automatically corrected every 3 seconds

## Troubleshooting

### "Can't connect from mobile"

1. Make sure both devices are on the **same WiFi**
2. Check Windows Firewall:
   - Open Windows Security → Firewall → Allow an app
   - Add Node.js or allow port 3000

3. Try disabling firewall temporarily to test

### "npm install fails"

1. Use a short folder path: `C:\syncplay\`
2. Enable Windows long paths:
   ```powershell
   # Run PowerShell as Admin
   New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
   ```

### "Audio doesn't sync well"

1. Make sure clock sync shows "✅ Synced"
2. Both devices should show clock offset values
3. Check drift display - it should stay under 50ms

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│   LAPTOP (Host)          SERVER          MOBILE     │
│   ┌─────────┐         ┌─────────┐      ┌─────────┐ │
│   │ Browser │◄───────►│ Node.js │◄────►│ Browser │ │
│   │ :3000   │ Socket  │ :3000   │      │         │ │
│   └─────────┘   IO    └─────────┘      └─────────┘ │
│        │                   │                │      │
│        └───────────────────┴────────────────┘      │
│                     Same WiFi                       │
│                                                     │
│   1. Clock sync (NTP-like)                         │
│   2. Host uploads file → Server stores it          │
│   3. Host: "Play at T+200ms" → Server broadcasts   │
│   4. All devices schedule play() at same moment    │
│   5. Every 3s: drift correction                    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Files

- `package.json` - npm dependencies
- `index.js` - Server code (Express + Socket.IO)
- `client/index.html` - Web interface
- `uploads/` - Created automatically for audio files
