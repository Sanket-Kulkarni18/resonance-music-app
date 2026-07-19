import React, { useState, useEffect } from 'react';
import { streamingTheaterService } from './StreamingTheaterService.js';
import { syncService } from './SyncService.js';

// Speaker presets for streaming mode
const SPEAKER_PRESETS = {
  stereo: {
    name: 'Stereo 2.0',
    speakers: [
      { id: 'left', name: 'Left Channel', type: 'big', channel: 0, icon: '🔊' },
      { id: 'right', name: 'Right Channel', type: 'big', channel: 1, icon: '🔊' }
    ]
  },
  surround51: {
    name: 'Surround 5.1',
    speakers: [
      { id: 'front-left', name: 'Front Left', type: 'big', channel: 0, icon: '🔊' },
      { id: 'front-right', name: 'Front Right', type: 'big', channel: 1, icon: '🔊' },
      { id: 'front-center', name: 'Front Center', type: 'big', channel: 2, icon: '🔊' },
      { id: 'subwoofer', name: 'Subwoofer', type: 'big', channel: 3, icon: '🎚️' },
      { id: 'rear-left', name: 'Rear Left', type: 'small', channel: 4, icon: '🔈' },
      { id: 'rear-right', name: 'Rear Right', type: 'small', channel: 5, icon: '🔈' }
    ]
  },
  surround71: {
    name: 'Surround 7.1',
    speakers: [
      { id: 'front-left', name: 'Front Left', type: 'big', channel: 0, icon: '🔊' },
      { id: 'front-right', name: 'Front Right', type: 'big', channel: 1, icon: '🔊' },
      { id: 'front-center', name: 'Front Center', type: 'big', channel: 2, icon: '🔊' },
      { id: 'subwoofer', name: 'Subwoofer', type: 'big', channel: 3, icon: '🎚️' },
      { id: 'side-left', name: 'Side Left', type: 'small', channel: 4, icon: '🔈' },
      { id: 'side-right', name: 'Side Right', type: 'small', channel: 5, icon: '🔈' },
      { id: 'rear-left', name: 'Rear Left', type: 'small', channel: 6, icon: '🔈' },
      { id: 'rear-right', name: 'Rear Right', type: 'small', channel: 7, icon: '🔈' }
    ]
  },
  atmos: {
    name: 'Dolby Atmos',
    speakers: [
      { id: 'front-left', name: 'Front Left', type: 'big', channel: 0, icon: '🔊' },
      { id: 'front-right', name: 'Front Right', type: 'big', channel: 1, icon: '🔊' },
      { id: 'front-center', name: 'Front Center', type: 'big', channel: 2, icon: '🔊' },
      { id: 'subwoofer', name: 'Subwoofer', type: 'big', channel: 3, icon: '🎚️' },
      { id: 'side-left', name: 'Side Left', type: 'small', channel: 4, icon: '🔈' },
      { id: 'side-right', name: 'Side Right', type: 'small', channel: 5, icon: '🔈' },
      { id: 'rear-left', name: 'Rear Left', type: 'small', channel: 6, icon: '🔈' },
      { id: 'rear-right', name: 'Rear Right', type: 'small', channel: 7, icon: '🔈' },
      { id: 'overhead-left', name: 'Overhead Left', type: 'small', channel: 8, icon: '🔊' },
      { id: 'overhead-right', name: 'Overhead Right', type: 'small', channel: 9, icon: '🔊' }
    ]
  }
};

const VIDEO_SOURCES = [
  { id: 'laptop', name: 'Laptop (Screen Capture)', icon: '💻', description: 'Capture laptop audio output' },
  { id: 'file', name: 'Upload Video File', icon: '📁', description: 'Upload video file to server' },
  { id: 'stream', name: 'Stream URL', icon: '🌐', description: 'Stream from URL' },
];

