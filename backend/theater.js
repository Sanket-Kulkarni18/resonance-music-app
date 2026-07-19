// Theater Mode - Option 1: Phone-as-Speaker
// Each phone connects to Bluetooth speakers and plays assigned audio channel

const path = require('path');

class TheaterManager {
  constructor(io, rooms) {
    this.io = io;
    this.rooms = rooms;
    this.speakerAssignments = new Map(); // roomId -> { phoneId: speakerId[] }
    this.bluetoothLatencies = new Map(); // phoneId -> latency in ms
    this.videoSources = new Map(); // roomId -> { type, element, lastPosition }
  }

  // Initialize theater mode for a room
  initTheaterRoom(roomId) {
    if (!this.speakerAssignments.has(roomId)) {
      this.speakerAssignments.set(roomId, new Map());
    }
    console.log(`Theater mode initialized for room: ${roomId}`);
  }

  // Assign a speaker to a phone
  assignSpeaker(roomId, phoneId, speakerId, callback) {
    if (!this.speakerAssignments.has(roomId)) {
      this.initTheaterRoom(roomId);
    }
    
    const assignments = this.speakerAssignments.get(roomId);
    
    // Get current assignments for this phone
    const currentSpeakers = assignments.get(phoneId) || [];
    
    // Add new speaker if not already assigned
    if (!currentSpeakers.includes(speakerId)) {
      assignments.set(phoneId, [...currentSpeakers, speakerId]);
    }
    
    console.log(`Assigned speaker ${speakerId} to phone ${phoneId} in room ${roomId}`);
    
    // Broadcast updated assignments to room
    this.broadcastSpeakerAssignments(roomId);
    
    if (callback) callback({ success: true, speakerId, phoneId });
  }

  // Remove speaker assignment
  unassignSpeaker(roomId, phoneId, speakerId, callback) {
    if (!this.speakerAssignments.has(roomId)) {
      if (callback) callback({ success: false, error: 'Room not found' });
      return;
    }
    
    const assignments = this.speakerAssignments.get(roomId);
    const currentSpeakers = assignments.get(phoneId) || [];
    
    const updatedSpeakers = currentSpeakers.filter(s => s !== speakerId);
    assignments.set(phoneId, updatedSpeakers);
    
    console.log(`Removed speaker ${speakerId} from phone ${phoneId} in room ${roomId}`);
    this.broadcastSpeakerAssignments(roomId);
    
    if (callback) callback({ success: true });
  }

  // Set Bluetooth latency for a phone
  setBluetoothLatency(phoneId, latency, callback) {
    this.bluetoothLatencies.set(phoneId, latency);
    console.log(`Bluetooth latency for ${phoneId}: ${latency}ms`);
    if (callback) callback({ success: true });
  }

  // Get Bluetooth latency for a phone
  getBluetoothLatency(phoneId) {
    return this.bluetoothLatencies.get(phoneId) || 100; // Default 100ms
  }

  // Broadcast speaker assignments to room
  broadcastSpeakerAssignments(roomId) {
    const assignments = this.speakerAssignments.get(roomId) || new Map();
    const room = this.rooms.get(roomId);
    
    if (room) {
      const assignmentsList = [];
      assignments.forEach((speakers, phoneId) => {
        const member = room.members.get(phoneId);
        if (member) {
          assignmentsList.push({
            phoneId,
            phoneName: member.name,
            speakers
          });
        }
      });
      
      this.io.to(roomId).emit('speaker-assignments-updated', { assignments: assignmentsList });
    }
  }

  // Handle video position update from laptop
  handleVideoPosition(roomId, data, callback) {
    const room = this.rooms.get(roomId);
    if (!room) {
      if (callback) callback({ success: false, error: 'Room not found' });
      return;
    }

    // Store video position
    this.videoSources.set(roomId, {
      type: data.type || 'laptop',
      position: data.position,
      serverTime: Date.now(),
      lastUpdate: Date.now()
    });

    // Broadcast to all phones in room with latency compensation
    const maxLatency = this.getMaxBluetoothLatency(roomId);
    const syncBuffer = Math.max(200, maxLatency + 100);
    
    this.io.to(roomId).emit('video-sync', {
      position: data.position,
      serverTime: Date.now(),
      syncBuffer: syncBuffer,
      maxLatency: maxLatency
    });

    if (callback) callback({ success: true });
  }

  // Get maximum Bluetooth latency in a room
  getMaxBluetoothLatency(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return 100;

    let maxLatency = 100; // Default
    room.members.forEach(member => {
      const latency = this.getBluetoothLatency(member.id);
      if (latency > maxLatency) maxLatency = latency;
    });
    
    return maxLatency;
  }

  // Get speaker assignments for a room
  getSpeakerAssignments(roomId) {
    return this.speakerAssignments.get(roomId) || new Map();
  }

  // Cleanup when room is deleted
  cleanupRoom(roomId) {
    this.speakerAssignments.delete(roomId);
    this.videoSources.delete(roomId);
  }
}

module.exports = TheaterManager;
