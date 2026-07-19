import React, { useState, useEffect } from 'react';
import { theaterService } from './TheaterService.js';
import { syncService } from './SyncService.js';

// Predefined speaker configurations
const SPEAKER_PRESETS = {
  basic: [
    { id: 'big-1', name: 'Big Speaker 1', type: 'big', icon: '🔊' },
    { id: 'big-2', name: 'Big Speaker 2', type: 'big', icon: '🔊' },
    { id: 'small-1', name: 'Small Speaker 1', type: 'small', icon: '🔈' },
    { id: 'small-2', name: 'Small Speaker 2', type: 'small', icon: '🔈' },
    { id: 'small-3', name: 'Small Speaker 3', type: 'small', icon: '🔈' },
    { id: 'small-4', name: 'Small Speaker 4', type: 'small', icon: '🔈' },
  ],
  surround51: [
    { id: 'front-left', name: 'Front Left', type: 'big', icon: '🔊' },
    { id: 'front-right', name: 'Front Right', type: 'big', icon: '🔊' },
    { id: 'front-center', name: 'Front Center', type: 'big', icon: '🔊' },
    { id: 'rear-left', name: 'Rear Left', type: 'small', icon: '🔈' },
    { id: 'rear-right', name: 'Rear Right', type: 'small', icon: '🔈' },
    { id: 'subwoofer', name: 'Subwoofer', type: 'big', icon: '🎚️' },
  ],
  surround71: [
    { id: 'front-left', name: 'Front Left', type: 'big', icon: '🔊' },
    { id: 'front-right', name: 'Front Right', type: 'big', icon: '🔊' },
    { id: 'front-center', name: 'Front Center', type: 'big', icon: '🔊' },
    { id: 'side-left', name: 'Side Left', type: 'small', icon: '🔈' },
    { id: 'side-right', name: 'Side Right', type: 'small', icon: '🔈' },
    { id: 'rear-left', name: 'Rear Left', type: 'small', icon: '🔈' },
    { id: 'rear-right', name: 'Rear Right', type: 'small', icon: '🔈' },
    { id: 'subwoofer', name: 'Subwoofer', type: 'big', icon: '🎚️' },
  ],
  custom: []
};

const VIDEO_SOURCES = [
  { id: 'laptop', name: 'Laptop (Screen Share)', icon: '💻' },
  { id: 'file', name: 'Upload Video File', icon: '📁' },
  { id: 'stream', name: 'Stream URL', icon: '🌐' },
  { id: 'youtube', name: 'YouTube', icon: '📺' },
];

