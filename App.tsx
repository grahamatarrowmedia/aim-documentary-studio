
import React, { useState, useEffect, useCallback } from 'react';
import {
  DocumentaryProject,
  ProjectPhase,
  UserProfile,
  Notification
} from './types';
import { apiService } from './services/apiService';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ResearchPhase from './components/ResearchPhase';
import ArchivePhase from './components/ArchivePhase';
import ScriptingPhase from './components/ScriptingPhase';
import ExpertInterviewPhase from './components/ExpertInterviewPhase';
import VoiceOverPhase from './components/VoiceOverPhase';
import AssemblyPhase from './components/AssemblyPhase';
import ReviewPhase from './components/ReviewPhase';
import ProfileSettings from './components/ProfileSettings';
import CloudServices from './components/CloudServices';
import ProducerChat from './components/ProducerChat';
import NotificationCenter from './components/NotificationCenter';
import PlanningPhase from './components/PlanningPhase';
import LoginScreen from './components/LoginScreen';

const App: React.FC = () => {
  // Start with no user to show Login Screen
  const [user, setUser] = useState<UserProfile | null>(null);

  const [projects, setProjects] = useState<DocumentaryProject[]>([]);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [currentGlobalPhase, setCurrentGlobalPhase] = useState<ProjectPhase | null>(null);
  
  // Is the current user viewing a project they didn't lock?
  const [isSpectatorMode, setIsSpectatorMode] = useState(false);

  const activeProject = projects.find(p => p.id === activeProjectId) || null;

  const loadProjects = useCallback(async () => {
    try {
      const data = await apiService.getProjects();
      setProjects(data);
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  }, []);

  const handleLogin = (selectedUser: UserProfile) => {
    setUser(selectedUser);
  };

  // Fetch projects from backend once logged in
  useEffect(() => {
    if (user) loadProjects();
  }, [user, loadProjects]);

  const handleLogout = () => {
    setUser(null);
    setActiveProjectId(null);
    setCurrentGlobalPhase(null);
  };

  const addNotification = (title: string, message: string, type: Notification['type'] = 'info') => {
    const newNotif: Notification = {
      id: Date.now().toString(),
      title,
      message,
      type,
      timestamp: new Date().toLocaleTimeString(),
      read: false
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const handleCreateProject = async (title: string, desc: string, templateId?: string) => {
    try {
      const payload = {
        title,
        description: desc,
        target_duration_minutes: 30,
        target_format: templateId === 'short-int' ? 'short_form' : (templateId === 'tech-expl' ? 'explainer' : 'documentary'),
        current_phase: 'planning',
        progress: 0,
        status: 'active',
        created_at: new Date().toISOString(),
        template_id: templateId,
        locked_by: user?.id
      };
      const saved = await apiService.createProject(payload);
      setProjects(prev => [...prev, saved]);
      setActiveProjectId(saved.id);
      setIsSpectatorMode(false);
      setCurrentGlobalPhase(null);
      addNotification('Project Created', `Started work on "${title}"`, 'success');
    } catch (err) {
      console.error('Failed to create project:', err);
      addNotification('Error', 'Failed to create project', 'error');
    }
  };

  const handleSelectProject = async (projectId: string) => {
      const proj = projects.find(p => p.id === projectId);
      if (!proj) return;

      if (proj.locked_by && proj.locked_by !== user?.id) {
          setIsSpectatorMode(true);
          addNotification('Spectator Mode', 'This project is currently being edited by another user. You are in read-only mode.', 'warning');
      } else {
          setIsSpectatorMode(false);
          if (!proj.locked_by) {
             const lockData = { locked_by: user?.id, locked_by_avatar: user?.avatar };
             setProjects(prev => prev.map(p => p.id === projectId ? { ...p, ...lockData } : p));
             apiService.updateProject(projectId, lockData).catch(err => console.error('Failed to lock project:', err));
          }
      }
      setActiveProjectId(projectId);
      setCurrentGlobalPhase(null);
  };

  const updateProjectPhase = (id: string, phase: ProjectPhase, progress: number) => {
    if (isSpectatorMode) {
        alert("Action blocked: You are in Spectator Mode.");
        return;
    }
    const update = { current_phase: phase, progress };
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...update } : p));
    setCurrentGlobalPhase(null);
    apiService.updateProject(id, update).catch(err => console.error('Failed to update project phase:', err));
  };

  const handleGlobalPhaseSwitch = (phase: ProjectPhase) => {
    if (phase === 'cloud_management' || phase === 'settings') {
      setCurrentGlobalPhase(phase);
    } else {
      if (activeProjectId) {
        updateProjectPhase(activeProjectId, phase, activeProject?.progress || 0);
      }
    }
  };

  const renderPhase = () => {
    if (!user) return null; // Should be handled by parent check

    if (currentGlobalPhase === 'cloud_management') return <CloudServices />;
    if (currentGlobalPhase === 'settings') return <ProfileSettings user={user} onUpdate={(u) => setUser(u)} />;
    
    if (!activeProject) return <Dashboard user={user} projects={projects} onSelectProject={handleSelectProject} onCreateProject={handleCreateProject} />;

    const commonProps = { project: activeProject, onNotify: addNotification };
    // We could pass isSpectatorMode down to disable inputs in phases, 
    // but for this demo, the Dashboard alerts are the primary indicator.

    switch (activeProject.current_phase) {
      case 'planning': return <PlanningPhase {...commonProps} user={user} onAdvance={() => updateProjectPhase(activeProject.id, 'research', 15)} />;
      case 'research': return <ResearchPhase {...commonProps} user={user} onAdvance={() => updateProjectPhase(activeProject.id, 'archive', 30)} />;
      case 'archive': return <ArchivePhase {...commonProps} onAdvance={() => updateProjectPhase(activeProject.id, 'scripting', 45)} />;
      case 'scripting': return <ScriptingPhase project={activeProject} onAdvance={() => updateProjectPhase(activeProject.id, 'expert_interview', 60)} />;
      case 'expert_interview': return <ExpertInterviewPhase {...commonProps} onAdvance={() => updateProjectPhase(activeProject.id, 'voice_over', 70)} />;
      case 'voice_over': return <VoiceOverPhase project={activeProject} user={user} onAdvance={() => updateProjectPhase(activeProject.id, 'assembly', 85)} />;
      case 'assembly': return <AssemblyPhase project={activeProject} onAdvance={() => updateProjectPhase(activeProject.id, 'review', 95)} />;
      case 'review': return <ReviewPhase project={activeProject} user={user} onComplete={() => { addNotification('Project Locked', `"${activeProject.title}" has been signed off and locked.`, 'success'); setActiveProjectId(null); loadProjects(); }} />;
      default: return <Dashboard user={user} projects={projects} onSelectProject={handleSelectProject} onCreateProject={handleCreateProject} />;
    }
  };

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-gray-100 overflow-hidden font-sans">
      <Sidebar 
        activeProject={activeProject} 
        user={user}
        onSelectDashboard={() => { setActiveProjectId(null); setCurrentGlobalPhase(null); }} 
        onSwitchPhase={handleGlobalPhaseSwitch}
        onToggleNotifications={() => setShowNotifications(!showNotifications)}
        onLogout={handleLogout}
        notificationCount={notifications.filter(n => !n.read).length}
      />
      
      <main className="flex-1 overflow-y-auto relative p-8">
        {/* Spectator Mode Banner */}
        {isSpectatorMode && activeProject && (
            <div className="absolute top-0 left-0 right-0 bg-yellow-600/20 border-b border-yellow-600/30 text-yellow-500 text-xs font-bold px-8 py-2 flex items-center justify-between z-50 backdrop-blur-md">
                <span className="flex items-center gap-2">
                    <span className="text-xl">👁️</span> 
                    SPECTATOR MODE: This project is currently locked by another user. Editing is disabled.
                </span>
                <span className="uppercase tracking-widest opacity-70">Read Only</span>
            </div>
        )}
        
        <div className={isSpectatorMode ? 'mt-8 pointer-events-none opacity-80' : ''}>
             {renderPhase()}
        </div>
      </main>

      {showNotifications && (
        <NotificationCenter 
          notifications={notifications} 
          onClose={() => setShowNotifications(false)} 
          onMarkRead={(id) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))}
        />
      )}

      <ProducerChat systemInstruction={user.customInstructions} activeProject={activeProject} />
    </div>
  );
};

export default App;
