'use client';

import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface Race {
  id: number;
  name: string;
  date: string;
}

interface Athlete {
  id: number;
  bibNumber: string;
  firstName: string;
  lastName: string;
  gender: string;
  fullName: string;
  totalRaces: number;
  firstRace: string;
  lastRace: string;
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'races' | 'athletes'>('races');
  const [races, setRaces] = useState<Race[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [athletesLoading, setAthletesLoading] = useState(false);
  const [selectedRace, setSelectedRace] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [athleteSearchTerm, setAthleteSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedGender, setSelectedGender] = useState<string>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadRaces();
    
    // Check URL parameters for tab and search
    const tab = searchParams.get('tab');
    const search = searchParams.get('search');
    
    if (tab === 'athletes') {
      setActiveTab('athletes');
      if (search) {
        setAthleteSearchTerm(decodeURIComponent(search));
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (activeTab === 'athletes' && athletes.length === 0) {
      loadAthletes();
    }
  }, [activeTab]);

  const loadRaces = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/races');
      const data = await response.json();
      setRaces(data.races || []);
      setMessage(`Loaded ${data.races?.length || 0} races`);
    } catch (error) {
      setMessage('Error loading races: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadAthletes = async () => {
    try {
      setAthletesLoading(true);
      const response = await fetch('/api/athletes');
      const data = await response.json();
      setAthletes(data.athletes || []);
      setMessage(`Loaded ${data.athletes?.length || 0} athletes`);
    } catch (error) {
      setMessage('Error loading athletes: ' + (error as Error).message);
    } finally {
      setAthletesLoading(false);
    }
  };

  const exportRace = async (raceId: number) => {
    try {
      setExporting(true);
      setMessage(`Exporting race ${raceId}...`);
      
      const response = await fetch(`/api/export/${raceId}`);
      
      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Get the blob and create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Race_${raceId}_Results.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setMessage(`Successfully exported race ${raceId}`);
    } catch (error) {
      setMessage('Export failed: ' + (error as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const exportAllRaces = async () => {
    if (!confirm(`Export all ${races.length} races?`)) return;
    
    try {
      setExporting(true);
      let successCount = 0;
      
      for (const race of races) {
        setMessage(`Exporting race ${race.id} (${successCount + 1}/${races.length})...`);
        await exportRace(race.id);
        successCount++;
        // Small delay between exports
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      setMessage(`Successfully exported ${successCount} races`);
    } catch (error) {
      setMessage('Batch export failed: ' + (error as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setMessage('Uploading database...');

      const formData = new FormData();
      formData.append('database', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(`Database uploaded successfully! (${(file.size / 1024).toFixed(2)} KB)`);
        // Reload races after upload
        await loadRaces();
      } else {
        setMessage(`Upload failed: ${data.error}`);
      }
    } catch (error) {
      setMessage('Upload failed: ' + (error as Error).message);
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Get unique years from races
  const availableYears = useMemo(() => {
    const years = races.map(race => new Date(race.date).getFullYear());
    return ['all', ...Array.from(new Set(years)).sort((a, b) => b - a)];
  }, [races]);

  // Filter races based on search and year
  const filteredRaces = useMemo(() => {
    return races.filter(race => {
      const matchesSearch = race.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           race.id.toString().includes(searchTerm);
      const matchesYear = selectedYear === 'all' ||
                         new Date(race.date).getFullYear().toString() === selectedYear;
      return matchesSearch && matchesYear;
    });
  }, [races, searchTerm, selectedYear]);

  // Filter athletes based on search and gender
  const filteredAthletes = useMemo(() => {
    return athletes.filter(athlete => {
      const matchesSearch = athlete.fullName.toLowerCase().includes(athleteSearchTerm.toLowerCase()) ||
                           athlete.firstName.toLowerCase().includes(athleteSearchTerm.toLowerCase()) ||
                           athlete.lastName.toLowerCase().includes(athleteSearchTerm.toLowerCase()) ||
                           athlete.bibNumber.includes(athleteSearchTerm);
      const matchesGender = selectedGender === 'all' || athlete.gender === selectedGender;
      return matchesSearch && matchesGender;
    });
  }, [athletes, athleteSearchTerm, selectedGender]);

  return (
    <main className="min-h-screen p-2 sm:p-4 md:p-8 bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-4 md:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">🏃 Danergy Race Results</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2">View race results and athlete performance</p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-4 md:mb-6 flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('races')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'races'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🏁 Races
          </button>
          <button
            onClick={() => setActiveTab('athletes')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'athletes'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            👤 Athletes
          </button>
        </div>

        {/* Races Tab Content */}
        {activeTab === 'races' && (
          <>
            {/* Search and Filter Section */}
        <div className="mb-4 md:mb-6 p-3 sm:p-4 bg-white rounded-lg shadow">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="flex-1">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                Search Races
              </label>
              <input
                type="text"
                placeholder="Search by race name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="w-full sm:w-40 md:w-48">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                Filter by Year
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Years</option>
                {availableYears.slice(1).map(year => (
                  <option key={year} value={year.toString()}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-2 sm:mt-3 text-xs sm:text-sm text-gray-600">
            Showing {filteredRaces.length} of {races.length} races
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mb-4 md:mb-6 flex flex-wrap gap-2 sm:gap-4">
          <button
            onClick={loadRaces}
            disabled={loading}
            className="px-3 py-2 text-sm sm:px-4 sm:text-base bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Loading...' : '🔄 Refresh'}
          </button>
          {(searchTerm || selectedYear !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedYear('all');
              }}
              className="px-3 py-2 text-sm sm:px-4 sm:text-base bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Races Table - Desktop */}
        <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Race ID
                  </th>
                  <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Race Name
                  </th>
                  <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Race Date
                  </th>
                  <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-4 lg:px-6 py-4 text-center text-gray-500 text-sm">
                      Loading races...
                    </td>
                  </tr>
                ) : filteredRaces.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 lg:px-6 py-4 text-center text-gray-500 text-sm">
                      {races.length === 0 ? 'No races found' : 'No races match your filters'}
                    </td>
                  </tr>
                ) : (
                  filteredRaces.map((race) => (
                    <tr
                      key={race.id}
                      className={selectedRace === race.id ? 'bg-blue-50' : 'hover:bg-gray-50'}
                      onClick={() => setSelectedRace(race.id)}
                    >
                      <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {race.id}
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-sm text-gray-900">
                        {race.name}
                      </td>
                      <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(race.date).toLocaleString()}
                      </td>
                      <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.location.href = `/race/${race.id}`;
                          }}
                          className="px-3 py-2 lg:px-4 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
                        >
                          📊 View Results
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Races Cards - Mobile/Tablet */}
        <div className="md:hidden space-y-3">
          {loading ? (
            <div className="bg-white rounded-lg shadow p-4 text-center text-gray-500 text-sm">
              Loading races...
            </div>
          ) : filteredRaces.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-4 text-center text-gray-500 text-sm">
              {races.length === 0 ? 'No races found' : 'No races match your filters'}
            </div>
          ) : (
            filteredRaces.map((race) => (
              <div
                key={race.id}
                className={`bg-white rounded-lg shadow p-4 ${
                  selectedRace === race.id ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => setSelectedRace(race.id)}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 mb-1">Race #{race.id}</div>
                    <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-1">
                      {race.name}
                    </h3>
                    <div className="text-xs sm:text-sm text-gray-600">
                      {new Date(race.date).toLocaleDateString()} at {new Date(race.date).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.href = `/race/${race.id}`;
                  }}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium text-sm"
                >
                  📊 View Results
                </button>
              </div>
            ))
          )}
        </div>
          </>
        )}

        {/* Athletes Tab Content */}
        {activeTab === 'athletes' && (
          <>
            {/* Search and Filter Section */}
            <div className="mb-4 md:mb-6 p-3 sm:p-4 bg-white rounded-lg shadow">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <div className="flex-1">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    Search Athletes
                  </label>
                  <input
                    type="text"
                    placeholder="Search by name or bib number..."
                    value={athleteSearchTerm}
                    onChange={(e) => setAthleteSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="w-full sm:w-40 md:w-48">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    Filter by Gender
                  </label>
                  <select
                    value={selectedGender}
                    onChange={(e) => setSelectedGender(e.target.value)}
                    className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Genders</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>
              <div className="mt-2 sm:mt-3 text-xs sm:text-sm text-gray-600">
                Showing {filteredAthletes.length} of {athletes.length} athletes
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mb-4 md:mb-6 flex flex-wrap gap-2 sm:gap-4">
              <button
                onClick={loadAthletes}
                disabled={athletesLoading}
                className="px-3 py-2 text-sm sm:px-4 sm:text-base bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
              >
                {athletesLoading ? 'Loading...' : '🔄 Refresh'}
              </button>
              {(athleteSearchTerm || selectedGender !== 'all') && (
                <button
                  onClick={() => {
                    setAthleteSearchTerm('');
                    setSelectedGender('all');
                  }}
                  className="px-3 py-2 text-sm sm:px-4 sm:text-base bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Clear Filters
                </button>
              )}
            </div>

            {/* Athletes Table - Desktop */}
            <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Gender
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Total Races
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Last Race
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {athletesLoading ? (
                      <tr>
                        <td colSpan={5} className="px-4 lg:px-6 py-4 text-center text-gray-500 text-sm">
                          Loading athletes...
                        </td>
                      </tr>
                    ) : filteredAthletes.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 lg:px-6 py-4 text-center text-gray-500 text-sm">
                          {athletes.length === 0 ? 'No athletes found' : 'No athletes match your filters'}
                        </td>
                      </tr>
                    ) : (
                      filteredAthletes.map((athlete) => (
                        <tr key={athlete.id} className="hover:bg-gray-50">
                          <td className="px-4 lg:px-6 py-4 text-sm text-gray-900">
                            <div className="font-medium">{athlete.fullName}</div>
                            <div className="text-xs text-gray-500">Bib: {athlete.bibNumber}</div>
                          </td>
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`px-2 py-1 rounded ${
                              athlete.gender === 'Male' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'
                            }`}>
                              {athlete.gender}
                            </span>
                          </td>
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {athlete.totalRaces}
                          </td>
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(athlete.lastRace).toLocaleDateString()}
                          </td>
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm">
                            <button
                              onClick={() => router.push(`/athlete-profile/${athlete.id}`)}
                              className="px-3 py-2 lg:px-4 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
                            >
                              👤 View Profile
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Athletes Cards - Mobile/Tablet */}
            <div className="md:hidden space-y-3">
              {athletesLoading ? (
                <div className="bg-white rounded-lg shadow p-4 text-center text-gray-500 text-sm">
                  Loading athletes...
                </div>
              ) : filteredAthletes.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-4 text-center text-gray-500 text-sm">
                  {athletes.length === 0 ? 'No athletes found' : 'No athletes match your filters'}
                </div>
              ) : (
                filteredAthletes.map((athlete) => (
                  <div key={athlete.id} className="bg-white rounded-lg shadow p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-1">
                          {athlete.fullName}
                        </h3>
                        <div className="text-xs text-gray-500 mb-2">Bib: {athlete.bibNumber}</div>
                        <div className="flex gap-2 items-center mb-2">
                          <span className={`px-2 py-1 rounded text-xs ${
                            athlete.gender === 'Male' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'
                          }`}>
                            {athlete.gender}
                          </span>
                          <span className="text-xs text-gray-600">
                            {athlete.totalRaces} race{athlete.totalRaces !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600">
                          Last race: {new Date(athlete.lastRace).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => router.push(`/athlete-profile/${athlete.id}`)}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium text-sm"
                    >
                      👤 View Profile
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <main className="min-h-screen p-2 sm:p-4 md:p-8 bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="max-w-6xl mx-auto">
          <div className="mb-4 md:mb-8">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">🏃 Danergy Race Results</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2">Loading...</p>
          </div>
        </div>
      </main>
    }>
      <HomeContent />
    </Suspense>
  );
}

// Made with Bob