const STREAM_CONFIGS = {
  low: { chunkSize: 512, bitrate: 64, format: 'mp3', name: 'Low Quality', description: 'Best for slow networks' },
  medium: { chunkSize: 1024, bitrate: 128, format: 'mp3', name: 'Medium Quality', description: 'Balanced quality and latency' },
  high: { chunkSize: 2048, bitrate: 192, format: 'mp3', name: 'High Quality', description: 'Best audio quality' },
  lossless: { chunkSize: 4096, bitrate: 320, format: 'flac', name: 'Lossless', description: 'CD quality, highest bandwidth' }
};

export function StreamingTheaterSetup({ onBack, roomState }) {
  const [selectedPreset, setSelectedPreset] = useState('surround51');
  const [videoSource, setVideoSource] = useState('laptop');
  const [streamConfig, setStreamConfig] = useState('medium');
  const [audioStreaming, setAudioStreaming] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationLatency, setCalibrationLatency] = useState(100);
  const [showCalibration, setShowCalibration] = useState(false);
  const [streamingData, setStreamingData] = useState({
    streamingTheaterMode: false,
    speakers: [],
    phoneAssignments: {},
    myAssignment: null,
    audioStreaming: false,
    streamConfig: null
  });

  const myId = syncService.state.myId;
  const isHost = roomState?.isHost || false;

  useEffect(() => {
    const handleUpdate = (data) => {
      setStreamingData(data);
    };

    streamingTheaterService.subscribe(handleUpdate);
    
    return () => {
      streamingTheaterService.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Load saved config from localStorage
    const savedConfig = localStorage.getItem('streamingTheaterConfig');
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        setSelectedPreset(config.preset || 'surround51');
        setVideoSource(config.videoSource || 'laptop');
        setStreamConfig(config.streamConfig || 'medium');
      } catch (e) {
        console.log('No saved config found');
      }
    }
  }, []);

  const handleEnableStreamingTheater = async () => {
    const preset = SPEAKER_PRESETS[selectedPreset];
    const config = STREAM_CONFIGS[streamConfig];
    
    const response = await streamingTheaterService.enableStreamingTheater(videoSource, {
      speakers: preset.speakers,
      streamConfig: config,
      preset: selectedPreset
    });
    
    if (response.success) {
      // Save config
      localStorage.setItem('streamingTheaterConfig', JSON.stringify({
        preset: selectedPreset,
        videoSource,
        streamConfig
      }));
    }
  };

  const handleDisableStreamingTheater = async () => {
    const response = await streamingTheaterService.disableStreamingTheater();
    if (response.success) {
      // Keep config for next time
    }
  };

  const handleToggleAudioStreaming = async () => {
    if (audioStreaming) {
      const response = await streamingTheaterService.disableAudioStreaming();
      if (response.success) setAudioStreaming(false);
    } else {
      const config = STREAM_CONFIGS[streamConfig];
      const response = await streamingTheaterService.enableAudioStreaming(config);
      if (response.success) setAudioStreaming(true);
    }
  };

  const handleAssignPhone = async (phoneId, speakerId) => {
    const speaker = streamingData.speakers.find(s => s.id === speakerId);
    if (!speaker) return;
    
    const response = await streamingTheaterService.assignPhoneToSpeaker(
      phoneId, 
      speakerId,
      100, // default latency
      80   // default volume
    );
    if (response.success) {
      console.log(`Assigned phone ${phoneId} to speaker ${speakerId}`);
    }
  };

  const handleUnassignPhone = async (phoneId) => {
    const response = await streamingTheaterService.unassignPhoneFromSpeaker(phoneId);
    if (response.success) {
      console.log(`Unassigned phone ${phoneId}`);
    }
  };

  const handleUpdateSettings = async (settings) => {
    const response = await streamingTheaterService.updateMySettings(settings);
    if (response.success) {
      console.log(`Updated settings: ${JSON.stringify(settings)}`);
    }
  };

  const handlePresetChange = (preset) => {
    setSelectedPreset(preset);
  };

  const handleStreamConfigChange = (config) => {
    setStreamConfig(config);
  };

  const startCalibration = () => {
    setIsCalibrating(true);
    setShowCalibration(true);
    streamingTheaterService.startCalibration();
  };

  const completeCalibration = () => {
    setIsCalibrating(false);
    setShowCalibration(false);
    streamingTheaterService.completeCalibration(calibrationLatency);
  };

  const getMyAssignment = () => {
    return streamingData.myAssignment;
  };

  const getSpeakerById = (speakerId) => {
    return streamingData.speakers.find(s => s.id === speakerId);
  };

  const getPhoneName = (phoneId) => {
    const member = roomState?.members?.find(m => m.id === phoneId);
    return member ? member.name : phoneId;
  };

  const isSpeakerAssigned = (speakerId) => {
    return Object.values(streamingData.phoneAssignments || {}).some(
      assignment => assignment.speakerId === speakerId
    );
  };

  const getPhoneForSpeaker = (speakerId) => {
    for (const [phoneId, assignment] of Object.entries(streamingData.phoneAssignments || {})) {
      if (assignment.speakerId === speakerId) {
        return phoneId;
      }
    }
    return null;
  };

  // Get all phones
  const allPhones = roomState?.members || [];

  // Get unassigned phones
  const unassignedPhones = allPhones.filter(member => {
    return !Object.values(streamingData.phoneAssignments || {}).some(
      assignment => assignment.phoneId === member.id
    );
  });

  // Get current preset
  const currentPreset = SPEAKER_PRESETS[selectedPreset];

  return (
    <div className="streaming-theater-setup">
      <div className="theater-header">
        <button className="btn-back" onClick={onBack}>
          ← Back
        </button>
        <h2>🎭 Streaming Theater Mode Setup</h2>
        <span className={`theater-status ${streamingData.streamingTheaterMode ? 'active' : ''}`}>
          {streamingData.streamingTheaterMode ? '✅ Active' : '⚪ Inactive'}
        </span>
      </div>

      {!streamingData.streamingTheaterMode ? (
        <div className="theater-activation">
          <div className="glass section">
            <h3>Activate Streaming Theater Mode</h3>
            <p>
              <strong>Full Streaming Mode:</strong> Laptop streams audio to server, 
              which broadcasts to all phones. Each phone plays through its connected Bluetooth speakers.
            </p>
            
            <div className="form-group">
              <label>Video Source</label>
              <div className="video-source-selector">
                {VIDEO_SOURCES.map(source => (
                  <button
                    key={source.id}
                    className={`video-source-btn ${videoSource === source.id ? 'active' : ''}`}
                    onClick={() => setVideoSource(source.id)}
                  >
                    <span>{source.icon}</span>
                    <span>{source.name}</span>
                    <small>{source.description}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Speaker Configuration</label>
              <div className="preset-selector">
                {Object.keys(SPEAKER_PRESETS).map(preset => (
                  <button
                    key={preset}
                    className={`preset-btn ${selectedPreset === preset ? 'active' : ''}`}
                    onClick={() => handlePresetChange(preset)}
                  >
                    {SPEAKER_PRESETS[preset].name}
                    <small>{SPEAKER_PRESETS[preset].speakers.length} speakers</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Stream Quality</label>
              <div className="stream-config-selector">
                {Object.keys(STREAM_CONFIGS).map(config => (
                  <button
                    key={config}
                    className={`stream-config-btn ${streamConfig === config ? 'active' : ''}`}
                    onClick={() => handleStreamConfigChange(config)}
                  >
                    <span>{STREAM_CONFIGS[config].name}</span>
                    <small>{STREAM_CONFIGS[config].description}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="speaker-preview">
              <h4>Speakers ({currentPreset.speakers.length}):</h4>
              <div className="speakers-grid">
                {currentPreset.speakers.map(speaker => (
                  <div key={speaker.id} className={`speaker-card ${speaker.type}`}>
                    <span className="speaker-icon">{speaker.icon}</span>
                    <span className="speaker-name">{speaker.name}</span>
                    <span className="speaker-channel">Channel {speaker.channel}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="streaming-info">
              <div className="info-card">
                <h4>💡 How Streaming Mode Works</h4>
                <ul>
                  <li><strong>Laptop:</strong> Captures audio and streams to server</li>
                  <li><strong>Server:</strong> Broadcasts audio chunks to all phones</li>
                  <li><strong>Phones:</strong> Each phone plays its assigned channel(s)</li>
                  <li><strong>Speakers:</strong> Each phone outputs to its Bluetooth speaker</li>
                  <li><strong>Sync:</strong> All devices sync to laptop's video playback</li>
                </ul>
              </div>
            </div>

            {isHost && (
              <button 
                className="btn btn-primary btn-large"
                onClick={handleEnableStreamingTheater}
              >
                ✅ Enable Streaming Theater Mode
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="theater-active">
          <div className="theater-controls">
            {/* Audio Streaming Section */}
            <div className="glass section">
              <h3>🎵 Audio Streaming</h3>
              <p>
                Laptop streams audio to server, which broadcasts to all phones.
                Each phone plays through its connected Bluetooth speakers.
              </p>
              
              <div className="streaming-controls">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={streamingData.audioStreaming}
                    onChange={handleToggleAudioStreaming}
                    disabled={!isHost}
                  />
                  <span className="slider round"></span>
                </label>
                <span className="streaming-label">
                  {streamingData.audioStreaming ? 'Streaming Enabled' : 'Streaming Disabled'}
                </span>
              </div>
              
              {streamingData.audioStreaming && streamingData.streamConfig && (
                <div className="streaming-info">
                  <p>Audio is being streamed from laptop to all phones.</p>
                  <div className="streaming-stats">
                    <div className="stat">
                      <span>Chunk Size:</span>
                      <span>{streamingData.streamConfig.chunkSize} bytes</span>
                    </div>
                    <div className="stat">
                      <span>Bitrate:</span>
                      <span>{streamingData.streamConfig.bitrate} kbps</span>
                    </div>
                    <div className="stat">
                      <span>Format:</span>
                      <span>{streamingData.streamConfig.format.toUpperCase()}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Speaker Assignments Section */}
            <div className="glass section">
              <h3>🔊 Speaker Assignments</h3>
              <p>Assign phones to control specific audio channels</p>
              
              <div className="speakers-assignment-grid">
                {streamingData.speakers.map(speaker => {
                  const assignedPhoneId = getPhoneForSpeaker(speaker.id);
                  const isAssigned = isSpeakerAssigned(speaker.id);
                  const isMine = assignedPhoneId === myId;
                  
                  return (
                    <div 
                      key={speaker.id}
                      className={`speaker-card ${speaker.type} ${isAssigned ? 'assigned' : ''}`}
                    >
                      <div className="speaker-header">
                        <span className="speaker-icon">{speaker.icon}</span>
                        <span className="speaker-name">{speaker.name}</span>
                        <span className="speaker-channel">Ch. {speaker.channel}</span>
                      </div>
                      
                      {isAssigned ? (
                        <div className="assignment-badge">
                          <span>→ {getPhoneName(assignedPhoneId)}</span>
                          {isMine && (
                            <button 
                              className="btn-unassign"
                              onClick={() => handleUnassignPhone(myId)}
                            >
                              Unassign
                            </button>
                          )}
                          {isHost && !isMine && (
                            <button 
                              className="btn-unassign"
                              onClick={() => handleUnassignPhone(assignedPhoneId)}
                            >
                              Reassign
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="assignment-actions">
                          {isHost && unassignedPhones.length > 0 && (
                            <select
                              className="phone-select"
                              onChange={(e) => handleAssignPhone(e.target.value, speaker.id)}
                            >
                              <option value="">Assign Phone...</option>
                              {unassignedPhones.map(phone => (
                                <option key={phone.id} value={phone.id}>
                                  {phone.name}
                                </option>
                              ))}
                            </select>
                          )}
                          {!isHost && (
                            <button 
                              className="btn btn-small btn-claim"
                              onClick={() => handleAssignPhone(myId, speaker.id)}
                            >
                              Claim
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* My Assignment Section */}
            <div className="glass section">
              <h3>📱 My Assignment</h3>
              
              {getMyAssignment() ? (
                <div className="my-assignment">
                  <div className="assignment-card">
                    <div className="assignment-icon">
                      {getSpeakerById(getMyAssignment().speakerId)?.icon || '🔊'}
                    </div>
                    <div className="assignment-details">
                      <h4>{getSpeakerById(getMyAssignment().speakerId)?.name || getMyAssignment().speakerId}</h4>
                      <p>Channel: {getMyAssignment().channel}</p>
                      <p>Latency: {getMyAssignment().latency}ms</p>
                      <p>Volume: {getMyAssignment().volume}%</p>
                    </div>
                    <button 
                      className="btn-unassign"
                      onClick={() => handleUnassignPhone(myId)}
                    >
                      Unassign
                    </button>
                  </div>
                  
                  <div className="settings-control">
                    <div className="setting">
                      <label>Bluetooth Latency: {getMyAssignment().latency}ms</label>
                      <input
                        type="range"
                        min="50"
                        max="300"
                        step="10"
                        value={getMyAssignment().latency}
                        onChange={(e) => handleUpdateSettings({ latency: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="setting">
                      <label>Volume: {getMyAssignment().volume}%</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={getMyAssignment().volume}
                        onChange={(e) => handleUpdateSettings({ volume: parseInt(e.target.value) })}
                      />
                    </div>
                    <button 
                      className="btn btn-small"
                      onClick={startCalibration}
                    >
                      📏 Calibrate Latency
                    </button>
                  </div>
                </div>
              ) : (
                <div className="no-assignment">
                  <p>You are not assigned to any speaker yet.</p>
                  <p>Wait for the host to assign you, or claim an unassigned speaker.</p>
                </div>
              )}
            </div>

            {/* Host Controls */}
            {isHost && (
              <div className="glass section">
                <h3>🎬 Host Controls</h3>
                <button 
                  className="btn btn-warning"
                  onClick={handleDisableStreamingTheater}
                >
                  ❌ Disable Streaming Theater Mode
                </button>
              </div>
            )}
          </div>

          {/* Calibration Modal */}
          {showCalibration && (
            <div className="modal-overlay">
              <div className="modal calibration-modal">
                <h3>📏 Bluetooth Latency Calibration</h3>
                
                {!isCalibrating ? (
                  <div className="calibration-instructions">
                    <p>
                      To calibrate your Bluetooth latency:
                    </p>
                    <ol>
                      <li>Click "Start Test" below</li>
                      <li>A test tone will play through your speaker</li>
                      <li>Click "Heard It!" when you hear the tone</li>
                      <li>The latency will be calculated automatically</li>
                    </ol>
                    
                    <div className="calibration-controls">
                      <button 
                        className="btn btn-primary"
                        onClick={() => {
                          setIsCalibrating(true);
                        }}
                      >
                        Start Test
                      </button>
                      <button 
                        className="btn btn-secondary"
                        onClick={() => setShowCalibration(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="calibration-active">
                    <p>Test tone playing...</p>
                    <p>Click when you hear it:</p>
                    <div className="latency-slider">
                      <input
                        type="range"
                        min="50"
                        max="300"
                        step="10"
                        value={calibrationLatency}
                        onChange={(e) => setCalibrationLatency(parseInt(e.target.value))}
                      />
                      <span>{calibrationLatency}ms</span>
                    </div>
                    <div className="calibration-actions">
                      <button 
                        className="btn btn-success"
                        onClick={completeCalibration}
                      >
                        ✅ Heard It!
                      </button>
                      <button 
                        className="btn btn-secondary"
                        onClick={() => {
                          setIsCalibrating(false);
                          setShowCalibration(false);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default StreamingTheaterSetup;
