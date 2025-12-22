import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { BrowserMultiFormatReader } from '@zxing/library';

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

  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);

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

      // Request camera permission first
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
      } catch (permissionError) {
        if (permissionError instanceof Error) {
          if (permissionError.name === 'NotAllowedError' || permissionError.name === 'PermissionDeniedError') {
            throw new Error('Camera permission denied. Please allow camera access in your browser settings.');
          } else if (permissionError.name === 'NotFoundError' || permissionError.name === 'DevicesNotFoundError') {
            throw new Error('No camera found. Please connect a camera and try again.');
          } else if (permissionError.name === 'NotReadableError' || permissionError.name === 'TrackStartError') {
            throw new Error('Camera is already in use by another application.');
          }
        }
        throw new Error('Failed to access camera. Please check your camera permissions.');
      }

      const videoInputDevices = await codeReader.listVideoInputDevices();
      
      if (!videoInputDevices || videoInputDevices.length === 0) {
        throw new Error('No camera devices found. Please connect a camera and refresh the page.');
      }

      const selectedDeviceId = videoInputDevices[0]?.deviceId;

      if (!selectedDeviceId) {
        throw new Error('No camera found. Please connect a camera and try again.');
      }

      await codeReader.decodeFromVideoDevice(
        selectedDeviceId,
        videoRef.current,
        async (result, err) => {
          if (result) {
            const studentNumber = result.getText();
            await handleScan(studentNumber);
            // Continue scanning
          }
          if (err && err.name !== 'NotFoundException') {
            // NotFoundException is normal when no barcode is visible
            console.error('Scan error:', err);
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
    setScanning(false);
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
        setTimeout(() => setSuccess(''), 2000);
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
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <h1 className="text-xl font-bold">Scanner Dashboard</h1>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">Welcome, {user?.username}</span>
                <button
                  onClick={logout}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </nav>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h2 className="text-2xl font-semibold mb-6">Select a Session</h2>

          {sessions.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
              No assigned sessions available. Please contact an administrator.
            </div>
          ) : (
            <div className="grid gap-4">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-md transition"
                  onClick={() => setSelectedSession(session)}
                >
                  <h3 className="text-lg font-semibold mb-2">{session.title}</h3>
                  {session.notes && (
                    <p className="text-sm text-gray-600 mb-2">{session.notes}</p>
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

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-xl font-bold">Scanner Dashboard</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">{selectedSession.title}</span>
              <span className="text-sm font-medium text-blue-600">
                Scans: {scanCount}
              </span>
              <button
                onClick={logout}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            {success}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Camera Scanner</h2>
          <div className="mb-4">
              <video
                ref={videoRef}
                className="w-full max-w-md mx-auto rounded-lg border-2 border-gray-300"
                style={{ display: scanning ? 'block' : 'none' }}
              />
              {!scanning && (
                <div className="w-full max-w-md mx-auto h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                  <p className="text-gray-500">Camera preview will appear here</p>
                </div>
              )}
          </div>
          <div className="flex gap-4 justify-center">
            {!scanning ? (
              <button
                onClick={startScanning}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
              >
                Start Camera Scan
              </button>
            ) : (
              <button
                onClick={stopScanning}
                className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 font-medium"
              >
                Stop Scanning
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Manual Input</h2>
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Enter student number"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 font-medium"
            >
              Submit
            </button>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Recent Scans</h2>
            <button
              onClick={finishSession}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
            >
              Finish Session
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
              {scans.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No scans yet</p>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Student Number
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Scanned At
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {scans.map((scan) => (
                      <tr key={scan.id}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                          {scan.scanned_student_number}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {new Date(scan.scanned_at).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}

