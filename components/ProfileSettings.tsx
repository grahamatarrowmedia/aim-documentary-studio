
import React, { useState } from 'react';
import { UserProfile } from '../types';
import { apiService } from '../services/apiService';

// Extend Window interface for AI Studio API
declare global {
  interface Window {
    aistudio?: {
      openSelectKey?: () => Promise<void>;
    };
  }
}

interface ProfileSettingsProps {
  user: UserProfile;
  onUpdate: (user: UserProfile) => void;
}

const ProfileSettings: React.FC<ProfileSettingsProps> = ({ user, onUpdate }) => {
  const [formData, setFormData] = useState(user);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setSaveStatus('idle');
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      await apiService.updateUser(user.id, formData);
      onUpdate(formData);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenProKey = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      await window.aistudio.openSelectKey();
    } else {
      alert('Key selection logic not found in current environment.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="mb-12">
        <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">Producer Executive Suite</h2>
        <p className="text-gray-500 mt-2">Configure your identity and AiM production preferences.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="space-y-8">
          <section className="bg-[#111] border border-[#222] p-8 rounded-2xl">
            <h3 className="text-xs font-bold text-red-600 uppercase tracking-[0.2em] mb-6">Identity</h3>
            <div className="flex flex-col items-center mb-8">
              <img src={formData.avatar} className="w-24 h-24 rounded-full border-4 border-red-600/20 mb-4" alt="Avatar" />
              <button className="text-xs text-gray-500 hover:text-white uppercase font-bold">Update Photo</button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-600 uppercase mb-2">Display Name</label>
                <input 
                  type="text" 
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className="w-full bg-[#0a0a0a] border border-[#333] rounded p-3 focus:outline-none focus:border-red-600 text-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-600 uppercase mb-2">Short Bio</label>
                <textarea 
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  rows={3}
                  className="w-full bg-[#0a0a0a] border border-[#333] rounded p-3 focus:outline-none focus:border-red-600 text-sm"
                />
              </div>
            </div>
          </section>

          <section className="bg-gradient-to-br from-red-600/10 to-transparent border border-red-600/20 p-8 rounded-2xl">
            <h3 className="text-xs font-bold text-red-500 uppercase tracking-[0.2em] mb-2">Pro Access</h3>
            <p className="text-xs text-gray-400 mb-6">Connect your paid API key for VEO video generation and unlimited 1M token contexts.</p>
            <button 
              onClick={handleOpenProKey}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded text-sm transition"
            >
              UPGRADE TO PRO QUOTA
            </button>
            <p className="text-[9px] text-gray-600 mt-4 leading-tight">
              A paid GCP project key is required for advanced features. Visit <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="underline">billing docs</a>.
            </p>
          </section>
        </div>

        <div className="space-y-8">
            {/* Integrations */}
           <section className="bg-[#111] border border-[#222] p-8 rounded-2xl">
            <h3 className="text-xs font-bold text-blue-500 uppercase tracking-[0.2em] mb-6">External Integrations</h3>
            <div>
                <label className="block text-[10px] font-bold text-gray-600 uppercase mb-2 flex justify-between">
                    <span>ElevenLabs API Key</span>
                    <a href="https://elevenlabs.io/app/settings/api-keys" target="_blank" rel="noreferrer" className="text-gray-500 hover:text-white underline">Get Key</a>
                </label>
                <div className="flex gap-2">
                    <input 
                        type="password" 
                        name="elevenLabsApiKey"
                        value={formData.elevenLabsApiKey || ''}
                        onChange={handleChange}
                        placeholder="xi-api-key-..."
                        className="flex-1 bg-[#0a0a0a] border border-[#333] rounded p-3 focus:outline-none focus:border-blue-600 text-sm font-mono"
                    />
                </div>
                <p className="text-[10px] text-gray-500 mt-2">Required for custom Voice Cloning workflow.</p>
            </div>
          </section>

          <section className="bg-[#111] border border-[#222] p-8 rounded-2xl flex flex-col">
            <h3 className="text-xs font-bold text-red-600 uppercase tracking-[0.2em] mb-6">Production Bible (Custom AI Instructions)</h3>
            <p className="text-xs text-gray-400 mb-6 leading-relaxed">
              Define the "House Style" for AiM. These instructions are injected into every AI agent call, ensuring consistency across research, scripts, and visuals.
            </p>
            <textarea 
              name="customInstructions"
              value={formData.customInstructions}
              onChange={handleChange}
              placeholder="e.g. Always write in the style of David Attenborough. Focus on scientific accuracy. Use short, punchy sentences."
              className="flex-1 w-full bg-[#0a0a0a] border border-[#333] rounded p-4 focus:outline-none focus:border-red-600 text-sm font-mono leading-relaxed"
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="mt-8 bg-white text-black font-bold py-3 rounded text-sm hover:bg-gray-200 transition disabled:opacity-50"
            >
              {saving ? 'SAVING...' : 'COMMIT CHANGES'}
            </button>
            {saveStatus === 'saved' && (
              <p className="text-green-500 text-xs mt-2 text-center">Profile saved successfully.</p>
            )}
            {saveStatus === 'error' && (
              <p className="text-red-500 text-xs mt-2 text-center">Failed to save. Please try again.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;
