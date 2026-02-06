
import React, { useState, useEffect, useRef } from 'react';
import { DocumentaryProject, TimelineItem } from '../types';
import { apiService } from '../services/apiService';

interface AssemblyPhaseProps {
  project: DocumentaryProject;
  onAdvance: () => void;
}

const beatToTrackType = (beatType: string): TimelineItem['track_type'] | null => {
  switch (beatType?.toLowerCase()) {
    case 'voice_over': case 'narration': case 'narrator': case 'vo': return 'audio';
    case 'expert': case 'interview': case 'expert_interview': case 'soundbite': return 'expert';
    case 'archive': case 'b-roll': case 'b_roll': case 'broll': case 'archival': case 'footage': return 'video';
    case 'ai_visual': case 'transition': case 'title_card': case 'graphic': case 'visual': return 'graphics';
    default: return 'video';
  }
};

const beatToSourceType = (beatType: string): TimelineItem['source_type'] => {
  switch (beatType?.toLowerCase()) {
    case 'voice_over': case 'narration': case 'narrator': case 'vo': return 'voice_over';
    case 'expert': case 'interview': case 'expert_interview': case 'soundbite': return 'expert_interview';
    case 'archive': case 'b-roll': case 'b_roll': case 'broll': case 'archival': case 'footage': return 'archive_clip';
    case 'ai_visual': case 'transition': case 'title_card': case 'graphic': case 'visual': return 'ai_generated';
    default: return 'archive_clip';
  }
};

const trackColor = (trackType: string): string => {
  switch (trackType) {
    case 'audio': return 'bg-blue-600/80';
    case 'expert': return 'bg-green-600/80';
    case 'video': return 'bg-yellow-600/80';
    case 'graphics': return 'bg-purple-600/80';
    case 'music': return 'bg-pink-600/80';
    case 'sfx': return 'bg-orange-600/80';
    default: return 'bg-gray-600/80';
  }
};

const stripHtml = (html: string) => html.replace(/<[^>]*>?/gm, '');

