const express = require('express');
const AgentSuggestion = require('../models/AgentSuggestion');
const { authenticateToken, requireAgent } = require('../middleware/auth');
const { mongoIdValidation } = require('../middleware/validation');
const { addTriageJob, getQueueStats } = require('../services/queue');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Trigger manual triage (internal/admin use)
router.post('/triage', authenticateToken, requireAgent, async (req, res) => {
  try {
    const { ticketId } = req.body;
    
    if (!ticketId) {
      return res.status(400).json({ error: 'ticketId is required' });
    }

    const traceId = uuidv4();
    const job = await addTriageJob(ticketId, traceId);

    logger.info(`Manual triage triggered for ticket ${ticketId} by ${req.user.email}`);

    res.json({
      message: 'Triage job queued successfully',
      jobId: job.id,
      traceId
    });
  } catch (error) {
    logger.error('Manual triage error:', error);
    res.status(500).json({ error: 'Failed to trigger triage' });
  }
});

// Get agent suggestion for a ticket
router.get('/suggestion/:ticketId', authenticateToken, requireAgent, mongoIdValidation, async (req, res) => {
  try {
    const suggestion = await AgentSuggestion.findOne({ ticketId: req.params.ticketId })
      .populate('articleIds', 'title tags')
      .lean();

    if (!suggestion) {
      return res.status(404).json({ error: 'No agent suggestion found for this ticket' });
    }

    res.json({ suggestion });
  } catch (error) {
    logger.error('Get suggestion error:', error);
    res.status(500).json({ error: 'Failed to get agent suggestion' });
  }
});

// Get queue statistics (admin only)
router.get('/queue/stats', authenticateToken, requireAgent, async (req, res) => {
  try {
    const stats = await getQueueStats();
    
    if (!stats) {
      return res.status(500).json({ error: 'Failed to get queue statistics' });
    }

    res.json({ queueStats: stats });
  } catch (error) {
    logger.error('Get queue stats error:', error);
    res.status(500).json({ error: 'Failed to get queue statistics' });
  }
});

// Update agent suggestion (for agent review/editing)
router.put('/suggestion/:id', authenticateToken, requireAgent, mongoIdValidation, async (req, res) => {
  try {
    const { draftReply } = req.body;
    
    if (!draftReply || draftReply.trim().length === 0) {
      return res.status(400).json({ error: 'draftReply is required' });
    }

    const suggestion = await AgentSuggestion.findById(req.params.id);
    if (!suggestion) {
      return res.status(404).json({ error: 'Agent suggestion not found' });
    }

    suggestion.draftReply = draftReply.trim();
    await suggestion.save();

    logger.info(`Agent suggestion ${suggestion._id} updated by ${req.user.email}`);

    res.json({
      message: 'Agent suggestion updated successfully',
      suggestion
    });
  } catch (error) {
    logger.error('Update suggestion error:', error);
    res.status(500).json({ error: 'Failed to update suggestion' });
  }
});

module.exports = router;
