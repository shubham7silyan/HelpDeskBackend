require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function resetAgentPassword() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://shubham7silyan:SxyJ965GjqghlAS2@helpdeskcluster.lfszo5o.mongodb.net/?retryWrites=true&w=majority&appName=HelpdeskCluster');
    
    const agent = await User.findOne({ email: 'agent@helpdesk.com' });
    
    if (agent) {
      agent.password = 'password123';
      agent.isActive = true;
      await agent.save();
      console.log('✅ Agent password reset to: password123');
      console.log('✅ Agent account activated');
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

resetAgentPassword();