const AssemblyPhase: React.FC<AssemblyPhaseProps> = ({ project, onAdvance }) => {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load timeline items — auto-populate from script if empty
  useEffect(() => {
    const loadTimeline = async () => {
      setIsLoading(true);
      try {
        const shots = await apiService.getShotsByProject(project.id);
        const timelineShots = shots.filter((s: any) => s.track_type);

        if (timelineShots.length > 0) {
          setItems(timelineShots);
          setIsLoading(false);
          return;
        }

        // No timeline items yet — auto-populate from script beats
        const scripts = await apiService.getScriptsByProject(project.id);
        if (scripts.length === 0) { setIsLoading(false); return; }

        const latest = scripts.sort((a: any, b: any) => (b.version || 0) - (a.version || 0))[0];
        const newItems: TimelineItem[] = [];
        let runningTime = 0;

        (latest.parts || []).forEach((part: any) => {
          (part.scenes || []).forEach((scene: any) => {
            (scene.beats || []).forEach((beat: any) => {
              const duration = beat.duration_seconds || 15;
              const trackType = beatToTrackType(beat.type);
              if (!trackType) return;

              const rawLabel = beat.speaker
                ? `${beat.speaker}: ${stripHtml(beat.content || '').slice(0, 40)}`
                : stripHtml(beat.content || '').slice(0, 50) || `${beat.type} beat`;

              newItems.push({
                id: `tl-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                project_id: project.id,
                track_type: trackType,
                track_index: 0,
                start_time: runningTime,
                end_time: runningTime + duration,
                duration,
                source_type: beatToSourceType(beat.type),
                source_id: beat.id,
                label: rawLabel,
                color: trackColor(trackType),
              });
              runningTime += duration;
            });
          });
        });

        // Also pull in voice-over shots that may have been generated
        const voShots = shots.filter((s: any) => s.source_type === 'voice_over' && !s.track_type);
        let voTime = runningTime;
        voShots.forEach((vo: any) => {
          const dur = vo.duration_seconds || 15;
          newItems.push({
            id: `tl-vo-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            project_id: project.id,
            track_type: 'audio',
            track_index: 0,
            start_time: voTime,
            end_time: voTime + dur,
            duration: dur,
            source_type: 'voice_over',
            source_id: vo.id,
            label: vo.text ? stripHtml(vo.text).slice(0, 50) : 'Voice Over',
            color: trackColor('audio'),
          });
          voTime += dur;
        });

        if (newItems.length > 0) {
          const saved = await Promise.all(newItems.map(item =>
            apiService.createShot({ ...item, projectId: project.id })
          ));
          setItems(saved.map((s: any, i: number) => ({ ...newItems[i], id: s.id })));
        }
      } catch (err) {
        console.error('Failed to load timeline:', err);
      }
      setIsLoading(false);
    };
    loadTimeline();
  }, [project.id]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); // in seconds
  const requestRef = useRef<number>();
  const startTimeRef = useRef<number>(0);

  const tracks: Array<{ id: string; label: string; type: any }> = [
    { id: 'graphics', label: 'Graphics', type: 'graphics' },
    { id: 'video', label: 'Video', type: 'video' },
    { id: 'expert', label: 'Expert', type: 'expert' },
    { id: 'audio', label: 'Voice Over', type: 'audio' },
    { id: 'music', label: 'Music', type: 'music' },
    { id: 'sfx', label: 'SFX', type: 'sfx' },
  ];

  const pixelsPerSecond = 10;
  const computedMax = items.length > 0
    ? Math.max(...items.map(i => (i.start_time || 0) + (i.duration || 0))) + 30
    : 300;
  const maxDuration = Math.max(computedMax, 60);

  const togglePlay = () => {
      if (isPlaying) {
          setIsPlaying(false);
          if (requestRef.current) cancelAnimationFrame(requestRef.current);
      } else {
          setIsPlaying(true);
          startTimeRef.current = performance.now() - (currentTime * 1000);
          requestRef.current = requestAnimationFrame(animate);
      }
  };

  const animate = (time: number) => {
      const elapsed = (time - startTimeRef.current) / 1000;
      if (elapsed > maxDuration) {
          setIsPlaying(false);
          setCurrentTime(maxDuration);
      } else {
          setCurrentTime(elapsed);
          requestRef.current = requestAnimationFrame(animate);
      }
  };

  useEffect(() => {
      return () => {
          if (requestRef.current) cancelAnimationFrame(requestRef.current);
      }
  }, []);

  const formatTimecode = (seconds: number) => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      const f = Math.floor((seconds % 1) * 24); // 24fps
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${f.toString().padStart(2, '0')}`;
  };

  const skipForward = () => {
    const next = Math.min(currentTime + 10, maxDuration);
    setCurrentTime(next);
    if (isPlaying) {
      startTimeRef.current = performance.now() - (next * 1000);
    }
  };

  const exportEDL = () => {
    let edl = `TITLE: ${project.title}\nFCM: NON-DROP FRAME\n\n`;
    const sorted = [...items].sort((a, b) => (a.start_time || 0) - (b.start_time || 0));
    if (sorted.length === 0) {
      edl += `001  AX  V  C  00:00:00:00 00:00:00:00 00:00:00:00 00:00:00:00\n* EMPTY TIMELINE\n`;
    } else {
      sorted.forEach((item, idx) => {
        const num = String(idx + 1).padStart(3, '0');
        const srcIn = formatTimecode(0);
        const srcOut = formatTimecode(item.duration || 0);
        const recIn = formatTimecode(item.start_time || 0);
        const recOut = formatTimecode((item.start_time || 0) + (item.duration || 0));
        const trackCode = item.track_type === 'audio' || item.track_type === 'music' || item.track_type === 'sfx' ? 'A' : 'V';
        edl += `${num}  AX  ${trackCode}  C  ${srcIn} ${srcOut} ${recIn} ${recOut}\n`;
        edl += `* FROM CLIP NAME: ${item.label || 'Untitled'}\n\n`;
      });
    }
    const blob = new Blob([edl], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title.replace(/\s+/g, '_')}_timeline.edl`;
    a.click();
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col h-full">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-black uppercase italic tracking-tighter">PHASE 05: Timeline Assembly</h2>
          <p className="text-gray-500">Professional NLE Sequence Mapping.</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={exportEDL}
            className="bg-[#222] hover:bg-[#333] text-white font-bold px-6 py-2 rounded flex items-center gap-2"
          >
            EXPORT EDL/XML
          </button>
          <button onClick={onAdvance} className="bg-white text-black font-bold px-6 py-2 rounded flex items-center gap-2">
            FINAL REVIEW <span className="text-xl">→</span>
          </button>
        </div>
      </div>

      <div className="flex-1 bg-[#111] border border-[#222] rounded-2xl overflow-hidden flex flex-col relative">
        {/* Playhead Line */}
        <div 
            className="absolute top-0 bottom-16 w-0.5 bg-red-500 z-50 pointer-events-none transition-transform duration-75 ease-linear"
            style={{ left: `${currentTime * pixelsPerSecond}px` }}
        >
            <div className="w-3 h-3 bg-red-500 -ml-1.5 rotate-45 transform -mt-1.5"></div>
        </div>

        {/* Timeline Ruler */}
        <div className="h-8 border-b border-[#222] bg-[#1a1a1a] flex relative font-mono text-[9px] text-gray-600 overflow-hidden">
           <div className="absolute inset-0" style={{ transform: `translateX(${-currentTime * pixelsPerSecond + (currentTime > 0 ? 100 : 0)}px)` }}> 
              {/* Note: Ideally we scroll the timeline container, but for this mock we just move playhead mostly */}
               {Array.from({ length: 100 }).map((_, i) => (
                <div key={i} className="absolute h-full border-r border-[#333] px-1" style={{ left: `${i * 10 * pixelsPerSecond}px` }}>
                  00:{i * 10}:00
                </div>
              ))}
           </div>
        </div>

        {/* Tracks Area */}
        <div className="flex-1 overflow-auto custom-scrollbar relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-30 bg-[#111]/80">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-xs text-gray-500 font-mono">Loading timeline from script...</p>
              </div>
            </div>
          )}
          <div className="min-w-[2000px]">
            {tracks.map(track => (
              <div key={track.id} className="h-16 border-b border-[#222] flex relative group">
                {/* Track Label */}
                <div className="w-48 bg-[#151515] border-r border-[#222] sticky left-0 z-10 flex items-center px-4 font-bold text-[10px] uppercase tracking-widest text-gray-500 shadow-xl">
                  {track.label}
                </div>
                {/* Items in track */}
                <div className="relative flex-1">
                  {items.filter(item => item.track_type === track.type).map(item => (
                    <div 
                      key={item.id}
                      className={`absolute h-10 top-3 rounded px-3 flex items-center shadow-lg border border-white/10 ${item.color} cursor-pointer hover:brightness-110 transition group`}
                      style={{ 
                        left: `${item.start_time * pixelsPerSecond}px`, 
                        width: `${item.duration * pixelsPerSecond}px` 
                      }}
                    >
                      <span className="text-[10px] font-bold text-white truncate drop-shadow-md flex-1">{item.label}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setItems(prev => prev.filter(i => i.id !== item.id)); apiService.deleteShot(item.id).catch(console.error); }}
                        className="opacity-0 group-hover:opacity-100 text-white/50 hover:text-red-400 text-[10px] ml-1 transition flex-shrink-0"
                        title="Remove from timeline"
                      >✕</button>
                      <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/20 opacity-0 group-hover:opacity-100 cursor-ew-resize" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Playback Controls Footer */}
        <div className="p-4 bg-[#151515] border-t border-[#222] flex items-center justify-between z-20 relative">
          <div className="flex items-center gap-6">
            <button className="text-xl hover:text-white text-gray-400" onClick={() => { setCurrentTime(0); setIsPlaying(false); }}>⏮</button>
            <button 
                onClick={togglePlay}
                className="text-3xl bg-red-600 hover:bg-red-700 w-12 h-12 rounded-full flex items-center justify-center pl-1 shadow-lg shadow-red-900/40 transition active:scale-95"
            >
                {isPlaying ? '⏸' : '▶'}
            </button>
            <button className="text-xl hover:text-white text-gray-400" onClick={skipForward}>⏭</button>
            <div className="text-xl font-mono tracking-tighter text-red-500 w-32">
              {formatTimecode(currentTime)}
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="w-48 h-1 bg-[#333] rounded-full overflow-hidden">
                <div 
                    className="h-full bg-green-500 transition-all duration-75" 
                    style={{ width: isPlaying ? `${Math.abs(Math.sin(currentTime * 3)) * 50 + 25}%` : '5%' }}
                ></div>
             </div>
             <span className="text-[10px] font-bold text-gray-500">MASTER LEVELS</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssemblyPhase;
