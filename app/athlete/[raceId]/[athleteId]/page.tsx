'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

interface AthleteData {
  athlete: {
    id: number;
    bibNumber: string;
    firstName: string;
    lastName: string;
    gender: string;
    position: number;
    totalTime: string;
  };
  race: {
    id: number;
    name: string;
    date: string;
  };
  splits: Array<{
    name: string;
    athleteTime: number;
    athleteTimeFormatted: string;
    averageTime: number;
    fastestTime: number;
    slowestTime: number;
    percentile: number;
  }>;
}

export default function AthleteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const raceId = params.raceId as string;
  const athleteId = params.athleteId as string;
  
  const [data, setData] = useState<AthleteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAthleteData();
  }, [raceId, athleteId]);

  const loadAthleteData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/athlete-splits/${raceId}/${athleteId}`);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading athlete data...</p>
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
            onClick={() => router.push(`/race/${raceId}`)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Race Results
          </button>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const chartData = data.splits.map(split => ({
    split: split.name,
    'Your Time': split.athleteTime / 60,
    'Average': split.averageTime / 60,
    'Fastest': split.fastestTime / 60,
    'Slowest': split.slowestTime / 60
  }));

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex gap-4 mb-4">
            <button
              onClick={() => router.push(`/race/${raceId}`)}
              className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
            >
              ← Back to Race Results
            </button>
            <button
              onClick={() => router.push(`/athlete-profile/${athleteId}`)}
              className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
            >
              View All Races →
            </button>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              {data.athlete.firstName} {data.athlete.lastName}
            </h1>
            <div className="flex flex-wrap gap-4 text-gray-600">
              <span className="flex items-center gap-2">
                <span className="font-semibold">Bib:</span> {data.athlete.bibNumber}
              </span>
              <span className="flex items-center gap-2">
                <span className="font-semibold">Position:</span> {data.athlete.position}
              </span>
              <span className="flex items-center gap-2">
                <span className="font-semibold">Gender:</span>
                <span className={`px-2 py-1 rounded text-sm ${
                  data.athlete.gender === 'Male' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'
                }`}>
                  {data.athlete.gender}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span className="font-semibold">Total Time:</span>
                <span className="font-mono">{data.athlete.totalTime.substring(0, 12)}</span>
              </span>
            </div>
            <p className="mt-4 text-sm text-gray-500">{data.race.name}</p>
          </div>
        </div>

        {/* Split Comparison Chart */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-2xl font-bold mb-4">Split Time Comparison</h2>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="split" angle={-45} textAnchor="end" height={100} />
              <YAxis label={{ value: 'Time (minutes)', angle: -90, position: 'insideLeft' }} />
              <Tooltip formatter={(value: number) => `${value.toFixed(2)} min`} />
              <Legend />
              <Bar dataKey="Fastest" fill="#10b981" />
              <Bar dataKey="Your Time" fill="#3b82f6" />
              <Bar dataKey="Average" fill="#f59e0b" />
              <Bar dataKey="Slowest" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Detailed Split Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <h2 className="text-2xl font-bold p-6 pb-4">Detailed Split Analysis</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Split</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Your Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Fastest</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Average</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Slowest</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Percentile</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">vs Average</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.splits.map((split, index) => {
                  const vsAverage = split.athleteTime - split.averageTime;
                  const isFaster = vsAverage < 0;
                  
                  return (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {split.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {split.athleteTimeFormatted}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-green-600">
                        {formatTime(split.fastestTime)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-orange-600">
                        {formatTime(split.averageTime)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-red-600">
                        {formatTime(split.slowestTime)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${split.percentile}%` }}
                            ></div>
                          </div>
                          <span className="text-xs">{split.percentile.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 rounded font-mono ${
                          isFaster ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {isFaster ? '-' : '+'}{Math.abs(vsAverage).toFixed(1)}s
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Performance Summary */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 p-6 rounded-lg border border-green-200">
            <h3 className="text-lg font-semibold text-green-800 mb-2">Strengths</h3>
            <p className="text-sm text-green-700">
              {data.splits.filter(s => s.athleteTime < s.averageTime).length} splits faster than average
            </p>
          </div>
          <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">Overall Performance</h3>
            <p className="text-sm text-blue-700">
              Position {data.athlete.position} overall
            </p>
          </div>
          <div className="bg-orange-50 p-6 rounded-lg border border-orange-200">
            <h3 className="text-lg font-semibold text-orange-800 mb-2">Areas to Improve</h3>
            <p className="text-sm text-orange-700">
              {data.splits.filter(s => s.athleteTime > s.averageTime).length} splits slower than average
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

// Made with Bob
