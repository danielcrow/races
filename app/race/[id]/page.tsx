'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ALL_AGE_CATEGORIES } from '@/lib/btf-age-categories';

interface RaceResult {
  position: number;
  athleteId: number;
  bibNumber: string;
  firstName: string;
  lastName: string;
  gender: string;
  totalTime: string;
  totalSeconds: number;
  isRelay: boolean;
  relayNames: string[];
  splits: Record<string, { time: string; seconds: number }>;
  ageOnDec31?: number;
  ageCategory?: string;
  ageCategoryName?: string;
}

interface RaceData {
  race: {
    id: number;
    name: string;
    date: string;
  };
  splits: string[];
  results: RaceResult[];
  statistics: {
    totalFinishers: number;
    maleFinishers: number;
    femaleFinishers: number;
    averageTime: string;
    fastestTime: string;
    slowestTime: string;
    averageTimeSeconds: number;
    fastestTimeSeconds: number;
    slowestTimeSeconds: number;
  };
}

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

export default function RaceResultsPage() {
  const params = useParams();
  const router = useRouter();
  const raceId = params.id as string;
  
  const [data, setData] = useState<RaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedView, setSelectedView] = useState<'overview' | 'splits' | 'gender' | 'age'>('overview');
  
  // Filter states
  const [genderFilter, setGenderFilter] = useState<string>('all');
  const [relayFilter, setRelayFilter] = useState<string>('all');
  const [ageCategoryFilter, setAgeCategoryFilter] = useState<string>('all');

  useEffect(() => {
    loadRaceResults();
  }, [raceId, genderFilter, relayFilter, ageCategoryFilter]);

  const loadRaceResults = async () => {
    try {
      setLoading(true);
      
      // Build query parameters
      const params = new URLSearchParams();
      if (genderFilter !== 'all') params.append('gender', genderFilter);
      if (relayFilter !== 'all') params.append('relay', relayFilter);
      if (ageCategoryFilter !== 'all') params.append('ageCategory', ageCategoryFilter);
      
      const queryString = params.toString();
      const url = `/api/race-results/${raceId}${queryString ? `?${queryString}` : ''}`;
      
      const response = await fetch(url);
      const result = await response.json();
      
      if (response.ok) {
        setData(result);
        setError(''); // Clear any previous errors
      } else {
        setError(result.error || 'Failed to load race results');
      }
    } catch (err) {
      setError('Error loading race results: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Reset filters
  const resetFilters = () => {
    setGenderFilter('all');
    setRelayFilter('all');
    setAgeCategoryFilter('all');
  };

  // Check if any filters are active
  const hasActiveFilters = genderFilter !== 'all' || relayFilter !== 'all' || ageCategoryFilter !== 'all';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading race results...</p>
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

  // Prepare chart data
  const genderData = [
    { name: 'Male', value: data.statistics.maleFinishers, color: '#3b82f6' },
    { name: 'Female', value: data.statistics.femaleFinishers, color: '#ec4899' }
  ];

  const top10Data = data.results.slice(0, 10).map(r => ({
    name: `${r.firstName} ${r.lastName}`,
    time: r.totalSeconds / 60, // Convert to minutes
    position: r.position
  }));

  const splitComparisonData = data.splits.map(splitName => {
    const times = data.results
      .map(r => r.splits[splitName]?.seconds)
      .filter(t => t !== undefined);
    
    const avg = times.reduce((a, b) => a + b, 0) / times.length / 60;
    const fastest = Math.min(...times) / 60;
    
    return {
      split: splitName,
      average: avg,
      fastest: fastest
    };
  });

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
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{data.race.name}</h1>
          <p className="text-gray-600">{new Date(data.race.date).toLocaleDateString('en-GB', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}</p>
        </div>

        {/* Filters Section */}
        <div className="bg-white p-4 md:p-6 rounded-lg shadow mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold text-gray-900">🔍 Filter Results</h2>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 flex items-center gap-2"
              >
                ✕ Clear All Filters
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Gender Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gender
              </label>
              <select
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Genders</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </div>

            {/* Relay Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Entry Type
              </label>
              <select
                value={relayFilter}
                onChange={(e) => setRelayFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Entries</option>
                <option value="false">Individual Only</option>
                <option value="true">Relay Only</option>
              </select>
            </div>

            {/* Age Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Age Category
              </label>
              <select
                value={ageCategoryFilter}
                onChange={(e) => setAgeCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Categories</option>
                <optgroup label="Youth">
                  {ALL_AGE_CATEGORIES.filter(cat => cat.code.startsWith('U')).map(cat => (
                    <option key={cat.code} value={cat.code}>
                      {cat.name} ({cat.code})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Adult">
                  {ALL_AGE_CATEGORIES.filter(cat => !cat.code.startsWith('U')).map(cat => (
                    <option key={cat.code} value={cat.code}>
                      {cat.name} ({cat.code})
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>

          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-sm text-gray-600">Active filters:</span>
              {genderFilter !== 'all' && (
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
                  Gender: {genderFilter === 'M' ? 'Male' : 'Female'}
                  <button onClick={() => setGenderFilter('all')} className="hover:text-blue-900">✕</button>
                </span>
              )}
              {relayFilter !== 'all' && (
                <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm flex items-center gap-2">
                  {relayFilter === 'true' ? 'Relay Only' : 'Individual Only'}
                  <button onClick={() => setRelayFilter('all')} className="hover:text-purple-900">✕</button>
                </span>
              )}
              {ageCategoryFilter !== 'all' && (
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm flex items-center gap-2">
                  {ALL_AGE_CATEGORIES.find(cat => cat.code === ageCategoryFilter)?.name || ageCategoryFilter}
                  <button onClick={() => setAgeCategoryFilter('all')} className="hover:text-green-900">✕</button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-gray-600 text-sm mb-1">
              {hasActiveFilters ? 'Filtered' : 'Total'} Finishers
            </p>
            <p className="text-3xl font-bold text-blue-600">{data.statistics.totalFinishers}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-gray-600 text-sm mb-1">Fastest Time</p>
            <p className="text-3xl font-bold text-green-600">{data.statistics.fastestTime.substring(0, 8)}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-gray-600 text-sm mb-1">Average Time</p>
            <p className="text-3xl font-bold text-orange-600">{data.statistics.averageTime.substring(0, 8)}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-gray-600 text-sm mb-1">Slowest Time</p>
            <p className="text-3xl font-bold text-red-600">{data.statistics.slowestTime.substring(0, 8)}</p>
          </div>
        </div>

        {/* View Tabs */}
        <div className="mb-6 flex gap-2 border-b border-gray-200 overflow-x-auto">
          <button
            onClick={() => setSelectedView('overview')}
            className={`px-4 py-2 font-medium whitespace-nowrap ${
              selectedView === 'overview'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setSelectedView('splits')}
            className={`px-4 py-2 font-medium whitespace-nowrap ${
              selectedView === 'splits'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Split Analysis
          </button>
          <button
            onClick={() => setSelectedView('gender')}
            className={`px-4 py-2 font-medium whitespace-nowrap ${
              selectedView === 'gender'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Gender Stats
          </button>
          <button
            onClick={() => setSelectedView('age')}
            className={`px-4 py-2 font-medium whitespace-nowrap ${
              selectedView === 'age'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Age Categories
          </button>
        </div>

        {/* Overview Tab */}
        {selectedView === 'overview' && (
          <div className="space-y-6">
            {/* Top 10 Chart */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-2xl font-bold mb-4">Top 10 Finishers</h2>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={top10Data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis label={{ value: 'Time (minutes)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip formatter={(value: number) => `${value.toFixed(2)} min`} />
                  <Bar dataKey="time" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Results Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <h2 className="text-2xl font-bold p-6 pb-4">
                {hasActiveFilters ? 'Filtered Results' : 'All Results'}
              </h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Pos</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Bib</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Gender</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Age Cat</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Time</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.results.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="text-4xl">🔍</div>
                            <p className="text-lg font-medium text-gray-900">No results match your filters</p>
                            <p className="text-sm text-gray-600">Try adjusting or clearing your filters to see more results</p>
                            <button
                              onClick={resetFilters}
                              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              Clear All Filters
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      data.results.map((result) => (
                      <tr
                        key={result.athleteId}
                        className="hover:bg-blue-50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {result.position}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {result.bibNumber}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {result.isRelay ? (
                            <div className="flex flex-col gap-1">
                              <div className="text-xs text-gray-500 mb-1">🏃‍♂️ Relay Team:</div>
                              {result.relayNames.map((name, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <span className="text-gray-400">•</span>
                                  <a
                                    href={`/athlete-profile?search=${encodeURIComponent(name)}`}
                                    className="text-blue-600 hover:text-blue-800 hover:underline text-left"
                                    title={`Search for ${name}`}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      router.push(`/?tab=athletes&search=${encodeURIComponent(name)}`);
                                    }}
                                  >
                                    {name}
                                  </a>
                                </div>
                              ))}
                              <button
                                onClick={() => router.push(`/athlete/${raceId}/${result.athleteId}`)}
                                className="text-xs text-gray-600 hover:text-gray-800 hover:underline text-left flex items-center gap-1 mt-1"
                                title="View detailed splits for this race"
                              >
                                📊 Race Details
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={() => router.push(`/athlete-profile/${result.athleteId}`)}
                                className="text-blue-600 hover:text-blue-800 font-medium hover:underline text-left"
                                title="View athlete profile (all races)"
                              >
                                {result.firstName} {result.lastName}
                              </button>
                              <button
                                onClick={() => router.push(`/athlete/${raceId}/${result.athleteId}`)}
                                className="text-xs text-gray-600 hover:text-gray-800 hover:underline text-left flex items-center gap-1"
                                title="View detailed splits for this race"
                              >
                                📊 Race Details
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className={`px-2 py-1 rounded ${
                            result.gender === 'Male' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'
                          }`}>
                            {result.gender}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {result.isRelay ? (
                            <span className="text-gray-400 text-xs">N/A</span>
                          ) : result.ageCategoryName ? (
                            <span className="px-2 py-1 rounded bg-green-100 text-green-800 text-xs" title={`Age on Dec 31: ${result.ageOnDec31}`}>
                              {result.ageCategory}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                          {result.totalTime.substring(0, 12)}
                        </td>
                      </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Splits Tab */}
        {selectedView === 'splits' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-2xl font-bold mb-4">Split Time Comparison</h2>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={splitComparisonData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="split" />
                  <YAxis label={{ value: 'Time (minutes)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip formatter={(value: number) => `${value.toFixed(2)} min`} />
                  <Legend />
                  <Line type="monotone" dataKey="average" stroke="#f59e0b" name="Average" strokeWidth={2} />
                  <Line type="monotone" dataKey="fastest" stroke="#10b981" name="Fastest" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Gender Tab */}
        {selectedView === 'gender' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-2xl font-bold mb-4">Gender Distribution</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={genderData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {genderData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-2xl font-bold mb-4">Gender Statistics</h2>
                <div className="space-y-4">
                  <div className="border-l-4 border-blue-500 pl-4">
                    <p className="text-sm text-gray-600">Male Finishers</p>
                    <p className="text-2xl font-bold text-blue-600">{data.statistics.maleFinishers}</p>
                    <p className="text-sm text-gray-500">
                      {((data.statistics.maleFinishers / data.statistics.totalFinishers) * 100).toFixed(1)}% of total
                    </p>
                  </div>
                  <div className="border-l-4 border-pink-500 pl-4">
                    <p className="text-sm text-gray-600">Female Finishers</p>
                    <p className="text-2xl font-bold text-pink-600">{data.statistics.femaleFinishers}</p>
                    <p className="text-sm text-gray-500">
                      {((data.statistics.femaleFinishers / data.statistics.totalFinishers) * 100).toFixed(1)}% of total
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Age Categories Tab */}
        {selectedView === 'age' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-2xl font-bold mb-4">Age Category Distribution</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ALL_AGE_CATEGORIES.map(category => {
                  const count = data.results.filter(r => 
                    !r.isRelay && r.ageCategory === category.code
                  ).length;
                  
                  if (count === 0) return null;
                  
                  const percentage = ((count / data.results.filter(r => !r.isRelay).length) * 100).toFixed(1);
                  
                  return (
                    <div 
                      key={category.code}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => setAgeCategoryFilter(category.code)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-sm font-medium text-gray-600">{category.name}</p>
                          <p className="text-xs text-gray-500">{category.code}</p>
                        </div>
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm font-bold">
                          {count}
                        </span>
                      </div>
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-600 h-2 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{percentage}% of individual entries</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {data.results.filter(r => !r.isRelay && !r.ageCategory).length > 0 && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    ⚠️ {data.results.filter(r => !r.isRelay && !r.ageCategory).length} athletes don't have age category data.
                    This may be because their date of birth is not recorded.
                  </p>
                </div>
              )}
            </div>

            {/* Age Category Leaderboard */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-2xl font-bold mb-4">Top Performers by Age Category</h2>
              <div className="space-y-6">
                {ALL_AGE_CATEGORIES.map(category => {
                  const categoryResults = data.results
                    .filter(r => !r.isRelay && r.ageCategory === category.code)
                    .sort((a, b) => a.totalSeconds - b.totalSeconds)
                    .slice(0, 3);
                  
                  if (categoryResults.length === 0) return null;
                  
                  return (
                    <div key={category.code} className="border-l-4 border-green-500 pl-4">
                      <h3 className="font-semibold text-lg mb-2">
                        {category.name} ({category.code})
                      </h3>
                      <div className="space-y-2">
                        {categoryResults.map((result, idx) => (
                          <div key={result.athleteId} className="flex items-center justify-between py-2 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                              <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                                idx === 0 ? 'bg-yellow-400 text-yellow-900' :
                                idx === 1 ? 'bg-gray-300 text-gray-700' :
                                'bg-orange-300 text-orange-900'
                              }`}>
                                {idx + 1}
                              </span>
                              <button
                                onClick={() => router.push(`/athlete-profile/${result.athleteId}`)}
                                className="text-blue-600 hover:text-blue-800 hover:underline text-left"
                              >
                                {result.firstName} {result.lastName}
                              </button>
                              <span className="text-xs text-gray-500">
                                ({result.gender === 'Male' ? 'M' : 'F'}, Age {result.ageOnDec31})
                              </span>
                            </div>
                            <span className="font-mono text-sm font-medium">
                              {result.totalTime.substring(0, 12)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Made with Bob
