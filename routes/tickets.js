const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Ticket = require('../models/Ticket');
const AgentSuggestion = require('../models/AgentSuggestion');
const AuditLog = require('../models/AuditLog');
const { authenticateToken, requireAgent } = require('../middleware/auth');
const { ticketValidation, replyValidation, mongoIdValidation, searchValidation } = require('../middleware/validation');
const { addTriageJob } = require('../services/queue');
const { agentService } = require('../services/agentService');
const logger = require('../utils/logger');

const router = express.Router();

// Get tickets with filtering
router.get('/', authenticateToken, searchValidation, async (req, res) => {
  try {
    const { status, category, assignee, my, limit = 20, offset = 0 } = req.query;
    
    let filter = {};
    
    // Role-based filtering
    if (req.user.role === 'user') {
      filter.createdBy = req.user._id;
    } else if (my === 'true') {
      if (req.user.role === 'agent') {
        filter.assignee = req.user._id;
      } else {
        filter.createdBy = req.user._id;
      }
    }
    
    // Status filter
    if (status) {
      filter.status = { $in: Array.isArray(status) ? status : [status] };
    }
    
    // Category filter
    if (category) {
      filter.category = { $in: Array.isArray(category) ? category : [category] };
    }
    
    // Assignee filter (agents/admins only)
    if (assignee && req.user.role !== 'user') {
      filter.assignee = assignee;
    }

    const tickets = await Ticket.find(filter)
      .populate('createdBy', 'name email')
      .populate('assignee', 'name email')
      .populate('agentSuggestionId')
      .select('-replies') // Exclude replies for list view
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();

    const total = await Ticket.countDocuments(filter);

    res.json({
      tickets,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: offset + limit < total
      }
    });
  } catch (error) {
    logger.error('Get tickets error:', error);
    res.status(500).json({ error: 'Failed to get tickets' });
  }
});

// Get single ticket with full details
router.get('/:id', authenticateToken, mongoIdValidation, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate('createdBy', 'name email role')
      .populate('assignee', 'name email role')
      .populate('agentSuggestionId')
      .populate('replies.author', 'name email role');

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Access control
    if (req.user.role === 'user' && !ticket.createdBy._id.equals(req.user._id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ ticket });
  } catch (error) {
    logger.error('Get ticket error:', error);
    res.status(500).json({ error: 'Failed to get ticket' });
  }
});

// Create new ticket
router.post('/', authenticateToken, ticketValidation, async (req, res) => {
  try {
    const { title, description, category, attachmentUrls } = req.body;
    const traceId = uuidv4();

    const ticket = new Ticket({
      title,
      description,
      category: category || 'other',
      createdBy: req.user._id,
      attachmentUrls: attachmentUrls || []
    });

    await ticket.save();

    // Log ticket creation
    await agentService.logAuditEvent(
      ticket._id,
      traceId,
      'user',
      'TICKET_CREATED',
      {
        category: ticket.category,
        hasAttachments: ticket.attachmentUrls.length > 0
      },
      req.user._id
    );

    // Queue for triage
    await addTriageJob(ticket._id.toString(), traceId);

    logger.info(`Ticket created: ${ticket._id} by ${req.user.email}`);

    res.status(201).json({
      message: 'Ticket created successfully',
      ticket: {
        id: ticket._id,
        title: ticket.title,
        status: ticket.status,
        category: ticket.category,
        createdAt: ticket.createdAt
      },
      traceId
    });
  } catch (error) {
    logger.error('Create ticket error:', error);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

// Add reply to ticket
router.post('/:id/reply', authenticateToken, mongoIdValidation, replyValidation, async (req, res) => {
  try {
    const { content } = req.body;
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Access control
    if (req.user.role === 'user' && !ticket.createdBy.equals(req.user._id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Add reply
    ticket.replies.push({
      content,
      author: req.user._id,
      isAgentReply: req.user.role !== 'user'
    });

    // Update status if agent is replying
    if (req.user.role !== 'user' && ticket.status === 'waiting_human') {
      ticket.status = 'resolved';
      ticket.resolvedAt = new Date();
    }

    await ticket.save();

    // Log reply
    const traceId = uuidv4();
    await agentService.logAuditEvent(
      ticket._id,
      traceId,
      req.user.role === 'user' ? 'user' : 'agent',
      'REPLY_SENT',
      {
        replyLength: content.length,
        statusChanged: ticket.status === 'resolved'
      },
      req.user._id
    );

    logger.info(`Reply added to ticket ${ticket._id} by ${req.user.email}`);

    res.json({
      message: 'Reply added successfully',
      reply: {
        content,
        author: {
          id: req.user._id,
          name: req.user.name,
          role: req.user.role
        },
        isAgentReply: req.user.role !== 'user',
        createdAt: new Date()
      }
    });
  } catch (error) {
    logger.error('Add reply error:', error);
    res.status(500).json({ error: 'Failed to add reply' });
  }
});

// Assign ticket to agent
router.post('/:id/assign', authenticateToken, requireAgent, mongoIdValidation, async (req, res) => {
  try {
    const { assigneeId } = req.body;
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    ticket.assignee = assigneeId || req.user._id;
    if (ticket.status === 'waiting_human') {
      ticket.status = 'triaged';
    }

    await ticket.save();

    const traceId = uuidv4();
    await agentService.logAuditEvent(
      ticket._id,
      traceId,
      'agent',
      'ASSIGNED_TO_HUMAN',
      {
        assignedTo: ticket.assignee,
        assignedBy: req.user._id
      },
      req.user._id
    );

    logger.info(`Ticket ${ticket._id} assigned to ${ticket.assignee} by ${req.user.email}`);

    res.json({
      message: 'Ticket assigned successfully',
      assignee: ticket.assignee
    });
  } catch (error) {
    logger.error('Assign ticket error:', error);
    res.status(500).json({ error: 'Failed to assign ticket' });
  }
});

// Update ticket status
router.patch('/:id/status', authenticateToken, requireAgent, mongoIdValidation, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['open', 'triaged', 'waiting_human', 'resolved', 'closed'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const oldStatus = ticket.status;
    ticket.status = status;

    if (status === 'resolved' && !ticket.resolvedAt) {
      ticket.resolvedAt = new Date();
    } else if (status === 'closed') {
      ticket.closedAt = new Date();
    }

    await ticket.save();

    const traceId = uuidv4();
    await agentService.logAuditEvent(
      ticket._id,
      traceId,
      'agent',
      'STATUS_CHANGED',
      {
        oldStatus,
        newStatus: status
      },
      req.user._id
    );

    logger.info(`Ticket ${ticket._id} status changed from ${oldStatus} to ${status} by ${req.user.email}`);

    res.json({
      message: 'Status updated successfully',
      status: ticket.status
    });
  } catch (error) {
    logger.error('Update status error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Get ticket statistics (agents/admins only)
router.get('/meta/stats', authenticateToken, requireAgent, async (req, res) => {
  try {
    const stats = await Promise.all([
      Ticket.countDocuments({ status: 'open' }),
      Ticket.countDocuments({ status: 'triaged' }),
      Ticket.countDocuments({ status: 'waiting_human' }),
      Ticket.countDocuments({ status: 'resolved' }),
      Ticket.countDocuments({ status: 'closed' }),
      Ticket.countDocuments({ 
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      })
    ]);

    res.json({
      statusCounts: {
        open: stats[0],
        triaged: stats[1],
        waiting_human: stats[2],
        resolved: stats[3],
        closed: stats[4]
      },
      todayCount: stats[5]
    });
  } catch (error) {
    logger.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

module.exports = router;
