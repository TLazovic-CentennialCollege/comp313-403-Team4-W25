import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import ChatMessage from '../models/ChatMessage.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Get chat history between two users
router.get('/history/:userId/:partnerId', protect, async (req, res) => {
    try {
        const { userId, partnerId } = req.params;
        
        const messages = await ChatMessage.find({
            $or: [
                { sender: userId, recipient: partnerId },
                { sender: partnerId, recipient: userId }
            ]
        }).sort({ createdAt: 1 });
        
        res.status(200).json(messages);
    } catch (error) {
        logger.error("Error fetching chat history", error);
        res.status(500).json({ 
            message: "Error fetching chat history",
            error: error.message
        });
    }
});

// Mark messages as read
router.patch('/read/:userId/:senderId', protect, async (req, res) => {
    try {
        const { userId, senderId } = req.params;
        
        const result = await ChatMessage.updateMany(
            { sender: senderId, recipient: userId, read: false },
            { $set: { read: true } }
        );
        
        res.status(200).json({ 
            message: "Messages marked as read",
            count: result.modifiedCount
        });
    } catch (error) {
        logger.error("Error marking messages as read", error);
        res.status(500).json({
            message: "Error marking messages as read",
            error: error.message
        });
    }
});

export default router;