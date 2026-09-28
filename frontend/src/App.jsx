import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { syncService } from './SyncService.js';
import { Calibration } from './components/Calibration.jsx';
import { LiveStudio } from './components/LiveStudio.jsx';
import { RoomPortal } from './components/RoomPortal.jsx';
import { TopArchitectureBar } from './components/TopArchitectureBar.jsx';
import {
  placementToPolar,
  polarToPlacement,
  SPATIAL_MODES,
  zoneForAngle,
} from './data/spatial.js';

const EMPTY_MEMBERS = [];

function App() {
  const [activePage, setActivePage] = useState('portal');
  const [displayName, setDisplayName] = useState('');
  const [roomName, setRoomName] = useState('MY SPATIAL ROOM');
  const [roomCode, setRoomCode] = useState('');
  const [selectedMode, setSelectedMode] = useState('8d');
  const [roomState, setRoomState] = useState(null);
  const [syncData, setSyncData] = useState(() => ({
    state: { ...syncService.state },
    playbackState: { ...syncService.playbackState },
    clockSync: { ...syncService.clockSync },
    driftStats: { ...syncService.driftStats },
    audioSettings: { ...syncService.audioSettings },
    devicePlacements: { ...syncService.devicePlacements },
  }));
  const [busy, setBusy] = useState(false);
  const [notification, setNotification] = useState(null);
  const [playbackTick, setPlaybackTick] = useState(0);
  const noticeTimeout = useRef(null);

  const showNotice = (message, type = 'success') => {
    window.clearTimeout(noticeTimeout.current);
    setNotification({ message, type });
    noticeTimeout.current = window.setTimeout(() => setNotification(null), 4200);
  };

  useEffect(() => {
    syncService.onUpdate = (data) => {
      const nextData = data.roomState?.placements
        ? { ...data, devicePlacements: data.roomState.placements }
        : data;
      setSyncData((previous) => ({ ...previous, ...nextData }));
      if (data.roomState) {
        setRoomState(data.roomState);
        if (data.roomState.id) setRoomCode(data.roomState.id);
        if (data.roomState.name) setRoomName(data.roomState.name);
      }
      if (data.audioSettings) {
        const nextMode = SPATIAL_MODES[data.audioSettings.spatialMode] ? data.audioSettings.spatialMode : 'normal';
        setSelectedMode(nextMode);
        syncService.setEffectPreset(data.audioSettings.effectPreset || 'none');
        syncService.setSpatialMode(nextMode);
      }
      if (data.error) showNotice(data.error, 'error');
    };

    const timeline = window.setInterval(() => setPlaybackTick(syncService.getCurrentTime()), 100);
    return () => {
      window.clearInterval(timeline);
      window.clearTimeout(noticeTimeout.current);
      if (syncService.onUpdate) syncService.onUpdate = null;
    };
  }, []);

  const appState = syncData.state || syncService.state;
  const inRoom = Boolean(roomState?.id || appState?.roomId);
  const isHost = Boolean(appState?.isHost);
  const audioSettings = syncData.audioSettings || syncService.audioSettings || {};
  const activeMode = SPATIAL_MODES[audioSettings.spatialMode] ? audioSettings.spatialMode : selectedMode;
  const effectPreset = audioSettings.effectPreset || 'none';
  const placements = useMemo(() => ({
    ...(roomState?.placements || {}),
    ...(syncData.devicePlacements || {}),
  }), [roomState?.placements, syncData.devicePlacements]);
  const clockSync = syncData.clockSync || syncService.clockSync;
  const currentRoomName = roomState?.name || roomName;
  const currentRoomCode = appState?.roomId || roomState?.id || roomCode;
  const members = roomState?.members || EMPTY_MEMBERS;

  const peers = useMemo(() => {
    const total = Math.max(1, members.length);
    return members.map((member, index) => {
      const fallbackAngle = Math.round((index / total) * 360);
      const fallbackDistance = member.isHost ? 0.58 : 0.72;
      const position = placementToPolar(placements[member.id], fallbackAngle, fallbackDistance);
      const zone = zoneForAngle(position.angleDeg);
      const peerRtt = member.id === appState?.myId
        ? Math.max(0, Math.round(Number(clockSync?.rtt) || 0))
        : Math.max(0, Math.round(Number(roomState?.maxRTT) || Number(clockSync?.rtt) || 0));

      return {
        id: member.id,
        name: member.name || 'Connected device',
        deviceModel: member.id === appState?.myId ? 'This browser' : 'Connected browser',
        role: member.isHost ? 'HOST' : 'PEER',
        channelLabel: zone.code,
        angleDeg: position.angleDeg,
        distanceRing: position.distanceRing,
        latencyMs: peerRtt,
        syncLocked: Boolean(clockSync?.synced),
        isMe: member.id === appState?.myId,
      };
    });
  }, [members, placements, appState?.myId, clockSync?.rtt, clockSync?.synced, roomState?.maxRTT]);

  const localPeer = peers.find((peer) => peer.isMe) || peers[0];
  const currentTrack = appState?.currentTrack || roomState?.currentTrack || null;
  const playbackState = {
    ...(syncData.playbackState || syncService.playbackState),
    currentTrack,
  };
  const currentTime = playbackState.isPlaying ? playbackTick : syncService.getCurrentTime();
  const readyState = syncData.readyState || {
    readyCount: roomState?.readyCount || 0,
    totalCount: roomState?.totalCount || peers.length,
  };

  const handleCreate = async (skipCalibration) => {
    if (!displayName.trim()) return showNotice('Enter your display name before creating a room.', 'error');
    if (!roomName.trim()) return showNotice('Give the room a name before creating it.', 'error');
    setBusy(true);
    try {
      const response = await syncService.createRoom(displayName.trim(), roomName.trim());
      if (!response?.success) return showNotice(response?.error || 'Unable to create the room.', 'error');
      setRoomState(response.room);
      setRoomCode(response.room.id);
      setRoomName(response.room.name || roomName.trim());
      syncService.setEffectPreset(effectPreset);
      syncService.setSpatialMode(selectedMode);
      syncService.updateAudioSettings({ effectPreset, spatialMode: selectedMode });
      setActivePage(skipCalibration ? 'studio' : 'calibration');
      showNotice(`Room ${response.room.id} is live. Share the code with your peers.`);
    } catch {
      showNotice('Unable to create the room. Check that the sync server is running.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async (skipCalibration) => {
    const normalizedCode = roomCode.trim().toUpperCase();
    if (!displayName.trim()) return showNotice('Enter your display name before joining a room.', 'error');
    if (normalizedCode.length !== 4) return showNotice('Enter the full four-character room code.', 'error');
    setBusy(true);
    try {
      const response = await syncService.joinRoom(normalizedCode, displayName.trim());
      if (!response?.success) return showNotice(response?.error || 'Room not found.', 'error');
      setRoomState(response.room);
      setRoomCode(response.room.id);
      setRoomName(response.room.name || 'SPATIAL ROOM');
      const nextMode = SPATIAL_MODES[response.room.audioSettings?.spatialMode]
        ? response.room.audioSettings.spatialMode
        : 'normal';
      setSelectedMode(nextMode);
      syncService.setEffectPreset(response.room.audioSettings?.effectPreset || 'none');
      syncService.setSpatialMode(nextMode);
      setActivePage(skipCalibration ? 'studio' : 'calibration');
      showNotice(`Connected to ${response.room.name || response.room.id}.`);
    } catch {
      showNotice('Unable to join the room. Check the room code and server connection.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleNavigate = (page) => {
    if (page === 'portal' && inRoom) {
      showNotice('This device is already in a room. Use Calibration or Live Studio to continue.', 'error');
      return;
    }
    if (page !== 'portal' && !inRoom) {
      showNotice('Create or join a room before opening the studio.', 'error');
      return;
    }
    setActivePage(page);
  };

  const handleModeChange = (spatialMode) => {
    if (!isHost) return;
    setSelectedMode(spatialMode);
    syncService.setSpatialMode(spatialMode);
    syncService.updateAudioSettings({ effectPreset, spatialMode });
  };

  const handleEffectChange = (nextEffect) => {
    if (!isHost) return;
    syncService.setEffectPreset(nextEffect);
    syncService.updateAudioSettings({ effectPreset: nextEffect, spatialMode: activeMode });
  };

  const handleSavePlacement = async (placement) => {
    const myId = appState?.myId;
    if (!myId) return;
    const nextPlacement = { x: placement.x, y: placement.y };
    syncService.setDevicePlacements({ [myId]: nextPlacement });
    const result = await syncService.updateMyPlacement(nextPlacement);
    if (!result?.success) showNotice(result?.error || 'Unable to save this speaker placement.', 'error');
    else showNotice('Speaker placement saved to the room map.');
  };

  const handleRotatePeer = (peerId, deltaDegrees) => {
    if (!isHost) return;
    const peer = peers.find((entry) => entry.id === peerId);
    if (!peer) return;
    const nextAngle = (peer.angleDeg + deltaDegrees + 360) % 360;
    const nextPlacements = {
      ...(roomState?.placements || {}),
      ...(syncData.devicePlacements || {}),
      [peerId]: polarToPlacement(nextAngle, peer.distanceRing),
    };
    syncService.setDevicePlacements(nextPlacements);
    syncService.syncDevicePlacements(nextPlacements);
  };

  const handleRequestHost = async () => {
    const result = await syncService.requestHostTransfer();
    if (!result?.success) showNotice(result?.error || 'Unable to request host controls.', 'error');
    else showNotice('Host control request sent.');
  };

  const handleApproveHost = async () => {
    const requesterId = syncData.hostTransferRequest?.requesterId;
    if (!requesterId) return;
    const result = await syncService.approveHostTransfer(requesterId);
    if (!result?.success) showNotice(result?.error || 'Unable to transfer host controls.', 'error');
    else showNotice('Host controls transferred.');
  };

  const handleDenyHost = async () => {
    const requesterId = syncData.hostTransferRequest?.requesterId;
    if (!requesterId) return;
    const result = await syncService.denyHostTransfer(requesterId);
    if (!result?.success) showNotice(result?.error || 'Unable to deny that request.', 'error');
  };

  return (
    <div className="min-h-screen bg-[#090A0F] text-[#F3F5F8] selection:bg-[#FF5500]/30 selection:text-white">
      <TopArchitectureBar
        activePage={activePage}
        onNavigate={handleNavigate}
        inRoom={inRoom}
        isHost={isHost}
        roomCode={currentRoomCode}
        roomName={currentRoomName}
        activeMode={activeMode}
        peerCount={peers.length}
        connected={syncData.connectionState !== 'disconnected' && Boolean(syncService.socket?.connected)}
      />

      <main>
        {activePage === 'portal' && <RoomPortal displayName={displayName} setDisplayName={setDisplayName} roomName={roomName} setRoomName={setRoomName} roomCode={roomCode} setRoomCode={setRoomCode} activeMode={selectedMode} setActiveMode={setSelectedMode} onCreate={handleCreate} onJoin={handleJoin} busy={busy} error={notification?.type === 'error' ? notification.message : ''} />}
        {activePage === 'calibration' && inRoom && <Calibration roomCode={currentRoomCode} roomName={currentRoomName} activeMode={activeMode} peers={peers} localPeer={localPeer} clockSync={clockSync} onBack={() => setActivePage('studio')} onEnterStudio={() => setActivePage('studio')} onSavePlacement={handleSavePlacement} />}
        {activePage === 'studio' && inRoom && <LiveStudio isHost={isHost} roomCode={currentRoomCode} roomName={currentRoomName} activeMode={activeMode} effectPreset={effectPreset} peers={peers} playbackState={playbackState} currentTime={currentTime} clockSync={clockSync} readyState={readyState} audioReady={Boolean(syncData.audioReady)} statusText={syncData.statusText} hostRequest={syncData.hostTransferRequest} hostRequestPending={syncData.hostRequestPending} onNavigate={handleNavigate} onChangeMode={handleModeChange} onChangeEffect={handleEffectChange} onTogglePlay={() => syncService.togglePlay()} onSeek={(position) => syncService.seek(position)} onSetVolume={(value) => syncService.setVolume(value)} onUpload={(file) => syncService.uploadFile(file)} onRotatePeer={handleRotatePeer} onResync={() => syncService.performClockSync()} onRequestHost={handleRequestHost} onApproveHost={handleApproveHost} onDenyHost={handleDenyHost} />}
      </main>

      {notification && <div className={`fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-xl border px-4 py-3 font-mono text-xs shadow-2xl ${notification.type === 'error' ? 'border-[#EF4444]/40 bg-[#2B1015] text-[#FCA5A5]' : 'border-[#10B981]/40 bg-[#0D211C] text-[#A7F3D0]'}`} role="status">{notification.type === 'error' ? <XCircle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}{notification.message}</div>}
    </div>
  );
}

export default App;
