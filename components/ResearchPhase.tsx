
import React, { useState, useRef, useEffect } from 'react';
import { DocumentaryProject, DocumentaryNotebook, UserProfile, ResearchSeries, ResearchEpisode, KnowledgeAsset, ArchiveClip, ManualSource } from '../types';
import { geminiService } from '../services/geminiService';
import { apiService } from '../services/apiService';

interface ResearchPhaseProps {
  project: DocumentaryProject;
  user: UserProfile;
  onAdvance: () => void;
  onNotify: (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

// Extended types for NotebookLM-style sources with Vertex AI analysis
interface ResearchSource {
  id: string;
  episode_id: string;
  type: 'url' | 'file' | 'text' | 'youtube';
  title: string;
  content?: string;
  url?: string;
  file_name?: string;
  file_size?: string;
  status: 'pending' | 'processing' | 'indexed' | 'error';
  added_at: string;
  summary?: string;
  key_topics?: string[];
  key_facts?: string[];
  suggested_questions?: string[];
}

interface ResearchQuery {
  id: string;
  episode_id: string;
  query: string;
  response?: string;
  key_facts?: string[];
  sources_used?: string[];
  timestamp: string;
  engine: string;
}

const ResearchPhase: React.FC<ResearchPhaseProps> = ({ project, user, onAdvance, onNotify }) => {
  // ---------------------------------------------------------------------------
  // DATA MODEL: Series & Episodes
  // ---------------------------------------------------------------------------
  const [seriesList, setSeriesList] = useState<ResearchSeries[]>([]);

  const [episodesList, setEpisodesList] = useState<ResearchEpisode[]>([]);

  // ---------------------------------------------------------------------------
  // STATE: Navigation & Selection
  // ---------------------------------------------------------------------------
  const [activeSeriesId, setActiveSeriesId] = useState<string>('');
  const [activeEpisodeId, setActiveEpisodeId] = useState<string>('');
  const [isAddingEpisode, setIsAddingEpisode] = useState(false);
  const [newEpisodeTitle, setNewEpisodeTitle] = useState('');
  const [isAddingSeries, setIsAddingSeries] = useState(false);
  const [newSeriesTitle, setNewSeriesTitle] = useState('');

  // ---------------------------------------------------------------------------
  // STATE: NotebookLM-style Sources & Research
  // ---------------------------------------------------------------------------
  const [sources, setSources] = useState<ResearchSource[]>([]);

  const [researchQueries, setResearchQueries] = useState<ResearchQuery[]>([]);

  // ---------------------------------------------------------------------------
  // LOAD DATA FROM BACKEND
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const loadData = async () => {
      try {
        const [series, episodes, assets, research] = await Promise.all([
          apiService.getSeriesByProject(project.id),
          apiService.getEpisodesByProject(project.id),
          apiService.getAssetsByProject(project.id),
          apiService.getResearchByProject(project.id),
        ]);
        setSeriesList(series.map((s: any) => ({ id: s.id, title: s.title, icon: s.icon || '📁' })));
        setEpisodesList(episodes.map((e: any) => ({
          id: e.id, series_id: e.series_id, episode_number: e.episode_number, title: e.title, status: e.status || 'planning'
        })));
        // Research sources stored as assets with assetType='research_source'
        const researchSources = assets.filter((a: any) => a.assetType === 'research_source');
        setSources(researchSources);
        setResearchQueries(research);
        // Auto-select first series if available
        if (series.length > 0) {
          setActiveSeriesId(series[0].id);
          const firstSeriesEps = episodes.filter((e: any) => e.series_id === series[0].id);
          if (firstSeriesEps.length > 0) setActiveEpisodeId(firstSeriesEps[0].id);
        }
      } catch (err) {
        console.error('Failed to load research data:', err);
      }
    };
    loadData();
  }, [project.id]);

  // Add source modal state
  const [showAddSourceModal, setShowAddSourceModal] = useState(false);
  const [newSourceType, setNewSourceType] = useState<'url' | 'file' | 'text' | 'youtube'>('url');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [newSourceText, setNewSourceText] = useState('');
  const [newSourceTitle, setNewSourceTitle] = useState('');

