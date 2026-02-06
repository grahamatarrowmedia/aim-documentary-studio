
import React, { useState } from 'react';
import { DocumentaryProject, ProjectTemplate, UserProfile } from '../types';

interface DashboardProps {
  user: UserProfile;
  projects: DocumentaryProject[];
  onSelectProject: (id: string) => void;
  onCreateProject: (title: string, desc: string, templateId?: string) => void;
  onDeleteProject: (id: string) => void;
}

const templates: ProjectTemplate[] = [
  { id: 'hist-deep', name: 'Historical Deep Dive', description: 'Focus on archival footage and scholarly interviews.', format: 'documentary' },
  { id: 'tech-expl', name: 'Tech Explainer', description: 'Fast-paced editing with motion graphics and VO.', format: 'explainer' },
  { id: 'short-int', name: 'Short Form Interview', description: 'Portrait mode, punchy captions, and single talent.', format: 'short_form' },
];

const Dashboard: React.FC<DashboardProps> = ({ user, projects, onSelectProject, onCreateProject, onDeleteProject }) => {
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex justify-between items-end mb-12">
        <div>
          <h2 className="text-4xl font-black text-white">Production Dashboard</h2>
          <p className="text-gray-500 mt-2">Welcome back, <span className="text-white font-bold">{user.username}</span>. Manage your pipeline.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-md transition shadow-lg shadow-red-900/20"
        >
          + NEW PROJECT
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map(proj => {
          const isLockedByOther = proj.locked_by && proj.locked_by !== user.id;
          
          return (
            <div 
                key={proj.id}
                onClick={() => onSelectProject(proj.id)}
                className={`group border rounded-xl p-6 cursor-pointer transition-all hover:translate-y-[-4px] relative overflow-hidden ${
                    isLockedByOther 
                    ? 'bg-[#1a1a1a] border-yellow-600/30 hover:border-yellow-600/50' 
                    : 'bg-[#151515] border-[#222] hover:border-red-600/50'
                }`}
            >
                {/* Active Editor Badge */}
                {isLockedByOther && proj.locked_by_avatar && (
                    <div className="absolute top-4 right-4 flex items-center gap-2 bg-yellow-600/10 border border-yellow-600/30 pl-2 pr-1 py-1 rounded-full z-10">
                        <span className="text-[9px] font-bold text-yellow-500 uppercase tracking-wide">Editing</span>
                        <img src={proj.locked_by_avatar} className="w-5 h-5 rounded-full border border-yellow-500" alt="Editor" />
                    </div>
                )}

                <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] font-mono bg-white/5 text-gray-400 px-2 py-1 rounded uppercase tracking-wider">{proj.target_format}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(proj.id); }}
                    className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-500 transition text-xs p-1"
                    title="Delete project"
                  >
                    🗑
                  </button>
                  <span className={`w-3 h-3 rounded-full ${proj.status === 'active' ? 'bg-blue-500 animate-pulse' : 'bg-gray-500'}`} />
                </div>
                </div>
                
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-red-500 transition-colors pr-10">{proj.title}</h3>
                <p className="text-sm text-gray-500 line-clamp-2 mb-6">{proj.description}</p>
                
                <div className="space-y-4">
                <div className="flex justify-between text-[10px] uppercase font-bold tracking-widest text-gray-600">
                    <span>Phase: {proj.current_phase.replace('_', ' ')}</span>
                    <span>{proj.progress}%</span>
                </div>
                <div className="w-full h-1.5 bg-[#222] rounded-full overflow-hidden">
                    <div className="h-full bg-red-600 transition-all duration-1000" style={{ width: `${proj.progress}%` }} />
                </div>
                </div>

                {/* Conflict Warning Overlay on Hover */}
                {isLockedByOther && (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition backdrop-blur-sm">
                        <div className="text-center">
                            <span className="text-2xl mb-2 block">👁️</span>
                            <p className="text-xs font-bold text-white uppercase tracking-widest">Enter Read-Only Mode</p>
                        </div>
                    </div>
                )}
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] border border-[#333] w-full max-w-2xl p-8 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold mb-6">Create Documentary</h3>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Project Title</label>
                    <input 
                      type="text" 
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-[#333] rounded p-3 focus:outline-none focus:border-red-600"
                      placeholder="e.g. The Silicon Valley Boom"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Brief Description</label>
                    <textarea 
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      rows={4}
                      className="w-full bg-[#0a0a0a] border border-[#333] rounded p-3 focus:outline-none focus:border-red-600"
                      placeholder="What is this documentary about?"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Select Template</label>
                  <div className="space-y-3">
                    {templates.map(t => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setSelectedTemplateId(t.id);
                          if (!newTitle) setNewTitle(t.name);
                          if (!newDesc) setNewDesc(t.description);
                        }}
                        className={`w-full text-left p-3 rounded border transition ${selectedTemplateId === t.id ? 'bg-red-600/10 border-red-600' : 'bg-[#0a0a0a] border-[#333] hover:border-gray-500'}`}
                      >
                        <p className="text-sm font-bold text-white">{t.name}</p>
                        <p className="text-[10px] text-gray-500 mt-1">{t.description}</p>
                      </button>
                    ))}
                    <button
                      onClick={() => setSelectedTemplateId(undefined)}
                      className={`w-full text-left p-3 rounded border transition ${!selectedTemplateId ? 'bg-red-600/10 border-red-600' : 'bg-[#0a0a0a] border-[#333] hover:border-gray-500'}`}
                    >
                      <p className="text-sm font-bold text-white">Custom Blank</p>
                      <p className="text-[10px] text-gray-500 mt-1">Start from scratch with full control.</p>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-4 mt-10">
              <button 
                onClick={() => setShowModal(false)}
                className="flex-1 bg-[#222] hover:bg-[#333] py-3 rounded font-bold transition"
              >
                CANCEL
              </button>
              <button 
                onClick={() => {
                  onCreateProject(newTitle, newDesc, selectedTemplateId);
                  setShowModal(false);
                }}
                className="flex-1 bg-red-600 hover:bg-red-700 py-3 rounded font-bold transition shadow-lg shadow-red-900/20"
              >
                INITIALIZE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setConfirmDeleteId(null)}>
          <div className="bg-[#1a1a1a] border border-red-600/30 w-full max-w-sm p-8 rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-2">Delete Project?</h3>
            <p className="text-sm text-gray-400 mb-6">This will permanently delete the project and all its data (series, episodes, research, scripts, assets). This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 bg-[#222] hover:bg-[#333] py-3 rounded font-bold text-sm transition"
              >
                Cancel
              </button>
              <button
                onClick={() => { onDeleteProject(confirmDeleteId); setConfirmDeleteId(null); }}
                className="flex-1 bg-red-600 hover:bg-red-700 py-3 rounded font-bold text-sm transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
