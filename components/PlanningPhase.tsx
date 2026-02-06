
import React, { useState, useEffect } from 'react';
import { DocumentaryProject, UserProfile, PlanningSeries, EpisodePlan, PlanningReference } from '../types';
import { apiService } from '../services/apiService';
import { geminiService } from '../services/geminiService';

interface PlanningPhaseProps {
  project: DocumentaryProject;
  user: UserProfile;
  onAdvance: () => void;
  onNotify: (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

const PlanningPhase: React.FC<PlanningPhaseProps> = ({ project, user, onAdvance, onNotify }) => {
  const [series, setSeries] = useState<PlanningSeries[]>([]);
  const [episodes, setEpisodes] = useState<EpisodePlan[]>([]);
  const [references, setReferences] = useState<PlanningReference[]>([]);

  // Brainstorm state
  const [premise, setPremise] = useState(project.description || '');
  const [brainstormResult, setBrainstormResult] = useState('');
  const [isBrainstorming, setIsBrainstorming] = useState(false);

  // New series form
  const [showNewSeries, setShowNewSeries] = useState(false);
  const [newSeriesTitle, setNewSeriesTitle] = useState('');
  const [newSeriesLogline, setNewSeriesLogline] = useState('');

  // New episode form
  const [addingEpisodeTo, setAddingEpisodeTo] = useState<string | null>(null);
  const [newEpTitle, setNewEpTitle] = useState('');
  const [newEpFocus, setNewEpFocus] = useState('');

  // Load existing planning data from backend
  useEffect(() => {
    const loadData = async () => {
      try {
        const [seriesData, epData] = await Promise.all([
          apiService.getSeriesByProject(project.id),
          apiService.getEpisodesByProject(project.id),
        ]);
        setSeries(seriesData);
        setEpisodes(epData);
      } catch (err) {
        console.error('Failed to load planning data:', err);
      }
    };
    loadData();
  }, [project.id]);

  const handleBrainstorm = async () => {
    if (!premise.trim()) return;
    setIsBrainstorming(true);
    setBrainstormResult('');

    try {
      const result = await geminiService.summarizeResearch(
        `As a documentary development executive, brainstorm a comprehensive production plan for this concept: "${premise}".
Include: potential series structure (3-6 episodes), key themes, target audience, visual approach, archive sources to pursue, and expert types to interview. Format as a structured brief.`,
        'gemini_pro'
      );
      setBrainstormResult(result.summary || JSON.stringify(result));

      // Persist brainstorm as a research document
      await apiService.createResearch({
        projectId: project.id,
        query: `Planning brainstorm: ${premise}`,
        answer: result.summary || '',
        engine: 'gemini_pro',
        phase: 'planning'
      });
    } catch (err) {
      console.error('Brainstorm failed:', err);
      setBrainstormResult('Brainstorm failed. Please check your API connection and try again.');
    } finally {
      setIsBrainstorming(false);
    }
  };

  const handleAddSeries = async () => {
    if (!newSeriesTitle.trim()) return;
    try {
      const payload = {
        projectId: project.id,
        title: newSeriesTitle,
        logline: newSeriesLogline,
        icon: '🎬',
        episode_count: 0
      };
      const saved = await apiService.createSeries(payload);
      setSeries(prev => [...prev, saved]);
      setNewSeriesTitle('');
      setNewSeriesLogline('');
      setShowNewSeries(false);
    } catch (err) {
      console.error('Failed to create series:', err);
    }
  };

  const handleAddEpisode = async (seriesId: string) => {
    if (!newEpTitle.trim()) return;
    const existingEps = episodes.filter(e => e.series_id === seriesId);
    try {
      const payload = {
        projectId: project.id,
        series_id: seriesId,
        episode_number: existingEps.length + 1,
        title: newEpTitle,
        focus: newEpFocus,
        status: 'planning'
      };
      const saved = await apiService.createEpisode(payload);
      setEpisodes(prev => [...prev, saved]);
      setNewEpTitle('');
      setNewEpFocus('');
      setAddingEpisodeTo(null);
    } catch (err) {
      console.error('Failed to create episode:', err);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ref: PlanningReference = {
      id: `ref-${Date.now()}`,
      name: file.name,
      type: file.name.endsWith('.pdf') ? 'pdf' : file.name.endsWith('.txt') ? 'txt' : 'docx',
      size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      upload_date: new Date().toLocaleDateString()
    };
    setReferences(prev => [...prev, ref]);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-black uppercase italic tracking-tighter">PHASE 00: Planning</h2>
          <p className="text-gray-500">Define your documentary concept and series structure.</p>
        </div>
        <button
          onClick={onAdvance}
          className="bg-white text-black font-bold px-6 py-2 rounded flex items-center gap-2"
        >
          BEGIN RESEARCH <span className="text-xl">→</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* Left Column: Concept & Brainstorm */}
        <div className="space-y-6">
          <section className="bg-[#111] border border-[#222] rounded-2xl p-6">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Documentary Concept</h3>
            <textarea
              value={premise}
              onChange={(e) => setPremise(e.target.value)}
              placeholder="Describe your documentary concept, theme, and angle..."
              className="w-full h-32 bg-[#0a0a0a] border border-[#333] rounded-xl px-4 py-3 text-sm text-gray-200 resize-none focus:border-red-600 outline-none"
            />
            <button
              onClick={handleBrainstorm}
              disabled={isBrainstorming || !premise.trim()}
              className="mt-4 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-sm px-6 py-3 rounded-full transition shadow-lg shadow-red-900/30 w-full"
            >
              {isBrainstorming ? 'AI BRAINSTORMING...' : 'AI BRAINSTORM'}
            </button>
          </section>

          {brainstormResult && (
            <section className="bg-[#111] border border-[#222] rounded-2xl p-6">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">AI Brainstorm Output</h3>
              <div className="bg-[#0a0a0a] border border-[#333] rounded-xl p-4 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto custom-scrollbar">
                {brainstormResult}
              </div>
            </section>
          )}

          {/* Reference Uploads */}
          <section className="bg-[#111] border border-[#222] rounded-2xl p-6">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Reference Materials</h3>
            <div className="border-2 border-dashed border-[#333] hover:border-red-600 rounded-xl p-6 text-center transition cursor-pointer relative group">
              <input
                type="file"
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={handleFileUpload}
                accept=".pdf,.doc,.docx,.txt"
              />
              <div className="text-2xl mb-2 group-hover:scale-110 transition">📄</div>
              <p className="text-sm font-bold text-white">Upload Reference Document</p>
              <p className="text-[10px] text-gray-500 mt-1">PDF, Docx, or Text files</p>
            </div>
            {references.length > 0 && (
              <div className="mt-4 space-y-2">
                {references.map(ref => (
                  <div key={ref.id} className="bg-[#1a1a1a] p-3 rounded border border-[#333] flex justify-between items-center">
                    <span className="text-xs font-bold text-white truncate max-w-[200px]">{ref.name}</span>
                    <span className="text-[9px] text-gray-500 font-mono">{ref.size}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Series Structure */}
        <div className="space-y-6">
          <section className="bg-[#111] border border-[#222] rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Series Structure</h3>
              <button
                onClick={() => setShowNewSeries(true)}
                className="text-[10px] bg-[#222] hover:bg-white hover:text-black text-gray-400 px-3 py-1.5 rounded transition uppercase font-bold"
              >
                + Add Series
              </button>
            </div>

            {showNewSeries && (
              <div className="bg-[#0a0a0a] border border-[#333] rounded-xl p-4 mb-4 space-y-3">
                <input
                  autoFocus
                  type="text"
                  value={newSeriesTitle}
                  onChange={(e) => setNewSeriesTitle(e.target.value)}
                  placeholder="Series title..."
                  className="w-full bg-transparent border border-[#333] rounded px-3 py-2 text-sm focus:border-red-600 outline-none"
                />
                <input
                  type="text"
                  value={newSeriesLogline}
                  onChange={(e) => setNewSeriesLogline(e.target.value)}
                  placeholder="Logline / one-liner..."
                  className="w-full bg-transparent border border-[#333] rounded px-3 py-2 text-xs focus:border-red-600 outline-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddSeries}
                    className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold px-4 py-1.5 rounded uppercase"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => { setShowNewSeries(false); setNewSeriesTitle(''); setNewSeriesLogline(''); }}
                    className="text-[10px] text-gray-500 hover:text-white px-4 py-1.5 rounded uppercase font-bold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {series.length === 0 && !showNewSeries && (
              <div className="text-center py-12 text-gray-600">
                <div className="text-4xl mb-3 opacity-30">🎬</div>
                <p className="text-sm">No series defined yet</p>
                <p className="text-[10px] mt-1">Click "+ Add Series" to structure your documentary</p>
              </div>
            )}

            <div className="space-y-4">
              {series.map(s => {
                const seriesEps = episodes.filter(e => e.series_id === s.id)
                  .sort((a, b) => (a.episode_number || 0) - (b.episode_number || 0));
                return (
                  <div key={s.id} className="bg-[#0a0a0a] border border-[#333] rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-[#222] flex justify-between items-center">
                      <div>
                        <h4 className="text-sm font-bold text-white">{s.title}</h4>
                        {s.logline && <p className="text-[10px] text-gray-500 mt-0.5">{s.logline}</p>}
                      </div>
                      <span className="text-[9px] font-mono text-gray-600">{seriesEps.length} episodes</span>
                    </div>

                    <div className="divide-y divide-[#222]">
                      {seriesEps.map(ep => (
                        <div key={ep.id} className="p-3 px-4 flex items-center gap-3 hover:bg-white/5 transition">
                          <span className="text-[10px] font-mono text-gray-600 w-6">{String(ep.episode_number).padStart(2, '0')}</span>
                          <div className="flex-1">
                            <p className="text-xs font-medium text-gray-300">{ep.title}</p>
                            {ep.focus && <p className="text-[9px] text-gray-600 mt-0.5">{ep.focus}</p>}
                          </div>
                          <span className="text-[8px] font-bold uppercase tracking-widest text-yellow-500/60">{ep.status}</span>
                        </div>
                      ))}
                    </div>

                    {addingEpisodeTo === s.id ? (
                      <div className="p-3 bg-[#111] border-t border-[#222] space-y-2">
                        <input
                          autoFocus
                          type="text"
                          value={newEpTitle}
                          onChange={(e) => setNewEpTitle(e.target.value)}
                          placeholder="Episode title..."
                          className="w-full bg-transparent border border-[#333] rounded px-3 py-1.5 text-xs focus:border-red-600 outline-none"
                        />
                        <input
                          type="text"
                          value={newEpFocus}
                          onChange={(e) => setNewEpFocus(e.target.value)}
                          placeholder="Research focus / angle..."
                          className="w-full bg-transparent border border-[#333] rounded px-3 py-1.5 text-[10px] focus:border-red-600 outline-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAddEpisode(s.id)}
                            className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold px-3 py-1 rounded uppercase"
                          >
                            Add
                          </button>
                          <button
                            onClick={() => { setAddingEpisodeTo(null); setNewEpTitle(''); setNewEpFocus(''); }}
                            className="text-[10px] text-gray-500 hover:text-white px-3 py-1 rounded uppercase font-bold"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingEpisodeTo(s.id)}
                        className="w-full p-2 text-[10px] text-gray-500 hover:text-white hover:bg-white/5 transition uppercase font-bold tracking-wider border-t border-[#222]"
                      >
                        + Add Episode
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PlanningPhase;
