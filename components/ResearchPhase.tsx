
import React, { useState, useRef } from 'react';
import { DocumentaryProject, DocumentaryNotebook, UserProfile, ResearchSeries, ResearchEpisode, KnowledgeAsset, ArchiveClip, ManualSource } from '../types';
import { geminiService } from '../services/geminiService';

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
  const [seriesList] = useState<ResearchSeries[]>([
    { id: 's-nasa', title: 'Series 01: NASA', icon: '🚀' },
    { id: 's-eng', title: 'Series 02: Engineering', icon: '🏗️' },
    { id: 's-lost', title: 'Series 03: Lost Places', icon: '🏚️' },
  ]);

  const [episodesList, setEpisodesList] = useState<ResearchEpisode[]>([
    { id: 'ep-1', series_id: 's-nasa', episode_number: 1, title: 'Moonshot Redacted', status: 'researching' },
    { id: 'ep-2', series_id: 's-nasa', episode_number: 2, title: 'The Challenger Tape', status: 'planning' },
    { id: 'ep-3', series_id: 's-nasa', episode_number: 3, title: 'Secret Satellites', status: 'planning' },
    { id: 'ep-4', series_id: 's-eng', episode_number: 1, title: 'Vajont Dam', status: 'locked' },
  ]);

  // ---------------------------------------------------------------------------
  // STATE: Navigation & Selection
  // ---------------------------------------------------------------------------
  const [activeSeriesId, setActiveSeriesId] = useState<string>('s-nasa');
  const [activeEpisodeId, setActiveEpisodeId] = useState<string>('ep-1');
  const [isAddingEpisode, setIsAddingEpisode] = useState(false);
  const [newEpisodeTitle, setNewEpisodeTitle] = useState('');

  // ---------------------------------------------------------------------------
  // STATE: NotebookLM-style Sources & Research
  // ---------------------------------------------------------------------------
  const [sources, setSources] = useState<ResearchSource[]>([
    {
      id: 'src-1',
      episode_id: 'ep-1',
      type: 'url',
      title: 'CIA FOIA: Project Azorian Documents',
      url: 'https://www.cia.gov/readingroom/collection/glomar-explorer',
      status: 'indexed',
      added_at: '2 hours ago',
      summary: 'Declassified documents about the Glomar Explorer operation to recover Soviet submarine K-129.'
    },
    {
      id: 'src-2',
      episode_id: 'ep-1',
      type: 'file',
      title: 'Mission_Report_Declassified_1974.pdf',
      file_name: 'Mission_Report_Declassified_1974.pdf',
      file_size: '14.2 MB',
      status: 'indexed',
      added_at: '1 hour ago',
      summary: 'Primary source document containing redacted flight logs and operational details.'
    }
  ]);

  const [researchQueries, setResearchQueries] = useState<ResearchQuery[]>([
    {
      id: 'q-1',
      episode_id: 'ep-1',
      query: 'What was the cover story for Project Azorian?',
      response: 'The CIA created an elaborate cover story involving Howard Hughes and his company, Summa Corporation. The official narrative was that the Glomar Explorer was a deep-sea mining vessel designed to harvest manganese nodules from the ocean floor.',
      key_facts: [
        'Howard Hughes provided the cover identity',
        'Summa Corporation was used as the front company',
        'Manganese nodule mining was the public explanation',
        'The cover lasted until 1975 when it was exposed'
      ],
      sources_used: ['src-1', 'src-2'],
      timestamp: '1 hour ago',
      engine: 'google_deep_research'
    }
  ]);

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
  // ACTIONS: Episodes
  // ---------------------------------------------------------------------------
  const handleAddEpisode = () => {
    if (!newEpisodeTitle.trim()) return;
    const currentSeriesEpisodes = episodesList.filter(e => e.series_id === activeSeriesId);
    const nextEpNum = currentSeriesEpisodes.length > 0
      ? Math.max(...currentSeriesEpisodes.map(e => e.episode_number)) + 1
      : 1;

    const newEp: ResearchEpisode = {
      id: `ep-${Date.now()}`,
      series_id: activeSeriesId,
      episode_number: nextEpNum,
      title: newEpisodeTitle,
      status: 'planning'
    };

    setEpisodesList(prev => [...prev, newEp]);
    onNotify('Episode Created', `EP${nextEpNum}: ${newEpisodeTitle}`, 'success');
    setIsAddingEpisode(false);
    setNewEpisodeTitle('');
    setActiveEpisodeId(newEp.id);
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
      const response = await fetch('/api/index-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: newSource.type,
          url: newSource.url,
          content: newSource.content,
          title: newSource.title
        })
      });

      const analysis = await response.json();

      if (analysis.status === 'indexed') {
        setSources(prev => prev.map(s =>
          s.id === newSource.id
            ? {
                ...s,
                status: 'indexed',
                title: analysis.title || s.title,
                summary: analysis.summary,
                key_topics: analysis.key_topics,
                key_facts: analysis.key_facts
              }
            : s
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

        const response = await fetch('/api/analyze-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: fileContent,
            fileName: file.name,
            fileType: file.type || getFileTypeFromName(file.name)
          })
        });

        const analysis = await response.json();

        if (analysis.status === 'indexed') {
          setSources(prev => prev.map(s =>
            s.id === newSource.id
              ? {
                  ...s,
                  status: 'indexed',
                  title: analysis.title || s.title,
                  summary: analysis.summary,
                  key_topics: analysis.key_topics,
                  key_facts: analysis.key_facts
                }
              : s
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
      "Synthesizing findings with Vertex AI..."
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
      const response = await fetch('/api/query-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: researchPrompt,
          sources: sourcesForQuery,
          engine: selectedEngine
        })
      });

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      const newQuery: ResearchQuery = {
        id: queryId,
        episode_id: activeEpisodeId,
        query: researchPrompt,
        response: result.response || 'Research completed.',
        key_facts: result.key_facts || [],
        sources_used: indexedSources.map(s => s.id),
        timestamp: new Date().toLocaleTimeString(),
        engine: selectedEngine
      };

      setResearchQueries(prev => [newQuery, ...prev]);
      setResearchPrompt('');
      onNotify('Research Complete', `Found ${(result.key_facts || []).length} key facts from ${indexedSources.length} sources.`, 'success');
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
                <button
                  key={s.id}
                  onClick={() => { setActiveSeriesId(s.id); setActiveEpisodeId(''); }}
                  className={`w-full text-left p-2 rounded text-xs font-bold flex items-center gap-2 transition ${activeSeriesId === s.id ? 'bg-white text-black' : 'text-gray-400 hover:bg-[#1a1a1a] hover:text-white'}`}
                >
                  <span>{s.icon}</span> {s.title}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1">
            <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Episodes</h4>
            <div className="space-y-1">
              {filteredEpisodes.map(ep => (
                <button
                  key={ep.id}
                  onClick={() => setActiveEpisodeId(ep.id)}
                  className={`w-full text-left p-2 rounded text-xs font-medium transition ${activeEpisodeId === ep.id ? 'bg-[#1a1a1a] text-white border-l-2 border-red-600' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  <span className="font-mono opacity-50 mr-1">EP{ep.episode_number.toString().padStart(2, '0')}</span>
                  <span className="truncate">{ep.title}</span>
                </button>
              ))}
              {!isAddingEpisode ? (
                <button onClick={() => setIsAddingEpisode(true)} className="w-full text-left p-2 text-[10px] text-gray-600 hover:text-gray-400">+ Add Episode</button>
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
                  <div key={q.id} className="bg-[#0a0a0a] border border-[#222] rounded-xl p-4">
                    {/* Query */}
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-8 h-8 bg-[#1a1a1a] rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-sm">❓</span>
                      </div>
                      <div>
                        <p className="text-sm text-white font-medium">{q.query}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold ${badge.color}`}>{badge.label}</span>
                          <span className="text-[9px] text-gray-500">{q.timestamp}</span>
                        </div>
                      </div>
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
