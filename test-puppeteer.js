import { puppeteerService } from './server/utils/capture.js';

async function testPuppeteerService() {
  console.log('🔧 Testing Puppeteer Service...');
  
  try {
    // Test system screen detection
    console.log('📏 Getting system screen size...');
    const screenSize = await puppeteerService.getSystemScreenSize();
    console.log('✅ Screen size detected:', screenSize);
    
    // Test browser initialization
    console.log('🚀 Initializing browser...');
    const browser = await puppeteerService.initBrowser();
    console.log('✅ Browser initialized successfully');
    
    // Test cleanup
    console.log('🧹 Testing cleanup...');
    await puppeteerService.cleanup();
    console.log('✅ Cleanup completed successfully');
    
    console.log('🎉 All Puppeteer service tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

testPuppeteerService(); 