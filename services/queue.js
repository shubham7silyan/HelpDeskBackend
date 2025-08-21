const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const logger = require('../utils/logger');
const { processTicketTriage } = require('./agentService');

let triageQueue;
let redis;

const initializeQueue = async () => {
  try {
    // Initialize Redis connection
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
      retryDelayOnFailover: 100
    });

    // Initialize queue
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

    logger.info('Queue and worker initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize queue:', error);
    throw error;
  }
};

const addTriageJob = async (ticketId, traceId) => {
  try {
    const job = await triageQueue.add('process-triage', {
      ticketId,
      traceId
    }, {
      delay: 1000, // Small delay to ensure ticket is saved
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
  try {
    const waiting = await triageQueue.getWaiting();
    const active = await triageQueue.getActive();
    const completed = await triageQueue.getCompleted();
    const failed = await triageQueue.getFailed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length
    };
  } catch (error) {
    logger.error('Failed to get queue stats:', error);
    return null;
  }
};

module.exports = {
  initializeQueue,
  addTriageJob,
  getQueueStats
};