  // Research query state
  const [researchPrompt, setResearchPrompt] = useState('');
  const [selectedEngine, setSelectedEngine] = useState<string>('google_deep_research');
  const [isResearching, setIsResearching] = useState(false);
  const [researchStep, setResearchStep] = useState('');

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived State
  const activeSeries = seriesList.find(s => s.id === activeSeriesId);
  const activeEpisode = episodesList.find(e => e.id === activeEpisodeId);
  const filteredEpisodes = episodesList.filter(e => e.series_id === activeSeriesId);
  const episodeSources = sources.filter(s => s.episode_id === activeEpisodeId);
  const episodeQueries = researchQueries.filter(q => q.episode_id === activeEpisodeId);

  // ---------------------------------------------------------------------------
  // ACTIONS: Series
  // ---------------------------------------------------------------------------
  const handleAddSeries = async () => {
    if (!newSeriesTitle.trim()) return;
    try {
      const saved = await apiService.createSeries({
        projectId: project.id,
        title: newSeriesTitle,
        icon: '📁',
        order: seriesList.length
      });
      const newSeries: ResearchSeries = { id: saved.id, title: saved.title, icon: saved.icon || '📁' };
      setSeriesList(prev => [...prev, newSeries]);
      setActiveSeriesId(saved.id);
      setActiveEpisodeId('');
      onNotify('Series Created', newSeriesTitle, 'success');
    } catch (err) {
      console.error('Failed to create series:', err);
      onNotify('Error', 'Failed to create series', 'error');
    }
    setIsAddingSeries(false);
    setNewSeriesTitle('');
  };

  // ---------------------------------------------------------------------------
  // ACTIONS: Episodes
  // ---------------------------------------------------------------------------
  const handleAddEpisode = async () => {
    if (!newEpisodeTitle.trim() || !activeSeriesId) return;
    const currentSeriesEpisodes = episodesList.filter(e => e.series_id === activeSeriesId);
    const nextEpNum = currentSeriesEpisodes.length > 0
      ? Math.max(...currentSeriesEpisodes.map(e => e.episode_number)) + 1
      : 1;

    try {
      const saved = await apiService.createEpisode({
        projectId: project.id,
        series_id: activeSeriesId,
        episode_number: nextEpNum,
        title: newEpisodeTitle,
        status: 'planning'
      });
      const newEp: ResearchEpisode = {
        id: saved.id,
        series_id: activeSeriesId,
        episode_number: nextEpNum,
        title: newEpisodeTitle,
        status: 'planning'
      };
      setEpisodesList(prev => [...prev, newEp]);
      onNotify('Episode Created', `EP${nextEpNum}: ${newEpisodeTitle}`, 'success');
      setActiveEpisodeId(saved.id);
    } catch (err) {
      console.error('Failed to create episode:', err);
      onNotify('Error', 'Failed to create episode', 'error');
    }
    setIsAddingEpisode(false);
    setNewEpisodeTitle('');
  };

