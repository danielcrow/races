'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { formatPasscode } from '@/lib/passcode';

interface Athlete {
  athlete_id: number;
  first_name: string;
  last_name: string;
  gender: string;
  date_of_birth: string | null;
  passcode: string | null;
  passcode_created_at: string | null;
}

export default function PasscodesPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [regenerating, setRegenerating] = useState<number | null>(null);

  useEffect(() => {
    loadAthletes();
  }, []);

  const loadAthletes = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/athletes/passcodes');
      const data = await response.json();
      
      if (response.ok) {
        setAthletes(data.athletes || []);
      } else {
        setError(data.error || 'Failed to load athletes');
      }
    } catch (err) {
      setError('Error loading athletes: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const regeneratePasscode = async (athleteId: number) => {
    try {
      setRegenerating(athleteId);
      const response = await fetch(`/api/athletes/${athleteId}/passcode`, {
        method: 'POST',
      });
      const data = await response.json();
      
      if (response.ok) {
        // Update the athlete in the list
        setAthletes(prev => prev.map(a => 
          a.athlete_id === athleteId 
            ? { ...a, passcode: data.passcode, passcode_created_at: data.passcode_created_at }
            : a
        ));
      } else {
        alert('Failed to regenerate passcode: ' + data.error);
      }
    } catch (err) {
      alert('Error regenerating passcode: ' + (err as Error).message);
    } finally {
      setRegenerating(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast notification here
  };

  const exportCSV = () => {
    const csv = [
      ['Athlete ID', 'First Name', 'Last Name', 'Gender', 'Passcode', 'Created At'].join(','),
      ...filteredAthletes.map(a => [
        a.athlete_id,
        a.first_name,
        a.last_name,
        a.gender,
        a.passcode || 'N/A',
        a.passcode_created_at ? new Date(a.passcode_created_at).toLocaleDateString() : 'N/A'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `athlete-passcodes-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const filteredAthletes = athletes.filter(a => {
    const search = searchTerm.toLowerCase();
    return (
      a.first_name?.toLowerCase().includes(search) ||
      a.last_name?.toLowerCase().includes(search) ||
      a.athlete_id.toString().includes(search) ||
      a.passcode?.toLowerCase().includes(search)
    );
  });

  const athletesWithPasscode = athletes.filter(a => a.passcode).length;
  const athletesWithoutPasscode = athletes.length - athletesWithPasscode;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-300">Loading athlete passcodes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/admin')}
            className="mb-4 text-blue-400 hover:text-blue-300 flex items-center gap-2"
          >
            ← Back to Admin
          </button>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">🔐 Athlete Passcodes</h1>
          <p className="text-gray-400">Manage passcodes for athlete profile access</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <p className="text-gray-400 text-sm mb-1">Total Athletes</p>
            <p className="text-3xl font-bold text-blue-400">{athletes.length}</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <p className="text-gray-400 text-sm mb-1">With Passcode</p>
            <p className="text-3xl font-bold text-green-400">{athletesWithPasscode}</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <p className="text-gray-400 text-sm mb-1">Without Passcode</p>
            <p className="text-3xl font-bold text-orange-400">{athletesWithoutPasscode}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="mb-6 flex flex-wrap gap-4">
          <button
            onClick={loadAthletes}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            🔄 Refresh
          </button>
          <button
            onClick={exportCSV}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            📥 Export CSV
          </button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search by name, ID, or passcode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-lg">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {/* Table */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Gender</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Passcode</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredAthletes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      No athletes found
                    </td>
                  </tr>
                ) : (
                  filteredAthletes.map((athlete) => (
                    <tr key={athlete.athlete_id} className="hover:bg-gray-750">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                        {athlete.athlete_id}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-white">
                        {athlete.first_name} {athlete.last_name}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 rounded text-xs ${
                          athlete.gender === 'Male' ? 'bg-blue-900 text-blue-300' : 'bg-pink-900 text-pink-300'
                        }`}>
                          {athlete.gender}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-mono">
                        {athlete.passcode ? (
                          <div className="flex items-center gap-2">
                            <span className="text-green-400">{formatPasscode(athlete.passcode)}</span>
                            <button
                              onClick={() => copyToClipboard(athlete.passcode!)}
                              className="text-gray-400 hover:text-white"
                              title="Copy to clipboard"
                            >
                              📋
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-500">No passcode</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">
                        {athlete.passcode_created_at 
                          ? new Date(athlete.passcode_created_at).toLocaleDateString()
                          : 'N/A'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <button
                          onClick={() => regeneratePasscode(athlete.athlete_id)}
                          disabled={regenerating === athlete.athlete_id}
                          className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-600 text-xs"
                        >
                          {regenerating === athlete.athlete_id ? '...' : '🔄 Regenerate'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-500">
          Showing {filteredAthletes.length} of {athletes.length} athletes
        </div>
      </div>
    </div>
  );
}

// Made with Bob
