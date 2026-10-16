import express from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import { Server as SocketIOServer } from "socket.io";
import { connectDB } from './config/db.js';
import authRouter from './utils/auth.js';
import chatRouter from './utils/chat.js';

dotenv.config();

const app = express();
const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PATCH"],
  allowedHeaders: ["Content-Type"],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/chat', chatRouter);
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.set("io", io);

// Optional static files
app.use(express.static("public"));

// Socket.io event handling
io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("join-user", ({ userId }) => {
    if (!userId) {
      return;
    }

    socket.join(userId);
    socket.data.userId = userId;
  });

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


const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(` Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error(" Failed to connect to PostgreSQL:", err.message);
  });
