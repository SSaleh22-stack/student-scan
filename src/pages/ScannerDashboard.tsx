import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from '@zxing/library';

interface Session {
  id: string;
  title: string;
  notes: string | null;
  created_at: string;
  is_open: boolean;
}

interface Scan {
  id: string;
  scanned_student_number: string;
  scanned_at: string;
}

export default function ScannerDashboard() {
  const { user, logout } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [scanning, setScanning] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [scanCount, setScanCount] = useState(0);
  const [showScanResult, setShowScanResult] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (selectedSession) {
      loadScans();
      const interval = setInterval(loadScans, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [selectedSession]);

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  const loadSessions = async () => {
    try {
      const res = await fetch('/api/scanner/sessions', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json() as { sessions: Session[] };
        setSessions(data.sessions);
      }
    } catch (err) {
      setError('Failed to load sessions');
    }
  };

  const loadScans = async () => {
    if (!selectedSession) return;

    try {
      const res = await fetch(`/api/scanner/sessions/${selectedSession.id}/scans`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json() as { scans: Scan[] };
        setScans(data.scans);
        setScanCount(data.scans.length);
      }
    } catch (err) {
      // Silent fail for background refresh
    }
  };

  const startScanning = async () => {
    if (!selectedSession) {
      setError('Please select a session first');
      return;
    }

    if (!videoRef.current) {
      setError('Video element not available');
      return;
    }

    // Check if browser supports camera API
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Camera API not supported. Please use a modern browser with HTTPS.');
      return;
    }

    try {
      setScanning(true);
      setError('');
      setSuccess('');

      const codeReader = new BrowserMultiFormatReader();
      codeReaderRef.current = codeReader;

      // First, enumerate all cameras to find the rear camera
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      // Find rear camera by device label
      let rearCameraDeviceId: string | null = null;
      for (const device of videoDevices) {
        const label = device.label.toLowerCase();
        // Check for rear camera indicators
        if (label.includes('back') || 
            label.includes('rear') || 
            label.includes('environment') ||
            label.includes('facing back') ||
            label.includes('facing: back') ||
            label.includes('back camera') ||
            (label.includes('camera') && !label.includes('front') && !label.includes('user'))) {
          rearCameraDeviceId = device.deviceId;
          break;
        }
      }
      
      // If no rear camera found by label, try to get it by facingMode constraint
      let stream: MediaStream | null = null;
      let videoTrack: MediaStreamTrack | null = null;
      
      try {
        // Try to get rear camera with explicit device ID if found
        if (rearCameraDeviceId) {
          try {
            const constraints: MediaStreamConstraints = {
              video: {
                deviceId: { exact: rearCameraDeviceId },
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: { ideal: 30 }
              }
            };
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            videoTrack = stream.getVideoTracks()[0];
          } catch (e) {
            // If exact device ID fails, try with ideal
            const constraints: MediaStreamConstraints = {
              video: {
                deviceId: { ideal: rearCameraDeviceId },
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: { ideal: 30 }
              }
            };
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            videoTrack = stream.getVideoTracks()[0];
          }
        }
        
        // If rear camera by ID failed, try facingMode
        if (!stream || !videoTrack) {
          const constraints: MediaStreamConstraints = {
            video: {
              facingMode: { exact: 'environment' }, // Force rear camera
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              frameRate: { ideal: 30 }
            }
          };
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          videoTrack = stream.getVideoTracks()[0];
        }
      } catch (permissionError) {
        // If exact rear camera fails, try ideal
        try {
          const constraints: MediaStreamConstraints = {
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              frameRate: { ideal: 30 }
            }
          };
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          videoTrack = stream.getVideoTracks()[0];
        } catch (fallbackError) {
          if (permissionError instanceof Error) {
            if (permissionError.name === 'NotAllowedError' || permissionError.name === 'PermissionDeniedError') {
              throw new Error('Camera permission denied. Please allow camera access in your browser settings.');
            } else if (permissionError.name === 'NotFoundError' || permissionError.name === 'DevicesNotFoundError') {
              throw new Error('No camera found. Please connect a camera and try again.');
            } else if (permissionError.name === 'NotReadableError' || permissionError.name === 'TrackStartError') {
              throw new Error('Camera is already in use by another application.');
            }
          }
          throw new Error('Failed to access camera. Please check your camera permissions and try again.');
        }
      }
      
      if (!stream || !videoTrack) {
        throw new Error('Failed to access camera. Please try again.');
      }
      
      streamRef.current = stream;
      
      // Get camera capabilities and apply maximum quality
      const capabilities = videoTrack.getCapabilities() as any;
      
      // Apply maximum quality settings
      try {
        const qualityConstraints: MediaTrackConstraints = {
          width: capabilities.width?.max ? { ideal: capabilities.width.max } : { ideal: 1920 },
          height: capabilities.height?.max ? { ideal: capabilities.height.max } : { ideal: 1080 },
          frameRate: capabilities.frameRate?.max ? { ideal: capabilities.frameRate.max } : { ideal: 30 }
        };
        
        await videoTrack.applyConstraints(qualityConstraints);
      } catch (e) {
        // If max quality fails, try high quality defaults
        try {
          await videoTrack.applyConstraints({
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 }
          });
        } catch (e2) {
          // Continue with default quality
        }
      }
      
      // Enable continuous autofocus and optimize exposure/white balance
      try {
        const advancedSettings: any = {
          focusMode: 'continuous'
        };
        
        // Add exposure and white balance if supported
        if (capabilities.exposureMode && capabilities.exposureMode.includes('continuous')) {
          advancedSettings.exposureMode = 'continuous';
        }
        if (capabilities.whiteBalanceMode && capabilities.whiteBalanceMode.includes('continuous')) {
          advancedSettings.whiteBalanceMode = 'continuous';
        }
        
        await videoTrack.applyConstraints({
          advanced: [advancedSettings]
        });
      } catch (focusError) {
        // Focus/exposure not supported, continue without it
      }
      
      // Attach stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      
      // Wait for video to initialize
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get device ID from the active track
      const settings = videoTrack.getSettings();
      const selectedDeviceId = settings.deviceId as string;

      if (!selectedDeviceId) {
        throw new Error('Could not determine camera device. Please try again.');
      }

      // Configure for maximum barcode detection with aggressive settings
      const hints = new Map();
      hints.set(DecodeHintType.TRY_HARDER, true); // Enable for better detection quality
      hints.set(DecodeHintType.ASSUME_GS1, false);
      hints.set(DecodeHintType.CHARACTER_SET, 'UTF-8');
      // Allow surrounding content for better detection
      hints.set(DecodeHintType.PURE_BARCODE, false);
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.CODE_128,  // Most common, check first
        BarcodeFormat.CODE_39,
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.ITF,
        BarcodeFormat.CODABAR,
        BarcodeFormat.QR_CODE,
        BarcodeFormat.DATA_MATRIX,
        BarcodeFormat.PDF_417,
        BarcodeFormat.AZTEC
      ]);
      
      // Set hints for maximum detection capability
      codeReader.hints = hints;
      
      // Much slower scanning interval for maximum detection of difficult barcodes
      // More time per frame = better analysis and multiple attempts
      (codeReader as any).timeBetweenDecodingAttempts = 500;

      // Use continuous scanning optimized for fast multiple scans
      let lastScannedNumber = '';
      let scanCooldown = false;
      
      // Use decodeFromVideoDevice with the selected device ID for better detection
      await codeReader.decodeFromVideoDevice(
        selectedDeviceId,
        videoRef.current,
        async (result: any, err: any) => {
          if (result) {
            const studentNumber = result.getText();
            
            // Prevent duplicate scans within 1 second
            if (studentNumber === lastScannedNumber && scanCooldown) {
              return;
            }
            
            lastScannedNumber = studentNumber;
            scanCooldown = true;
            setTimeout(() => {
              scanCooldown = false;
              lastScannedNumber = '';
            }, 1000);
            
            // Play sound immediately
            playScanSound();
            // Show popup with result
            setLastScanned(studentNumber);
            setShowScanResult(true);
            // Auto-hide popup after 1.5 seconds for faster scanning
            setTimeout(() => {
              setShowScanResult(false);
            }, 1500);
            // Process the scan (non-blocking)
            handleScan(studentNumber).catch(() => {
              // Silent error handling - don't block scanning
            });
            // Continue scanning immediately
          }
          if (err && err.name !== 'NotFoundException') {
            // NotFoundException is normal when no barcode is visible - ignore it
          }
        }
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start camera';
      setError(errorMessage);
      setScanning(false);
      // Stop any ongoing scanning
      if (codeReaderRef.current) {
        codeReaderRef.current.reset();
        codeReaderRef.current = null;
      }
    }
  };

  const stopScanning = () => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
      codeReaderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  };

  const handleVideoClick = async (e: React.MouseEvent<HTMLVideoElement>) => {
    // Tap-to-focus functionality
    if (!videoRef.current || !streamRef.current) return;

    const videoTrack = streamRef.current.getVideoTracks()[0];
    
    if (!videoTrack || !videoTrack.getCapabilities) return;

    try {
      const capabilities = videoTrack.getCapabilities() as any;
      
      // Check if focus is supported
      if (capabilities.focusMode && capabilities.focusMode.includes('manual')) {
        // Try to set focus point (if supported)
        if (videoTrack.applyConstraints) {
          try {
            await videoTrack.applyConstraints({
              advanced: [
                { focusMode: 'single-shot' } as any
              ]
            });
            
            // Show focus indicator
            showFocusIndicator(e.clientX, e.clientY);
            
            // Switch back to continuous after a moment
            setTimeout(async () => {
              try {
                await videoTrack.applyConstraints({
                  advanced: [
                    { focusMode: 'continuous' } as any
                  ]
                });
              } catch (e) {
                // Ignore errors
              }
            }, 1000);
          } catch (focusError) {
            console.log('Focus adjustment not supported:', focusError);
          }
        }
      }
    } catch (err) {
      console.log('Focus not available:', err);
    }
  };

  const showFocusIndicator = (x: number, y: number) => {
    // Create a temporary focus indicator
    const indicator = document.createElement('div');
    indicator.style.position = 'fixed';
    indicator.style.left = `${x - 20}px`;
    indicator.style.top = `${y - 20}px`;
    indicator.style.width = '40px';
    indicator.style.height = '40px';
    indicator.style.border = '2px solid #10b981';
    indicator.style.borderRadius = '50%';
    indicator.style.pointerEvents = 'none';
    indicator.style.zIndex = '1000';
    indicator.style.animation = 'pulse 0.5s ease-out';
    document.body.appendChild(indicator);

    setTimeout(() => {
      indicator.remove();
    }, 500);
  };

  const playScanSound = () => {
    // Create a beep sound using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800; // Higher pitch for success
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  };

  const handleScan = async (studentNumber: string) => {
    if (!selectedSession) return;

    try {
      const res = await fetch(`/api/scanner/sessions/${selectedSession.id}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ scanned_student_number: studentNumber }),
      });

      let data: { error?: string; scanned?: boolean } = {};
      const text = await res.text();
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          // Not JSON, use default error
        }
      }

      if (res.ok) {
        setSuccess(`Scanned: ${studentNumber}`);
        setError('');
        loadScans();
        // Don't clear success message here - let the popup handle it
      } else if (res.status === 409) {
        setError(`Already scanned: ${studentNumber}`);
        setTimeout(() => setError(''), 3000);
      } else {
        setError(data.error || 'Failed to record scan');
        setTimeout(() => setError(''), 3000);
      }
    } catch (err) {
      setError('Failed to record scan');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;

    await handleScan(manualInput.trim());
    setManualInput('');
  };

  const finishSession = () => {
    stopScanning();
    setSelectedSession(null);
    setScans([]);
    setScanCount(0);
    setError('');
    setSuccess('');
  };

  if (!selectedSession) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
            <div className="flex justify-between h-14 sm:h-16 items-center">
              <h1 className="text-lg sm:text-xl font-bold">Scanner Dashboard</h1>
              <div className="flex items-center gap-2 sm:gap-4">
                <span className="text-xs sm:text-sm text-gray-600 hidden sm:inline">Welcome, {user?.username}</span>
                <button
                  onClick={logout}
                  className="text-xs sm:text-sm text-red-600 hover:text-red-700 px-2 sm:px-0 py-1 sm:py-0"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </nav>

        <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-8">
          <h2 className="text-xl sm:text-2xl font-semibold mb-4 sm:mb-6">Select a Session</h2>

          {sessions.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-3 sm:px-4 py-2 sm:py-3 rounded text-sm">
              No assigned sessions available. Please contact an administrator.
            </div>
          ) : (
            <div className="grid gap-3 sm:gap-4">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="bg-white rounded-lg shadow p-4 sm:p-6 cursor-pointer hover:shadow-md transition"
                  onClick={() => setSelectedSession(session)}
                >
                  <h3 className="text-base sm:text-lg font-semibold mb-2">{session.title}</h3>
                  {session.notes && (
                    <p className="text-xs sm:text-sm text-gray-600 mb-2">{session.notes}</p>
                  )}
                  <p className="text-xs text-gray-500">
                    Created: {new Date(session.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Full-screen scanning view
  if (scanning) {
    return (
      <div className="fixed inset-0 bg-black z-50">
        <div className="relative w-full h-full flex flex-col">
          {/* Top bar with session info and stop button */}
          <div className="absolute top-0 left-0 right-0 z-10 bg-black bg-opacity-50 text-white p-3 sm:p-4">
            <div className="flex justify-between items-center">
              <div className="flex-1 min-w-0 pr-2">
                <h2 className="text-sm sm:text-lg font-bold truncate">{selectedSession?.title}</h2>
                <p className="text-xs sm:text-sm text-gray-300">Scans: {scanCount} | Tap screen to focus</p>
              </div>
              <button
                onClick={stopScanning}
                className="bg-red-600 text-white px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg hover:bg-red-700 font-medium text-xs sm:text-sm whitespace-nowrap"
              >
                Stop
              </button>
            </div>
          </div>

          {/* Video with scanning overlay */}
          <div className="flex-1 relative flex items-center justify-center">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
              onClick={handleVideoClick}
              style={{ 
                cursor: 'pointer',
                // Enhance contrast and brightness for better barcode detection
                filter: 'contrast(1.2) brightness(1.1) saturate(1.1)'
              }}
            />
            {/* Scanning line overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              {/* Scanning line */}
              <div 
                className="w-full h-1 bg-green-500 opacity-75 animate-pulse" 
                style={{
                  boxShadow: '0 0 20px rgba(34, 197, 94, 0.9)'
                }}
              ></div>
              {/* Corner guides */}
              <div 
                className="absolute inset-0 border-4 border-green-500" 
                style={{
                  borderStyle: 'dashed',
                  opacity: 0.7
                }}
              ></div>
            </div>
          </div>

          {/* Scan Result Popup */}
          {showScanResult && lastScanned && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black bg-opacity-70 p-4">
              <div className="bg-white rounded-lg shadow-xl p-4 sm:p-8 max-w-md w-full mx-4 animate-bounce">
                <div className="text-center">
                  <div className="mb-3 sm:mb-4">
                    <svg className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg sm:text-2xl font-bold text-gray-800 mb-2">Scan Successful!</h3>
                  <p className="text-sm sm:text-lg text-gray-600 mb-1">Student Number:</p>
                  <p className="text-2xl sm:text-3xl font-bold text-blue-600 mb-3 sm:mb-4 break-all">{lastScanned}</p>
                  <p className="text-xs sm:text-sm text-gray-500">Continue scanning...</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex justify-between h-14 sm:h-16 items-center">
            <h1 className="text-lg sm:text-xl font-bold">Scanner Dashboard</h1>
            <div className="flex items-center gap-2 sm:gap-4">
              <span className="text-xs sm:text-sm text-gray-600 hidden sm:inline">{selectedSession.title}</span>
              <span className="text-xs sm:text-sm font-medium text-blue-600">
                Scans: {scanCount}
              </span>
              <button
                onClick={logout}
                className="text-xs sm:text-sm text-red-600 hover:text-red-700 px-2 sm:px-0 py-1 sm:py-0"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-8">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2 sm:py-3 rounded text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-3 sm:px-4 py-2 sm:py-3 rounded text-sm">
            {success}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-4">Camera Scanner</h2>
          <div className="mb-4">
            <div className="relative w-full max-w-md mx-auto">
              <video
                ref={videoRef}
                className="w-full rounded-lg border-2 border-gray-300"
                style={{ display: scanning ? 'block' : 'none' }}
              />
              {scanning && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  {/* Scanning line overlay */}
                  <div 
                    className="w-full h-1 bg-green-500 opacity-75 animate-pulse" 
                    style={{
                      boxShadow: '0 0 10px rgba(34, 197, 94, 0.8)'
                    }}
                  ></div>
                  {/* Corner guides */}
                  <div 
                    className="absolute inset-0 border-2 border-green-500 rounded-lg" 
                    style={{
                      borderStyle: 'dashed',
                      borderWidth: '2px',
                      opacity: 0.6
                    }}
                  ></div>
                </div>
              )}
              {!scanning && (
                <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                  <p className="text-gray-500">Camera preview will appear here</p>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-4 justify-center">
            <button
              onClick={startScanning}
              className="bg-blue-600 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg hover:bg-blue-700 font-medium text-sm sm:text-base w-full sm:w-auto"
            >
              Start Camera Scan
            </button>
          </div>
        </div>

        {/* Scan Result Popup */}
        {showScanResult && lastScanned && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-4 sm:p-8 max-w-md w-full mx-4 animate-bounce">
              <div className="text-center">
                <div className="mb-3 sm:mb-4">
                  <svg className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg sm:text-2xl font-bold text-gray-800 mb-2">Scan Successful!</h3>
                <p className="text-sm sm:text-lg text-gray-600 mb-1">Student Number:</p>
                <p className="text-2xl sm:text-3xl font-bold text-blue-600 mb-3 sm:mb-4 break-all">{lastScanned}</p>
                <p className="text-xs sm:text-sm text-gray-500">Continue scanning...</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-4">Manual Input</h2>
          <form onSubmit={handleManualSubmit} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Enter student number"
              className="flex-1 px-3 sm:px-4 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="bg-green-600 text-white px-4 py-2.5 sm:py-2 rounded-lg hover:bg-green-700 font-medium text-sm sm:text-base"
            >
              Scan Manually
            </button>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
            <h2 className="text-lg sm:text-xl font-semibold">Recent Scans ({scanCount})</h2>
            <button
              onClick={finishSession}
              className="bg-gray-600 text-white px-3 sm:px-4 py-2 text-xs sm:text-sm rounded-lg hover:bg-gray-700 font-medium w-full sm:w-auto"
            >
              Finish Session
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
              {scans.length === 0 ? (
                <p className="text-sm sm:text-base text-gray-500 text-center py-8">No scans yet for this session.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Student Number
                        </th>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Scanned At
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {scans.map((scan) => (
                        <tr key={scan.id}>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">
                            {scan.scanned_student_number}
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                            {new Date(scan.scanned_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}

