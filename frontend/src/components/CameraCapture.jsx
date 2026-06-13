// ---------------------------------------------------------------------------
// Camera capture (Task D). Opens the device camera via getUserMedia, shows a
// live preview, and snapshots a frame to a JPEG data URL on demand. Falls back
// gracefully (with a clear message) when the camera is unavailable or the user
// denies permission — the file-upload path always remains available in App.
//
// It returns the snapshot as a base64 data URL through onCapture, matching the
// same shape the file-upload path produces, so the pipeline is identical.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';

export default function CameraCapture({ onCapture, onClose, disabled }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState('starting'); // starting|live|error
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('error');
        setError('Camera is not supported in this browser. Upload a photo instead.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setStatus('live');
      } catch (e) {
        if (cancelled) return;
        setStatus('error');
        setError(
          e?.name === 'NotAllowedError'
            ? 'Camera permission denied. Upload a photo instead.'
            : 'Could not start the camera. Upload a photo instead.'
        );
      }
    }

    start();
    return () => {
      cancelled = true;
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopStream() {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  function snapshot() {
    const video = videoRef.current;
    if (!video || status !== 'live') return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    stopStream();
    onCapture(dataUrl);
  }

  function handleClose() {
    stopStream();
    onClose();
  }

  return (
    <div className="camera">
      <div className="camera-stage">
        {status === 'error' ? (
          <p className="state state-warn camera-fallback" role="alert">
            {error}
          </p>
        ) : (
          <video
            ref={videoRef}
            className="camera-video"
            playsInline
            muted
            aria-label="Live camera preview"
          />
        )}
        {status === 'starting' && (
          <p className="state camera-overlay">Starting camera…</p>
        )}
      </div>
      <div className="camera-controls">
        <button
          type="button"
          className="btn"
          onClick={snapshot}
          disabled={disabled || status !== 'live'}
        >
          Take photo
        </button>
        <button type="button" className="btn btn-ghost" onClick={handleClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
