import { puppeteerService } from './server/utils/capture.js';

async function testScreenshot() {
  console.log('🧪 Testing screenshot capture...');
  
  // Test with a known URL - replace with your actual container URL
  const testUrl = process.argv[2] || 'http://localhost:60401';
  const userId = 1;
  const subject = 'debug-test';
  
  console.log(`📸 Capturing screenshot of: ${testUrl}`);
  
  try {
    const result = await puppeteerService.captureAndSaveToMongoDB(testUrl, userId, subject, 'test');
    
    console.log('📋 Test Results:');
    console.log('- Success:', result.success);
    console.log('- Filename:', result.filename);
    console.log('- File Path:', result.filePath);
    console.log('- Container URL:', result.containerUrl);
    console.log('- Timestamp:', result.timestamp);
    console.log('- Image Size:', result.imageSize, 'KB');
    console.log('- Screen Info:', result.screenInfo);
    
    if (result.error) {
      console.log('- Error:', result.error);
    }
    
    if (result.success) {
      console.log('✅ Screenshot captured and saved to MongoDB successfully!');
      console.log('💾 Data has been saved to MongoDB Atlas');
    } else {
      console.log('❌ Screenshot capture failed');
    }
    
  } catch (error) {
    console.error('💥 Test failed with error:', error);
  } finally {
    // Clean up the Puppeteer service
    await puppeteerService.cleanup();
    process.exit(0);
  }
}

testScreenshot(); 