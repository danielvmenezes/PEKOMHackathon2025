const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { authenticateUser } = require('../middleware/auth.middleware');
const messageProcessor = require('../services/messageProcessor.service');
const logger = require('../utils/logger');

/**
 * @route   POST /api/messages/process
 * @desc    Process incoming message (webhook receiver)
 * @access  Public (with webhook verification)
 */
router.post('/process', async (req, res) => {
  try {
    const { organizationId, channelType, from, content, messageId, channelId } = req.body;

    if (!organizationId || !channelType || !from || !content) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: organizationId, channelType, from, content'
      });
    }

    // Process message asynchronously
    const result = await messageProcessor.processMessage({
      organizationId,
      channelType,
      from,
      content,
      messageId: messageId || `msg_${Date.now()}`,
      channelId
    });

    res.json(result);
  } catch (error) {
    logger.error(`Message process error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to process message'
    });
  }
});

/**
 * @route   GET /api/messages
 * @desc    List all messages for organization
 * @access  Private
 */
router.get('/', authenticateUser, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, intent, channel } = req.query;
    
    let query = db.collection('messages')
      .where('organizationId', '==', req.organizationId)
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit));

    // Add filters
    if (status) {
      query = query.where('processingStatus', '==', status);
    }
    if (intent) {
      query = query.where('intent', '==', intent);
    }
    if (channel) {
      query = query.where('channelType', '==', channel);
    }

    const snapshot = await query.get();
    
    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    }));

    // Get total count
    const totalSnapshot = await db.collection('messages')
      .where('organizationId', '==', req.organizationId)
      .get();

    res.json({
      success: true,
      messages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalSnapshot.size,
        pages: Math.ceil(totalSnapshot.size / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error(`Get messages error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve messages'
    });
  }
});

/**
 * @route   GET /api/messages/:id
 * @desc    Get specific message details
 * @access  Private
 */
router.get('/:id', authenticateUser, async (req, res) => {
  try {
    const messageDoc = await db.collection('messages').doc(req.params.id).get();
    
    if (!messageDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    const messageData = messageDoc.data();

    // Verify organization access
    if (messageData.organizationId !== req.organizationId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      message: {
        id: messageDoc.id,
        ...messageData,
        createdAt: messageData.createdAt?.toDate(),
        updatedAt: messageData.updatedAt?.toDate()
      }
    });
  } catch (error) {
    logger.error(`Get message error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve message'
    });
  }
});

/**
 * @route   GET /api/messages/conversations
 * @desc    Get unique conversations
 * @access  Private
 */
router.get('/conversations/list', authenticateUser, async (req, res) => {
  try {
    const messagesSnapshot = await db.collection('messages')
      .where('organizationId', '==', req.organizationId)
      .orderBy('createdAt', 'desc')
      .get();

    // Group by 'from' (customer)
    const conversationsMap = new Map();

    messagesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const from = data.from;

      if (!conversationsMap.has(from)) {
        conversationsMap.set(from, {
          customerId: from,
          customerName: data.entities?.name || 'Unknown',
          lastMessage: data.content,
          lastMessageTime: data.createdAt?.toDate(),
          channel: data.channelType,
          messageCount: 1,
          unreadCount: data.processingStatus === 'completed' ? 0 : 1
        });
      } else {
        const conv = conversationsMap.get(from);
        conv.messageCount++;
        if (data.processingStatus !== 'completed') {
          conv.unreadCount++;
        }
      }
    });

    const conversations = Array.from(conversationsMap.values());

    res.json({
      success: true,
      conversations,
      total: conversations.length
    });
  } catch (error) {
    logger.error(`Get conversations error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve conversations'
    });
  }
});

/**
 * @route   GET /api/messages/conversations/:customerId
 * @desc    Get conversation history with specific customer
 * @access  Private
 */
router.get('/conversations/:customerId', authenticateUser, async (req, res) => {
  try {
    const messagesSnapshot = await db.collection('messages')
      .where('organizationId', '==', req.organizationId)
      .where('from', '==', req.params.customerId)
      .orderBy('createdAt', 'asc')
      .get();

    const messages = messagesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate()
    }));

    res.json({
      success: true,
      customerId: req.params.customerId,
      messages,
      count: messages.length
    });
  } catch (error) {
    logger.error(`Get conversation error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve conversation'
    });
  }
});

/**
 * @route   GET /api/messages/stats
 * @desc    Get message processing statistics
 * @access  Private
 */
router.get('/stats/overview', authenticateUser, async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    
    const stats = await messageProcessor.getProcessingStats(req.organizationId, period);
    
    res.json(stats);
  } catch (error) {
    logger.error(`Get stats error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve statistics'
    });
  }
});

module.exports = router;