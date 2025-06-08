import puppeteer, { Browser, Page } from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { mongoService } from '../mongodb.js';

// Extend Window interface for desktop capture
declare global {
  interface Window {
    capturedImageData: string | null;
    captureError: string | null;
  }
}

export interface ScreenshotResult {
  success: boolean;
  filePath?: string;
  filename?: string;
  timestamp?: string;
  containerUrl?: string;
  userId?: number;
  subject?: string;
  error?: string;
  imageSize?: number;
  screenInfo?: {
    width: number;
    height: number;
    actualSystemScreen: boolean;
  };
  captureType?: 'browser' | 'desktop';
}

export interface ScreenshotData {
  userId: number;
  type: 'screenshot';
  image: string;
  metadata: {
    timestamp: string;
    captureMethod: 'puppeteer-server-side';
    containerUrl: string;
    subject: string;
    filename: string;
    captureEvent: 'submission' | 'manual' | 'admin-bulk';
    screenResolution: { width: number; height: number };
    fileSize: number;
    isCodespaceCapture: boolean;
    captureQuality: string;
    captureType: 'browser' | 'desktop';
  };
}

class PuppeteerScreenshotService {
  private browser: Browser | null = null;
  private systemScreenSize: { width: number; height: number } | null = null;

  async getSystemScreenSize(): Promise<{ width: number; height: number }> {
    if (this.systemScreenSize) {
      return this.systemScreenSize;
    }

    try {
      console.log('🖥️ Detecting system screen resolution...');
      const tempBrowser = await puppeteer.launch({
        headless: false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage'
        ]
      });
      const tempPage = await tempBrowser.newPage();
      const screenInfo = await tempPage.evaluate(() => {
        return {
          width: screen.width,
          height: screen.height,
          availWidth: screen.availWidth,
          availHeight: screen.availHeight,
          devicePixelRatio: window.devicePixelRatio
        };
      });
      await tempBrowser.close();
      this.systemScreenSize = {
        width: screenInfo.width,
        height: screenInfo.height
      };
      console.log(`🖥️ System screen detected: ${this.systemScreenSize.width}x${this.systemScreenSize.height}`);
      return this.systemScreenSize;
    } catch (error) {
      console.error('⚠️ Failed to detect system screen, using default 1920x1080:', error);
      this.systemScreenSize = { width: 1920, height: 1080 };
      return this.systemScreenSize;
    }
  }

  async initBrowser(): Promise<Browser> {
    if (!this.browser) {
      console.log('🚀 Initializing Puppeteer browser...');
      const screenSize = await this.getSystemScreenSize();
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          `--window-size=${screenSize.width},${screenSize.height}`,
          '--start-maximized',
          '--start-fullscreen',
          '--disable-web-security',
          '--allow-running-insecure-content',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--force-device-scale-factor=1',
          '--kiosk'
        ]
      });
      console.log('✅ Puppeteer browser initialized successfully');
    }
    return this.browser;
  }

  async captureDesktopScreen(
    userId: number,
    subject: string = 'desktop',
    captureEvent: string = 'manual'
  ): Promise<ScreenshotResult> {
    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
      const screenSize = await this.getSystemScreenSize();
      browser = await puppeteer.launch({
        headless: false,
        timeout: 30000,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--allow-running-insecure-content',
          `--window-size=${screenSize.width},${screenSize.height}`,
          '--start-maximized'
        ]
      });

      page = await browser.newPage();
      await page.setViewport({
        width: screenSize.width,
        height: screenSize.height
      });

      const desktopCaptureHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Desktop Screen Capture</title>
          <style>
            body { margin: 0; padding: 20px; font-family: Arial, sans-serif; background: #f0f0f0; }
            .container { max-width: 800px; margin: 0 auto; text-align: center; }
            #video { width: 100%; max-width: 640px; height: auto; background: #000; border-radius: 8px; }
            button { 
              padding: 12px 24px; margin: 10px; font-size: 16px; 
              background: #007bff; color: white; border: none; border-radius: 6px; 
              cursor: pointer; font-weight: bold;
            }
            button:hover { background: #0056b3; }
            #status { 
              margin-top: 15px; padding: 10px; 
              background: #e8f5e8; border: 1px solid #4caf50; 
              border-radius: 6px; color: #2e7d32; font-weight: bold; 
            }
            .error { background: #ffebee !important; border-color: #f44336 !important; color: #c62828 !important; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🖥️ Desktop Screen Capture</h1>
            <video id="video" autoplay muted playsinline></video>
            <br>
            <button onclick="startCapture()">🚀 Start Desktop Capture</button>
            <div id="status">Ready to capture desktop screen...</div>
            <canvas id="canvas" style="display: none;"></canvas>
          </div>
          <script>
            let stream = null;
            const video = document.getElementById('video');
            const canvas = document.getElementById('canvas');
            const ctx = canvas.getContext('2d');
            const status = document.getElementById('status');
            function updateStatus(message, isError = false) {
              status.textContent = message;
              status.className = isError ? 'error' : '';
              console.log('Status:', message);
            }
            async function startCapture() {
              try {
                updateStatus('🔄 Requesting desktop capture...');
                stream = await navigator.mediaDevices.getDisplayMedia({
                  video: true,
                  audio: false
                });
                updateStatus('✅ Permission granted! Initializing video stream...');
                video.srcObject = stream;
                video.onloadedmetadata = () => {
                  updateStatus('📹 Video stream ready! Taking screenshot...');
                  setTimeout(takeScreenshot, 2000);
                };
                video.onerror = (error) => {
                  updateStatus('❌ Video error: ' + error, true);
                  window.captureError = 'Video stream error';
                };
                await video.play();
              } catch (error) {
                console.error('Error starting capture:', error);
                updateStatus('❌ Capture failed: ' + error.message, true);
                window.captureError = error.message;
              }
            }
            function takeScreenshot() {
              try {
                if (!video.videoWidth || !video.videoHeight) {
                  updateStatus('⚠️ Video not ready, retrying in 1 second...');
                  setTimeout(takeScreenshot, 1000);
                  return;
                }
                updateStatus('📸 Capturing screenshot...');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const imageData = canvas.toDataURL('image/jpeg', 0.9);
                if (imageData && imageData.length > 1000) {
                  window.capturedImageData = imageData;
                  updateStatus('✅ Screenshot captured successfully! (' + canvas.width + 'x' + canvas.height + ')');
                  window.captureReady = true;
                  if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                  }
                } else {
                  throw new Error('Invalid image data generated');
                }
              } catch (error) {
                console.error('Error taking screenshot:', error);
                updateStatus('❌ Screenshot failed: ' + error.message, true);
                window.captureError = error.message;
              }
            }
            window.addEventListener('load', () => {
              setTimeout(() => {
                const button = document.querySelector('button');
                if (button) {
                  const clickEvent = new MouseEvent('click', {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                    clientX: 100,
                    clientY: 100
                  });
                  button.dispatchEvent(clickEvent);
                  setTimeout(startCapture, 1000);
                }
              }, 500);
            });
          </script>
        </body>
        </html>
      `;

      await page.setContent(desktopCaptureHtml, { waitUntil: 'domcontentloaded' });
      await new Promise(resolve => setTimeout(resolve, 3000));

      let imageData = null;
      let attempts = 8;
      while (attempts > 0 && !imageData) {
        const result = await page.evaluate(() => {
          return {
            imageData: (window as any).capturedImageData,
            error: (window as any).captureError,
            status: document.querySelector('#status')?.textContent
          };
        });
        if (result.error) throw new Error(`Desktop capture failed: ${result.error}`);
        if (result.imageData && result.imageData.length > 1000) {
          imageData = result.imageData;
          break;
        }
        if (attempts <= 5) {
          await page.click('button').catch(() => {});
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        attempts--;
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      if (!imageData) throw new Error('Desktop capture timed out - could not capture screen data');

      const screenshotsDir = path.join(process.cwd(), 'screenshots');
      if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `desktop-user-${userId}-${subject}-${captureEvent}-${timestamp}.jpg`;
      const filePath = path.join(screenshotsDir, filename);
      const base64Data = imageData.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(filePath, buffer);
      const imageSize = Math.round(buffer.length / 1024);

      return {
        success: true,
        filePath,
        filename,
        timestamp: new Date().toISOString(),
        containerUrl: 'desktop-capture',
        userId,
        subject,
        imageSize,
        screenInfo: {
          width: screenSize.width,
          height: screenSize.height,
          actualSystemScreen: true
        },
        captureType: 'desktop'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        containerUrl: 'desktop-capture',
        userId,
        subject,
        captureType: 'desktop'
      };
    } finally {
      try {
        if (page) await page.close();
        if (browser) await browser.close();
      } catch {}
    }
  }

  async captureScreenshot(
    containerUrl: string, 
    userId: number, 
    subject: string = 'code',
    captureEvent: string = 'manual'
  ): Promise<ScreenshotResult> {
    let page: Page | null = null;
    try {
      console.log(`📸 Starting Puppeteer capture for user ${userId}: ${containerUrl}`);
      const browser = await this.initBrowser();
      const screenSize = await this.getSystemScreenSize();
      page = await browser.newPage();
      await page.setViewport({ 
        width: screenSize.width, 
        height: screenSize.height,
        deviceScaleFactor: 1
      });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      console.log(`📸 Navigating to ${containerUrl}...`);
      await page.goto(containerUrl, { waitUntil: 'networkidle2', timeout: 45000 });

     // ...existing code...

      // Print all frame URLs for debugging
      console.log('All frame URLs:');
      for (const frame of page.frames()) {
        console.log(frame.url());
      }

      const frameContext = page;

      // --- Workspace Trust Popup Handler ---
      // Wait for any button to appear (trust popup may take a while)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Log all visible buttons for debugging
      const allButtons = await page.$$eval('button', btns => btns.map(b => ({
        text: b.textContent,
        aria: b.getAttribute('aria-label')
      })));
      console.log('All visible buttons:', allButtons);

      let clicked = false;
      try {
        await page.waitForSelector('button', { timeout: 20000 });

        clicked = await page.evaluate(() => {
          // 1. Try aria-label
          let btn = document.querySelector('button[aria-label*="trust"][aria-label*="authors"]');
          // 2. Try text content
          if (!btn) {
            btn = Array.from(document.querySelectorAll('button')).find(button =>
              button.textContent?.toLowerCase().includes('trust the authors')
            );
          }
          // 3. Try XPath in browser context
          if (!btn) {
            const xpath = "//button[contains(translate(text(),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'trust the authors')]";
            const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            btn = result.singleNodeValue as HTMLElement | null;
          }
          // 4. Try shadow DOMs
          if (!btn) {
            const allButtons = Array.from(document.querySelectorAll('button'));
            for (const button of allButtons) {
              if ((button as any).shadowRoot) {
                const shadowBtn = Array.from((button as any).shadowRoot.querySelectorAll('button')).find(b =>
                  b.textContent?.toLowerCase().includes('trust the authors')
                );
                if (shadowBtn) {
                  btn = shadowBtn as HTMLElement;
                  break;
                }
              }
            }
          }
          if (btn && btn instanceof HTMLElement) {
            btn.click();
            return true;
          }
          return false;
        });

        // Try clicking by visible text using Puppeteer if not found
        if (!clicked) {
          const buttons = await page.$$('button');
          for (const btn of buttons) {
            const text = await btn.evaluate(b => b.textContent?.toLowerCase() || '');
            if (text.includes('trust the authors')) {
              await btn.click();
              clicked = true;
              break;
            }
          }
        }

        if (clicked) {
          console.log('✅ Workspace trust accepted');
         await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          await page.screenshot({ path: 'debug-trust-popup.jpeg', fullPage: true });
          console.log('❌ Could not find trust button. Screenshot saved as debug-trust-popup.jpeg');
        }
      } catch (e) {
        console.error('⚠️ Error handling workspace trust:', (e as Error).message);
      }

      // ...rest of your code (workspace setup, screenshot, etc.)...
      // Wait for initial load
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Handle code-server authentication if needed
      try {
        const passwordInput = await frameContext.$('input[type="password"]');
        if (passwordInput) {
          console.log('🔐 Detected code-server login, authenticating...');
          await passwordInput.type('cs1234');
          await frameContext.keyboard.press('Enter');
          await new Promise(resolve => setTimeout(resolve, 5000));
          await frameContext.waitForSelector([
            '.monaco-editor',
            '.monaco-workbench', 
            '.vs-dark',
            '.vs-light',
            '[data-keybinding="workbench"]'
          ].join(', '), { timeout: 15000 });
          console.log('✅ Code editor interface loaded');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      } catch (loginError) {
        console.log('ℹ️ No authentication required or already authenticated');
      }

      // Enhanced workspace setup and welcome screen dismissal
      try {
        console.log('🔧 Setting up VS Code workspace for capture...');
        await frameContext.waitForSelector('.monaco-workbench', { timeout: 10000 });
        await frameContext.evaluate(() => {
          // Close any welcome dialogs
          const closeButtons = document.querySelectorAll('[aria-label="Close"], [title="Close"], .codicon-close, .action-label.codicon-close');
          closeButtons.forEach(button => {
            if (button instanceof HTMLElement && button.offsetParent !== null) {
              button.click();
            }
          });
          // Dismiss notifications
          const notifications = document.querySelectorAll('.notifications-toasts .notification-toast');
          notifications.forEach(notification => {
            const closeBtn = notification.querySelector('.codicon-close');
            if (closeBtn instanceof HTMLElement) {
              closeBtn.click();
            }
          });
          // Try to close the "Get Started" tab if it's open
          const tabs = document.querySelectorAll('.tab .label-name');
          tabs.forEach(tab => {
            if (tab.textContent && tab.textContent.includes('Get Started')) {
              const tabContainer = tab.closest('.tab');
              const closeButton = tabContainer?.querySelector('.codicon-close');
              if (closeButton instanceof HTMLElement) {
                closeButton.click();
              }
            }
          });
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Try to open or create a file to show actual workspace
        await frameContext.evaluate(() => {
          const explorerView = document.querySelector('[aria-label="Explorer"], [title="Explorer"]');
          if (explorerView instanceof HTMLElement) {
            explorerView.click();
          }
          const fileItems = document.querySelectorAll('.explorer-viewlet .monaco-tree-row .label-name');
          if (fileItems.length > 0) {
            const firstFile = fileItems[0];
            if (firstFile instanceof HTMLElement && firstFile.textContent && 
                (firstFile.textContent.endsWith('.js') || 
                 firstFile.textContent.endsWith('.py') || 
                 firstFile.textContent.endsWith('.java') ||
                 firstFile.textContent.endsWith('.cpp') ||
                 firstFile.textContent.endsWith('.html') ||
                 firstFile.textContent.endsWith('.css'))) {
              firstFile.click();
            }
          }
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
        // If no files exist, create a new file based on subject
        const hasOpenFile = await frameContext.evaluate(() => {
          const tabs = document.querySelectorAll('.tab .label-name');
          return Array.from(tabs).some(tab => 
            tab.textContent && 
            !tab.textContent.includes('Get Started') && 
            !tab.textContent.includes('Welcome')
          );
        });
        if (!hasOpenFile) {
          console.log('📝 No code files open, trying to open existing files or create new...');
          const existingFiles = await frameContext.evaluate(() => {
            const fileElements = document.querySelectorAll('.explorer-viewlet .monaco-tree-row .label-name');
            const files = [];
            fileElements.forEach(element => {
              if (element.textContent) {
                files.push(element.textContent);
              }
            });
            return files;
          });
          console.log('📁 Found existing files:', existingFiles);
          if (existingFiles.length > 0) {
            const codeFiles = existingFiles.filter(file => 
              file.endsWith('.js') || file.endsWith('.py') || 
              file.endsWith('.java') || file.endsWith('.cpp') ||
              file.endsWith('.html') || file.endsWith('.css') ||
              file.endsWith('.json') || file.endsWith('.md')
            );
            if (codeFiles.length > 0) {
              console.log(`📂 Opening existing file: ${codeFiles[0]}`);
              await frameContext.evaluate((filename) => {
                const fileElements = document.querySelectorAll('.explorer-viewlet .monaco-tree-row .label-name');
                fileElements.forEach(element => {
                  if (element.textContent === filename) {
                    (element as HTMLElement).click();
                  }
                });
              }, codeFiles[0]);
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
          const stillNeedFile = await frameContext.evaluate(() => {
            const tabs = document.querySelectorAll('.tab .label-name');
            return !Array.from(tabs).some(tab => 
              tab.textContent && 
              !tab.textContent.includes('Get Started') && 
              !tab.textContent.includes('Welcome')
            );
          });
          if (stillNeedFile) {
            console.log('📝 Creating new sample file...');
            const fileExtension = subject.toLowerCase() === 'javascript' ? 'js' :
                                 subject.toLowerCase() === 'python' ? 'py' :
                                 subject.toLowerCase() === 'java' ? 'java' :
                                 subject.toLowerCase() === 'c++' ? 'cpp' : 'js';
            await frameContext.keyboard.down('Control');
            await frameContext.keyboard.press('n');
            await frameContext.keyboard.up('Control');
            await new Promise(resolve => setTimeout(resolve, 1000));
            const sampleCode = subject.toLowerCase() === 'javascript' ? 
              '// Student JavaScript Exercise\n// Fix the prime number checker function\n\nfunction isPrime(num) {\n    if (num <= 1) return false;\n    \n    for (let i = 2; i < num; i++) {\n        if (num % i === 0) {\n            return false;\n        }\n    }\n    return true;\n}\n\n// Test the function\nconsole.log("isPrime(7):", isPrime(7));\nconsole.log("isPrime(4):", isPrime(4));' :
              subject.toLowerCase() === 'python' ?
              '# Student Python Exercise\n# Complete the fibonacci function\n\ndef fibonacci(n):\n    """Calculate nth fibonacci number"""\n    if n <= 1:\n        return n\n    \n    # TODO: Complete this function\n    return fibonacci(n-1) + fibonacci(n-2)\n\n# Test the function\nfor i in range(10):\n    print(f"fibonacci({i}) = {fibonacci(i)}")' :
              subject.toLowerCase() === 'java' ?
              '// Student Java Exercise\n// Complete the sorting algorithm\n\npublic class StudentWork {\n    public static void main(String[] args) {\n        int[] numbers = {64, 34, 25, 12, 22, 11, 90};\n        \n        System.out.println("Original array:");\n        printArray(numbers);\n        \n        // TODO: Implement bubble sort\n        bubbleSort(numbers);\n        \n        System.out.println("Sorted array:");\n        printArray(numbers);\n    }\n    \n    static void bubbleSort(int[] arr) {\n        // Implementation needed\n    }\n    \n    static void printArray(int[] arr) {\n        for (int value : arr) {\n            System.out.print(value + " ");\n        }\n        System.out.println();\n    }\n}' :
              '// Student C++ Exercise\n// Debug the factorial function\n\n#include <iostream>\nusing namespace std;\n\nint factorial(int n) {\n    // TODO: Fix this function\n    if (n <= 1) {\n        return 1;\n    }\n    return n * factorial(n - 1);\n}\n\nint main() {\n    int number = 5;\n    cout << "Factorial of " << number << " is: " << factorial(number) << endl;\n    \n    // Test with different values\n    for (int i = 1; i <= 10; i++) {\n        cout << "factorial(" << i << ") = " << factorial(i) << endl;\n    }\n    \n    return 0;\n}';
            await frameContext.type('.monaco-editor textarea', sampleCode);
            await new Promise(resolve => setTimeout(resolve, 1000));
            await frameContext.keyboard.down('Control');
            await frameContext.keyboard.press('s');
            await frameContext.keyboard.up('Control');
            await new Promise(resolve => setTimeout(resolve, 500));
            await frameContext.type('input[type="text"], .input', `student_work.${fileExtension}`);
            await frameContext.keyboard.press('Enter');
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
        await frameContext.evaluate(() => {
          const editor = document.querySelector('.monaco-editor textarea');
          if (editor instanceof HTMLElement) {
            editor.focus();
          }
          const overlays = document.querySelectorAll('.monaco-dialog, .notification-toast, .context-view');
          overlays.forEach(overlay => {
            if (overlay instanceof HTMLElement) {
              overlay.style.display = 'none';
            }
          });
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('✅ Workspace setup complete, ready for capture');
      } catch (setupError) {
        console.log('⚠️ Workspace setup had issues, proceeding with capture anyway:', setupError.message);
      }

      // Enhanced content detection
      console.log('🔍 Analyzing page content before screenshot...');
      try {
        await frameContext.waitForSelector('.monaco-editor, .monaco-workbench, .ace_editor, .CodeMirror, .cm-editor, pre code, .highlight', { 
          timeout: 10000 
        });
        console.log('✅ Code editor interface detected');
        await new Promise(resolve => setTimeout(resolve, 3000));
        const hasContent = await frameContext.evaluate(() => {
          const monacoEditors = document.querySelectorAll('.monaco-editor .view-lines');
          for (let editor of monacoEditors) {
            if (editor.textContent && editor.textContent.trim().length > 10) {
              const content = editor.textContent.trim();
              if (!content.includes('Get Started') && 
                  !content.includes('Welcome') && 
                  !content.includes('Choose a language') &&
                  (content.includes('function') || 
                   content.includes('console.log') || 
                   content.includes('print(') ||
                   content.includes('public class') ||
                   content.includes('#include') ||
                   content.includes('def ') ||
                   content.includes('=') ||
                   content.includes('{') ||
                   content.includes(';'))) {
                return { found: true, type: 'monaco-code', content: content.substring(0, 100) };
              }
            }
          }
          const tabs = document.querySelectorAll('.tab .label-name');
          const hasCodeFile = Array.from(tabs).some(tab => {
            const text = tab.textContent || '';
            return text.endsWith('.js') || text.endsWith('.py') || 
                   text.endsWith('.java') || text.endsWith('.cpp') ||
                   text.endsWith('.html') || text.endsWith('.css') ||
                   text.endsWith('.json') || text.endsWith('.md');
          });
          if (hasCodeFile) {
            const activeEditor = document.querySelector('.monaco-editor.focused .view-lines, .monaco-editor .view-lines');
            if (activeEditor && activeEditor.textContent) {
              const content = activeEditor.textContent.trim();
              if (content.length > 5) {
                return { found: true, type: 'code-file', content: content.substring(0, 100) };
              }
            }
          }
          const terminals = document.querySelectorAll('.terminal .xterm-screen');
          for (let terminal of terminals) {
            if (terminal.textContent && terminal.textContent.trim().length > 10) {
              return { found: true, type: 'terminal', content: terminal.textContent.substring(0, 100) };
            }
          }
          const workspace = document.querySelector('.monaco-workbench');
          const explorer = document.querySelector('.explorer-viewlet');
          const sidebar = document.querySelector('.activitybar');
          if (workspace && (explorer || sidebar)) {
            return { found: true, type: 'workspace', content: 'VS Code workspace loaded' };
          }
          return { found: false, type: 'none', content: '' };
        });
        console.log(`📄 Content analysis result:`, hasContent);
        if (!hasContent.found) {
          console.log('⚠️ No substantial content detected, capturing anyway');
        } else {
          console.log(`✅ Content detected (${hasContent.type}): ${hasContent.content}...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (waitError) {
        console.log('⚠️ Editor detection timeout, proceeding with screenshot anyway');
      }

      // Create screenshots directory
      const screenshotsDir = path.join(process.cwd(), 'screenshots');
      if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `user-${userId}-${subject}-${captureEvent}-${timestamp}.jpg`;
      const filePath = path.join(screenshotsDir, filename);

      console.log(`📸 Capturing screenshot at ${screenSize.width}x${screenSize.height}...`);
      await page.screenshot({
        path: filePath,
        type: 'jpeg',
        quality: 92,
        fullPage: false,
        clip: {
          x: 0,
          y: 0,
          width: screenSize.width,
          height: screenSize.height
        }
      });

      const stats = fs.statSync(filePath);
      const imageSize = Math.round(stats.size / 1024);

      console.log(`✅ Screenshot captured successfully: ${filename} (${imageSize}KB) at ${screenSize.width}x${screenSize.height}`);

      return {
        success: true,
        filePath,
        filename,
        timestamp: new Date().toISOString(),
        containerUrl,
        userId,
        subject,
        imageSize,
        screenInfo: {
          width: screenSize.width,
          height: screenSize.height,
          actualSystemScreen: true
        },
        captureType: 'browser'
      };

    } catch (error) {
      console.error('❌ Puppeteer screenshot failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        containerUrl,
        userId,
        subject,
        captureType: 'browser'
      };
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (e) {
          console.error('Error closing page:', e);
        }
      }
    }
  }

  async captureDesktopAndSaveToMongoDB(
    userId: number,
    subject: string = 'desktop',
    captureEvent: string = 'manual'
  ): Promise<ScreenshotResult> {
    const result = await this.captureDesktopScreen(userId, subject, captureEvent);
    if (result.success && result.filePath) {
      try {
        const imageBuffer = fs.readFileSync(result.filePath);
        const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
        const screenSize = result.screenInfo || { width: 1920, height: 1080 };
        const screenshotData: ScreenshotData = {
          userId,
          type: 'screenshot',
          image: base64Image,
          metadata: {
            timestamp: result.timestamp!,
            captureMethod: 'puppeteer-server-side',
            containerUrl: 'desktop-capture',
            subject: result.subject!,
            filename: result.filename!,
            captureEvent,
            screenResolution: { width: screenSize.width, height: screenSize.height },
            fileSize: result.imageSize || 0,
            isCodespaceCapture: false,
            captureQuality: 'high',
            captureType: 'desktop'
          }
        };
        console.log(`💾 Saving desktop screenshot to MongoDB Atlas for user ${userId}...`);
        await mongoService.saveScreenshot(screenshotData);
        console.log(`✅ Desktop screenshot saved to MongoDB Atlas successfully`);
        try {
          fs.unlinkSync(result.filePath);
          console.log(`🗑️ Local file cleaned up: ${result.filename}`);
        } catch (cleanupError) {
          console.warn(`⚠️ Failed to clean up local file: ${cleanupError}`);
        }
      } catch (mongoError) {
        console.error('❌ Failed to save desktop screenshot to MongoDB Atlas:', mongoError);
        return {
          ...result,
          success: false,
          error: `MongoDB save failed: ${mongoError instanceof Error ? mongoError.message : 'Unknown error'}`
        };
      }
    }
    return result;
  }

  async captureAndSaveToMongoDB(
    containerUrl: string,
    userId: number,
    subject: string = 'code',
    captureEvent: string = 'manual'
  ): Promise<ScreenshotResult> {
    const result = await this.captureScreenshot(containerUrl, userId, subject, captureEvent);
    if (result.success && result.filePath) {
      try {
        const imageBuffer = fs.readFileSync(result.filePath);
        const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
        const screenSize = result.screenInfo || { width: 1920, height: 1080 };
        const screenshotData: ScreenshotData = {
          userId,
          type: 'screenshot',
          image: base64Image,
          metadata: {
            timestamp: result.timestamp!,
            captureMethod: 'puppeteer-server-side',
            containerUrl: result.containerUrl!,
            subject: result.subject!,
            filename: result.filename!,
            captureEvent,
            screenResolution: { width: screenSize.width, height: screenSize.height },
            fileSize: result.imageSize || 0,
            isCodespaceCapture: true,
            captureQuality: 'high',
            captureType: result.captureType || 'browser'
          }
        };
        console.log(`💾 Saving screenshot to MongoDB Atlas for user ${userId}...`);
        await mongoService.saveScreenshot(screenshotData);
        console.log(`✅ Screenshot saved to MongoDB Atlas successfully`);
        try {
          fs.unlinkSync(result.filePath);
          console.log(`🗑️ Local file cleaned up: ${result.filename}`);
        } catch (cleanupError) {
          console.warn(`⚠️ Failed to clean up local file: ${cleanupError}`);
        }
      } catch (mongoError) {
        console.error('❌ Failed to save to MongoDB Atlas:', mongoError);
        return {
          ...result,
          success: false,
          error: `MongoDB save failed: ${mongoError instanceof Error ? mongoError.message : 'Unknown error'}`
        };
      }
    }
    return result;
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      console.log('🔄 Closing Puppeteer browser...');
      try {
        await this.browser.close();
        this.browser = null;
        console.log('✅ Puppeteer browser closed');
      } catch (error) {
        console.error('⚠️ Error closing browser:', error);
        this.browser = null;
      }
    }
  }
}

