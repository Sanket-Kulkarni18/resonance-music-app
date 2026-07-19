// Theater Mode - Option 3: Full Audio Streaming
// Laptop streams audio to server, which broadcasts to all phones
// Each phone plays through its connected Bluetooth speakers

const path = require('path');

class StreamingTheaterManager {
  constructor(io, rooms) {
    this.io = io;
    this.rooms = rooms;
    this.audioStreams = new Map(); // roomId -> { enabled, config, chunks: [] }
    this.phoneAssignments = new Map(); // roomId -> { phoneId: { speakerId, latency, volume, channel } }
    this.videoSyncState = new Map(); // roomId -> { position, serverTime, isPlaying }
    this.speakerConfigurations = new Map(); // roomId -> { speakers: [], channels: {} }
    this.bufferManager = new Map(); // roomId -> { buffer: AudioBuffer, position: number }
  }

  // Initialize streaming theater mode
  initStreamingTheater(roomId, config = {}) {
    const defaultConfig = {
      enabled: false,
      chunkSize: 2048,
      bitrate: 192,
      format: 'mp3',
      sampleRate: 44100,
      channels: 2,
      speakers: [
        { id: 'front-left', name: 'Front Left', type: 'big', channel: 0 },
        { id: 'front-right', name: 'Front Right', type: 'big', channel: 1 },
        { id: 'rear-left', name: 'Rear Left', type: 'small', channel: 2 },
        { id: 'rear-right', name: 'Rear Right', type: 'small', channel: 3 },
        { id: 'center', name: 'Center', type: 'big', channel: 4 },
        { id: 'subwoofer', name: 'Subwoofer', type: 'big', channel: 5 }
      ]
    };
    
    this.audioStreams.set(roomId, {
      enabled: false,
      config: { ...defaultConfig, ...config },
      chunks: [],
      lastChunkTime: 0
    });
    
    this.phoneAssignments.set(roomId, new Map());
    this.videoSyncState.set(roomId, { position: 0, serverTime: 0, isPlaying: false });
    this.speakerConfigurations.set(roomId, {
      speakers: config.speakers || defaultConfig.speakers,
      channels: this.createChannelMap(config.speakers || defaultConfig.speakers)
    });
    
    console.log(`Streaming theater mode initialized for room: ${roomId}`);
    console.log(`Config: ${JSON.stringify(this.audioStreams.get(roomId).config)}`);
  }

  // Create channel map from speakers
  createChannelMap(speakers) {
    const channelMap = {};
    speakers.forEach(speaker => {
      if (speaker.channel !== undefined) {
        channelMap[speaker.channel] = speaker.id;
      }
    });
    return channelMap;
  }

