require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function createUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://shubham7silyan:SxyJ965GjqghlAS2@helpdeskcluster.lfszo5o.mongodb.net/?retryWrites=true&w=majority&appName=HelpdeskCluster');
    console.log('Connected to MongoDB');

    // Check existing users
    const existingUsers = await User.find({});
    console.log('Existing users:', existingUsers.map(u => `${u.email} (${u.role})`));

    // Create agent if doesn't exist
    const existingAgent = await User.findOne({ email: 'agent@helpdesk.com' });
    if (!existingAgent) {
      const agent = new User({
        name: 'Support Agent',
        email: 'agent@helpdesk.com',
        password: 'password123',
        role: 'agent'
      });
      await agent.save();
      console.log('Agent user created');
    } else {
      console.log('Agent user already exists');
    }

    // Create customer if doesn't exist
    const existingCustomer = await User.findOne({ email: 'customer@example.com' });
    if (!existingCustomer) {
      const customer = new User({
        name: 'John Customer',
        email: 'customer@example.com',
        password: 'password123',
        role: 'user'
      });
      await customer.save();
      console.log('Customer user created');
    } else {
      console.log('Customer user already exists');
    }

    // Verify all users
    const allUsers = await User.find({});
    console.log('\nAll users in database:');
    allUsers.forEach(user => {
      console.log(`- ${user.email} (${user.role}) - Active: ${user.isActive}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

createUsers();
