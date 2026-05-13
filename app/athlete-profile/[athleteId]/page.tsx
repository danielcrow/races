'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface RaceResult {
  raceId: number;
  raceName: string;
  raceDate: string;
  position: number;
  totalFinishers: number;
  totalTime: string;
  totalSeconds: number;
  bibNumber: string;
  athleteName: string;
}

interface AthleteData {
  athlete: {
    id: number;
    bibNumber: string;
    firstName: string;
    lastName: string;
    gender: string;
    fullName: string;
  };
  races: RaceResult[];
  totalRaces: number;
}

export default function AthleteProfilePage() {
  const params = useParams();
  const router = useRouter();
  const athleteId = params.athleteId as string;
  
  const [data, setData] = useState<AthleteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  useEffect(() => {
    // Check if already authenticated (from sessionStorage)
    const authKey = `athlete_auth_${athleteId}`;
    const isAuth = sessionStorage.getItem(authKey) === 'true';
    if (isAuth) {
      setIsAuthenticated(true);
      loadAthleteData();
    } else {
      setLoading(false);
    }
  }, [athleteId]);

  const loadAthleteData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/athlete-races/${athleteId}`);
      const result = await response.json();
      
      if (response.ok) {
        setData(result);
      } else {
        setError(result.error || 'Failed to load athlete data');
      }
    } catch (err) {
      setError('Error loading athlete data: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasscodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying(true);
    setVerifyError('');

    try {
      const response = await fetch(`/api/athletes/${athleteId}/passcode/verify`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode })
      });

      const result = await response.json();

      if (response.ok && result.valid) {
        // Store authentication in sessionStorage
        sessionStorage.setItem(`athlete_auth_${athleteId}`, 'true');
        setIsAuthenticated(true);
        setLoading(true);
        await loadAthleteData();
      } else {
        setVerifyError('Invalid passcode. Please try again.');
        setPasscode('');
      }
    } catch (err) {
      setVerifyError('Error verifying passcode. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  // Show passcode entry form if not authenticated
  if (!isAuthenticated && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Athlete Profile Access</h1>
            <p className="text-gray-600">Enter your passcode to view your race history</p>
          </div>

          <form onSubmit={handlePasscodeSubmit} className="space-y-4">
            <div>
              <label htmlFor="passcode" className="block text-sm font-medium text-gray-700 mb-2">
                Passcode
              </label>
              <input
                type="text"
                id="passcode"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX"
                maxLength={9}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg font-mono tracking-wider"
                required
                disabled={verifying}
              />
              <p className="mt-2 text-sm text-gray-500">
                Enter the 8-character passcode provided to you
              </p>
            </div>

            {verifyError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{verifyError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={verifying || passcode.length < 8}
              className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {verifying ? 'Verifying...' : 'Access Profile'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => router.push('/')}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              ← Back to Races
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading athlete profile...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'No data available'}</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Races
          </button>
        </div>
      </div>
    );
  }

  // Prepare chart data - performance over time
  const performanceData = data.races.map(race => ({
    race: race.raceName.length > 20 ? race.raceName.substring(0, 20) + '...' : race.raceName,
    position: race.position,
    time: race.totalSeconds / 60, // Convert to minutes
    date: new Date(race.raceDate).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
  })).reverse(); // Reverse to show chronological order

  // Calculate statistics
  const avgPosition = data.races.length > 0 
    ? data.races.reduce((sum, r) => sum + r.position, 0) / data.races.length 
    : 0;
  
  const bestPosition = data.races.length > 0 
    ? Math.min(...data.races.map(r => r.position)) 
    : 0;

  const avgTime = data.races.length > 0
    ? data.races.reduce((sum, r) => sum + r.totalSeconds, 0) / data.races.length
    : 0;

  const bestTime = data.races.length > 0
    ? Math.min(...data.races.map(r => r.totalSeconds))
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/')}
            className="mb-4 text-blue-600 hover:text-blue-800 flex items-center gap-2"
          >
            ← Back to Races
          </button>
          <div className="bg-white p-6 rounded-lg shadow">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              {data.athlete.fullName}
            </h1>
            <div className="flex flex-wrap gap-4 text-gray-600">
              <span className="flex items-center gap-2">
                <span className="font-semibold">Gender:</span>
                <span className={`px-2 py-1 rounded text-sm ${
                  data.athlete.gender === 'Male' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'
                }`}>
                  {data.athlete.gender}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span className="font-semibold">Total Races:</span> {data.totalRaces}
              </span>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-gray-600 text-sm mb-1">Total Races</p>
            <p className="text-3xl font-bold text-blue-600">{data.totalRaces}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-gray-600 text-sm mb-1">Best Position</p>
            <p className="text-3xl font-bold text-green-600">{bestPosition > 0 ? `#${bestPosition}` : 'N/A'}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-gray-600 text-sm mb-1">Average Position</p>
            <p className="text-3xl font-bold text-orange-600">{avgPosition > 0 ? `#${avgPosition.toFixed(1)}` : 'N/A'}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-gray-600 text-sm mb-1">Best Time</p>
            <p className="text-3xl font-bold text-purple-600">{bestTime > 0 ? formatTime(bestTime).substring(0, 8) : 'N/A'}</p>
          </div>
        </div>

        {/* Performance Charts */}
        {data.races.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Position Trend */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-2xl font-bold mb-4">Position Trend</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis reversed domain={[1, 'dataMax']} label={{ value: 'Position', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="position" stroke="#3b82f6" strokeWidth={2} name="Position" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Time Trend */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-2xl font-bold mb-4">Time Trend</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis label={{ value: 'Time (minutes)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip formatter={(value: number) => `${value.toFixed(2)} min`} />
                  <Legend />
                  <Bar dataKey="time" fill="#8b5cf6" name="Time" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Race History Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <h2 className="text-2xl font-bold p-6 pb-4">Race History</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Race</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Bib</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Position</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.races.map((race) => (
                  <tr key={`${race.raceId}-${race.athleteName}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(race.raceDate).toLocaleDateString('en-GB', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <button
                        onClick={() => router.push(`/race/${race.raceId}`)}
                        className="text-blue-600 hover:text-blue-800 hover:underline text-left"
                      >
                        {race.raceName}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {race.bibNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <span className={`px-2 py-1 rounded ${
                        race.position === 1 ? 'bg-yellow-100 text-yellow-800' :
                        race.position <= 3 ? 'bg-green-100 text-green-800' :
                        race.position <= 10 ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        #{race.position} / {race.totalFinishers}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      {race.totalTime.substring(0, 12)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => router.push(`/athlete/${race.raceId}/${athleteId}`)}
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

// Made with Bob