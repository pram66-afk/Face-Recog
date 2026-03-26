/**
 * CameraManager Utility for Android-Safe Stream Management.
 * This class handles the safe release of camera hardware before switching modes
 * to prevent [NotReadableError: Camera already in use] on mobile devices.
 */
export class CameraManager {
  private static activeStream: MediaStream | null = null;
  private static activeTrack: MediaStreamTrack | null = null;

  /**
   * Safely stops all active camera tracks to release the hardware.
   */
  static async stopActiveStream(): Promise<void> {
    if (this.activeStream) {
      console.log("[CameraManager] Releasing active stream tracks...");
      this.activeStream.getTracks().forEach(track => {
        track.stop();
        console.log(`[CameraManager] Track stopped: ${track.label}`);
      });
      this.activeStream = null;
      this.activeTrack = null;
    }
    // Small delay to ensure the OS kernel has released the lock
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  /**
   * Requests a new video stream for a specific purpose (QR or Face).
   * @param facingMode "user" for front camera, "environment" for back camera.
   */
  static async startStream(facingMode: "user" | "environment" = "environment"): Promise<MediaStream> {
    // 1. Release anything currently running
    await this.stopActiveStream();

    // 2. Request new hardware access
    console.log(`[CameraManager] Requesting ${facingMode} camera...`);
    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.activeStream = stream;
      this.activeTrack = stream.getVideoTracks()[0];
      return stream;
    } catch (err) {
      console.error("[CameraManager] Hardware access failed:", err);
      // Fallback for older devices/desktops
      const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
      this.activeStream = fallbackStream;
      return fallbackStream;
    }
  }

  /**
   * Captures a still frame from a video element and returns a base64 string.
   */
  static captureFrame(video: HTMLVideoElement): string {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    
    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Low quality for faster transfer
    return canvas.toDataURL('image/jpeg', 0.6);
  }
}
