const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

let rooms = [];

const generateKey = () => {
  return Math.random().toString(36).substring(2, 6);
};

io.on("connection", (socket) => {
  console.log("a user connected");

  socket.on("host-room", (data) => {
    const key = generateKey();
    const room = {
      id: socket.id,
      name: data.name,
      host: socket.id,
      key,
      timestamp: new Date(),
    };
    rooms.push(room);
    socket.join(room.id);
    socket.emit("room-hosted", room);
  });

  socket.on("get-rooms", () => {
    socket.emit("rooms-list", rooms);
  });

  socket.on("join-room", (data) => {
    const room = rooms.find((r) => r.id === data.roomId);
    if (room && room.key === data.key) {
      socket.join(room.id);
      socket.to(room.id).emit("user-joined", { userId: socket.id });
      socket.emit("room-joined", room);
    } else {
      socket.emit("invalid-key");
    }
  });

  socket.on("leave-room", (data) => {
    const room = rooms.find((r) => r.id === data.roomId);
    if (room) {
      socket.leave(room.id);
      socket.to(room.id).emit("user-left", { userId: socket.id });
    }
  });

  socket.on("call-user", (data) => {
    socket.to(data.userToSignal).emit("call-made", {
      offer: data.signal,
      socket: data.callerID,
    });
  });

  socket.on("make-answer", (data) => {
    socket.to(data.to).emit("answer-made", {
      answer: data.answer,
      socket: socket.id,
    });
  });

  socket.on("ice-candidate", (data) => {
    socket.to(data.to).emit("ice-candidate", {
      candidate: data.candidate,
      socket: socket.id,
    });
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
    const room = rooms.find((r) => r.host === socket.id);
    if (room) {
      rooms = rooms.filter((r) => r.host !== socket.id);
      io.emit("rooms-list", rooms);
    }
  });
});

setInterval(() => {
  const now = new Date();
  rooms = rooms.filter((r) => now - r.timestamp < 10 * 60 * 1000);
  io.emit("rooms-list", rooms);
}, 60 * 1000);

server.listen(5000, () => {
  console.log("listening on *:5000");
});
