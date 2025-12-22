import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

interface User {
  id: string;
  username: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface Session {
  id: string;
  title: string;
  notes: string | null;
  created_by: string;
  created_by_username: string;
  created_at: string;
  is_open: boolean;
}

interface Scan {
  id: string;
  scanned_student_number: string;
  scanned_by_username: string;
  scanned_at: string;
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'sessions' | 'session-detail'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Modal states
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showCreateSessionModal, setShowCreateSessionModal] = useState(false);
  const [showAssignScannersModal, setShowAssignScannersModal] = useState(false);
  const [selectedSessionForAssignment, setSelectedSessionForAssignment] = useState<Session | null>(null);

  // Form states
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [newSessionNotes, setNewSessionNotes] = useState('');

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers();
    } else if (activeTab === 'sessions') {
      loadSessions();
    }
  }, [activeTab]);

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/admin/users', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json() as { users: User[] };
        setUsers(data.users);
      }
    } catch (err) {
      setError('Failed to load users');
    }
  };

  const loadSessions = async () => {
    try {
      const res = await fetch('/api/admin/sessions', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json() as { sessions: Session[] };
        setSessions(data.sessions);
      }
    } catch (err) {
      setError('Failed to load sessions');
    }
  };

  const loadSessionScans = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}/scans`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json() as { scans: Scan[] };
        setScans(data.scans);
      }
    } catch (err) {
      setError('Failed to load scans');
    }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: newUsername, password: newPassword }),
      });

      if (res.ok) {
        setNewUsername('');
        setNewPassword('');
        setShowCreateUserModal(false);
        loadUsers();
      } else {
        const data = await res.json() as { error?: string };
        setError(data.error || 'Failed to create user');
      }
    } catch (err) {
      setError('Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: !currentStatus }),
      });

      if (res.ok) {
        loadUsers();
      }
    } catch (err) {
      setError('Failed to update user');
    }
  };

  const createSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: newSessionTitle,
          notes: newSessionNotes || undefined,
        }),
      });

      if (res.ok) {
        setNewSessionTitle('');
        setNewSessionNotes('');
        setShowCreateSessionModal(false);
        loadSessions();
      } else {
        const data = await res.json() as { error?: string };
        setError(data.error || 'Failed to create session');
      }
    } catch (err) {
      setError('Failed to create session');
    } finally {
      setLoading(false);
    }
  };

  const toggleSessionStatus = async (sessionId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_open: !currentStatus }),
      });

      if (res.ok) {
        loadSessions();
      }
    } catch (err) {
      setError('Failed to update session');
    }
  };

  const assignScanner = async (sessionId: string, scannerUserId: string) => {
    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ scanner_user_id: scannerUserId }),
      });

      if (res.ok) {
        loadSessions();
      } else {
        const data = await res.json() as { error?: string };
        // Ignore "already assigned" errors - that's fine
        if (data.error && !data.error.includes('already')) {
          setError(data.error);
        }
      }
    } catch (err) {
      setError('Failed to assign scanner');
    }
  };

  const assignMultipleScanners = async (sessionId: string, scannerUserIds: string[]) => {
    try {
      // Assign each scanner
      for (const scannerId of scannerUserIds) {
        await assignScanner(sessionId, scannerId);
      }
      setShowAssignScannersModal(false);
      setSelectedSessionForAssignment(null);
      loadSessions();
    } catch (err) {
      setError('Failed to assign scanners');
    }
  };

  const unassignScanner = async (sessionId: string, scannerUserId: string) => {
    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}/assign`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ scanner_user_id: scannerUserId }),
      });

      if (res.ok) {
        loadSessions();
      } else {
        const data = await res.json() as { error?: string };
        setError(data.error || 'Failed to unassign scanner');
      }
    } catch (err) {
      setError('Failed to unassign scanner');
    }
  };

  const unassignMultipleScanners = async (sessionId: string, scannerUserIds: string[]) => {
    try {
      // Unassign each scanner
      for (const scannerId of scannerUserIds) {
        await unassignScanner(sessionId, scannerId);
      }
      setShowAssignScannersModal(false);
      setSelectedSessionForAssignment(null);
      loadSessions();
    } catch (err) {
      setError('Failed to unassign scanners');
    }
  };

  const viewSessionDetails = async (session: Session) => {
    setSelectedSession(session);
    setActiveTab('session-detail');
    await loadSessionScans(session.id);
  };

  const exportScans = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}/export.csv`, {
        credentials: 'include',
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `session-${sessionId}-scans.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      setError('Failed to export scans');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-xl font-bold">Admin Dashboard</h1>
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div className="border-b border-gray-200 mb-6">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('users')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'users'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Users
            </button>
            <button
              onClick={() => setActiveTab('sessions')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'sessions'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Sessions
            </button>
            {activeTab === 'session-detail' && (
              <button
                className="py-4 px-1 border-b-2 font-medium text-sm border-blue-500 text-blue-600"
              >
                Session Details
              </button>
            )}
          </nav>
        </div>

        {activeTab === 'users' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Scanner Users</h2>
              <button
                onClick={() => setShowCreateUserModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                + Create User
              </button>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Username
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{u.username}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs rounded ${
                            u.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {u.is_active ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {u.role === 'ADMIN' ? (
                          <span className="text-gray-400 text-sm">Protected</span>
                        ) : (
                          <button
                            onClick={() => toggleUserStatus(u.id, u.is_active)}
                            className={`${
                              u.is_active ? 'text-red-600' : 'text-green-600'
                            } hover:underline`}
                          >
                            {u.is_active ? 'Disable' : 'Enable'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'sessions' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Sessions</h2>
              <button
                onClick={() => setShowCreateSessionModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                + Create Session
              </button>
            </div>
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Title
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sessions.map((s) => (
                    <tr key={s.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {s.title}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs rounded ${
                            s.is_open
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {s.is_open ? 'Open' : 'Closed'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(s.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                        <button
                          onClick={() => viewSessionDetails(s)}
                          className="text-blue-600 hover:underline"
                        >
                          View
                        </button>
                        <button
                          onClick={() => toggleSessionStatus(s.id, s.is_open)}
                          className="text-gray-600 hover:underline"
                        >
                          {s.is_open ? 'Close' : 'Open'}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedSessionForAssignment(s);
                            setShowAssignScannersModal(true);
                          }}
                          className="text-green-600 hover:underline"
                        >
                          Assign Scanners
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'session-detail' && selectedSession && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-semibold">{selectedSession.title}</h2>
                <p className="text-sm text-gray-500">
                  Created: {new Date(selectedSession.created_at).toLocaleString()}
                </p>
              </div>
              <div className="space-x-2">
                <button
                  onClick={() => {
                    setActiveTab('sessions');
                    setSelectedSession(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={() => exportScans(selectedSession.id)}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Export CSV
                </button>
              </div>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b">
                <p className="text-sm font-medium">Total Scans: {scans.length}</p>
              </div>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Student Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Scanned By
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Scanned At
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {scans.map((scan) => (
                    <tr key={scan.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {scan.scanned_student_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {scan.scanned_by_username}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(scan.scanned_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Create User Modal */}
        {showCreateUserModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-semibold mb-4">Create Scanner User</h3>
              <form onSubmit={createUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Enter username"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Enter password (min 4 characters)"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateUserModal(false);
                      setNewUsername('');
                      setNewPassword('');
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create Session Modal */}
        {showCreateSessionModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-semibold mb-4">Create Session</h3>
              <form onSubmit={createSession} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Session Title
                  </label>
                  <input
                    type="text"
                    value={newSessionTitle}
                    onChange={(e) => setNewSessionTitle(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Enter session title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes (optional)
                  </label>
                  <textarea
                    value={newSessionNotes}
                    onChange={(e) => setNewSessionNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows={3}
                    placeholder="Enter notes..."
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateSessionModal(false);
                      setNewSessionTitle('');
                      setNewSessionNotes('');
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? 'Creating...' : 'Create Session'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Assign Scanners Modal */}
        {showAssignScannersModal && selectedSessionForAssignment && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-semibold mb-4">
                Assign Scanners to: {selectedSessionForAssignment.title}
              </h3>
              <AssignScannersModal
                session={selectedSessionForAssignment}
                users={users.filter((u) => u.role === 'SCANNER' && u.is_active)}
                onAssign={assignMultipleScanners}
                onUnassign={unassignMultipleScanners}
                onClose={() => {
                  setShowAssignScannersModal(false);
                  setSelectedSessionForAssignment(null);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Assign Scanners Modal Component
function AssignScannersModal({
  session,
  users,
  onAssign,
  onUnassign,
  onClose,
}: {
  session: Session;
  users: User[];
  onAssign: (sessionId: string, scannerIds: string[]) => void;
  onUnassign: (sessionId: string, scannerIds: string[]) => void;
  onClose: () => void;
}) {
  const [selectedScanners, setSelectedScanners] = useState<Set<string>>(new Set());
  const [selectedUnassignScanners, setSelectedUnassignScanners] = useState<Set<string>>(new Set());
  const [assignedScanners, setAssignedScanners] = useState<Set<string>>(new Set());
  const [assignedScannersList, setAssignedScannersList] = useState<{ scanner_user_id: string; username: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load current assignments
    const loadAssignments = async () => {
      try {
        const res = await fetch(`/api/admin/sessions/${session.id}/assignments`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json() as { assignments: { scanner_user_id: string; username: string }[] };
          const assignedIds = new Set(data.assignments.map((a) => a.scanner_user_id));
          setAssignedScanners(assignedIds);
          setAssignedScannersList(data.assignments);
        }
      } catch (err) {
        console.error('Failed to load assignments', err);
      } finally {
        setLoading(false);
      }
    };
    loadAssignments();
  }, [session.id]);

  const toggleScanner = (userId: string) => {
    const newSet = new Set(selectedScanners);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedScanners(newSet);
  };

  const toggleUnassignScanner = (userId: string) => {
    const newSet = new Set(selectedUnassignScanners);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedUnassignScanners(newSet);
  };

  const handleAssign = () => {
    if (selectedScanners.size > 0) {
      onAssign(session.id, Array.from(selectedScanners));
    }
  };

  const handleUnassign = () => {
    if (selectedUnassignScanners.size > 0) {
      onUnassign(session.id, Array.from(selectedUnassignScanners));
    }
  };

  // Get available scanners (not assigned)
  const availableScanners = users.filter((u) => !assignedScanners.has(u.id));
  // Get assigned scanners with their usernames
  const assignedScannersWithNames = assignedScannersList.map((a) => {
    const user = users.find((u) => u.id === a.scanner_user_id);
    return { ...a, user };
  }).filter((a) => a.user); // Only show if user still exists

  if (loading) {
    return <div className="text-center py-4">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Unassign Section */}
      {assignedScannersWithNames.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Assigned Scanners</h4>
          <div className="max-h-32 overflow-y-auto border border-gray-300 rounded-md p-2 mb-4">
            {assignedScannersWithNames.map((assignment) => {
              const isSelected = selectedUnassignScanners.has(assignment.scanner_user_id);
              return (
                <label
                  key={assignment.scanner_user_id}
                  className="flex items-center space-x-2 p-2 hover:bg-gray-50 cursor-pointer rounded bg-blue-50"
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleUnassignScanner(assignment.scanner_user_id)}
                    className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm">{assignment.username || assignment.user?.username}</span>
                </label>
              );
            })}
          </div>
          {selectedUnassignScanners.size > 0 && (
            <button
              onClick={handleUnassign}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 mb-4"
            >
              Unassign ({selectedUnassignScanners.size})
            </button>
          )}
        </div>
      )}

      {/* Assign Section */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Available Scanners</h4>
        <div className="max-h-32 overflow-y-auto border border-gray-300 rounded-md p-2">
          {availableScanners.length === 0 ? (
            <p className="text-gray-500 text-center py-4">All scanners are assigned</p>
          ) : (
            availableScanners.map((user) => {
              const isSelected = selectedScanners.has(user.id);
              return (
                <label
                  key={user.id}
                  className="flex items-center space-x-2 p-2 hover:bg-gray-50 cursor-pointer rounded"
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleScanner(user.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">{user.username}</span>
                </label>
              );
            })
          )}
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleAssign}
          disabled={selectedScanners.size === 0}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Assign {selectedScanners.size > 0 ? `(${selectedScanners.size})` : ''}
        </button>
      </div>
    </div>
  );
}

