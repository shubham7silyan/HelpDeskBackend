const axios = require('axios');

async function createMissingUsers() {
  const baseURL = 'http://localhost:8080/api';
  
  try {
    // Create agent user
    console.log('Creating agent user...');
    try {
      const agentResponse = await axios.post(`${baseURL}/auth/register`, {
        name: 'Support Agent',
        email: 'agent@helpdesk.com',
        password: 'password123',
        role: 'agent'
      });
      console.log('✅ Agent user created successfully');
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.error?.includes('already exists')) {
        console.log('ℹ️  Agent user already exists');
      } else {
        console.log('❌ Failed to create agent:', error.response?.data?.error || error.message);
      }
    }

    // Create customer user
    console.log('Creating customer user...');
    try {
      const customerResponse = await axios.post(`${baseURL}/auth/register`, {
        name: 'John Customer',
        email: 'customer@example.com',
        password: 'password123',
        role: 'user'
      });
      console.log('✅ Customer user created successfully');
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.error?.includes('already exists')) {
        console.log('ℹ️  Customer user already exists');
      } else {
        console.log('❌ Failed to create customer:', error.response?.data?.error || error.message);
      }
    }

    // Test all logins
    console.log('\n--- Testing Logins ---');
    
    const testCredentials = [
      { email: 'admin@helpdesk.com', password: 'password123', role: 'admin' },
      { email: 'agent@helpdesk.com', password: 'password123', role: 'agent' },
      { email: 'customer@example.com', password: 'password123', role: 'user' }
    ];

    for (const cred of testCredentials) {
      try {
        const loginResponse = await axios.post(`${baseURL}/auth/login`, {
          email: cred.email,
          password: cred.password
        });
        console.log(`✅ ${cred.role} login successful: ${cred.email}`);
      } catch (error) {
        console.log(`❌ ${cred.role} login failed: ${cred.email} - ${error.response?.data?.error || error.message}`);
      }
    }

  } catch (error) {
    console.error('Script error:', error.message);
  }
}

createMissingUsers();
