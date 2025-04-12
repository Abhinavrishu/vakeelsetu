const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");  // Importing the cors module

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Allow cross-origin requests from your frontend
const corsOptions = {
  origin: "http://localhost:5173",  // Adjust this URL to your frontend's URL
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
};

app.use(cors(corsOptions));  // Use CORS middleware with your options

// Serve static files (optional, for serving client-side assets)
app.use(express.static("public"));

io.on("connection", (socket) => {
  console.log("A user connected");

  // Handle incoming offer from client
  socket.on("send-offer", (data) => {
    console.log("Received offer from client:", data);
    io.to(data.lawyerId).emit("receive-offer", { offer: data.offer, callerId: data.callerId });
  });

  // Handle incoming answer from lawyer
  socket.on("send-answer", (data) => {
    console.log("Received answer from lawyer:", data);
    io.to(data.callerId).emit("receive-answer", data.answer);
  });

  // Handle ICE candidate from client
  socket.on("send-ice-candidate", (data) => {
    console.log("Received ICE candidate from client:", data);
    io.to(data.lawyerId).emit("receive-ice-candidate", data.candidate);
  });

  // Handle ICE candidate from lawyer
  socket.on("send-ice-candidate-from-lawyer", (data) => {
    console.log("Received ICE candidate from lawyer:", data);
    io.to(data.clientId).emit("receive-ice-candidate", data.candidate);
  });

  // Handle call decline from lawyer
  socket.on("send-decline", (data) => {
    console.log("Call declined by lawyer:", data);
    io.to(data.callerId).emit("call-declined", { message: "Call declined by lawyer" });
  });

  // Handle user disconnect
  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });
});

// Start the server
const port = process.env.PORT || 5000;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
