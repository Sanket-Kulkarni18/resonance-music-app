import React, { useState, useEffect } from 'react';
import { syncService } from './SyncService';

function App() {
  const [screen, setScreen] = useState('landing');
  const [roomState, setRoomState] = useState(null);
  const [syncData, setSyncData] = useState({});
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    syncService.onUpdate = (data) => {
      setSyncData(prev => ({ ...prev, ...data }));
      if (data.roomState) setRoomState(data.roomState);
    };

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
    if (!name.trim()) return showError('Please enter your name');
    const res = await syncService.createRoom(name);
    if (res.success) setScreen('room');
    else showError('Failed to create room');
  };

  const handleJoin = async () => {
    if (!name.trim() || roomCode.length !== 4) return showError('Enter name and 4-letter code');
    const res = await syncService.joinRoom(roomCode, name);
    if (res.success) setScreen('room');
    else showError(res.error || 'Room not found');
  };

  const showError = (msg) => {
    setError(msg);
    setTimeout(() => setError(''), 3500);
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(syncData.state?.roomId);
    showError('✅ Room code copied!');
  };

  if (screen === 'landing') {
    return (
      <div className="screen">
        <div className="container">
          <div className="landing-hero">
            <div className="logo">🎵</div>
            <h1>SyncPlay</h1>
            <p className="subtitle">Precision Audio Sync • Real-Time Synchronization</p>
          </div>

          <div className="card">
            <div className="form-group">
              <label className="form-label">👤 Your Name</label>
              <input 
                type="text" 
                placeholder="Enter your name" 
                value={name} 
                onChange={e => setName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>

            <button className="btn btn-primary" onClick={handleCreate}>
              🎤 Create Room
            </button>

            <div className="divider"><span>or join existing room</span></div>

            <div className="form-group">
              <label className="form-label">🚪 Room Code</label>
              <input 
                type="text" 
                className="room-code-input" 
                placeholder="XXXX" 
                maxLength={4} 
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
              />
              <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '6px', textAlign: 'center' }}>
                4-character code from host
              </p>
            </div>

            <button className="btn btn-secondary" onClick={handleJoin}>
              🚪 Join Room
            </button>

            {error && <p className="error">{error}</p>}
          </div>
        </div>
      </div>
    );
  }

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
          <div className="header-left">
            <h2>🎵 SyncPlay</h2>
            <div className="room-code" onClick={copyRoomCode} title="Click to copy room code">
              {s.roomId || '----'}
            </div>
          </div>
          <span className={`sync-badge ${cs.rtt < 30 ? 'excellent' : cs.rtt < 80 ? '' : 'syncing'}`}>
            {cs.rtt < 30 ? '✨ Excellent' : cs.rtt < 80 ? '✅ Good' : '⏳ Syncing...'}
          </span>
        </div>

        {/* Members Section */}
        <div className="section">
          <div className="section-title">👥 Room Members ({members.length})</div>
          <div className="members-list">
            {members.map(m => (
              <div key={m.id} className={`member-chip ${m.isHost ? 'host' : ''}`}>
                {m.isHost ? '👑 ' : '👤 '}{m.name} {m.id === s.myId ? '(You)' : ''}
              </div>
            ))}
          </div>
        </div>

        {/* Host Upload Section */}
        {s.isHost && (
          <div className="section">
            <div className="section-title">🎧 Host Controls</div>
            <input 
              type="file" 
              id="input-file" 
              className="file-input" 
              accept="audio/*" 
              onChange={(e) => syncService.uploadFile(e.target.files[0])}
            />
            <label htmlFor="input-file" className="upload-btn">
              📁 Choose Audio File
            </label>
            {syncData.statusText && <div className="file-name">{syncData.statusText}</div>}
          </div>
        )}

        {/* Player Section */}
        <div className="section">
          {!s.currentTrack ? (
            <div className="no-track">
              <div className="icon">🎵</div>
              <p>No track loaded</p>
              <p style={{ fontSize: '0.9rem' }}>
                {s.isHost ? '📤 Upload a song to get started' : '⏳ Waiting for host...'}
              </p>
            </div>
          ) : (
            <div>
              <div className="track-name">
                🎵 {s.currentTrack.name}
              </div>
              
              <input 
                type="range" 
                className="progress-slider" 
                min="0" 
                max="100" 
                step="0.01" 
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
                <button 
                  className={`btn-play ${ps.isPlaying ? 'pause' : ''}`} 
                  disabled={!s.isHost || !syncData.audioReady} 
                  onClick={() => syncService.togglePlay()}
                >
                  <span>{ps.isPlaying ? '⏸' : '▶'}</span>
                  <span>{ps.isPlaying ? 'Pause' : 'Play'}</span>
                </button>
              </div>

              <div className="volume-control">
                <span>🔊</span>
                <input 
                  type="range" 
                  className="vol-slider" 
                  min="0" 
                  max="100" 
                  defaultValue="80" 
                  onChange={(e) => syncService.setVolume(e.target.value)}
                />
              </div>

              {ps.isPlaying && (
                <div className="precision-indicator">
                  <div className="precision-dot"></div>
                  <span>🎯 Precision Mode Active</span>
                </div>
              )}

              <div className="sync-stats">
                <div className="stat">
                  <div className="stat-label">Offset</div>
                  <div className="stat-value">{cs.offset}</div>
                  <div className="stat-unit">ms</div>
                </div>
                <div className="stat">
                  <div className="stat-label">RTT</div>
                  <div className={`stat-value ${cs.rtt < 30 ? 'good' : cs.rtt < 80 ? 'warning' : 'bad'}`}>
                    {cs.rtt}
                  </div>
                  <div className="stat-unit">ms</div>
                </div>
                <div className="stat">
                  <div className="stat-label">Drift</div>
                  <div className="stat-value">{ds.current}</div>
                  <div className="stat-unit">ms</div>
                </div>
                <div className="stat">
                  <div className="stat-label">Adjustments</div>
                  <div className="stat-value">{ds.corrections}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Peer Controls */}
        {!s.isHost && (
          <div className="section">
            <button className="btn-host" onClick={() => syncService.becomeHost()}>
              🎤 Become Host
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