  // Enable audio streaming
  enableAudioStreaming(roomId, config = {}, callback) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return callback({ success: false, error: 'Room not found' });
    }
    if (room.hostId !== callback?.socket?.id) {
      return callback({ success: false, error: 'Only host can enable streaming' });
    }
    
    const stream = this.audioStreams.get(roomId) || { enabled: false, config: {}, chunks: [] };
    stream.enabled = true;
    stream.config = { ...stream.config, ...config };
    stream.chunks = [];
    stream.lastChunkTime = Date.now();
    
    this.audioStreams.set(roomId, stream);
    
    console.log(`Audio streaming enabled for room ${roomId}`);
    this.io.to(roomId).emit('streaming-enabled', stream.config);
    callback({ success: true, config: stream.config });
  }

  // Disable audio streaming
  disableAudioStreaming(roomId, callback) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return callback({ success: false, error: 'Room not found' });
    }
    
    const stream = this.audioStreams.get(roomId);
    if (stream) {
      stream.enabled = false;
      stream.chunks = [];
      this.audioStreams.set(roomId, stream);
    }
    
    console.log(`Audio streaming disabled for room ${roomId}`);
    this.io.to(roomId).emit('streaming-disabled');
    callback({ success: true });
  }

  // Stream audio chunk from laptop
  streamAudioChunk(roomId, chunk, timestamp, sequence, callback) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return callback({ success: false, error: 'Room not found' });
    }
    if (room.hostId !== callback?.socket?.id) {
      return callback({ success: false, error: 'Only host can stream audio' });
    }
    
    const stream = this.audioStreams.get(roomId);
    if (!stream || !stream.enabled) {
      return callback({ success: false, error: 'Streaming not enabled' });
    }
    
    // Store chunk with metadata
    stream.chunks.push({
      chunk,
      timestamp,
      sequence,
      receivedAt: Date.now()
    });
    
    // Keep only last N chunks for buffering
    if (stream.chunks.length > 100) {
      stream.chunks = stream.chunks.slice(-100);
    }
    
    stream.lastChunkTime = Date.now();
    
    // Broadcast to all phones in room
    this.io.to(roomId).emit('audio-chunk', {
      chunk,
      timestamp,
      sequence,
      serverTime: Date.now()
    });
    
    callback({ success: true, sequence });
  }

  // Assign phone to speaker
  assignPhoneToSpeaker(roomId, phoneId, speakerId, latency = 100, volume = 80, callback) {
    if (!this.phoneAssignments.has(roomId)) {
      this.initStreamingTheater(roomId);
    }
    
    const assignments = this.phoneAssignments.get(roomId);
    const speakers = this.speakerConfigurations.get(roomId)?.speakers || [];
    
    // Check if speaker exists
    const speaker = speakers.find(s => s.id === speakerId);
    if (!speaker) {
      return callback({ success: false, error: 'Speaker not found' });
    }
    
    // Assign phone to speaker
    assignments.set(phoneId, {
      speakerId,
      latency,
      volume,
      channel: speaker.channel || 0
    });
    
    console.log(`Assigned phone ${phoneId} to speaker ${speakerId} (channel ${speaker.channel || 0})`);
    
    // Broadcast updated assignments
    this.broadcastAssignments(roomId);
    
    callback({ success: true, phoneId, speakerId, channel: speaker.channel || 0 });
  }

  // Unassign phone from speaker
  unassignPhoneFromSpeaker(roomId, phoneId, callback) {
    if (!this.phoneAssignments.has(roomId)) {
      return callback({ success: false, error: 'Room not found' });
    }
    
    const assignments = this.phoneAssignments.get(roomId);
    assignments.delete(phoneId);
    
    console.log(`Unassigned phone ${phoneId} from its speaker`);
    this.broadcastAssignments(roomId);
    
    callback({ success: true, phoneId });
  }

  // Update phone settings (latency, volume)
  updatePhoneSettings(roomId, phoneId, settings, callback) {
    if (!this.phoneAssignments.has(roomId)) {
      return callback({ success: false, error: 'Room not found' });
    }
    
    const assignments = this.phoneAssignments.get(roomId);
    const assignment = assignments.get(phoneId);
    
    if (!assignment) {
      return callback({ success: false, error: 'Phone not assigned to any speaker' });
    }
    
    // Update settings
    if (settings.latency !== undefined) assignment.latency = settings.latency;
    if (settings.volume !== undefined) assignment.volume = settings.volume;
    
    assignments.set(phoneId, assignment);
    console.log(`Updated settings for phone ${phoneId}: ${JSON.stringify(settings)}`);
    
    callback({ success: true, phoneId, ...settings });
  }

  // Broadcast assignments to room
  broadcastAssignments(roomId) {
    const assignments = this.phoneAssignments.get(roomId) || new Map();
    const speakers = this.speakerConfigurations.get(roomId)?.speakers || [];
    
    const assignmentsList = [];
    assignments.forEach((data, phoneId) => {
      const speaker = speakers.find(s => s.id === data.speakerId);
      assignmentsList.push({
        phoneId,
        speakerId: data.speakerId,
        speakerName: speaker?.name || data.speakerId,
        channel: data.channel,
        latency: data.latency,
        volume: data.volume
      });
    });
    
    this.io.to(roomId).emit('streaming-assignments-updated', {
      assignments: assignmentsList,
      speakers
    });
  }

  // Handle video position update
  handleVideoPosition(roomId, data, callback) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return callback({ success: false, error: 'Room not found' });
    }

    // Store video state
    this.videoSyncState.set(roomId, {
      position: data.position,
      serverTime: Date.now(),
      isPlaying: data.isPlaying || true
    });

    // Calculate sync timing with latency compensation
    const maxLatency = this.getMaxLatency(roomId);
    const syncBuffer = Math.max(250, maxLatency + 150);
    
    // Broadcast to all phones
    this.io.to(roomId).emit('streaming-video-sync', {
      position: data.position,
      serverTime: Date.now(),
      isPlaying: data.isPlaying || true,
      syncBuffer: syncBuffer,
      maxLatency: maxLatency
    });

    console.log(`Video sync for room ${roomId}: pos=${data.position}, buffer=${syncBuffer}ms`);
    callback({ success: true });
  }

  // Get maximum latency in room
  getMaxLatency(roomId) {
    const assignments = this.phoneAssignments.get(roomId);
    if (!assignments || assignments.size === 0) return 100;
    
    let maxLatency = 100;
    assignments.forEach(data => {
      if (data.latency > maxLatency) maxLatency = data.latency;
    });
    
    return maxLatency;
  }

  // Get speaker configurations
  getSpeakerConfigurations(roomId) {
    return this.speakerConfigurations.get(roomId) || { speakers: [], channels: {} };
  }

  // Get phone assignments
  getPhoneAssignments(roomId) {
    return this.phoneAssignments.get(roomId) || new Map();
  }

  // Get audio stream state
  getAudioStreamState(roomId) {
    return this.audioStreams.get(roomId) || { enabled: false, config: {}, chunks: [] };
  }

  // Get video sync state
  getVideoSyncState(roomId) {
    return this.videoSyncState.get(roomId) || { position: 0, serverTime: 0, isPlaying: false };
  }

  // Cleanup when room is deleted
  cleanupRoom(roomId) {
    this.audioStreams.delete(roomId);
    this.phoneAssignments.delete(roomId);
    this.videoSyncState.delete(roomId);
    this.speakerConfigurations.delete(roomId);
    this.bufferManager.delete(roomId);
  }
}

module.exports = StreamingTheaterManager;
