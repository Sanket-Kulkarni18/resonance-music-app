import { io } from 'socket.io-client';

class SyncService {
  constructor() {
    this.serverBaseUrl = this.getServerBaseUrl();
    this.socket = io(this.serverBaseUrl, { transports: ['websocket'], upgrade: false });

    this.audioContext = null;
    this.audioBuffer = null;
    this.sourceNode = null;
    this.gainNode = null;
    this.effectInput = null;
    this.dryGain = null;
    this.filterNode = null;
    this.delayNode = null;
    this.delayGain = null;
    this.convolverNode = null;
    this.reverbGain = null;
    this.pannerNode = null;
    this.clockSyncInterval = null;
    this.spatialMotionId = null;
    this.effectMode = 'none';
    this.spatialMode = 'normal';
    this.devicePlacements = {};

    this.playbackState = { isPlaying: false, startTime: 0, startOffset: 0, duration: 0 };
    this.clockSync = { offset: 0, rtt: 50, synced: false, audioContextBaseTime: 0 };
    this.driftStats = { current: 0, corrections: 0 };
    this.state = { myId: null, myName: '', roomId: null, isHost: false, currentTrack: null };
    this.audioSettings = { effectPreset: 'none', spatialMode: 'normal' };

    this.onUpdate = null;
    this.setupSocket();
  }

  getServerBaseUrl() {
    const envUrl = import.meta.env.VITE_SOCKET_URL;
    if (envUrl) return envUrl;

    const protocol = window.location.protocol || 'http:';
    const hostname = import.meta.env.VITE_SOCKET_HOST || window.location.hostname;
    const port = import.meta.env.VITE_SOCKET_PORT || 5000;
    return `${protocol}//${hostname}:${port}`;
  }

