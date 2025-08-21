require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Article = require('../models/Article');
const Ticket = require('../models/Ticket');
const Config = require('../models/Config');
const logger = require('../utils/logger');

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/helpdesk');
    logger.info('Connected to MongoDB for seeding');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Article.deleteMany({}),
      Ticket.deleteMany({}),
      Config.deleteMany({})
    ]);

    // Create users
    const users = await User.create([
      {
        name: 'Admin User',
        email: 'admin@helpdesk.com',
        password: 'password123',
        role: 'admin'
      },
      {
        name: 'Support Agent',
        email: 'agent@helpdesk.com',
        password: 'password123',
        role: 'agent'
      },
      {
        name: 'John Customer',
        email: 'customer@example.com',
        password: 'password123',
        role: 'user'
      }
    ]);

    logger.info('Users created');

    // Create KB articles
    const articles = await Article.create([
      {
        title: 'How to update payment method',
        body: `To update your payment method:

1. Log into your account dashboard
2. Navigate to Billing > Payment Methods
3. Click "Add New Payment Method"
4. Enter your new card details
5. Set as default if desired
6. Remove old payment method if needed

If you encounter any issues, please contact our billing support team.`,
        tags: ['billing', 'payments', 'account'],
        status: 'published',
        createdBy: users[0]._id,
        updatedBy: users[0]._id
      },
      {
        title: 'Troubleshooting 500 errors',
        body: `If you're experiencing 500 server errors:

1. Check if the issue is widespread by visiting our status page
2. Clear your browser cache and cookies
3. Try accessing the site in incognito/private mode
4. Disable browser extensions temporarily
5. Try a different browser or device

If the problem persists:
- Note the exact error message and time
- Include your browser version and operating system
- Provide steps to reproduce the issue

Our technical team will investigate and resolve the issue promptly.`,
        tags: ['tech', 'errors', 'troubleshooting'],
        status: 'published',
        createdBy: users[0]._id,
        updatedBy: users[0]._id
      },
      {
        title: 'Tracking your shipment',
        body: `To track your order shipment:

1. Check your email for shipping confirmation with tracking number
2. Visit our Order Tracking page
3. Enter your order number or tracking number
4. View real-time shipping updates

Shipping timeframes:
- Standard shipping: 5-7 business days
- Express shipping: 2-3 business days
- Overnight shipping: 1 business day

If your package is delayed or missing:
- Contact the shipping carrier directly
- File a claim if package is lost or damaged
- Contact our shipping support for assistance`,
        tags: ['shipping', 'delivery', 'tracking'],
        status: 'published',
        createdBy: users[0]._id,
        updatedBy: users[0]._id
      },
      {
        title: 'Account security best practices',
        body: `Keep your account secure by following these guidelines:

1. Use a strong, unique password
2. Enable two-factor authentication
3. Don't share your login credentials
4. Log out from shared computers
5. Monitor your account for suspicious activity
6. Update your password regularly

If you suspect unauthorized access:
- Change your password immediately
- Review recent account activity
- Contact our security team
- Consider enabling additional security features`,
        tags: ['security', 'account', 'password'],
        status: 'published',
        createdBy: users[0]._id,
        updatedBy: users[0]._id
      }
    ]);

    logger.info('Articles created');

    // Create sample tickets
    const tickets = await Ticket.create([
      {
        title: 'Refund for double charge',
        description: 'I was charged twice for order #1234. The first charge was on Dec 1st for $99.99 and the second charge was on Dec 2nd for the same amount. I only placed one order. Please refund the duplicate charge.',
        category: 'other',
        createdBy: users[2]._id
      },
      {
        title: 'App shows 500 error on login',
        description: 'When I try to log into my account, I get a 500 internal server error. This started happening yesterday. I tried clearing my cache and using different browsers but the issue persists. Stack trace mentions auth module.',
        category: 'other',
        createdBy: users[2]._id
      },
      {
        title: 'Where is my package?',
        description: 'I ordered a product 5 days ago and it was supposed to arrive today, but I haven\'t received it yet. The tracking shows it was shipped but no updates since then. Order number is #5678.',
        category: 'other',
        createdBy: users[2]._id
      }
    ]);

    logger.info('Tickets created');

    // Create default config
    await Config.create({
      autoCloseEnabled: true,
      confidenceThreshold: 0.78,
      slaHours: 24,
      maxTicketsPerUser: 10,
      emailNotificationsEnabled: false
    });

    logger.info('Configuration created');

    logger.info('Seed data created successfully!');
    logger.info('Login credentials:');
    logger.info('Admin: admin@helpdesk.com / password123');
    logger.info('Agent: agent@helpdesk.com / password123');
    logger.info('Customer: customer@example.com / password123');

  } catch (error) {
    logger.error('Seeding failed:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

seedData();
