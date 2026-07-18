// SyncPlay Server - OPTIMIZED for tight synchronization
// Compatible with Node.js 12+
var express = require('express');
var http = require('http');
var Server = require('socket.io').Server;
var multer = require('multer');
var cors = require('cors');
var path = require('path');
var uuidv4 = require('uuid').v4;
var fs = require('fs');
var os = require('os');

var app = express();
var server = http.createServer(app);
var io = new Server(server, {
  cors: { origin: '*' },
  maxHttpBufferSize: 50 * 1024 * 1024,
  pingInterval: 2000,
  pingTimeout: 5000
});

app.use(cors());
app.use(express.json());

// Directories - Only handling uploads now
var uploadDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

console.log('Upload directory: ' + uploadDir);

// Static Files - Serve uploaded audio files
app.use('/uploads', express.static(uploadDir));

// File Upload
var storage = multer.diskStorage({
  destination: uploadDir,
  filename: function(req, file, cb) {
    var ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  }
});
var upload = multer({ storage: storage, limits: { fileSize: 50 * 1024 * 1024 } });

app.post('/upload', upload.single('audio'), function(req, res) {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  var url = '/uploads/' + req.file.filename;
  console.log('File uploaded: ' + req.file.originalname + ' -> ' + url);
  res.json({ url: url, originalName: req.file.originalname });
});

// Room Management
var rooms = new Map();
var clientRTT = new Map();

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function getRoomState(room) {
  var maxRTT = 50;
  room.members.forEach(function(member) {
    var rtt = clientRTT.get(member.id) || 50;
    if (rtt > maxRTT) maxRTT = rtt;
  });
  
  return {
    id: room.id,
    hostId: room.hostId,
    members: Array.from(room.members.values()),
    currentTrack: room.currentTrack,
    playbackState: room.playbackState,
    placements: room.placements || {},
    maxRTT: Math.min(maxRTT, 500),
    readyCount: room.readyMembers ? room.readyMembers.size : 0,
    totalCount: room.members.size
  };
}

function safeFixed(val) {
  if (val !== null && val !== undefined && typeof val.toFixed === 'function') {
    return val.toFixed(2);
  }
  return String(val);
}

function serverTime() {
  return Date.now();
}

