import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PuppeteerScreenshotLog {
  _id: string;
  userId: number;
  type: 'screenshot';
  image: string;
  metadata: {
    timestamp: string;
    captureMethod: string;
    containerUrl: string;
    subject: string;
    filename: string;
    captureEvent: string;
    screenResolution: { width: number; height: number };
    fileSize: number;
    isCodespaceCapture: boolean;
    captureQuality: string;
    pageTitle?: string;
    userAgent?: string;
    sessionId?: string;
  };
  createdAt?: string;
}

// Legacy client-side screenshot format for backward compatibility
interface LegacyScreenshotLog {
  _id: string;
  userId: number;
  type: 'screenshot';
  image: string;
  metadata: {
    timestamp: string;
    captureNumber?: number;
    screenResolution: { width: number; height: number };
    viewportSize?: { width: number; height: number };
    userAgent?: string;
    url?: string;
    sessionId?: string;
    codespaceActive?: boolean;
    captureMethod?: string;
  };
  createdAt: string;
}

// Unified screenshot type
interface Screenshot {
  id: string;
  userId: number;
  timestamp: string;
  image: string;
  metadata: {
    captureMethod: string;
    subject?: string;
    filename?: string;
    captureEvent?: string;
    containerUrl?: string;
    screenResolution: { width: number; height: number };
    fileSize?: number;
    isCodespaceCapture: boolean;
    captureQuality?: string;
    captureNumber?: number;
    viewportSize?: { width: number; height: number };
    url?: string;
  };
}

interface ScreenshotViewerProps {
  className?: string;
}

