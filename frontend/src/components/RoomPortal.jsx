import { useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Disc3,
  Headphones,
  Radio,
  Shield,
  Speaker,
  Sparkles,
  Users,
  Volume2,
  Wifi,
  Zap,
} from 'lucide-react';
import { SPATIAL_MODES } from '../data/spatial.js';
import { playCalibrationChirp } from '../utils/calibrationAudio.js';

export function RoomPortal({
  displayName,
  setDisplayName,
  roomName,
  setRoomName,
  roomCode,
  setRoomCode,
  activeMode,
  setActiveMode,
  onCreate,
  onJoin,
  busy,
  error,
}) {
  const [topologyMode, setTopologyMode] = useState('array');
  const digitRefs = useRef([]);
  const codeChars = Array.from({ length: 4 }, (_, index) => roomCode[index] || '');
  const selectedMode = SPATIAL_MODES[activeMode] || SPATIAL_MODES.normal;

  const updateCodeDigit = (index, raw) => {
    const value = raw.replace(/[^0-9a-z]/gi, '').toUpperCase().slice(-1);
    const next = [...codeChars];
    next[index] = value;
    setRoomCode(next.join(''));
    if (value && index < 3) digitRefs.current[index + 1]?.focus();
  };

  const handleCodeKeyDown = (event, index) => {
    if (event.key === 'Backspace' && !codeChars[index] && index > 0) {
      digitRefs.current[index - 1]?.focus();
    }
    if (event.key === 'Enter') onJoin(false);
  };

  const chooseMode = (mode) => {
    setActiveMode(mode);
    playCalibrationChirp(mode === '8d' ? -0.5 : mode === '16d' ? 0.5 : 0);
  };

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] flex-col justify-between overflow-hidden bg-acoustic-grid px-4 py-8 sm:px-6">
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[950px] -translate-x-1/2 blur-3xl"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(255,85,0,0.28) 0%, rgba(0,240,255,0.14) 45%, transparent 75%)',
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-6xl space-y-8">
        <div className="mx-auto max-w-3xl space-y-3 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#12151E] px-3 py-1 font-mono text-[11px] text-[#8E96AA]">
            <span className="h-2 w-2 animate-ping rounded-full bg-[#FF5500]" />
            <span className="font-semibold text-[#F3F5F8]">PAGE 01 // SESSION GATEWAY</span>
            <span>•</span>
            <span className="text-[#00F0FF]">MULTI-DEVICE CLOCK SYNC</span>
          </div>
          <h1 className="font-display text-3xl font-extrabold leading-[1.08] tracking-tight text-[#F3F5F8] sm:text-5xl">
            ONE HOST. MULTIPLE PEERS.{' '}
            <span className="bg-gradient-to-r from-[#FF5500] via-[#FF8844] to-[#00F0FF] bg-clip-text text-transparent">
              ONE SHARED SOUNDSTAGE.
            </span>
          </h1>
          <p className="mx-auto max-w-2xl text-sm leading-relaxed text-[#8E96AA] sm:text-base">
            Create a room for a synchronized listening session, then place each connected phone, tablet, or laptop in the shared 360° speaker map.
          </p>
        </div>

        <div className="grid items-stretch gap-6 lg:grid-cols-12">
          <section className="studio-card relative flex flex-col justify-between overflow-hidden rounded-2xl p-6 sm:p-7 lg:col-span-7">
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded border border-[#FF5500]/30 bg-[#FF5500]/20 px-2 py-0.5 font-mono text-[10px] font-bold text-[#FF5500]">MASTER TRANSMITTER</span>
                    <span className="font-mono text-xs text-[#8E96AA]">HOST CONSOLE</span>
                  </div>
                  <h2 className="mt-1.5 font-display text-xl font-bold text-[#F3F5F8] sm:text-2xl">HOST A SPATIAL ROOM</h2>
                  <p className="mt-0.5 text-xs text-[#8E96AA]">Your device becomes the shared transport controller and master clock.</p>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#FF5500]/30 bg-[#FF5500]/10">
                  <Radio className="h-5 w-5 text-[#FF5500]" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="YOUR DISPLAY NAME" accent="orange">
                  <input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && onCreate(false)}
                    placeholder="e.g. Sanket"
                    maxLength={32}
                    className="portal-input w-full"
                  />
                </Field>
                <Field label="ROOM / STUDIO IDENTIFIER" accent="orange">
                  <input
                    value={roomName}
                    onChange={(event) => setRoomName(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && onCreate(false)}
                    placeholder="e.g. Rooftop listening room"
                    maxLength={48}
                    className="portal-input w-full"
                  />
                </Field>
              </div>

              <div>
                <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-[#8E96AA]">MULTI-DEVICE ACOUSTIC TOPOLOGY</label>
                <div className="grid grid-cols-2 gap-2 rounded-xl p-1 studio-recessed">
                  <button
                    type="button"
                    onClick={() => setTopologyMode('array')}
                    className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 font-mono text-xs transition-all ${topologyMode === 'array' ? 'border border-white/15 bg-[#181D2A] text-[#F3F5F8] shadow' : 'text-[#8E96AA] hover:text-white'}`}
                  >
                    <Speaker className="h-3.5 w-3.5 text-[#FF5500]" /> SPEAKER ARRAY
                  </button>
                  <button
                    type="button"
                    onClick={() => setTopologyMode('headphones')}
                    className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 font-mono text-xs transition-all ${topologyMode === 'headphones' ? 'border border-white/15 bg-[#181D2A] text-[#F3F5F8] shadow' : 'text-[#8E96AA] hover:text-white'}`}
                  >
                    <Headphones className="h-3.5 w-3.5 text-[#00F0FF]" /> HEADPHONE SYNC
                  </button>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="font-mono text-[11px] uppercase tracking-wider text-[#8E96AA]">SELECT INITIAL SPATIAL PROFILE</label>
                  <span className="font-mono text-[11px] text-[#00F0FF]">{selectedMode.channelCount}</span>
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {Object.values(SPATIAL_MODES).map((mode) => {
                    const selected = mode.id === activeMode;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => chooseMode(mode.id)}
                        className={`relative overflow-hidden rounded-xl border p-3.5 text-left transition-all ${selected ? 'border-[#FF5500] bg-[#181D2A] shadow-[0_0_25px_rgba(255,85,0,0.15)]' : 'border-white/[0.07] bg-[#0C0E15]/90 hover:border-white/20'}`}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="rounded px-1.5 py-0.5 font-mono text-[10px] font-bold" style={{ backgroundColor: `${mode.accentColor}20`, color: mode.accentColor }}>{mode.badge}</span>
                          <span className="font-mono text-[10px] text-[#8E96AA]">{mode.channelCount}</span>
                        </div>
                        <div className="font-display text-sm font-bold text-[#F3F5F8]">{mode.name}</div>
                        <p className="mt-1 text-[11px] leading-relaxed text-[#8E96AA]">{mode.subtitle}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col items-stretch justify-between gap-3 border-t border-white/[0.08] pt-6 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2 font-mono text-xs text-[#8E96AA]">
                <Shield className="h-4 w-4 shrink-0 text-[#10B981]" />
                <span>Generates a private four-character invite code</span>
              </div>
              <div className="flex items-center gap-2.5">
                <button type="button" disabled={busy} onClick={() => onCreate(true)} className="rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-3 font-mono text-xs text-[#F3F5F8] transition-colors hover:bg-white/[0.1] disabled:opacity-50">
                  {busy ? 'CONNECTING...' : 'SKIP TO STUDIO'}
                </button>
                <button type="button" disabled={busy} onClick={() => onCreate(false)} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#FF5500] px-5 py-3 font-mono text-xs font-bold tracking-wider text-[#090A0F] shadow-[0_0_25px_rgba(255,85,0,0.4)] transition-all hover:bg-[#FF6922] disabled:cursor-wait disabled:opacity-50 sm:flex-initial">
                  <span>{busy ? 'CREATING...' : 'CREATE & CALIBRATE'}</span><ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>

          <section className="studio-card relative flex flex-col justify-between overflow-hidden rounded-2xl p-6 sm:p-7 lg:col-span-5">
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded border border-[#00F0FF]/30 bg-[#00F0FF]/15 px-2 py-0.5 font-mono text-[10px] font-bold text-[#00F0FF]">PEER RECEIVER NODE</span>
                    <span className="font-mono text-xs text-[#8E96AA]">SYNC CLIENT</span>
                  </div>
                  <h2 className="mt-1.5 font-display text-xl font-bold text-[#F3F5F8] sm:text-2xl">ENTER ROOM CODE</h2>
                  <p className="mt-0.5 text-xs text-[#8E96AA]">Join a room as a synchronized listener and place your device in its speaker map.</p>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#00F0FF]/30 bg-[#00F0FF]/10">
                  <Wifi className="h-5 w-5 text-[#00F0FF]" />
                </div>
              </div>

              <Field label="YOUR DISPLAY NAME" accent="cyan">
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && onJoin(false)}
                  placeholder="e.g. Maya"
                  maxLength={32}
                  className="portal-input cyan w-full"
                />
              </Field>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="font-mono text-[11px] uppercase tracking-wider text-[#8E96AA]">4-CHARACTER SESSION CODE</label>
                  <span className="flex items-center gap-1 font-mono text-[11px] text-[#10B981]"><CheckCircle2 className="h-3 w-3" /> READY TO JOIN</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  {codeChars.map((digit, index) => (
                    <input
                      key={index}
                      ref={(element) => { digitRefs.current[index] = element; }}
                      value={digit}
                      onChange={(event) => updateCodeDigit(index, event.target.value)}
                      onKeyDown={(event) => handleCodeKeyDown(event, index)}
                      onPaste={(event) => {
                        const pasted = event.clipboardData.getData('text').replace(/[^0-9a-z]/gi, '').toUpperCase().slice(0, 4);
                        if (pasted) {
                          event.preventDefault();
                          setRoomCode(pasted);
                          digitRefs.current[Math.min(pasted.length, 3)]?.focus();
                        }
                      }}
                      aria-label={`Room code character ${index + 1}`}
                      maxLength={1}
                      className="h-14 min-w-0 flex-1 rounded-xl border border-white/15 bg-[#07080C] text-center font-mono text-2xl font-bold text-[#00F0FF] outline-none transition-all focus:border-[#00F0FF] focus:shadow-[0_0_15px_rgba(0,240,255,0.25)]"
                    />
                  ))}
                </div>
                <p className="mt-3 text-center font-mono text-[11px] leading-relaxed text-[#8E96AA]">Ask the host for the code shown in their Live Studio. Room codes are active while the host remains connected.</p>
              </div>

              <div className="space-y-3 rounded-xl border border-white/10 bg-[#07080C] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><span className="h-2 w-2 animate-pulse rounded-full bg-[#10B981]" /><span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#10B981]">JOIN RECEIVER</span></div>
                  <span className="font-mono text-[11px] text-[#8E96AA]">CLOCK HANDSHAKE</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#00F0FF]/20 bg-[#00F0FF]/10"><Users className="h-4 w-4 text-[#00F0FF]" /></div>
                  <div>
                    <p className="font-display text-sm font-bold text-[#F3F5F8]">Ready for the host room</p>
                    <p className="mt-0.5 text-xs text-[#8E96AA]">After joining, verify your speaker position before entering the studio.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 border-t border-white/[0.06] pt-2 font-mono text-[10px] text-[#8E96AA]"><Disc3 className="h-3.5 w-3.5 animate-spin text-[#FF5500]" /> Waiting for a room code and active host</div>
              </div>
            </div>

            <div className="mt-6 flex flex-col items-stretch gap-2.5 border-t border-white/[0.08] pt-6 sm:flex-row sm:items-center">
              <button type="button" disabled={busy} onClick={() => onJoin(true)} className="rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-3 font-mono text-xs text-[#F3F5F8] transition-colors hover:bg-white/[0.1] disabled:opacity-50">DIRECT JOIN</button>
              <button type="button" disabled={busy} onClick={() => onJoin(false)} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#00F0FF] px-5 py-3 font-mono text-xs font-bold tracking-wider text-[#090A0F] shadow-[0_0_25px_rgba(0,240,255,0.35)] transition-all hover:bg-[#33F3FF] disabled:cursor-wait disabled:opacity-50">
                <span>{busy ? 'JOINING...' : 'JOIN & ASSIGN SPEAKER'}</span><ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        </div>

        {error && <div role="alert" className="rounded-xl border border-[#EF4444]/40 bg-[#EF4444]/10 px-4 py-3 text-center font-mono text-xs text-[#FCA5A5]">{error}</div>}

        <div className="grid gap-4 pt-2 md:grid-cols-3">
          <Feature icon={Zap} color="orange" title="CLOCK-SCHEDULED PLAYBACK">The server schedules a shared start time and clients continually correct playback drift.</Feature>
          <Feature icon={Volume2} color="cyan" title="PLACEMENT-DRIVEN 8D / 16D">Map each participating device around the listener before enabling orbital spatial modes.</Feature>
          <Feature icon={Sparkles} color="green" title="AMBIENT DOME PROFILE">Use the Atmosphere profile for the app’s HRTF panning and light convolution reverb.</Feature>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <div><label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-[#8E96AA]">{label}</label>{children}</div>;
}

function Feature({ icon: Icon, color, title, children }) {
  const colors = {
    orange: 'bg-[#FF5500]/10 text-[#FF5500]',
    cyan: 'bg-[#00F0FF]/10 text-[#00F0FF]',
    green: 'bg-[#10B981]/10 text-[#10B981]',
  };
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-[#12151E]/70 p-4">
      <div className={`shrink-0 rounded-lg p-2 ${colors[color]}`}><Icon className="h-4 w-4" /></div>
      <div><h3 className="font-mono text-xs font-bold uppercase text-[#F3F5F8]">{title}</h3><p className="mt-0.5 text-xs leading-relaxed text-[#8E96AA]">{children}</p></div>
    </div>
  );
}
