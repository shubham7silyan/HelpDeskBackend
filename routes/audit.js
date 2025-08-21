const express = require('express');
const AuditLog = require('../models/AuditLog');
const { authenticateToken, requireAgent } = require('../middleware/auth');
const { mongoIdValidation } = require('../middleware/validation');
const logger = require('../utils/logger');

const router = express.Router();

// Get audit logs for a specific ticket
router.get('/tickets/:id', authenticateToken, mongoIdValidation, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const auditLogs = await AuditLog.find({ ticketId: req.params.id })
      .populate('userId', 'name email role')
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();

    const total = await AuditLog.countDocuments({ ticketId: req.params.id });

    res.json({
      auditLogs,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: offset + limit < total
      }
    });
  } catch (error) {
    logger.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Failed to get audit logs' });
  }
});

// Get audit logs by trace ID
router.get('/trace/:traceId', authenticateToken, requireAgent, async (req, res) => {
  try {
    const auditLogs = await AuditLog.find({ traceId: req.params.traceId })
      .populate('userId', 'name email role')
      .sort({ timestamp: 1 })
      .lean();

    res.json({ auditLogs });
  } catch (error) {
    logger.error('Get trace audit logs error:', error);
    res.status(500).json({ error: 'Failed to get trace audit logs' });
  }
});

// Export audit logs (admin only)
router.get('/export', authenticateToken, requireAgent, async (req, res) => {
  try {
    const { startDate, endDate, format = 'json' } = req.query;
    
    let filter = {};
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const auditLogs = await AuditLog.find(filter)
      .populate('userId', 'name email role')
      .populate('ticketId', 'title status')
      .sort({ timestamp: -1 })
      .lean();

    if (format === 'ndjson') {
      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.ndjson"');
      
      auditLogs.forEach(log => {
        res.write(JSON.stringify(log) + '\n');
      });
      res.end();
    } else {
      res.json({ auditLogs });
    }
  } catch (error) {
    logger.error('Export audit logs error:', error);
    res.status(500).json({ error: 'Failed to export audit logs' });
  }
});

module.exports = router;
