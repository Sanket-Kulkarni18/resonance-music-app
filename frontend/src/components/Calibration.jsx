import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Compass,
  Cpu,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Volume2,
  Wifi,
} from 'lucide-react';
import { SPEAKER_ZONES, SPATIAL_MODES, polarToPlacement } from '../data/spatial.js';
import { playCalibrationChirp } from '../utils/calibrationAudio.js';

export function Calibration({
  roomCode,
  roomName,
  activeMode,
  peers,
  localPeer,
  clockSync,
  onBack,
  onEnterStudio,
  onSavePlacement,
}) {
  const initialZone = closestZone(localPeer?.angleDeg ?? 0);
  const [selectedZone, setSelectedZone] = useState(initialZone);
  const [customAngle, setCustomAngle] = useState(localPeer?.angleDeg ?? initialZone.angleDeg);
  const [distanceRing, setDistanceRing] = useState(localPeer?.distanceRing ?? initialZone.distanceRing);
  const [localOffsetMs, setLocalOffsetMs] = useState(0);
  const [isSweeping, setIsSweeping] = useState(false);
  const [sweepProgress, setSweepProgress] = useState(100);
  const mode = SPATIAL_MODES[activeMode] || SPATIAL_MODES.normal;

  useEffect(() => {
    if (!isSweeping) return undefined;
    const timer = window.setInterval(() => {
      setSweepProgress((current) => {
        if (current >= 100) {
          window.clearInterval(timer);
          setIsSweeping(false);
          return 100;
        }
        return Math.min(100, current + 10);
      });
    }, 85);
    return () => window.clearInterval(timer);
  }, [isSweeping]);

  const selectZone = (zone) => {
    setSelectedZone(zone);
    setCustomAngle(zone.angleDeg);
    setDistanceRing(zone.distanceRing);
    playCalibrationChirp(zone.panValue);
  };

  const triggerSweep = () => {
    setSweepProgress(0);
    setIsSweeping(true);
    playCalibrationChirp(-0.8);
    window.setTimeout(() => playCalibrationChirp(0), 220);
    window.setTimeout(() => playCalibrationChirp(0.8), 440);
  };

  const saveAndContinue = () => {
    playCalibrationChirp(Math.sin((customAngle * Math.PI) / 180));
    onSavePlacement({
      ...polarToPlacement(customAngle, distanceRing),
      localOffsetMs,
    });
    onEnterStudio();
  };

  const activeNode = polarToCanvas(customAngle, 112);
  const offset = Number.isFinite(clockSync?.offset) ? clockSync.offset : 0;
  const rtt = Number.isFinite(clockSync?.rtt) ? clockSync.rtt : 0;
  const correlation = Math.max(80, Math.min(100, 100 - Math.abs(offset) * 0.25 - Math.min(rtt, 80) * 0.03)).toFixed(1);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-acoustic-grid px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col justify-between gap-4 border-b border-white/[0.08] pb-5 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs text-[#00F0FF]">
              <Compass className="h-4 w-4" />
              <span>PAGE 02 // ACOUSTIC CALIBRATION & SPEAKER PLACEMENT</span>
              <span className="text-white/20">•</span>
              <span className="uppercase text-[#FF5500]">THIS DEVICE</span>
            </div>
            <h1 className="mt-1 font-display text-2xl font-extrabold text-[#F3F5F8] sm:text-3xl">POSITION YOUR DEVICE IN THE 360° SOUNDSTAGE</h1>
            <p className="mt-0.5 text-xs text-[#8E96AA] sm:text-sm">Choose where this device is physically placed for <span className="font-medium text-white">{mode.name}</span>. Its position is shared with the room.</p>
          </div>
          <div className="flex items-center gap-2.5 self-start sm:self-center">
            <button onClick={onBack} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2 font-mono text-xs text-[#8E96AA] transition-colors hover:bg-white/[0.1] hover:text-white"><ArrowLeft className="h-3.5 w-3.5" /> BACK TO STUDIO</button>
            <button onClick={saveAndContinue} className="inline-flex items-center gap-2 rounded-xl bg-[#FF5500] px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-[#090A0F] shadow-[0_0_20px_rgba(255,85,0,0.35)] transition-all hover:bg-[#FF6922]"><span>ENTER LIVE STUDIO</span><ArrowRight className="h-3.5 w-3.5" /></button>
          </div>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-12">
          <section className="studio-card space-y-6 rounded-2xl p-6 lg:col-span-7">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div>
                <span className="block font-mono text-[10px] uppercase tracking-wider text-[#00F0FF]">STEP 1 // PHYSICAL GEOMETRY</span>
                <h2 className="font-display text-lg font-bold text-[#F3F5F8]">SELECT SPEAKER CHANNEL OR AZIMUTH</h2>
              </div>
              <div className="text-right font-mono"><div className="text-xs text-[#8E96AA]">ASSIGNED VECTOR</div><div className="text-sm font-bold text-[#FF5500]">{customAngle}° • {selectedZone.code}</div></div>
            </div>

            <div className="grid items-center gap-6 md:grid-cols-12">
              <div className="flex justify-center md:col-span-7">
                <div className="relative flex h-[320px] w-[320px] items-center justify-center rounded-2xl p-2 studio-recessed sm:h-[340px] sm:w-[340px]">
                  <svg viewBox="0 0 340 340" className="h-full w-full overflow-visible">
                    <defs>
                      <radialGradient id="calibrationGlow" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#FF5500" stopOpacity="0.22" /><stop offset="65%" stopColor="#00F0FF" stopOpacity="0.06" /><stop offset="100%" stopColor="#000" stopOpacity="0" /></radialGradient>
                    </defs>
                    <circle cx="170" cy="170" r="145" fill="url(#calibrationGlow)" />
                    <circle cx="170" cy="170" r="55" fill="none" stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                    <circle cx="170" cy="170" r="112" fill="none" stroke="rgba(0,240,255,0.22)" strokeWidth="1.2" />
                    <circle cx="170" cy="170" r="148" fill="none" stroke="rgba(255,255,255,0.08)" />
                    <line x1="170" y1="15" x2="170" y2="325" stroke="rgba(255,255,255,0.06)" />
                    <line x1="15" y1="170" x2="325" y2="170" stroke="rgba(255,255,255,0.06)" />
                    <text x="170" y="16" textAnchor="middle" className="fill-[#8E96AA] text-[9px] font-mono">0° FRONT STAGE</text>
                    <text x="170" y="334" textAnchor="middle" className="fill-[#8E96AA] text-[9px] font-mono">180° REAR WALL</text>

                    {peers.filter((peer) => peer.id !== localPeer?.id).map((peer) => {
                      const point = polarToCanvas(peer.angleDeg, peer.distanceRing * 160);
                      return <circle key={peer.id} cx={point.x} cy={point.y} r="5" fill="#00F0FF" opacity="0.45" />;
                    })}

                    {SPEAKER_ZONES.map((zone) => {
                      const point = polarToCanvas(zone.angleDeg, 112);
                      const active = selectedZone.id === zone.id;
                      return <g key={zone.id} onClick={() => selectZone(zone)} className="cursor-pointer"><circle cx={point.x} cy={point.y} r={active ? 18 : 13} fill={active ? '#FF5500' : '#12151E'} stroke={active ? '#FFF' : 'rgba(255,255,255,0.25)'} strokeWidth={active ? 2 : 1} /><text x={point.x} y={point.y + 3} textAnchor="middle" className={`select-none font-mono text-[8px] font-bold ${active ? 'fill-[#090A0F]' : 'fill-[#F3F5F8]'}`}>{zone.code.split(' ')[0]}</text></g>;
                    })}

                    <line x1="170" y1="170" x2={activeNode.x} y2={activeNode.y} stroke="#FF5500" strokeWidth="2" strokeDasharray="4 4" />
                    <circle cx="170" cy="170" r="22" fill="#12151E" stroke="#00F0FF" strokeWidth="1.5" /><path d="M163 166 C163 160,177 160,177 166" stroke="#00F0FF" strokeWidth="1.5" fill="none" /><circle cx="170" cy="172" r="5" fill="#F3F5F8" /><text x="170" y="204" textAnchor="middle" className="fill-[#00F0FF] font-mono text-[8px] font-bold">SWEET SPOT</text>
                  </svg>
                </div>
              </div>

              <div className="space-y-2 md:col-span-5">
                <div className="mb-2 font-mono text-[11px] uppercase text-[#8E96AA]">CLICK A CHANNEL SLOT TO ASSIGN:</div>
                <div className="max-h-[290px] space-y-1.5 overflow-y-auto pr-1">
                  {SPEAKER_ZONES.map((zone) => {
                    const active = selectedZone.id === zone.id;
                    return <button key={zone.id} type="button" onClick={() => selectZone(zone)} className={`flex w-full items-center justify-between rounded-xl border p-2.5 text-left transition-all ${active ? 'border-[#FF5500] bg-[#FF5500]/15 text-[#F3F5F8]' : 'border-white/[0.06] bg-[#07080C] text-[#8E96AA] hover:border-white/15 hover:text-white'}`}><div><div className="font-mono text-xs font-bold text-[#F3F5F8]">{zone.label}</div><div className="font-mono text-[10px] text-[#8E96AA]">Azimuth {zone.angleDeg}°</div></div><span className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold ${active ? 'bg-[#FF5500] text-[#090A0F]' : 'bg-white/[0.06] text-[#8E96AA]'}`}>{zone.code}</span></button>;
                  })}
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between gap-4 border-t border-white/[0.08] pt-4 sm:flex-row sm:items-center">
              <div className="flex-1 space-y-3">
                <Slider label="CUSTOM AZIMUTH FINE-TUNE" value={`${customAngle}°`} min={0} max={359} valueNumber={customAngle} onChange={(value) => setCustomAngle(value)} accent="cyan" />
                <Slider label="DISTANCE FROM LISTENER" value={`${distanceRing.toFixed(2)} m map`} min={0.28} max={0.9} step={0.01} valueNumber={distanceRing} onChange={(value) => setDistanceRing(value)} accent="orange" />
              </div>
              <button type="button" onClick={() => playCalibrationChirp(Math.sin((customAngle * Math.PI) / 180))} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[#00F0FF]/40 bg-[#00F0FF]/15 px-4 py-2.5 font-mono text-xs font-bold text-[#00F0FF] transition-colors hover:bg-[#00F0FF]/25"><Volume2 className="h-4 w-4" /> TEST SPEAKER CHIRP</button>
            </div>
          </section>

          <section className="studio-card space-y-6 rounded-2xl p-6 lg:col-span-5">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div><span className="block font-mono text-[10px] uppercase tracking-wider text-[#10B981]">STEP 2 // PHASE ALIGNMENT</span><h2 className="font-display text-lg font-bold text-[#F3F5F8]">CLOCK & BUFFER LOCK</h2></div>
              <span className="flex items-center gap-1.5 rounded-full border border-[#10B981]/30 bg-[#10B981]/15 px-2.5 py-1 font-mono text-[11px] font-bold text-[#10B981]"><CheckCircle2 className="h-3.5 w-3.5" />{isSweeping ? 'ALIGNING...' : 'SYNCED'}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Telemetry icon={Wifi} iconColor="cyan" label="CLOCK OFFSET" value={`${offset >= 0 ? '+' : ''}${offset}`} unit="ms" detail="Best clock-sync sample" />
              <Telemetry icon={Cpu} iconColor="orange" label="ROUND-TRIP TIME" value={rtt} unit="ms" detail="Most recent best RTT" />
            </div>

            <div className="space-y-3 rounded-xl p-4 studio-recessed">
              <div className="flex items-center justify-between font-mono text-xs"><span className="text-[#8E96AA]">ACOUSTIC IMPULSE ALIGNMENT</span><span className="text-[#10B981]">{sweepProgress}% VERIFIED</span></div>
              <div className="flex h-14 items-end gap-1 pt-2">{Array.from({ length: 28 }).map((_, index) => { const active = (index / 28) * 100 <= sweepProgress; const height = 30 + Math.abs(Math.sin(index * 0.45) * 55) + (index % 3 === 0 ? 12 : 0); return <div key={index} className="flex-1 rounded-t transition-all duration-150" style={{ height: `${height}%`, backgroundColor: active ? (index % 4 === 0 ? '#00F0FF' : '#10B981') : 'rgba(255,255,255,0.08)' }} />; })}</div>
              <button type="button" onClick={triggerSweep} className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] py-2 font-mono text-xs text-[#F3F5F8] transition-colors hover:bg-white/[0.1]"><RefreshCw className={`h-3.5 w-3.5 ${isSweeping ? 'animate-spin text-[#00F0FF]' : ''}`} /> RE-RUN 3-CHANNEL TEST SWEEP</button>
            </div>

            <div className="space-y-2 rounded-xl border border-white/[0.06] bg-[#07080C] p-4">
              <div className="flex items-center justify-between font-mono text-xs"><span className="flex items-center gap-1.5 text-[#8E96AA]"><SlidersHorizontal className="h-3.5 w-3.5 text-[#FF5500]" /> LOCAL SPEAKER OFFSET</span><span className="font-bold text-[#F3F5F8]">{localOffsetMs > 0 ? '+' : ''}{localOffsetMs} ms</span></div>
              <input type="range" min={-15} max={15} step={0.5} value={localOffsetMs} onChange={(event) => setLocalOffsetMs(Number(event.target.value))} className="dsp-slider w-full" />
              <p className="text-[11px] text-[#8E96AA]">This is a local preference for an external speaker. The shared server clock stays unchanged.</p>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2.5 rounded-xl border border-[#10B981]/25 bg-[#10B981]/10 p-3 text-xs text-[#D5DAE5]"><ShieldCheck className="h-4 w-4 shrink-0 text-[#10B981]" /><span>Syncing <strong className="text-white">{roomName}</strong> ({roomCode}) as <strong className="text-[#00F0FF]">{selectedZone.code}</strong> · phase score {correlation}%</span></div>
              <button type="button" onClick={saveAndContinue} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF5500] px-5 py-3.5 font-mono text-xs font-bold uppercase tracking-wider text-[#090A0F] shadow-[0_0_30px_rgba(255,85,0,0.4)] transition-all hover:bg-[#FF6922]"><span>LAUNCH LIVE SPATIAL STUDIO</span><ArrowRight className="h-4 w-4" /></button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function polarToCanvas(angleDeg, radius) {
  const radians = ((angleDeg - 90) * Math.PI) / 180;
  return { x: 170 + radius * Math.cos(radians), y: 170 + radius * Math.sin(radians) };
}

function closestZone(angleDeg) {
  return SPEAKER_ZONES.reduce((nearest, zone) => {
    const delta = Math.abs(((zone.angleDeg - angleDeg + 540) % 360) - 180);
    const closestDelta = Math.abs(((nearest.angleDeg - angleDeg + 540) % 360) - 180);
    return delta < closestDelta ? zone : nearest;
  }, SPEAKER_ZONES[0]);
}

function Slider({ label, value, valueNumber, min, max, step = 1, onChange, accent }) {
  return <div><div className="mb-1.5 flex items-center justify-between font-mono text-xs"><span className="text-[#8E96AA]">{label}</span><span className={accent === 'cyan' ? 'font-bold text-[#00F0FF]' : 'font-bold text-[#FF5500]'}>{value}</span></div><input type="range" min={min} max={max} step={step} value={valueNumber} onChange={(event) => onChange(Number(event.target.value))} className="dsp-slider w-full" /></div>;
}

function Telemetry({ icon: Icon, iconColor, label, value, unit, detail }) {
  return <div className="rounded-xl p-3.5 studio-recessed"><div className="flex items-center gap-1.5 font-mono text-[10px] text-[#8E96AA]"><Icon className={`h-3.5 w-3.5 ${iconColor === 'cyan' ? 'text-[#00F0FF]' : 'text-[#FF5500]'}`} />{label}</div><div className="mt-1 font-mono text-xl font-bold text-[#F3F5F8]">{value} <span className="text-xs text-[#10B981]">{unit}</span></div><div className="mt-0.5 font-mono text-[10px] text-[#8E96AA]">{detail}</div></div>;
}
