import ChatMessage from '../models/ChatMessage.js';
import { logger } from '../utils/logger.js';

// Get chat history between two users
export const getChatHistory = async (req, res) => {
    const startTime = Date.now();
    logger.request(req);
    
    try {
        const { userId, hrId } = req.params;
        logger.info(`Fetching chat history between user ${userId} and HR ${hrId}`);
        
        const messages = await ChatMessage.find({
            $or: [
                { sender: userId, recipient: hrId },
                { sender: hrId, recipient: userId }
            ]
        }).sort({ createdAt: 1 });
        
        logger.info(`Retrieved ${messages.length} chat messages`);
        logger.response(200, { count: messages.length }, Date.now() - startTime);
        res.status(200).json(messages);
    } catch (error) {
        logger.error("Error fetching chat history", error);
        const response = {
            message: "Error fetching chat history",
            error: error.message
        };
        logger.response(500, response, Date.now() - startTime);
        res.status(500).json(response);
    }
};

// Mark messages as read
export const markMessagesAsRead = async (req, res) => {
    const startTime = Date.now();
    logger.request(req);
    
    try {
        const { userId, senderId } = req.params;
        logger.info(`Marking messages from ${senderId} to ${userId} as read`);
        
        const result = await ChatMessage.updateMany(
            { sender: senderId, recipient: userId, read: false },
            { $set: { read: true } }
        );
        
        logger.info(`Marked ${result.nModified} messages as read`);
        logger.response(200, { count: result.nModified }, Date.now() - startTime);
        res.status(200).json({ 
            message: "Messages marked as read",
            count: result.nModified
        });
    } catch (error) {
        logger.error("Error marking messages as read", error);
        const response = {
            message: "Error marking messages as read",
            error: error.message
        };
        logger.response(500, response, Date.now() - startTime);
        res.status(500).json(response);
    }
};