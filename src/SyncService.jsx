import { io } from 'socket.io-client';

class SyncService {
  constructor() {
    this.serverBaseUrl = this.getServerBaseUrl();
    this.socket = io(this.serverBaseUrl, { transports: ['websocket'], upgrade: false });
    
    this.audioContext = null;
    this.audioBuffer = null;
    this.sourceNode = null;
    this.gainNode = null;
    this.clockSyncInterval = null;

    this.playbackState = { isPlaying: false, startTime: 0, startOffset: 0, duration: 0 };
    this.clockSync = { offset: 0, rtt: 50, synced: false, audioContextBaseTime: 0 };
    this.driftStats = { current: 0, corrections: 0 };
    this.state = { myId: null, myName: '', roomId: null, isHost: false, currentTrack: null };

    // This callback allows React to trigger UI re-renders when data changes
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

  // --- AUDIO SETUP ---
  initAudioContext() {
    if (this.audioContext) return;
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);
    this.gainNode.gain.value = 0.8;
  }

  resumeAudioContext() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  setVolume(val) {
    if (this.gainNode) this.gainNode.gain.value = val / 100;
  }

  // --- SOCKET SETUP ---
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
      this.notifyUpdate({ roomState });
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

    setInterval(() => {
      if (this.state.isHost && this.playbackState.isPlaying && this.socket) {
        this.socket.emit('sync-heartbeat', { position: this.getCurrentTime(), serverTime: this.getServerTime() });
      }
    }, 300);
  }

  // --- ACTIONS ---
  createRoom(name) {
    return new Promise((resolve) => {
      this.initAudioContext();
      this.resumeAudioContext();
      this.state.myName = name;
      this.socket.emit('create-room', { name }, (res) => {
        if (res.success) this.state.roomId = res.room.id;
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

  becomeHost() {
    this.socket.emit('become-host', () => {});
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

  // --- CORE SYNC & PLAYBACK MATH ---
  getCurrentTime() {
    if (!this.audioContext || !this.playbackState.isPlaying) return this.playbackState.startOffset;
    return Math.min(this.playbackState.startOffset + (this.audioContext.currentTime - this.playbackState.startTime), this.playbackState.duration);
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
    
    this.clockSync.offset = Math.round(offsets[2]); // Median
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
    this.sourceNode.connect(this.gainNode);
    
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
  }

  stopPlayback() {
    if (this.sourceNode) {
      this.sourceNode.onended = null;
      try { this.sourceNode.stop(); this.sourceNode.disconnect(); } catch (e) {}
      this.sourceNode = null;
    }
    this.playbackState.startOffset = this.getCurrentTime();
    this.playbackState.isPlaying = false;
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

  // Sends state to React
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