  getTrackUrl(path) {
    if (!path) return path;
    if (/^https?:\/\//i.test(path)) return path;
    return `${this.serverBaseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  initAudioContext() {
    if (this.audioContext) return;
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);
    this.gainNode.gain.value = 0.8;

    this.effectInput = this.audioContext.createGain();
    this.dryGain = this.audioContext.createGain();
    this.filterNode = this.audioContext.createBiquadFilter();
    this.delayNode = this.audioContext.createDelay(5.0);
    this.delayGain = this.audioContext.createGain();
    this.convolverNode = this.audioContext.createConvolver();
    this.reverbGain = this.audioContext.createGain();
    this.pannerNode = this.audioContext.createPanner();

    this.filterNode.type = 'allpass';
    this.filterNode.frequency.value = 22050;
    this.filterNode.gain.value = 0;
    this.delayNode.delayTime.value = 0;
    this.delayGain.gain.value = 0;
    this.reverbGain.gain.value = 0;

    this.pannerNode.panningModel = 'HRTF';
    this.pannerNode.distanceModel = 'inverse';
    this.pannerNode.refDistance = 1;
    this.pannerNode.maxDistance = 10000;
    this.pannerNode.rolloffFactor = 1;
    this.pannerNode.coneInnerAngle = 360;
    this.pannerNode.coneOuterAngle = 0;
    this.pannerNode.positionX.setValueAtTime(0, this.audioContext.currentTime);
    this.pannerNode.positionY.setValueAtTime(0, this.audioContext.currentTime);
    this.pannerNode.positionZ.setValueAtTime(-1, this.audioContext.currentTime);

    this.effectInput.connect(this.dryGain);
    this.dryGain.connect(this.pannerNode);
    this.effectInput.connect(this.filterNode);
    this.filterNode.connect(this.delayNode);
    this.delayNode.connect(this.delayGain);
    this.delayGain.connect(this.pannerNode);
    this.effectInput.connect(this.convolverNode);
    this.convolverNode.connect(this.reverbGain);
    this.reverbGain.connect(this.pannerNode);
    this.pannerNode.connect(this.gainNode);

    this.updateEffectNodes();
  }

  resumeAudioContext() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  setVolume(val) {
    if (this.gainNode) this.gainNode.gain.value = val / 100;
  }

  setupSocket() {
    this.socket.on('connect', () => {
      this.state.myId = this.socket.id;
      this.performClockSync();
      if (this.clockSyncInterval) clearInterval(this.clockSyncInterval);
      this.clockSyncInterval = setInterval(() => this.performClockSync(), 15000);
      this.notifyUpdate();
    });

    this.socket.on('room-updated', (roomState) => {
      this.state.isHost = roomState.hostId === this.state.myId;
      if (roomState.currentTrack) this.state.currentTrack = roomState.currentTrack;
      if (roomState.placements) this.devicePlacements = roomState.placements;
      if (roomState.audioSettings) this.audioSettings = roomState.audioSettings;
      this.notifyUpdate({ roomState, audioSettings: this.audioSettings });
    });

    this.socket.on('audio-settings-updated', (audioSettings) => {
      this.audioSettings = audioSettings;
      this.notifyUpdate({ audioSettings: this.audioSettings });
    });

    this.socket.on('track-loaded', async (data) => {
      this.state.currentTrack = data.track;
      this.notifyUpdate({ loading: true, statusText: '⏳ Loading audio buffer...' });

      try {
        this.initAudioContext();
        this.audioBuffer = await this.loadAudioBuffer(this.getTrackUrl(data.track.url));
        this.playbackState.duration = this.audioBuffer.duration;
        this.playbackState.startOffset = 0;

        this.notifyUpdate({ loading: false, audioReady: true, statusText: '✅ Audio ready' });
        this.socket.emit('audio-ready');
      } catch (err) {
        this.notifyUpdate({ loading: false, statusText: '❌ Failed to load audio' });
      }
    });

    this.socket.on('sync-play', (data) => {
      this.resumeAudioContext();
      this.startPlayback(data.position, data.serverTimeAtPlay);
    });

    this.socket.on('sync-pause', (data) => {
      this.stopPlayback();
      this.playbackState.startOffset = data.position;
    });

    this.socket.on('sync-seek', (data) => {
      if (data.playing) {
        this.startPlayback(data.position, data.serverTimeAtPlay);
      } else {
        this.stopPlayback();
        this.playbackState.startOffset = data.position;
      }
    });

    this.socket.on('sync-correction', (data) => this.correctDrift(data.position, data.serverTime));

    this.socket.on('host-transfer-request', (request) => {
      this.notifyUpdate({ hostTransferRequest: request });
    });

    this.socket.on('host-transfer-resolved', () => {
      this.notifyUpdate({ hostTransferRequest: null, hostRequestPending: false });
    });

    setInterval(() => {
      if (this.state.isHost && this.playbackState.isPlaying && this.socket) {
        this.socket.emit('sync-heartbeat', { position: this.getCurrentTime(), serverTime: this.getServerTime() });
      }
    }, 300);
  }

  createRoom(name) {
    return new Promise((resolve) => {
      this.initAudioContext();
      this.resumeAudioContext();
      this.state.myName = name;
      this.socket.emit('create-room', { name }, (res) => {
        if (res.success) {
          this.state.roomId = res.room.id;
          this.state.isHost = true;
          this.audioSettings = res.room.audioSettings || this.audioSettings;
          this.devicePlacements = res.room.placements || {};
          this.notifyUpdate({ roomState: res.room, audioSettings: this.audioSettings });
        }
        resolve(res);
      });
    });
  }

  joinRoom(roomId, name) {
    return new Promise((resolve) => {
      this.initAudioContext();
      this.resumeAudioContext();
      this.state.myName = name;
      this.socket.emit('join-room', { roomId, name }, async (res) => {
        if (res.success) {
          this.state.roomId = res.room.id;
          if (res.room.currentTrack) {
            this.state.currentTrack = res.room.currentTrack;
            this.notifyUpdate({ loading: true, statusText: '⏳ Loading audio buffer...' });
            try {
              this.initAudioContext();
              this.audioBuffer = await this.loadAudioBuffer(this.getTrackUrl(res.room.currentTrack.url));
              this.playbackState.duration = this.audioBuffer.duration;
              this.notifyUpdate({ loading: false, audioReady: true, statusText: '✅ Audio ready' });
              this.socket.emit('audio-ready');
              if (res.room.playbackState.playing) {
                this.startPlayback(res.room.playbackState.position, res.room.playbackState.serverTimeAtPlay);
              }
            } catch (e) {
              this.notifyUpdate({ loading: false, statusText: '❌ Load failed' });
            }
          }
        }
        resolve(res);
      });
    });
  }

  togglePlay() {
    if (!this.state.isHost || !this.audioBuffer) return;
    this.resumeAudioContext();
    if (this.playbackState.isPlaying) {
      this.socket.emit('pause', { position: this.getCurrentTime() });
    } else {
      const serverTime = this.getServerTime() + 150;
      this.socket.emit('play', { position: this.playbackState.startOffset, serverTime });
    }
  }

  seek(position) {
    if (!this.state.isHost || !this.playbackState.duration) return;
    const serverTime = this.getServerTime() + 150;
    this.socket.emit('seek', { position, serverTime });
  }

  requestHostTransfer() {
    return new Promise((resolve) => {
      this.socket.emit('request-host-transfer', (response) => {
        if (response.success) this.notifyUpdate({ hostRequestPending: Boolean(response.pending) });
        resolve(response);
      });
    });
  }

  approveHostTransfer(requesterId) {
    return new Promise((resolve) => {
      this.socket.emit('approve-host-transfer', { requesterId }, (response) => {
        if (response.success) this.notifyUpdate({ hostTransferRequest: null });
        resolve(response);
      });
    });
  }

  uploadFile(file) {
    const formData = new FormData();
    formData.append('audio', file);
    this.notifyUpdate({ statusText: `Uploading: ${file.name}...` });

    fetch(`${this.serverBaseUrl}/upload`, { method: 'POST', body: formData })
      .then(res => res.json())
      .then(async data => {
        if (data.url) {
          this.notifyUpdate({ statusText: `✅ ${data.originalName}` });
          this.socket.emit('load-track', { url: data.url, name: data.originalName });
          this.notifyUpdate({ loading: true, statusText: '⏳ Loading audio buffer...' });

          this.initAudioContext();
          this.audioBuffer = await this.loadAudioBuffer(this.getTrackUrl(data.url));
          this.playbackState.duration = this.audioBuffer.duration;
          this.playbackState.startOffset = 0;
          this.notifyUpdate({ loading: false, audioReady: true, statusText: '✅ Audio ready' });
        }
      })
      .catch(() => this.notifyUpdate({ statusText: '❌ Upload failed' }));
  }

  setEffectPreset(preset) {
    this.effectMode = preset;
    this.updateEffectNodes();
    this.notifyUpdate({ effectMode: preset });
  }

  setSpatialMode(mode) {
    this.spatialMode = mode;
    if (mode === '8d' || mode === '16d') {
      this.startSpatialMotion();
    } else {
      this.stopSpatialMotion();
      this.updateSpatialPosition();
    }
    this.updateEffectNodes();
    this.notifyUpdate({ spatialMode: mode });
  }

  setDevicePlacements(placements) {
    this.devicePlacements = { ...this.devicePlacements, ...placements };
    this.notifyUpdate({ devicePlacements: this.devicePlacements });
    this.updateSpatialPosition();
  }

  syncDevicePlacements(placements) {
    if (!this.state.isHost || !this.socket) return;
    this.socket.emit('update-placements', { placements });
  }

  updateAudioSettings(audioSettings) {
    if (!this.state.isHost || !this.socket) return;
    this.socket.emit('update-audio-settings', audioSettings);
  }

  createReverbBuffer() {
    if (!this.audioContext) return null;
    const length = this.audioContext.sampleRate * 2.2;
    const impulse = this.audioContext.createBuffer(2, length, this.audioContext.sampleRate);
    for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
      }
    }
    return impulse;
  }

  updateEffectNodes() {
    if (!this.audioContext || !this.filterNode || !this.delayNode || !this.delayGain || !this.reverbGain) return;

    this.filterNode.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.01);
    this.filterNode.frequency.setTargetAtTime(22050, this.audioContext.currentTime, 0.01);
    this.filterNode.type = 'allpass';
    this.delayNode.delayTime.setTargetAtTime(0, this.audioContext.currentTime, 0.01);
    this.delayGain.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.01);
    this.reverbGain.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.01);

    if (this.effectMode === 'bassBoost') {
      this.filterNode.type = 'lowshelf';
      this.filterNode.frequency.setValueAtTime(200, this.audioContext.currentTime);
      this.filterNode.gain.setValueAtTime(8, this.audioContext.currentTime);
    } else if (this.effectMode === 'echo') {
      this.filterNode.type = 'allpass';
      this.delayNode.delayTime.setValueAtTime(0.22, this.audioContext.currentTime);
      this.delayGain.gain.setTargetAtTime(0.36, this.audioContext.currentTime, 0.01);
    } else if (this.effectMode === 'trebleBoost') {
      this.filterNode.type = 'highshelf';
      this.filterNode.frequency.setValueAtTime(4000, this.audioContext.currentTime);
      this.filterNode.gain.setValueAtTime(6, this.audioContext.currentTime);
    }

    if (this.spatialMode === 'atmos') {
      if (!this.convolverNode.buffer) {
        this.convolverNode.buffer = this.createReverbBuffer();
      }
      this.reverbGain.gain.setTargetAtTime(0.18, this.audioContext.currentTime, 0.01);
    } else if (this.effectMode !== 'echo') {
      this.reverbGain.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.01);
    }

    this.updateSpatialPosition();
  }

  updateSpatialPosition() {
    if (!this.audioContext || !this.pannerNode) return;
    const placement = this.devicePlacements[this.state.myId] || { x: 0, y: -0.7 };
    const radius = this.spatialMode === 'normal' ? 0.65 : 0.85;
    let x = placement.x * radius;
    let z = placement.y * radius;

    if (this.spatialMode === 'atmos') {
      x = placement.x * 0.35;
      z = placement.y * 0.25 - 0.4;
    }

    this.setPannerPosition(x, z);
  }

  getSpatialPathPoints() {
    const placements = Object.values(this.devicePlacements || {});
    if (!placements.length) return [{ x: 0, y: -0.7 }];

    const points = placements.filter(p => Math.hypot(p.x, p.y) > 0.25);
    const ordered = (points.length >= 2 ? points : placements).slice();
    ordered.sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x));

    if (ordered.length === 1) {
      ordered.push({ x: ordered[0].x * 0.5, y: ordered[0].y * 0.5 });
    }

    return ordered;
  }

  startSpatialMotion() {
    if (!this.audioContext || !this.pannerNode) return;
    if (this.spatialMotionId) return;

    const pathPoints = this.getSpatialPathPoints();
    if (!pathPoints.length) return;

    const speed = this.spatialMode === '16d' ? 0.95 : 0.65;
    const radius = 0.85;

    const animate = (time) => {
      if (!this.playbackState.isPlaying) {
        this.spatialMotionId = null;
        return;
      }

      const totalPoints = pathPoints.length;
      const adjustedTime = (time / 1000) * speed;
      const index = Math.floor(adjustedTime * totalPoints) % totalPoints;
      const nextIndex = (index + 1) % totalPoints;
      const interp = (adjustedTime * totalPoints) % 1;
      const current = pathPoints[index];
      const next = pathPoints[nextIndex];
      const x = current.x + (next.x - current.x) * interp;
      const y = current.y + (next.y - current.y) * interp;

      this.setPannerPosition(x * radius, y * radius);
      this.spatialMotionId = requestAnimationFrame(animate);
    };

    this.spatialMotionId = requestAnimationFrame(animate);
  }

  stopSpatialMotion() {
    if (this.spatialMotionId) {
      cancelAnimationFrame(this.spatialMotionId);
      this.spatialMotionId = null;
    }
  }

  setPannerPosition(x, z) {
    if (!this.audioContext || !this.pannerNode) return;
    const now = this.audioContext.currentTime;
    this.pannerNode.positionX.setTargetAtTime(x, now, 0.03);
    this.pannerNode.positionY.setTargetAtTime(0, now, 0.03);
    this.pannerNode.positionZ.setTargetAtTime(z, now, 0.03);
  }

  getCurrentTime() {
    if (!this.audioContext || !this.playbackState.isPlaying) return this.playbackState.startOffset;
    return Math.min(this.playbackState.startOffset + (this.audioContext.currentTime - this.playbackState.startTime), this.audioBuffer.duration);
  }

  getServerTime() {
    return (this.audioContext.currentTime * 1000) + this.clockSync.audioContextBaseTime + this.clockSync.offset;
  }

  async performClockSync() {
    this.initAudioContext();
    this.clockSync.audioContextBaseTime = Date.now() - (this.audioContext.currentTime * 1000);
    const samples = [];
    for (let i = 0; i < 20; i++) {
      const t0 = Date.now();
      const data = await new Promise(r => this.socket.emit('clock-sync', { clientTime: t0, lastRTT: this.clockSync.rtt }, r));
      const rtt = Date.now() - t0;
      samples.push({ offset: data.serverTime - t0 - (rtt / 2), rtt });
      await new Promise(r => setTimeout(r, 25));
    }
    samples.sort((a, b) => a.rtt - b.rtt);
    const bestSamples = samples.slice(0, 5);
    const offsets = bestSamples.map(s => s.offset).sort((a, b) => a - b);

    this.clockSync.offset = Math.round(offsets[2]);
    this.clockSync.rtt = bestSamples[0].rtt;
    this.clockSync.synced = true;
    this.notifyUpdate();
  }

  loadAudioBuffer(url) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'arraybuffer';
      xhr.onload = () => {
        if (xhr.status === 200) this.audioContext.decodeAudioData(xhr.response, resolve, reject);
        else reject(new Error('Failed'));
      };
      xhr.send();
    });
  }

  startPlayback(offset, scheduleAt) {
    if (!this.audioBuffer) return;
    this.stopPlayback();
    this.resumeAudioContext();

    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;
    this.sourceNode.connect(this.effectInput);

    let audioCtxScheduleTime = scheduleAt 
      ? this.audioContext.currentTime + ((scheduleAt - this.getServerTime()) / 1000)
      : this.audioContext.currentTime + 0.01;

    if (audioCtxScheduleTime < this.audioContext.currentTime) {
      offset += (this.audioContext.currentTime - audioCtxScheduleTime);
      audioCtxScheduleTime = this.audioContext.currentTime + 0.005;
    }

    offset = Math.max(0, Math.min(offset, this.audioBuffer.duration - 0.1));
    this.sourceNode.start(audioCtxScheduleTime, offset);
    this.playbackState = { isPlaying: true, startTime: audioCtxScheduleTime, startOffset: offset, duration: this.audioBuffer.duration };
    this.sourceNode.onended = () => { this.playbackState.isPlaying = false; this.notifyUpdate(); };
    this.notifyUpdate();
    if (this.spatialMode === '8d' || this.spatialMode === '16d') {
      this.startSpatialMotion();
    } else {
      this.updateSpatialPosition();
    }
  }

  stopPlayback() {
    if (this.sourceNode) {
      this.sourceNode.onended = null;
      try { this.sourceNode.stop(); this.sourceNode.disconnect(); } catch (e) {}
      this.sourceNode = null;
    }
    this.playbackState.startOffset = this.getCurrentTime();
    this.playbackState.isPlaying = false;
    this.stopSpatialMotion();
    this.notifyUpdate();
  }

  correctDrift(hostPosition, hostServerTime) {
    if (this.state.isHost || !this.playbackState.isPlaying) return;
    const timeSinceHost = (this.getServerTime() - hostServerTime) / 1000;
    const expectedPosition = hostPosition + timeSinceHost;
    const driftMs = (this.getCurrentTime() - expectedPosition) * 1000;

    this.driftStats.current = Math.round(driftMs);
    const absDrift = Math.abs(driftMs);

    if (absDrift > 100) {
      this.startPlayback(expectedPosition, null);
      this.driftStats.corrections++;
    } else if (absDrift > 15 && this.sourceNode?.playbackRate) {
      let rate = driftMs > 0 ? 0.98 : 1.02;
      if (absDrift > 50) rate = driftMs > 0 ? 0.95 : 1.05;
      this.sourceNode.playbackRate.setValueAtTime(rate, this.audioContext.currentTime);
      this.sourceNode.playbackRate.setValueAtTime(1.0, this.audioContext.currentTime + (absDrift / 500));
      this.driftStats.corrections++;
    }
    this.notifyUpdate();
  }

  notifyUpdate(extraData = {}) {
    if (this.onUpdate) {
      this.onUpdate({
        state: { ...this.state },
        playbackState: { ...this.playbackState },
        clockSync: { ...this.clockSync },
        driftStats: { ...this.driftStats },
        ...extraData
      });
    }
  }
}

export const syncService = new SyncService();
