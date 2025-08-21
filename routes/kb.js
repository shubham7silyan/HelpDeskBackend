const express = require('express');
const Article = require('../models/Article');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { articleValidation, mongoIdValidation, searchValidation } = require('../middleware/validation');
const logger = require('../utils/logger');

const router = express.Router();

// Search KB articles (public for agents/users)
router.get('/', authenticateToken, searchValidation, async (req, res) => {
  try {
    const { query, limit = 10, offset = 0, tags } = req.query;
    
    let searchFilter = { status: 'published' };
    
    // Add text search if query provided
    if (query) {
      searchFilter.$text = { $search: query };
    }
    
    // Add tag filter if provided
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      searchFilter.tags = { $in: tagArray };
    }

    const articles = await Article.find(searchFilter)
      .select('title body tags createdAt updatedAt')
      .sort(query ? { score: { $meta: 'textScore' } } : { updatedAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();

    const total = await Article.countDocuments(searchFilter);

    res.json({
      articles,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: offset + limit < total
      }
    });
  } catch (error) {
    logger.error('KB search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get single article
router.get('/:id', authenticateToken, mongoIdValidation, async (req, res) => {
  try {
    const article = await Article.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Non-admins can only see published articles
    if (req.user.role !== 'admin' && article.status !== 'published') {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json({ article });
  } catch (error) {
    logger.error('Get article error:', error);
    res.status(500).json({ error: 'Failed to get article' });
  }
});

// Create article (admin only)
router.post('/', authenticateToken, requireAdmin, articleValidation, async (req, res) => {
  try {
    const { title, body, tags, status } = req.body;

    const article = new Article({
      title,
      body,
      tags: tags || [],
      status: status || 'draft',
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    await article.save();

    logger.info(`Article created: ${title} by ${req.user.email}`);

    res.status(201).json({
      message: 'Article created successfully',
      article
    });
  } catch (error) {
    logger.error('Create article error:', error);
    res.status(500).json({ error: 'Failed to create article' });
  }
});

// Update article (admin only)
router.put('/:id', authenticateToken, requireAdmin, mongoIdValidation, articleValidation, async (req, res) => {
  try {
    const { title, body, tags, status } = req.body;

    const article = await Article.findById(req.params.id);
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    article.title = title;
    article.body = body;
    article.tags = tags || [];
    article.status = status || article.status;
    article.updatedBy = req.user._id;

    await article.save();

    logger.info(`Article updated: ${article.title} by ${req.user.email}`);

    res.json({
      message: 'Article updated successfully',
      article
    });
  } catch (error) {
    logger.error('Update article error:', error);
    res.status(500).json({ error: 'Failed to update article' });
  }
});

// Delete article (admin only)
router.delete('/:id', authenticateToken, requireAdmin, mongoIdValidation, async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    await Article.findByIdAndDelete(req.params.id);

    logger.info(`Article deleted: ${article.title} by ${req.user.email}`);

    res.json({ message: 'Article deleted successfully' });
  } catch (error) {
    logger.error('Delete article error:', error);
    res.status(500).json({ error: 'Failed to delete article' });
  }
});

// Get all tags
router.get('/meta/tags', authenticateToken, async (req, res) => {
  try {
    const tags = await Article.distinct('tags', { status: 'published' });
    res.json({ tags: tags.sort() });
  } catch (error) {
    logger.error('Get tags error:', error);
    res.status(500).json({ error: 'Failed to get tags' });
  }
});

module.exports = router;
