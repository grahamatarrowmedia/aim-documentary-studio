
import { ElevenLabsSettings, VoiceTalent } from '../types';

const BASE_URL = 'https://api.elevenlabs.io/v1';

export const elevenLabsService = {
  
  /**
   * Fetches the user's voice library from ElevenLabs.
   */
  async getVoices(apiKey: string): Promise<VoiceTalent[]> {
    if (!apiKey) throw new Error("API Key Missing");

    try {
      const response = await fetch(`${BASE_URL}/voices`, {
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error("Failed to fetch voices");

      const data = await response.json();
      
      return data.voices.map((v: any) => ({
        id: v.voice_id,
        name: v.name,
        category: v.category || 'Generated',
        provider: 'elevenlabs',
        preview_url: v.preview_url
      }));
    } catch (error) {
      console.error("ElevenLabs Fetch Error", error);
      // Fallback for demo purposes if API key is invalid/mock
      return [
        { id: 'eleven-1', name: 'Marcus (Narrator Deep)', category: 'cloned', provider: 'elevenlabs' },
        { id: 'eleven-2', name: 'Sarah (Journalist)', category: 'generated', provider: 'elevenlabs' },
      ];
    }
  },

  /**
   * Generates audio for a specific text line.
   */
  async generateAudio(
    apiKey: string, 
    voiceId: string, 
    text: string, 
    settings: ElevenLabsSettings
  ): Promise<string> {
    if (!apiKey) {
        // Mock generation for UI demo without key
        await new Promise(r => setTimeout(r, 2000));
        return "https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4"; // Placeholder audio/video
    }

    try {
      const response = await fetch(`${BASE_URL}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: settings.stability,
            similarity_boost: settings.similarity_boost,
            style: settings.style,
            use_speaker_boost: settings.use_speaker_boost
          }
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail?.message || "Generation Failed");
      }

      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error("ElevenLabs Generation Error", error);
      throw error;
    }
  }
};
