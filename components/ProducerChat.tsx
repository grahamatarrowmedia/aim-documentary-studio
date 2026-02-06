
import React, { useState, useEffect, useRef } from 'react';
import { geminiService } from '../services/geminiService';
import { DocumentaryProject } from '../types';

interface ProducerChatProps {
  systemInstruction: string;
  activeProject: DocumentaryProject | null;
}

const ProducerChat: React.FC<ProducerChatProps> = ({ systemInstruction, activeProject }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && !chatRef.current) {
      chatRef.current = geminiService.createAssistantChat(systemInstruction);
    }
  }, [isOpen, systemInstruction]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = { role: 'user' as const, text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      if (!chatRef.current) chatRef.current = geminiService.createAssistantChat(systemInstruction);
      const prompt = activeProject 
        ? `[Context: Project "${activeProject.title}", Phase ${activeProject.current_phase}] ${input}` 
        : input;
        
      const response = await chatRef.current.sendMessage({ message: prompt });
      setMessages(prev => [...prev, { role: 'model', text: response.text || "I didn't quite get that." }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'model', text: "Error connecting to AI Assistant." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`fixed bottom-6 right-6 z-40 flex flex-col items-end transition-all ${isOpen ? 'w-80 md:w-96' : 'w-14'}`}>
      {isOpen && (
        <div className="bg-[#111] border border-[#222] rounded-2xl w-full h-[500px] flex flex-col shadow-2xl overflow-hidden mb-4 animate-in slide-in-from-bottom-4">
          <div className="bg-[#151515] p-4 border-b border-[#222] flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <h4 className="text-[10px] font-bold uppercase tracking-widest">Production Assistant</h4>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white">×</button>
          </div>
          
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {messages.length === 0 && (
              <div className="text-center py-10 opacity-30">
                <p className="text-xs italic">"How can I help with the production today?"</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-xl text-xs leading-relaxed ${
                  m.role === 'user' ? 'bg-red-600 text-white' : 'bg-[#1a1a1a] border border-[#333] text-gray-300'
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-[#1a1a1a] border border-[#333] p-3 rounded-xl">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                    <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSend} className="p-4 border-t border-[#222] bg-[#151515]">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type message..."
              className="w-full bg-[#0a0a0a] border border-[#333] rounded-full px-4 py-2 text-xs focus:outline-none focus:border-red-600"
            />
          </form>
        </div>
      )}
      
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-700 transition active:scale-95"
      >
        {isOpen ? '↓' : '💬'}
      </button>
    </div>
  );
};

export default ProducerChat;
