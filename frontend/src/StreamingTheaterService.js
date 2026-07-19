// StreamingTheaterService.js - Theater Mode Option 3: Full Audio Streaming
import { syncService } from './SyncService.js';

class StreamingTheaterService {
  constructor() {
    this.speakers = [];
    this.phoneAssignments = {}; // phoneId -> { speakerId, latency, volume, channel }
    this.streamingTheaterMode = false;
    this.videoSource = null;
    this.audioStreaming = false;
    this.streamConfig = null;
    this.isCalibrating = false;
    this.calibrationResults = {};
    this.myAssignment = null; // My phone's assignment
    this.audioBuffer = null;
    this.audioQueue = [];
    this.isPlaying = false;
    
    this.setupSocketListeners();
  }

  setupSocketListeners() {
    const socket = syncService.socket;
    
    // Listen for streaming assignments updates
    socket.on('streaming-assignments-updated', (data) => {
      this.speakers = data.speakers || [];
      this.phoneAssignments = {};
      data.assignments.forEach(assignment => {
        this.phoneAssignments[assignment.phoneId] = {
          speakerId: assignment.speakerId,
          speakerName: assignment.speakerName,
          channel: assignment.channel,
          latency: assignment.latency,
          volume: assignment.volume
        };
        
        // Update my assignment if this is me
        if (assignment.phoneId === syncService.state.myId) {
          this.myAssignment = {
            speakerId: assignment.speakerId,
            speakerName: assignment.speakerName,
            channel: assignment.channel,
            latency: assignment.latency,
            volume: assignment.volume
          };
        }
      });
      this.notifyUpdate();
    });

    // Listen for video sync events
    socket.on('streaming-video-sync', (data) => {
      if (this.streamingTheaterMode) {
        this.handleVideoSync(data);
      }
    });

    // Listen for audio chunks
    socket.on('audio-chunk', (data) => {
      if (this.streamingTheaterMode && this.myAssignment) {
        this.handleAudioChunk(data);
      }
    });

    // Listen for streaming enabled/disabled
    socket.on('streaming-enabled', (config) => {
      this.audioStreaming = true;
      this.streamConfig = config;
      this.notifyUpdate();
    });

    socket.on('streaming-disabled', () => {
      this.audioStreaming = false;
      this.streamConfig = null;
      this.notifyUpdate();
    });

    // Listen for room updates
    socket.on('room-updated', (roomState) => {
      if (roomState.streamingTheaterMode !== undefined) {
        this.streamingTheaterMode = roomState.streamingTheaterMode;
      }
      if (roomState.videoSource !== undefined) {
        this.videoSource = roomState.videoSource;
      }
      if (roomState.speakers) {
        this.speakers = roomState.speakers;
      }
      if (roomState.phoneAssignments) {
        this.phoneAssignments = roomState.phoneAssignments.reduce((acc, assignment) => {
          acc[assignment.phoneId] = assignment;
          return acc;
        }, {});
      }
      if (roomState.streamConfig) {
        this.streamConfig = roomState.streamConfig;
      }
      if (roomState.audioStreaming !== undefined) {
        this.audioStreaming = roomState.audioStreaming;
      }
      this.notifyUpdate();
    });
  }

  // Enable streaming theater mode
  async enableStreamingTheater(videoSource = 'laptop', config = {}) {
    const response = await new Promise((resolve) => {
      syncService.socket.emit('enable-streaming-theater', { 
        videoSource, 
        config 
      }, resolve);
    });
    
    if (response.success) {
      this.streamingTheaterMode = true;
      this.videoSource = videoSource;
      this.speakers = config.speakers || this.speakers;
      this.notifyUpdate();
    }
    return response;
  }

  // Disable streaming theater mode
  async disableStreamingTheater() {
    const response = await new Promise((resolve) => {
      syncService.socket.emit('disable-streaming-theater', resolve);
    });
    
    if (response.success) {
      this.streamingTheaterMode = false;
      this.videoSource = null;
      this.speakers = [];
      this.phoneAssignments = {};
      this.myAssignment = null;
      this.audioStreaming = false;
      this.streamConfig = null;
      this.notifyUpdate();
    }
    return response;
  }

  // Enable audio streaming
  async enableAudioStreaming(config = {}) {
    const response = await new Promise((resolve) => {
      syncService.socket.emit('enable-streaming', config, resolve);
    });
    
    if (response.success) {
      this.audioStreaming = true;
      this.streamConfig = config;
      this.notifyUpdate();
    }
    return response;
  }

  // Disable audio streaming
  async disableAudioStreaming() {
    const response = await new Promise((resolve) => {
      syncService.socket.emit('disable-streaming', resolve);
    });
    
    if (response.success) {
      this.audioStreaming = false;
      this.streamConfig = null;
      this.notifyUpdate();
    }
    return response;
  }

  // Stream audio chunk (from laptop/host)
  async streamAudioChunk(chunk, timestamp, sequence) {
    const response = await new Promise((resolve) => {
      syncService.socket.emit('stream-audio-chunk', { 
        chunk,
        timestamp,
        sequence
      }, resolve);
    });
    return response;
  }

