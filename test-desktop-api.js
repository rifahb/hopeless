// Test desktop capture API endpoint
async function testDesktopCaptureAPI() {
  console.log('🖥️ Testing desktop capture API endpoint...');
  
  try {
    // First, login to get authentication
    const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'student@test.com',
        password: 'password123'
      })
    });
    
    if (!loginResponse.ok) {
      throw new Error('Login failed');
    }
    
    const loginData = await loginResponse.json();
    console.log('✅ Login successful');
    
    // Extract token from response
    const token = loginData.token;
    
    // Now test desktop capture
    console.log('🖥️ Testing desktop capture endpoint...');
    
    const captureResponse = await fetch('http://localhost:5000/api/capture-desktop', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        subject: 'test-desktop'
      })
    });
    
    const captureData = await captureResponse.json();
    
    console.log('📋 Desktop Capture API Response:');
    console.log('- Success:', captureData.success);
    console.log('- Message:', captureData.message);
    
    if (captureData.success) {
      console.log('- Filename:', captureData.filename);
      console.log('- Image Size:', captureData.imageSize, 'KB');
      console.log('- Capture Type:', captureData.captureType);
      console.log('✅ Desktop capture API test successful!');
    } else {
      console.log('- Error:', captureData.error);
      console.log('❌ Desktop capture API test failed');
    }
    
  } catch (error) {
    console.error('💥 API test failed with error:', error.message);
    
    // If server is not running, suggest starting it
    if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
      console.log('💡 Make sure the server is running: npm start');
    }
  }
}

testDesktopCaptureAPI(); 