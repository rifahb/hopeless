import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AntiCheat from "@/components/anti-cheat";
// import ScreenCapture from "@/components/screen-capture"; // Disabled in favor of Puppeteer
import ScreenShare from "@/components/screen-share";
import ScreenCaptureButton from "@/components/screen-capture-button";
import { useToast } from "@/hooks/use-toast";
import CountdownTimer from "@/components/countdown-timer";
import { QuestionList } from "@/components/QuestionList";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

function Codespace({ url }: { url: string }) {
  return (
    <iframe
      src={url}
      width="100%"
      height="700"
      style={{ border: "1px solid #ccc", borderRadius: "8px" }}
      title="Student Codespace"
    />
  );
}

const waitForCodespace = (url: string, timeout = 15000) => {
  return new Promise<boolean>((resolve) => {
    const start = Date.now();
    let settled = false;

    async function tryLoad() {
      if (Date.now() - start > timeout) {
        if (!settled) {
          settled = true;
          resolve(false);
        }
        return;
      }

      try {
        await fetch(url, { mode: "no-cors" });
        if (!settled) {
          settled = true;
          resolve(true);
        }
      } catch (err) {
        setTimeout(tryLoad, 1000);
      }
    }

    tryLoad();
  });
};

export default function StudentDashboard() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [subject, setSubject] = useState("JavaScript");
  const [codespaceUrl, setCodespaceUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<number | null>(null);
  const [code, setCode] = useState("");

  const handleLaunchCodespace = async () => {
    setIsLoading(true);
    const res = await fetch("/api/container/spin-up", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: subject, userId: user?.id })
    });

    const data = await res.json();
    const ready = await waitForCodespace(data.url);
    setIsLoading(false);

    if (ready) {
      setCodespaceUrl(data.url);
      toast({
        title: "🚀 Codespace Launched!",
        description: "Your coding environment is ready. Screenshots will be captured automatically via Puppeteer.",
      });
    } else {
      toast({
        title: "Codespace failed to start",
        description: "Timed out waiting for codespace to become available.",
        variant: "destructive",
      });
    }
  };

  const handleManualScreenshot = async () => {
    if (!codespaceUrl) {
      toast({
        title: "No Codespace Active",
        description: "Please launch a codespace first to capture a screenshot.",
        variant: "destructive",
      });
      return;
    }

    setIsCapturingScreenshot(true);
    
    try {
      const response = await fetch("/api/capture-screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          containerUrl: codespaceUrl
        })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "📸 Puppeteer Screenshot Captured!",
          description: `High-quality screenshot saved to MongoDB Atlas (${result.imageSize}KB). Real codespace content captured!`,
        });
      } else {
        toast({
          title: "Screenshot Failed",
          description: result.error || "Failed to capture screenshot via Puppeteer",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Manual screenshot error:", error);
      toast({
        title: "Screenshot Error",
        description: "Failed to communicate with the server",
        variant: "destructive",
      });
    } finally {
      setIsCapturingScreenshot(false);
    }
  };

  const handleDesktopCapture = async () => {
    setIsCapturingScreenshot(true);
    
    try {
      console.log('🖥️ Starting desktop capture request...');
      
      const response = await fetch("/api/capture-desktop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: `${subject}-desktop`
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('🖥️ Desktop capture response:', result);

      if (result.success) {
        toast({
          title: "🖥️ Desktop Screen Captured!",
          description: `Full desktop screenshot saved to MongoDB Atlas (${result.imageSize}KB). Entire screen captured!`,
        });
        console.log('✅ Desktop capture successful:', result.filename);
      } else {
        console.error('❌ Desktop capture failed:', result.error);
        toast({
          title: "Desktop Capture Failed",
          description: result.error || result.message || "Failed to capture desktop screen",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Desktop capture error:", error);
      
      let errorMessage = "Failed to communicate with the server";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      // Show more specific error messages
      if (errorMessage.includes('permissions')) {
        errorMessage = "Desktop capture requires screen sharing permissions. Please allow when prompted.";
      } else if (errorMessage.includes('not supported')) {
        errorMessage = "Desktop capture is not supported in this browser. Please use Chrome or Edge.";
      } else if (errorMessage.includes('network')) {
        errorMessage = "Network error - please check your connection and try again.";
      }
      
      toast({
        title: "Desktop Capture Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsCapturingScreenshot(false);
    }
  };

  const handleStartQuestion = async (questionId: number) => {
    try {
      const response = await fetch("/api/container/spin-up", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          language: "JavaScript", // Default to JavaScript for now
          userId: user?.id 
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to launch codespace");
      }

      const data = await response.json();
      const ready = await waitForCodespace(data.url);
      
      if (ready) {
        setCodespaceUrl(data.url);
        setSelectedQuestion(questionId);
        toast({
          title: "Success",
          description: "Codespace launched successfully",
        });
      } else {
        toast({
          title: "Error",
          description: "Codespace failed to start",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error launching codespace:", error);
      toast({
        title: "Error",
        description: "Failed to launch codespace",
        variant: "destructive",
      });
    }
  };

  const handleSubmitCode = async () => {
    if (!selectedQuestion) {
      toast({
        title: "Error",
        description: "No question selected",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("/api/codespace/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          questionId: selectedQuestion,
          code,
          codespaceUrl,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit code");
      }

      toast({
        title: "Success",
        description: "Code submitted successfully",
      });
      setCodespaceUrl(null);
      setSelectedQuestion(null);
      setCode("");
    } catch (error) {
      console.error("Error submitting code:", error);
      toast({
        title: "Error",
        description: "Failed to submit code",
        variant: "destructive",
      });
    }
  };

  // 🕒 20-minute session auto-expiry
  useEffect(() => {
    const timeout = setTimeout(() => {
      toast({
        title: "⏰ Session Expired",
        description: "Your 20-minute session has ended.",
        variant: "destructive"
      });

      logoutMutation.mutate(); // Force logout
    }, 20 * 60 * 1000); // 20 minutes

    return () => clearTimeout(timeout);
  }, []);

  // 📸 PERIODIC SCREENSHOT CAPTURE - Every 30 seconds when codespace is active
  useEffect(() => {
    if (!codespaceUrl) return;

    console.log('📸 Starting periodic screenshot capture (every 30 seconds)');
    
    const interval = setInterval(async () => {
      try {
        console.log('📸 Capturing periodic screenshot...');
        
        const response = await fetch("/api/capture-screenshot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject,
            containerUrl: codespaceUrl
          })
        });

        const result = await response.json();

        if (result.success) {
          console.log(`✅ Periodic screenshot captured: ${result.filename} (${result.imageSize}KB)`);
          // Optionally show a subtle notification (uncomment if desired)
          // toast({
          //   title: "📸 Activity Screenshot",
          //   description: `Periodic monitoring screenshot captured (${result.imageSize}KB)`,
          //   duration: 2000
          // });
        } else {
          console.error('❌ Periodic screenshot failed:', result.error);
        }
      } catch (error) {
        console.error('❌ Periodic screenshot error:', error);
      }
    }, 30000); // Every 30 seconds

    // Cleanup interval when codespace URL changes or component unmounts
    return () => {
      console.log('📸 Stopping periodic screenshot capture');
      clearInterval(interval);
    };
  }, [codespaceUrl, subject]);

  return (
    <div className="min-h-screen bg-white p-6">
      <AntiCheat userId={user?.id} />
      {/* 
        ScreenCapture component disabled - now using server-side Puppeteer
        <ScreenCapture 
          userId={user?.id} 
          isCodespaceActive={!!codespaceUrl}
          interval={15000}
        />
      */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Student Dashboard</h1>
        <Button onClick={() => logoutMutation.mutate()} variant="outline">
          Logout
        </Button>
      </div>

      {/* Questions Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Available Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <QuestionList onStartQuestion={handleStartQuestion} />
        </CardContent>
      </Card>

      {/* Session Timer */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Session Timer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-center">
            <CountdownTimer initialTime={1200} className="text-lg font-mono text-red-600" />
          </div>
        </CardContent>
      </Card>

      {/* Codespace Dialog */}
      {codespaceUrl && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-10">
          <div className="bg-white rounded-lg w-[95%] h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-bold">Coding Environment</h2>
              <div className="flex gap-2">
                <Select
                  value={subject}
                  onValueChange={setSubject}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="javascript">JavaScript</SelectItem>
                    <SelectItem value="python">Python</SelectItem>
                    <SelectItem value="java">Java</SelectItem>
                    <SelectItem value="cpp">C++</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSubmitCode}
                >
                  Submit Code
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCodespaceUrl(null)}
                >
                  Close
                </Button>
              </div>
            </div>
            <div className="flex-1 p-4">
              <iframe
                src={codespaceUrl}
                className="w-full h-full border-0 rounded-lg"
                title="Codespace"
              />
            </div>
            <div className="p-4 border-t">
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Paste your code here..."
                className="w-full h-40 p-4 border rounded-lg font-mono text-sm"
              />
            </div>
          </div>
        </div>
      )}

      <div className="bg-gray-100 p-4 rounded-lg shadow-sm mb-6 flex items-center justify-between">
        <div className="flex items-center justify-end">
          <p className="mr-2 text-sm font-semibold text-gray-700">Session Timer:</p>
          <CountdownTimer initialTime={1200} className="text-lg font-mono text-red-600" />
        </div>

        <div className="w-64">
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="JavaScript">JavaScript</SelectItem>
              <SelectItem value="Python">Python</SelectItem>
              <SelectItem value="Java">Java</SelectItem>
              <SelectItem value="C++">C++</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleLaunchCodespace} disabled={isLoading}>
          {isLoading ? "Launching..." : "Launch Codespace"}
        </Button>
      </div>

      {/* Enhanced Monitoring with Puppeteer */}
      <div className="bg-green-50 border border-green-200 p-4 rounded-lg shadow-sm mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">📸 Enhanced Monitoring with Puppeteer</h3>
        <p className="text-sm text-gray-600 mb-4">
          Your activity is monitored using high-quality server-side screenshots. 
          You can capture either your codespace content or your entire desktop screen.
          Screenshots are automatically captured on code submission.
        </p>
        
        {/* Manual Puppeteer Screenshot */}
        <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Button 
              onClick={handleManualScreenshot}
              disabled={!codespaceUrl || isCapturingScreenshot}
              className="bg-blue-600 hover:bg-blue-700 text-white w-full"
            >
              {isCapturingScreenshot ? (
                <>
                  <span className="animate-spin mr-2">📸</span>
                  Capturing...
                </>
              ) : (
                <>
                  📸 Capture Codespace
                </>
              )}
            </Button>
            <p className="text-xs text-green-600 mt-1 font-medium">
              ✅ Captures VS Code editor content
            </p>
          </div>
          
          <div>
            <Button 
              onClick={handleDesktopCapture}
              disabled={isCapturingScreenshot}
              className="bg-purple-600 hover:bg-purple-700 text-white w-full"
            >
              {isCapturingScreenshot ? (
                <>
                  <span className="animate-spin mr-2">🖥️</span>
                  Capturing...
                </>
              ) : (
                <>
                  🖥️ Capture Full Desktop
                </>
              )}
            </Button>
            <p className="text-xs text-purple-600 mt-1 font-medium">
              ✅ Captures entire screen (everything visible)
            </p>
          </div>
        </div>
        
        {/* Features List */}
        <div className="bg-white bg-opacity-50 p-3 rounded border">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">📋 Monitoring Features:</h4>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>✅ Automatic screenshot on code submission</li>
            <li className={codespaceUrl ? "text-green-700 font-medium" : ""}>
              {codespaceUrl ? "🔴 ACTIVE:" : "⚪"} Periodic screenshots every 30 seconds
            </li>
            <li>✅ Real codespace content capture (not placeholders)</li>
            <li>✅ High-quality 1920x1080 screenshots</li>
            <li>✅ Stored securely in MongoDB Atlas</li>
            <li>✅ Handles code-server authentication automatically</li>
          </ul>
          {codespaceUrl && (
            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
              <strong className="text-yellow-700">🔴 Live Monitoring Active:</strong>
              <span className="text-yellow-600 ml-1">
                Screenshots are being captured every 30 seconds and stored in MongoDB Atlas for admin review.
              </span>
            </div>
          )}
        </div>
        
        {/* Screen Share Controls - Show when codespace is active */}
        {codespaceUrl && (
          <div className="mt-4">
            <ScreenShare 
              userId={user?.id}
              onShareStart={() => setIsScreenSharing(true)}
              onShareEnd={() => setIsScreenSharing(false)}
            />
            {isScreenSharing && (
              <div className="mt-2 text-sm text-green-600 font-medium">
                ✅ Screen sharing is active - instructor can see your screen in real-time
              </div>
            )}
          </div>
        )}
      </div>

      <Tabs defaultValue="coding">
        <TabsList>
          <TabsTrigger value="coding">Coding Assignment</TabsTrigger>
          <TabsTrigger value="scores">Past Scores</TabsTrigger>
        </TabsList>

        <TabsContent value="coding">
          {/* Existing coding content */}
        </TabsContent>

        <TabsContent value="scores">
          {/* Existing scores content */}
        </TabsContent>
      </Tabs>
    </div>
  );
}
