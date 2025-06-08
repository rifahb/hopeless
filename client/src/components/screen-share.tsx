import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ScreenShareProps {
  userId?: number;
  onShareStart?: () => void;
  onShareEnd?: () => void;
}

export default function ScreenShare({ userId, onShareStart, onShareEnd }: ScreenShareProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();

  const startScreenShare = async () => {
    try {
      setShareError(null);
      
      // Request screen capture
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          mediaSource: 'screen',
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 10, max: 15 } // Lower frame rate to reduce bandwidth
        },
        audio: true // Include system audio if available
      });

      streamRef.current = stream;
      
      // Show preview video
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Log screen share start
      await apiRequest("POST", "/api/log/screen-share", {
        userId,
        action: "start",
        timestamp: new Date().toISOString(),
        streamInfo: {
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
          streamId: stream.id
        }
      });

      setIsSharing(true);
      onShareStart?.();

      // Handle stream end (user stops sharing)
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        stopScreenShare();
      });

      toast({
        title: "Screen Sharing Started",
        description: "Your screen is now being shared with the instructor",
      });

    } catch (error) {
      console.error("Error starting screen share:", error);
      let errorMessage = "Failed to start screen sharing";
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = "Screen sharing permission denied";
        } else if (error.name === 'NotSupportedError') {
          errorMessage = "Screen sharing not supported in this browser";
        } else {
          errorMessage = error.message;
        }
      }
      
      setShareError(errorMessage);
      toast({
        title: "Screen Share Failed",
        description: errorMessage,
        variant: "destructive"
      });

      // Log error
      await apiRequest("POST", "/api/log/screen-share", {
        userId,
        action: "error",
        timestamp: new Date().toISOString(),
        error: errorMessage
      });
    }
  };

  const stopScreenShare = async () => {
    try {
      if (streamRef.current) {
        // Stop all tracks
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      // Log screen share end
      await apiRequest("POST", "/api/log/screen-share", {
        userId,
        action: "stop",
        timestamp: new Date().toISOString()
      });

      setIsSharing(false);
      setShareError(null);
      onShareEnd?.();

      toast({
        title: "Screen Sharing Stopped",
        description: "Screen sharing has been ended",
      });

    } catch (error) {
      console.error("Error stopping screen share:", error);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className="screen-share-controls">
      <div className="flex items-center gap-4 mb-4">
        <Button
          onClick={isSharing ? stopScreenShare : startScreenShare}
          variant={isSharing ? "destructive" : "default"}
          className={isSharing ? "animate-pulse" : ""}
        >
          {isSharing ? "🛑 Stop Sharing" : "📺 Share Screen"}
        </Button>
        
        {isSharing && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            Screen sharing active
          </div>
        )}
      </div>

      {shareError && (
        <div className="text-red-600 text-sm mb-4 p-2 bg-red-50 rounded">
          ⚠️ {shareError}
        </div>
      )}

      {isSharing && (
        <div className="screen-share-preview">
          <p className="text-sm text-gray-600 mb-2">Screen Share Preview:</p>
          <video
            ref={videoRef}
            autoPlay
            muted
            className="w-full max-w-md border rounded shadow"
            style={{ maxHeight: "200px" }}
          />
          <p className="text-xs text-gray-500 mt-1">
            This preview shows what's being shared. The instructor can see your screen in real-time.
          </p>
        </div>
      )}
    </div>
  );
} 