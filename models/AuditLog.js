const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  ticketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket',
    required: true
  },
  traceId: {
    type: String,
    required: true
  },
  actor: {
    type: String,
    enum: ['system', 'agent', 'user'],
    required: true
  },
  action: {
    type: String,
    enum: [
      'TICKET_CREATED',
      'AGENT_CLASSIFIED',
      'KB_RETRIEVED',
      'DRAFT_GENERATED',
      'AUTO_CLOSED',
      'ASSIGNED_TO_HUMAN',
      'REPLY_SENT',
      'STATUS_CHANGED',
      'TICKET_REOPENED',
      'TICKET_CLOSED'
    ],
    required: true
  },
  meta: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: { createdAt: 'timestamp', updatedAt: false }
});

// Indexes for efficient querying
auditLogSchema.index({ ticketId: 1, timestamp: -1 });
auditLogSchema.index({ traceId: 1, timestamp: -1 });
auditLogSchema.index({ actor: 1, action: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