export const puppeteerService = new PuppeteerScreenshotService();

async function killOrphanedBrowsers() {
  try {
    console.log('🔍 Checking for orphaned browser processes...');
    if (process.platform === 'win32') {
      const { exec } = require('child_process');
      exec('tasklist /FI "IMAGENAME eq chrome.exe" /FO CSV', (error, stdout) => {
        if (!error && stdout.includes('chrome.exe')) {
          console.log('🔫 Killing orphaned Chrome processes...');
          exec('taskkill /F /IM chrome.exe /T', (killError) => {
            if (!killError) {
              console.log('✅ Orphaned processes cleaned up');
            }
          });
        }
      });
    } else {
      const { exec } = require('child_process');
      exec('pkill -f "chrome.*--remote-debugging-port"', () => {
        console.log('🧹 Attempted cleanup of orphaned browsers on Unix system');
      });
    }
  } catch (error) {
    console.warn('⚠️ Could not clean orphaned browsers:', error);
  }
}

process.on('SIGINT', async () => {
  console.log('🔄 Shutting down Puppeteer service...');
  await puppeteerService.cleanup();
  await killOrphanedBrowsers();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🔄 Shutting down Puppeteer service...');
  await puppeteerService.cleanup();
  await killOrphanedBrowsers();
  process.exit(0);
});

process.on('uncaughtException', async (error) => {
  console.error('💥 Uncaught exception:', error);
  await puppeteerService.cleanup();
  await killOrphanedBrowsers();
  process.exit(1);
});

process.on('unhandledRejection', async (error) => {
  console.error('💥 Unhandled rejection:', error);
  await puppeteerService.cleanup();
  await killOrphanedBrowsers();
});

export async function captureContainerScreenshot(
  containerUrl: string, 
  userId: number, 
  subject: string = 'code'
): Promise<ScreenshotResult> {
  return puppeteerService.captureScreenshot(containerUrl, userId, subject);
}

export async function captureAndSaveScreenshot(
  containerUrl: string,
  userId: number,
  subject: string,
  mongoService: any
): Promise<ScreenshotResult> {
  return puppeteerService.captureAndSaveToMongoDB(containerUrl, userId, subject);
}

export async function captureDesktopScreen(
  userId: number,
  subject: string = 'desktop'
): Promise<ScreenshotResult> {
  return puppeteerService.captureDesktopScreen(userId, subject);
}

export async function captureDesktopAndSave(
  userId: number,
  subject: string = 'desktop'
): Promise<ScreenshotResult> {
  return puppeteerService.captureDesktopAndSaveToMongoDB(userId, subject);
}