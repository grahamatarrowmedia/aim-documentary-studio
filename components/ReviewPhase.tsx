
import React, { useState } from 'react';
import { DocumentaryProject, UserProfile } from '../types';

interface ReviewPhaseProps {
  project: DocumentaryProject;
  user: UserProfile;
  onComplete: () => void;
}

const ReviewPhase: React.FC<ReviewPhaseProps> = ({ project, user, onComplete }) => {
  const [checklist, setChecklist] = useState([
    { id: 1, label: 'Fact Check: All claims verified with sources', done: false, reviewer: 'Researcher' },
    { id: 2, label: 'Legal Clear: No copyright/clearance issues', done: false, reviewer: 'Legal' },
    { id: 3, label: 'Brand Check: Tone matches series style', done: false, reviewer: 'Producer' },
    { id: 4, label: 'Technical QA: Export plays correctly', done: false, reviewer: 'Editor' },
    { id: 5, label: 'Duration Check: Meets target length', done: false, reviewer: 'Producer' },
  ]);

  // Determine if user can check off an item based on their role
  const canReview = (requiredRole: string) => {
      // Producer implies admin power in this demo
      if (user.role === 'producer') return true; 
      // Mapping nice labels to role IDs
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

  const allDone = checklist.every(item => item.done);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-black uppercase italic tracking-tighter mb-4">PHASE 06: Review & Approval</h2>
        <p className="text-gray-500">Final quality assurance before delivery.</p>
      </div>

      <div className="bg-[#111] border border-[#222] rounded-3xl overflow-hidden mb-12 shadow-2xl">
        <div className="p-8 border-b border-[#222] flex justify-between items-center bg-[#151515]">
          <h3 className="text-xl font-bold">QA Checklist</h3>
          <span className="text-xs font-mono text-gray-500">{checklist.filter(c => c.done).length} / {checklist.length} APPROVED</span>
        </div>
        
        <div className="divide-y divide-[#222]">
          {checklist.map(item => {
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
                
                {/* Tooltip for disallowed users */}
                {!allowed && (
                    <div className="absolute right-4 text-[10px] text-red-500 font-bold opacity-0 group-hover:opacity-100 transition uppercase tracking-wider">
                        🔒 Restricted
                    </div>
                )}
                </div>
            );
          })}
        </div>
      </div>

      <div className="text-center">
        <button 
          onClick={onComplete}
          disabled={!allDone}
          className={`px-12 py-4 rounded-full font-black text-xl tracking-tighter transition shadow-2xl ${
            allDone ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-900/50' : 'bg-[#222] text-gray-600 cursor-not-allowed'
          }`}
        >
          FINAL SIGN-OFF & LOCK
        </button>
        {!allDone && <p className="text-[10px] text-gray-600 mt-4 font-mono uppercase tracking-widest">Awaiting department approvals</p>}
      </div>
    </div>
  );
};

export default ReviewPhase;
