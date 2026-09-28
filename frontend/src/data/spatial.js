export const SPATIAL_MODES = {
  normal: {
    id: 'normal',
    code: 'MODE // 01',
    name: 'DIRECT REFERENCE',
    subtitle: 'Phase-locked reference playback',
    badge: 'DIRECT',
    accentColor: '#00F0FF',
    channelCount: 'STEREO / DIRECT',
    description:
      'Keeps every connected device on the shared transport without an orbital movement path.',
    technicalSpec: 'Clock-synchronised reference stage',
    defaultOrbitSpeed: 0,
    defaultRoomDecay: 22,
    defaultLfeGain: 0,
  },
  '8d': {
    id: '8d',
    code: 'MODE // 02',
    name: '8D BINAURAL ORBIT',
    subtitle: '360° azimuthal movement across the room',
    badge: '8D AZIMUTH',
    accentColor: '#FF5500',
    channelCount: '360° RING',
    description:
      'Moves the listening position around the speaker map with a smooth HRTF panning path.',
    technicalSpec: 'HRTF panner · shared device placement map',
    defaultOrbitSpeed: 0.18,
    defaultRoomDecay: 48,
    defaultLfeGain: 2.5,
  },
  '16d': {
    id: '16d',
    code: 'MODE // 03',
    name: '16D MULTI-AXIS',
    subtitle: 'Faster multi-axis orbital movement',
    badge: '16D SPHERE',
    accentColor: '#A855F7',
    channelCount: 'DUAL ORBIT',
    description:
      'Uses a more energetic multi-axis path over the same synchronised soundstage.',
    technicalSpec: 'Multi-axis orbital visualisation · shared placement map',
    defaultOrbitSpeed: 0.28,
    defaultRoomDecay: 64,
    defaultLfeGain: 4,
  },
  atmos: {
    id: 'atmos',
    code: 'MODE // 04',
    name: 'ATMOSPHERE DOME',
    subtitle: 'Overhead-style depth with ambient reverb',
    badge: 'DOME',
    accentColor: '#10B981',
    channelCount: '3D AMBIENCE',
    description:
      'Adds the app’s overhead-style depth map and room ambience to the synchronised array.',
    technicalSpec: 'HRTF panner · ambient convolution reverb',
    defaultOrbitSpeed: 0.12,
    defaultRoomDecay: 78,
    defaultLfeGain: 6,
  },
};

export const EFFECT_PRESETS = [
  { id: 'none', label: 'Clean', detail: 'No tonal processing' },
  { id: 'echo', label: 'Echo', detail: 'Short spatial echo' },
  { id: 'bassBoost', label: 'Bass', detail: 'Low shelf boost' },
  { id: 'trebleBoost', label: 'Treble', detail: 'High shelf boost' },
];

export const SPEAKER_ZONES = [
  { id: 'fc', code: 'C / LFE', label: 'FRONT CENTER', angleDeg: 0, distanceRing: 0.58, panValue: 0 },
  { id: 'fl', code: 'FL', label: 'FRONT LEFT', angleDeg: 315, distanceRing: 0.68, panValue: -0.7 },
  { id: 'fr', code: 'FR', label: 'FRONT RIGHT', angleDeg: 45, distanceRing: 0.68, panValue: 0.7 },
  { id: 'sl', code: 'SL', label: 'SURROUND LEFT', angleDeg: 260, distanceRing: 0.78, panValue: -0.95 },
  { id: 'sr', code: 'SR', label: 'SURROUND RIGHT', angleDeg: 100, distanceRing: 0.78, panValue: 0.95 },
  { id: 'rl', code: 'RL', label: 'REAR LEFT', angleDeg: 215, distanceRing: 0.84, panValue: -0.65 },
  { id: 'rr', code: 'RR', label: 'REAR RIGHT', angleDeg: 145, distanceRing: 0.84, panValue: 0.65 },
  { id: 'rear', code: 'RC', label: 'REAR CENTER', angleDeg: 180, distanceRing: 0.85, panValue: 0 },
];

export function polarToPlacement(angleDeg, distanceRing = 0.7) {
  const radians = (angleDeg * Math.PI) / 180;
  const distance = Math.max(0.2, Math.min(0.9, distanceRing));
  return {
    x: Number((Math.sin(radians) * distance).toFixed(3)),
    y: Number((-Math.cos(radians) * distance).toFixed(3)),
  };
}

export function placementToPolar(placement, fallbackAngle = 0, fallbackDistance = 0.68) {
  if (!placement || !Number.isFinite(Number(placement.x)) || !Number.isFinite(Number(placement.y))) {
    return { angleDeg: fallbackAngle, distanceRing: fallbackDistance };
  }

  const x = Number(placement.x);
  const y = Number(placement.y);
  const angle = (Math.atan2(x, -y) * 180) / Math.PI;
  return {
    angleDeg: Math.round((angle + 360) % 360),
    distanceRing: Math.max(0.28, Math.min(0.9, Math.hypot(x, y))),
  };
}

export function zoneForAngle(angleDeg) {
  return SPEAKER_ZONES.reduce((closest, zone) => {
    const delta = Math.abs(((zone.angleDeg - angleDeg + 540) % 360) - 180);
    const closestDelta = Math.abs(((closest.angleDeg - angleDeg + 540) % 360) - 180);
    return delta < closestDelta ? zone : closest;
  }, SPEAKER_ZONES[0]);
}

export function modeLabel(mode) {
  return SPATIAL_MODES[mode]?.name || SPATIAL_MODES.normal.name;
}
