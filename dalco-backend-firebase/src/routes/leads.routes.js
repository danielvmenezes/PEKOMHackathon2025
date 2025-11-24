const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { authenticateUser } = require('../middleware/auth.middleware');
const logger = require('../utils/logger');

// GET /api/leads - List all leads
router.get('/', authenticateUser, async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    
    let query = db.collection('leads')
      .where('organizationId', '==', req.organizationId)
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit));

    if (status) {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.get();
    const leads = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate()
    }));

    res.json({ success: true, leads, count: leads.length });
  } catch (error) {
    logger.error(`Get leads error: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to retrieve leads' });
  }
});

// GET /api/leads/:id - Get single lead
router.get('/:id', authenticateUser, async (req, res) => {
  try {
    const leadDoc = await db.collection('leads').doc(req.params.id).get();
    
    if (!leadDoc.exists) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    const lead = { id: leadDoc.id, ...leadDoc.data() };
    
    if (lead.organizationId !== req.organizationId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    res.json({ success: true, lead });
  } catch (error) {
    logger.error(`Get lead error: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to retrieve lead' });
  }
});

// POST /api/leads - Create lead manually
router.post('/', authenticateUser, async (req, res) => {
  try {
    const { customerName, phone, email, serviceType, notes } = req.body;

    const leadData = {
      organizationId: req.organizationId,
      customerName: customerName || 'Unknown',
      phone: phone || null,
      email: email || null,
      serviceType: serviceType || null,
      status: 'new',
      score: 50,
      notes: notes || '',
      createdBy: req.userId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const leadRef = await db.collection('leads').add(leadData);

    res.status(201).json({
      success: true,
      lead: { id: leadRef.id, ...leadData },
      message: 'Lead created successfully'
    });
  } catch (error) {
    logger.error(`Create lead error: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to create lead' });
  }
});

// PUT /api/leads/:id/status - Update lead status
router.put('/:id/status', authenticateUser, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['new', 'contacted', 'qualified', 'converted', 'lost'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    await db.collection('leads').doc(req.params.id).update({
      status,
      updatedAt: new Date(),
      updatedBy: req.userId
    });

    res.json({ success: true, message: 'Status updated successfully' });
  } catch (error) {
    logger.error(`Update lead status error: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to update status' });
  }
});

module.exports = router;