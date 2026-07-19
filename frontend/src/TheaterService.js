// TheaterService.js - Theater Mode functionality for Option 1: Phone-as-Speaker
import { syncService } from './SyncService.js';

class TheaterService {
  constructor() {
    this.speakers = [];
    this.speakerAssignments = {}; // phoneId -> [speakerIds]
    this.bluetoothLatency = 100; // Default latency in ms
    this.theaterMode = false;
    this.videoSource = null;
    this.isCalibrating = false;
    this.calibrationResults = {};
    
    this.setupSocketListeners();
  }

  setupSocketListeners() {
    const socket = syncService.socket;
    
    // Listen for speaker assignments updates
    socket.on('speaker-assignments-updated', (data) => {
      this.speakerAssignments = {};
      data.assignments.forEach(assignment => {
        this.speakerAssignments[assignment.phoneId] = assignment.speakers;
      });
      this.notifyUpdate();
    });

    // Listen for video sync events
    socket.on('video-sync', (data) => {
      if (this.theaterMode) {
        // Adjust playback based on video position
        this.handleVideoSync(data);
      }
    });

    // Listen for room updates that might include theater mode changes
    socket.on('room-updated', (roomState) => {
      if (roomState.theaterMode !== undefined) {
        this.theaterMode = roomState.theaterMode;
      }
      if (roomState.videoSource !== undefined) {
        this.videoSource = roomState.videoSource;
      }
      if (roomState.speakerAssignments) {
        this.speakerAssignments = roomState.speakerAssignments.reduce((acc, assignment) => {
          acc[assignment.phoneId] = assignment.speakers;
          return acc;
        }, {});
      }
      this.notifyUpdate();
    });
  }

  // Enable theater mode
  async enableTheaterMode(videoSource = 'laptop') {
    const response = await new Promise((resolve) => {
      syncService.socket.emit('enable-theater-mode', { videoSource }, resolve);
    });
    
    if (response.success) {
      this.theaterMode = true;
      this.videoSource = videoSource;
      this.notifyUpdate();
    }
    return response;
  }

  // Disable theater mode
  async disableTheaterMode() {
    const response = await new Promise((resolve) => {
      syncService.socket.emit('disable-theater-mode', resolve);
    });
    
    if (response.success) {
      this.theaterMode = false;
      this.videoSource = null;
      this.notifyUpdate();
    }
    return response;
  }

  // Assign a speaker to this phone
  async assignSpeaker(speakerId) {
    const myId = syncService.state.myId;
    const response = await new Promise((resolve) => {
      syncService.socket.emit('assign-speaker', { 
        phoneId: myId, 
        speakerId 
      }, resolve);
    });
    
    if (response.success) {
      // Update local assignments
      if (!this.speakerAssignments[myId]) {
        this.speakerAssignments[myId] = [];
      }
      if (!this.speakerAssignments[myId].includes(speakerId)) {
        this.speakerAssignments[myId].push(speakerId);
      }
      this.notifyUpdate();
    }
    return response;
  }

  // Unassign a speaker from this phone
  async unassignSpeaker(speakerId) {
    const myId = syncService.state.myId;
    const response = await new Promise((resolve) => {
      syncService.socket.emit('unassign-speaker', { 
        phoneId: myId, 
        speakerId 
      }, resolve);
    });
    
    if (response.success) {
      // Update local assignments
      if (this.speakerAssignments[myId]) {
        this.speakerAssignments[myId] = this.speakerAssignments[myId].filter(
          id => id !== speakerId
        );
      }
      this.notifyUpdate();
    }
    return response;
  }

  // Assign speaker to another phone (host only)
  async assignSpeakerToPhone(phoneId, speakerId) {
    const response = await new Promise((resolve) => {
      syncService.socket.emit('assign-speaker', { 
        phoneId, 
        speakerId 
      }, resolve);
    });
    return response;
  }

  // Set Bluetooth latency for this phone
  async setBluetoothLatency(latency) {
    const myId = syncService.state.myId;
    this.bluetoothLatency = latency;
    
    const response = await new Promise((resolve) => {
      syncService.socket.emit('set-bluetooth-latency', { 
        phoneId: myId,
        latency 
      }, resolve);
    });
    
    if (response.success) {
      this.notifyUpdate();
    }
    return response;
  }

  // Send video position update (from laptop/host)
  async sendVideoPosition(position) {
    const response = await new Promise((resolve) => {
      syncService.socket.emit('video-position', { 
        position,
        serverTime: Date.now()
      }, resolve);
    });
    return response;
  }

  // Start Bluetooth latency calibration
  async startCalibration() {
    this.isCalibrating = true;
    this.calibrationResults = {};
    this.notifyUpdate();
    
    // Play test tone and wait for user feedback
    return new Promise((resolve) => {
      // This would be triggered by user tapping when they hear the tone
      // For now, we'll use a manual approach
      this.calibrationCallback = resolve;
    });
  }

  // Complete calibration with measured latency
  completeCalibration(latency) {
    this.isCalibrating = false;
    this.bluetoothLatency = latency;
    this.notifyUpdate();
    
    if (this.calibrationCallback) {
      this.calibrationCallback({ success: true, latency });
      this.calibrationCallback = null;
    }
    
    // Save to server
    this.setBluetoothLatency(latency);
  }

  // Handle video sync event
  handleVideoSync(data) {
    // Adjust playback timing based on video position and latency
    const myId = syncService.state.myId;
    const myLatency = this.bluetoothLatency;
    const maxLatency = data.maxLatency || 100;
    
    // Calculate adjusted sync time
    const latencyCompensation = myLatency - maxLatency;
    
    // If this phone has speakers assigned, it should play
    const mySpeakers = this.speakerAssignments[myId] || [];
    if (mySpeakers.length > 0) {
      // This phone is responsible for playing audio
      // The sync-play event will handle the actual playback
      console.log(`Phone ${myId} syncing with ${myLatency}ms latency (compensation: ${latencyCompensation}ms)`);
    }
  }

  // Get speakers assigned to this phone
  getMySpeakers() {
    const myId = syncService.state.myId;
    return this.speakerAssignments[myId] || [];
  }

  // Get all speaker assignments
  getAllAssignments() {
    return this.speakerAssignments;
  }

  // Get available speakers (not yet assigned)
  getAvailableSpeakers(allSpeakers) {
    const assignedSpeakers = new Set();
    Object.values(this.speakerAssignments).forEach(speakers => {
      speakers.forEach(speakerId => assignedSpeakers.add(speakerId));
    });
    
    return allSpeakers.filter(speaker => !assignedSpeakers.has(speaker.id));
  }

  // Check if this phone is assigned to any speakers
  hasSpeakersAssigned() {
    const myId = syncService.state.myId;
    return (this.speakerAssignments[myId] || []).length > 0;
  }

  // Check if theater mode is active
  isTheaterModeActive() {
    return this.theaterMode;
  }

  // Get video source type
  getVideoSource() {
    return this.videoSource;
  }

  // Notify listeners of updates
  notifyUpdate() {
    if (this.onUpdate) {
      this.onUpdate({
        theaterMode: this.theaterMode,
        videoSource: this.videoSource,
        speakerAssignments: this.speakerAssignments,
        bluetoothLatency: this.bluetoothLatency,
        isCalibrating: this.isCalibrating,
        mySpeakers: this.getMySpeakers()
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
export const theaterService = new TheaterService();
