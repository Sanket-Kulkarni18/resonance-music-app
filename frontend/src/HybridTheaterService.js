// HybridTheaterService.js - Theater Mode Option 2: Hybrid Laptop + Phones
import { syncService } from './SyncService.js';

class HybridTheaterService {
  constructor() {
    this.speakerGroups = { big: [], small: [] };
    this.phoneAssignments = {}; // phoneId -> { speakerId, speakerType, latency }
    this.hybridTheaterMode = false;
    this.videoSource = null;
    this.audioStreaming = false;
    this.isCalibrating = false;
    this.calibrationResults = {};
    this.myAssignment = null; // My phone's assignment
    
    this.setupSocketListeners();
  }

  setupSocketListeners() {
    const socket = syncService.socket;
    
    // Listen for hybrid assignments updates
    socket.on('hybrid-assignments-updated', (data) => {
      this.speakerGroups = data.speakerGroups || { big: [], small: [] };
      this.phoneAssignments = {};
      data.assignments.forEach(assignment => {
        this.phoneAssignments[assignment.phoneId] = {
          speakerId: assignment.speakerId,
          speakerType: assignment.speakerType,
          latency: assignment.latency
        };
        
        // Update my assignment if this is me
        if (assignment.phoneId === syncService.state.myId) {
          this.myAssignment = {
            speakerId: assignment.speakerId,
            speakerType: assignment.speakerType,
            latency: assignment.latency
          };
        }
      });
      this.notifyUpdate();
    });

    // Listen for video sync events
    socket.on('hybrid-video-sync', (data) => {
      if (this.hybridTheaterMode) {
        this.handleVideoSync(data);
      }
    });

    // Listen for audio streaming events
    socket.on('audio-streaming-enabled', (config) => {
      this.audioStreaming = true;
      this.streamingConfig = config;
      this.notifyUpdate();
    });

    socket.on('audio-streaming-disabled', () => {
      this.audioStreaming = false;
      this.streamingConfig = null;
      this.notifyUpdate();
    });

    // Listen for audio chunks (for small speaker phones)
    socket.on('audio-chunk', (data) => {
      if (this.hybridTheaterMode && this.myAssignment?.speakerType === 'small') {
        this.handleAudioChunk(data);
      }
    });

    // Listen for room updates
    socket.on('room-updated', (roomState) => {
      if (roomState.hybridTheaterMode !== undefined) {
        this.hybridTheaterMode = roomState.hybridTheaterMode;
      }
      if (roomState.videoSource !== undefined) {
        this.videoSource = roomState.videoSource;
      }
      if (roomState.speakerGroups) {
        this.speakerGroups = roomState.speakerGroups;
      }
      if (roomState.phoneAssignments) {
        this.phoneAssignments = roomState.phoneAssignments.reduce((acc, assignment) => {
          acc[assignment.phoneId] = {
            speakerId: assignment.speakerId,
            speakerType: assignment.speakerType,
            latency: assignment.latency
          };
          return acc;
        }, {});
      }
      this.notifyUpdate();
    });
  }

  // Enable hybrid theater mode
  async enableHybridTheater(videoSource = 'laptop', config = {}) {
    const response = await new Promise((resolve) => {
      syncService.socket.emit('enable-hybrid-theater', { 
        videoSource, 
        config 
      }, resolve);
    });
    
    if (response.success) {
      this.hybridTheaterMode = true;
      this.videoSource = videoSource;
      this.speakerGroups = config.speakerGroups || { big: ['big-1', 'big-2'], small: ['small-1', 'small-2', 'small-3', 'small-4'] };
      this.notifyUpdate();
    }
    return response;
  }

  // Disable hybrid theater mode
  async disableHybridTheater() {
    const response = await new Promise((resolve) => {
      syncService.socket.emit('disable-hybrid-theater', resolve);
    });
    
    if (response.success) {
      this.hybridTheaterMode = false;
      this.videoSource = null;
      this.speakerGroups = { big: [], small: [] };
      this.phoneAssignments = {};
      this.myAssignment = null;
      this.notifyUpdate();
    }
    return response;
  }

  // Assign phone to speaker (host only)
  async assignPhoneToSpeaker(phoneId, speakerId, speakerType = 'small', latency = 100) {
    const response = await new Promise((resolve) => {
      syncService.socket.emit('assign-phone-to-speaker', { 
        phoneId, 
        speakerId, 
        speakerType,
        latency
      }, resolve);
    });
    return response;
  }

  // Unassign phone from speaker
  async unassignPhoneFromSpeaker(phoneId) {
    const response = await new Promise((resolve) => {
      syncService.socket.emit('unassign-phone-from-speaker', { phoneId }, resolve);
    });
    
    if (response.success && phoneId === syncService.state.myId) {
      this.myAssignment = null;
    }
    return response;
  }

  // Unassign myself
  async unassignMyself() {
    return this.unassignPhoneFromSpeaker(syncService.state.myId);
  }

  // Update my latency
  async updateMyLatency(latency) {
    const myId = syncService.state.myId;
    const response = await new Promise((resolve) => {
      syncService.socket.emit('update-phone-latency', { 
        phoneId: myId,
        latency 
      }, resolve);
    });
    
    if (response.success) {
      if (this.myAssignment) {
        this.myAssignment.latency = latency;
      }
      this.notifyUpdate();
    }
    return response;
  }

