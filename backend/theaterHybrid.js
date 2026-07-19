// Theater Mode - Option 2: Hybrid Laptop + Phones
// Laptop connects directly to big speakers, phones connect to small speakers
// All synced together for theater experience

const path = require('path');

class HybridTheaterManager {
  constructor(io, rooms) {
    this.io = io;
    this.rooms = rooms;
    this.speakerGroups = new Map(); // roomId -> { big: [speakerIds], small: [speakerIds] }
    this.phoneAssignments = new Map(); // roomId -> { phoneId: { speakerId, speakerType, latency } }
    this.videoSyncState = new Map(); // roomId -> { position, serverTime, isPlaying }
    this.audioStreaming = new Map(); // roomId -> { enabled, chunkSize, bitrate }
  }

  // Initialize hybrid theater mode
  initHybridTheater(roomId, config = {}) {
    const defaultConfig = {
      bigSpeakers: ['big-1', 'big-2'],
      smallSpeakers: ['small-1', 'small-2', 'small-3', 'small-4'],
      audioStreaming: false,
      videoSource: 'laptop'
    };
    
    this.speakerGroups.set(roomId, {
      big: config.bigSpeakers || defaultConfig.bigSpeakers,
      small: config.smallSpeakers || defaultConfig.smallSpeakers
    });
    
    this.phoneAssignments.set(roomId, new Map());
    this.audioStreaming.set(roomId, { enabled: false });
    this.videoSyncState.set(roomId, { position: 0, serverTime: 0, isPlaying: false });
    
    console.log(`Hybrid theater mode initialized for room: ${roomId}`);
    console.log(`Big speakers: ${JSON.stringify(config.bigSpeakers || defaultConfig.bigSpeakers)}`);
    console.log(`Small speakers: ${JSON.stringify(config.smallSpeakers || defaultConfig.smallSpeakers)}`);
  }

  // Assign phone to a speaker
  assignPhoneToSpeaker(roomId, phoneId, speakerId, speakerType = 'small', latency = 100, callback) {
    if (!this.phoneAssignments.has(roomId)) {
      this.initHybridTheater(roomId);
    }
    
    const assignments = this.phoneAssignments.get(roomId);
    
    // Check if speaker exists
    const groups = this.speakerGroups.get(roomId);
    const allSpeakers = [...groups.big, ...groups.small];
    if (!allSpeakers.includes(speakerId)) {
      return callback({ success: false, error: 'Speaker not found' });
    }
    
    // Assign phone to speaker
    assignments.set(phoneId, { speakerId, speakerType, latency });
    
    console.log(`Assigned phone ${phoneId} to speaker ${speakerId} (${speakerType}) with ${latency}ms latency`);
    
    // Broadcast updated assignments
    this.broadcastAssignments(roomId);
    
    callback({ success: true, phoneId, speakerId, speakerType, latency });
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

  // Update phone latency
  updatePhoneLatency(roomId, phoneId, latency, callback) {
    if (!this.phoneAssignments.has(roomId)) {
      return callback({ success: false, error: 'Room not found' });
    }
    
    const assignments = this.phoneAssignments.get(roomId);
    const assignment = assignments.get(phoneId);
    
    if (!assignment) {
      return callback({ success: false, error: 'Phone not assigned to any speaker' });
    }
    
    assignment.latency = latency;
    assignments.set(phoneId, assignment);
    
    console.log(`Updated latency for phone ${phoneId}: ${latency}ms`);
    callback({ success: true, phoneId, latency });
  }

  // Broadcast assignments to room
  broadcastAssignments(roomId) {
    const assignments = this.phoneAssignments.get(roomId) || new Map();
    const groups = this.speakerGroups.get(roomId) || { big: [], small: [] };
    
    const assignmentsList = [];
    assignments.forEach((data, phoneId) => {
      assignmentsList.push({
        phoneId,
        speakerId: data.speakerId,
        speakerType: data.speakerType,
        latency: data.latency
      });
    });
    
    this.io.to(roomId).emit('hybrid-assignments-updated', {
      assignments: assignmentsList,
      speakerGroups: groups
    });
  }

  // Handle video position update from laptop
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
    const syncBuffer = Math.max(200, maxLatency + 100);
    
    // Broadcast to all phones
    this.io.to(roomId).emit('hybrid-video-sync', {
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

  // Enable audio streaming (laptop streams audio to phones)
  enableAudioStreaming(roomId, config = {}, callback) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return callback({ success: false, error: 'Room not found' });
    }
    if (room.hostId !== callback?.socket?.id) {
      return callback({ success: false, error: 'Only host can enable streaming' });
    }
    
    this.audioStreaming.set(roomId, {
      enabled: true,
      chunkSize: config.chunkSize || 1024,
      bitrate: config.bitrate || 128,
      format: config.format || 'mp3'
    });
    
    console.log(`Audio streaming enabled for room ${roomId}`);
    this.io.to(roomId).emit('audio-streaming-enabled', this.audioStreaming.get(roomId));
    callback({ success: true });
  }

  // Disable audio streaming
  disableAudioStreaming(roomId, callback) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return callback({ success: false, error: 'Room not found' });
    }
    
    this.audioStreaming.set(roomId, { enabled: false });
    console.log(`Audio streaming disabled for room ${roomId}`);
    this.io.to(roomId).emit('audio-streaming-disabled');
    callback({ success: true });
  }

  // Stream audio chunk to phones
  streamAudioChunk(roomId, chunk, timestamp, callback) {
    const streaming = this.audioStreaming.get(roomId);
    if (!streaming || !streaming.enabled) {
      return callback({ success: false, error: 'Streaming not enabled' });
    }
    
    // Broadcast audio chunk to phones assigned to small speakers
    const assignments = this.phoneAssignments.get(roomId);
    if (assignments) {
      assignments.forEach((data, phoneId) => {
        if (data.speakerType === 'small') {
          this.io.to(phoneId).emit('audio-chunk', {
            chunk,
            timestamp,
            speakerId: data.speakerId
          });
        }
      });
    }
    
    callback({ success: true });
  }

  // Get speaker groups for a room
  getSpeakerGroups(roomId) {
    return this.speakerGroups.get(roomId) || { big: [], small: [] };
  }

  // Get phone assignments for a room
  getPhoneAssignments(roomId) {
    return this.phoneAssignments.get(roomId) || new Map();
  }

  // Get video sync state
  getVideoSyncState(roomId) {
    return this.videoSyncState.get(roomId) || { position: 0, serverTime: 0, isPlaying: false };
  }

  // Cleanup when room is deleted
  cleanupRoom(roomId) {
    this.speakerGroups.delete(roomId);
    this.phoneAssignments.delete(roomId);
    this.videoSyncState.delete(roomId);
    this.audioStreaming.delete(roomId);
  }
}

module.exports = HybridTheaterManager;
