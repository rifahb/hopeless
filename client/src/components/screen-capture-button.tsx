import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Monitor, Camera, AlertCircle } from "lucide-react";

interface ScreenCaptureButtonProps {
  onPermissionGranted?: () => void;
}

export default function ScreenCaptureButton({ onPermissionGranted }: ScreenCaptureButtonProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [hasPermission, setHasPermission] = useState(() => {
    // Check if permission was previously granted
    return localStorage.getItem('screenCapturePermissionGranted') === 'true';
  });
  const [error, setError] = useState<string | null>(null);

  const requestScreenCapture = async () => {
    setIsCapturing(true);
    setError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error('Screen Capture API not supported in this browser');
      }

      console.log('🖥️ Requesting screen capture permission...');
      
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          mediaSource: 'screen',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } as any
      });

      // Stop the stream immediately - we just needed permission
      stream.getTracks().forEach(track => track.stop());
      
      setHasPermission(true);
      localStorage.setItem('screenCapturePermissionGranted', 'true');
      console.log('✅ Screen capture permission granted!');
      
      if (onPermissionGranted) {
        onPermissionGranted();
      }

    } catch (error: any) {
      console.error('❌ Screen capture permission denied:', error);
      
      if (error.name === 'NotAllowedError') {
        setError('Screen capture permission denied. Please allow screen sharing for better screenshots.');
      } else if (error.name === 'NotSupportedError') {
        setError('Screen capture not supported in this browser.');
      } else {
        setError('Failed to request screen capture permission.');
      }
    } finally {
      setIsCapturing(false);
    }
  };

  if (hasPermission) {
    return (
      <div className="flex items-center gap-2 text-green-600 text-sm">
        <Camera className="h-4 w-4" />
        <span>Enhanced screenshot capture enabled</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <Monitor className="h-5 w-5 text-blue-600 mt-0.5" />
        <div className="text-sm">
          <div className="font-medium text-blue-900">Improve Screenshot Quality</div>
          <p className="text-blue-700 mt-1">
            Grant screen capture permission to capture codespace content in screenshots.
            This enables real screen capture instead of DOM-based capture.
          </p>
        </div>
      </div>

      <Button 
        onClick={requestScreenCapture}
        disabled={isCapturing}
        className="w-full"
        variant="outline"
      >
        {isCapturing ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent mr-2" />
            Requesting Permission...
          </>
        ) : (
          <>
            <Monitor className="h-4 w-4 mr-2" />
            Enable Enhanced Screenshots
          </>
        )}
      </Button>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      <div className="text-xs text-gray-500">
        <strong>Note:</strong> This is optional. Screenshots will work without this permission, 
        but iframe content (like codespaces) may not be captured properly.
      </div>
    </div>
  );
} 