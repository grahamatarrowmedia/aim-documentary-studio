import React, { useState, useRef } from 'react';
import { DocumentaryProject, ArchiveClip, ArchiveFolder } from '../types';
import { geminiService } from '../services/geminiService';

// Format seconds to mm:ss display
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

interface ArchivePhaseProps {
  project: DocumentaryProject;
  onAdvance: () => void;
  onNotify: (title: string, msg: string, type: any) => void;
}

const ArchivePhase: React.FC<ArchivePhaseProps> = ({ project, onAdvance, onNotify }) => {
  const [folders, setFolders] = useState<ArchiveFolder[]>([
    { id: 'folder-1', name: 'Raw Footage', type: 'local', icon: '📂' },
    { id: 'folder-2', name: 'Interviews', type: 'local', icon: '🎤' },
    { id: 'src-nasa', name: 'NASA Images', type: 'external_api', api_source: 'nasa', icon: '🚀' },
    { id: 'src-getty', name: 'Getty Images', type: 'external_api', api_source: 'getty', icon: '📸' },
    { id: 'src-ap', name: 'AP Archive', type: 'external_api', api_source: 'ap', icon: '📰' },
  ]);

  const [activeFolderId, setActiveFolderId] = useState<string>('folder-1');
  const [clips, setClips] = useState<ArchiveClip[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [externalResults, setExternalResults] = useState<ArchiveClip[]>([]);
  const [selectedClipIds, setSelectedClipIds] = useState<Set<string>>(new Set<string>());
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set<string>());
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Script beats populated from scripting phase
  const [scriptBeats] = useState<{ id: string; title: string }[]>([]);

  const activeFolder = folders.find(f => f.id === activeFolderId);
  const displayedClips = clips.filter(c => c.folder_id === activeFolderId);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedClipIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedClipIds(next);
  };

  const analyzeClip = async (id: string) => {
    setAnalyzingIds((prev: Set<string>) => new Set(prev).add(id));
    const clip = clips.find(c => c.id === id);
    if (!clip) return;
    try {
      const data = await geminiService.analyzeClip(clip.title);
      setClips(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
      onNotify('Analysis Complete', `Analyzed ${clip.title}`, 'success');
    } catch (err: any) {
      console.error(err);
      onNotify('Analysis Failed', `Could not analyze ${clip.title}`, 'error');
    } finally {
      setAnalyzingIds((prev: Set<string>) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const batchAnalyze = async () => {
    if (selectedClipIds.size === 0) return;

    onNotify('Batch Analysis', `Starting analysis for ${selectedClipIds.size} clips...`, 'info');

    // Process clips sequentially with Vertex AI
    const idsToProcess: string[] = Array.from(selectedClipIds);
    for (const id of idsToProcess) {
      await analyzeClip(id as string);
    }

    onNotify('Batch Complete', 'All selected clips analyzed with Vertex AI.', 'success');
    setSelectedClipIds(new Set<string>());
  };

  const linkToBeat = (beatId: string) => {
    setClips(prev => prev.map(c => selectedClipIds.has(c.id) ? { ...c, linked_beat_id: beatId } : c));
    setShowLinkModal(false);
    onNotify('Linked', `${selectedClipIds.size} clips linked to beat.`, 'success');
    setSelectedClipIds(new Set<string>());
  };

  const handleCreateFolder = () => {
    if (!newFolderName) return;
    const newFolder: ArchiveFolder = {
        id: `folder-${Date.now()}`,
        name: newFolderName,
        type: 'local',
        icon: '📂'
    };
    setFolders(prev => [...prev, newFolder]);
    setNewFolderName('');
    onNotify('Folder Created', `${newFolderName} added to collections.`, 'success');
  };

  const performExternalSearch = async () => {
    if (!activeFolder || !activeFolder.api_source || !searchQuery) return;
    setIsSearching(true);
    try {
        const results = await geminiService.searchArchive(searchQuery, activeFolder.name);
        const mappedResults: ArchiveClip[] = results.map((r: any, i: number) => ({
            id: `ext-${Date.now()}-${i}`,
            project_id: project.id,
            title: r.title,
            description: r.visual_description,
            archive_source: r.archive_source || activeFolder.name,
            duration_seconds: r.duration_seconds,
            in_point: 0,
            category: 'Historical',
            thumbnail_url: activeFolder.api_source === 'nasa' 
                ? 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=400&h=225' 
                : 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=400&h=225',
            visual_description: r.visual_description,
            quality_score: 90
        }));
        setExternalResults(mappedResults);
    } catch (e: any) {
        onNotify('Search Failed', 'Could not connect to archive API.', 'error');
    } finally {
        setIsSearching(false);
    }
  };

  const importExternalClip = (clip: ArchiveClip) => {
    const importFolder = folders.find(f => f.name === 'Raw Footage') || folders[0];
    if (!importFolder) return;
    const newClip = { ...clip, id: `imp-${Date.now()}`, folder_id: importFolder.id };
    setClips(prev => [newClip, ...prev]);
    onNotify('Clip Imported', `Added to ${importFolder.name}`, 'success');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.csv') || file.name.endsWith('.xlsx')) {
      onNotify('Processing Log', 'Analyzing CSV metadata with Vertex AI...', 'info');

      try {
        // Read file content
        const content = await file.text();

        // Call Vertex AI to analyze the CSV
        const response = await fetch('/api/analyze-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: content,
            fileName: file.name,
            fileType: 'text/csv'
          })
        });

        const analysis = await response.json();

        // Create clips from analyzed content
        const newClips: ArchiveClip[] = (analysis.timeline_events || []).slice(0, 5).map((event: any, i: number) => ({
          id: `csv-${Date.now()}-${i}`,
          project_id: project.id,
          folder_id: activeFolderId,
          title: event.event || `Clip ${i + 1}`,
          duration_seconds: 120,
          in_point: 0,
          category: 'B-Roll' as const,
          thumbnail_url: `https://picsum.photos/seed/${Date.now() + i}/400/225`
        }));

        if (newClips.length > 0) {
          setClips(prev => [...newClips, ...prev]);
          onNotify('Log Imported', `${newClips.length} clips created from manifest.`, 'success');
        } else {
          onNotify('Log Parsed', 'No timeline events found in file.', 'info');
        }
        setShowUploadModal(false);
      } catch (error) {
        console.error('CSV analysis failed:', error);
        onNotify('Import Failed', 'Could not parse the log file.', 'error');
      }
    } else {
      // Video file - analyze with AI
      onNotify('Uploading', `Analyzing ${file.name} with Vertex AI...`, 'info');

      try {
        // Call Vertex AI to analyze the video file name and create metadata
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `Analyze this video file name and suggest metadata: "${file.name}"
              Return JSON with: title, category (Interview/B-Roll/Establishing/Action), estimated_duration_seconds, visual_description`,
            systemInstruction: 'You are a video archive specialist. Respond with valid JSON only.',
            history: []
          })
        });

        const result = await response.json();
        let metadata = { title: file.name, category: 'B-Roll', duration_seconds: 60 };

        try {
          const parsed = JSON.parse(result.response);
          metadata = { ...metadata, ...parsed };
        } catch (e) {
          // Use defaults if parsing fails
        }

        // Validate category from API response
        const validCategories = ['Historical', 'Interview', 'B-Roll', 'Recreation', 'Infographic', 'Establishing', 'AI-Generated'] as const;
        type ValidCategory = typeof validCategories[number];
        const category: ValidCategory = validCategories.includes(metadata.category as ValidCategory)
          ? (metadata.category as ValidCategory)
          : 'B-Roll';

        const newClip: ArchiveClip = {
          id: `upl-${Date.now()}`,
          project_id: project.id,
          folder_id: activeFolderId,
          title: metadata.title || file.name,
          duration_seconds: metadata.duration_seconds || 60,
          in_point: 0,
          category,
          thumbnail_url: 'https://picsum.photos/seed/upload/400/225'
        };

        setClips(prev => [newClip, ...prev]);
        onNotify('Upload Complete', 'Asset analyzed and ready.', 'success');
        setShowUploadModal(false);
      } catch (error) {
        console.error('Video analysis failed:', error);
        // Still add the clip with basic info
        const newClip: ArchiveClip = {
          id: `upl-${Date.now()}`,
          project_id: project.id,
          folder_id: activeFolderId,
          title: file.name,
          duration_seconds: 60,
          in_point: 0,
          category: 'B-Roll',
          thumbnail_url: 'https://picsum.photos/seed/upload/400/225'
        };
        setClips(prev => [newClip, ...prev]);
        onNotify('Upload Complete', 'Asset added (analysis pending).', 'info');
        setShowUploadModal(false);
      }
    }
  };

  const getFolderThumbnail = (folderId: string) => {
      const clip = clips.find(c => c.folder_id === folderId);
      return clip?.thumbnail_url;
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-black uppercase italic tracking-tighter">PHASE 02: Digital Asset Management</h2>
          <p className="text-gray-500">Ingest, Organize & Connect to Global Archives.</p>
        </div>
        <div className="flex gap-4">
          {selectedClipIds.size > 0 ? (
            <div className="flex gap-2 animate-in fade-in">
              <button onClick={() => setShowLinkModal(true)} className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2 rounded text-xs">
                LINK TO SCRIPT ({selectedClipIds.size})
              </button>
              <button onClick={batchAnalyze} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded text-xs">
                BATCH ANALYZE ({selectedClipIds.size})
              </button>
            </div>
          ) : (
            <button onClick={() => setShowUploadModal(true)} className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2 rounded flex items-center gap-2 transition shadow-lg">
                ↑ UPLOAD / IMPORT LOG
            </button>
          )}
          <button onClick={onAdvance} className="bg-white text-black font-bold px-6 py-2 rounded flex items-center gap-2">
            LOCK VISUALS <span className="text-xl">→</span>
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
        {/* Left: Folders & Sources */}
        <div className="col-span-3 border-r border-[#222] pr-4 flex flex-col gap-6">
           {/* Local Folders */}
           <div>
              <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">My Collections</h4>
              <div className="space-y-1 mb-4">
                 {folders.filter(f => f.type === 'local').map(f => {
                    const thumb = getFolderThumbnail(f.id);
                    return (
                        <button
                            key={f.id}
                            onClick={() => { setActiveFolderId(f.id); setExternalResults([]); setSearchQuery(''); }}
                            className={`w-full text-left p-2 rounded text-xs font-medium flex items-center justify-between transition group ${activeFolderId === f.id ? 'bg-[#1a1a1a] text-white border border-[#333]' : 'text-gray-400 hover:text-white'}`}
                        >
                            <span className="flex items-center gap-3">
                                {thumb ? (
                                    <div className="w-8 h-8 rounded bg-gray-800 overflow-hidden border border-[#333]">
                                        <img src={thumb} className="w-full h-full object-cover" alt="" />
                                    </div>
                                ) : (
                                    <span className="text-xl">{f.icon}</span>
                                )}
                                <span>{f.name}</span>
                            </span>
                            {activeFolderId === f.id && <span className="text-[9px] bg-red-600/20 text-red-500 px-1.5 rounded">{clips.filter(c => c.folder_id === f.id).length}</span>}
                        </button>
                    );
                 })}
              </div>
              <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="New Folder Name"
                    className="flex-1 bg-[#0a0a0a] border border-[#333] rounded px-2 py-1 text-xs focus:outline-none focus:border-white"
                  />
                  <button onClick={handleCreateFolder} className="bg-[#222] hover:bg-[#333] text-white px-3 rounded text-xs">+</button>
              </div>
           </div>

           {/* External APIs */}
           <div>
              <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">External Archives (API)</h4>
              <div className="space-y-1">
                 {folders.filter(f => f.type === 'external_api').map(f => (
                    <button
                        key={f.id}
                        onClick={() => { setActiveFolderId(f.id); }}
                        className={`w-full text-left p-2 rounded text-xs font-medium flex items-center gap-2 transition ${activeFolderId === f.id ? 'bg-[#1a73e8]/10 text-[#1a73e8] border border-[#1a73e8]/30' : 'text-gray-400 hover:text-white'}`}
                    >
                        <span>{f.icon}</span> {f.name}
                    </button>
                 ))}
              </div>
           </div>
        </div>

        {/* Right: Content Area */}
        <div className="col-span-9 bg-[#111] border border-[#222] rounded-2xl overflow-hidden flex flex-col">
           {activeFolder?.type === 'external_api' ? (
             <div className="flex-1 flex flex-col">
                <div className="p-6 border-b border-[#222] bg-[#151515] flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">{activeFolder.icon}</span>
                        <h3 className="text-xl font-bold">{activeFolder.name} Search</h3>
                    </div>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={searchQuery} 
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={`Search ${activeFolder.name} database...`}
                            className="flex-1 bg-[#0a0a0a] border border-[#333] rounded p-3 text-sm focus:outline-none focus:border-[#1a73e8]"
                            onKeyDown={(e) => e.key === 'Enter' && performExternalSearch()}
                        />
                        <button 
                            onClick={performExternalSearch}
                            disabled={isSearching}
                            className="bg-[#1a73e8] hover:bg-[#1557b0] text-white font-bold px-6 rounded transition disabled:opacity-50"
                        >
                            {isSearching ? 'SEARCHING...' : 'SEARCH API'}
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                    {externalResults.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                            {externalResults.map(clip => (
                                <div key={clip.id} className="bg-[#0a0a0a] border border-[#333] rounded-xl overflow-hidden group">
                                    <div className="aspect-video relative">
                                        <img src={clip.thumbnail_url} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition" alt=""/>
                                        <div className="absolute bottom-2 right-2 bg-black/70 px-1.5 rounded text-[10px] font-mono">{formatDuration(clip.duration_seconds)}</div>
                                    </div>
                                    <div className="p-3">
                                        <h4 className="font-bold text-xs truncate mb-1 text-gray-200">{clip.title}</h4>
                                        <p className="text-[10px] text-gray-500 line-clamp-2 mb-3">{clip.description}</p>
                                        <button 
                                            onClick={() => importExternalClip(clip)}
                                            className="w-full py-1.5 bg-[#222] hover:bg-[#1a73e8] hover:text-white rounded text-[10px] font-bold text-gray-400 transition"
                                        >
                                            IMPORT TO BIN
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center opacity-30">
                            <span className="text-6xl mb-4">🛰️</span>
                            <p className="text-sm font-bold uppercase tracking-widest">Connect to {activeFolder.name}</p>
                        </div>
                    )}
                </div>
             </div>
           ) : (
             <div className="flex-1 flex flex-col">
                <div className="p-6 border-b border-[#222] bg-[#151515] flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">{activeFolder?.icon}</span>
                        <div>
                            <h3 className="text-xl font-bold">{activeFolder?.name}</h3>
                            <p className="text-xs text-gray-500">{displayedClips.length} assets stored locally</p>
                        </div>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                    {displayedClips.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {displayedClips.map(clip => (
                                <div 
                                    key={clip.id} 
                                    className={`bg-[#0a0a0a] border rounded-xl overflow-hidden group transition ${selectedClipIds.has(clip.id) ? 'border-red-600 shadow-[0_0_10px_rgba(220,38,38,0.2)]' : 'border-[#333]'}`}
                                >
                                    <div className="aspect-video relative">
                                        <button 
                                            onClick={() => toggleSelect(clip.id)}
                                            className={`absolute top-2 left-2 w-5 h-5 rounded border z-10 transition flex items-center justify-center ${selectedClipIds.has(clip.id) ? 'bg-red-600 border-red-600' : 'bg-black/50 border-white/30 hover:border-white'}`}
                                        >
                                            {selectedClipIds.has(clip.id) && <span className="text-[10px]">✓</span>}
                                        </button>
                                        <img src={clip.thumbnail_url} className="w-full h-full object-cover" alt="" />
                                        
                                        {/* Status Badges Overlay */}
                                        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                                            <span className="text-[8px] font-bold text-white bg-red-600 px-1.5 py-0.5 rounded uppercase">{clip.category}</span>
                                            {clip.quality_score && (
                                                <span className="text-[8px] font-bold text-white bg-green-600 px-1.5 py-0.5 rounded uppercase font-mono">Q:{clip.quality_score}</span>
                                            )}
                                            {clip.linked_beat_id && (
                                                <span className="text-[8px] font-bold text-white bg-purple-600 px-1.5 py-0.5 rounded uppercase">LINKED</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="p-3">
                                        <h4 className="font-bold text-xs truncate mb-1">{clip.title}</h4>
                                        {clip.mood && (
                                            <div className="mb-2 flex items-center gap-2 text-[9px] text-gray-500 font-mono uppercase">
                                                <span>Mood: {clip.mood}</span>
                                            </div>
                                        )}
                                        {clip.visual_description && (
                                             <p className="text-[9px] text-gray-600 mb-2 line-clamp-2 leading-relaxed" title={clip.visual_description}>
                                                {clip.visual_description}
                                             </p>
                                        )}
                                        <button 
                                          onClick={() => analyzeClip(clip.id)}
                                          disabled={analyzingIds.has(clip.id)}
                                          className="w-full py-1.5 bg-[#222] hover:bg-[#333] text-[9px] font-bold rounded uppercase tracking-widest text-gray-400 transition"
                                        >
                                            {analyzingIds.has(clip.id) ? 'ANALYZING...' : 'AI INSPECT'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center opacity-30 cursor-pointer" onClick={() => setShowUploadModal(true)}>
                            <span className="text-6xl mb-4">📁</span>
                            <p className="text-sm font-bold uppercase tracking-widest">Folder Empty</p>
                            <p className="text-xs">Drag & drop files or import log</p>
                        </div>
                    )}
                </div>
             </div>
           )}
        </div>
      </div>

      {/* Upload/Import Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#1a1a1a] border border-[#333] w-full max-w-lg p-8 rounded-2xl shadow-2xl animate-in fade-in scale-in duration-200">
                <h3 className="text-2xl font-bold text-white mb-6">Ingest Media</h3>

                <div className="space-y-6">
                    <div className="border-2 border-dashed border-[#333] hover:border-red-600 rounded-xl p-8 text-center transition cursor-pointer relative group">
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            onChange={handleFileUpload}
                            accept="video/*,.csv,.xlsx"
                        />
                        <div className="text-4xl mb-4 grayscale group-hover:grayscale-0 transition">📥</div>
                        <p className="text-sm font-bold text-white">Drag & Drop Files Here</p>
                        <p className="text-xs text-gray-500 mt-2">Supports .mp4, .mov, or .csv/.xlsx (Manifest Logs)</p>
                    </div>

                    <div className="bg-[#111] p-4 rounded-lg border border-[#222]">
                        <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Manifest Template</h4>
                        <div className="flex items-center gap-3 text-xs text-gray-500 font-mono">
                            <div className="bg-[#000] p-2 rounded">Filename</div>
                            <div className="bg-[#000] p-2 rounded">Description</div>
                            <div className="bg-[#000] p-2 rounded">TC_In</div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex justify-between">
                    <button onClick={() => setShowUploadModal(false)} className="text-xs font-bold text-gray-500 hover:text-white uppercase tracking-widest">Cancel</button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2 rounded text-xs uppercase tracking-widest transition"
                    >
                      Browse Files
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Link to Script Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <div className="bg-[#1a1a1a] border border-[#333] w-full max-w-md p-6 rounded-2xl shadow-2xl animate-in fade-in scale-in duration-200">
                <h3 className="text-xl font-bold text-white mb-4">Link Clips to Script Beat</h3>
                <p className="text-xs text-gray-500 mb-4">Select a beat to associate with the {selectedClipIds.size} selected clips.</p>
                <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                    {scriptBeats.map(beat => (
                        <button 
                            key={beat.id}
                            onClick={() => linkToBeat(beat.id)}
                            className="w-full text-left p-3 rounded bg-[#111] hover:bg-[#222] border border-[#222] hover:border-gray-600 transition text-sm text-gray-300"
                        >
                            {beat.title}
                        </button>
                    ))}
                </div>
                <div className="mt-6 flex justify-end">
                    <button onClick={() => setShowLinkModal(false)} className="text-xs font-bold text-gray-500 hover:text-white uppercase tracking-widest">Cancel</button>
                </div>
             </div>
        </div>
      )}
    </div>
  );
};

export default ArchivePhase;