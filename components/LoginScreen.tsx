
import React from 'react';
import { UserProfile } from '../types';

interface LoginScreenProps {
  onLogin: (user: UserProfile) => void;
}

const MOCK_USERS: UserProfile[] = [
  {
    id: 'u1',
    username: 'Felix',
    role: 'producer',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
    bio: 'Executive Producer. Focus on Creative Direction & Final Approval.',
    customInstructions: 'Tone: High-end documentary, Investigative, Cinematic.',
    gcpProjectId: 'aim-prod-01'
  },
  {
    id: 'u2',
    username: 'Sarah',
    role: 'editor',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
    bio: 'Senior Editor. Focus on Timeline, Pacing, and Visuals.',
    customInstructions: 'Tone: Fast-paced, rythmic, engaging edits.',
    gcpProjectId: 'aim-prod-01'
  },
  {
    id: 'u3',
    username: 'Marcus',
    role: 'researcher',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Marcus',
    bio: 'Lead Researcher. Focus on Fact-Checking & Deep Research.',
    customInstructions: 'Tone: Academic, precise, highly cited.',
    gcpProjectId: 'aim-prod-01'
  },
  {
    id: 'u4',
    username: 'Elena',
    role: 'legal',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Elena',
    bio: 'Legal Counsel. Focus on Clearance & Compliance.',
    customInstructions: 'Tone: Formal, compliant, risk-averse.',
    gcpProjectId: 'aim-prod-01'
  }
];

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center font-sans animate-in fade-in duration-700">
      <div className="text-center mb-16">
        <h1 className="text-6xl font-black tracking-tighter text-white mb-4">
          <span className="text-red-600">AiM</span> STUDIO
        </h1>
        <p className="text-gray-500 uppercase tracking-widest text-sm">Intelligent Media Production Environment v2.0</p>
      </div>

      <div className="w-full max-w-4xl">
        <h2 className="text-center text-xl text-gray-300 font-medium mb-10">Who is working today?</h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 px-8">
          {MOCK_USERS.map(user => (
            <div key={user.id} className="group flex flex-col items-center gap-4 cursor-pointer" onClick={() => onLogin(user)}>
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-transparent group-hover:border-red-600 transition-all duration-300 relative shadow-2xl">
                 <img src={user.avatar} className="w-full h-full object-cover group-hover:scale-110 transition duration-500" alt={user.username} />
                 <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition"></div>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-gray-300 group-hover:text-white transition">{user.username}</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600 bg-[#111] px-2 py-1 rounded border border-[#222] group-hover:border-red-600/50 group-hover:text-red-500 transition">
                    {user.role}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-20">
         <button className="text-xs font-bold text-gray-600 uppercase tracking-widest hover:text-white transition">
            Manage Profiles
         </button>
      </div>
    </div>
  );
};

export default LoginScreen;
