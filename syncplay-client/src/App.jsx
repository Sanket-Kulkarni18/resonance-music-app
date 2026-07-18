import React, { useState, useEffect, useRef } from 'react';
import { syncService } from './SyncService';

function App() {
  const [screen, setScreen] = useState('landing');
  const [roomState, setRoomState] = useState(null);
  const [syncData, setSyncData] = useState({});
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  
  // Progress bar specific state
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    // Listen to changes from our Service
    syncService.onUpdate = (data) => {
      setSyncData(prev => ({ ...prev, ...data }));
      if (data.roomState) setRoomState(data.roomState);
    };

    // 60fps Loop for the progress bar
    const interval = setInterval(() => {
      if (!isDragging && syncService.playbackState.duration > 0) {
        setProgress((syncService.getCurrentTime() / syncService.playbackState.duration) * 100);
      }
    }, 16);

    return () => clearInterval(interval);
  }, [isDragging]);

  const formatTime = (seconds) => {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleCreate = async () => {
    if (!name) return showError('Please enter your name');
    const res = await syncService.createRoom(name);
    if (res.success) setScreen('room');
    else showError('Failed to create room');
  };

  const handleJoin = async () => {
    if (!name || roomCode.length !== 4) return showError('Enter name and 4-letter code');
    const res = await syncService.joinRoom(roomCode, name);
    if (res.success) setScreen('room');
    else showError(res.error || 'Room not found');
  };

  const showError = (msg) => {
    setError(msg);
    setTimeout(() => setError(''), 3000);
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(syncData.state?.roomId);
    alert('Copied!');
  };

  // --- RENDER LANDING ---
  if (screen === 'landing') {
    return (
      <div className="screen">
        <div className="container">
          <div style={{ textAlign: 'center' }}>
            <div className="logo">🎵</div>
            <h1>SyncPlay</h1>
            <p className="subtitle">Precision Audio Sync (~1ms accuracy)</p>
          </div>
          <div className="card">
            <input type="text" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
            <button className="btn btn-primary" onClick={handleCreate}>Create Room</button>
            <div className="divider"><span>or join existing</span></div>
            <input type="text" className="room-code-input" placeholder="ABCD" maxLength={4} value={roomCode} onChange={e => setRoomCode(e.target.value)} />
            <button className="btn btn-secondary" onClick={handleJoin}>Join Room</button>
            {error && <p className="error">{error}</p>}
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER ROOM ---
  const s = syncData.state || {};
  const ps = syncData.playbackState || {};
  const cs = syncData.clockSync || {};
  const ds = syncData.driftStats || {};
  const members = roomState?.members || [];

  return (
    <div className="screen screen-room">
      <div className="container container-room">
        {/* Header */}
        <div className="room-header">
          <div>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '4px' }}>🎵 SyncPlay Room</h2>
            <span className="room-code" onClick={copyRoomCode}>{s.roomId || '----'}</span>
          </div>
          <span className={`sync-badge ${cs.rtt < 30 ? 'excellent' : cs.rtt < 80 ? '' : 'syncing'}`}>
            {cs.rtt < 30 ? '✅ Excellent' : cs.rtt < 80 ? '✅ Good' : '⏳ Syncing...'}
          </span>
        </div>

        {/* Members */}
        <div className="section">
          <div className="section-title">👥 Members ({members.length})</div>
          <div className="members-list">
            {members.map(m => (
              <div key={m.id} className={`member-chip ${m.isHost ? 'host' : ''}`}>
                {m.isHost ? '👑 ' : ''}{m.name} {m.id === s.myId ? '(You)' : ''}
              </div>
            ))}
          </div>
        </div>

        {/* Host Upload */}
        {s.isHost && (
          <div className="section">
            <div className="section-title">🎧 Host Controls</div>
            <input type="file" id="input-file" className="file-input" accept="audio/*" onChange={(e) => syncService.uploadFile(e.target.files[0])} />
            <label htmlFor="input-file" className="upload-btn">📁 Choose Audio File</label>
            {syncData.statusText && <div className="file-name">{syncData.statusText}</div>}
          </div>
        )}

        {/* Player */}
        <div className="section">
          {!s.currentTrack ? (
            <div className="no-track">
              <div className="icon">🎵</div>
              <p>No track loaded</p>
              <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>{s.isHost ? 'Upload a song to get started' : 'Waiting for host...'}</p>
            </div>
          ) : (
            <div>
              <div className="track-name">🎵 <span>{s.currentTrack.name}</span></div>
              
              <input 
                type="range" 
                className="progress-slider" 
                min="0" max="100" step="0.01" 
                value={progress}
                onMouseDown={() => setIsDragging(true)}
                onChange={(e) => setProgress(e.target.value)}
                onMouseUp={(e) => {
                  setIsDragging(false);
                  syncService.seek((e.target.value / 100) * ps.duration);
                }}
              />
              
              <div className="time-display">
                <span>{formatTime(isDragging ? (progress/100) * ps.duration : syncService.getCurrentTime())}</span>
                <span>{formatTime(ps.duration)}</span>
              </div>
              
              <div className="player-controls">
                <button className={`btn-play ${ps.isPlaying ? 'pause' : ''}`} disabled={!s.isHost || !syncData.audioReady} onClick={() => syncService.togglePlay()}>
                  <span>{ps.isPlaying ? '⏸' : '▶'}</span>
                  <span>{ps.isPlaying ? 'Pause' : 'Play'}</span>
                </button>
              </div>

              <div className="volume-control">
                <span>🔊</span>
                <input type="range" className="vol-slider" min="0" max="100" defaultValue="80" onChange={(e) => syncService.setVolume(e.target.value)} />
              </div>

              {ps.isPlaying && (
                <div className="precision-indicator">
                  <div className="precision-dot"></div>
                  <span>Web Audio API - Precision Mode Active</span>
                </div>
              )}

              <div className="sync-stats">
                <div className="stat"><div>Offset</div><div className="stat-value">{cs.offset}ms</div></div>
                <div className="stat"><div>RTT</div><div className={`stat-value ${cs.rtt < 30 ? 'good' : cs.rtt < 80 ? 'warning' : 'bad'}`}>{cs.rtt}ms</div></div>
                <div className="stat"><div>Drift</div><div className="stat-value">{ds.current}ms</div></div>
                <div className="stat"><div>Adjustments</div><div className="stat-value">{ds.corrections}</div></div>
              </div>
            </div>
          )}
        </div>

        {/* Peer Controls */}
        {!s.isHost && (
          <div className="section">
            <button className="btn-host" onClick={() => syncService.becomeHost()}>🎤 Become Host</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;