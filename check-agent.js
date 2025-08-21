require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function checkAgent() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/helpdesk');
    console.log('Connected to MongoDB');

    const agent = await User.findOne({ email: 'agent@helpdesk.com' });
    
    if (agent) {
      console.log('✅ Agent account found:');
      console.log(`   Name: ${agent.name}`);
      console.log(`   Email: ${agent.email}`);
      console.log(`   Role: ${agent.role}`);
      console.log(`   Active: ${agent.isActive}`);
      console.log(`   Created: ${agent.createdAt}`);
      
      // Test password comparison
      const isPasswordValid = await agent.comparePassword('password123');
      console.log(`   Password valid: ${isPasswordValid}`);
      
      if (!agent.isActive) {
        console.log('❌ Account is INACTIVE - this is the problem!');
        // Activate the account
        agent.isActive = true;
        await agent.save();
        console.log('✅ Account activated successfully');
      }
    } else {
      console.log('❌ Agent account not found');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

checkAgent();