export default function ScreenshotViewer({ className }: ScreenshotViewerProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [selectedScreenshot, setSelectedScreenshot] = useState<Screenshot | null>(null);
  const [captureMethodFilter, setCaptureMethodFilter] = useState<string>("all");
  const [isTestingScreenshot, setIsTestingScreenshot] = useState(false);

  // Fetch screenshots from MongoDB
  const { data: screenshots = [], isLoading, error } = useQuery<(PuppeteerScreenshotLog | LegacyScreenshotLog)[]>({
    queryKey: ["/api/mongodb/screenshots"],
    refetchInterval: 10000, // Refresh every 10 seconds
    retry: 3,
    retryDelay: 1000,
    onSuccess: (data) => {
      console.log('📸 Screenshots API Success:', { 
        count: data?.length || 0, 
        firstItem: data?.[0] ? {
          id: data[0]._id,
          userId: data[0].userId,
          hasImage: !!data[0].image,
          imageLength: data[0].image?.length,
          method: data[0].metadata?.captureMethod
        } : null
      });
    },
    onError: (err) => {
      console.error('📸 Screenshots API Error:', err);
    }
  });

  // Process both Puppeteer and legacy screenshots
  const processedScreenshots: Screenshot[] = screenshots
    .map(screenshot => {
      // Detect if it's a Puppeteer screenshot or legacy screenshot
      const isPuppeteer = screenshot.metadata.captureMethod === 'puppeteer-server-side' || 
                         screenshot.metadata.containerUrl !== undefined;
      
      if (isPuppeteer) {
        const puppeteerScreenshot = screenshot as PuppeteerScreenshotLog;
        return {
          id: puppeteerScreenshot._id,
          userId: puppeteerScreenshot.userId,
          timestamp: puppeteerScreenshot.metadata.timestamp || puppeteerScreenshot.createdAt || new Date().toISOString(),
          image: puppeteerScreenshot.image,
          metadata: {
            captureMethod: puppeteerScreenshot.metadata.captureMethod,
            subject: puppeteerScreenshot.metadata.subject,
            filename: puppeteerScreenshot.metadata.filename,
            captureEvent: puppeteerScreenshot.metadata.captureEvent,
            containerUrl: puppeteerScreenshot.metadata.containerUrl,
            screenResolution: puppeteerScreenshot.metadata.screenResolution,
            fileSize: puppeteerScreenshot.metadata.fileSize,
            isCodespaceCapture: puppeteerScreenshot.metadata.isCodespaceCapture,
            captureQuality: puppeteerScreenshot.metadata.captureQuality,
            url: puppeteerScreenshot.metadata.containerUrl
          }
        };
      } else {
        // Legacy screenshot
        const legacyScreenshot = screenshot as LegacyScreenshotLog;
        return {
          id: legacyScreenshot._id,
          userId: legacyScreenshot.userId,
          timestamp: legacyScreenshot.createdAt,
          image: legacyScreenshot.image,
          metadata: {
            captureMethod: legacyScreenshot.metadata.captureMethod || 'client-side-legacy',
            screenResolution: legacyScreenshot.metadata.screenResolution,
            isCodespaceCapture: legacyScreenshot.metadata.codespaceActive || false,
            captureNumber: legacyScreenshot.metadata.captureNumber,
            viewportSize: legacyScreenshot.metadata.viewportSize,
            url: legacyScreenshot.metadata.url
          }
        };
      }
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Filter by user
  let filteredScreenshots = selectedUserId === "all" 
    ? processedScreenshots 
    : processedScreenshots.filter(s => s.userId.toString() === selectedUserId);

  // Filter by capture method
  if (captureMethodFilter !== "all") {
    filteredScreenshots = filteredScreenshots.filter(s => 
      s.metadata.captureMethod === captureMethodFilter ||
      (captureMethodFilter === "puppeteer" && s.metadata.captureMethod === "puppeteer-server-side") ||
      (captureMethodFilter === "client" && s.metadata.captureMethod !== "puppeteer-server-side")
    );
  }

  // Get unique user IDs
  const userIds = [...new Set(processedScreenshots.map(s => s.userId))].sort();

  // Get capture method stats
  const captureMethodStats = processedScreenshots.reduce((acc, s) => {
    const method = s.metadata.captureMethod === 'puppeteer-server-side' ? 'Puppeteer' : 'Client-side';
    acc[method] = (acc[method] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  const getCaptureMethodBadge = (method: string) => {
    if (method === 'puppeteer-server-side') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          🚀 Puppeteer
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          📱 Client
        </span>
      );
    }
  };

  const handleTestScreenshot = async () => {
    setIsTestingScreenshot(true);
    try {
      const response = await fetch('/api/admin/test-screenshot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert('✅ Test screenshot captured successfully! Check the screenshots list.');
        // Refresh the screenshots list
        window.location.reload();
      } else {
        alert('❌ Test screenshot failed: ' + result.message);
      }
    } catch (error) {
      console.error('Test screenshot error:', error);
      alert('❌ Test screenshot failed: ' + error.message);
    } finally {
      setIsTestingScreenshot(false);
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            📸 Student Screenshots
            <div className="flex items-center gap-4">
              <Button 
                onClick={handleTestScreenshot}
                disabled={isTestingScreenshot}
                variant="outline"
                size="sm"
              >
                {isTestingScreenshot ? '🔄 Testing...' : '🧪 Test Screenshot'}
              </Button>
              <Select value={captureMethodFilter} onValueChange={setCaptureMethodFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="puppeteer">Puppeteer Only</SelectItem>
                  <SelectItem value="client">Client-side Only</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by student" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Students</SelectItem>
                  {userIds.map(userId => (
                    <SelectItem key={userId} value={userId.toString()}>
                      Student {userId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-sm text-gray-500 flex items-center gap-2">
                <span>{filteredScreenshots.length} screenshots</span>
                {error && <span className="text-red-500">• API Error</span>}
                {isLoading && <span className="text-blue-500">• Loading...</span>}
                {!isLoading && !error && screenshots.length === 0 && (
                  <span className="text-yellow-600">• No Data</span>
                )}
              </div>
            </div>
          </CardTitle>
          {Object.keys(captureMethodStats).length > 0 && (
            <div className="flex items-center gap-4 text-sm text-gray-600">
              {Object.entries(captureMethodStats).map(([method, count]) => (
                <span key={method}>
                  {method}: <strong>{count}</strong>
                </span>
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
              Loading screenshots from MongoDB...
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="font-medium">❌ Error loading screenshots</p>
              <p className="text-sm mt-1">{error.message}</p>
              <p className="text-xs mt-2 text-gray-600">This usually means MongoDB connection issues or authentication problems</p>
              <Button 
                onClick={() => window.location.reload()} 
                variant="outline" 
                size="sm" 
                className="mt-3"
              >
                🔄 Retry
              </Button>
            </div>
          ) : filteredScreenshots.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {screenshots.length === 0 ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <div className="text-6xl mb-4">📸</div>
                  <p className="font-medium text-gray-700 mb-2">No screenshots available yet</p>
                  <p className="text-sm mb-4">Screenshots will appear here when:</p>
                  <ul className="text-sm text-left inline-block space-y-1">
                    <li>• Students submit code (automatic Puppeteer capture)</li>
                    <li>• Students use manual screenshot capture</li>
                    <li>• Admin triggers test screenshots</li>
                  </ul>
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
                    <strong>💡 To test:</strong> Click the "🧪 Test Screenshot" button above to capture a test screenshot of Google.com
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p>No screenshots match the current filters</p>
                  <p className="text-xs mt-2">Try changing the filter settings above</p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredScreenshots.map((screenshot) => (
                <div
                  key={screenshot.id}
                  className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => setSelectedScreenshot(screenshot)}
                >
                  <div className="aspect-video bg-gray-100 relative overflow-hidden">
                    <img
                      src={screenshot.image}
                      alt={`Screenshot from Student ${screenshot.userId}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        console.error(`Failed to load screenshot for user ${screenshot.userId}:`, {
                          imageLength: screenshot.image?.length,
                          imagePrefix: screenshot.image?.substring(0, 30),
                          hasValidPrefix: screenshot.image?.startsWith('data:image/')
                        });
                        // Replace with error placeholder
                        e.currentTarget.style.display = 'none';
                        const errorDiv = document.createElement('div');
                        errorDiv.className = 'w-full h-full flex items-center justify-center bg-red-50 border border-red-200';
                        errorDiv.innerHTML = `
                          <div class="text-center text-red-600 p-4">
                            <div class="text-2xl mb-2">❌</div>
                            <div class="text-xs">Screenshot Failed</div>
                            <div class="text-xs opacity-60">Invalid image data</div>
                          </div>
                        `;
                        e.currentTarget.parentNode?.appendChild(errorDiv);
                      }}
                      onLoad={() => {
                        console.log(`✅ Screenshot loaded for user ${screenshot.userId}`);
                      }}
                    />
                    <div className="absolute top-2 left-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                      Student {screenshot.userId}
                    </div>
                    <div className="absolute top-2 right-2">
                      {getCaptureMethodBadge(screenshot.metadata.captureMethod)}
                    </div>
                    {screenshot.metadata.isCodespaceCapture && (
                      <div className="absolute bottom-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                        Codespace
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="text-sm font-medium">
                      {formatTimeAgo(screenshot.timestamp)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatTimestamp(screenshot.timestamp)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {screenshot.metadata.subject && (
                        <span className="bg-gray-200 text-gray-700 px-1 rounded mr-1">
                          {screenshot.metadata.subject}
                        </span>
                      )}
                      {screenshot.metadata.captureEvent && (
                        <span className="bg-blue-200 text-blue-700 px-1 rounded">
                          {screenshot.metadata.captureEvent}
                        </span>
                      )}
                      {screenshot.metadata.captureNumber && (
                        <span className="ml-1">
                          #{screenshot.metadata.captureNumber}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enhanced Screenshot Modal */}
      {selectedScreenshot && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-6xl max-h-[90vh] overflow-auto">
            <div className="p-4 border-b">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold">
                    Student {selectedScreenshot.userId} Screenshot
                  </h3>
                  <p className="text-sm text-gray-600">
                    {formatTimestamp(selectedScreenshot.timestamp)}
                  </p>
                  <div className="mt-2">
                    {getCaptureMethodBadge(selectedScreenshot.metadata.captureMethod)}
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setSelectedScreenshot(null)}
                >
                  ✕ Close
                </Button>
              </div>
              
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {selectedScreenshot.metadata.subject && (
                  <div>
                    <strong>Subject:</strong> {selectedScreenshot.metadata.subject}
                  </div>
                )}
                {selectedScreenshot.metadata.captureEvent && (
                  <div>
                    <strong>Event:</strong> {selectedScreenshot.metadata.captureEvent}
                  </div>
                )}
                <div>
                  <strong>Resolution:</strong> {selectedScreenshot.metadata.screenResolution.width}×{selectedScreenshot.metadata.screenResolution.height}
                </div>
                {selectedScreenshot.metadata.fileSize && (
                  <div>
                    <strong>Size:</strong> {selectedScreenshot.metadata.fileSize}KB
                  </div>
                )}
                {selectedScreenshot.metadata.captureQuality && (
                  <div>
                    <strong>Quality:</strong> {selectedScreenshot.metadata.captureQuality}
                  </div>
                )}
                {selectedScreenshot.metadata.isCodespaceCapture && (
                  <div>
                    <strong>Codespace:</strong> Active
                  </div>
                )}
                {selectedScreenshot.metadata.captureNumber && (
                  <div>
                    <strong>Capture #:</strong> {selectedScreenshot.metadata.captureNumber}
                  </div>
                )}
                {selectedScreenshot.metadata.filename && (
                  <div className="col-span-2">
                    <strong>Filename:</strong> 
                    <span className="font-mono text-xs ml-1">{selectedScreenshot.metadata.filename}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="p-4">
              {/* 🔎 FINAL DEBUG CHECKLIST - Add debugging tools for modal */}
              <div style={{ marginBottom: '10px' }}>
                <details>
                  <summary style={{ cursor: 'pointer', fontSize: '12px', color: '#666' }}>
                    🔧 Debug Tools (Click to expand)
                  </summary>
                  <div style={{ padding: '10px', background: '#f5f5f5', margin: '5px 0', borderRadius: '4px' }}>
                    <button 
                      onClick={() => {
                        console.log('🔎 FINAL DEBUG CHECKLIST - Screenshot Viewer Modal');
                        console.log("Screenshot image string:", selectedScreenshot.image);
                        console.log("Image string length:", selectedScreenshot.image?.length);
                        console.log("First 100 chars:", selectedScreenshot.image?.substring(0, 100));
                        console.log("Last 50 chars:", selectedScreenshot.image?.substring(selectedScreenshot.image.length - 50));
                        
                        // Check for issues
                        const hasEscapeChars = selectedScreenshot.image?.includes('\\"') || selectedScreenshot.image?.includes('\\n');
                        const hasExtraQuotes = selectedScreenshot.image?.startsWith('"') && selectedScreenshot.image?.endsWith('"');
                        const hasValidPrefix = selectedScreenshot.image?.startsWith('data:image/');
                        
                        console.log('Has escape chars:', hasEscapeChars);
                        console.log('Has extra quotes:', hasExtraQuotes);
                        console.log('Has valid prefix:', hasValidPrefix);
                      }}
                      style={{ 
                        padding: '5px 10px', 
                        margin: '2px', 
                        fontSize: '11px',
                        background: '#007cba',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer'
                      }}
                    >
                      📊 Analyze Image Data
                    </button>
                    <button 
                      onClick={() => {
                        console.log('🧪 Testing manual image load (Screenshot Viewer)...');
                        const testImg = new Image();
                        testImg.onload = () => {
                          console.log('✅ Manual load test: SUCCESS - Image loads correctly (Screenshot Viewer)');
                        };
                        testImg.onerror = (e) => {
                          console.error('❌ Manual load test: FAILED - Image cannot be loaded (Screenshot Viewer)', e);
                        };
                        testImg.src = selectedScreenshot.image;
                      }}
                      style={{ 
                        padding: '5px 10px', 
                        margin: '2px', 
                        fontSize: '11px',
                        background: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer'
                      }}
                    >
                      🧪 Test Manual Load
                    </button>
                    <button 
                      onClick={() => {
                        const knownGoodImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4/8/AzAEKgPBBgggAAAABJRU5ErkJggg==";
                        const testImg = new Image();
                        testImg.onload = () => console.log('✅ Known-good image test: SUCCESS (Screenshot Viewer)');
                        testImg.onerror = () => console.error('❌ Known-good image test: FAILED (Screenshot Viewer)');
                        testImg.src = knownGoodImage;
                        document.body.appendChild(testImg);
                      }}
                      style={{ 
                        padding: '5px 10px', 
                        margin: '2px', 
                        fontSize: '11px',
                        background: '#ffc107',
                        color: 'black',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer'
                      }}
                    >
                      🔎 Test Known-Good Image
                    </button>
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '5px' }}>
                      <div>Valid prefix: {selectedScreenshot.image?.startsWith('data:image/') ? '✅' : '❌'}</div>
                      <div>Has escape chars: {(selectedScreenshot.image?.includes('\\"') || selectedScreenshot.image?.includes('\\n')) ? '⚠️' : '✅'}</div>
                      <div>Has extra quotes: {(selectedScreenshot.image?.startsWith('"') && selectedScreenshot.image?.endsWith('"')) ? '⚠️' : '✅'}</div>
                      <div>Image length: {selectedScreenshot.image?.length || 0} chars</div>
                    </div>
                  </div>
                </details>
              </div>
              
              {/* 🔎 FINAL DEBUG CHECKLIST - Step 1: Proper Image Rendering */}
              {selectedScreenshot.image?.startsWith("data:image") ? (
                <img
                  src={selectedScreenshot.image}
                  alt={`Screenshot from Student ${selectedScreenshot.userId}`}
                  className="w-full h-auto max-h-[70vh] object-contain border"
                />
              ) : (
                <div className="text-center py-8 text-red-500">
                  <div className="text-4xl mb-2">❌</div>
                  <div className="text-lg font-medium">Screenshot Failed to Load</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 