const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const connectDB = require('./config/db');
const dotenv = require("dotenv");
const authRouter = require('./utils/auth');
dotenv.config(); // Load environment variables

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// CORS setup
const corsOptions = {
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
};
app.use(cors(corsOptions));

// Optional static files
app.use(express.static("public"));

// Socket.io event handling
io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("send-offer", (data) => {
    console.log("Received offer from client:", data);
    io.to(data.lawyerId).emit("receive-offer", { offer: data.offer, callerId: data.callerId });
  });

  socket.on("send-answer", (data) => {
    console.log("Received answer from lawyer:", data);
    io.to(data.callerId).emit("receive-answer", data.answer);
  });

  socket.on("send-ice-candidate", (data) => {
    console.log("Received ICE candidate from client:", data);
    io.to(data.lawyerId).emit("receive-ice-candidate", data.candidate);
  });

  socket.on("send-ice-candidate-from-lawyer", (data) => {
    console.log("Received ICE candidate from lawyer:", data);
    io.to(data.clientId).emit("receive-ice-candidate", data.candidate);
  });

  socket.on("send-decline", (data) => {
    console.log("Call declined by lawyer:", data);
    io.to(data.callerId).emit("call-declined", { message: "Call declined by lawyer" });
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });
});

// Start only after DB connection
const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Failed to connect to MongoDB:", err.message);
  });
