import { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Copy,
  Crown,
  FileAudio,
  ListMusic,
  Lock,
  Pause,
  Play,
  Radio,
  RefreshCw,
  SlidersHorizontal,
  Upload,
  UserRoundPlus,
  Users,
  Volume2,
  Waves,
} from 'lucide-react';
import { EFFECT_PRESETS, SPATIAL_MODES } from '../data/spatial.js';
import { SpatialRadarStage } from './SpatialRadarStage.jsx';
import { spatialAudio } from '../utils/spatialAudioEngine.js';

const waveformPeaks = [24, 38, 52, 61, 49, 75, 88, 92, 68, 74, 95, 84, 62, 58, 79, 91, 98, 86, 72, 64, 83, 94, 89, 77, 53, 44, 68, 88, 96, 92, 85, 79, 90, 97, 84, 71, 63, 76, 89, 93, 81, 67, 55, 72, 88, 94, 78, 60, 48, 35];

export function LiveStudio({
  isHost,
  roomCode,
  roomName,
  activeMode,
  effectPreset,
  peers,
  playbackState,
  currentTime,
  clockSync,
  readyState,
  audioReady,
  statusText,
  hostRequest,
  hostRequestPending,
  onNavigate,
  onChangeMode,
  onChangeEffect,
  onTogglePlay,
  onSeek,
  onSetVolume,
  onUpload,
  onRotatePeer,
  onResync,
  onRequestHost,
  onApproveHost,
  onDenyHost,
}) {
  const [rightPanelTab, setRightPanelTab] = useState('dsp');
  const [selectedPeerId, setSelectedPeerId] = useState(null);
  const [masterVolume, setMasterVolume] = useState(80);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isResyncing, setIsResyncing] = useState(false);
  const [liveSynthEnabled, setLiveSynthEnabled] = useState(false);
  const fileInputRef = useRef(null);
  const mode = SPATIAL_MODES[activeMode] || SPATIAL_MODES.normal;
  const isPlaying = Boolean(playbackState?.isPlaying);
  const duration = Number(playbackState?.duration) || 0;
  const position = Math.max(0, Math.min(Number(currentTime) || 0, duration || Number.MAX_SAFE_INTEGER));
  const activeTrack = playbackState?.currentTrack;
  const trackName = activeTrack?.name || 'No audio loaded';

  const effectiveSelectedPeerId = peers.some((peer) => peer.id === selectedPeerId)
    ? selectedPeerId
    : peers[0]?.id || null;

  useEffect(() => {
    if (liveSynthEnabled && isPlaying) {
      spatialAudio.startSpatialDrone(['110.00', '164.81', '220.00', '293.66'], masterVolume);
    } else {
      spatialAudio.stopSpatialDrone();
    }
    return () => spatialAudio.stopSpatialDrone();
  }, [liveSynthEnabled, isPlaying, masterVolume]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard?.writeText(roomCode);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      // Clipboard access can be blocked for non-secure local contexts.
    }
  };

  const handleResync = async () => {
    setIsResyncing(true);
    try {
      await onResync?.();
    } finally {
      window.setTimeout(() => setIsResyncing(false), 600);
    }
  };

  const changeVolume = (value) => {
    setMasterVolume(value);
    onSetVolume(value);
  };

  const handleWaveformSeek = (event) => {
    if (!isHost || !duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1600px] flex-col justify-between gap-4 bg-acoustic-grid p-3 sm:p-5">
      <section className="studio-card flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#07080C] px-3 py-1.5">
            <span className="hidden font-display text-xs font-bold text-[#F3F5F8] sm:inline">{roomName}</span>
            <span className="hidden text-white/20 sm:inline">•</span>
            <span className="font-mono text-[10px] text-[#8E96AA]">CODE</span>
            <span className="font-mono text-sm font-bold tracking-wider text-[#00F0FF]">{formatCode(roomCode)}</span>
            <button type="button" onClick={handleCopyCode} className="rounded p-1 text-[#8E96AA] transition-colors hover:bg-white/10 hover:text-white" title="Copy room invite code">
              {copiedCode ? <Check className="h-3.5 w-3.5 text-[#10B981]" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
          <div className="hidden items-center gap-2 rounded-xl border border-white/[0.07] bg-[#07080C] px-3 py-1.5 font-mono text-xs md:flex">
            <span className={`h-2 w-2 rounded-full ${clockSync?.synced ? 'animate-pulse bg-[#10B981]' : 'bg-[#F59E0B]'}`} />
            <span className="text-[#8E96AA]">CLOCK:</span><span className="font-bold text-[#10B981]">{clockSync?.synced ? `LOCKED (${clockSync.offset >= 0 ? '+' : ''}${clockSync?.offset || 0}ms)` : 'SYNCING'}</span>
          </div>
          <button type="button" onClick={() => onNavigate('calibration')} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-xs text-[#8E96AA] transition-colors hover:bg-white/[0.09] hover:text-white"><Compass className="h-3.5 w-3.5 text-[#00F0FF]" /> RE-CALIBRATE</button>
        </div>
        <div className="flex items-center gap-2.5">
          <button type="button" onClick={() => setLiveSynthEnabled((enabled) => !enabled)} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 font-mono text-xs transition-all ${liveSynthEnabled ? 'border-[#FF5500] bg-[#FF5500]/20 font-bold text-[#FF5500] shadow-[0_0_15px_rgba(255,85,0,0.3)]' : 'border-white/10 bg-[#07080C] text-[#8E96AA] hover:text-white'}`} title="Optional local test drone; it does not change shared playback">
            <Radio className={`h-3.5 w-3.5 ${liveSynthEnabled ? 'animate-pulse' : ''}`} /><span className="hidden sm:inline">{liveSynthEnabled ? 'LOCAL TEST DRONE: ON' : 'TEST SPATIAL DRONE'}</span><span className="sm:hidden">TEST</span>
          </button>
          <div className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 font-mono text-xs ${isHost ? 'border-[#FF5500]/30 bg-[#FF5500]/15 text-[#FF5500]' : 'border-[#00F0FF]/30 bg-[#00F0FF]/15 text-[#00F0FF]'}`}>
            {isHost ? <Crown className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}<span>{isHost ? 'HOST CONTROL' : 'PEER RECEIVER'}</span>
          </div>
        </div>
      </section>

      <div className="grid flex-1 items-stretch gap-4 lg:grid-cols-12">
        <section className="studio-card flex flex-col justify-between rounded-2xl p-4 lg:col-span-3">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2"><Users className="h-4 w-4 text-[#00F0FF]" /><div><h2 className="font-display text-sm font-bold text-[#F3F5F8]">CONNECTED NODES</h2><p className="font-mono text-[10px] text-[#8E96AA]">{peers.length} DEVICES IN ROOM</p></div></div>
              <button type="button" onClick={handleResync} title="Run another clock sync sample" className="rounded-lg border border-white/10 bg-white/[0.05] p-1.5 text-[#8E96AA] transition-colors hover:bg-white/[0.1] hover:text-white"><RefreshCw className={`h-3.5 w-3.5 ${isResyncing ? 'animate-spin text-[#10B981]' : ''}`} /></button>
            </div>
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {peers.map((peer) => <PeerCard key={peer.id} peer={peer} selected={effectiveSelectedPeerId === peer.id} onClick={() => setSelectedPeerId(peer.id)} />)}
            </div>
          </div>
          <div className="mt-3 space-y-2 border-t border-white/[0.08] pt-3">
            {!isHost && (hostRequestPending ? <div className="rounded-xl border border-[#00F0FF]/30 bg-[#00F0FF]/10 p-3 text-center font-mono text-xs text-[#00F0FF]">HOST REQUEST SENT · WAITING FOR APPROVAL</div> : <button type="button" onClick={onRequestHost} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#00F0FF]/30 bg-[#00F0FF]/12 px-3 py-2.5 font-mono text-xs font-bold text-[#00F0FF] transition-all hover:bg-[#00F0FF]/20"><UserRoundPlus className="h-3.5 w-3.5" /> REQUEST HOST CONTROL</button>)}
            {isHost && hostRequest && <div className="space-y-2 rounded-xl border border-[#FF5500]/30 bg-[#FF5500]/10 p-3"><p className="text-center font-mono text-xs text-[#F3F5F8]"><strong className="text-[#FF5500]">{hostRequest.requesterName}</strong> requested host control</p><div className="grid grid-cols-2 gap-2"><button type="button" onClick={onDenyHost} className="rounded-lg border border-white/10 bg-white/[0.05] py-2 font-mono text-[11px] text-[#F3F5F8] hover:bg-white/10">DENY</button><button type="button" onClick={onApproveHost} className="rounded-lg bg-[#FF5500] py-2 font-mono text-[11px] font-bold text-[#090A0F] hover:bg-[#FF6922]">APPROVE</button></div></div>}
            {isHost && !hostRequest && <p className="text-center font-mono text-[10px] text-[#8E96AA]">Peers can request control from their own receiver view.</p>}
          </div>
        </section>

        <section className="flex flex-col lg:col-span-6">
          <SpatialRadarStage
            activeMode={activeMode}
            isPlaying={isPlaying}
            peers={peers}
            selectedPeerId={effectiveSelectedPeerId}
            setSelectedPeerId={setSelectedPeerId}
            orbitSpeedHz={mode.defaultOrbitSpeed || 0.14}
            roomDecayPct={mode.defaultRoomDecay}
            lfeGainDb={mode.defaultLfeGain}
            userRole={isHost ? 'host' : 'peer'}
            liveSynthEnabled={liveSynthEnabled}
            masterVolume={masterVolume}
            onRotatePeerAngle={onRotatePeer}
          />
        </section>

        <section className="studio-card flex flex-col justify-between rounded-2xl p-4 lg:col-span-3">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-1.5 rounded-xl p-1 studio-recessed">
              <TabButton active={rightPanelTab === 'dsp'} onClick={() => setRightPanelTab('dsp')} icon={SlidersHorizontal} color="orange">SPATIAL DSP</TabButton>
              <TabButton active={rightPanelTab === 'track'} onClick={() => setRightPanelTab('track')} icon={ListMusic} color="cyan">TRACK INPUT</TabButton>
            </div>
            {rightPanelTab === 'dsp' ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between font-mono text-[10px] uppercase text-[#8E96AA]"><span>ACOUSTIC ENGINE PROFILE</span>{!isHost && <span className="flex items-center gap-1 text-[#00F0FF]"><Lock className="h-3 w-3" /> HOST CONTROLLED</span>}</div>
                  {Object.values(SPATIAL_MODES).map((profile) => <button key={profile.id} type="button" disabled={!isHost} onClick={() => onChangeMode(profile.id)} className={`w-full rounded-xl border p-3 text-left transition-all disabled:cursor-not-allowed ${activeMode === profile.id ? 'border-[#FF5500] bg-[#181D2A] shadow-[0_0_20px_rgba(255,85,0,0.16)]' : 'border-white/[0.06] bg-[#07080C]/90 hover:border-white/15'} ${!isHost ? 'opacity-70' : ''}`}><div className="flex items-center justify-between gap-2"><span className="font-display text-xs font-bold text-[#F3F5F8]">{profile.name}</span><span className="rounded px-1.5 py-0.5 font-mono text-[9px] font-bold" style={{ backgroundColor: `${profile.accentColor}20`, color: profile.accentColor }}>{profile.badge}</span></div><p className="mt-1 text-[11px] leading-snug text-[#8E96AA]">{profile.description}</p></button>)}
                </div>
                <div className="space-y-2 rounded-xl p-3.5 studio-recessed"><div className="flex items-center justify-between"><span className="font-mono text-[10px] uppercase tracking-wider text-[#8E96AA]">SHARED EFFECT PRESET</span><Waves className="h-3.5 w-3.5 text-[#FF5500]" /></div><div className="grid grid-cols-2 gap-2">{EFFECT_PRESETS.map((effect) => <button key={effect.id} type="button" disabled={!isHost} onClick={() => onChangeEffect(effect.id)} className={`rounded-lg border p-2 text-left transition-all disabled:cursor-not-allowed ${effectPreset === effect.id ? 'border-[#00F0FF]/60 bg-[#00F0FF]/10 text-[#F3F5F8]' : 'border-white/[0.08] bg-[#07080C] text-[#8E96AA] hover:text-white'} ${!isHost ? 'opacity-60' : ''}`}><span className="block font-mono text-[11px] font-bold">{effect.label}</span><span className="mt-0.5 block text-[9px] leading-tight">{effect.detail}</span></button>)}</div></div>
              </div>
            ) : (
              <TrackPanel isHost={isHost} trackName={trackName} audioReady={audioReady} statusText={statusText} readyState={readyState} fileInputRef={fileInputRef} onUpload={onUpload} />
            )}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-white/[0.08] pt-3 font-mono text-[11px] text-[#8E96AA]"><span>SYNC BUFFER</span><span className="text-[#10B981]">{readyState?.readyCount ?? 0}/{readyState?.totalCount ?? peers.length} READY</span></div>
        </section>
      </div>

      <section className="studio-card flex flex-col items-center justify-between gap-4 rounded-2xl p-4 lg:flex-row">
        <div className="flex w-full shrink-0 items-center gap-3.5 lg:w-72">
          <div className="relative flex h-12 w-12 shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl border border-white/15" style={{ background: `radial-gradient(circle at center, ${mode.accentColor}35, #07080C 80%)` }}><span className="font-mono text-[10px] font-bold text-[#F3F5F8]">{mode.badge.split(' ')[0]}</span><span className="font-mono text-[9px] text-[#00F0FF]">SYNC</span></div>
          <div className="min-w-0 flex-1"><div className="truncate font-display text-sm font-bold text-[#F3F5F8]">{trackName}</div><div className="truncate text-xs text-[#8E96AA]">{activeTrack ? 'Host-loaded audio · synchronized transport' : 'The host can load an audio file in Track Input'}</div><div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-[#00F0FF]"><span>{mode.badge}</span><span>•</span><span>{readyState?.readyCount ?? 0}/{readyState?.totalCount ?? peers.length} NODES READY</span></div></div>
        </div>

        <div className="flex w-full flex-1 flex-col items-center gap-4 sm:flex-row">
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" disabled={!isHost || !duration} onClick={() => onSeek(0)} className="rounded-lg border border-white/10 bg-[#07080C] p-2 text-[#F3F5F8] transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40" title="Restart track"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" disabled={!isHost || !audioReady} onClick={onTogglePlay} className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FF5500] text-[#090A0F] shadow-[0_0_20px_rgba(255,85,0,0.4)] transition-all hover:bg-[#FF6922] disabled:cursor-not-allowed disabled:opacity-50" title={isHost ? (isPlaying ? 'Pause synchronized playback' : 'Play synchronized playback') : 'Playback is controlled by the room host'}>{isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}</button>
            <button type="button" disabled={!isHost || !duration} onClick={() => onSeek(Math.min(duration, position + 15))} className="rounded-lg border border-white/10 bg-[#07080C] p-2 text-[#F3F5F8] transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40" title="Skip forward 15 seconds"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="w-full flex-1 space-y-1">
            <div className="flex items-center justify-between font-mono text-[11px]"><span className="font-bold text-[#F3F5F8]">{formatTime(position)}</span><span className="flex items-center gap-1 text-[10px] text-[#10B981]"><span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />{isHost ? `BROADCASTING TO ${Math.max(0, peers.length - 1)} PEERS` : 'LOCKED TO HOST PLAYHEAD'}</span><span className="text-[#8E96AA]">{formatTime(duration)}</span></div>
            <div onClick={handleWaveformSeek} role="slider" aria-label="Playback position" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={position} className={`flex h-9 items-end gap-[3px] rounded-xl px-2.5 py-1.5 studio-recessed ${isHost && duration ? 'cursor-pointer' : 'cursor-not-allowed'}`}>{waveformPeaks.map((peak, index) => { const passed = duration > 0 && index / waveformPeaks.length <= position / duration; return <div key={index} className="flex-1 rounded-full transition-all duration-150" style={{ height: `${Math.max(18, peak)}%`, backgroundColor: passed ? mode.accentColor : 'rgba(255,255,255,0.12)' }} />; })}</div>
          </div>
        </div>

        <div className="flex w-full shrink-0 items-center gap-3 border-t border-white/[0.08] pt-3 lg:w-52 lg:border-t-0 lg:pt-0"><Volume2 className="h-4 w-4 shrink-0 text-[#8E96AA]" /><div className="flex-1"><div className="mb-1 flex justify-between font-mono text-[10px]"><span className="text-[#8E96AA]">LOCAL OUTPUT</span><span className="font-bold text-[#F3F5F8]">{masterVolume}%</span></div><input type="range" min={0} max={100} value={masterVolume} onChange={(event) => changeVolume(Number(event.target.value))} className="dsp-slider w-full" /></div></div>
      </section>
    </div>
  );
}

function PeerCard({ peer, selected, onClick }) {
  return <button type="button" onClick={onClick} className={`w-full rounded-xl border p-3 text-left transition-all ${selected ? 'border-[#00F0FF]/60 bg-[#181D2A] shadow-[0_0_20px_rgba(0,240,255,0.12)]' : 'border-white/[0.06] bg-[#07080C]/90 hover:border-white/15'}`}><div className="flex items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${peer.role === 'HOST' ? 'bg-[#FF5500]/20 text-[#FF5500]' : 'bg-[#00F0FF]/15 text-[#00F0FF]'}`}>{peer.role === 'HOST' ? <Crown className="h-3.5 w-3.5" /> : <Radio className="h-3.5 w-3.5" />}</div><div className="min-w-0"><div className="truncate text-xs font-semibold text-[#F3F5F8]">{peer.name}{peer.isMe ? ' (You)' : ''}</div><div className="truncate font-mono text-[10px] text-[#8E96AA]">{peer.channelLabel} • {peer.angleDeg}°</div></div></div><div className="flex shrink-0 items-center gap-1.5"><span className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-[#8E96AA]">{peer.latencyMs}ms</span><span className="block h-2 w-2 rounded-full bg-[#10B981]" /></div></div></button>;
}

function TabButton({ active, onClick, icon: Icon, color, children }) {
  return <button type="button" onClick={onClick} className={`flex items-center justify-center gap-1.5 rounded-lg py-2 font-mono text-xs font-semibold transition-all ${active ? 'border border-white/15 bg-[#181D2A] text-[#F3F5F8] shadow' : 'text-[#8E96AA] hover:text-white'}`}><Icon className={`h-3.5 w-3.5 ${color === 'orange' ? 'text-[#FF5500]' : 'text-[#00F0FF]'}`} />{children}</button>;
}

function TrackPanel({ isHost, trackName, audioReady, statusText, readyState, fileInputRef, onUpload }) {
  return <div className="space-y-3"><div className="flex items-center justify-between"><span className="font-mono text-[10px] uppercase text-[#8E96AA]">SYNCHRONIZED AUDIO</span><span className={`font-mono text-[10px] ${audioReady ? 'text-[#10B981]' : 'text-[#8E96AA]'}`}>{audioReady ? 'BUFFER READY' : 'AWAITING FILE'}</span></div><div className="rounded-xl border border-white/[0.06] bg-[#07080C] p-3"><div className="flex items-start gap-2.5"><div className="rounded-lg bg-[#FF5500]/10 p-2 text-[#FF5500]"><FileAudio className="h-4 w-4" /></div><div className="min-w-0"><p className="truncate font-display text-xs font-bold text-[#F3F5F8]">{trackName}</p><p className="mt-1 text-[11px] leading-relaxed text-[#8E96AA]">{statusText || (isHost ? 'Load an audio file to distribute it to the room.' : 'The room host has not loaded audio yet.')}</p></div></div></div>{isHost ? <><input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={(event) => { const [file] = event.target.files || []; if (file) onUpload(file); event.target.value = ''; }} /><button type="button" onClick={() => fileInputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#00F0FF]/30 bg-[#00F0FF]/12 px-3 py-3 font-mono text-xs font-bold text-[#00F0FF] transition-all hover:bg-[#00F0FF]/20"><Upload className="h-3.5 w-3.5" /> LOAD AUDIO FILE</button></> : <div className="rounded-xl border border-[#00F0FF]/20 bg-[#00F0FF]/5 p-3 text-center font-mono text-[11px] text-[#00F0FF]">Audio is selected by the host.</div>}<div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 font-mono text-[10px] text-[#8E96AA]">READY NODES: <span className="font-bold text-[#F3F5F8]">{readyState?.readyCount ?? 0}/{readyState?.totalCount ?? 0}</span></div></div>;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
}

function formatCode(code) {
  return code?.length > 2 ? `${code.slice(0, 2)}-${code.slice(2)}` : code || '----';
}
