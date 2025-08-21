const { v4: uuidv4 } = require('uuid');
const Ticket = require('../models/Ticket');
const Article = require('../models/Article');
const AgentSuggestion = require('../models/AgentSuggestion');
const AuditLog = require('../models/AuditLog');
const Config = require('../models/Config');
const logger = require('../utils/logger');
const { LLMProvider } = require('./llmProvider');

class AgentService {
  constructor() {
    this.llmProvider = new LLMProvider();
  }

  async processTicketTriage(ticketId, traceId) {
    const startTime = Date.now();
    
    try {
      // Get ticket
      const ticket = await Ticket.findById(ticketId).populate('createdBy');
      if (!ticket) {
        throw new Error(`Ticket ${ticketId} not found`);
      }

      // Log triage start
      await this.logAuditEvent(ticketId, traceId, 'system', 'AGENT_CLASSIFIED', {
        step: 'triage_started',
        originalCategory: ticket.category
      });

      // Step 1: Classify category
      const classification = await this.classifyTicket(ticket);
      
      await this.logAuditEvent(ticketId, traceId, 'system', 'AGENT_CLASSIFIED', {
        step: 'classification_complete',
        predictedCategory: classification.predictedCategory,
        confidence: classification.confidence
      });

      // Step 2: Retrieve relevant KB articles
      const kbResults = await this.retrieveKBArticles(ticket, classification.predictedCategory);
      
      await this.logAuditEvent(ticketId, traceId, 'system', 'KB_RETRIEVED', {
        step: 'kb_retrieval_complete',
        articlesFound: kbResults.length,
        articleIds: kbResults.map(r => r.articleId)
      });

      // Step 3: Draft reply
      const draftResult = await this.draftReply(ticket, kbResults);
      
      await this.logAuditEvent(ticketId, traceId, 'system', 'DRAFT_GENERATED', {
        step: 'draft_complete',
        draftLength: draftResult.draftReply.length,
        citationsCount: draftResult.citations.length
      });

      // Step 4: Create agent suggestion
      const suggestion = new AgentSuggestion({
        ticketId,
        traceId,
        predictedCategory: classification.predictedCategory,
        articleIds: kbResults.map(r => r.articleId),
        draftReply: draftResult.draftReply,
        confidence: classification.confidence,
        citations: draftResult.citations,
        modelInfo: {
          provider: 'stub',
          model: 'deterministic-v1',
          promptVersion: '1.0',
          latencyMs: Date.now() - startTime
        }
      });

      await suggestion.save();

      // Update ticket with suggestion reference
      ticket.agentSuggestionId = suggestion._id;
      ticket.status = 'triaged';
      await ticket.save();

      // Step 5: Make decision
      const config = await this.getConfig();
      const shouldAutoClose = config.autoCloseEnabled && 
                             classification.confidence >= config.confidenceThreshold;

      if (shouldAutoClose) {
        await this.autoCloseTicket(ticket, suggestion, traceId);
      } else {
        await this.assignToHuman(ticket, traceId);
      }

      logger.info(`Triage completed for ticket ${ticketId}, auto-closed: ${shouldAutoClose}`);

    } catch (error) {
      logger.error(`Triage failed for ticket ${ticketId}:`, error);
      
      await this.logAuditEvent(ticketId, traceId, 'system', 'AGENT_CLASSIFIED', {
        step: 'triage_failed',
        error: error.message
      });
      
      throw error;
    }
  }

  async classifyTicket(ticket) {
    const text = `${ticket.title} ${ticket.description}`.toLowerCase();
    
    // Deterministic classification based on keywords
    const categories = {
      billing: ['refund', 'invoice', 'payment', 'charge', 'bill', 'money', 'cost', 'price'],
      tech: ['error', 'bug', 'crash', 'stack', 'login', 'password', 'technical', 'api', 'server'],
      shipping: ['delivery', 'shipment', 'package', 'tracking', 'shipped', 'order', 'delayed']
    };

    let bestCategory = 'other';
    let maxScore = 0;

    for (const [category, keywords] of Object.entries(categories)) {
      const score = keywords.reduce((acc, keyword) => {
        const matches = (text.match(new RegExp(keyword, 'g')) || []).length;
        return acc + matches;
      }, 0);

      if (score > maxScore) {
        maxScore = score;
        bestCategory = category;
      }
    }

    // Calculate confidence based on keyword matches
    const confidence = Math.min(0.95, Math.max(0.3, maxScore * 0.2 + 0.3));

    return {
      predictedCategory: bestCategory,
      confidence: Number(confidence.toFixed(2))
    };
  }

