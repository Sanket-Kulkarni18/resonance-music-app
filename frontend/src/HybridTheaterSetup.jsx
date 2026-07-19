import React, { useState, useEffect } from 'react';
import { hybridTheaterService } from './HybridTheaterService.js';
import { syncService } from './SyncService.js';

// Speaker presets for hybrid mode
const SPEAKER_PRESETS = {
  basic: {
    big: [
      { id: 'big-1', name: 'Big Speaker 1 (Front Left)', type: 'big', icon: '🔊' },
      { id: 'big-2', name: 'Big Speaker 2 (Front Right)', type: 'big', icon: '🔊' }
    ],
    small: [
      { id: 'small-1', name: 'Small Speaker 1 (Rear Left)', type: 'small', icon: '🔈' },
      { id: 'small-2', name: 'Small Speaker 2 (Rear Right)', type: 'small', icon: '🔈' },
      { id: 'small-3', name: 'Small Speaker 3 (Side Left)', type: 'small', icon: '🔈' },
      { id: 'small-4', name: 'Small Speaker 4 (Side Right)', type: 'small', icon: '🔈' }
    ]
  },
  surround51: {
    big: [
      { id: 'front-left', name: 'Front Left', type: 'big', icon: '🔊' },
      { id: 'front-right', name: 'Front Right', type: 'big', icon: '🔊' },
      { id: 'front-center', name: 'Front Center', type: 'big', icon: '🔊' },
      { id: 'subwoofer', name: 'Subwoofer', type: 'big', icon: '🎚️' }
    ],
    small: [
      { id: 'rear-left', name: 'Rear Left', type: 'small', icon: '🔈' },
      { id: 'rear-right', name: 'Rear Right', type: 'small', icon: '🔈' }
    ]
  },
  surround71: {
    big: [
      { id: 'front-left', name: 'Front Left', type: 'big', icon: '🔊' },
      { id: 'front-right', name: 'Front Right', type: 'big', icon: '🔊' },
      { id: 'front-center', name: 'Front Center', type: 'big', icon: '🔊' },
      { id: 'subwoofer', name: 'Subwoofer', type: 'big', icon: '🎚️' }
    ],
    small: [
      { id: 'side-left', name: 'Side Left', type: 'small', icon: '🔈' },
      { id: 'side-right', name: 'Side Right', type: 'small', icon: '🔈' },
      { id: 'rear-left', name: 'Rear Left', type: 'small', icon: '🔈' },
      { id: 'rear-right', name: 'Rear Right', type: 'small', icon: '🔈' }
    ]
  }
};

const VIDEO_SOURCES = [
  { id: 'laptop', name: 'Laptop (Direct)', icon: '💻', description: 'Laptop connects directly to big speakers' },
  { id: 'file', name: 'Upload Video File', icon: '📁', description: 'Upload video file to server' },
  { id: 'stream', name: 'Stream URL', icon: '🌐', description: 'Stream from URL' },
];

