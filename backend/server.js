import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "dotenv";
import ticketRoutes from "./routes/ticketRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import { logger } from "./utils/logger.js";
import { createServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import User from "./models/User.js";
import ChatMessage from './models/ChatMessage.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve frontend static files
const frontendPath = path.join(__dirname, 'public');


// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3000;
const httpServer = createServer(app);

app.use(express.static(frontendPath));

// Socket.IO setup
const io = new Server(httpServer, {
  cors: {
    origin: true,
    credentials: true
  }
});

// Middleware
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(cookieParser());

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

// Connect to MongoDB
mongoose
  .connect(process.env.DB_URI)
  .then(() => {
    logger.info("MongoDB connected successfully");
  })
  .catch((err) => {
    logger.error("MongoDB connection error", err);
  });

// Use routes
app.use("/api/tickets", ticketRoutes);
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);

// Socket authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error("Authentication error"));
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    socket.userRole = decoded.role;
    next();
  } catch (error) {
    logger.error("Socket authentication error", error);
    next(new Error("Authentication error"));
  }
});

// Active users map
const activeUsers = new Map();

// Socket.IO connection
io.on("connection", (socket) => {
  logger.info(`User connected: ${socket.userId}, Role: ${socket.userRole}`);
  
  // Add user to active users
  activeUsers.set(socket.userId, {
    socketId: socket.id,
    role: socket.userRole
  });
  
  // Broadcast active users
  broadcastActiveUsers();
  
  // Handle private messages
  socket.on("private_message", async (data) => {
    try {
      const { recipient, message } = data;
      logger.info(`Message from ${socket.userId} to ${recipient}: ${message}`);
      
      // Save message to database
      const chatMessage = new ChatMessage({
         sender: socket.userId,
         recipient,
         message,
       });
       await chatMessage.save();
      
      // Add sender info for frontend display
      const sender = await User.findById(socket.userId);
      
      const messageData = {
        _id: new mongoose.Types.ObjectId().toString(),
        sender: socket.userId,
        recipient,
        message,
        read: false,
        createdAt: new Date(),
        senderName: sender.name,
        senderRole: sender.role
      };
      
      // Send to recipient if online
      const recipientData = activeUsers.get(recipient);
      if (recipientData) {
        io.to(recipientData.socketId).emit("private_message", messageData);
      }
      
      // Send confirmation back to sender
      socket.emit("message_sent", { 
        id: messageData._id, 
        timestamp: messageData.createdAt 
      });
      
    } catch (error) {
      logger.error("Error handling private message", error);
      socket.emit("error", { message: "Failed to send message" });
    }
  });
  
  // Handle typing indicator
  socket.on("typing", (data) => {
    const { recipient, isTyping } = data;
    
    const recipientData = activeUsers.get(recipient);
    if (recipientData) {
      io.to(recipientData.socketId).emit("typing", {
        sender: socket.userId,
        isTyping
      });
    }
  });
  
  // Handle disconnect
  socket.on("disconnect", () => {
    logger.info(`User disconnected: ${socket.userId}`);
    activeUsers.delete(socket.userId);
    broadcastActiveUsers();
  });
});

// Function to broadcast active users
async function broadcastActiveUsers() {
	try {
	  // Arrays to hold active users
	  const activeHrUsers = [];
	  const activeEmployeeUsers = [];
	  
	  // Get all active users in parallel
	  const userPromises = Array.from(activeUsers.entries()).map(async ([userId, userData]) => {
		try {
		  const user = await User.findById(userId);
		  if (!user) return null;
		  
		  const userInfo = {
			id: user._id.toString(),
			name: user.name,
			department: user.department || 'General'
		  };
		  
		  return { userInfo, role: user.role };
		} catch (error) {
		  logger.error(`Error fetching user ${userId}`, error);
		  return null;
		}
	  });
	  
	  // Wait for all user lookups to complete
	  const resolvedUsers = await Promise.all(userPromises);
	  
	  // Sort users into appropriate arrays
	  resolvedUsers.forEach(result => {
		if (!result) return;
		
		if (result.role === 'HR') {
		  activeHrUsers.push(result.userInfo);
		} else if (result.role === 'Employee') {
		  activeEmployeeUsers.push(result.userInfo);
		}
	  });
	  
	  // Send to appropriate clients
	  activeUsers.forEach((userData, userId) => {
		if (userData.role === 'Employee') {
		  io.to(userData.socketId).emit("active_hr_users", activeHrUsers);
		} else if (userData.role === 'HR') {
		  io.to(userData.socketId).emit("active_employee_users", activeEmployeeUsers);
		}
	  });
	  
	  logger.info(`Broadcasting ${activeHrUsers.length} HR users and ${activeEmployeeUsers.length} Employee users`);
	} catch (error) {
	  logger.error("Error broadcasting active users:", error);
	}
  }

// Basic route for testing
app.get("/", (req, res) => {
  logger.info("Base route accessed");
  res.send("HR Ticketing System API is running");
});




app.get('*', (req, res, next) => {
  // If the request is for a file, skip
  if (req.path.includes('.') || req.path.startsWith('/api/')) {
    return next();
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});





// Error handling middleware
app.use((err, req, res, next) => {
  logger.error("Unhandled error", err);
  res.status(500).json({
    message: "Internal server error",
    error:
      process.env.NODE_ENV === "production" ? "An error occurred" : err.message,
  });
});

httpServer.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});