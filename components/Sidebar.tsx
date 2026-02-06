
import React from 'react';
import { DocumentaryProject, ProjectPhase, UserProfile } from '../types';

interface SidebarProps {
  activeProject: DocumentaryProject | null;
  user: UserProfile;
  onSelectDashboard: () => void;
  onSwitchPhase: (phase: ProjectPhase) => void;
  onToggleNotifications: () => void;
  onLogout: () => void;
  notificationCount: number;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  activeProject, 
  user, 
  onSelectDashboard, 
  onSwitchPhase, 
  onToggleNotifications,
  onLogout,
  notificationCount 
}) => {
  const phases: { id: ProjectPhase; label: string; icon: string }[] = [
    { id: 'planning', label: '0. Planning', icon: '🗺️' },
    { id: 'research', label: '1. Research', icon: '🔍' },
    { id: 'archive', label: '2. Archive', icon: '📼' },
    { id: 'scripting', label: '3. Scripting', icon: '📝' },
    { id: 'expert_interview', label: '3b. Interviews', icon: '💬' },
    { id: 'voice_over', label: '4. Voice Over', icon: '🎙️' },
    { id: 'assembly', label: '5. Assembly', icon: '✂️' },
    { id: 'review', label: '6. Review', icon: '✅' },
  ];

  return (
    <aside className="w-64 bg-[#111] border-r border-[#222] flex flex-col">
      <div className="p-4 border-b border-[#222]">
        <img src="/aim-logo.png" alt="AiM - AI Production Studio" className="w-full rounded" />
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        <button 
          onClick={onSelectDashboard}
          className={`w-full text-left p-3 rounded-lg flex items-center justify-between transition ${!activeProject ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5'}`}
        >
          <div className="flex items-center gap-3">
            <span>🏠</span> Dashboard
          </div>
        </button>

        <button 
          onClick={onToggleNotifications}
          className="w-full text-left p-3 rounded-lg flex items-center justify-between text-gray-400 hover:bg-white/5 transition"
        >
          <div className="flex items-center gap-3">
            <span>🔔</span> Notifications
          </div>
          {notificationCount > 0 && (
            <span className="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.2rem] text-center">
              {notificationCount}
            </span>
          )}
        </button>

        <button 
          onClick={() => onSwitchPhase('cloud_management')}
          className="w-full text-left p-3 rounded-lg flex items-center gap-3 text-gray-400 hover:bg-[#1a73e8]/10 hover:text-[#1a73e8] transition"
        >
          <span className="text-[#1a73e8]">☁️</span> Cloud Management
        </button>

        {activeProject && (
          <div className="pt-6">
            <p className="px-3 text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-2">Project Workflow</p>
            <div className="space-y-1">
              {phases.map((phase) => (
                <button
                  key={phase.id}
                  onClick={() => onSwitchPhase(phase.id)}
                  className={`w-full text-left p-3 rounded-lg text-sm flex items-center gap-3 transition ${
                    activeProject.current_phase === phase.id ? 'bg-red-600/20 text-red-500 font-semibold' : 'text-gray-400 hover:bg-white/5'
                  }`}
                >
                  <span className="text-lg opacity-80">{phase.icon}</span>
                  {phase.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-[#222]">
        <div className="bg-[#1a1a1a] rounded-lg p-3 mb-2">
            <div className="flex items-center gap-3 mb-2">
                <img src={user.avatar} className="w-8 h-8 rounded-full border border-[#333]" alt="Profile" />
                <div className="text-left overflow-hidden">
                    <p className="text-xs font-medium text-white truncate">{user.username}</p>
                    <p className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">{user.role}</p>
                </div>
            </div>
            <div className="flex gap-2">
                 <button 
                    onClick={() => onSwitchPhase('settings')}
                    className="flex-1 text-[9px] bg-[#222] hover:bg-white hover:text-black text-gray-400 py-1 rounded transition uppercase font-bold"
                >
                    Settings
                </button>
                 <button 
                    onClick={onLogout}
                    className="flex-1 text-[9px] bg-[#222] hover:bg-red-900 hover:text-white text-gray-400 py-1 rounded transition uppercase font-bold"
                >
                    Log Out
                </button>
            </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
