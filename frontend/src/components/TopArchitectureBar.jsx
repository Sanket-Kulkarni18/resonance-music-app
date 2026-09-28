import { useState } from 'react';
import {
  Activity,
  Compass,
  Crown,
  Info,
  Layers,
  Radio,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { SPATIAL_MODES } from '../data/spatial.js';

const pages = [
  { id: 'portal', step: '01', label: 'ROOM PORTAL', shortLabel: 'PORTAL', sub: 'Host or enter a code', icon: Radio },
  { id: 'calibration', step: '02', label: 'CALIBRATION', shortLabel: 'CALIBRATE', sub: 'Clock and speaker placement', icon: Compass },
  { id: 'studio', step: '03', label: 'LIVE STUDIO', shortLabel: 'STUDIO', sub: 'Spatial map and transport', icon: SlidersHorizontal },
];

function prettyCode(roomCode) {
  if (!roomCode) return '----';
  return roomCode.length > 2 ? `${roomCode.slice(0, 2)}-${roomCode.slice(2)}` : roomCode;
}

export function TopArchitectureBar({
  activePage,
  onNavigate,
  inRoom,
  isHost,
  roomCode,
  roomName,
  activeMode,
  peerCount,
  connected,
}) {
  const [showGuide, setShowGuide] = useState(false);
  const mode = SPATIAL_MODES[activeMode] || SPATIAL_MODES.normal;

  const navigate = (page) => {
    if (page === 'portal' || inRoom) onNavigate(page);
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#090A0F]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6">
          <button onClick={() => navigate('portal')} className="group flex min-w-0 items-center gap-2.5 text-left focus:outline-none">
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/15 bg-[#12151E] transition-colors group-hover:border-[#FF5500]/60">
              <div
                className="absolute inset-0 opacity-30"
                style={{ background: `radial-gradient(circle at center, ${mode.accentColor}, transparent 70%)` }}
              />
              <Activity className="relative z-10 h-4 w-4 text-[#FF5500]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-bold tracking-wider text-[#F3F5F8]">
                  AETHER<span className="text-[#FF5500]">//</span>SYNC
                </span>
                <span className="hidden rounded border border-white/[0.06] bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[#8E96AA] md:inline-flex">
                  LIVE SYNC
                </span>
              </div>
              <p className="hidden truncate font-mono text-[11px] text-[#8E96AA] sm:block">
                {inRoom ? (
                  <>
                    {roomName} <span className="text-white/30">•</span> CODE <span className="text-[#00F0FF]">{prettyCode(roomCode)}</span>
                  </>
                ) : (
                  'Multi-device spatial playback'
                )}
              </p>
            </div>
          </button>

          <nav aria-label="Session navigation" className="flex items-center rounded-xl border border-white/[0.08] bg-[#07080C] p-1 shadow-inner">
            {pages.map((page, index) => {
              const Icon = page.icon;
              const isActive = activePage === page.id;
              const isDisabled = page.id !== 'portal' && !inRoom;
              return (
                <div key={page.id} className="flex items-center">
                  <button
                    type="button"
                    aria-current={isActive ? 'page' : undefined}
                    disabled={isDisabled}
                    title={isDisabled ? 'Create or join a room first' : page.sub}
                    onClick={() => navigate(page.id)}
                    className={`relative flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs transition-all sm:px-3 ${
                      isActive
                        ? 'border-white/15 bg-[#181D2A] text-[#F3F5F8] shadow-[0_0_20px_rgba(255,85,0,0.18)]'
                        : 'border-transparent text-[#8E96AA] hover:bg-white/[0.03] hover:text-[#F3F5F8]'
                    } disabled:cursor-not-allowed disabled:opacity-35`}
                  >
                    <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${isActive ? 'bg-[#FF5500] font-bold text-[#090A0F]' : 'bg-white/[0.06]'}`}>
                      {page.step}
                    </span>
                    <Icon className="h-3.5 w-3.5 lg:hidden" />
                    <span className="hidden font-semibold tracking-wide lg:inline">{page.label}</span>
                    <span className="hidden font-semibold sm:inline lg:hidden">{page.shortLabel}</span>
                  </button>
                  {index < pages.length - 1 && <span className="hidden px-1 font-mono text-xs text-white/15 sm:inline">/</span>}
                </div>
              );
            })}
          </nav>

          <div className="flex items-center gap-2.5">
            {inRoom && (
              <div className={`hidden items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[11px] sm:flex ${isHost ? 'border-[#FF5500]/30 bg-[#FF5500]/10 text-[#FF5500]' : 'border-[#00F0FF]/30 bg-[#00F0FF]/10 text-[#00F0FF]'}`}>
                {isHost ? <Crown className="h-3.5 w-3.5" /> : <Radio className="h-3.5 w-3.5" />}
                <span>{isHost ? 'HOST' : 'PEER'}</span>
              </div>
            )}
            <div className="hidden items-center gap-2 rounded-lg border border-white/[0.08] bg-[#12151E] px-2.5 py-1.5 font-mono text-[11px] xl:flex">
              <span className={`h-2 w-2 rounded-full ${connected ? 'animate-pulse bg-[#10B981]' : 'bg-[#EF4444]'}`} />
              <span className="text-[#8E96AA]">NODES:</span>
              <span className="font-semibold text-[#F3F5F8]">{peerCount || 0}</span>
            </div>
            <button
              type="button"
              onClick={() => setShowGuide(true)}
              className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.05] px-2.5 py-1.5 font-mono text-xs text-[#F3F5F8] transition-colors hover:bg-white/[0.1] sm:px-3"
            >
              <Layers className="h-3.5 w-3.5 text-[#00F0FF]" />
              <span className="hidden md:inline">SESSION GUIDE</span>
            </button>
          </div>
        </div>
      </header>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <section role="dialog" aria-modal="true" aria-label="Session guide" className="studio-card w-full max-w-2xl overflow-hidden rounded-2xl border border-white/15 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 bg-[#0C0E15] px-6 py-4">
              <div className="flex items-center gap-2.5">
                <Info className="h-4 w-4 text-[#FF5500]" />
                <h2 className="font-display text-sm font-bold tracking-wider text-[#F3F5F8]">HOW THIS SESSION WORKS</h2>
              </div>
              <button onClick={() => setShowGuide(false)} className="rounded-lg p-1.5 text-[#8E96AA] transition-colors hover:bg-white/10 hover:text-white" aria-label="Close guide">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-6 text-sm text-[#8E96AA]">
              <div className="rounded-xl border border-[#FF5500]/30 bg-[#FF5500]/10 p-4">
                <p className="mb-1 font-mono text-xs font-bold uppercase tracking-wider text-[#FF5500]">1. Create or join</p>
                <p>Hosts create a four-character room code and load audio. Every peer joins with that code and receives the same scheduled transport.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-[#0C0E15] p-4">
                  <p className="mb-1 font-mono text-xs font-bold text-[#00F0FF]">2. Calibrate</p>
                  <p className="text-xs leading-relaxed">Each device chooses its physical speaker position. The map is shared with the room and drives the spatial panner.</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#0C0E15] p-4">
                  <p className="mb-1 font-mono text-xs font-bold text-[#10B981]">3. Perform</p>
                  <p className="text-xs leading-relaxed">The host controls audio, transport, effects and spatial mode. Peers stay locked to the room clock and can request host control.</p>
                </div>
              </div>
              <button onClick={() => setShowGuide(false)} className="w-full rounded-xl bg-[#FF5500] px-4 py-3 font-mono text-xs font-bold text-[#090A0F] transition-colors hover:bg-[#FF6922]">
                CONTINUE TO SESSION
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