export function TheaterSetup({ onBack, roomState }) {
  const [speakers, setSpeakers] = useState(SPEAKER_PRESETS.basic);
  const [selectedPreset, setSelectedPreset] = useState('basic');
  const [videoSource, setVideoSource] = useState('laptop');
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationLatency, setCalibrationLatency] = useState(100);
  const [customSpeakerName, setCustomSpeakerName] = useState('');
  const [customSpeakerType, setCustomSpeakerType] = useState('small');
  const [showCalibration, setShowCalibration] = useState(false);
  const [theaterData, setTheaterData] = useState({
    theaterMode: false,
    speakerAssignments: {},
    bluetoothLatency: 100,
    mySpeakers: []
  });

  const myId = syncService.state.myId;
  const isHost = roomState?.isHost || false;

  useEffect(() => {
    const handleUpdate = (data) => {
      setTheaterData(data);
    };

    theaterService.subscribe(handleUpdate);
    
    return () => {
      theaterService.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Load saved speakers from localStorage
    const savedSpeakers = localStorage.getItem('theaterSpeakers');
    if (savedSpeakers) {
      try {
        setSpeakers(JSON.parse(savedSpeakers));
      } catch (e) {
        console.log('No saved speakers found');
      }
    }
  }, []);

  const handleEnableTheaterMode = async () => {
    const response = await theaterService.enableTheaterMode(videoSource);
    if (response.success) {
      // Save speakers to localStorage
      localStorage.setItem('theaterSpeakers', JSON.stringify(speakers));
    }
  };

  const handleDisableTheaterMode = async () => {
    const response = await theaterService.disableTheaterMode();
    if (response.success) {
      // Keep speakers for next time
    }
  };

  const handleAssignSpeaker = async (speakerId) => {
    const response = await theaterService.assignSpeaker(speakerId);
    if (response.success) {
      console.log(`Assigned speaker ${speakerId} to phone`);
    }
  };

  const handleUnassignSpeaker = async (speakerId) => {
    const response = await theaterService.unassignSpeaker(speakerId);
    if (response.success) {
      console.log(`Unassigned speaker ${speakerId}`);
    }
  };

  const handleAssignToPhone = async (phoneId, speakerId) => {
    const response = await theaterService.assignSpeakerToPhone(phoneId, speakerId);
    if (response.success) {
      console.log(`Assigned speaker ${speakerId} to phone ${phoneId}`);
    }
  };

  const handleSetBluetoothLatency = async (latency) => {
    const response = await theaterService.setBluetoothLatency(latency);
    if (response.success) {
      setCalibrationLatency(latency);
    }
  };

  const handlePresetChange = (preset) => {
    setSelectedPreset(preset);
    setSpeakers([...SPEAKER_PRESETS[preset]]);
  };

  const handleAddCustomSpeaker = () => {
    if (!customSpeakerName.trim()) return;
    
    const newSpeaker = {
      id: `custom-${Date.now()}`,
      name: customSpeakerName.trim(),
      type: customSpeakerType,
      icon: customSpeakerType === 'big' ? '🔊' : '🔈'
    };
    
    setSpeakers([...speakers, newSpeaker]);
    setCustomSpeakerName('');
  };

  const handleRemoveSpeaker = (speakerId) => {
    // Don't allow removing speakers that are assigned
    const isAssigned = Object.values(theaterData.speakerAssignments || {}).some(
      speakers => speakers.includes(speakerId)
    );
    
    if (isAssigned) {
      alert('Cannot remove a speaker that is currently assigned. Unassign it first.');
      return;
    }
    
    setSpeakers(speakers.filter(s => s.id !== speakerId));
  };

  const startCalibration = () => {
    setIsCalibrating(true);
    setShowCalibration(true);
    theaterService.startCalibration();
  };

  const completeCalibration = () => {
    setIsCalibrating(false);
    setShowCalibration(false);
    theaterService.completeCalibration(calibrationLatency);
  };

  const getMyAssignments = () => {
    return theaterData.speakerAssignments[myId] || [];
  };

  const getSpeakerById = (speakerId) => {
    return speakers.find(s => s.id === speakerId);
  };

  const getPhoneName = (phoneId) => {
    const member = roomState?.members?.find(m => m.id === phoneId);
    return member ? member.name : phoneId;
  };

  // Check if a speaker is assigned to any phone
  const isSpeakerAssigned = (speakerId) => {
    return Object.values(theaterData.speakerAssignments || {}).some(
      speakers => speakers.includes(speakerId)
    );
  };

  // Get phone that has a speaker assigned
  const getPhoneForSpeaker = (speakerId) => {
    for (const [phoneId, speakerIds] of Object.entries(theaterData.speakerAssignments || {})) {
      if (speakerIds.includes(speakerId)) {
        return phoneId;
      }
    }
    return null;
  };

  return (
    <div className="theater-setup">
      <div className="theater-header">
        <button className="btn-back" onClick={onBack}>
          ← Back
        </button>
        <h2>🎭 Theater Mode Setup</h2>
        <span className="theater-status">
          {theaterData.theaterMode ? '✅ Active' : '⚪ Inactive'}
        </span>
      </div>

      {!theaterData.theaterMode ? (
        <div className="theater-activation">
          <div className="glass section">
            <h3>Activate Theater Mode</h3>
            <p>Transform your room into a multi-speaker theater experience.</p>
            
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
                  </button>
                ))}
              </div>
            </div>

            <div className="custom-speaker-form">
              <input
                type="text"
                placeholder="Custom speaker name"
                value={customSpeakerName}
                onChange={(e) => setCustomSpeakerName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddCustomSpeaker()}
              />
              <select value={customSpeakerType} onChange={(e) => setCustomSpeakerType(e.target.value)}>
                <option value="small">Small</option>
                <option value="big">Big</option>
              </select>
              <button className="btn btn-small" onClick={handleAddCustomSpeaker}>
                Add
              </button>
            </div>

            <div className="speaker-list-preview">
              <h4>Speakers ({speakers.length}):</h4>
              <div className="speaker-chips">
                {speakers.map(speaker => (
                  <div key={speaker.id} className="speaker-chip">
                    <span>{speaker.icon}</span>
                    <span>{speaker.name}</span>
                    <button 
                      className="btn-remove" 
                      onClick={() => handleRemoveSpeaker(speaker.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {isHost && (
              <button 
                className="btn btn-primary btn-large"
                onClick={handleEnableTheaterMode}
              >
                ✅ Enable Theater Mode
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="theater-active">
          <div className="theater-controls">
            <div className="glass section">
              <h3>Speaker Assignments</h3>
              <p>Assign phones to control speakers</p>
              
              <div className="assignment-grid">
                {speakers.map(speaker => {
                  const assignedPhoneId = getPhoneForSpeaker(speaker.id);
                  const isAssigned = isSpeakerAssigned(speaker.id);
                  const isMine = assignedPhoneId === myId;
                  
                  return (
                    <div 
                      key={speaker.id}
                      className={`speaker-card ${isAssigned ? 'assigned' : ''} ${speaker.type}`}
                    >
                      <div className="speaker-icon">{speaker.icon}</div>
                      <div className="speaker-name">{speaker.name}</div>
                      <div className="speaker-type">{speaker.type}</div>
                      
                      {isAssigned ? (
                        <div className="assignment-badge">
                          <span>→ {getPhoneName(assignedPhoneId)}</span>
                          {isMine && (
                            <button 
                              className="btn-unassign"
                              onClick={() => handleUnassignSpeaker(speaker.id)}
                            >
                              Unassign
                            </button>
                          )}
                          {isHost && !isMine && (
                            <button 
                              className="btn-unassign"
                              onClick={() => handleAssignToPhone(myId, speaker.id)}
                            >
                              Reassign
                            </button>
                          )}
                        </div>
                      ) : (
                        <button 
                          className="btn btn-small btn-assign"
                          onClick={() => handleAssignSpeaker(speaker.id)}
                          disabled={!isHost && getMyAssignments().length >= 2}
                        >
                          {isHost ? 'Assign to...' : 'Claim'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="glass section">
              <h3>My Speakers</h3>
              <div className="my-speakers-list">
                {getMyAssignments().length > 0 ? (
                  getMyAssignments().map(speakerId => {
                    const speaker = getSpeakerById(speakerId);
                    return speaker ? (
                      <div key={speakerId} className="my-speaker-item">
                        <span>{speaker.icon}</span>
                        <span>{speaker.name}</span>
                        <span className="speaker-type">{speaker.type}</span>
                        <button 
                          className="btn-remove"
                          onClick={() => handleUnassignSpeaker(speakerId)}
                        >
                          ×
                        </button>
                      </div>
                    ) : null;
                  })
                ) : (
                  <p className="no-speakers">No speakers assigned to you yet.</p>
                )}
              </div>
            </div>

            <div className="glass section">
              <h3>Bluetooth Latency Calibration</h3>
              <p>Measure and compensate for Bluetooth audio delay</p>
              
              <div className="latency-info">
                <div className="latency-value">
                  <span>Current Latency:</span>
                  <span className="latency-number">{theaterData.bluetoothLatency}ms</span>
                </div>
                <p className="latency-note">
                  Higher latency = more delay compensation needed
                </p>
              </div>

              <button 
                className="btn btn-secondary"
                onClick={startCalibration}
              >
                📏 Calibrate Bluetooth Latency
              </button>
            </div>

            {isHost && (
              <div className="glass section">
                <h3>Host Controls</h3>
                <button 
                  className="btn btn-warning"
                  onClick={handleDisableTheaterMode}
                >
                  ❌ Disable Theater Mode
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
                          // In a real implementation, we would play a test tone here
                          // For now, we'll simulate it
                          setTimeout(() => {
                            // Simulate hearing the tone after a delay
                            // In reality, this would be triggered by user click
                          }, 1000);
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

export default TheaterSetup;