// Socket.IO Events
io.on('connection', function(socket) {
  console.log('Connected: ' + socket.id);
  var currentRoom = null;
  
  clientRTT.set(socket.id, 50);

  socket.on('clock-sync', function(data, callback) {
    var now = serverTime();
    if (data.lastRTT) {
      clientRTT.set(socket.id, data.lastRTT);
    }
    callback({
      clientTime: data.clientTime,
      serverTime: now,
      serverProcessTime: 0
    });
  });

  socket.on('create-room', function(data, callback) {
    var name = data.name;
    var roomId = generateRoomCode();
    var room = {
      id: roomId,
      hostId: socket.id,
      members: new Map(),
      currentTrack: null,
      playbackState: { playing: false, position: 0, serverTimeAtPlay: 0, sequence: 0 },
      placements: {},
      readyMembers: new Set(),
      syncSequence: 0
    };
    room.members.set(socket.id, { id: socket.id, name: name, isHost: true });
    rooms.set(roomId, room);

    socket.join(roomId);
    currentRoom = roomId;

    console.log('Room ' + roomId + ' created by ' + name);
    callback({ success: true, room: getRoomState(room) });
  });

  socket.on('join-room', function(data, callback) {
    var roomId = data.roomId;
    var name = data.name;
    var room = rooms.get(roomId.toUpperCase());
    if (!room) {
      console.log('Room ' + roomId + ' not found');
      return callback({ success: false, error: 'Room not found' });
    }

    room.members.set(socket.id, { id: socket.id, name: name, isHost: false });
    socket.join(roomId.toUpperCase());
    currentRoom = roomId.toUpperCase();

    var state = getRoomState(room);
    io.to(currentRoom).emit('room-updated', state);
    console.log(name + ' joined room ' + roomId);
    callback({ success: true, room: state });
  });

  socket.on('load-track', function(data) {
    if (!currentRoom) return;
    var room = rooms.get(currentRoom);
    if (!room || room.hostId !== socket.id) return;

    room.currentTrack = { url: data.url, name: data.name };
    room.playbackState = { playing: false, position: 0, serverTimeAtPlay: 0, sequence: 0 };
    room.readyMembers = new Set();

    io.to(currentRoom).emit('track-loaded', {
      track: room.currentTrack,
      playbackState: room.playbackState
    });
    console.log('Track loaded in ' + currentRoom + ': ' + data.name);
  });

  socket.on('audio-ready', function() {
    if (!currentRoom) return;
    var room = rooms.get(currentRoom);
    if (!room) return;
    
    room.readyMembers.add(socket.id);
    
    io.to(currentRoom).emit('ready-state', {
      readyCount: room.readyMembers.size,
      totalCount: room.members.size,
      allReady: room.readyMembers.size === room.members.size
    });
    
    console.log('Audio ready: ' + socket.id + ' (' + room.readyMembers.size + '/' + room.members.size + ')');
  });

  socket.on('play', function(data) {
    if (!currentRoom) return;
    var room = rooms.get(currentRoom);
    if (!room || room.hostId !== socket.id) return;

    var position = data.position || 0;
    
    var maxRTT = 50;
    room.members.forEach(function(member) {
      var rtt = clientRTT.get(member.id) || 50;
      if (rtt > maxRTT) maxRTT = rtt;
    });
    
    var syncBuffer = Math.max(150, maxRTT + 100);
    var scheduledTime = serverTime() + syncBuffer;
    
    room.syncSequence++;
    room.playbackState = {
      playing: true,
      position: position,
      serverTimeAtPlay: scheduledTime,
      sequence: room.syncSequence
    };

    io.to(currentRoom).emit('sync-play', {
      position: position,
      serverTimeAtPlay: scheduledTime,
      sequence: room.syncSequence,
      syncBuffer: syncBuffer
    });
    
    console.log('Play in ' + currentRoom + ' at pos ' + safeFixed(position) + 's (buffer: ' + syncBuffer + 'ms)');
  });

  socket.on('pause', function(data) {
    if (!currentRoom) return;
    var room = rooms.get(currentRoom);
    if (!room || room.hostId !== socket.id) return;

    var position = data.position || 0;
    room.syncSequence++;
    room.playbackState = {
      playing: false,
      position: position,
      serverTimeAtPlay: 0,
      sequence: room.syncSequence
    };

    io.to(currentRoom).emit('sync-pause', { 
      position: position,
      sequence: room.syncSequence,
      serverTime: serverTime()
    });
    console.log('Pause in ' + currentRoom + ' at pos ' + safeFixed(position) + 's');
  });

  socket.on('seek', function(data) {
    if (!currentRoom) return;
    var room = rooms.get(currentRoom);
    if (!room || room.hostId !== socket.id) return;
 
    var position = data.position;
    var wasPlaying = room.playbackState.playing;
     
    var maxRTT = 50;
    room.members.forEach(function(member) {
      var rtt = clientRTT.get(member.id) || 50;
      if (rtt > maxRTT) maxRTT = rtt;
    });
    var syncBuffer = Math.max(100, maxRTT + 50);
    var scheduledTime = wasPlaying ? serverTime() + syncBuffer : 0;
 
    room.syncSequence++;
    room.playbackState = {
      playing: wasPlaying,
      position: position,
      serverTimeAtPlay: scheduledTime,
      sequence: room.syncSequence
    };
 
    io.to(currentRoom).emit('sync-seek', {
      position: position,
      serverTimeAtPlay: scheduledTime,
      playing: wasPlaying,
      sequence: room.syncSequence
    });
    console.log('Seek in ' + currentRoom + ' to ' + safeFixed(position) + 's');
  });

  socket.on('update-placements', function(data) {
    if (!currentRoom) return;
    var room = rooms.get(currentRoom);
    if (!room || room.hostId !== socket.id) return;
 
    room.placements = data.placements || {};
    io.to(currentRoom).emit('room-updated', getRoomState(room));
    console.log('Updated placements in ' + currentRoom);
  });

  socket.on('sync-heartbeat', function(data) {
    if (!currentRoom) return;
    var room = rooms.get(currentRoom);
    if (!room || room.hostId !== socket.id) return;
    
    socket.to(currentRoom).emit('sync-correction', { 
      position: data.position,
      serverTime: serverTime(),
      sequence: data.sequence || room.syncSequence,
      isPlaying: room.playbackState.playing
    });
  });

  socket.on('position-report', function(data) {
    if (!currentRoom) return;
    var room = rooms.get(currentRoom);
    if (!room) return;
    
    var member = room.members.get(socket.id);
    if (member) {
      member.lastPosition = data.position;
      member.lastReportTime = serverTime();
      member.drift = data.drift;
    }
  });

  socket.on('become-host', function(callback) {
    if (!currentRoom) return callback({ success: false });
    var room = rooms.get(currentRoom);
    if (!room) return callback({ success: false });

    var oldHost = room.members.get(room.hostId);
    if (oldHost) oldHost.isHost = false;

    room.hostId = socket.id;
    var newHost = room.members.get(socket.id);
    if (newHost) newHost.isHost = true;

    room.playbackState.playing = false;
    room.syncSequence++;

    var state = getRoomState(room);
    io.to(currentRoom).emit('room-updated', state);
    io.to(currentRoom).emit('sync-pause', { 
      position: room.playbackState.position,
      sequence: room.syncSequence,
      serverTime: serverTime()
    });
    callback({ success: true });
    console.log('New host in ' + currentRoom + ': ' + (newHost ? newHost.name : 'unknown'));
  });

  socket.on('disconnect', function() {
    console.log('Disconnected: ' + socket.id);
    clientRTT.delete(socket.id);
    
    if (!currentRoom) return;
    var room = rooms.get(currentRoom);
    if (!room) return;

    var member = room.members.get(socket.id);
    room.members.delete(socket.id);
    if (room.readyMembers) {
      room.readyMembers.delete(socket.id);
    }

    if (room.members.size === 0) {
      rooms.delete(currentRoom);
      console.log('Room ' + currentRoom + ' deleted (empty)');
      return;
    }

    if (room.hostId === socket.id) {
      var firstMember = room.members.values().next().value;
      room.hostId = firstMember.id;
      firstMember.isHost = true;
      room.playbackState.playing = false;
      console.log('Auto-assigned new host: ' + firstMember.name);
    }

    var state = getRoomState(room);
    io.to(currentRoom).emit('room-updated', state);
    console.log((member ? member.name : 'Unknown') + ' left room ' + currentRoom);
  });
});

function getLocalIP() {
  var interfaces = os.networkInterfaces();
  var keys = Object.keys(interfaces);
  for (var i = 0; i < keys.length; i++) {
    var ifaceList = interfaces[keys[i]];
    for (var j = 0; j < ifaceList.length; j++) {
      var iface = ifaceList[j];
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

var PORT = process.env.PORT || 5000;
var localIP = getLocalIP();

server.listen(PORT, '0.0.0.0', function() {
  console.log('\n==================================================');
  console.log('  SyncPlay API Server v2.0 - OPTIMIZED');
  console.log('==================================================');
  console.log('\n  Local API:   http://localhost:' + PORT);
  console.log('  Network API: http://' + localIP + ':' + PORT);
  console.log('==================================================\n');
});