  // Send video position update (from laptop/host)
  async sendVideoPosition(position, isPlaying = true) {
    const response = await new Promise((resolve) => {
      syncService.socket.emit('hybrid-video-position', { 
        position,
        isPlaying,
        serverTime: Date.now()
      }, resolve);
    });
    return response;
  }

  // Enable audio streaming
  async enableAudioStreaming(config = {}) {
    const response = await new Promise((resolve) => {
      syncService.socket.emit('enable-audio-streaming', config, resolve);
    });
    
    if (response.success) {
      this.audioStreaming = true;
      this.streamingConfig = config;
      this.notifyUpdate();
    }
    return response;
  }

  // Disable audio streaming
  async disableAudioStreaming() {
    const response = await new Promise((resolve) => {
      syncService.socket.emit('disable-audio-streaming', resolve);
    });
    
    if (response.success) {
      this.audioStreaming = false;
      this.streamingConfig = null;
      this.notifyUpdate();
    }
    return response;
  }

  // Stream audio chunk (from laptop/host)
  async streamAudioChunk(chunk, timestamp) {
    const response = await new Promise((resolve) => {
      syncService.socket.emit('stream-audio-chunk', { 
        chunk,
        timestamp
      }, resolve);
    });
    return response;
  }

  // Handle video sync event
  handleVideoSync(data) {
    const myId = syncService.state.myId;
    const myLatency = this.myAssignment?.latency || 100;
    const maxLatency = data.maxLatency || 100;
    
    // Calculate latency compensation
    const latencyCompensation = myLatency - maxLatency;
    
    console.log(`Hybrid sync: pos=${data.position}, latency=${myLatency}ms, compensation=${latencyCompensation}ms`);
    
    // If this phone is assigned to a speaker, it should sync playback
    if (this.myAssignment) {
      // The sync-play event will handle the actual playback
      // with the adjusted timing
    }
  }

  // Handle audio chunk (for small speaker phones)
  handleAudioChunk(data) {
    // In a real implementation, we would decode and play the audio chunk
    // For now, just log it
    console.log(`Received audio chunk for speaker ${data.speakerId} at ${data.timestamp}`);
    
    // If we have an audio context, we could play it
    if (syncService.audioContext) {
      // This would be implemented with AudioBuffer and playback
    }
  }

  // Get my assignment
  getMyAssignment() {
    return this.myAssignment;
  }

  // Get all assignments
  getAllAssignments() {
    return this.phoneAssignments;
  }

  // Get speaker groups
  getSpeakerGroups() {
    return this.speakerGroups;
  }

  // Get available speakers (not yet assigned)
  getAvailableSpeakers(speakerType = null) {
    const assignedSpeakers = new Set();
    Object.values(this.phoneAssignments).forEach(assignment => {
      assignedSpeakers.add(assignment.speakerId);
    });
    
    const allSpeakers = speakerType 
      ? this.speakerGroups[speakerType] || []
      : [...this.speakerGroups.big, ...this.speakerGroups.small];
    
    return allSpeakers.filter(speakerId => !assignedSpeakers.has(speakerId));
  }

  // Get assigned phones for a speaker
  getPhoneForSpeaker(speakerId) {
    for (const [phoneId, assignment] of Object.entries(this.phoneAssignments)) {
      if (assignment.speakerId === speakerId) {
        return phoneId;
      }
    }
    return null;
  }

  // Get phone name from room state
  getPhoneName(phoneId, roomState) {
    const member = roomState?.members?.find(m => m.id === phoneId);
    return member ? member.name : phoneId;
  }

  // Check if hybrid mode is active
  isHybridModeActive() {
    return this.hybridTheaterMode;
  }

  // Check if audio streaming is enabled
  isAudioStreamingEnabled() {
    return this.audioStreaming;
  }

  // Get video source
  getVideoSource() {
    return this.videoSource;
  }

  // Start calibration
  async startCalibration() {
    this.isCalibrating = true;
    this.calibrationResults = {};
    this.notifyUpdate();
    
    return new Promise((resolve) => {
      this.calibrationCallback = resolve;
    });
  }

  // Complete calibration
  completeCalibration(latency) {
    this.isCalibrating = false;
    this.notifyUpdate();
    
    if (this.calibrationCallback) {
      this.calibrationCallback({ success: true, latency });
      this.calibrationCallback = null;
    }
    
    // Save latency
    this.updateMyLatency(latency);
  }

  // Notify listeners of updates
  notifyUpdate() {
    if (this.onUpdate) {
      this.onUpdate({
        hybridTheaterMode: this.hybridTheaterMode,
        videoSource: this.videoSource,
        speakerGroups: this.speakerGroups,
        phoneAssignments: this.phoneAssignments,
        myAssignment: this.myAssignment,
        audioStreaming: this.audioStreaming,
        streamingConfig: this.streamingConfig,
        isCalibrating: this.isCalibrating
      });
    }
  }

  // Subscribe to updates
  subscribe(callback) {
    this.onUpdate = callback;
  }

  // Unsubscribe
  unsubscribe() {
    this.onUpdate = null;
  }
}

// Singleton instance
export const hybridTheaterService = new HybridTheaterService();
