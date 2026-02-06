
import { ElevenLabsSettings, VoiceTalent } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '';

export const elevenLabsService = {

  /**
   * Fetches the user's voice library via backend proxy (API key stays server-side).
   */
  async getVoices(userId: string): Promise<VoiceTalent[]> {
    if (!userId) return [];

    try {
      const response = await fetch(`${API_BASE}/api/elevenlabs/voices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });

      if (!response.ok) throw new Error("Failed to fetch voices");

      const data = await response.json();
      return data.voices || [];
    } catch (error) {
      console.error("ElevenLabs Fetch Error", error);
      return [
        { id: 'eleven-1', name: 'Marcus (Narrator Deep)', category: 'cloned', provider: 'elevenlabs' },
        { id: 'eleven-2', name: 'Sarah (Journalist)', category: 'generated', provider: 'elevenlabs' },
      ];
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
