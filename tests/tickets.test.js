const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../index');
const User = require('../models/User');
const Ticket = require('../models/Ticket');

describe('Tickets', () => {
  let userToken, agentToken, userId, agentId;

  beforeAll(async () => {
    const url = process.env.MONGO_URI || 'mongodb+srv://shubham7silyan:SxyJ965GjqghlAS2@helpdeskcluster.lfszo5o.mongodb.net/helpdesk-test?retryWrites=true&w=majority&appName=HelpdeskCluster';
    await mongoose.connect(url);
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Ticket.deleteMany({});

    // Create test users
    const user = new User({
      name: 'Test User',
      email: 'user@example.com',
      password: 'password123',
      role: 'user'
    });
    await user.save();
    userId = user._id;

    const agent = new User({
      name: 'Test Agent',
      email: 'agent@example.com',
      password: 'password123',
      role: 'agent'
    });
    await agent.save();
    agentId = agent._id;

    // Get tokens
    const userLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'password123' });
    userToken = userLogin.body.token;

    const agentLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'agent@example.com', password: 'password123' });
    agentToken = agentLogin.body.token;
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('POST /api/tickets', () => {
    it('should create a new ticket', async () => {
      const ticketData = {
        title: 'Test ticket',
        description: 'This is a test ticket description',
        category: 'tech'
      };

      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${userToken}`)
        .send(ticketData)
        .expect(201);

      expect(response.body.message).toBe('Ticket created successfully');
      expect(response.body.ticket.title).toBe(ticketData.title);
      expect(response.body.traceId).toBeDefined();
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/tickets')
        .send({ title: 'Test', description: 'Test' })
        .expect(401);
    });

    it('should validate required fields', async () => {
      await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${userToken}`)
        .send({})
        .expect(400);
    });
  });

  describe('GET /api/tickets', () => {
    beforeEach(async () => {
      await Ticket.create({
        title: 'Test Ticket',
        description: 'Test description',
        createdBy: userId
      });
    });

    it('should get tickets for authenticated user', async () => {
      const response = await request(app)
        .get('/api/tickets')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.tickets).toHaveLength(1);
      expect(response.body.tickets[0].title).toBe('Test Ticket');
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/tickets')
        .expect(401);
    });
  });

  describe('POST /api/tickets/:id/reply', () => {
    let ticketId;

    beforeEach(async () => {
      const ticket = await Ticket.create({
        title: 'Test Ticket',
        description: 'Test description',
        createdBy: userId
      });
      ticketId = ticket._id;
    });

    it('should add reply to ticket', async () => {
      const replyData = { content: 'This is a test reply' };

      const response = await request(app)
        .post(`/api/tickets/${ticketId}/reply`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send(replyData)
        .expect(200);

      expect(response.body.message).toBe('Reply added successfully');
      expect(response.body.reply.content).toBe(replyData.content);
    });

    it('should require authentication', async () => {
      await request(app)
        .post(`/api/tickets/${ticketId}/reply`)
        .send({ content: 'Test reply' })
        .expect(401);
    });
  });
});
