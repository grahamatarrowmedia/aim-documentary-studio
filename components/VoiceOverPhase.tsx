
import React, { useState, useEffect } from 'react';
import { DocumentaryProject, VoiceOver, VoiceTalent, ElevenLabsSettings, UserProfile } from '../types';
import { elevenLabsService } from '../services/elevenLabsService';

interface VoiceOverPhaseProps {
  project: DocumentaryProject;
  user: UserProfile;
  onAdvance: () => void;
}

const defaultSettings: ElevenLabsSettings = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.0,
  use_speaker_boost: true
};

const INTONATION_TAGS = [
    { label: 'Slowly', tag: '[slowly]' },
    { label: 'Loudly', tag: '[loudly]' },
    { label: 'Whisper', tag: '[whisper]' },
    { label: 'Emotional', tag: '[emotional]' },
    { label: 'Pause', tag: '[pause]' }, 
    { label: 'Excited', tag: '[excited]' },
    { label: 'Serious', tag: '[serious]' },
    { label: 'Laugh', tag: '[laugh]' }
];

const VoiceOverPhase: React.FC<VoiceOverPhaseProps> = ({ project, user, onAdvance }) => {
  const [availableVoices, setAvailableVoices] = useState<VoiceTalent[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  
  const apiKey = user.elevenLabsApiKey || '';

  const [voiceOvers, setVoiceOvers] = useState<VoiceOver[]>([]);

  // Track cursor position to insert tags seamlessly
  const [lastCursorPos, setLastCursorPos] = useState<{ id: string, start: number, end: number } | null>(null);

  useEffect(() => {
    const fetchVoices = async () => {
        setIsLoadingVoices(true);
        const voices = await elevenLabsService.getVoices(apiKey);
        setAvailableVoices(voices);
        
        if (voices.length > 0) {
            setVoiceOvers(prev => prev.map(vo => 
                vo.voice_id ? vo : { ...vo, voice_id: voices[0].id, voice_name: voices[0].name }
            ));
        }
        setIsLoadingVoices(false);
    };
    fetchVoices();
  }, [apiKey]);

  const generateLine = async (voId: string) => {
    const vo = voiceOvers.find(v => v.id === voId);
    if (!vo || !vo.voice_id) return;

    setVoiceOvers(prev => prev.map(v => v.id === voId ? { ...v, status: 'generating' } : v));

    try {
        const audioUrl = await elevenLabsService.generateAudio(
            apiKey, 
            vo.voice_id, 
            vo.text, 
            vo.generation_settings || defaultSettings
        );
        
        setVoiceOvers(prev => prev.map(v => v.id === voId ? { 
            ...v, 
            status: 'complete', 
            audio_url: audioUrl,
            duration_seconds: 12.5 
        } : v));
    } catch (error) {
        console.error(error);
        setVoiceOvers(prev => prev.map(v => v.id === voId ? { ...v, status: 'failed' } : v));
    }
  };

  const updateSettings = (voId: string, key: keyof ElevenLabsSettings, value: number | boolean) => {
    setVoiceOvers(prev => prev.map(vo => {
        if (vo.id !== voId) return vo;
        return {
            ...vo,
            generation_settings: {
                ...(vo.generation_settings || defaultSettings),
                [key]: value
            }
        };
    }));
  };

  const updateVoiceSelection = (voId: string, voiceId: string) => {
      const voice = availableVoices.find(v => v.id === voiceId);
      setVoiceOvers(prev => prev.map(vo => 
        vo.id === voId ? { ...vo, voice_id: voiceId, voice_name: voice?.name || 'Unknown', status: 'pending' } : vo
      ));
  };

  const handleTextSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>, id: string) => {
      const target = e.currentTarget;
      setLastCursorPos({ id, start: target.selectionStart, end: target.selectionEnd });
  };

  const insertTag = (voId: string, tag: string) => {
      const vo = voiceOvers.find(v => v.id === voId);
      if (!vo) return;

      let newText = vo.text;
      let newCursorPos = vo.text.length + tag.length + 1;

      // Insert at tracked cursor position or append
      if (lastCursorPos && lastCursorPos.id === voId) {
          const prefix = vo.text.substring(0, lastCursorPos.start);
          const suffix = vo.text.substring(lastCursorPos.end);
          // Add space padding if needed
          const padLeft = prefix.length > 0 && !prefix.endsWith(' ') ? ' ' : '';
          const padRight = suffix.length > 0 && !suffix.startsWith(' ') ? ' ' : '';
          
          newText = `${prefix}${padLeft}${tag}${padRight}${suffix}`;
          newCursorPos = lastCursorPos.start + padLeft.length + tag.length + padRight.length;
      } else {
          newText = `${vo.text} ${tag}`;
      }

      setVoiceOvers(prev => prev.map(v => v.id === voId ? { ...v, text: newText, status: 'pending' } : v));
      
      // Update cursor tracking so subsequent clicks flow naturally
      setLastCursorPos({ id: voId, start: newCursorPos, end: newCursorPos });
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-black uppercase italic tracking-tighter">PHASE 04: Voice Over</h2>
          <div className="flex items-center gap-2 mt-1">
             <span className={`w-2 h-2 rounded-full ${apiKey ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></span>
             <p className="text-gray-500 text-xs">
                 {apiKey ? 'Connected to Your ElevenLabs API' : 'Demo Mode (Mock Voices)'}
             </p>
          </div>
        </div>
        <div className="flex gap-4">
          <button onClick={onAdvance} className="bg-white text-black font-bold px-6 py-2 rounded flex items-center gap-2">
            LOCK AUDIO <span className="text-xl">→</span>
          </button>
        </div>
      </div>

      {!apiKey && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-lg mb-6 flex justify-between items-center">
              <div className="flex items-center gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div>
                      <h4 className="text-sm font-bold text-yellow-500">No API Key Detected</h4>
                      <p className="text-xs text-yellow-200/70">Connect your ElevenLabs account in Settings to access your custom voice library.</p>
                  </div>
              </div>
              <div className="text-[10px] uppercase font-bold text-yellow-500">
                  Using Fallback Voices
              </div>
          </div>
      )}

      <div className="bg-[#111] border border-[#222] rounded-2xl overflow-hidden shadow-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#1a1a1a] border-b border-[#222] text-[10px] font-bold uppercase tracking-widest text-gray-500">
              <th className="p-4 w-[25%]">Voice & Character</th>
              <th className="p-4 w-[35%]">Script & Intonation</th>
              <th className="p-4 w-[20%]">Mixing Desk (Tone)</th>
              <th className="p-4 w-[20%]">Status & Output</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#222]">
            {voiceOvers.map(vo => (
              <tr key={vo.id} className="hover:bg-white/5 transition group">
                {/* COL 1: Voice Selection */}
                <td className="p-4 align-top">
                  <div className="space-y-2">
                     <p className="text-[10px] text-gray-500 font-mono">{vo.beat_id}</p>
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1a1a1a] to-[#333] border border-[#444] flex items-center justify-center">
                            {isLoadingVoices ? '...' : '🗣️'}
                        </div>
                        <div className="flex-1">
                            <select 
                                value={vo.voice_id}
                                onChange={(e) => updateVoiceSelection(vo.id, e.target.value)}
                                className="w-full bg-[#0a0a0a] border border-[#333] rounded px-2 py-1 text-xs font-bold text-white focus:border-blue-500 outline-none"
                            >
                                {availableVoices.map(v => (
                                    <option key={v.id} value={v.id}>{v.name} ({v.category})</option>
                                ))}
                            </select>
                            <p className="text-[9px] text-gray-500 mt-1">Provider: ElevenLabs</p>
                        </div>
                     </div>
                  </div>
                </td>

                {/* COL 2: Script & Prompting */}
                <td className="p-4 align-top">
                  <div className="space-y-2">
                    <textarea 
                        value={vo.text}
                        onChange={(e) => {
                            const newText = e.target.value;
                            setVoiceOvers(prev => prev.map(v => v.id === vo.id ? { ...v, text: newText, status: 'pending' } : v));
                        }}
                        onSelect={(e) => handleTextSelect(e, vo.id)}
                        onClick={(e) => handleTextSelect(e, vo.id)}
                        onKeyUp={(e) => handleTextSelect(e, vo.id)}
                        className="w-full h-24 bg-transparent text-sm text-gray-300 leading-relaxed resize-none focus:outline-none border border-transparent focus:border-[#333] rounded p-2"
                    />
                    {/* Director's Cues Toolbar */}
                    <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">Director Cues:</span>
                        <div className="flex flex-wrap gap-1.5">
                            {INTONATION_TAGS.map(tag => (
                                <button
                                    key={tag.label}
                                    onClick={() => insertTag(vo.id, tag.tag)}
                                    className="text-[9px] bg-[#222] hover:bg-white hover:text-black border border-[#333] px-2 py-1 rounded transition uppercase font-bold text-gray-400"
                                >
                                    {tag.label}
                                </button>
                            ))}
                        </div>
                    </div>
                  </div>
                </td>

                {/* COL 3: Mixing Desk (Settings) */}
                <td className="p-4 align-top">
                   <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-3 space-y-3">
                      <div>
                        <div className="flex justify-between text-[8px] uppercase font-bold text-gray-500 mb-1">
                            <span>Stability (Variability)</span>
                            <span>{Math.round((vo.generation_settings?.stability || 0) * 100)}%</span>
                        </div>
                        <input 
                            type="range" min="0" max="1" step="0.01"
                            value={vo.generation_settings?.stability}
                            onChange={(e) => updateSettings(vo.id, 'stability', parseFloat(e.target.value))}
                            className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[8px] uppercase font-bold text-gray-500 mb-1">
                            <span>Clarity Boost</span>
                            <span>{Math.round((vo.generation_settings?.similarity_boost || 0) * 100)}%</span>
                        </div>
                        <input 
                            type="range" min="0" max="1" step="0.01"
                            value={vo.generation_settings?.similarity_boost}
                            onChange={(e) => updateSettings(vo.id, 'similarity_boost', parseFloat(e.target.value))}
                            className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer"
                        />
                      </div>

                       <div>
                        <div className="flex justify-between text-[8px] uppercase font-bold text-gray-500 mb-1">
                            <span>Style Exaggeration</span>
                            <span>{Math.round((vo.generation_settings?.style || 0) * 100)}%</span>
                        </div>
                        <input 
                            type="range" min="0" max="1" step="0.01"
                            value={vo.generation_settings?.style}
                            onChange={(e) => updateSettings(vo.id, 'style', parseFloat(e.target.value))}
                            className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                   </div>
                </td>

                {/* COL 4: Action */}
                <td className="p-4 align-top text-right">
                   <div className="flex flex-col items-end gap-3">
                      <span className={`text-[9px] font-bold px-2 py-1 rounded uppercase ${
                        vo.status === 'complete' ? 'bg-green-500/10 text-green-500' : 
                        vo.status === 'failed' ? 'bg-red-500/10 text-red-500' :
                        vo.status === 'generating' ? 'bg-blue-500/10 text-blue-500 animate-pulse' :
                        'bg-yellow-500/10 text-yellow-500'
                      }`}>
                        {vo.status}
                      </span>
                      
                      <button 
                        onClick={() => generateLine(vo.id)}
                        disabled={vo.status === 'generating'}
                        className="bg-white hover:bg-gray-200 disabled:opacity-50 text-black font-bold text-[10px] px-4 py-2 rounded uppercase tracking-wider transition"
                      >
                         {vo.status === 'generating' ? 'Recording...' : 'Record Line'}
                      </button>

                      {vo.audio_url && (
                          <audio controls src={vo.audio_url} className="w-32 h-6 mt-2" />
                      )}
                   </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default VoiceOverPhase;
