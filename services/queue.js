const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const logger = require('../utils/logger');
const { processTicketTriage } = require('./agentService');

let triageQueue;
let redis;
let queueEnabled = false;

const initializeQueue = async () => {
  try {
    // Skip Redis initialization if no URL provided or in production without Redis
    if (!process.env.REDIS_URL || process.env.REDIS_URL.includes('red-d2jqmse3jp1c73fequjg')) {
      logger.warn('Redis URL not available or invalid, running without queue functionality');
      queueEnabled = false;
      return;
    }

    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      connectTimeout: 5000,
      lazyConnect: true
    });

    // Test connection
    await redis.ping();

    redis.on("connect", () => {
      logger.info("✅ Connected to Redis");
      queueEnabled = true;
    });

    redis.on("error", (err) => {
      logger.error("❌ Redis error:", err);
      queueEnabled = false;
    });

    // Initialize queue only if Redis is connected
    triageQueue = new Queue('ticket-triage', {
      connection: redis,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    });

    // Initialize worker
    const worker = new Worker('ticket-triage', async (job) => {
      const { ticketId, traceId } = job.data;
      logger.info(`Processing triage for ticket ${ticketId} with trace ${traceId}`);
      
      try {
        await processTicketTriage(ticketId, traceId);
        logger.info(`Triage completed for ticket ${ticketId}`);
      } catch (error) {
        logger.error(`Triage failed for ticket ${ticketId}:`, error);
        throw error;
      }
    }, {
      connection: redis,
      concurrency: 5
    });

    worker.on('completed', (job) => {
      logger.info(`Triage job ${job.id} completed for ticket ${job.data.ticketId}`);
    });

    worker.on('failed', (job, err) => {
      logger.error(`Triage job ${job.id} failed for ticket ${job.data.ticketId}:`, err);
    });

    queueEnabled = true;
    logger.info('Queue and worker initialized successfully');
  } catch (error) {
    logger.warn('Failed to initialize queue, continuing without queue functionality:', error.message);
    queueEnabled = false;
    // Don't throw error - allow server to start without Redis
  }
};

const addTriageJob = async (ticketId, traceId) => {
  if (!queueEnabled || !triageQueue) {
    logger.info(`Queue not available, processing triage synchronously for ticket ${ticketId}`);
    try {
      await processTicketTriage(ticketId, traceId);
      return { id: `sync-${ticketId}-${Date.now()}` };
    } catch (error) {
      logger.error(`Synchronous triage failed for ticket ${ticketId}:`, error);
      throw error;
    }
  }

  try {
    const job = await triageQueue.add('process-triage', {
      ticketId,
      traceId
    }, {
      delay: 1000,
      jobId: `triage-${ticketId}-${Date.now()}`
    });

    logger.info(`Triage job ${job.id} added for ticket ${ticketId}`);
    return job;
  } catch (error) {
    logger.error(`Failed to add triage job for ticket ${ticketId}:`, error);
    throw error;
  }
};

const getQueueStats = async () => {
  if (!queueEnabled || !triageQueue) {
    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      enabled: false
    };
  }

  try {
    const waiting = await triageQueue.getWaiting();
    const active = await triageQueue.getActive();
    const completed = await triageQueue.getCompleted();
    const failed = await triageQueue.getFailed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      enabled: true
    };
  } catch (error) {
    logger.error('Failed to get queue stats:', error);
    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      enabled: false
    };
  }
};

module.exports = {
  initializeQueue,
  addTriageJob,
  getQueueStats
};