  // Assign phone to speaker (host only)
  async assignPhoneToSpeaker(phoneId, speakerId, latency = 100, volume = 80) {
    const response = await new Promise((resolve) => {
      syncService.socket.emit('assign-phone-to-speaker', { 
        phoneId, 
        speakerId,
        latency,
        volume
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

  // Update my settings (latency, volume)
  async updateMySettings(settings) {
    const myId = syncService.state.myId;
    const response = await new Promise((resolve) => {
      syncService.socket.emit('update-phone-settings', { 
        phoneId: myId,
        settings
      }, resolve);
    });
    
    if (response.success) {
      if (this.myAssignment) {
        if (settings.latency !== undefined) this.myAssignment.latency = settings.latency;
        if (settings.volume !== undefined) this.myAssignment.volume = settings.volume;
      }
      this.notifyUpdate();
    }
    return response;
  }

  // Send video position update (from laptop/host)
  async sendVideoPosition(position, isPlaying = true) {
    const response = await new Promise((resolve) => {
      syncService.socket.emit('streaming-video-position', { 
        position,
        isPlaying,
        serverTime: Date.now()
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
    
    console.log(`Streaming sync: pos=${data.position}, latency=${myLatency}ms, compensation=${latencyCompensation}ms`);
    
    // If this phone is assigned to a speaker, it should sync playback
    if (this.myAssignment) {
      // The audio chunks will be played with the adjusted timing
    }
  }

  // Handle audio chunk
  async handleAudioChunk(data) {
    // In a real implementation, we would decode and play the audio chunk
    // For now, we'll simulate it
    
    if (!syncService.audioContext) {
      syncService.initAudioContext();
    }
    
    // Queue the chunk for playback
    this.audioQueue.push(data);
    
    // If not already playing, start playback
    if (!this.isPlaying && this.audioQueue.length > 0) {
      this.startPlayback();
    }
    
    console.log(`Received audio chunk seq=${data.sequence} at ${data.serverTime}`);
  }

  // Start playback of queued audio chunks
  startPlayback() {
    if (this.isPlaying) return;
    
    this.isPlaying = true;
    this.playNextChunk();
  }

  // Stop playback
  stopPlayback() {
    this.isPlaying = false;
    this.audioQueue = [];
    
    if (this.sourceNode) {
      this.sourceNode.onended = null;
      try {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch (e) {
        // Ignore errors
      }
      this.sourceNode = null;
    }
  }

  // Play next chunk in queue
  async playNextChunk() {
    if (!this.isPlaying || this.audioQueue.length === 0) {
      this.isPlaying = false;
      return;
    }
    
    const chunkData = this.audioQueue.shift();
    
    try {
      // In a real implementation, we would decode the audio chunk
      // and play it through the Web Audio API
      // For now, we'll just simulate the timing
      
      // Calculate when this chunk should be played
      const now = Date.now();
      const chunkTime = chunkData.serverTime;
      const latency = this.myAssignment?.latency || 100;
      const playTime = now + latency;
      
      // If we're behind, skip this chunk
      if (playTime < now) {
        console.log(`Skipping chunk ${chunkData.sequence} (too late)`);
        this.playNextChunk();
        return;
      }
      
      // Wait until it's time to play
      const delay = playTime - now;
      setTimeout(() => {
        // Play the chunk (simulated)
        this.playChunk(chunkData);
      }, delay);
    } catch (error) {
      console.error('Error playing chunk:', error);
      this.playNextChunk();
    }
  }

  // Play a single audio chunk (simulated)
  playChunk(chunkData) {
    // In a real implementation, we would:
    // 1. Decode the audio chunk
    // 2. Create an AudioBufferSourceNode
    // 3. Connect to the appropriate channel
    // 4. Play at the correct time
    
    // For now, we'll just log it
    console.log(`Playing chunk ${chunkData.sequence}`);
    
    // Simulate playback time
    const chunkDuration = 100; // ms (simulated)
    
    // Play next chunk after this one finishes
    setTimeout(() => {
      this.playNextChunk();
    }, chunkDuration);
  }

  // Get my assignment
  getMyAssignment() {
    return this.myAssignment;
  }

  // Get all assignments
  getAllAssignments() {
    return this.phoneAssignments;
  }

  // Get speakers
  getSpeakers() {
    return this.speakers;
  }

  // Get available speakers (not yet assigned)
  getAvailableSpeakers() {
    const assignedSpeakers = new Set();
    Object.values(this.phoneAssignments).forEach(assignment => {
      assignedSpeakers.add(assignment.speakerId);
    });
    
    return this.speakers.filter(speaker => !assignedSpeakers.has(speaker.id));
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

  // Check if streaming mode is active
  isStreamingModeActive() {
    return this.streamingTheaterMode;
  }

  // Check if audio streaming is enabled
  isAudioStreamingEnabled() {
    return this.audioStreaming;
  }

  // Get video source
  getVideoSource() {
    return this.videoSource;
  }

  // Get stream config
  getStreamConfig() {
    return this.streamConfig;
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
    this.updateMySettings({ latency });
  }

  // Notify listeners of updates
  notifyUpdate() {
    if (this.onUpdate) {
      this.onUpdate({
        streamingTheaterMode: this.streamingTheaterMode,
        videoSource: this.videoSource,
        speakers: this.speakers,
        phoneAssignments: this.phoneAssignments,
        myAssignment: this.myAssignment,
        audioStreaming: this.audioStreaming,
        streamConfig: this.streamConfig,
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
export const streamingTheaterService = new StreamingTheaterService();