  async retrieveKBArticles(ticket, category) {
    const searchText = `${ticket.title} ${ticket.description}`;
    
    // Search published articles with text search and category filtering
    const articles = await Article.find({
      status: 'published',
      $or: [
        { $text: { $search: searchText } },
        { tags: { $in: [category] } }
      ]
    })
    .select('title body tags')
    .limit(3)
    .lean();

    // Calculate relevance scores (simplified)
    return articles.map(article => ({
      articleId: article._id,
      title: article.title,
      snippet: article.body.substring(0, 200) + '...',
      score: this.calculateRelevanceScore(searchText, article),
      tags: article.tags
    })).sort((a, b) => b.score - a.score);
  }

  calculateRelevanceScore(searchText, article) {
    const searchWords = searchText.toLowerCase().split(/\s+/);
    const articleText = `${article.title} ${article.body}`.toLowerCase();
    
    let score = 0;
    searchWords.forEach(word => {
      if (word.length > 2) {
        const matches = (articleText.match(new RegExp(word, 'g')) || []).length;
        score += matches;
      }
    });

    return score;
  }

  async draftReply(ticket, kbResults) {
    const citations = kbResults.map((result, index) => 
      `[${index + 1}] ${result.title}`
    );

    let draftReply = `Thank you for contacting our support team regarding "${ticket.title}".

Based on your inquiry, I've found some relevant information that should help resolve your issue:

`;

    if (kbResults.length > 0) {
      kbResults.forEach((result, index) => {
        draftReply += `${index + 1}. **${result.title}**
   ${result.snippet}

`;
      });

      draftReply += `Please review the information above. If this resolves your issue, you can mark this ticket as resolved. If you need further assistance, our support team will be happy to help.

Best regards,
Smart Helpdesk AI Assistant`;
    } else {
      draftReply += `I wasn't able to find specific documentation for your issue, but our support team will review your ticket and provide assistance shortly.

Your ticket has been assigned to a human agent who will respond within our standard SLA timeframe.

Best regards,
Smart Helpdesk AI Assistant`;
    }

    return {
      draftReply,
      citations
    };
  }

  async autoCloseTicket(ticket, suggestion, traceId) {
    // Add agent reply
    ticket.replies.push({
      content: suggestion.draftReply,
      author: null, // System/AI reply
      isAgentReply: true
    });

    ticket.status = 'resolved';
    ticket.resolvedAt = new Date();
    suggestion.autoClosed = true;

    await Promise.all([
      ticket.save(),
      suggestion.save()
    ]);

    await this.logAuditEvent(ticket._id, traceId, 'system', 'AUTO_CLOSED', {
      confidence: suggestion.confidence,
      articlesUsed: suggestion.articleIds.length
    });
  }

  async assignToHuman(ticket, traceId) {
    ticket.status = 'waiting_human';
    await ticket.save();

    await this.logAuditEvent(ticket._id, traceId, 'system', 'ASSIGNED_TO_HUMAN', {
      reason: 'confidence_below_threshold'
    });
  }

  async getConfig() {
    let config = await Config.findOne();
    if (!config) {
      config = new Config();
      await config.save();
    }
    return config;
  }

  async logAuditEvent(ticketId, traceId, actor, action, meta = {}, userId = null) {
    try {
      const auditLog = new AuditLog({
        ticketId,
        traceId,
        actor,
        action,
        meta,
        userId
      });

      await auditLog.save();
      logger.info(`Audit logged: ${action} for ticket ${ticketId}`);
    } catch (error) {
      logger.error('Failed to log audit event:', error);
    }
  }
}

const agentService = new AgentService();

const processTicketTriage = async (ticketId, traceId) => {
  return agentService.processTicketTriage(ticketId, traceId);
};

module.exports = {
  processTicketTriage,
  agentService
};
