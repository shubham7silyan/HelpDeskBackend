const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
  autoCloseEnabled: {
    type: Boolean,
    default: true
  },
  confidenceThreshold: {
    type: Number,
    default: 0.78,
    min: 0,
    max: 1
  },
  slaHours: {
    type: Number,
    default: 24,
    min: 1
  },
  maxTicketsPerUser: {
    type: Number,
    default: 10
  },
  emailNotificationsEnabled: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Config', configSchema);
