
import React, { useState, useEffect } from 'react';
import { DocumentaryProject, UserProfile } from '../types';
import { apiService } from '../services/apiService';

interface ReviewPhaseProps {
  project: DocumentaryProject;
  user: UserProfile;
  onComplete: () => void;
}

interface ChecklistItem {
  id: number;
  label: string;
  done: boolean;
  reviewer: string;
  detail?: string;
}

const ReviewPhase: React.FC<ReviewPhaseProps> = ({ project, user, onComplete }) => {
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLocking, setIsLocking] = useState(false);

  // Build checklist from actual project data
  useEffect(() => {
    const buildChecklist = async () => {
      setIsLoading(true);
      const items: ChecklistItem[] = [];
      let id = 1;

      try {
        // Check scripts
        const scripts = await apiService.getScriptsByProject(project.id);
        const hasScript = scripts.length > 0;
        const latestScript = hasScript ? scripts.sort((a: any, b: any) => (b.version || 0) - (a.version || 0))[0] : null;
        const beatCount = latestScript?.parts?.reduce((sum: number, p: any) =>
          sum + (p.scenes?.reduce((s2: number, sc: any) => s2 + (sc.beats?.length || 0), 0) || 0), 0) || 0;

        items.push({
          id: id++,
          label: hasScript ? `Script Review: ${beatCount} beats across ${latestScript.parts?.length || 0} parts` : 'Script Review: No script generated',
          done: false,
          reviewer: 'Producer',
          detail: hasScript ? `v${latestScript.version || 1}` : undefined
        });

        // Check research
        const research = await apiService.getResearchByProject(project.id);
        items.push({
          id: id++,
          label: research.length > 0 ? `Fact Check: ${research.length} research queries verified` : 'Fact Check: No research data to verify',
          done: false,
          reviewer: 'Researcher'
        });

        // Check assets/archive
        const assets = await apiService.getAssetsByProject(project.id);
        const archiveClips = assets.filter((a: any) => a.assetType !== 'research_source');
        items.push({
          id: id++,
          label: archiveClips.length > 0 ? `Rights & Clearance: ${archiveClips.length} archive assets` : 'Rights & Clearance: No archive assets used',
          done: false,
          reviewer: 'Legal'
        });

        // Check voice-overs
        const shots = await apiService.getShotsByProject(project.id);
        const voShots = shots.filter((s: any) => s.source_type === 'voice_over');
        const completedVo = voShots.filter((s: any) => s.status === 'complete');
        if (voShots.length > 0) {
          items.push({
            id: id++,
            label: `Audio QA: ${completedVo.length}/${voShots.length} voice-over lines recorded`,
            done: false,
            reviewer: 'Editor'
          });
        }

        // Check timeline
        const timelineShots = shots.filter((s: any) => s.track_type);
        if (timelineShots.length > 0) {
          items.push({
            id: id++,
            label: `Timeline Assembly: ${timelineShots.length} items placed`,
            done: false,
            reviewer: 'Editor'
          });
        }

        // Always include
        items.push({
          id: id++,
          label: 'Brand & Tone: Matches series style guidelines',
          done: false,
          reviewer: 'Producer'
        });

        items.push({
          id: id++,
          label: `Duration Check: Target ${project.target_duration_minutes || '?'} minutes`,
          done: false,
          reviewer: 'Producer'
        });

      } catch (err) {
        console.error('Failed to build checklist:', err);
        // Fallback static items
        items.push(
          { id: 1, label: 'Fact Check: All claims verified', done: false, reviewer: 'Researcher' },
          { id: 2, label: 'Legal Clear: No copyright issues', done: false, reviewer: 'Legal' },
          { id: 3, label: 'Brand Check: Tone matches style', done: false, reviewer: 'Producer' },
          { id: 4, label: 'Technical QA: Export plays correctly', done: false, reviewer: 'Editor' },
          { id: 5, label: 'Duration Check: Meets target length', done: false, reviewer: 'Producer' },
        );
      }

      setChecklist(items);
      setIsLoading(false);
    };
    buildChecklist();
  }, [project.id, project.target_duration_minutes]);

  const canReview = (requiredRole: string) => {
    if (user.role === 'producer') return true;
    if (requiredRole === 'Legal' && user.role === 'legal') return true;
    if (requiredRole === 'Editor' && user.role === 'editor') return true;
    if (requiredRole === 'Researcher' && user.role === 'researcher') return true;
    return false;
  };

  const toggleCheck = (id: number, reviewerRole: string) => {
    if (!canReview(reviewerRole)) {
        alert(`Access Denied: Only a ${reviewerRole} (or Producer) can sign off on this item.`);
        return;
    }
    setChecklist(prev => prev.map(item => item.id === id ? { ...item, done: !item.done } : item));
  };

  const allDone = checklist.length > 0 && checklist.every(item => item.done);

  const handleLockProject = async () => {
    setIsLocking(true);
    try {
      await apiService.updateProject(project.id, { status: 'locked', phase: 'complete' });
      onComplete();
    } catch (err) {
      console.error('Failed to lock project:', err);
      alert('Failed to lock project. Please try again.');
    } finally {
      setIsLocking(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-black uppercase italic tracking-tighter mb-4">PHASE 06: Review & Approval</h2>
        <p className="text-gray-500">Final quality assurance before delivery.</p>
      </div>

      <div className="bg-[#111] border border-[#222] rounded-3xl overflow-hidden mb-12 shadow-2xl">
        <div className="p-8 border-b border-[#222] flex justify-between items-center bg-[#151515]">
          <h3 className="text-xl font-bold">QA Checklist</h3>
          <span className="text-xs font-mono text-gray-500">
            {isLoading ? 'Loading...' : `${checklist.filter(c => c.done).length} / ${checklist.length} APPROVED`}
          </span>
        </div>

        <div className="divide-y divide-[#222]">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500 text-sm animate-pulse">Scanning project data...</div>
          ) : (
            checklist.map(item => {
              const allowed = canReview(item.reviewer);
              return (
                <div
                  key={item.id}
                  onClick={() => toggleCheck(item.id, item.reviewer)}
                  className={`p-6 flex items-center gap-6 transition relative group ${allowed ? 'cursor-pointer hover:bg-white/5' : 'cursor-not-allowed opacity-60'}`}
                >
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition ${
                    item.done ? 'bg-green-600 border-green-600 text-white' : 'border-[#444] text-transparent'
                  }`}>
                    ✓
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium transition ${item.done ? 'text-gray-400 line-through' : 'text-white'}`}>{item.label}</p>
                    <span className={`text-[10px] font-bold uppercase tracking-widest mt-1 block ${allowed ? 'text-blue-400' : 'text-gray-600'}`}>
                      Reviewer: {item.reviewer} {allowed ? '(YOU)' : ''}
                    </span>
                  </div>

                  {!allowed && (
                    <div className="absolute right-4 text-[10px] text-red-500 font-bold opacity-0 group-hover:opacity-100 transition uppercase tracking-wider">
                      Restricted
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="text-center">
        <button
          onClick={handleLockProject}
          disabled={!allDone || isLocking}
          className={`px-12 py-4 rounded-full font-black text-xl tracking-tighter transition shadow-2xl ${
            allDone ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-900/50' : 'bg-[#222] text-gray-600 cursor-not-allowed'
          }`}
        >
          {isLocking ? 'LOCKING...' : 'FINAL SIGN-OFF & LOCK'}
        </button>
        {!allDone && !isLoading && <p className="text-[10px] text-gray-600 mt-4 font-mono uppercase tracking-widest">Awaiting department approvals</p>}
      </div>
    </div>
  );
};

export default ReviewPhase;
