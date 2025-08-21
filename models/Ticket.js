const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    maxlength: 5000
  },
  category: {
    type: String,
    enum: ['billing', 'tech', 'shipping', 'other'],
    default: 'other'
  },
  status: {
    type: String,
    enum: ['open', 'triaged', 'waiting_human', 'resolved', 'closed'],
    default: 'open'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  agentSuggestionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AgentSuggestion'
  },
  attachmentUrls: [{
    type: String,
    validate: {
      validator: function(v) {
        return /^https?:\/\/.+/.test(v);
      },
      message: 'Attachment must be a valid URL'
    }
  }],
  replies: [{
    content: {
      type: String,
      required: true,
      maxlength: 5000
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    isAgentReply: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  resolvedAt: Date,
  closedAt: Date
}, {
  timestamps: true
});

// Indexes for efficient querying
ticketSchema.index({ createdBy: 1, status: 1 });
ticketSchema.index({ assignee: 1, status: 1 });
ticketSchema.index({ status: 1, createdAt: -1 });
ticketSchema.index({ category: 1, status: 1 });

module.exports = mongoose.model('Ticket', ticketSchema);
