import { useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { apiRequest, validateScreenshotData } from "@/lib/queryClient";

interface ScreenCaptureProps {
  userId?: number;
  interval?: number; // in milliseconds
  isCodespaceActive?: boolean; // Only capture when codespace is active
}

export default function ScreenCapture({ 
  userId, 
  interval = 15000, // Reduced to 15 seconds for better monitoring
  isCodespaceActive = false 
}: ScreenCaptureProps) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [captureCount, setCaptureCount] = useState(0);
  const [hasScreenPermission, setHasScreenPermission] = useState(false);
  const [useScreenCapture, setUseScreenCapture] = useState(false);
  
  // Function to request screen sharing permission once
  const requestScreenPermission = async () => {
    if (streamRef.current || !navigator.mediaDevices?.getDisplayMedia) {
      return false;
    }

    try {
      console.log('📸 Requesting screen share permission (one-time)...');
      
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          mediaSource: 'screen',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } as any
      });

      // Create video element to capture frames from
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();
      
      // Wait for video to be ready
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => resolve();
      });

      streamRef.current = stream;
      videoRef.current = video;
      setHasScreenPermission(true);
      setUseScreenCapture(true);

      // Handle stream ending (user stops sharing)
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        console.log('📸 Screen sharing ended by user');
        streamRef.current = null;
        videoRef.current = null;
        setHasScreenPermission(false);
        setUseScreenCapture(false);
      });

      console.log('📸 Screen sharing permission granted and stream established');
      return true;
    } catch (error) {
      console.log('📸 Screen sharing permission denied or failed:', error);
      setUseScreenCapture(false);
      return false;
    }
  };
  
  useEffect(() => {
    if (!userId || !isCodespaceActive) {
      // Stop capturing if codespace is not active
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    
    // Function to capture the screen
    const captureScreen = async () => {
      try {
        // Check if there's a codespace iframe for metadata purposes
        const codespaceiframe = document.querySelector('iframe[title="Student Codespace"]') as HTMLIFrameElement;
        
        // Try screen capture if we have permission and stream
        if (useScreenCapture && streamRef.current && videoRef.current) {
          try {
            console.log('📸 Capturing from existing screen share stream...');
            
            const video = videoRef.current;
            
            // Create canvas and capture current frame
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(video, 0, 0);
            
            const image = canvas.toDataURL("image/jpeg", 0.9);
            
            // Ensure the image has the proper data URI prefix
            if (!image.startsWith('data:image/')) {
              console.error('❌ Invalid image format - missing data URI prefix');
              throw new Error('Screenshot captured without proper data URI format');
            }
            
            console.log(`📸 Screen capture successful: ${canvas.width}x${canvas.height}, size: ${Math.round(image.length/1024)}KB`);
            console.log(`📸 Image format validation: ${image.startsWith('data:image/') ? '✅ Valid' : '❌ Invalid'} - ${image.substring(0, 30)}...`);
            
            // Validate screenshot data before sending
            const validation = validateScreenshotData(image);
            if (!validation.isValid) {
              console.error('❌ Screenshot validation failed:', validation.error);
              throw new Error(`Screenshot validation failed: ${validation.error}`);
            }
            
            const finalImageData = validation.correctedData || image;
            console.log('📸 Screenshot validation passed:', validation.error || 'No corrections needed');
            
            // Enhanced metadata for real screen capture
            const screenshotData = {
              userId,
              image: finalImageData,
              metadata: {
                timestamp: new Date().toISOString(),
                captureNumber: captureCount + 1,
                screenResolution: {
                  width: window.screen.width,
                  height: window.screen.height
                },
                viewportSize: {
                  width: window.innerWidth,
                  height: window.innerHeight
                },
                captureSize: {
                  width: canvas.width,
                  height: canvas.height
                },
                userAgent: navigator.userAgent,
                url: window.location.href,
                sessionId: sessionStorage.getItem('sessionId') || 'unknown',
                codespaceActive: !!codespaceiframe,
                pageTitle: document.title,
                captureMethod: 'screen-capture-api-reused-stream'
              }
            };
            
            await apiRequest("POST", "/api/log/screenshot", screenshotData);
            setCaptureCount(prev => prev + 1);
            console.log(`📸 Screenshot ${captureCount + 1} captured and sent to server`);
            return; // Success, exit function
            
          } catch (screenCaptureError) {
            console.log('📸 Screen capture from stream failed:', screenCaptureError);
            // Don't fallback to DOM immediately, the stream might just be temporarily unavailable
            return;
          }
        }
        
        // Fallback to DOM capture with iframe handling
        console.log('📸 Using DOM capture with iframe placeholders...');
        
        const targetElement = document.documentElement;
        
        const canvas = await html2canvas(targetElement, {
          useCORS: true,
          allowTaint: true,
          scale: 0.8,
          width: window.innerWidth,
          height: window.innerHeight,
          scrollX: 0,
          scrollY: 0,
          windowWidth: window.innerWidth,
          windowHeight: window.innerHeight,
          backgroundColor: '#ffffff',
          removeContainer: true,
          logging: false,
          imageTimeout: 15000,
          onclone: (clonedDoc) => {
            // Replace iframes with informative placeholders
            const iframes = clonedDoc.querySelectorAll('iframe');
            iframes.forEach(iframe => {
              const htmlEl = iframe as HTMLElement;
              const placeholder = clonedDoc.createElement('div');
              const iframeSrc = iframe.getAttribute('src') || iframe.getAttribute('title') || 'Iframe Content';
              
              placeholder.style.width = htmlEl.style.width || htmlEl.getAttribute('width') || '100%';
              placeholder.style.height = htmlEl.style.height || htmlEl.getAttribute('height') || '400px';
              placeholder.style.backgroundColor = '#e3f2fd';
              placeholder.style.border = '3px solid #2196f3';
              placeholder.style.borderRadius = '8px';
              placeholder.style.display = 'flex';
              placeholder.style.flexDirection = 'column';
              placeholder.style.alignItems = 'center';
              placeholder.style.justifyContent = 'center';
              placeholder.style.fontFamily = 'Arial, sans-serif';
              placeholder.style.fontSize = '14px';
              placeholder.style.color = '#1976d2';
              placeholder.style.padding = '20px';
              placeholder.style.textAlign = 'center';
              
              placeholder.innerHTML = `
                <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">🖥️ CODESPACE</div>
                <div style="font-size: 12px; opacity: 0.8;">${iframeSrc}</div>
                <div style="font-size: 10px; margin-top: 5px; opacity: 0.6;">Enable screen sharing for full capture</div>
              `;
              
              iframe.parentNode?.replaceChild(placeholder, iframe);
            });
          }
        });
        
        const image = canvas.toDataURL("image/jpeg", 0.85);
        
        // Ensure the image has the proper data URI prefix
        if (!image.startsWith('data:image/')) {
          console.error('❌ Invalid HTML2Canvas image format - missing data URI prefix');
          throw new Error('HTML2Canvas screenshot captured without proper data URI format');
        }
        
        console.log(`📸 DOM capture successful: ${canvas.width}x${canvas.height}, size: ${Math.round(image.length/1024)}KB`);
        console.log(`📸 Image format validation: ${image.startsWith('data:image/') ? '✅ Valid' : '❌ Invalid'} - ${image.substring(0, 30)}...`);
        
        // Validate screenshot data before sending
        const validation = validateScreenshotData(image);
        if (!validation.isValid) {
          console.error('❌ HTML2Canvas validation failed:', validation.error);
          throw new Error(`HTML2Canvas validation failed: ${validation.error}`);
        }
        
        const finalImageData = validation.correctedData || image;
        console.log('📸 HTML2Canvas validation passed:', validation.error || 'No corrections needed');
        
        const screenshotData = {
          userId,
          image: finalImageData,
          metadata: {
            timestamp: new Date().toISOString(),
            captureNumber: captureCount + 1,
            screenResolution: {
              width: window.screen.width,
              height: window.screen.height
            },
            viewportSize: {
              width: window.innerWidth,
              height: window.innerHeight
            },
            captureSize: {
              width: canvas.width,
              height: canvas.height
            },
            userAgent: navigator.userAgent,
            url: window.location.href,
            sessionId: sessionStorage.getItem('sessionId') || 'unknown',
            codespaceActive: !!codespaceiframe,
            pageTitle: document.title,
            captureMethod: 'html2canvas-dom-fallback'
          }
        };
        
        await apiRequest("POST", "/api/log/screenshot", screenshotData);
        setCaptureCount(prev => prev + 1);
        console.log(`📸 Screenshot ${captureCount + 1} captured and sent to server`);
        
      } catch (error) {
        console.error("Error capturing screen:", error);
        
        try {
          await apiRequest("POST", "/api/log/screenshot-error", {
            userId,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
            captureAttempt: captureCount + 1
          });
        } catch (logError) {
          console.error("Failed to log screenshot error:", logError);
        }
      }
    };
    
    // Set up periodic screen capture
    intervalRef.current = setInterval(captureScreen, interval);
    
    // Initial capture after a short delay
    setTimeout(captureScreen, 2000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [userId, interval, isCodespaceActive, captureCount, useScreenCapture]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current = null;
      }
    };
  }, []);
  
  // Show capture status and screen share button
  return isCodespaceActive ? (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-red-500 text-white text-xs px-2 py-1 rounded mb-2 opacity-75">
        📸 Recording: {captureCount} captures
      </div>
      {!hasScreenPermission && (
        <button 
          onClick={requestScreenPermission}
          className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-2 rounded shadow-md"
        >
          📺 Enable Screen Sharing
        </button>
      )}
      {hasScreenPermission && (
        <div className="bg-green-500 text-white text-xs px-2 py-1 rounded opacity-75">
          ✅ Screen sharing active
        </div>
      )}
    </div>
  ) : null;
}
