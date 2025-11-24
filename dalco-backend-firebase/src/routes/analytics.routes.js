const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { authenticateUser } = require('../middleware/auth.middleware');
const logger = require('../utils/logger');

/**
 * @route   GET /api/analytics/overview
 * @desc    Get dashboard overview statistics
 * @access  Private
 */
router.get('/overview', authenticateUser, async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    
    // Calculate date range
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

    // Get messages
    const messagesSnapshot = await db.collection('messages')
      .where('organizationId', '==', req.organizationId)
      .where('createdAt', '>=', startDate)
      .get();

    // Get leads
    const leadsSnapshot = await db.collection('leads')
      .where('organizationId', '==', req.organizationId)
      .where('createdAt', '>=', startDate)
      .get();

    const totalMessages = messagesSnapshot.size;
    const totalLeads = leadsSnapshot.size;

    // Calculate time saved (16 hours manual vs 30 min AI)
    const manualTimePerMessage = 15; // minutes
    const aiTimePerMessage = 0.5; // minutes
    const timeSavedMinutes = totalMessages * (manualTimePerMessage - aiTimePerMessage);
    const timeSavedHours = (timeSavedMinutes / 60).toFixed(1);

    // Calculate accuracy improvement
    const manualErrorRate = 0.04; // 4%
    const aiErrorRate = 0.00001; // 0.001%
    const accuracyImprovement = ((1 - aiErrorRate) / (1 - manualErrorRate) * 100 - 100).toFixed(2);

    // Calculate conversion rate
    const convertedLeads = leadsSnapshot.docs.filter(
      doc => doc.data().status === 'converted'
    ).length;
    const conversionRate = totalLeads > 0 
      ? ((convertedLeads / totalLeads) * 100).toFixed(1) 
      : 0;

    // Estimate potential revenue (RM 50 per converted lead as example)
    const avgRevenuePerLead = 50;
    const potentialRevenue = convertedLeads * avgRevenuePerLead;

    res.json({
      success: true,
      period,
      overview: {
        timeSavedHours: parseFloat(timeSavedHours),
        accuracyRate: 99.999,
        totalMessages,
        totalLeads,
        convertedLeads,
        conversionRate: parseFloat(conversionRate),
        potentialRevenue,
        messagesByChannel: {
          whatsapp: messagesSnapshot.docs.filter(d => d.data().channelType === 'whatsapp').length,
          instagram: messagesSnapshot.docs.filter(d => d.data().channelType === 'instagram').length,
          email: messagesSnapshot.docs.filter(d => d.data().channelType === 'email').length
        },
        messagesByIntent: {
          booking: messagesSnapshot.docs.filter(d => d.data().intent === 'booking').length,
          inquiry: messagesSnapshot.docs.filter(d => d.data().intent === 'inquiry').length,
          complaint: messagesSnapshot.docs.filter(d => d.data().intent === 'complaint').length,
          general: messagesSnapshot.docs.filter(d => d.data().intent === 'general').length
        }
      }
    });
  } catch (error) {
    logger.error(`Analytics overview error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve analytics'
    });
  }
});

module.exports = router;