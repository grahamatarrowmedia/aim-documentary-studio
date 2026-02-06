
import React, { useState, useEffect } from 'react';
import { GCSBucket, VertexModelStatus, CloudStats } from '../types';
import { gcpService } from '../services/gcpService';

const CloudServices: React.FC = () => {
  const [buckets, setBuckets] = useState<GCSBucket[]>([]);
  const [models, setModels] = useState<VertexModelStatus[]>([]);
  const [stats, setStats] = useState<CloudStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateBucketModal, setShowCreateBucketModal] = useState(false);
  const [newBucketName, setNewBucketName] = useState('');
  const [newBucketRegion, setNewBucketRegion] = useState('us-central1');
  const [newBucketClass, setNewBucketClass] = useState<'Standard' | 'Nearline' | 'Coldline'>('Standard');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [bucketData, modelData, statsData] = await Promise.all([
          gcpService.listBuckets(),
          gcpService.listModels(),
          gcpService.getStats()
        ]);
        setBuckets(bucketData);
        setModels(modelData);
        setStats(statsData);
      } catch (error) {
        console.error("Failed to load cloud resources", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleDeploy = async (id: string) => {
    setModels(prev => prev.map(m => m.id === id ? { ...m, status: 'deploying' } : m));
    try {
      const model = models.find(m => m.id === id);
      if (model) {
        const newVersion = await gcpService.deployModelVersion(id, model.version);
        setModels(prev => prev.map(m =>
          m.id === id ? { ...m, status: 'active', version: newVersion } : m
        ));
      }
    } catch (error) {
      console.error("Deployment failed", error);
      setModels(prev => prev.map(m => m.id === id ? { ...m, status: 'error' } : m));
    }
  };

  const handlePurgeCache = async () => {
    const success = await gcpService.purgeCache();
    if (success) alert("CDN Cache Purged Successfully");
  };

  const handleConsoleLogin = () => {
    window.open(`https://console.cloud.google.com/run?project=${stats?.project || 'gbr-aim-aiengine-prod'}`, '_blank');
  };

  const handleCreateBucket = async () => {
    if (!newBucketName.trim()) {
      alert('Please enter a bucket name');
      return;
    }
    const newBucket: GCSBucket = {
      name: newBucketName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      region: newBucketRegion,
      storageClass: newBucketClass,
      fileCount: 0,
      sizeGb: 0
    };
    setBuckets(prev => [...prev, newBucket]);
    setShowCreateBucketModal(false);
    setNewBucketName('');
    alert(`Bucket "${newBucket.name}" created successfully`);
  };

  const maxStorage = Math.max(...buckets.map(b => b.sizeGb), 1);

  // Build Firestore collection bars for the graph
  const firestoreEntries: [string, number][] = stats?.firestore
    ? (Object.entries(stats.firestore) as [string, number][]).filter(([, v]) => v > 0)
    : [];
  const maxDocs = Math.max(...firestoreEntries.map(([, v]) => v), 1);

  // Count active vs error services
  const activeCount = models.filter(m => m.status === 'active').length;
  const errorCount = models.filter(m => m.status === 'error').length;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#1a73e8] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold uppercase tracking-widest text-gray-500">Connecting to Google Cloud...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="mb-12 flex justify-between items-end">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-[#1a73e8] p-1.5 rounded text-white text-xs font-black uppercase">GCP</span>
            <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">Cloud Infrastructure</h2>
          </div>
          <p className="text-gray-500">
            {stats ? `Project: ${stats.project} | Region: ${stats.region}` : 'Vertex AI Orchestration & Cloud Storage Management.'}
          </p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={handlePurgeCache}
            className="bg-[#1a73e8] hover:bg-[#1557b0] text-white font-bold px-6 py-2 rounded text-xs uppercase tracking-widest transition"
          >
            Purge Cache
          </button>
          <button
            onClick={handleConsoleLogin}
            className="bg-white text-black font-bold px-6 py-2 rounded text-xs uppercase tracking-widest transition hover:bg-gray-200"
          >
            Console Login
          </button>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-8">
        {/* Cloud Run Services Section */}
        <section className="col-span-12 lg:col-span-7 space-y-6">
          <div className="bg-[#111] border border-[#222] rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-[#222] bg-[#151515] flex justify-between items-center">
              <h3 className="text-sm font-bold uppercase tracking-widest text-white flex items-center gap-2">
                <span className="w-2 h-2 bg-[#1a73e8] rounded-full"></span>
                Cloud Run Services
              </h3>
              <span className="text-[10px] font-mono text-gray-500">
                {activeCount} ACTIVE / {errorCount > 0 ? `${errorCount} ERROR` : 'ALL HEALTHY'}
              </span>
            </div>

            <div className="p-0">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] uppercase font-bold text-gray-600 border-b border-[#222]">
                    <th className="p-4">Service</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Latency</th>
                    <th className="p-4">Revision</th>
                    <th className="p-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222]">
                  {models.map(m => (
                    <tr key={m.id} className="hover:bg-white/5 transition">
                      <td className="p-4">
                        <p className="text-xs font-bold text-white">{m.name}</p>
                        {m.url && (
                          <a
                            href={m.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-[#1a73e8] font-mono hover:underline truncate block max-w-[200px]"
                          >
                            {m.url.replace('https://', '')}
                          </a>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`text-[9px] font-bold px-2 py-1 rounded uppercase ${
                          m.status === 'active' ? 'bg-green-500/10 text-green-500' :
                          m.status === 'error' ? 'bg-red-500/10 text-red-500' :
                          'bg-blue-500/10 text-blue-500 animate-pulse'
                        }`}>
                          {m.status}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-xs text-gray-400">
                        {m.latencyMs >= 9999 ? '—' : `${m.latencyMs}ms`}
                      </td>
                      <td className="p-4 font-mono text-[10px] text-gray-500">{m.version}</td>
                      <td className="p-4">
                        {m.status !== 'deploying' && (
                          <button
                            onClick={() => handleDeploy(m.id)}
                            className="text-[9px] font-bold bg-[#222] hover:bg-[#1a73e8] hover:text-white text-gray-400 px-2 py-1 rounded transition uppercase"
                          >
                            Redeploy
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {models.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-600 text-xs">
                        No Cloud Run services found in {stats?.region || 'us-central1'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Firestore Document Counts */}
          <div className="bg-[#111] border border-[#222] rounded-3xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">Firestore Collections</h3>
              {stats && (
                <span className="text-[10px] font-mono text-gray-600">
                  {stats.totalDocuments} TOTAL DOCUMENTS
                </span>
              )}
            </div>
            {firestoreEntries.length > 0 ? (
              <div className="space-y-3">
                {firestoreEntries.map(([name, count]) => (
                  <div key={name} className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-gray-500 w-20 text-right">{name}</span>
                    <div className="flex-1 h-5 bg-[#1a1a1a] rounded overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#1a73e8] to-[#1a73e8]/50 rounded flex items-center justify-end pr-2 transition-all duration-500"
                        style={{ width: `${Math.max((count / maxDocs) * 100, 8)}%` }}
                      >
                        <span className="text-[9px] font-mono text-white font-bold">{count}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-24 flex items-center justify-center text-gray-600 text-xs">
                No collection data available
              </div>
            )}
          </div>
        </section>

        {/* GCS Section */}
        <section className="col-span-12 lg:col-span-5 space-y-6">
          <div className="bg-[#111] border border-[#222] rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-[#222] bg-[#151515] flex justify-between items-center">
              <h3 className="text-sm font-bold uppercase tracking-widest text-white flex items-center gap-2">
                <span className="w-2 h-2 bg-[#ffcc00] rounded-full"></span>
                Cloud Storage Buckets
              </h3>
              {stats && (
                <span className="text-[10px] font-mono text-gray-500">
                  {stats.gcsBucketCount} BUCKETS
                </span>
              )}
            </div>

            {/* Storage Chart */}
            <div className="p-6 border-b border-[#222]">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4">Storage Utilization</h4>
              <div className="space-y-4">
                {buckets.map(b => (
                  <div key={b.name} className="space-y-1">
                    <div className="flex justify-between text-[10px] text-gray-400 font-mono uppercase">
                      <span>{b.name} ({b.storageClass})</span>
                      <span>{b.sizeGb} GB</span>
                    </div>
                    <div className="h-2 bg-[#222] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${b.storageClass === 'Standard' ? 'bg-yellow-500' : 'bg-blue-500'}`}
                        style={{ width: `${(b.sizeGb / maxStorage) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 space-y-3">
              {buckets.map(b => (
                <div key={b.name} className="p-4 rounded-xl bg-[#1a1a1a] border border-[#333] hover:border-[#1a73e8] transition group cursor-pointer">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-xs font-bold text-white group-hover:text-[#1a73e8] transition">{b.name}</p>
                    <span className="text-[8px] font-mono bg-[#333] px-1.5 py-0.5 rounded text-gray-400 uppercase">{b.region}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                    <span>{b.fileCount} Objects</span>
                    <span>{b.sizeGb >= 1024 ? `${(b.sizeGb / 1024).toFixed(2)} TB` : `${b.sizeGb} GB`}</span>
                  </div>
                </div>
              ))}
              <button
                onClick={() => setShowCreateBucketModal(true)}
                className="w-full py-3 border-2 border-dashed border-[#333] rounded-xl text-[10px] font-bold text-gray-500 hover:text-white hover:border-[#1a73e8] transition uppercase"
              >
                + Create Bucket
              </button>
            </div>
          </div>

          {/* Connectivity Status */}
          <div className="bg-gradient-to-br from-[#1a73e8]/10 to-transparent border border-[#1a73e8]/20 rounded-3xl p-6">
            <h4 className="text-xs font-bold text-[#1a73e8] uppercase mb-2">Cloud Connectivity Status</h4>
            <div className="space-y-2 mb-4">
              {stats && (
                <>
                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    Region: <span className="text-gray-300 font-mono">{stats.region}</span> &middot;
                    Project: <span className="text-gray-300 font-mono">{stats.project}</span>
                  </p>
                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    Primary bucket: <span className="text-gray-300 font-mono">{stats.primaryBucketFiles} files</span> &middot;
                    <span className="text-gray-300 font-mono"> {stats.primaryBucketSizeGb} GB</span>
                  </p>
                </>
              )}
              <p className="text-[10px] text-gray-500 leading-relaxed">
                {activeCount} of {models.length} Cloud Run services responding.
                {errorCount > 0 && <span className="text-red-400"> {errorCount} service(s) unreachable.</span>}
              </p>
            </div>
            <div className={`flex items-center gap-2 text-[10px] font-bold ${errorCount > 0 ? 'text-yellow-500' : 'text-green-500'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${errorCount > 0 ? 'bg-yellow-500 animate-pulse' : 'bg-green-500 animate-ping'}`}></span>
              {errorCount > 0 ? 'DEGRADED' : 'SYSTEMS NOMINAL'}
            </div>
          </div>
        </section>
      </div>

      {/* Create Bucket Modal */}
      {showCreateBucketModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-[#111] border border-[#333] rounded-2xl w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-6">Create New Bucket</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Bucket Name</label>
                <input
                  type="text"
                  value={newBucketName}
                  onChange={(e) => setNewBucketName(e.target.value)}
                  placeholder="my-media-bucket"
                  className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#1a73e8]"
                />
                <p className="text-[9px] text-gray-600 mt-1">Lowercase letters, numbers, and hyphens only</p>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Region</label>
                <select
                  value={newBucketRegion}
                  onChange={(e) => setNewBucketRegion(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#1a73e8]"
                >
                  <option value="us-central1">us-central1 (Iowa)</option>
                  <option value="us-east1">us-east1 (South Carolina)</option>
                  <option value="europe-west1">europe-west1 (Belgium)</option>
                  <option value="asia-east1">asia-east1 (Taiwan)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Storage Class</label>
                <select
                  value={newBucketClass}
                  onChange={(e) => setNewBucketClass(e.target.value as 'Standard' | 'Nearline' | 'Coldline')}
                  className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#1a73e8]"
                >
                  <option value="Standard">Standard (Frequent access)</option>
                  <option value="Nearline">Nearline (Monthly access)</option>
                  <option value="Coldline">Coldline (Archive)</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setShowCreateBucketModal(false)}
                className="flex-1 bg-[#222] text-gray-400 font-bold py-3 rounded-lg text-xs uppercase tracking-widest hover:bg-[#333] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBucket}
                className="flex-1 bg-[#1a73e8] text-white font-bold py-3 rounded-lg text-xs uppercase tracking-widest hover:bg-[#1557b0] transition"
              >
                Create Bucket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CloudServices;
