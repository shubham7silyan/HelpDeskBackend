const logger = require('../utils/logger');

class LLMProvider {
  constructor() {
    this.stubMode = process.env.STUB_MODE === 'true';
    this.promptVersion = '1.0';
  }

  async classify(text) {
    if (this.stubMode) {
      return this.stubClassify(text);
    }
    
    // TODO: Implement actual LLM classification
    // For now, fallback to stub
    return this.stubClassify(text);
  }

  async draft(text, articles) {
    if (this.stubMode) {
      return this.stubDraft(text, articles);
    }
    
    // TODO: Implement actual LLM drafting
    // For now, fallback to stub
    return this.stubDraft(text, articles);
  }

  stubClassify(text) {
    const lowerText = text.toLowerCase();
    
    // Keyword-based classification
    const patterns = {
      billing: /\b(refund|invoice|payment|charge|bill|money|cost|price|subscription|cancel|billing)\b/g,
      tech: /\b(error|bug|crash|stack|login|password|technical|api|server|database|404|500|broken|not working)\b/g,
      shipping: /\b(delivery|shipment|package|tracking|shipped|order|delayed|shipping|courier|address)\b/g
    };

    let bestCategory = 'other';
    let maxMatches = 0;

    for (const [category, pattern] of Object.entries(patterns)) {
      const matches = (lowerText.match(pattern) || []).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        bestCategory = category;
      }
    }

    // Calculate confidence based on keyword density
    const wordCount = text.split(/\s+/).length;
    const confidence = maxMatches > 0 ? 
      Math.min(0.95, Math.max(0.3, (maxMatches / wordCount) * 3 + 0.4)) : 
      0.3;

    logger.info(`Classification: ${bestCategory} (confidence: ${confidence.toFixed(2)})`);

    return {
      predictedCategory: bestCategory,
      confidence: Number(confidence.toFixed(2))
    };
  }

  stubDraft(text, articles) {
    const citations = articles.map((article, index) => 
      `[${index + 1}] ${article.title}`
    );

    let draftReply = `Thank you for contacting our support team.

Based on your inquiry, I've found some relevant information that should help resolve your issue:

`;

    if (articles.length > 0) {
      articles.forEach((article, index) => {
        draftReply += `${index + 1}. **${article.title}**
   ${article.snippet}

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

    logger.info(`Draft generated with ${citations.length} citations`);

    return {
      draftReply,
      citations
    };
  }

  // Future: Real LLM implementation
  async realClassify(text) {
    const prompt = `Classify the following support ticket into one of these categories: billing, tech, shipping, other.

Ticket: "${text}"

Respond with JSON: {"predictedCategory": "category", "confidence": 0.0}`;

    // Implementation would go here for actual LLM calls
    throw new Error('Real LLM not implemented yet');
  }

  async realDraft(text, articles) {
    const articlesContext = articles.map((article, index) => 
      `[${index + 1}] ${article.title}: ${article.snippet}`
    ).join('\n');

    const prompt = `Draft a helpful support reply for this ticket using the provided knowledge base articles.

Ticket: "${text}"

Available KB Articles:
${articlesContext}

Guidelines:
- Be helpful and professional
- Reference relevant articles with [1], [2] notation
- If no articles are relevant, acknowledge and escalate to human
- Keep response under 500 words

Respond with JSON: {"draftReply": "...", "citations": ["article1", "article2"]}`;

    // Implementation would go here for actual LLM calls
    throw new Error('Real LLM not implemented yet');
  }
}

module.exports = { LLMProvider };
