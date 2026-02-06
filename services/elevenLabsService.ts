
import { ElevenLabsSettings, VoiceTalent } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '';

const DEFAULT_VOICES: VoiceTalent[] = [
  { id: 'demo-rachel', name: 'Rachel (Narrator)', category: 'premade', provider: 'elevenlabs' },
  { id: 'demo-drew', name: 'Drew (Documentary)', category: 'premade', provider: 'elevenlabs' },
  { id: 'demo-clyde', name: 'Clyde (Authoritative)', category: 'premade', provider: 'elevenlabs' },
  { id: 'demo-domi', name: 'Domi (Conversational)', category: 'premade', provider: 'elevenlabs' },
  { id: 'demo-bella', name: 'Bella (Warm)', category: 'premade', provider: 'elevenlabs' },
  { id: 'demo-antoni', name: 'Antoni (Presenter)', category: 'premade', provider: 'elevenlabs' },
];

export const elevenLabsService = {

  /**
   * Fetches the user's voice library via backend proxy (API key stays server-side).
   * Falls back to premade demo voices if no API key configured.
   */
  async getVoices(userId: string): Promise<VoiceTalent[]> {
    if (!userId) return DEFAULT_VOICES;

    try {
      const response = await fetch(`${API_BASE}/api/elevenlabs/voices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });

      if (!response.ok) throw new Error("Failed to fetch voices");

      const data = await response.json();
      const voices = data.voices || [];
      // If backend returned no voices (no API key), use defaults
      return voices.length > 0 ? voices : DEFAULT_VOICES;
    } catch (error) {
      console.error("ElevenLabs Fetch Error", error);
      return DEFAULT_VOICES;
    }
  },

  /**
   * Generates audio via backend proxy (API key stays server-side).
   */
  async generateAudio(
    userId: string,
    voiceId: string,
    text: string,
    settings: ElevenLabsSettings
  ): Promise<string> {
    if (!userId) {
        // Mock generation for UI demo without key
        await new Promise(r => setTimeout(r, 2000));
        return "https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4";
    }

    try {
      const response = await fetch(`${API_BASE}/api/elevenlabs/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, voiceId, text, settings })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Generation Failed");
      }

      const data = await response.json();
      return data.audioUrl;
    } catch (error) {
      console.error("ElevenLabs Generation Error", error);
      throw error;
    }
  }
};