export function HybridTheaterSetup({ onBack, roomState }) {
  const [selectedPreset, setSelectedPreset] = useState('basic');
  const [videoSource, setVideoSource] = useState('laptop');
  const [audioStreaming, setAudioStreaming] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationLatency, setCalibrationLatency] = useState(100);
  const [showCalibration, setShowCalibration] = useState(false);
  const [customSpeakerName, setCustomSpeakerName] = useState('');
  const [customSpeakerType, setCustomSpeakerType] = useState('small');
  const [hybridData, setHybridData] = useState({
    hybridTheaterMode: false,
    speakerGroups: { big: [], small: [] },
    phoneAssignments: {},
    myAssignment: null,
    audioStreaming: false
  });

  const myId = syncService.state.myId;
  const isHost = roomState?.isHost || false;

  useEffect(() => {
    const handleUpdate = (data) => {
      setHybridData(data);
    };

    hybridTheaterService.subscribe(handleUpdate);
    
    return () => {
      hybridTheaterService.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Load saved config from localStorage
    const savedConfig = localStorage.getItem('hybridTheaterConfig');
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        setSelectedPreset(config.preset || 'basic');
        setVideoSource(config.videoSource || 'laptop');
      } catch (e) {
        console.log('No saved config found');
      }
    }
  }, []);

  const handleEnableHybridTheater = async () => {
    const config = SPEAKER_PRESETS[selectedPreset];
    const response = await hybridTheaterService.enableHybridTheater(videoSource, { 
      speakerGroups: config,
      preset: selectedPreset
    });
    
    if (response.success) {
      // Save config
      localStorage.setItem('hybridTheaterConfig', JSON.stringify({
        preset: selectedPreset,
        videoSource
      }));
    }
  };

  const handleDisableHybridTheater = async () => {
    const response = await hybridTheaterService.disableHybridTheater();
    if (response.success) {
      // Keep config for next time
    }
  };

  const handleAssignPhone = async (phoneId, speakerId, speakerType) => {
    const response = await hybridTheaterService.assignPhoneToSpeaker(phoneId, speakerId, speakerType);
    if (response.success) {
      console.log(`Assigned phone ${phoneId} to speaker ${speakerId}`);
    }
  };

  const handleUnassignPhone = async (phoneId) => {
    const response = await hybridTheaterService.unassignPhoneFromSpeaker(phoneId);
    if (response.success) {
      console.log(`Unassigned phone ${phoneId}`);
    }
  };

  const handleUpdateLatency = async (latency) => {
    const response = await hybridTheaterService.updateMyLatency(latency);
    if (response.success) {
      setCalibrationLatency(latency);
    }
  };

  const handleToggleAudioStreaming = async () => {
    if (audioStreaming) {
      const response = await hybridTheaterService.disableAudioStreaming();
      if (response.success) setAudioStreaming(false);
    } else {
      const response = await hybridTheaterService.enableAudioStreaming({
        chunkSize: 1024,
        bitrate: 128,
        format: 'mp3'
      });
      if (response.success) setAudioStreaming(true);
    }
  };

  const handlePresetChange = (preset) => {
    setSelectedPreset(preset);
  };

  const startCalibration = () => {
    setIsCalibrating(true);
    setShowCalibration(true);
    hybridTheaterService.startCalibration();
  };

  const completeCalibration = () => {
    setIsCalibrating(false);
    setShowCalibration(false);
    hybridTheaterService.completeCalibration(calibrationLatency);
  };

  const getMyAssignment = () => {
    return hybridData.myAssignment;
  };

  const getSpeakerById = (speakerId, speakerType) => {
    const speakers = hybridData.speakerGroups[speakerType] || [];
    return speakers.find(s => s.id === speakerId);
  };

  const getPhoneName = (phoneId) => {
    const member = roomState?.members?.find(m => m.id === phoneId);
    return member ? member.name : phoneId;
  };

  const isSpeakerAssigned = (speakerId) => {
    return Object.values(hybridData.phoneAssignments || {}).some(
      assignment => assignment.speakerId === speakerId
    );
  };

  const getPhoneForSpeaker = (speakerId) => {
    for (const [phoneId, assignment] of Object.entries(hybridData.phoneAssignments || {})) {
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
    return !Object.values(hybridData.phoneAssignments || {}).some(
      assignment => assignment.phoneId === member.id
    );
  });

  return (
    <div className="hybrid-theater-setup">
      <div className="theater-header">
        <button className="btn-back" onClick={onBack}>
          ← Back
        </button>
        <h2>🎭 Hybrid Theater Mode Setup</h2>
        <span className={`theater-status ${hybridData.hybridTheaterMode ? 'active' : ''}`}>
          {hybridData.hybridTheaterMode ? '✅ Active' : '⚪ Inactive'}
        </span>
      </div>

      {!hybridData.hybridTheaterMode ? (
        <div className="theater-activation">
          <div className="glass section">
            <h3>Activate Hybrid Theater Mode</h3>
            <p>
              <strong>Hybrid Mode:</strong> Laptop connects directly to big speakers, 
              phones connect to small speakers. All synced together.
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
                    {preset.charAt(0).toUpperCase() + preset.slice(1)}
                    <small>
                      {SPEAKER_PRESETS[preset].big.length} Big + {SPEAKER_PRESETS[preset].small.length} Small
                    </small>
                  </button>
                ))}
              </div>
            </div>

            <div className="speaker-preview">
              <div className="speaker-group">
                <h4>Big Speakers (Laptop → Direct)</h4>
                <div className="speaker-chips">
                  {SPEAKER_PRESETS[selectedPreset].big.map(speaker => (
                    <div key={speaker.id} className="speaker-chip big">
                      <span>{speaker.icon}</span>
                      <span>{speaker.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="speaker-group">
                <h4>Small Speakers (Phones → Bluetooth)</h4>
                <div className="speaker-chips">
                  {SPEAKER_PRESETS[selectedPreset].small.map(speaker => (
                    <div key={speaker.id} className="speaker-chip small">
                      <span>{speaker.icon}</span>
                      <span>{speaker.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="hybrid-info">
              <div className="info-card">
                <h4>💡 How Hybrid Mode Works</h4>
                <ul>
                  <li><strong>Laptop:</strong> Connects directly to big speakers (lowest latency)</li>
                  <li><strong>Phones:</strong> Each phone connects to 1+ small speakers via Bluetooth</li>
                  <li><strong>Sync:</strong> All devices sync to laptop's video playback</li>
                  <li><strong>Latency:</strong> Bluetooth latency is measured and compensated</li>
                </ul>
              </div>
            </div>

            {isHost && (
              <button 
                className="btn btn-primary btn-large"
                onClick={handleEnableHybridTheater}
              >
                ✅ Enable Hybrid Theater Mode
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
                Enable audio streaming from laptop to phones for small speakers.
                Big speakers connect directly to laptop.
              </p>
              
              <div className="streaming-controls">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={hybridData.audioStreaming}
                    onChange={handleToggleAudioStreaming}
                    disabled={!isHost}
                  />
                  <span className="slider round"></span>
                </label>
                <span className="streaming-label">
                  {hybridData.audioStreaming ? 'Streaming Enabled' : 'Streaming Disabled'}
                </span>
              </div>
              
              {hybridData.audioStreaming && (
                <div className="streaming-info">
                  <p>Laptop is streaming audio to phones assigned to small speakers.</p>
                  <p className="streaming-stats">
                    Chunk Size: {hybridData.streamingConfig?.chunkSize || 1024} bytes | 
                    Bitrate: {hybridData.streamingConfig?.bitrate || 128} kbps
                  </p>
                </div>
              )}
            </div>

            {/* Speaker Assignments Section */}
            <div className="glass section">
              <h3>🔊 Speaker Assignments</h3>
              
              <div className="assignment-tabs">
                <button className="tab-btn active">Big Speakers</button>
                <button className="tab-btn">Small Speakers</button>
              </div>
              
              <div className="speaker-assignment-grid">
                {/* Big Speakers */}
                <div className="speaker-section">
                  <h4>Big Speakers (Laptop → Direct Connection)</h4>
                  <div className="speakers-list">
                    {hybridData.speakerGroups.big.map(speaker => {
                      const assignedPhoneId = getPhoneForSpeaker(speaker.id);
                      const isAssigned = isSpeakerAssigned(speaker.id);
                      
                      return (
                        <div 
                          key={speaker.id}
                          className={`speaker-card big ${isAssigned ? 'assigned' : ''}`}
                        >
                          <div className="speaker-icon">{speaker.icon}</div>
                          <div className="speaker-name">{speaker.name}</div>
                          <div className="speaker-type">Direct (Laptop)</div>
                          
                          {isAssigned ? (
                            <div className="assignment-badge">
                              <span>→ {getPhoneName(assignedPhoneId)}</span>
                            </div>
                          ) : (
                            <div className="connection-status">
                              <span className="status-dot connected"></span>
                              <span>Connected to Laptop</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Small Speakers */}
                <div className="speaker-section">
                  <h4>Small Speakers (Phones → Bluetooth)</h4>
                  <div className="speakers-list">
                    {hybridData.speakerGroups.small.map(speaker => {
                      const assignedPhoneId = getPhoneForSpeaker(speaker.id);
                      const isAssigned = isSpeakerAssigned(speaker.id);
                      const isMine = assignedPhoneId === myId;
                      
                      return (
                        <div 
                          key={speaker.id}
                          className={`speaker-card small ${isAssigned ? 'assigned' : ''}`}
                        >
                          <div className="speaker-icon">{speaker.icon}</div>
                          <div className="speaker-name">{speaker.name}</div>
                          <div className="speaker-type">Bluetooth</div>
                          
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
                                  onChange={(e) => handleAssignPhone(e.target.value, speaker.id, 'small')}
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
                                  onClick={() => handleAssignPhone(myId, speaker.id, 'small')}
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
              </div>
            </div>

            {/* My Assignment Section */}
            <div className="glass section">
              <h3>📱 My Assignment</h3>
              
              {getMyAssignment() ? (
                <div className="my-assignment">
                  <div className="assignment-card">
                    <div className="assignment-icon">
                      {getSpeakerById(getMyAssignment().speakerId, getMyAssignment().speakerType)?.icon || '🔊'}
                    </div>
                    <div className="assignment-details">
                      <h4>{getSpeakerById(getMyAssignment().speakerId, getMyAssignment().speakerType)?.name || getMyAssignment().speakerId}</h4>
                      <p>Type: {getMyAssignment().speakerType}</p>
                      <p>Latency: {getMyAssignment().latency}ms</p>
                    </div>
                    <button 
                      className="btn-unassign"
                      onClick={() => handleUnassignPhone(myId)}
                    >
                      Unassign
                    </button>
                  </div>
                  
                  <div className="latency-control">
                    <label>Bluetooth Latency: {getMyAssignment().latency}ms</label>
                    <input
                      type="range"
                      min="50"
                      max="300"
                      step="10"
                      value={getMyAssignment().latency}
                      onChange={(e) => handleUpdateLatency(parseInt(e.target.value))}
                    />
                    <button 
                      className="btn btn-small"
                      onClick={startCalibration}
                    >
                      📏 Calibrate
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
                  onClick={handleDisableHybridTheater}
                >
                  ❌ Disable Hybrid Theater Mode
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

export default HybridTheaterSetup;
