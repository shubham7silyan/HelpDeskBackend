const express = require('express');
const Config = require('../models/Config');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { configValidation } = require('../middleware/validation');
const logger = require('../utils/logger');

const router = express.Router();

// Get configuration
router.get('/', authenticateToken, async (req, res) => {
  try {
    let config = await Config.findOne();
    
    if (!config) {
      config = new Config();
      await config.save();
    }

    res.json({ config });
  } catch (error) {
    logger.error('Get config error:', error);
    res.status(500).json({ error: 'Failed to get configuration' });
  }
});

// Update configuration (admin only)
router.put('/', authenticateToken, requireAdmin, configValidation, async (req, res) => {
  try {
    const updates = req.body;
    
    let config = await Config.findOne();
    if (!config) {
      config = new Config();
    }

    // Update only provided fields
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        config[key] = updates[key];
      }
    });

    await config.save();

    logger.info(`Configuration updated by ${req.user.email}:`, updates);

    res.json({
      message: 'Configuration updated successfully',
      config
    });
  } catch (error) {
    logger.error('Update config error:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

module.exports = router;
