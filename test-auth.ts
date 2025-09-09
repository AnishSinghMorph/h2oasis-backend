// Test file for authentication endpoints
const BASE_URL = 'http://localhost:3000';

// Test data
const testUser = {
  firstName: 'John',
  lastName: 'Doe',
  email: `test-${Date.now()}@example.com`, // Unique email each time
  password: 'testpassword123'
};

async function testHealthCheck() {
  console.log('🏥 Testing Health Check...');
  try {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Health check passed');
      console.log('📊 Status:', data.status);
      console.log('🔗 Database:', data.services.database);
      return true;
    } else {
      console.log('❌ Health check failed');
      return false;
    }
  } catch (error: any) {
    console.log('❌ Health check error:', error.message);
    return false;
  }
}

async function testUserRegistration() {
  console.log('\n👤 Testing User Registration...');
  console.log('📧 Test Email:', testUser.email);
  
  try {
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testUser),
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ User registration successful!');
      console.log('👤 User ID:', data.user.id);
      console.log('📧 Email:', data.user.email);
      console.log('👥 Full Name:', `${data.user.firstName} ${data.user.lastName}`);
      console.log('🏷️ Display Name:', data.user.displayName);
      return data.user;
    } else {
      console.log('❌ Registration failed');
      console.log('📝 Error:', data.message);
      return null;
    }
  } catch (error: any) {
    console.log('❌ Registration error:', error.message);
    return null;
  }
}

async function testDuplicateRegistration() {
  console.log('\n🔄 Testing Duplicate Registration...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testUser), // Same email as before
    });

    const data = await response.json();
    
    if (response.status === 409) {
      console.log('✅ Duplicate registration properly rejected');
      console.log('📝 Message:', data.message);
      return true;
    } else {
      console.log('❌ Duplicate registration should have been rejected');
      return false;
    }
  } catch (error: any) {
    console.log('❌ Duplicate registration test error:', error.message);
    return false;
  }
}

async function testInvalidData() {
  console.log('\n🚫 Testing Invalid Data...');
  
  const invalidTests = [
    {
      name: 'Missing firstName',
      data: { lastName: 'Doe', email: 'test@example.com', password: 'password123' }
    },
    {
      name: 'Missing email',
      data: { firstName: 'John', lastName: 'Doe', password: 'password123' }
    },
    {
      name: 'Short password',
      data: { firstName: 'John', lastName: 'Doe', email: 'test2@example.com', password: '123' }
    }
  ];

  let allPassed = true;

  for (const test of invalidTests) {
    try {
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(test.data),
      });

      if (response.status === 400) {
        console.log(`✅ ${test.name}: Properly rejected`);
      } else {
        console.log(`❌ ${test.name}: Should have been rejected (status: ${response.status})`);
        allPassed = false;
      }
    } catch (error: any) {
      console.log(`❌ ${test.name}: Test error:`, error.message);
      allPassed = false;
    }
  }

  return allPassed;
}

async function testDatabaseConnection() {
  console.log('\n🗄️ Testing Database Connection...');
  
  try {
    const response = await fetch(`${BASE_URL}/test/database`);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Database test passed');
      console.log('📝 Message:', data.message);
      return true;
    } else {
      console.log('❌ Database test failed');
      console.log('📝 Error:', data.message);
      return false;
    }
  } catch (error: any) {
    console.log('❌ Database test error:', error.message);
    return false;
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Authentication API Tests...\n');
  
  const results = {
    healthCheck: false,
    database: false,
    registration: false,
    duplicateHandling: false,
    validation: false
  };

  // Test 1: Health Check
  results.healthCheck = await testHealthCheck();
  
  // Test 2: Database Connection
  results.database = await testDatabaseConnection();
  
  // Test 3: User Registration
  const user = await testUserRegistration();
  results.registration = !!user;
  
  // Test 4: Duplicate Registration
  if (results.registration) {
    results.duplicateHandling = await testDuplicateRegistration();
  }
  
  // Test 5: Invalid Data Handling
  results.validation = await testInvalidData();

  // Summary
  console.log('\n📊 TEST SUMMARY:');
  console.log('================');
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
  });

  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(Boolean).length;
  
  console.log(`\n🏆 Overall: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Your API is ready for frontend integration!');
  } else {
    console.log('⚠️ Some tests failed. Please check the errors above.');
  }
}

// Handle execution
(async () => {
  try {
    await runAllTests();
  } catch (error: any) {
    console.error('Test runner error:', error.message);
    process.exit(1);
  }
})();
