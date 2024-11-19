const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

// CORS setup for Express routes
app.use(cors({
  origin: 'http://localhost:5173',  // Allow requests from your frontend
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// CORS setup for Socket.IO
const io = new socketIo.Server(server, {
  cors: {
    origin: "http://localhost:5173",  // Allow requests from your frontend
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  },
});

// Room tracking for users
const usersInRoom = {}; // Keeps track of users in a room

// Serve static files (for frontend, e.g., React build)
app.use(express.static("build"));

io.on("connection", (socket) => {
  console.log("New user connected");

  // Handle user joining a room
  socket.on("join-room", (roomID, username) => {
    if (!usersInRoom[roomID]) {
      usersInRoom[roomID] = [];
    }
    usersInRoom[roomID].push({ socketId: socket.id, username });
    socket.join(roomID);
    console.log(`${username} joined room: ${roomID}`);

    // Notify others in the room
    socket.to(roomID).emit("chat-message", {
      username: "System",
      text: `${username} has joined the room.`,
    });
  });

  // Handle user creating a new room
  socket.on("create-room", (roomID, username) => {
    if (!usersInRoom[roomID]) {
      usersInRoom[roomID] = [];
    }
    usersInRoom[roomID].push({ socketId: socket.id, username });
    socket.join(roomID);
    console.log(`${username} created and joined room: ${roomID}`);

    // Notify the new user and others in the room
    socket.emit("chat-message", {
      username: "System",
      text: `You have created and joined room: ${roomID}`,
    });
  });

  // Handle sending an offer to another user
  socket.on("offer", (offer, roomID) => {
    socket.to(roomID).emit("offer", offer);
  });

  // Handle receiving an answer from a user
  socket.on("answer", (answer, roomID) => {
    socket.to(roomID).emit("answer", answer);
  });

  // Handle sending ICE candidates
  socket.on("ice-candidate", (candidate, roomID) => {
    socket.to(roomID).emit("ice-candidate", candidate);
  });

  // Handle chat messages
  socket.on("chat-message", (message, roomID) => {
    // Broadcast the message to all users in the room
    io.to(roomID).emit("chat-message", message);
  });

  // Handle user leaving a room
  socket.on("leave-room", (roomID) => {
    // Remove the user from the room and notify others
    const userIndex = usersInRoom[roomID].findIndex(
      (user) => user.socketId === socket.id
    );
    if (userIndex !== -1) {
      const user = usersInRoom[roomID].splice(userIndex, 1)[0];
      console.log(`${user.username} left the room: ${roomID}`);
      socket.to(roomID).emit("chat-message", {
        username: "System",
        text: `${user.username} has left the room.`,
      });
    }
    socket.leave(roomID);
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log("User disconnected");
    // Find and remove user from any rooms they were part of
    for (const roomID in usersInRoom) {
      const userIndex = usersInRoom[roomID].findIndex(
        (user) => user.socketId === socket.id
      );
      if (userIndex !== -1) {
        const user = usersInRoom[roomID].splice(userIndex, 1)[0];
        console.log(`${user.username} disconnected`);
        io.to(roomID).emit("chat-message", {
          username: "System",
          text: `${user.username} has disconnected.`,
        });
        break;
      }
    }
  });
});

// Start the server
const port = process.env.PORT || 5000;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
