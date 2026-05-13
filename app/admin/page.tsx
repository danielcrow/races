'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';

interface Race {
  id: number;
  name: string;
  date: string;
}

interface Tenant {
  subdomain: string;
  name: string;
  status: string;
  createdAt: string;
  adminEmail: string;
}

export default function AdminPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [races, setRaces] = useState<Race[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [showTenantManagement, setShowTenantManagement] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [migrationMode, setMigrationMode] = useState<'full' | 'incremental'>('full');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detect device type
  useEffect(() => {
    const checkDevice = () => {
      setIsDesktop(window.innerWidth >= 1024); // Desktop is 1024px and above
    };
    
    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  // Check if user can manage tenants (tenant_admin or super_admin for their own tenant, desktop only)
  const canManageTenants = () => {
    if (!session?.user) return false;
    const userRole = (session.user as any).role;
    // Only tenant_admin and super_admin can manage tenants, and only on desktop
    return isDesktop && (userRole === 'tenant_admin' || userRole === 'super_admin');
  };

  useEffect(() => {
    loadRaces();
    loadTenants();
  }, [showTenantManagement]);

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

  const loadTenants = async () => {
    try {
      const response = await fetch('/api/tenants');
      const data = await response.json();
      setTenants(data.tenants || []);
    } catch (error) {
      console.error('Error loading tenants:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setMessage(`Uploading database (${migrationMode} migration)...`);

      const formData = new FormData();
      formData.append('database', file);
      formData.append('mode', migrationMode);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        const modeText = migrationMode === 'full' ? 'Full migration' : 'Incremental update';
        setMessage(`${modeText} completed! (${(file.size / 1024).toFixed(2)} KB)`);
        if (data.migration?.stats) {
          const stats = data.migration.stats;
          setMessage(prev => `${prev}\nMigrated: ${stats.races} races, ${stats.athletes} athletes, ${stats.splits} splits`);
        }
        await loadRaces();
      } else {
        setMessage(`Upload failed: ${data.error}`);
      }
    } catch (error) {
      setMessage('Upload failed: ' + (error as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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

  const availableYears = ['all', ...Array.from(new Set(races.map(race => new Date(race.date).getFullYear()))).sort((a, b) => b - a)];
  
  const filteredRaces = races.filter(race => {
    const matchesSearch = race.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         race.id.toString().includes(searchTerm);
    const matchesYear = selectedYear === 'all' || 
                       new Date(race.date).getFullYear().toString() === selectedYear;
    return matchesSearch && matchesYear;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-2 sm:p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4 md:mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2">🔐 Admin Dashboard</h1>
              <p className="text-sm sm:text-base text-gray-400">Manage races and database</p>
              {session?.user && (
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  Logged in as: {session.user.email}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  // Preserve subdomain when navigating
                  const currentHost = window.location.host;
                  const protocol = window.location.protocol;
                  window.location.href = `${protocol}//${currentHost}/`;
                }}
                className="px-3 py-2 text-sm sm:px-4 sm:text-base bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Public View →
              </button>
              <button
                onClick={async () => {
                  await signOut({ redirect: false });
                  window.location.href = '/';
                }}
                className="px-3 py-2 text-sm sm:px-4 sm:text-base bg-red-600 text-white rounded hover:bg-red-700"
              >
                Sign Out
              </button>
              {canManageTenants() && (
                <button
                  onClick={() => setShowTenantManagement(!showTenantManagement)}
                  className="px-3 py-2 text-sm sm:px-4 sm:text-base bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  {showTenantManagement ? 'Hide' : 'Show'} Tenant Management
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tenant Management Section - Only for super_admin on default tenant, desktop only */}
        {canManageTenants() && showTenantManagement && (
          <div className="mb-4 md:mb-6 p-4 md:p-6 bg-gray-800 border border-purple-500 rounded-lg">
            <h2 className="text-lg md:text-xl font-semibold mb-4 text-white flex items-center gap-2">
              🏢 Tenant Management
              <span className="text-xs bg-purple-900 px-2 py-1 rounded">Desktop Only</span>
            </h2>
            <div className="mb-4 flex flex-wrap gap-2 md:gap-4">
              <button
                onClick={() => router.push('/register')}
                className="px-3 py-2 text-sm md:px-4 md:text-base bg-green-600 text-white rounded hover:bg-green-700"
              >
                ➕ Create New Tenant
              </button>
              <button
                onClick={loadTenants}
                className="px-3 py-2 text-sm md:px-4 md:text-base bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                🔄 Refresh List
              </button>
            </div>
            <div className="overflow-x-auto -mx-4 md:mx-0">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-900">
                  <tr>
                    <th className="px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-400 uppercase">Subdomain</th>
                    <th className="px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-400 uppercase">Name</th>
                    <th className="px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-400 uppercase hidden lg:table-cell">Admin Email</th>
                    <th className="px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                    <th className="px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-400 uppercase hidden xl:table-cell">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {tenants.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 md:px-6 py-3 md:py-4 text-center text-gray-400 text-sm">
                        No tenants found
                      </td>
                    </tr>
                  ) : (
                    tenants.map((tenant) => (
                      <tr key={tenant.subdomain} className="hover:bg-gray-750">
                        <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm text-blue-400">
                          {tenant.subdomain}
                        </td>
                        <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm text-white">
                          {tenant.name}
                        </td>
                        <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm text-gray-300 hidden lg:table-cell">
                          {tenant.adminEmail}
                        </td>
                        <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm">
                          <span className={`px-2 py-1 rounded text-xs ${
                            tenant.status === 'active'
                              ? 'bg-green-900 text-green-300'
                              : 'bg-red-900 text-red-300'
                          }`}>
                            {tenant.status}
                          </span>
                        </td>
                        <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm text-gray-300 hidden xl:table-cell">
                          {new Date(tenant.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Athlete Passcode Management Section */}
        <div className="mb-4 md:mb-6 p-4 md:p-6 bg-gray-800 border border-blue-500 rounded-lg">
          <h2 className="text-lg md:text-xl font-semibold mb-4 text-white flex items-center gap-2">
            🔐 Athlete Passcode Management
          </h2>
          <p className="text-sm text-gray-300 mb-4">
            Manage passcodes for athlete profile access. Athletes need their passcode to view their race history.
          </p>
          <div className="mb-4 flex flex-wrap gap-2 md:gap-4">
            <button
              onClick={async () => {
                try {
                  setMessage('Generating passcodes for all athletes...');
                  const response = await fetch('/api/athletes/passcodes', {
                    method: 'POST',
                  });
                  const data = await response.json();
                  if (response.ok) {
                    setMessage(`✅ ${data.message}`);
                    // Optionally reload athlete list
                  } else {
                    setMessage(`❌ Failed to generate passcodes: ${data.error}`);
                  }
                } catch (error) {
                  setMessage('❌ Error generating passcodes: ' + (error as Error).message);
                }
              }}
              className="px-3 py-2 text-sm md:px-4 md:text-base bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              🔑 Generate All Passcodes
            </button>
            <button
              onClick={() => router.push('/admin/passcodes')}
              className="px-3 py-2 text-sm md:px-4 md:text-base bg-green-600 text-white rounded hover:bg-green-700"
            >
              📋 View All Passcodes
            </button>
          </div>
          <div className="p-3 bg-gray-700 rounded-lg">
            <p className="text-xs text-gray-400">
              💡 <strong>Tip:</strong> Click "Generate All Passcodes" to create passcodes for athletes who don't have one yet.
              Then use "View All Passcodes" to see and manage individual athlete passcodes.
            </p>
          </div>
        </div>

        {/* Status Bar */}
        <div className="mb-4 md:mb-6 p-3 md:p-4 bg-gray-800 border border-gray-700 rounded-lg">
          <p className="text-xs md:text-sm text-gray-300">{message || 'Ready'}</p>
        </div>

        {/* Upload Database Section */}
        <div className="mb-4 md:mb-6 p-4 md:p-6 bg-gray-800 border border-gray-700 rounded-lg">
          <h2 className="text-lg md:text-xl font-semibold mb-4 text-white flex items-center gap-2">
            📤 Database Management
          </h2>
          
          {/* Migration Mode Selection */}
          <div className="mb-4 p-3 bg-gray-700 rounded-lg">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Migration Mode:
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => setMigrationMode('full')}
                disabled={uploading}
                className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  migrationMode === 'full'
                    ? 'bg-purple-600 text-white border-2 border-purple-400'
                    : 'bg-gray-600 text-gray-300 border-2 border-transparent hover:bg-gray-500'
                } disabled:opacity-50`}
              >
                <div className="font-bold mb-1">🔄 Full Migration</div>
                <div className="text-xs opacity-90">Replace all data (recommended)</div>
              </button>
              <button
                onClick={() => setMigrationMode('incremental')}
                disabled={uploading}
                className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  migrationMode === 'incremental'
                    ? 'bg-blue-600 text-white border-2 border-blue-400'
                    : 'bg-gray-600 text-gray-300 border-2 border-transparent hover:bg-gray-500'
                } disabled:opacity-50`}
              >
                <div className="font-bold mb-1">➕ Incremental Update</div>
                <div className="text-xs opacity-90">Add only new races</div>
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-stretch sm:items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".db"
              onChange={handleFileUpload}
              disabled={uploading}
              className="block w-full text-xs sm:text-sm text-gray-400
                file:mr-2 sm:file:mr-4 file:py-2 file:px-3 sm:file:px-4
                file:rounded file:border-0
                file:text-xs sm:file:text-sm file:font-semibold
                file:bg-purple-600 file:text-white
                hover:file:bg-purple-700
                disabled:opacity-50"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-3 py-2 text-sm sm:px-4 sm:text-base bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-600 whitespace-nowrap"
            >
              {uploading ? 'Uploading...' : 'Upload Database'}
            </button>
          
          {/* Schema Migration Button */}
          <div className="mt-4 p-3 bg-gray-700 rounded-lg border border-yellow-600">
            <p className="text-xs text-yellow-400 mb-2">
              ⚠️ Run this once to add age category columns to the database
            </p>
            <button
              onClick={async () => {
                try {
                  setMessage('Running schema migration...');
                  const response = await fetch('/api/migrate-schema', {
                    method: 'POST',
                  });
                  const data = await response.json();
                  if (response.ok) {
                    setMessage('✅ Schema migration completed successfully!');
                  } else {
                    setMessage(`❌ Schema migration failed: ${data.error}`);
                  }
                } catch (error) {
                  setMessage('❌ Schema migration error: ' + (error as Error).message);
                }
              }}
              className="px-4 py-2 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700"
            >
              🔧 Run Schema Migration
            </button>
          </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {migrationMode === 'full'
              ? '⚠️ Full migration will clear existing data and import everything from the database file'
              : '✨ Incremental update will only add new races that don\'t exist in the database'}
          </p>
        </div>

        {/* Search and Filter */}
        <div className="mb-4 md:mb-6 p-3 md:p-4 bg-gray-800 border border-gray-700 rounded-lg">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by race name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 text-sm md:text-base bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-3 py-2 text-sm md:text-base bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Years</option>
              {availableYears.slice(1).map(year => (
                <option key={year} value={year.toString()}>{year}</option>
              ))}
            </select>
          </div>
          <div className="mt-2 md:mt-3 text-xs md:text-sm text-gray-400">
            Showing {filteredRaces.length} of {races.length} races
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mb-4 md:mb-6 flex gap-2 md:gap-4">
          <button
            onClick={loadRaces}
            disabled={loading || uploading}
            className="px-3 py-2 text-sm md:px-4 md:text-base bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-600"
          >
            {loading ? 'Loading...' : '🔄 Refresh Races'}
          </button>
        </div>

        {/* Races Table */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-400 uppercase">ID</th>
                  <th className="px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-400 uppercase">Race Name</th>
                  <th className="px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-400 uppercase hidden sm:table-cell">Date</th>
                  <th className="px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
              <tbody className="divide-y divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-3 md:px-6 py-3 md:py-4 text-center text-gray-400 text-sm">
                      Loading races...
                    </td>
                  </tr>
                ) : filteredRaces.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 md:px-6 py-3 md:py-4 text-center text-gray-400 text-sm">
                      {races.length === 0 ? 'No races found' : 'No races match your filters'}
                    </td>
                  </tr>
                ) : (
                  filteredRaces.map((race) => (
                    <tr key={race.id} className="hover:bg-gray-750">
                      <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm text-gray-300">
                        {race.id}
                      </td>
                      <td className="px-3 md:px-6 py-3 md:py-4 text-xs md:text-sm text-white">
                        <div className="max-w-xs truncate">{race.name}</div>
                      </td>
                      <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm text-gray-300 hidden sm:table-cell">
                        {new Date(race.date).toLocaleString()}
                      </td>
                      <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm">
                        <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                          <button
                            onClick={() => {
                              // Preserve subdomain when navigating
                              const currentHost = window.location.host;
                              const protocol = window.location.protocol;
                              window.location.href = `${protocol}//${currentHost}/race/${race.id}`;
                            }}
                            className="px-2 py-1 text-xs md:px-3 md:text-sm bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            📊 View
                          </button>
                          <button
                            onClick={() => exportRace(race.id)}
                            disabled={exporting || uploading}
                            className="px-2 py-1 text-xs md:px-3 md:text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:bg-gray-600"
                          >
                            📥 Export
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// Made with Bob
