import React, { useState, useEffect, useRef } from 'react';
import { syncService } from './SyncService.js';
import { streamingTheaterService } from './StreamingTheaterService.js';
import StreamingTheaterSetup from './StreamingTheaterSetup.jsx';
import './App.css';

const effectOptions = [
  { id: 'none', label: 'No Effect' },
  { id: 'echo', label: 'Echo' },
  { id: 'bassBoost', label: 'Bass Boost' },
  { id: 'trebleBoost', label: 'Treble Boost' },
];

const spatialModes = [
  { id: 'normal', label: 'Normal' },
  { id: '8d', label: '8D' },
  { id: '16d', label: '16D' },
  { id: 'atmos', label: 'Dolby Atmos' },
];

function App() {
  const [screen, setScreen] = useState('landing');
  const [roomState, setRoomState] = useState(null);
  const [syncData, setSyncData] = useState({});
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedEffect, setSelectedEffect] = useState('none');
  const [spatialMode, setSpatialMode] = useState('normal');
  const [devicePlacements, setDevicePlacements] = useState({});
  const [draggingId, setDraggingId] = useState(null);
  const [hostRequest, setHostRequest] = useState(null);
  const [hostRequestPending, setHostRequestPending] = useState(false);
  const [showStreamingSetup, setShowStreamingSetup] = useState(false);
  const mapRef = useRef(null);
  const lastSyncedPlacementsRef = useRef('');
  const draggingIdRef = useRef(null);

  useEffect(() => {
    draggingIdRef.current = draggingId;
  }, [draggingId]);

  useEffect(() => {
    syncService.onUpdate = (data) => {
      setSyncData((prev) => ({ ...prev, ...data }));
      if (data.roomState) {
        setRoomState(data.roomState);
        if (data.roomState.placements && !draggingIdRef.current) {
          setDevicePlacements(data.roomState.placements);
        }
      }
      if (data.hostTransferRequest) {
        setHostRequest(data.hostTransferRequest);
      }
      if (data.hostRequestPending !== undefined) {
        setHostRequestPending(data.hostRequestPending);
      }
    };

    const interval = setInterval(() => {
      if (!isDragging && syncService.playbackState.duration > 0) {
        setProgress((syncService.getCurrentTime() / syncService.playbackState.duration) * 100);
      }
    }, 16);

    return () => clearInterval(interval);
  }, [isDragging]);

  useEffect(() => {
    if (!roomState) return;
    setDevicePlacements((prev) => {
      const updated = { ...prev };
      roomState.members.forEach((member, index) => {
        if (!updated[member.id]) {
          const angle = (360 / Math.max(1, roomState.members.length)) * index;
          const rad = (angle * Math.PI) / 180;
          updated[member.id] = { x: Math.cos(rad) * 0.55, y: Math.sin(rad) * 0.55 };
        }
      });
      return updated;
    });
  }, [roomState?.members?.length]);

  useEffect(() => {
    syncService.setEffectPreset(selectedEffect);
  }, [selectedEffect]);

  useEffect(() => {
    syncService.setSpatialMode(spatialMode);
  }, [spatialMode]);

  useEffect(() => {
    if (!syncData.audioSettings) return;
    setSelectedEffect(syncData.audioSettings.effectPreset || 'none');
    setSpatialMode(syncData.audioSettings.spatialMode || 'normal');
  }, [syncData.audioSettings]);

  useEffect(() => {
    syncService.setDevicePlacements(devicePlacements);
  }, [devicePlacements]);

  useEffect(() => {
    if (!syncData.state?.isHost || draggingId) return;
    if (Object.keys(devicePlacements).length === 0) return;
    const placementsString = JSON.stringify(devicePlacements);
    if (placementsString === lastSyncedPlacementsRef.current) return;
    syncService.syncDevicePlacements(devicePlacements);
    lastSyncedPlacementsRef.current = placementsString;
  }, [devicePlacements, draggingId, syncData.state?.isHost]);

  useEffect(() => {
    if (!draggingId) return;

    const handleMove = (event) => {
      if (!mapRef.current) return;
      const rect = mapRef.current.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      const clamp = (value) => Math.max(-0.9, Math.min(0.9, value));
      setDevicePlacements((prev) => ({
        ...prev,
        [draggingId]: { x: clamp(x), y: clamp(y) },
      }));
    };

    const handleUp = () => setDraggingId(null);

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [draggingId]);

  const formatTime = (seconds) => {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleCreate = async (streamingTheaterMode = false) => {
    if (!name.trim()) return showError('Please enter your name');
    const res = await syncService.createRoom(name, streamingTheaterMode);
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

  const handleRequestHost = async () => {
    const result = await syncService.requestHostTransfer();
    if (!result.success) showError(result.error || 'Unable to request host controls');
  };

  const handleApproveHostRequest = async () => {
    if (hostRequest) {
      const result = await syncService.approveHostTransfer(hostRequest.requesterId);
      if (!result.success) showError(result.error || 'Unable to transfer host controls');
    }
  };

  const handleDenyHostRequest = () => {
    if (hostRequest) {
      setHostRequest(null);
      showError('Host request denied');
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(syncData.state?.roomId);
    showError('✅ Room code copied!');
  };

  const handleDragStart = (memberId, event) => {
    if (!syncData.state?.isHost) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDraggingId(memberId);
  };

  const getMapPositionStyle = (placement) => ({
    left: `${50 + placement.x * 38}%`,
    top: `${50 + placement.y * 38}%`,
  });

  const handleEffectChange = (effectPreset) => {
    if (!syncData.state?.isHost) return;
    setSelectedEffect(effectPreset);
    syncService.updateAudioSettings({ effectPreset, spatialMode });
  };

  const handleSpatialModeChange = (nextSpatialMode) => {
    if (!syncData.state?.isHost) return;
    setSpatialMode(nextSpatialMode);
    syncService.updateAudioSettings({ effectPreset: selectedEffect, spatialMode: nextSpatialMode });
  };

  const handleStreamingSetup = () => {
    setShowStreamingSetup(true);
  };

  const handleStreamingSetupClose = () => {
    setShowStreamingSetup(false);
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

          <div className="glass glass-strong card">
            <div className="form-group">
              <label className="form-label">👤 Your Name</label>
              <input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>

            <button className="btn btn-primary" onClick={() => handleCreate()}>
              🎬 Create Room
            </button>

            <div className="divider">
              <span>or join existing room</span>
            </div>

            <div className="form-group">
              <label className="form-label">🔑 Room Code</label>
              <input
                type="text"
                className="room-code-input"
                placeholder="XXXX"
                maxLength={4}
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
              />
              <p
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-dim)',
                  marginTop: '6px',
                  textAlign: 'center',
                }}
              >
                4-character code from host
              </p>
            </div>

            <button className="btn btn-secondary" onClick={handleJoin}>
              🔑 Join Room
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

  // Check if streaming theater mode is active
  const isStreamingMode = roomState?.streamingTheaterMode || false;

  return (
    <div className="screen screen-room">
      <div className="container container-room">
        <div className="glass room-header">
          <div className="header-left">
            <h2>🎵 SyncPlay</h2>
            <div className="room-code" onClick={copyRoomCode} title="Click to copy room code">
              {s.roomId || '----'}
            </div>
          </div>
          <div className="header-right">
            {isStreamingMode && (
              <span className="streaming-badge">🎭 Streaming Mode</span>
            )}
            <span
              className={`sync-badge ${cs.rtt < 30 ? 'excellent' : cs.rtt < 80 ? '' : 'syncing'}`}
            >
              {cs.rtt < 30 ? '✨ Excellent' : cs.rtt < 80 ? '✅ Good' : '🔄 Syncing...'}
            </span>
          </div>
        </div>

        <div className="room-grid">
          <div className="col-left">
            <div className="glass section">
              <div className="section-title">👥 Room Members ({members.length})</div>
              <div className="members-list">
                {members.map((m) => (
                  <div key={m.id} className={`member-chip ${m.isHost ? 'host' : ''}`}>
                    {m.isHost ? '👑 ' : '👤 '}
                    {m.name} {m.id === s.myId ? '(You)' : ''}
                  </div>
                ))}
              </div>
            </div>

            {s.isHost && (
              <div className="glass section">
                <div className="section-title">🎬 Host Controls</div>
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

                {/* Streaming Theater Mode Button */}
                <button 
                  className="btn btn-streaming"
                  onClick={handleStreamingSetup}
                >
                  🎭 Streaming Theater Mode
                </button>
              </div>
            )}
          </div>

          <div className="col-right">
            <div className="glass section">
              <div className="section-title">🎨 DJ & Spatial Effects</div>

              <div className="effect-row">
                {effectOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`effect-chip ${selectedEffect === option.id ? 'active' : ''}`}
                    disabled={!s.isHost}
                    onClick={() => handleEffectChange(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="spatial-row">
                {spatialModes.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    className={`effect-chip ${spatialMode === mode.id ? 'active' : ''}`}
                    disabled={!s.isHost}
                    onClick={() => handleSpatialModeChange(mode.id)}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              <p className="section-note">
                Drag devices around the host to shape the 8D/16D sound field. Dolby Atmos adds overhead
                depth and soft ambient reverb.
                {!s.isHost && ' The host controls this mix.'}
              </p>

              <div className="device-map" ref={mapRef}>
                <div className="host-node">Host</div>
                {members.map((member) => {
                  const placement = devicePlacements[member.id] || { x: 0, y: -0.6 };
                  return (
                    <div
                      role="button"
                      key={member.id}
                      className={`device-node ${draggingId === member.id ? 'dragging' : ''}`}
                      style={getMapPositionStyle(placement)}
                      onPointerDown={(e) => handleDragStart(member.id, e)}
                      title={member.isHost ? 'Host position' : `Drag to reposition ${member.name}`}
                    >
                      {member.isHost ? '👑 Host' : member.name}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="glass section section-full">
            {!s.currentTrack ? (
              <div className="no-track">
                <div className="icon">🎵</div>
                <p>No track loaded</p>
                <p style={{ fontSize: '0.9rem' }}>
                  {s.isHost ? '📤 Upload a song to get started' : '⏳ Waiting for host...'}
                </p>
              </div>
            ) : (
              <div className="player-layout">
                <div className="player-main">
                  <div className="track-name">🎵 {s.currentTrack.name}</div>

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
                    <span>{formatTime(isDragging ? (progress / 100) * ps.duration : syncService.getCurrentTime())}</span>
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
                </div>

                <div className="player-stats">
                  <div className="sync-stats">
                    <div className="stat">
                      <div className="stat-label">Offset</div>
                      <div className="stat-value">{cs.offset}</div>
                      <div className="stat-unit">ms</div>
                    </div>
                    <div className="stat">
                      <div className="stat-label">RTT</div>
                      <div
                        className={`stat-value ${cs.rtt < 30 ? 'good' : cs.rtt < 80 ? 'warning' : 'bad'}`}
                      >
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
              </div>
            )}
          </div>
        </div>

        {!s.isHost && (
          <div className="glass section">
            {hostRequestPending ? (
              <div className="host-request-pending">
                <p>⏳ Host request sent. Waiting for approval...</p>
              </div>
            ) : (
              <button className="btn-host" onClick={handleRequestHost}>
                🎬 Request Host
              </button>
            )}
          </div>
        )}
        {s.isHost && hostRequest && (
          <div className="glass section host-request-section">
            <p>
              👑 <strong>{hostRequest.requesterName}</strong> wants to become host
            </p>
            <div className="host-request-actions">
              <button className="btn-approve" onClick={handleApproveHostRequest}>
                ✅ Approve
              </button>
              <button className="btn-deny" onClick={handleDenyHostRequest}>
                ❌ Deny
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Streaming Theater Setup Modal */}
      {showStreamingSetup && (
        <div className="modal-overlay">
          <StreamingTheaterSetup 
            onBack={handleStreamingSetupClose} 
            roomState={roomState}
          />
        </div>
      )}
    </div>
  );
}

export default App;
