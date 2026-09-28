import { useEffect, useState, useRef } from 'react';
import { Volume2, RotateCw, Radio, } from 'lucide-react';
import { SPATIAL_MODES } from '../data/spatial.js';
import { spatialAudio } from '../utils/spatialAudioEngine.js';
const ATMOS_HEIGHT_CHANNELS = [
    { code: 'TFL', label: 'Top Front Left', angle: 320, radius: 0.44 },
    { code: 'TFR', label: 'Top Front Right', angle: 40, radius: 0.44 },
    { code: 'TRL', label: 'Top Rear Left', angle: 220, radius: 0.44 },
    { code: 'TRR', label: 'Top Rear Right', angle: 140, radius: 0.44 },
];
export const SpatialRadarStage = ({ activeMode, isPlaying, peers, selectedPeerId, setSelectedPeerId, orbitSpeedHz, roomDecayPct, lfeGainDb, userRole, liveSynthEnabled, masterVolume, onRotatePeerAngle, }) => {
    const [phaseAngle, setPhaseAngle] = useState(25);
    const [secondaryAngle, setSecondaryAngle] = useState(205);
    const [pulsePhase, setPulsePhase] = useState(0);
    const [manualObjectPos, setManualObjectPos] = useState(null);
    const svgRef = useRef(null);
    const [isDraggingObject, setIsDraggingObject] = useState(false);
    const modeConfig = SPATIAL_MODES[activeMode];
    // 60fps animation loop for 8D/16D/Atmos orbital sound trajectories
    useEffect(() => {
        let animId;
        let lastTime = performance.now();
        const tick = (now) => {
            const dt = (now - lastTime) / 1000;
            lastTime = now;
            if (isPlaying) {
                const effectiveSpeed = Math.max(0.08, orbitSpeedHz) * 360;
                setPhaseAngle((prev) => (prev + effectiveSpeed * dt) % 360);
                setSecondaryAngle((prev) => (prev - effectiveSpeed * 1.35 * dt + 360) % 360);
                setPulsePhase((prev) => (prev + dt * 3.2) % (Math.PI * 2));
            }
            animId = requestAnimationFrame(tick);
        };
        animId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(animId);
    }, [isPlaying, orbitSpeedHz]);
    // Update live Web Audio panner position as the 8D/16D emitter orbits
    useEffect(() => {
        if (!liveSynthEnabled || !isPlaying)
            return;
        const activeAzimuth = manualObjectPos ? manualObjectPos.angle : phaseAngle;
        const pan = Math.sin((activeAzimuth * Math.PI) / 180);
        spatialAudio.updatePanAndVolume(pan, masterVolume);
    }, [phaseAngle, manualObjectPos, liveSynthEnabled, isPlaying, masterVolume]);
    // Coordinate helper on 460x460 SVG canvas (center = 230, 230; maxRadius = 185)
    const polarToXY = (angleDeg, normRadius) => {
        const r = normRadius * 185;
        const rad = ((angleDeg - 90) * Math.PI) / 180;
        return {
            x: 230 + r * Math.cos(rad),
            y: 230 + r * Math.sin(rad),
        };
    };
    // Handle dragging the 3D sound emitter object inside the radar
    const updateObjectFromPointer = (clientX, clientY) => {
        if (!svgRef.current)
            return;
        const rect = svgRef.current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = clientX - cx;
        const dy = clientY - cy;
        const distPx = Math.sqrt(dx * dx + dy * dy);
        const maxPx = (rect.width / 2) * 0.82;
        const normRadius = Math.max(0.18, Math.min(0.88, distPx / maxPx));
        let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
        if (deg < 0)
            deg += 360;
        setManualObjectPos({ angle: Math.round(deg), radius: normRadius });
    };
    const primaryEmitterAngle = manualObjectPos ? manualObjectPos.angle : phaseAngle;
    const primaryEmitterRadius = manualObjectPos
        ? manualObjectPos.radius
        : activeMode === '8d'
            ? 0.72
            : activeMode === '16d'
                ? 0.76
                : 0.62;
    const primaryEmitterXY = polarToXY(primaryEmitterAngle, primaryEmitterRadius);
    const secondaryEmitterXY = polarToXY(secondaryAngle, 0.48 + 0.12 * Math.sin((secondaryAngle * Math.PI) / 90));
    // Determine how close each peer speaker is to the orbiting sound source
    const getPeerActivationIntensity = (peerAngle) => {
        if (!isPlaying)
            return 0.25;
        if (activeMode === 'normal') {
            return peerAngle <= 60 || peerAngle >= 300 ? 0.9 : 0.25;
        }
        const diff = Math.abs(((peerAngle - primaryEmitterAngle + 540) % 360) - 180);
        return Math.max(0.15, 1 - diff / 110);
    };
    const selectedPeer = peers.find((p) => p.id === selectedPeerId) || peers[0];
    return (<div className="studio-card rounded-2xl p-4 sm:p-5 flex flex-col justify-between h-full relative overflow-hidden">
      {/* Top Stage Telemetry Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{
            backgroundColor: modeConfig.accentColor,
            boxShadow: `0 0 12px ${modeConfig.accentColor}`,
        }}/>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-bold text-sm sm:text-base tracking-wide text-[#F3F5F8]">
                360° SPATIAL SOUNDSTAGE RADAR
              </h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded" style={{
            backgroundColor: `${modeConfig.accentColor}20`,
            color: modeConfig.accentColor,
        }}>
                {modeConfig.badge}
              </span>
            </div>
            <p className="text-[11px] font-mono text-[#8E96AA]">
              {modeConfig.technicalSpec}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {manualObjectPos && (<button type="button" onClick={() => setManualObjectPos(null)} className="px-2.5 py-1 rounded-lg bg-[#FF5500]/20 border border-[#FF5500]/40 text-[10px] font-mono text-[#FF5500] hover:bg-[#FF5500]/30 transition-colors flex items-center gap-1 cursor-pointer">
              <RotateCw className="w-3 h-3"/>
              <span>RESUME AUTO-ORBIT</span>
            </button>)}
          <div className="px-2.5 py-1 rounded-lg bg-[#07080C] border border-white/[0.08] text-[11px] font-mono text-[#8E96AA]">
            AZIMUTH:{' '}
            <span className="text-[#F3F5F8] font-bold">
              {Math.round(primaryEmitterAngle)}°
            </span>
          </div>
        </div>
      </div>

      {/* Center Interactive SVG 360° Soundstage */}
      <div className="relative flex-1 flex items-center justify-center my-2 min-h-[340px] sm:min-h-[410px]">
        <svg ref={svgRef} viewBox="0 0 460 460" className="w-full max-w-[440px] max-h-[440px] select-none overflow-visible" onPointerMove={(e) => {
            if (isDraggingObject) {
                updateObjectFromPointer(e.clientX, e.clientY);
            }
        }} onPointerUp={() => setIsDraggingObject(false)} onPointerLeave={() => setIsDraggingObject(false)}>
          <defs>
            <radialGradient id="stageFieldGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={modeConfig.accentColor} stopOpacity="0.18"/>
              <stop offset="55%" stopColor="#00F0FF" stopOpacity="0.06"/>
              <stop offset="100%" stopColor="#090A0F" stopOpacity="0"/>
            </radialGradient>

            <radialGradient id="emitterHalo" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={modeConfig.accentColor} stopOpacity="0.65"/>
              <stop offset="100%" stopColor={modeConfig.accentColor} stopOpacity="0"/>
            </radialGradient>
          </defs>

          {/* Outer Room Acoustic Boundary */}
          <circle cx="230" cy="230" r="205" fill="url(#stageFieldGlow)" stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>

          {/* Dynamic Room Decay / Reverb Envelope Ring */}
          <circle cx="230" cy="230" r={115 + (roomDecayPct / 100) * 75} fill="none" stroke={modeConfig.accentColor} strokeOpacity="0.16" strokeWidth="12"/>

          {/* Concentric Acoustic Meter Rings (1m, 2m, 3m Theatre Perimeter) */}
          {[0.35, 0.62, 0.85].map((normR, idx) => (<g key={idx}>
              <circle cx="230" cy="230" r={normR * 185} fill="none" stroke="rgba(255,255,255,0.08)" strokeDasharray={idx === 1 ? '4 4' : undefined}/>
              <text x="234" y={230 - normR * 185 + 11} className="fill-[#8E96AA]/60 text-[8px] font-mono">
                {idx === 0 ? '1.0m NEAR' : idx === 1 ? '2.0m ORBIT' : '3.5m THEATRE BED'}
              </text>
            </g>))}

          {/* Animated Sub-Bass LFE Wavefront Rings from Center */}
          {isPlaying && (<>
              <circle cx="230" cy="230" r={28 + ((pulsePhase / (Math.PI * 2)) * (95 + lfeGainDb * 6))} fill="none" stroke={modeConfig.accentColor} strokeOpacity={Math.max(0, 0.45 - pulsePhase / (Math.PI * 2) * 0.45)} strokeWidth="1.5"/>
              <circle cx="230" cy="230" r={28 + ((((pulsePhase + Math.PI) % (Math.PI * 2)) / (Math.PI * 2)) * 110)} fill="none" stroke="#00F0FF" strokeOpacity="0.2" strokeWidth="1"/>
            </>)}

          {/* Crosshair Axis Lines */}
          <line x1="230" y1="25" x2="230" y2="435" stroke="rgba(255,255,255,0.05)"/>
          <line x1="25" y1="230" x2="435" y2="230" stroke="rgba(255,255,255,0.05)"/>
          <line x1="85" y1="85" x2="375" y2="375" stroke="rgba(255,255,255,0.03)"/>
          <line x1="375" y1="85" x2="85" y2="375" stroke="rgba(255,255,255,0.03)"/>

          {/* Cardinal Acoustic Stage Labels */}
          <text x="230" y="18" textAnchor="middle" className="fill-[#8E96AA] text-[9px] font-mono tracking-widest">
            0° FRONT STAGE (SCREEN)
          </text>
          <text x="230" y="450" textAnchor="middle" className="fill-[#8E96AA] text-[9px] font-mono tracking-widest">
            180° REAR SURROUND
          </text>
          <text x="16" y="226" textAnchor="start" className="fill-[#8E96AA] text-[8px] font-mono">
            270° L
          </text>
          <text x="444" y="226" textAnchor="end" className="fill-[#8E96AA] text-[8px] font-mono">
            90° R
          </text>

          {/* MODE-SPECIFIC GEOMETRY LAYER */}
          {/* 1. STEREO 2.0: Left & Right Phase Vectors */}
          {activeMode === 'normal' && (<g>
              <polygon points="230,230 110,95 165,70" fill="rgba(0, 240, 255, 0.12)" stroke="#00F0FF" strokeOpacity="0.4"/>
              <polygon points="230,230 350,95 295,70" fill="rgba(0, 240, 255, 0.12)" stroke="#00F0FF" strokeOpacity="0.4"/>
            </g>)}

          {/* 2. 8D ORBITAL: 360° Continuous Azimuth Track */}
          {activeMode === '8d' && (<g>
              <circle cx="230" cy="230" r={0.72 * 185} fill="none" stroke="#FF5500" strokeWidth="2" strokeDasharray="8 5" strokeOpacity="0.55"/>
              {/* Line from Center Listener to Orbiting Sound Source */}
              <line x1="230" y1="230" x2={primaryEmitterXY.x} y2={primaryEmitterXY.y} stroke="#FF5500" strokeWidth="1.5" strokeOpacity="0.6"/>
            </g>)}

          {/* 3. 16D MULTI-AXIS: Dual Counter-Rotating Orbits (Azimuth + Elevation) */}
          {activeMode === '16d' && (<g>
              <circle cx="230" cy="230" r={0.76 * 185} fill="none" stroke="#A855F7" strokeWidth="1.8" strokeDasharray="6 4" strokeOpacity="0.55"/>
              <ellipse cx="230" cy="230" rx={0.54 * 185} ry={0.36 * 185} transform={`rotate(${phaseAngle * 0.5} 230 230)`} fill="none" stroke="#00F0FF" strokeWidth="1.5" strokeOpacity="0.5"/>
              {/* Secondary Counter-Rotating Harmonic Stem Emitter */}
              <circle cx={secondaryEmitterXY.x} cy={secondaryEmitterXY.y} r="18" fill="rgba(0,240,255,0.18)"/>
              <circle cx={secondaryEmitterXY.x} cy={secondaryEmitterXY.y} r="6" fill="#00F0FF" stroke="#FFFFFF" strokeWidth="1.5"/>
              <text x={secondaryEmitterXY.x} y={secondaryEmitterXY.y - 11} textAnchor="middle" className="fill-[#00F0FF] text-[8px] font-mono font-bold">
                STEM B (ELEV)
              </text>
            </g>)}

          {/* 4. DOLBY ATMOS 7.1.4: Overhead Height Dome Channels & Acoustic Beams */}
          {activeMode === 'atmos' && (<g>
              {/* Inner Overhead Height Dome Ring */}
              <circle cx="230" cy="230" r={0.44 * 185} fill="rgba(16, 185, 129, 0.05)" stroke="#10B981" strokeWidth="1.2" strokeDasharray="3 3"/>
              {ATMOS_HEIGHT_CHANNELS.map((hc) => {
                const pos = polarToXY(hc.angle, hc.radius);
                return (<g key={hc.code}>
                    <line x1="230" y1="230" x2={pos.x} y2={pos.y} stroke="rgba(16,185,129,0.22)" strokeWidth="1"/>
                    <rect x={pos.x - 14} y={pos.y - 8} width="28" height="16" rx="4" fill="#0C1418" stroke="#10B981" strokeWidth="1"/>
                    <text x={pos.x} y={pos.y + 3} textAnchor="middle" className="fill-[#10B981] text-[8px] font-mono font-bold">
                      {hc.code}
                    </text>
                  </g>);
            })}
            </g>)}

          {/* CONNECTED PEER SPEAKER NODES AROUND THE ROOM */}
          {peers.map((peer) => {
            const pos = polarToXY(peer.angleDeg, peer.distanceRing);
            const isSelected = selectedPeer?.id === peer.id;
            const intensity = peer.isMuted ? 0.05 : getPeerActivationIntensity(peer.angleDeg);
            return (<g key={peer.id} onClick={() => {
                    setSelectedPeerId(peer.id);
                    spatialAudio.playCalibrationChirp(Math.sin((peer.angleDeg * Math.PI) / 180));
                }} className="cursor-pointer">
                {/* Acoustic Projection Line to Center Listener */}
                <line x1={pos.x} y1={pos.y} x2="230" y2="230" stroke={peer.role === 'HOST' ? '#FF5500' : '#00F0FF'} strokeOpacity={intensity * 0.55} strokeWidth={isSelected ? 2.2 : 1.2} strokeDasharray={peer.syncLocked ? undefined : '3 3'}/>

                {/* Active SPL Output Energy Halo */}
                {isPlaying && !peer.isMuted && (<circle cx={pos.x} cy={pos.y} r={14 + intensity * 14} fill={peer.role === 'HOST' ? '#FF5500' : '#00F0FF'} fillOpacity={intensity * 0.22}/>)}

                {/* Peer Speaker Node Circle */}
                <circle cx={pos.x} cy={pos.y} r={isSelected ? 15 : 12} fill={peer.isMuted
                    ? '#1A1D26'
                    : peer.role === 'HOST'
                        ? '#FF5500'
                        : '#12151E'} stroke={isSelected
                    ? '#FFFFFF'
                    : peer.role === 'HOST'
                        ? '#FF5500'
                        : '#00F0FF'} strokeWidth={isSelected ? 2.5 : 1.5}/>

                {/* Channel Short Code inside Node */}
                <text x={pos.x} y={pos.y + 3} textAnchor="middle" className={`text-[7.5px] font-mono font-bold ${peer.role === 'HOST' && !peer.isMuted
                    ? 'fill-[#090A0F]'
                    : 'fill-[#F3F5F8]'}`}>
                  {peer.channelLabel.split(' ')[0]}
                </text>

                {/* Peer Name & Ping Tag Underneath Node */}
                <g transform={`translate(${pos.x}, ${pos.y + 24})`}>
                  <rect x="-42" y="-9" width="84" height="15" rx="4" fill="rgba(9, 10, 15, 0.88)" stroke={isSelected ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.08)'}/>
                  <text x="0" y="1" textAnchor="middle" className="fill-[#F3F5F8] text-[8px] font-mono">
                    {peer.name.split(' ')[0]} • {peer.latencyMs}ms
                  </text>
                </g>
              </g>);
        })}

          {/* PRIMARY DRAGGABLE / ORBITING 3D AUDIO EMITTER OBJECT */}
          {activeMode !== 'normal' && (<g onPointerDown={(e) => {
                e.stopPropagation();
                setIsDraggingObject(true);
                updateObjectFromPointer(e.clientX, e.clientY);
            }} className="cursor-grab active:cursor-grabbing">
              <circle cx={primaryEmitterXY.x} cy={primaryEmitterXY.y} r="28" fill="url(#emitterHalo)"/>
              <circle cx={primaryEmitterXY.x} cy={primaryEmitterXY.y} r="9" fill={modeConfig.accentColor} stroke="#FFFFFF" strokeWidth="2"/>
              <text x={primaryEmitterXY.x} y={primaryEmitterXY.y - 14} textAnchor="middle" className="fill-white text-[8.5px] font-mono font-bold">
                {activeMode === 'atmos' ? '3D OBJECT (DRAG)' : 'ORBIT EMITTER'}
              </text>
            </g>)}

          {/* CENTRAL LISTENER HEAD SILHOUETTE ("SWEET SPOT") */}
          <g>
            <circle cx="230" cy="230" r="24" fill="#0C0E15" stroke="#F3F5F8" strokeOpacity="0.35" strokeWidth="1.5"/>
            {/* Nose orientation pointer facing 0 deg North */}
            <polygon points="230,201 225,208 235,208" fill="#FF5500"/>
            {/* Left & Right Ear Cups */}
            <rect x="202" y="223" width="4" height="14" rx="2" fill="#00F0FF"/>
            <rect x="254" y="223" width="4" height="14" rx="2" fill="#00F0FF"/>
            <circle cx="230" cy="230" r="7" fill="#F3F5F8" fillOpacity="0.85"/>
            <text x="230" y="268" textAnchor="middle" className="fill-[#8E96AA] text-[8px] font-mono tracking-wider">
              LISTENER SWEET SPOT
            </text>
          </g>
        </svg>
      </div>

      {/* Bottom Interactive Selected Node Inspector Bar */}
      <div className="pt-3 border-t border-white/[0.08] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#07080C]/90 -mx-4 sm:-mx-5 -mb-4 sm:-mb-5 px-4 sm:px-5 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#12151E] border border-white/10 flex items-center justify-center shrink-0">
            <Radio className="w-4 h-4 text-[#00F0FF]"/>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-[#F3F5F8] truncate">
                {selectedPeer.name}
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-[#00F0FF]/15 text-[#00F0FF]">
                {selectedPeer.channelLabel}
              </span>
            </div>
            <div className="text-[10px] font-mono text-[#8E96AA] truncate">
              {selectedPeer.deviceModel} • Azimuth {selectedPeer.angleDeg}° • Ping{' '}
              {selectedPeer.latencyMs}ms
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button type="button" disabled={userRole !== 'host'} onClick={() => onRotatePeerAngle(selectedPeer.id, -15)} className="px-2.5 py-1.5 rounded-lg bg-[#12151E] hover:bg-white/10 border border-white/10 text-[11px] font-mono text-[#F3F5F8] disabled:opacity-40 transition-colors cursor-pointer" title="Rotate speaker placement -15° counter-clockwise">
            -15°
          </button>
          <button type="button" disabled={userRole !== 'host'} onClick={() => onRotatePeerAngle(selectedPeer.id, 15)} className="px-2.5 py-1.5 rounded-lg bg-[#12151E] hover:bg-white/10 border border-white/10 text-[11px] font-mono text-[#F3F5F8] disabled:opacity-40 transition-colors cursor-pointer" title="Rotate speaker placement +15° clockwise">
            +15°
          </button>
          <button type="button" onClick={() => spatialAudio.playCalibrationChirp(Math.sin((selectedPeer.angleDeg * Math.PI) / 180))} className="px-3 py-1.5 rounded-lg bg-[#FF5500]/15 hover:bg-[#FF5500]/25 border border-[#FF5500]/40 text-[11px] font-mono font-semibold text-[#FF5500] flex items-center gap-1.5 transition-colors cursor-pointer">
            <Volume2 className="w-3.5 h-3.5"/>
            <span>PING CHIRP</span>
          </button>
        </div>
      </div>
    </div>);
};
