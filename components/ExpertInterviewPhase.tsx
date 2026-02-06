
import React, { useState, useEffect } from 'react';
import { DocumentaryProject, DocumentaryScript, InterviewPlan, ExpertCandidate, AvatarEnvironment, DigitalTwin } from '../types';
import { geminiService } from '../services/geminiService';
import { apiService } from '../services/apiService';

interface ExpertInterviewPhaseProps {
  project: DocumentaryProject;
  onAdvance: () => void;
  onNotify: (title: string, msg: string, type: any) => void;
}

const ExpertInterviewPhase: React.FC<ExpertInterviewPhaseProps> = ({ project, onAdvance, onNotify }) => {
  // Script context loaded from backend
  const [mockScript, setMockScript] = useState<DocumentaryScript>({
    id: '',
    project_id: project.id,
    version: 1,
    is_current: true,
    status: 'draft',
    estimated_duration_minutes: project.target_duration_minutes,
    parts: []
  });

  const [plans, setPlans] = useState<InterviewPlan[]>([]);
  const [loadingPlanIds, setLoadingPlanIds] = useState<Set<string>>(new Set());
  const [loadingCandidatesIds, setLoadingCandidatesIds] = useState<Set<string>>(new Set());

  // Production Workflow State
  const [activeProductionId, setActiveProductionId] = useState<string | null>(null);
  const [isProcessingAvatar, setIsProcessingAvatar] = useState(false);
  const [availableTwins, setAvailableTwins] = useState<DigitalTwin[]>([]);

  // Load script + interview plans from backend
  useEffect(() => {
    const loadData = async () => {
      try {
        const [scripts, interviews] = await Promise.all([
          apiService.getScriptsByProject(project.id),
          apiService.getInterviewsByProject(project.id),
        ]);
        if (scripts.length > 0) {
          const latest = scripts.sort((a: any, b: any) => (b.version || 0) - (a.version || 0))[0];
          setMockScript(latest);
        }
        if (interviews.length > 0) {
          setPlans(interviews);
        }
      } catch (err) {
        console.error('Failed to load interview data:', err);
      }
    };
    loadData();
  }, [project.id]);

  // Initialize plans from script beats (only when script loads and no saved plans)
  useEffect(() => {
    if (plans.length > 0 || mockScript.parts.length === 0) return;
    const initialPlans: InterviewPlan[] = [];
    mockScript.parts.forEach(part => {
      part.scenes.forEach(scene => {
        scene.beats.forEach(beat => {
          const bt = beat.type?.toLowerCase();
          if (bt === 'expert' || bt === 'interview' || bt === 'expert_interview' || bt === 'soundbite') {
            initialPlans.push({
              id: `plan-${beat.id}`,
              beat_id: beat.id,
              scene_context: `${part.title} - ${scene.title}`,
              topic: beat.topic || beat.speaker || 'General Commentary',
              ideal_soundbite: '',
              questions: [],
              candidates: [],
              status: 'planning',
              production_status: 'pending_audio'
            });
          }
        });
      });
    });
    if (initialPlans.length > 0) {
      // Persist new plans
      Promise.all(initialPlans.map(p =>
        apiService.createInterview({ ...p, projectId: project.id })
      )).then(saved => {
        setPlans(saved.map((s: any, i: number) => ({ ...initialPlans[i], id: s.id })));
      }).catch(err => {
        console.error('Failed to persist plans:', err);
        setPlans(initialPlans);
      });
    }
  }, [mockScript, plans.length, project.id]);

  const generateStrategy = async (planId: string) => {
    setLoadingPlanIds(prev => new Set(prev).add(planId));
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;

    try {
      onNotify('Generating Strategy', `Drafting ideal sync for: ${plan.topic}`, 'info');
      const result = await geminiService.generateInterviewPlan(plan.scene_context, plan.topic);
      
      const update = { ideal_soundbite: result.ideal_soundbite, questions: result.questions, status: 'ready' as const };
      setPlans(prev => prev.map(p => p.id === planId ? { ...p, ...update } : p));
      apiService.updateInterview(planId, update).catch(err => console.error('Failed to persist strategy:', err));
      onNotify('Strategy Ready', 'Ideal soundbite & questions generated.', 'success');
    } catch (e) {
      console.error(e);
      onNotify('Error', 'Failed to generate interview strategy.', 'error');
    } finally {
      setLoadingPlanIds(prev => {
        const next = new Set(prev);
        next.delete(planId);
        return next;
      });
    }
  };

  const findExperts = async (planId: string) => {
    setLoadingCandidatesIds(prev => new Set(prev).add(planId));
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;

    try {
      onNotify('Scouting Talent', `Searching for experts on: ${plan.topic}`, 'info');
      const candidates = await geminiService.findExpertCandidates(plan.topic);
      
      // Map response to ExpertCandidate type
      const experts: ExpertCandidate[] = candidates.map((c: any, i: number) => ({
        id: `exp-${planId}-${i}`,
        name: c.name,
        title: c.title,
        relevance: c.relevance,
        affiliation: c.affiliation,
        relevance_score: c.relevance_score
      }));

      // Sort by relevance score
      experts.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));

      setPlans(prev => prev.map(p => p.id === planId ? { ...p, candidates: experts, status: 'booked' } : p));
      apiService.updateInterview(planId, { candidates: experts, status: 'booked' }).catch(err => console.error('Failed to persist candidates:', err));
      onNotify('Candidates Found', `${experts.length} experts identified via Google Search.`, 'success');
    } catch (e) {
      console.error(e);
      onNotify('Error', 'Failed to find experts.', 'error');
    } finally {
      setLoadingCandidatesIds(prev => {
        const next = new Set(prev);
        next.delete(planId);
        return next;
      });
    }
  };

  // --------------------------------------------------------------------------------
  // AVATAR PRODUCTION WORKFLOW ACTIONS
  // --------------------------------------------------------------------------------

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>, planId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    onNotify('Audio Uploaded', `File "${file.name}" attached to interview plan.`, 'success');

    const audioUpdate = {
      production_status: 'audio_uploaded' as const,
      audio_filename: file.name,
      audio_duration: file.size / 16000
    };
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, ...audioUpdate } : p));
    apiService.updateInterview(planId, audioUpdate).catch(err => console.error('Failed to persist audio:', err));

    triggerEnvironmentRecommendation(planId);
  };

  const triggerEnvironmentRecommendation = async (planId: string) => {
      const plan = plans.find(p => p.id === planId);
      if (!plan) return;
      
      onNotify('AI Producer', 'Analyzing context for environment selection...', 'info');
      
      try {
          const env = await geminiService.recommendAvatarEnvironment(plan.scene_context, plan.topic);
          const envUpdate = { selected_environment: env, environment_rationale: env.description, production_status: 'environment_selected' as const };
          setPlans(prev => prev.map(p => p.id === planId ? { ...p, ...envUpdate } : p));
          apiService.updateInterview(planId, envUpdate).catch(err => console.error('Failed to persist env:', err));
          onNotify('Environment Selected', `AI selected: ${env.name}`, 'success');
      } catch (e) {
          console.error(e);
          onNotify('Error', 'Failed to select environment', 'error');
      }
  };

  const selectAvatar = (planId: string, twin: DigitalTwin) => {
      setPlans(prev => prev.map(p => p.id === planId ? { ...p, selected_avatar: twin } : p));
      apiService.updateInterview(planId, { selected_avatar: twin }).catch(err => console.error('Failed to persist avatar:', err));
  };

  const handleCreateTwin = () => {
    // Mock creation of a new twin
    const newTwin: DigitalTwin = {
      id: `twin-${Date.now()}`,
      name: `New Twin ${availableTwins.length + 1}`,
      thumbnailUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}`,
      voice_match_score: 85
    };
    setAvailableTwins(prev => [...prev, newTwin]);
    onNotify('Twin Created', 'New Digital Twin initiated from source.', 'success');
  };

  const generateAvatarVideo = async (planId: string) => {
      const plan = plans.find(p => p.id === planId);
      if (!plan || !plan.selected_avatar || !plan.selected_environment) return;

      setIsProcessingAvatar(true);
      setPlans(prev => prev.map(p => p.id === planId ? { ...p, production_status: 'processing_avatar' } : p));
      onNotify('HeyGen API', 'Generating Digital Twin synchronization...', 'info');

      try {
          // Generate avatar video via Vertex AI pipeline
          const videoUrl = await geminiService.generateAvatarVideo(
              plan.selected_avatar.id, 
              plan.audio_filename || 'unknown.mp3',
              plan.selected_environment.id
          );

          const videoUpdate = { production_status: 'completed' as const, generated_video_url: videoUrl };
          setPlans(prev => prev.map(p => p.id === planId ? { ...p, ...videoUpdate } : p));
          apiService.updateInterview(planId, videoUpdate).catch(err => console.error('Failed to persist video:', err));
          onNotify('Production Complete', 'Avatar video generated successfully.', 'success');
      } catch (e) {
          console.error(e);
          onNotify('Error', 'Avatar generation failed.', 'error');
          setPlans(prev => prev.map(p => p.id === planId ? { ...p, production_status: 'environment_selected' } : p));
      } finally {
          setIsProcessingAvatar(false);
      }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-black uppercase italic tracking-tighter">PHASE 03b: Expert Interviews</h2>
          <p className="text-gray-500">Sync Planning, Question Formulation & Digital Twin Production.</p>
        </div>
        <div className="flex gap-4">
          <button onClick={onAdvance} className="bg-white text-black font-bold px-6 py-2 rounded flex items-center gap-2">
            PROCEED TO VO <span className="text-xl">→</span>
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {plans.length === 0 && (
          <div className="text-center py-12 border border-[#222] rounded-2xl bg-[#111]">
            <span className="text-4xl">🤷‍♂️</span>
            <p className="text-gray-500 mt-4 font-mono text-sm">No 'Expert' beats found in the current script.</p>
          </div>
        )}

        {plans.map((plan, index) => (
          <div key={plan.id} className="bg-[#111] border border-[#222] rounded-2xl overflow-hidden shadow-xl">
            {/* Header */}
            <div className="bg-[#151515] p-4 border-b border-[#222] flex justify-between items-center">
              <div className="flex items-center gap-4">
                <span className="text-xs font-black bg-red-600 text-white px-2 py-1 rounded">INTERVIEW #{index + 1}</span>
                <span className="text-sm font-bold text-gray-300">{plan.scene_context}</span>
              </div>
              <div className="flex items-center gap-4">
                 <span className="text-xs font-mono text-gray-500 uppercase">Focus: {plan.topic}</span>
                 <button
                   onClick={() => { setPlans(prev => prev.filter(p => p.id !== plan.id)); apiService.deleteInterview(plan.id).catch(console.error); }}
                   className="text-gray-600 hover:text-red-500 transition text-xs"
                   title="Delete interview plan"
                 >🗑</button>
                 {plan.status === 'booked' && (
                     <button 
                        onClick={() => setActiveProductionId(activeProductionId === plan.id ? null : plan.id)}
                        className={`text-[10px] font-bold uppercase px-3 py-1 rounded border transition ${
                            activeProductionId === plan.id 
                            ? 'bg-blue-600 text-white border-blue-600' 
                            : 'bg-[#222] text-gray-400 border-[#333] hover:text-white'
                        }`}
                     >
                        {activeProductionId === plan.id ? 'Hide Production' : 'Open Production Studio'}
                     </button>
                 )}
              </div>
            </div>

            {activeProductionId === plan.id ? (
                // PRODUCTION WORKFLOW INTERFACE
                <div className="bg-[#0f0f0f] p-6 border-b border-[#222] animate-in fade-in slide-in-from-top-2">
                    <h4 className="text-sm font-bold text-blue-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <span className="text-xl">🎬</span> Digital Twin Production Workflow
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* STEP 1: AUDIO UPLOAD */}
                        <div className={`space-y-4 ${plan.production_status !== 'pending_audio' ? 'opacity-50' : ''}`}>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="bg-[#333] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                                <h5 className="text-xs font-bold text-gray-300 uppercase">Input</h5>
                            </div>
                            <div className="border-2 border-dashed border-[#333] hover:border-blue-600 rounded-xl p-6 text-center transition relative">
                                <input 
                                    type="file" 
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    onChange={(e) => handleAudioUpload(e, plan.id)}
                                    accept="audio/*"
                                    disabled={plan.production_status !== 'pending_audio'}
                                />
                                <div className="text-2xl mb-2">🎙️</div>
                                <p className="text-xs font-bold text-gray-400">
                                    {plan.audio_filename ? plan.audio_filename : 'Upload Interview Audio'}
                                </p>
                                {plan.audio_duration && <p className="text-[10px] text-gray-600 mt-1">{plan.audio_duration}s • WAV/MP3</p>}
                            </div>
                        </div>

                        {/* STEP 2: ENVIRONMENT & TWIN */}
                        <div className={`space-y-4 ${!['audio_uploaded', 'environment_selected'].includes(plan.production_status || '') ? 'opacity-50 pointer-events-none' : ''}`}>
                             <div className="flex items-center gap-2 mb-2">
                                <span className="bg-[#333] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                                <h5 className="text-xs font-bold text-gray-300 uppercase">Set & Talent</h5>
                            </div>
                            
                            {/* Environment Selection */}
                            <div className="bg-[#1a1a1a] p-3 rounded-lg border border-[#333]">
                                <p className="text-[9px] font-bold text-gray-500 uppercase mb-2">Environment (AI Selected)</p>
                                {plan.selected_environment ? (
                                    <div className="relative group">
                                        <img src={plan.selected_environment.thumbnailUrl} className="w-full h-24 object-cover rounded border border-[#444]" alt="Env" />
                                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-1.5">
                                            <p className="text-[9px] font-bold text-white">{plan.selected_environment.name}</p>
                                            <p className="text-[8px] text-gray-400">{plan.environment_rationale}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-24 bg-[#111] rounded flex items-center justify-center">
                                        <span className="text-[10px] text-gray-600 animate-pulse">Waiting for audio...</span>
                                    </div>
                                )}
                            </div>

                            {/* Twin Selection */}
                            <div className="bg-[#1a1a1a] p-3 rounded-lg border border-[#333]">
                                <p className="text-[9px] font-bold text-gray-500 uppercase mb-2">Select Digital Twin</p>
                                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                                    {availableTwins.map(twin => (
                                        <button 
                                            key={twin.id}
                                            onClick={() => selectAvatar(plan.id, twin)}
                                            className={`flex-shrink-0 w-16 text-center ${plan.selected_avatar?.id === twin.id ? 'opacity-100' : 'opacity-50 hover:opacity-100'}`}
                                        >
                                            <img 
                                                src={twin.thumbnailUrl} 
                                                className={`w-12 h-12 rounded-full mx-auto border-2 ${plan.selected_avatar?.id === twin.id ? 'border-blue-500' : 'border-transparent'}`} 
                                                alt={twin.name}
                                            />
                                            <p className="text-[8px] text-gray-400 mt-1 truncate">{twin.name}</p>
                                        </button>
                                    ))}
                                </div>
                                <button 
                                    onClick={handleCreateTwin}
                                    className="w-full mt-2 text-[8px] text-gray-500 border border-[#333] rounded py-1 hover:text-white hover:border-gray-400"
                                >
                                    + Create New Twin (Requires Source Video)
                                </button>
                            </div>
                        </div>

                        {/* STEP 3: GENERATE */}
                        <div className={`space-y-4 ${!plan.selected_avatar || !plan.selected_environment ? 'opacity-50' : ''}`}>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="bg-[#333] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                                <h5 className="text-xs font-bold text-gray-300 uppercase">Render</h5>
                            </div>
                            
                            {plan.production_status === 'completed' && plan.generated_video_url ? (
                                <div className="relative rounded-xl overflow-hidden border border-[#333] shadow-lg">
                                    <video src={plan.generated_video_url} controls className="w-full aspect-video bg-black"></video>
                                    <div className="absolute top-2 right-2 bg-green-600 text-white text-[9px] font-bold px-2 py-0.5 rounded">READY</div>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col justify-center">
                                    <button 
                                        onClick={() => generateAvatarVideo(plan.id)}
                                        disabled={isProcessingAvatar || !plan.selected_avatar || !plan.selected_environment}
                                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-[#333] disabled:text-gray-500 text-white font-bold py-4 rounded-xl transition shadow-lg flex flex-col items-center gap-2"
                                    >
                                        {isProcessingAvatar ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                <span className="text-[10px]">RENDERING TWIN...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="text-xl">⚡</span>
                                                <span>GENERATE VIDEO</span>
                                            </>
                                        )}
                                    </button>
                                    <p className="text-[9px] text-center text-gray-600 mt-3 px-4">
                                        Uses HeyGen API. Estimated render time: 30s. Consumes 5 Credits.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
            // PLANNING INTERFACE (Default)
            <div className="grid grid-cols-1 lg:grid-cols-2">
              {/* Left Column: Strategy */}
              <div className="p-6 border-b lg:border-b-0 lg:border-r border-[#222] space-y-6">
                <div>
                   <div className="flex justify-between items-center mb-3">
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">1. The Ideal Sync (Soundbite)</h4>
                      <button 
                        onClick={() => generateStrategy(plan.id)}
                        disabled={loadingPlanIds.has(plan.id)}
                        className="text-[10px] bg-[#222] hover:bg-white hover:text-black border border-[#333] px-3 py-1 rounded transition disabled:opacity-50"
                      >
                        {loadingPlanIds.has(plan.id) ? 'GENERATING...' : '✨ GENERATE STRATEGY'}
                      </button>
                   </div>
                   {plan.ideal_soundbite ? (
                     <div className="bg-[#1a1a1a] p-4 rounded-xl border border-green-900/30 relative">
                        <span className="absolute -top-2 -left-2 text-2xl">❝</span>
                        <p className="text-sm text-gray-200 italic leading-relaxed pl-4">{plan.ideal_soundbite}</p>
                        <span className="absolute -bottom-4 -right-1 text-2xl">❞</span>
                     </div>
                   ) : (
                     <div className="bg-[#0a0a0a] p-8 rounded-xl border border-[#222] border-dashed text-center text-gray-600 text-xs">
                        Wait for AI to draft the perfect answer...
                     </div>
                   )}
                </div>

                {plan.questions.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">2. Producer Questions</h4>
                    <ul className="space-y-2">
                      {plan.questions.map((q, i) => (
                        <li key={i} className="flex gap-3 text-sm text-gray-300">
                          <span className="text-red-600 font-bold">Q{i+1}:</span>
                          <span>{q}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Right Column: Talent */}
              <div className="p-6 bg-[#0f0f0f]">
                 <div className="flex justify-between items-center mb-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">3. Candidate Search</h4>
                    <button 
                      onClick={() => findExperts(plan.id)}
                      disabled={loadingCandidatesIds.has(plan.id)}
                      className="text-[10px] bg-[#1a73e8] hover:bg-[#1557b0] text-white px-3 py-1 rounded transition disabled:opacity-50"
                    >
                      {loadingCandidatesIds.has(plan.id) ? 'SCOUTING...' : '🔍 FIND EXPERTS'}
                    </button>
                 </div>

                 {plan.candidates.length > 0 ? (
                   <div className="space-y-3">
                     {plan.candidates.map(candidate => (
                       <div key={candidate.id} className="bg-[#1a1a1a] border border-[#333] p-3 rounded-lg hover:border-gray-500 transition group cursor-pointer">
                          <div className="flex justify-between items-start">
                             <div>
                                <h5 className="font-bold text-sm text-white group-hover:text-[#1a73e8] transition">{candidate.name}</h5>
                                <p className="text-[10px] text-gray-400 font-bold uppercase">{candidate.title}</p>
                                {candidate.affiliation && <p className="text-[10px] text-gray-500">{candidate.affiliation}</p>}
                             </div>
                             {candidate.relevance_score !== undefined && (
                               <div className="flex flex-col items-end">
                                 <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                     candidate.relevance_score > 0.8 ? 'bg-green-900 text-green-400' :
                                     candidate.relevance_score > 0.5 ? 'bg-yellow-900 text-yellow-400' : 'bg-red-900 text-red-400'
                                 }`}>
                                     {(candidate.relevance_score * 100).toFixed(0)}% MATCH
                                 </span>
                               </div>
                             )}
                          </div>
                          <p className="text-[10px] text-gray-500 mt-2 border-t border-[#333] pt-2 italic">
                            "{candidate.relevance}"
                          </p>
                       </div>
                     ))}
                   </div>
                 ) : (
                   <div className="h-full flex flex-col items-center justify-center opacity-30 min-h-[150px]">
                      <span className="text-3xl mb-2">🕵️‍♀️</span>
                      <p className="text-xs font-bold uppercase tracking-widest">No candidates found yet</p>
                   </div>
                 )}
              </div>
            </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExpertInterviewPhase;
