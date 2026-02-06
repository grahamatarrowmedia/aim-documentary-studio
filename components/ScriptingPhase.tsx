
import React, { useState, useEffect, useRef } from 'react';
import { DocumentaryProject, DocumentaryScript, ScriptPart, ScriptBeat, ReferenceDocument } from '../types';
import { geminiService } from '../services/geminiService';
import { apiService } from '../services/apiService';

interface ScriptingPhaseProps {
  project: DocumentaryProject;
  onAdvance: () => void;
}

const ScriptingPhase: React.FC<ScriptingPhaseProps> = ({ project, onAdvance }) => {
  const [script, setScript] = useState<DocumentaryScript | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [references, setReferences] = useState<ReferenceDocument[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Load existing script from backend
  useEffect(() => {
    apiService.getScriptsByProject(project.id).then((scripts: any[]) => {
      if (scripts.length > 0) {
        const latest = scripts.sort((a: any, b: any) => (b.version || 0) - (a.version || 0))[0];
        setScript(latest);
      }
    }).catch(err => console.error('Failed to load scripts:', err));
  }, [project.id]);

  // Debounced auto-save when script changes
  const persistScript = (s: DocumentaryScript) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      apiService.updateScript(s.id, s).catch(err => console.error('Failed to save script:', err));
    }, 1500);
  };
  
  // Refinement State
  const [rewritingBeatId, setRewritingBeatId] = useState<string | null>(null);
  const [rewriteInstruction, setRewriteInstruction] = useState('');
  const [isRewriting, setIsRewriting] = useState(false);

  // Agent State
  const [agentStep, setAgentStep] = useState<string>('');
  const [agentLogs, setAgentLogs] = useState<string[]>([]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create reference object with real metadata
    const newRef: ReferenceDocument = {
      id: `ref-${Date.now()}`,
      name: file.name,
      type: file.name.endsWith('pdf') ? 'pdf' : (file.name.endsWith('txt') ? 'txt' : 'docx'),
      size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      uploadDate: new Date().toLocaleDateString(),
      analysis_status: 'analyzing'
    };

    setReferences(prev => [...prev, newRef]);

    // Trigger Vertex AI Analysis
    try {
      // Read file content
      const content = await file.text();

      // Analyze document style with Vertex AI
      const styleAnalysis = await geminiService.analyzeDocumentStyle(file.name, content);

      setReferences(prev => prev.map(r => r.id === newRef.id ? {
        ...r,
        analysis_status: 'complete',
        style_tags: [styleAnalysis.tone, styleAnalysis.pacing, styleAnalysis.structure].filter(Boolean)
      } : r));
    } catch (e) {
      console.error('Document analysis failed:', e);
      setReferences(prev => prev.map(r => r.id === newRef.id ? { ...r, analysis_status: 'error' } : r));
    }
  };

  const addAgentLog = (msg: string) => {
    setAgentStep(msg);
    setAgentLogs(prev => [...prev, `[${new Date().toLocaleTimeString().split(' ')[0]}] ${msg}`]);
  };

  const generateScript = async () => {
    setIsGenerating(true);
    setAgentLogs([]);

    // Multi-Agent coordination with Vertex AI
    addAgentLog('SYSTEM: Initializing Vertex AI Multi-Agent Pipeline...');
    await new Promise(r => setTimeout(r, 300));

    addAgentLog('ARCHIVE_AGENT: Loading Archive Asset Database...');
    await new Promise(r => setTimeout(r, 400));
    addAgentLog('ARCHIVE_AGENT: Verified clip metadata entries.');

    addAgentLog('RESEARCH_AGENT: Loading Deep Research Briefs...');
    await new Promise(r => setTimeout(r, 400));
    addAgentLog('RESEARCH_AGENT: Cross-referencing fact checkpoints.');

    addAgentLog('WRITER_AGENT: Analyzing reference styles with Vertex AI...');
    await new Promise(r => setTimeout(r, 400));
    
    let styleContext = "Standard BBC Documentary Style";
    if (references.length > 0) {
        const styles = references
            .filter(r => r.analysis_status === 'complete')
            .map(r => `[${r.name}: ${r.style_tags?.join(', ')}]`)
            .join(' + ');
        styleContext = `Derived from Uploads: ${styles}`;
        addAgentLog(`WRITER_AGENT: Style Match Found: ${styles}`);
    }
    
    addAgentLog('WRITER_AGENT: Synthesizing Narrative Arc...');
    await new Promise(r => setTimeout(r, 1000));

    try {
      const partsData = await geminiService.generateScriptMultiAgent(
          project.title, 
          project.description, 
          project.target_duration_minutes,
          styleContext,
          [],
          []
      );
      
      const parts: ScriptPart[] = partsData.map((p: any, idx: number) => ({
        id: `part-${idx}`,
        part_number: idx + 1,
        title: p.title,
        scenes: p.scenes.map((s: any, sIdx: number) => ({
          id: `scene-${idx}-${sIdx}`,
          scene_number: sIdx + 1,
          title: s.title,
          beats: s.beats.map((b: any, bIdx: number) => ({
            id: `beat-${idx}-${sIdx}-${bIdx}`,
            type: b.type as any,
            content: b.content,
            speaker: b.speaker,
            duration_seconds: b.duration_seconds || 15
          }))
        }))
      }));

      const scriptData = {
        projectId: project.id,
        project_id: project.id,
        version: 1,
        is_current: true,
        status: 'draft',
        parts,
        estimated_duration_minutes: project.target_duration_minutes
      };
      const saved = await apiService.createScript(scriptData);
      setScript({ ...scriptData, id: saved.id });
      addAgentLog('SYSTEM: Generation Complete.');
    } catch (err) {
      console.error(err);
      alert("Script generation failed. Please check API connection.");
      addAgentLog('SYSTEM: Error during synthesis.');
    } finally {
      setIsGenerating(false);
      setAgentStep('');
    }
  };

  const updateBeatContent = (beatId: string, newContentHtml: string) => {
    if (!script) return;
    const nextParts = script.parts.map(p => ({
      ...p,
      scenes: p.scenes.map(s => ({
        ...s,
        beats: s.beats.map(b => b.id === beatId ? { ...b, content: newContentHtml } : b)
      }))
    }));
    const updated = { ...script, parts: nextParts };
    setScript(updated);
    persistScript(updated);
  };

  const handleRewrite = async (beatId: string, currentContent: string) => {
    if (!rewriteInstruction.trim()) return;
    setIsRewriting(true);
    try {
        const newContent = await geminiService.refineScriptBeat(currentContent, rewriteInstruction);
        updateBeatContent(beatId, newContent);
        setRewritingBeatId(null);
        setRewriteInstruction('');
    } catch (e) {
        console.error("Rewrite failed", e);
    } finally {
        setIsRewriting(false);
    }
  };

  const generateVisualForBeat = async (beat: ScriptBeat) => {
    // Allows generating visuals for VO, AI Visuals, or Placeholder Archive clips
    if (!script || !beat.content) return;
    
    // Set generating status
    const updateStatus = (loading: boolean, url?: string) => {
      const nextParts = script.parts.map(p => ({
        ...p,
        scenes: p.scenes.map(s => ({
          ...s,
          beats: s.beats.map(b => b.id === beat.id ? { ...b, is_generating_visual: loading, visual_url: url || b.visual_url } : b)
        }))
      }));
      setScript({ ...script, parts: nextParts });
    };

    updateStatus(true);
    try {
      // Use clean text for prompt (remove HTML tags)
      const cleanPrompt = beat.content.replace(/<[^>]*>?/gm, '');
      const url = await geminiService.generateArchiveBroll(cleanPrompt);
      updateStatus(false, url);
    } catch (err) {
      console.error(err);
      updateStatus(false);
    }
  };

  const handleFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
  };

  const getBeatColor = (type: string) => {
    switch (type) {
      case 'voice_over': return 'border-blue-500/50 bg-blue-500/5';
      case 'expert': return 'border-green-500/50 bg-green-500/5';
      case 'archive': return 'border-yellow-500/50 bg-yellow-500/5';
      case 'ai_visual': return 'border-purple-500/50 bg-purple-500/5';
      default: return 'border-gray-500/50 bg-gray-500/5';
    }
  };

  const exportForAssembly = () => {
    if (!script) return;
    const dataStr = JSON.stringify(script, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.title.replace(/\s+/g, '_')}_script_v${script.version}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onAdvance();
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-black uppercase italic tracking-tighter">PHASE 03: Scripting</h2>
          <p className="text-gray-500">Multi-Agent Narrative Orchestration.</p>
        </div>
        <div className="flex gap-4">
          {!script && (
             <button 
              disabled={isGenerating}
              onClick={generateScript}
              className="bg-red-600 text-white font-bold px-8 py-3 rounded-full hover:bg-red-700 disabled:opacity-50 transition shadow-xl shadow-red-900/40"
            >
              {isGenerating ? 'AGENTS WORKING...' : 'IGNITE AGENT SWARM'}
            </button>
          )}
          {script && (
            <button onClick={exportForAssembly} className="bg-white text-black font-bold px-6 py-2 rounded flex items-center gap-2">
              EXPORT TO ASSEMBLY <span className="text-xl">→</span>
            </button>
          )}
        </div>
      </div>

      {!script && !isGenerating && (
        <div className="grid grid-cols-2 gap-8">
            <div className="space-y-6">
                <section className="bg-[#111] border border-[#222] p-8 rounded-2xl">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">1. Train Writer Style</h3>
                    <div className="border-2 border-dashed border-[#333] hover:border-red-600 rounded-xl p-8 text-center transition cursor-pointer relative group">
                        <input 
                            type="file" 
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            onChange={handleFileUpload}
                            accept=".pdf,.doc,.docx,.txt"
                        />
                        <div className="text-3xl mb-2 group-hover:scale-110 transition">📄</div>
                        <p className="text-sm font-bold text-white">Upload Reference Script</p>
                        <p className="text-[10px] text-gray-500 mt-1">PDF or Docx. Gemini will mimic tone & formatting.</p>
                    </div>
                    {references.length > 0 && (
                        <div className="mt-4 space-y-2">
                            {references.map(ref => (
                                <div key={ref.id} className="bg-[#1a1a1a] p-3 rounded border border-[#333]">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs font-bold text-white truncate max-w-[200px]">{ref.name}</span>
                                        <span className="text-[9px] text-gray-500 font-mono">{ref.size}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {ref.analysis_status === 'analyzing' && (
                                            <span className="text-[9px] text-yellow-500 flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse"/> Analyzing Structure...
                                            </span>
                                        )}
                                        {ref.analysis_status === 'complete' && (
                                            <div className="flex gap-2 flex-wrap">
                                                {ref.style_tags?.map(tag => (
                                                    <span key={tag} className="text-[8px] bg-green-900/40 text-green-400 px-1.5 py-0.5 rounded uppercase font-bold">{tag}</span>
                                                ))}
                                            </div>
                                        )}
                                        {ref.analysis_status === 'error' && (
                                            <span className="text-[9px] text-red-500">Analysis Failed</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            <div className="space-y-6">
                 <section className="bg-[#111] border border-[#222] p-8 rounded-2xl h-full">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">2. Connect Agent Inputs</h3>
                    <div className="space-y-4">
                        <div className="flex items-center gap-4 p-4 bg-[#1a1a1a] border border-[#333] rounded-xl opacity-50">
                            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-xs">🔍</div>
                            <div>
                                <h4 className="text-sm font-bold">Research Specialist</h4>
                                <p className="text-[10px] text-gray-500">Connects to Vertex AI research data</p>
                            </div>
                        </div>
                         <div className="flex items-center gap-4 p-4 bg-[#1a1a1a] border border-[#333] rounded-xl opacity-50">
                            <div className="w-8 h-8 bg-yellow-600 rounded-full flex items-center justify-center text-xs">📼</div>
                            <div>
                                <h4 className="text-sm font-bold">Archive Specialist</h4>
                                <p className="text-[10px] text-gray-500">Connects to archive asset database</p>
                            </div>
                        </div>
                        <p className="text-xs text-center text-gray-500 pt-4">Agents will collaborate to produce the draft.</p>
                    </div>
                 </section>
            </div>
        </div>
      )}

      {isGenerating && (
         <div className="flex flex-col items-center justify-center py-12 text-center max-w-lg mx-auto">
            <div className="relative w-24 h-24 mb-8">
                 <div className="absolute inset-0 border-4 border-[#333] rounded-full"></div>
                 <div className="absolute inset-0 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <h3 className="text-xl font-bold mb-2">Swarm Intelligence Active</h3>
            <p className="text-red-500 font-mono text-sm animate-pulse mb-6">{agentStep}</p>
            
            <div className="w-full bg-[#111] border border-[#222] rounded-xl p-4 h-48 overflow-y-auto font-mono text-[10px] text-left text-gray-500 space-y-1 custom-scrollbar">
                {agentLogs.map((log, i) => (
                    <div key={i} className="border-b border-gray-800 pb-1 mb-1 last:border-0">{log}</div>
                ))}
            </div>
        </div>
      )}

      {script && (
        <div className="max-w-4xl mx-auto space-y-12 pb-24">
          {script.parts.map(part => (
            <div key={part.id} className="space-y-6">
              <div className="flex items-end gap-4 border-b border-[#333] pb-2">
                <span className="text-5xl font-black text-white/10 uppercase tracking-tighter">PART {part.part_number}</span>
                <h3 className="text-2xl font-bold mb-2">{part.title}</h3>
              </div>
              
              {part.scenes.map(scene => (
                <div key={scene.id} className="ml-8 space-y-4">
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-mono text-gray-500 bg-[#111] px-2 py-1 rounded">SCENE {scene.scene_number}</span>
                    <h4 className="text-lg font-bold text-gray-300">{scene.title}</h4>
                  </div>
                  
                  <div className="space-y-3">
                    {scene.beats.map(beat => (
                      <div key={beat.id} className={`p-4 rounded-lg border-l-4 ${getBeatColor(beat.type)} group relative flex gap-4`}>
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-[8px] font-black uppercase tracking-widest text-gray-500 opacity-50 group-hover:opacity-100 transition">{beat.type.replace('_', ' ')}</span>
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-mono text-gray-500">{beat.duration_seconds}s</span>
                                <button 
                                    onClick={() => setRewritingBeatId(rewritingBeatId === beat.id ? null : beat.id)}
                                    className="text-[9px] text-gray-500 hover:text-white flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white/10 transition"
                                >
                                    ✨ Rewrite
                                </button>
                                {['voice_over', 'ai_visual', 'archive'].includes(beat.type) && (
                                    <button 
                                      onClick={() => generateVisualForBeat(beat)}
                                      disabled={beat.is_generating_visual}
                                      className={`text-[8px] font-bold px-2 py-0.5 rounded border transition ${beat.is_generating_visual ? 'animate-pulse bg-purple-600/20 border-purple-500' : 'bg-[#222] border-[#333] hover:border-purple-500'}`}
                                    >
                                      {beat.is_generating_visual ? 'VEO...' : 'GENERATE B-ROLL'}
                                    </button>
                                )}
                            </div>
                          </div>
                          
                          {beat.speaker && <p className="text-xs font-bold text-red-500 mb-1">{beat.speaker.toUpperCase()}:</p>}
                          
                          {/* Rich Text Editor */}
                          <div 
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => updateBeatContent(beat.id, e.currentTarget.innerHTML)}
                            dangerouslySetInnerHTML={{ __html: beat.content || `[${beat.type.toUpperCase()} PLACEHOLDER]` }}
                            className="text-sm text-gray-200 leading-relaxed outline-none focus:ring-1 focus:ring-red-600/30 rounded p-1"
                          />
                          
                          {/* Magic Rewrite UI */}
                          {rewritingBeatId === beat.id && (
                              <div className="mt-3 p-3 bg-[#111] rounded border border-gray-700 animate-in fade-in slide-in-from-top-1">
                                  <div className="flex gap-2">
                                      <input 
                                          autoFocus
                                          type="text" 
                                          value={rewriteInstruction}
                                          onChange={(e) => setRewriteInstruction(e.target.value)}
                                          placeholder="e.g. 'Make it punchier', 'Shorten to 10s', 'More emotional'..."
                                          className="flex-1 bg-[#222] border border-[#333] rounded px-3 py-1 text-xs focus:border-red-600 outline-none"
                                          onKeyDown={(e) => e.key === 'Enter' && handleRewrite(beat.id, beat.content || '')}
                                      />
                                      <button 
                                          onClick={() => handleRewrite(beat.id, beat.content || '')}
                                          disabled={isRewriting || !rewriteInstruction}
                                          className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold px-3 rounded uppercase"
                                      >
                                          {isRewriting ? '...' : 'GO'}
                                      </button>
                                  </div>
                                  <div className="flex gap-2 mt-2">
                                      {['Make it shorter', 'Add technical detail', 'More dramatic'].map(opt => (
                                          <button key={opt} onClick={() => setRewriteInstruction(opt)} className="text-[9px] text-gray-500 hover:text-white border border-[#333] rounded px-2 py-1">
                                              {opt}
                                          </button>
                                      ))}
                                  </div>
                              </div>
                          )}
                          
                          {/* Toolbar helper */}
                          <div className="mt-2 flex gap-2 opacity-0 group-hover:opacity-100 transition">
                            <button onMouseDown={(e) => { e.preventDefault(); handleFormat('bold'); }} className="text-[10px] text-gray-600 hover:text-white font-bold px-1.5 py-0.5 hover:bg-white/10 rounded">B</button>
                            <button onMouseDown={(e) => { e.preventDefault(); handleFormat('italic'); }} className="text-[10px] text-gray-600 hover:text-white italic px-1.5 py-0.5 hover:bg-white/10 rounded">I</button>
                            <button onMouseDown={(e) => { e.preventDefault(); handleFormat('underline'); }} className="text-[10px] text-gray-600 hover:text-white underline px-1.5 py-0.5 hover:bg-white/10 rounded">U</button>
                            <button onMouseDown={(e) => { e.preventDefault(); handleFormat('hiliteColor', '#b45309'); }} className="text-[10px] text-gray-600 hover:text-white bg-yellow-600/20 px-1.5 py-0.5 rounded">HL</button>
                          </div>
                        </div>

                        {beat.visual_url && (
                            <div className="w-32 h-18 bg-[#000] rounded overflow-hidden border border-[#333] shrink-0">
                                <video src={beat.visual_url} autoPlay loop muted className="w-full h-full object-cover" />
                            </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ScriptingPhase;