  // ---------------------------------------------------------------------------
  // ACTIONS: Sources (NotebookLM-style) - Real Vertex AI Intelligence
  // ---------------------------------------------------------------------------
  const handleAddSource = async () => {
    if (!activeEpisodeId) return;

    let newSource: ResearchSource;
    const timestamp = new Date().toLocaleTimeString();

    if (newSourceType === 'url' || newSourceType === 'youtube') {
      if (!newSourceUrl.trim()) return;
      newSource = {
        id: `src-${Date.now()}`,
        episode_id: activeEpisodeId,
        type: newSourceType,
        title: newSourceTitle || new URL(newSourceUrl).hostname,
        url: newSourceUrl,
        status: 'processing',
        added_at: timestamp
      };
    } else if (newSourceType === 'text') {
      if (!newSourceText.trim()) return;
      newSource = {
        id: `src-${Date.now()}`,
        episode_id: activeEpisodeId,
        type: 'text',
        title: newSourceTitle || 'Pasted Text',
        content: newSourceText,
        status: 'processing',
        added_at: timestamp
      };
    } else {
      return;
    }

    setSources(prev => [newSource, ...prev]);
    setShowAddSourceModal(false);
    setNewSourceUrl('');
    setNewSourceText('');
    setNewSourceTitle('');
    onNotify('Source Added', `Analyzing with Vertex AI...`, 'info');

    // Real Vertex AI indexing
    try {
      const analysis = await apiService.indexSource({
        type: newSource.type,
        url: newSource.url,
        content: newSource.content,
        title: newSource.title
      });

      if (analysis.status === 'indexed') {
        const indexedSource = {
          ...newSource,
          status: 'indexed' as const,
          title: analysis.title || newSource.title,
          summary: analysis.summary,
          key_topics: analysis.key_topics,
          key_facts: analysis.key_facts
        };
        // Persist to backend
        const saved = await apiService.createAsset({
          ...indexedSource, projectId: project.id, assetType: 'research_source'
        });
        setSources(prev => prev.map(s =>
          s.id === newSource.id ? { ...indexedSource, id: saved.id } : s
        ));
        onNotify('Source Indexed', `${analysis.title || newSource.title} analyzed successfully.`, 'success');
      } else {
        throw new Error(analysis.error || 'Indexing failed');
      }
    } catch (error) {
      console.error('Source indexing failed:', error);
      setSources(prev => prev.map(s =>
        s.id === newSource.id ? { ...s, status: 'error' } : s
      ));
      onNotify('Indexing Failed', `Could not analyze ${newSource.title}.`, 'error');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !activeEpisodeId) return;

    const files: File[] = Array.from(e.target.files);
    setShowAddSourceModal(false);

    for (const file of files) {
      const newSource: ResearchSource = {
        id: `src-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        episode_id: activeEpisodeId,
        type: 'file',
        title: file.name,
        file_name: file.name,
        file_size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        status: 'processing',
        added_at: new Date().toLocaleTimeString()
      };

      setSources(prev => [newSource, ...prev]);
      onNotify('File Uploaded', `Analyzing ${file.name} with Vertex AI...`, 'info');

      // Read file content and analyze with Vertex AI
      try {
        const fileContent = await readFileContent(file);

        const analysis = await apiService.analyzeDocument({
          content: fileContent,
          fileName: file.name,
          fileType: file.type || getFileTypeFromName(file.name)
        });

        if (analysis.status === 'indexed') {
          const indexedSource = {
            ...newSource,
            status: 'indexed' as const,
            title: analysis.title || newSource.title,
            summary: analysis.summary,
            key_topics: analysis.key_topics,
            key_facts: analysis.key_facts
          };
          const saved = await apiService.createAsset({
            ...indexedSource, projectId: project.id, assetType: 'research_source'
          });
          setSources(prev => prev.map(s =>
            s.id === newSource.id ? { ...indexedSource, id: saved.id } : s
          ));
          onNotify('Document Analyzed', `${file.name} indexed with ${(analysis.key_facts || []).length} key facts.`, 'success');
        } else {
          throw new Error(analysis.error || 'Analysis failed');
        }
      } catch (error) {
        console.error('File analysis failed:', error);
        setSources(prev => prev.map(s =>
          s.id === newSource.id ? { ...s, status: 'error' } : s
        ));
        onNotify('Analysis Failed', `Could not analyze ${file.name}.`, 'error');
      }
    }

    e.target.value = '';
  };

  // Helper to read file content as text
  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  // Helper to get file type from name
  const getFileTypeFromName = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return 'application/pdf';
      case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'txt': return 'text/plain';
      case 'md': return 'text/markdown';
      case 'csv': return 'text/csv';
      case 'json': return 'application/json';
      default: return 'text/plain';
    }
  };

  const removeSource = (sourceId: string) => {
    setSources(prev => prev.filter(s => s.id !== sourceId));
    apiService.deleteAsset(sourceId).catch(err => console.error('Failed to delete source:', err));
    onNotify('Source Removed', 'Source removed from research context.', 'info');
  };

  // ---------------------------------------------------------------------------
  // ACTIONS: Research Queries - Real Vertex AI Multi-Source Research
  // ---------------------------------------------------------------------------
  const executeResearch = async () => {
    if (!researchPrompt.trim() || !activeEpisodeId) return;

    setIsResearching(true);
    const queryId = `q-${Date.now()}`;
    const indexedSources = episodeSources.filter(s => s.status === 'indexed');

    const steps = [
      `Loading ${indexedSources.length} indexed sources...`,
      `Engine: ${selectedEngine.replace(/_/g, ' ').toUpperCase()}`,
      "Cross-referencing across sources...",
      "AI research in progress..."
    ];

    try {
      // Show progress steps
      for (const step of steps) {
        setResearchStep(step);
        await new Promise(r => setTimeout(r, 400));
      }

      // Prepare source data for the query
      const sourcesForQuery = indexedSources.map(s => ({
        title: s.title,
        summary: s.summary || '',
        key_facts: s.key_facts || [],
        key_topics: s.key_topics || [],
        type: s.type
      }));

      // Call the multi-source query API
      const result = await apiService.querySources({
        query: researchPrompt,
        sources: sourcesForQuery,
        engine: selectedEngine
      });

      if (result.error) {
        throw new Error(result.error);
      }

      const queryData = {
        episode_id: activeEpisodeId,
        query: researchPrompt,
        response: result.response || 'Research completed.',
        key_facts: result.key_facts || [],
        sources_used: indexedSources.map(s => s.id),
        timestamp: new Date().toLocaleTimeString(),
        engine: selectedEngine
      };

      // Persist to backend
      const saved = await apiService.createResearch({ ...queryData, projectId: project.id });

      const newQuery: ResearchQuery = { ...queryData, id: saved.id };
      setResearchQueries(prev => [newQuery, ...prev]);

      // Also store the result as a new indexed source for future cross-referencing
      const sourcePayload = {
        projectId: project.id,
        episode_id: activeEpisodeId,
        assetType: 'research_source',
        type: 'text',
        title: `Research: ${researchPrompt.slice(0, 80)}`,
        status: 'indexed',
        summary: result.response || '',
        key_topics: result.key_topics || result.key_facts?.slice(0, 5) || [],
        key_facts: result.key_facts || [],
        added_at: new Date().toISOString()
      };
      const savedSource = await apiService.createAsset(sourcePayload);
      setSources(prev => [...prev, { ...sourcePayload, id: savedSource.id } as ResearchSource]);

      setResearchPrompt('');
      onNotify('Research Complete', `Found ${(result.key_facts || []).length} key facts from ${indexedSources.length} sources. Result added as new source.`, 'success');
    } catch (error) {
      console.error("Research Failed", error);
      onNotify('Research Error', 'Failed to complete research query.', 'error');
    } finally {
      setIsResearching(false);
      setResearchStep('');
    }
  };

  // Helper for engine badges
  const getEngineBadge = (engine: string) => {
    switch (engine) {
      case 'vertex_ai': return { label: 'VERTEX AI', color: 'bg-[#1a73e8] text-white' };
      case 'perplexity': return { label: 'PERPLEXITY', color: 'bg-teal-600 text-white' };
      case 'google_deep_research': return { label: 'DEEP RESEARCH', color: 'bg-gradient-to-r from-blue-500 via-red-500 to-yellow-500 text-white' };
      default: return { label: 'GEMINI', color: 'bg-purple-600 text-white' };
    }
  };

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'url': return '🔗';
      case 'youtube': return '▶️';
      case 'file': return '📄';
      case 'text': return '📝';
      default: return '📎';
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col font-sans">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-black uppercase italic tracking-tighter">PHASE 01: Intelligent Discovery</h2>
          <p className="text-gray-500">Deep Research & Knowledge Synthesis | Project: <span className="text-white font-bold">{project.title}</span></p>
        </div>
        <button
          onClick={onAdvance}
          className="bg-white text-black font-bold px-6 py-2 rounded flex items-center gap-2 hover:bg-gray-200 transition"
        >
          NEXT PHASE <span className="text-xl">→</span>
        </button>
      </div>

      <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">

        {/* COL 1: Series & Episode Selection */}
        <div className="col-span-2 flex flex-col gap-4 border-r border-[#222] pr-4 overflow-y-auto">
          <div>
            <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Series</h4>
            <div className="space-y-1">
              {seriesList.map(s => (
                <div key={s.id} className="group/ser flex items-center">
                  <button
                    onClick={() => { setActiveSeriesId(s.id); setActiveEpisodeId(''); }}
                    className={`flex-1 text-left p-2 rounded text-xs font-bold flex items-center gap-2 transition ${activeSeriesId === s.id ? 'bg-white text-black' : 'text-gray-400 hover:bg-[#1a1a1a] hover:text-white'}`}
                  >
                    <span>{s.icon}</span> {s.title}
                  </button>
                  <button
                    onClick={() => { apiService.deleteSeries(s.id).catch(console.error); setSeriesList(prev => prev.filter(x => x.id !== s.id)); setEpisodesList(prev => prev.filter(e => e.series_id !== s.id)); if (activeSeriesId === s.id) { setActiveSeriesId(''); setActiveEpisodeId(''); } }}
                    className="opacity-0 group-hover/ser:opacity-100 text-gray-600 hover:text-red-500 transition text-[10px] px-1"
                    title="Delete series"
                  >✕</button>
                </div>
              ))}
              {!isAddingSeries ? (
                <button onClick={() => setIsAddingSeries(true)} className="w-full text-left p-2 text-[10px] text-gray-600 hover:text-gray-400">+ Add Series</button>
              ) : (
                <div className="p-2 bg-[#1a1a1a] rounded">
                  <input
                    autoFocus type="text" value={newSeriesTitle}
                    onChange={(e) => setNewSeriesTitle(e.target.value)}
                    placeholder="Series Title"
                    className="w-full bg-transparent text-xs text-white placeholder-gray-600 focus:outline-none mb-2"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSeries()}
                  />
                  <div className="flex gap-1">
                    <button onClick={handleAddSeries} className="text-[9px] font-bold text-white bg-green-600 px-2 py-1 rounded">CREATE</button>
                    <button onClick={() => setIsAddingSeries(false)} className="text-[9px] text-gray-400 px-2 py-1">CANCEL</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1">
            <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Episodes</h4>
            <div className="space-y-1">
              {filteredEpisodes.map(ep => (
                <div key={ep.id} className="group/ep flex items-center">
                  <button
                    onClick={() => setActiveEpisodeId(ep.id)}
                    className={`flex-1 text-left p-2 rounded text-xs font-medium transition ${activeEpisodeId === ep.id ? 'bg-[#1a1a1a] text-white border-l-2 border-red-600' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    <span className="font-mono opacity-50 mr-1">EP{ep.episode_number.toString().padStart(2, '0')}</span>
                    <span className="truncate">{ep.title}</span>
                  </button>
                  <button
                    onClick={() => { apiService.deleteEpisode(ep.id).catch(console.error); setEpisodesList(prev => prev.filter(x => x.id !== ep.id)); if (activeEpisodeId === ep.id) setActiveEpisodeId(''); }}
                    className="opacity-0 group-hover/ep:opacity-100 text-gray-600 hover:text-red-500 transition text-[10px] px-1"
                    title="Delete episode"
                  >✕</button>
                </div>
              ))}
              {!isAddingEpisode ? (
                <button onClick={() => setIsAddingEpisode(true)} disabled={!activeSeriesId} className="w-full text-left p-2 text-[10px] text-gray-600 hover:text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed">{activeSeriesId ? '+ Add Episode' : 'Select a series first'}</button>
              ) : (
                <div className="p-2 bg-[#1a1a1a] rounded">
                  <input
                    autoFocus
                    type="text"
                    value={newEpisodeTitle}
                    onChange={(e) => setNewEpisodeTitle(e.target.value)}
                    placeholder="Episode Title"
                    className="w-full bg-transparent text-xs text-white placeholder-gray-600 focus:outline-none mb-2"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddEpisode()}
                  />
                  <div className="flex gap-1">
                    <button onClick={handleAddEpisode} className="text-[9px] font-bold text-white bg-green-600 px-2 py-1 rounded">CREATE</button>
                    <button onClick={() => setIsAddingEpisode(false)} className="text-[9px] text-gray-400 px-2 py-1">CANCEL</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* COL 2: Sources Panel (NotebookLM-style) */}
        <div className="col-span-3 flex flex-col border-r border-[#222] pr-4">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              Sources ({episodeSources.length})
            </h4>
            <button
              onClick={() => setShowAddSourceModal(true)}
              disabled={!activeEpisodeId}
              className="text-[10px] bg-[#1a73e8] hover:bg-[#1557b0] text-white px-3 py-1 rounded font-bold transition disabled:opacity-50"
            >
              + ADD SOURCE
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2">
            {episodeSources.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-[#333] rounded-xl">
                <div className="text-3xl mb-2 opacity-30">📚</div>
                <p className="text-xs text-gray-500 mb-2">No sources added yet</p>
                <p className="text-[10px] text-gray-600">Add URLs, files, or text to build your research context</p>
              </div>
            ) : (
              episodeSources.map(source => (
                <div
                  key={source.id}
                  className="p-3 rounded-xl border border-[#222] hover:border-[#333] bg-[#111] transition group"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{getSourceIcon(source.type)}</span>
                    <div className="flex-1 min-w-0">
                      <h5 className="text-xs font-bold text-gray-200 truncate">{source.title}</h5>
                      {source.url && (
                        <p className="text-[9px] text-[#1a73e8] truncate">{source.url}</p>
                      )}
                      {source.file_size && (
                        <p className="text-[9px] text-gray-500">{source.file_size}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase ${
                          source.status === 'indexed' ? 'bg-green-900/30 text-green-500' :
                          source.status === 'processing' ? 'bg-blue-900/30 text-blue-400' :
                          'bg-gray-800 text-gray-500'
                        }`}>
                          {source.status}
                        </span>
                        <span className="text-[9px] text-gray-600">{source.added_at}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeSource(source.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-500 transition text-xs"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Quick stats */}
          {episodeSources.length > 0 && (
            <div className="mt-3 p-3 bg-[#0a0a0a] rounded-lg border border-[#222]">
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-500">Indexed:</span>
                <span className="text-green-500 font-bold">{episodeSources.filter(s => s.status === 'indexed').length}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-500">Research Queries:</span>
                <span className="text-white font-bold">{episodeQueries.length}</span>
              </div>
            </div>
          )}
        </div>

        {/* COL 3: Research Interface */}
        <div className="col-span-7 bg-[#111] border border-[#222] rounded-2xl overflow-hidden flex flex-col">
          {/* Research Input */}
          <div className="p-4 border-b border-[#222] bg-[#0a0a0a]">
            <div className="flex items-center gap-2 mb-3">
              <select
                value={selectedEngine}
                onChange={(e) => setSelectedEngine(e.target.value)}
                className="bg-[#1a1a1a] border border-[#333] text-[10px] px-3 py-2 rounded font-bold uppercase text-white"
              >
                <option value="google_deep_research">Deep Research</option>
                <option value="vertex_ai">Vertex AI</option>
                <option value="gemini_pro">Gemini Pro</option>
                <option value="perplexity">Perplexity</option>
              </select>
              <span className="text-[10px] text-gray-500">
                {episodeSources.filter(s => s.status === 'indexed').length} sources indexed
              </span>
            </div>

            <div className="relative">
              <textarea
                value={researchPrompt}
                onChange={(e) => setResearchPrompt(e.target.value)}
                placeholder={activeEpisodeId ? `Ask a question about "${activeEpisode?.title}"...` : 'Select an episode to start researching'}
                className="w-full bg-[#1a1a1a] border border-[#333] text-white placeholder-gray-500 text-sm p-4 pr-14 rounded-xl outline-none resize-none focus:border-[#1a73e8] transition"
                rows={2}
                disabled={!activeEpisodeId || isResearching}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); executeResearch(); } }}
              />
              <button
                onClick={executeResearch}
                disabled={!researchPrompt.trim() || !activeEpisodeId || isResearching}
                className={`absolute right-3 bottom-3 w-10 h-10 rounded-full flex items-center justify-center transition ${
                  researchPrompt.trim() && activeEpisodeId && !isResearching
                    ? 'bg-[#1a73e8] text-white hover:bg-[#1557b0]'
                    : 'bg-[#333] text-gray-500 cursor-not-allowed'
                }`}
              >
                {isResearching ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  '➤'
                )}
              </button>
            </div>

            {isResearching && (
              <div className="mt-2 text-[10px] text-[#1a73e8] font-mono animate-pulse">{researchStep}</div>
            )}
          </div>

          {/* Research Results */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {episodeQueries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-[#1a73e8] to-[#8ab4f8] rounded-2xl flex items-center justify-center mb-4">
                  <span className="text-3xl">✦</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Deep Research</h3>
                <p className="text-gray-500 text-sm max-w-md">
                  Add sources and ask questions to build up your research for{' '}
                  <span className="text-white">{activeEpisode?.title || 'this episode'}</span>
                </p>
              </div>
            ) : (
              episodeQueries.map(q => {
                const badge = getEngineBadge(q.engine);
                return (
                  <div key={q.id} className="bg-[#0a0a0a] border border-[#222] rounded-xl p-4 group/query">
                    {/* Query */}
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-8 h-8 bg-[#1a1a1a] rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-sm">❓</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-white font-medium">{q.query}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold ${badge.color}`}>{badge.label}</span>
                          <span className="text-[9px] text-gray-500">{q.timestamp}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => { setResearchQueries(prev => prev.filter(rq => rq.id !== q.id)); apiService.deleteResearch(q.id).catch(console.error); }}
                        className="opacity-0 group-hover/query:opacity-100 text-gray-600 hover:text-red-500 transition text-xs flex-shrink-0"
                        title="Delete research"
                      >✕</button>
                    </div>

                    {/* Response */}
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-[#1a73e8] to-[#8ab4f8] rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-sm">✦</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-300 leading-relaxed">{q.response}</p>

                        {q.key_facts && q.key_facts.length > 0 && (
                          <div className="mt-4 bg-[#1a1a1a] rounded-lg p-3">
                            <h5 className="text-[10px] font-bold text-gray-500 uppercase mb-2">Key Facts</h5>
                            <ul className="space-y-1">
                              {q.key_facts.map((fact, i) => (
                                <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                                  <span className="text-green-500">•</span>
                                  {fact}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {q.sources_used && q.sources_used.length > 0 && (
                          <div className="mt-2 flex items-center gap-1 text-[9px] text-gray-500">
                            <span>Sources used:</span>
                            {q.sources_used.map(srcId => {
                              const src = sources.find(s => s.id === srcId);
                              return src ? (
                                <span key={srcId} className="bg-[#222] px-2 py-0.5 rounded">{src.title}</span>
                              ) : null;
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Add Source Modal */}
      {showAddSourceModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-[#333] w-full max-w-lg p-6 rounded-2xl shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">Add Source</h3>

            {/* Source Type Tabs */}
            <div className="flex gap-2 mb-4">
              {(['url', 'file', 'text', 'youtube'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setNewSourceType(type)}
                  className={`px-3 py-2 rounded-lg text-xs font-bold uppercase transition ${
                    newSourceType === type ? 'bg-[#1a73e8] text-white' : 'bg-[#222] text-gray-400 hover:text-white'
                  }`}
                >
                  {type === 'url' ? '🔗 URL' : type === 'file' ? '📄 File' : type === 'text' ? '📝 Text' : '▶️ YouTube'}
                </button>
              ))}
            </div>

            {/* Source Input */}
            <div className="space-y-3">
              {(newSourceType === 'url' || newSourceType === 'youtube') && (
                <>
                  <input
                    type="text"
                    value={newSourceTitle}
                    onChange={(e) => setNewSourceTitle(e.target.value)}
                    placeholder="Title (optional)"
                    className="w-full bg-[#111] border border-[#333] rounded-lg p-3 text-sm text-white placeholder-gray-500 focus:border-[#1a73e8] outline-none"
                  />
                  <input
                    type="url"
                    value={newSourceUrl}
                    onChange={(e) => setNewSourceUrl(e.target.value)}
                    placeholder={newSourceType === 'youtube' ? 'YouTube URL...' : 'https://...'}
                    className="w-full bg-[#111] border border-[#333] rounded-lg p-3 text-sm text-white placeholder-gray-500 focus:border-[#1a73e8] outline-none"
                  />
                </>
              )}

              {newSourceType === 'file' && (
                <div className="border-2 border-dashed border-[#333] rounded-xl p-8 text-center hover:border-[#1a73e8] transition cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileUpload}
                    accept=".pdf,.docx,.txt,.csv,.json,.md"
                    multiple
                  />
                  <div className="text-4xl mb-2">📁</div>
                  <p className="text-sm text-gray-400">Click to upload files</p>
                  <p className="text-[10px] text-gray-600 mt-1">PDF, DOCX, TXT, CSV, JSON, MD</p>
                </div>
              )}

              {newSourceType === 'text' && (
                <>
                  <input
                    type="text"
                    value={newSourceTitle}
                    onChange={(e) => setNewSourceTitle(e.target.value)}
                    placeholder="Title (optional)"
                    className="w-full bg-[#111] border border-[#333] rounded-lg p-3 text-sm text-white placeholder-gray-500 focus:border-[#1a73e8] outline-none"
                  />
                  <textarea
                    value={newSourceText}
                    onChange={(e) => setNewSourceText(e.target.value)}
                    placeholder="Paste text content here..."
                    className="w-full bg-[#111] border border-[#333] rounded-lg p-3 text-sm text-white placeholder-gray-500 focus:border-[#1a73e8] outline-none resize-none"
                    rows={6}
                  />
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowAddSourceModal(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition"
              >
                Cancel
              </button>
              {newSourceType !== 'file' && (
                <button
                  onClick={handleAddSource}
                  disabled={(newSourceType === 'url' || newSourceType === 'youtube') ? !newSourceUrl.trim() : !newSourceText.trim()}
                  className="px-4 py-2 bg-[#1a73e8] text-white text-sm font-bold rounded-lg hover:bg-[#1557b0] transition disabled:opacity-50"
                >
                  Add Source
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResearchPhase;
