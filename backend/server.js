import express from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { Server as SocketIOServer } from "socket.io";
import { connectDB } from './config/db.js';
import authRouter from './utils/auth.js';
import chatRouter from './utils/chat.js';
import lawyersRouter from './utils/lawyers.js';

dotenv.config();

const app = express();
const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PATCH", "PUT"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
// Attachments are encrypted in the browser and stored as ciphertext envelopes.
// The limit includes base64 expansion, so it safely supports the 5 MB UI limit.
app.use(express.json({ limit: "8mb" }));
app.use('/api/auth', authRouter);
app.use('/api/chat', chatRouter);
app.use('/api/lawyers', lawyersRouter);
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
io.use((socket, next) => {
  try {
    const decoded = jwt.verify(socket.handshake.auth?.token, process.env.JWT_ACCESS_SECRET);
    if (decoded.type !== "access") throw new Error("Invalid token type");
    socket.data.userId = decoded.id;
    next();
  } catch {
    next(new Error("Unauthorized socket connection"));
  }
});

io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("join-user", ({ userId }) => {
    if (!userId || userId !== socket.data.userId) {
      return;
    }

    socket.join(socket.data.userId);
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
