const JamAI = require('jamaibase');
const logger = require('../utils/logger');

class JamAIService {
  constructor() {
    this.client = new JamAI({
      apiKey: process.env.JAMAI_API_KEY,
      projectId: process.env.JAMAI_PROJECT_ID || 'default'
    });

    // table names...
    this.KNOWLEDGE_TABLE = 'dalco_knowledge';
    this.ACTION_TABLE = 'dalco_actions';
    this.CHAT_TABLE = 'dalco_chat';

    logger.info('JamAI Service initialized');
  }

  // ==================== CHAT TABLE OPERATIONS ====================

  /**
   * Generate AI response using Chat Table
   */
  async generateResponse(message, language = 'en', context = {}) {
    try {
      const response = await this.client.addTableRows({
        table_type: 'chat',
        table_id: this.CHAT_TABLE,
        data: [{
          User: message,
          Context: JSON.stringify(context)
        }],
        stream: false
      });

      return {
        success: true,
        response: response.rows[0]?.AI || 'No response generated',
        language: language,
        metadata: response
      };
    } catch (error) {
      logger.error(`JamAI generate response error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Translate text between BM and EN
   */
  async translateText(text, sourceLang, targetLang) {
    try {
      const prompt = `Translate this ${sourceLang === 'bm' ? 'Bahasa Malaysia' : 'English'} text to ${targetLang === 'bm' ? 'Bahasa Malaysia' : 'English'}: ${text}`;
      
      const response = await this.generateResponse(prompt, targetLang);
      
      return {
        success: true,
        originalText: text,
        translatedText: response.response,
        sourceLang,
        targetLang
      };
    } catch (error) {
      logger.error(`Translation error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract entities from message (name, phone, email, date, time)
   */
  async extractEntities(text) {
    try {
      const prompt = `Extract the following entities from this message and return as JSON: name, phone, email, date, time, service_type, intent. Message: "${text}"`;
      
      const response = await this.generateResponse(prompt);
      
      // Try to parse JSON from response
      let entities = {};
      try {
        const jsonMatch = response.response.match(/\{.*\}/s);
        if (jsonMatch) {
          entities = JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        logger.warn('Could not parse entities as JSON, using raw response');
        entities = { raw: response.response };
      }

      return {
        success: true,
        entities: entities,
        originalText: text
      };
    } catch (error) {
      logger.error(`Entity extraction error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Classify message intent
   */
  async classifyIntent(text) {
    try {
      const prompt = `Classify the intent of this message into one of: booking, inquiry, complaint, feedback, general. Message: "${text}". Return only the classification.`;
      
      const response = await this.generateResponse(prompt);
      
      const intent = response.response.toLowerCase().trim();
      const validIntents = ['booking', 'inquiry', 'complaint', 'feedback', 'general'];
      
      return {
        success: true,
        intent: validIntents.includes(intent) ? intent : 'general',
        confidence: 0.85,
        rawResponse: response.response
      };
    } catch (error) {
      logger.error(`Intent classification error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Detect language (BM or EN)
   */
  detectLanguage(text) {
    // Simple language detection based on common words
    const bmKeywords = ['saya', 'nak', 'untuk', 'dengan', 'boleh', 'ada', 'tak', 'tidak'];
    const lowerText = text.toLowerCase();
    
    const bmCount = bmKeywords.filter(word => lowerText.includes(word)).length;
    
    return {
      language: bmCount >= 2 ? 'bm' : 'en',
      confidence: bmCount >= 2 ? 0.8 : 0.6
    };
  }

  // ==================== KNOWLEDGE TABLE OPERATIONS ====================

  /**
   * Create or get Knowledge Table
   */
  async initializeKnowledgeTable() {
    try {
      // Try to get existing table
      const tables = await this.client.listTables({ table_type: 'knowledge' });
      const exists = tables.items?.some(t => t.id === this.KNOWLEDGE_TABLE);

      if (!exists) {
        // Create new knowledge table
        await this.client.createTable({
          table_type: 'knowledge',
          id: this.KNOWLEDGE_TABLE,
          cols: [
            {
              id: 'Title',
              dtype: 'str',
              index: true
            },
            {
              id: 'Content',
              dtype: 'str',
              index: true
            },
            {
              id: 'Category',
              dtype: 'str'
            },
            {
              id: 'Language',
              dtype: 'str'
            }
          ]
        });
        logger.info('Knowledge table created');
      }

      return { success: true, exists: !exists };
    } catch (error) {
      logger.error(`Knowledge table initialization error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add document to Knowledge Base
   */
  async addKnowledge(title, content, category = 'general', language = 'en') {
    try {
      const response = await this.client.addTableRows({
        table_type: 'knowledge',
        table_id: this.KNOWLEDGE_TABLE,
        data: [{
          Title: title,
          Content: content,
          Category: category,
          Language: language
        }]
      });

      return {
        success: true,
        id: response.rows[0]?.ID,
        title: title
      };
    } catch (error) {
      logger.error(`Add knowledge error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Search Knowledge Base using RAG
   */
  async searchKnowledge(query, language = 'en', limit = 5) {
    try {
      // Create a temporary chat to search knowledge
      const searchPrompt = `Search the knowledge base for: "${query}". Return relevant information.`;
      
      const response = await this.client.addTableRows({
        table_type: 'chat',
        table_id: this.CHAT_TABLE,
        data: [{
          User: searchPrompt
        }],
        stream: false,
        reindex: true // Enable RAG search
      });

      return {
        success: true,
        results: response.rows[0]?.AI || 'No results found',
        query: query,
        language: language
      };
    } catch (error) {
      logger.error(`Knowledge search error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Upload FAQ in bulk
   */
  async uploadFAQs(faqs) {
    try {
      const data = faqs.map(faq => ({
        Title: faq.question,
        Content: faq.answer,
        Category: 'FAQ',
        Language: faq.language || 'en'
      }));

      const response = await this.client.addTableRows({
        table_type: 'knowledge',
        table_id: this.KNOWLEDGE_TABLE,
        data: data
      });

      return {
        success: true,
        count: faqs.length,
        ids: response.rows.map(r => r.ID)
      };
    } catch (error) {
      logger.error(`FAQ upload error: ${error.message}`);
      throw error;
    }
  }

  // ==================== ACTION TABLE OPERATIONS ====================

  /**
   * Initialize Action Table for multi-step workflows
   */
  async initializeActionTable() {
    try {
      const tables = await this.client.listTables({ table_type: 'action' });
      const exists = tables.items?.some(t => t.id === this.ACTION_TABLE);

      if (!exists) {
        await this.client.createTable({
          table_type: 'action',
          id: this.ACTION_TABLE,
          cols: [
            {
              id: 'Input',
              dtype: 'str'
            },
            {
              id: 'Step1_Understand',
              dtype: 'str',
              gen_config: {
                model: 'openai/gpt-4',
                prompt: 'Analyze and understand this customer message: ${Input}'
              }
            },
            {
              id: 'Step2_Fetch',
              dtype: 'str',
              gen_config: {
                model: 'openai/gpt-4',
                prompt: 'Based on the understanding: ${Step1_Understand}, fetch relevant information from knowledge base'
              }
            },
            {
              id: 'Step3_Draft',
              dtype: 'str',
              gen_config: {
                model: 'openai/gpt-4',
                prompt: 'Draft a response based on: ${Step2_Fetch}'
              }
            },
            {
              id: 'Step4_Refine',
              dtype: 'str',
              gen_config: {
                model: 'openai/gpt-4',
                prompt: 'Refine and finalize this response: ${Step3_Draft}'
              }
            }
          ]
        });
        logger.info('Action table created');
      }

      return { success: true, exists: !exists };
    } catch (error) {
      logger.error(`Action table initialization error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute action chain: Understand → Fetch → Draft → Refine
   */
  async executeActionChain(message, messageType = 'general') {
    try {
      const response = await this.client.addTableRows({
        table_type: 'action',
        table_id: this.ACTION_TABLE,
        data: [{
          Input: message
        }],
        stream: false
      });

      const result = response.rows[0];

      return {
        success: true,
        executionId: result?.ID,
        steps: {
          understand: result?.Step1_Understand,
          fetch: result?.Step2_Fetch,
          draft: result?.Step3_Draft,
          refine: result?.Step4_Refine
        },
        finalResponse: result?.Step4_Refine
      };
    } catch (error) {
      logger.error(`Action chain execution error: ${error.message}`);
      throw error;
    }
  }

  // ==================== INITIALIZATION ====================

  /**
   * Initialize all tables
   */
  async initializeAllTables() {
    try {
      logger.info('Initializing JamAI tables...');

      // Create Chat Table
      try {
        await this.client.createTable({
          table_type: 'chat',
          id: this.CHAT_TABLE,
          cols: [
            {
              id: 'User',
              dtype: 'str'
            },
            {
              id: 'Context',
              dtype: 'str'
            },
            {
              id: 'AI',
              dtype: 'str',
              gen_config: {
                model: 'openai/gpt-4',
                system_prompt: 'You are DalCo, an AI assistant helping Malaysian SMEs. You can speak both English and Bahasa Malaysia. Be helpful, concise, and professional.',
                prompt: '${User}\n\nContext: ${Context}'
              }
            }
          ]
        });
        logger.info('Chat table created');
      } catch (error) {
        if (error.message?.includes('already exists')) {
          logger.info('Chat table already exists');
        } else {
          throw error;
        }
      }

      await this.initializeKnowledgeTable();
      await this.initializeActionTable();

      logger.info('✅ All JamAI tables initialized');
      return { success: true };
    } catch (error) {
      logger.error(`Table initialization error: ${error.message}`);
      throw error;
    }
  }
}

// Export singleton instance
const jamaiService = new JamAIService();
module.exports = jamaiService;