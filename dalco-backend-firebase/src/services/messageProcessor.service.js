const { db } = require('../config/firebase');
const jamaiService = require('./jamai.service');
const sheetsService = require('./sheets.service');
const logger = require('../utils/logger');

class MessageProcessorService {
  /**
   * Process incoming message through complete pipeline
   */
  async processMessage(messageData) {
    try {
      const {
        organizationId,
        channelType,
        from,
        content,
        messageId
      } = messageData;

      logger.info(`Processing message from ${from} via ${channelType}`);

      // Step 1: Detect language
      const langDetection = jamaiService.detectLanguage(content);
      
      // Step 2: Classify intent
      const intentResult = await jamaiService.classifyIntent(content);
      
      // Step 3: Extract entities
      const entityResult = await jamaiService.extractEntities(content);

      // Step 4: Save message to Firestore
      const messageRef = await db.collection('messages').add({
        organizationId,
        channelType,
        channelId: messageData.channelId || null,
        direction: 'inbound',
        from,
        content,
        externalMessageId: messageId,
        language: langDetection.language,
        intent: intentResult.intent,
        entities: entityResult.entities,
        processingStatus: 'processing',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Step 5: Execute action chain for complex responses
      let aiResponse = null;
      if (['booking', 'inquiry'].includes(intentResult.intent)) {
        const actionResult = await jamaiService.executeActionChain(content, intentResult.intent);
        aiResponse = actionResult.finalResponse;
      } else {
        // Simple response for other intents
        const responseResult = await jamaiService.generateResponse(
          content,
          langDetection.language,
          { intent: intentResult.intent }
        );
        aiResponse = responseResult.response;
      }

      // Step 6: Create lead if applicable
      let leadId = null;
      if (intentResult.intent === 'booking' || intentResult.intent === 'inquiry') {
        leadId = await this.createLeadFromMessage(
          organizationId,
          messageRef.id,
          entityResult.entities,
          from
        );
      }

      // Step 7: Write to Google Sheets if configured
      try {
        await sheetsService.writeMessageToSheet(organizationId, {
          timestamp: new Date(),
          from,
          channel: channelType,
          message: content,
          intent: intentResult.intent,
          entities: entityResult.entities,
          response: aiResponse
        });
      } catch (sheetError) {
        logger.warn(`Google Sheets write failed: ${sheetError.message}`);
      }

      // Step 8: Update message status
      await messageRef.update({
        processingStatus: 'completed',
        aiResponse,
        leadId,
        processedAt: new Date(),
        updatedAt: new Date()
      });

      return {
        success: true,
        messageId: messageRef.id,
        language: langDetection.language,
        intent: intentResult.intent,
        entities: entityResult.entities,
        response: aiResponse,
        leadId
      };
    } catch (error) {
      logger.error(`Message processing error: ${error.message}`);
      
      // Update message status to failed
      if (messageData.messageId) {
        try {
          await db.collection('messages').doc(messageData.messageId).update({
            processingStatus: 'failed',
            error: error.message,
            updatedAt: new Date()
          });
        } catch (updateError) {
          logger.error(`Failed to update message status: ${updateError.message}`);
        }
      }

      throw error;
    }
  }

  /**
   * Create lead from extracted entities
   */
  async createLeadFromMessage(organizationId, messageId, entities, phone) {
    try {
      const leadData = {
        organizationId,
        sourceMessageId: messageId,
        customerName: entities.name || 'Unknown',
        phone: entities.phone || phone,
        email: entities.email || null,
        serviceType: entities.service_type || null,
        preferredDate: entities.date || null,
        preferredTime: entities.time || null,
        status: 'new',
        score: this.calculateLeadScore(entities),
        notes: `Auto-created from message. Intent: ${entities.intent || 'unknown'}`,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const leadRef = await db.collection('leads').add(leadData);
      logger.info(`Lead created: ${leadRef.id}`);

      return leadRef.id;
    } catch (error) {
      logger.error(`Lead creation error: ${error.message}`);
      return null;
    }
  }

  /**
   * Calculate lead score based on completeness of information
   */
  calculateLeadScore(entities) {
    let score = 50; // Base score

    if (entities.name) score += 10;
    if (entities.phone) score += 15;
    if (entities.email) score += 15;
    if (entities.date) score += 10;
    if (entities.time) score += 10;
    if (entities.service_type) score += 10;

    return Math.min(score, 100);
  }

  /**
   * Batch process multiple messages
   */
  async batchProcessMessages(messages) {
    const results = [];
    
    for (const message of messages) {
      try {
        const result = await this.processMessage(message);
        results.push({ success: true, ...result });
      } catch (error) {
        results.push({ 
          success: false, 
          error: error.message,
          messageId: message.messageId 
        });
      }
    }

    return {
      success: true,
      total: messages.length,
      processed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }

  /**
   * Get message processing statistics
   */
  async getProcessingStats(organizationId, period = 'week') {
    try {
      const now = new Date();
      const startDate = new Date();

      switch (period) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        default:
          startDate.setDate(now.getDate() - 7);
      }

      const messagesSnapshot = await db.collection('messages')
        .where('organizationId', '==', organizationId)
        .where('createdAt', '>=', startDate)
        .get();

      const messages = messagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const stats = {
        total: messages.length,
        byStatus: {},
        byIntent: {},
        byLanguage: {},
        byChannel: {},
        averageProcessingTime: 0
      };

      messages.forEach(msg => {
        // Count by status
        stats.byStatus[msg.processingStatus] = (stats.byStatus[msg.processingStatus] || 0) + 1;
        
        // Count by intent
        if (msg.intent) {
          stats.byIntent[msg.intent] = (stats.byIntent[msg.intent] || 0) + 1;
        }
        
        // Count by language
        if (msg.language) {
          stats.byLanguage[msg.language] = (stats.byLanguage[msg.language] || 0) + 1;
        }
        
        // Count by channel
        stats.byChannel[msg.channelType] = (stats.byChannel[msg.channelType] || 0) + 1;
      });

      return {
        success: true,
        period,
        stats
      };
    } catch (error) {
      logger.error(`Stats calculation error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new MessageProcessorService();