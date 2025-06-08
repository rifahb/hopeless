import { puppeteerService } from './server/utils/capture.ts';

async function testDesktopCapture() {
  console.log('🖥️ Testing desktop capture functionality...');
  
  try {
    // Test desktop capture
    console.log('🖥️ Testing desktop screen capture...');
    const desktopResult = await puppeteerService.captureDesktopAndSaveToMongoDB(
      999, // Test user ID
      'test-desktop',
      'test'
    );
    
    console.log('📋 Desktop Capture Results:');
    console.log('- Success:', desktopResult.success);
    console.log('- Filename:', desktopResult.filename);
    console.log('- Capture Type:', desktopResult.captureType);
    console.log('- Screen Info:', desktopResult.screenInfo);
    console.log('- Image Size:', desktopResult.imageSize, 'KB');
    
    if (desktopResult.error) {
      console.log('- Error:', desktopResult.error);
    }
    
    if (desktopResult.success) {
      console.log('✅ Desktop capture successful!');
      console.log('💾 Screenshot saved to MongoDB Atlas');
    } else {
      console.log('❌ Desktop capture failed');
    }
    
  } catch (error) {
    console.error('💥 Test failed with error:', error);
  } finally {
    // Clean up the Puppeteer service
    await puppeteerService.cleanup();
    process.exit(0);
  }
}

testDesktopCapture(); 