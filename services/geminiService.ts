
import { AvatarEnvironment } from '../types';

/**
 * Service to interact with the Gemini API.
 * In production (browser), calls go through our backend which uses Vertex AI.
 * This avoids exposing API keys to the client.
 */

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

async function apiCall<T>(endpoint: string, body: any): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `API call failed: ${response.status}`);
  }

  return response.json();
}

export const geminiService = {
  /**
   * Generates a summary with optional Google Search grounding.
   */
  async summarizeResearch(
    topic: string,
    engine: 'gemini_pro' | 'vertex_ai' | 'perplexity' | 'google_deep_research' = 'gemini_pro',
    systemInstruction: string = ""
  ) {
    return apiCall<{
      summary: string;
      key_facts: string[];
      expert_suggestions: string[];
      urls: string[];
    }>('/research', { topic, engine, systemInstruction });
  },

  /**
   * Generates a Series MCP Structure (Episodes & Themes) based on a premise.
   */
  async generateSeriesStructure(premise: string, episodesCount: number = 3) {
    return apiCall<{
      episodes: Array<{ title: string; research_focus: string; suggested_engine: string }>;
      themes: Array<{ title: string; research_focus: string; suggested_engine: string }>;
    }>('/series-structure', { premise, episodesCount });
  },

  /**
   * Creates a strategy planning chat session.
   * Note: In production, this returns a chat-like interface backed by stateless API calls.
   */
  createStrategyChat() {
    const history: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    const systemInstruction = `You are the Lead Research Strategist for a documentary production.
      Your goal is to help the producer refine their research mission.
      Ask clarifying questions about the angle, tone, and specific data points needed.
      Once the plan is solid, suggest specific research vectors.
      Keep responses concise and professional.`;

    return {
      async sendMessage({ message }: { message: string }) {
        history.push({ role: 'user', parts: [{ text: message }] });
        const result = await apiCall<{ response: string }>('/chat', {
          message,
          systemInstruction,
          history
        });
        history.push({ role: 'model', parts: [{ text: result.response }] });
        return { text: result.response };
      }
    };
  },

  /**
   * Creates a context-aware chat session.
   */
  createAssistantChat(systemInstruction: string) {
    const history: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    const instruction = systemInstruction || "You are a senior documentary producer assistant. Help the user with scripting, research, and production logistics.";

    return {
      async sendMessage({ message }: { message: string }) {
        history.push({ role: 'user', parts: [{ text: message }] });
        const result = await apiCall<{ response: string }>('/chat', {
          message,
          systemInstruction: instruction,
          history
        });
        history.push({ role: 'model', parts: [{ text: result.response }] });
        return { text: result.response };
      }
    };
  },

  /**
   * Generates a video using Veo.
   */
  async generateArchiveBroll(prompt: string) {
    const result = await apiCall<{ videoUri: string }>('/generate-broll', { prompt });
    return result.videoUri;
  },

  /**
   * Analyzes a clip to provide visual metadata.
   */
  async analyzeClip(clipTitle: string) {
    return apiCall<{
      visual_description: string;
      mood: string;
      quality_score: number;
    }>('/analyze-clip', { clipTitle });
  },

  /**
   * Searches external archives using Vertex AI intelligence.
   */
  async searchArchive(query: string, source: string) {
    return apiCall<Array<{
      title: string;
      duration_seconds: number;
      visual_description: string;
      archive_source: string;
      category: string;
      year_range?: string;
      quality?: string;
    }>>('/search-archive', { query, source });
  },

  /**
   * Analyzes a reference document for style and tone using Vertex AI.
   */
  async analyzeDocumentStyle(fileName: string, content?: string) {
    return apiCall<{
      tone: string;
      pacing: string;
      structure: string;
      visual_style?: string;
      narrative_voice?: string;
    }>('/chat', {
      message: `Analyze the style and tone of this document "${fileName}" for documentary production.
        ${content ? `Document content: ${content.substring(0, 5000)}` : ''}

        Return a brief analysis as JSON with:
        - tone: string (e.g., "Investigative & Serious", "Fast-paced & Energetic", "Educational & Calm")
        - pacing: string (e.g., "Slow burn", "Rapid", "Moderate")
        - structure: string (e.g., "Non-linear", "Chronological", "Thematic")
        - visual_style: string (suggested visual approach)
        - narrative_voice: string (suggested narration style)`,
      systemInstruction: 'You are a documentary style analyst. Always respond with valid JSON only.',
      history: []
    });
  },

  /**
   * Multi-Agent Script Generation.
   */
  async generateScriptMultiAgent(
    title: string,
    description: string,
    duration: number,
    referenceStyle: string,
    researchContext: string[],
    archiveContext: string[]
  ) {
    return apiCall<Array<{
      title: string;
      scenes: Array<{
        title: string;
        beats: Array<{
          type: string;
          content: string;
          speaker?: string;
          duration_seconds: number;
        }>;
      }>;
    }>>('/generate-script', {
      title,
      description,
      duration,
      referenceStyle,
      researchContext,
      archiveContext
    });
  },

  /**
   * Rewrites a specific script beat based on user instruction.
   */
  async refineScriptBeat(currentContent: string, instruction: string, context?: string) {
    const result = await apiCall<{ refined: string }>('/refine-beat', {
      currentContent,
      instruction,
      context
    });
    return result.refined;
  },

  /**
   * Generates an interview plan for a specific beat in the script.
   */
  async generateInterviewPlan(sceneContext: string, topic: string) {
    return apiCall<{
      ideal_soundbite: string;
      questions: string[];
    }>('/interview-plan', { sceneContext, topic });
  },

  /**
   * Finds expert candidates using Google Search grounding.
   */
  async findExpertCandidates(topic: string) {
    return apiCall<Array<{
      name: string;
      title: string;
      affiliation: string;
      relevance: string;
      relevance_score: number;
    }>>('/find-experts', { topic });
  },

  /**
   * Selects an appropriate avatar environment based on context.
   */
  async recommendAvatarEnvironment(context: string, topic: string): Promise<AvatarEnvironment> {
    // Mock library of environments - would come from backend in full implementation
    const environments = [
      { id: 'env-nasa-1', name: 'Mission Control 1969', category: 'NASA', thumbnailUrl: 'https://images.unsplash.com/photo-1541873676-a18131494184?auto=format&fit=crop&w=400&h=225' },
      { id: 'env-nasa-2', name: 'Lunar Orbit Window', category: 'NASA', thumbnailUrl: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=400&h=225' },
      { id: 'env-const-1', name: 'Mega-Dam Construction', category: 'Superstructures', thumbnailUrl: 'https://images.unsplash.com/photo-1590403323602-0e42d79d1c7f?auto=format&fit=crop&w=400&h=225' },
      { id: 'env-aban-1', name: 'Cold War Bunker', category: 'Abandoned', thumbnailUrl: 'https://images.unsplash.com/photo-1518715303843-586e350765b2?auto=format&fit=crop&w=400&h=225' },
      { id: 'env-studio-1', name: 'Clean Interview Studio', category: 'Studio', thumbnailUrl: 'https://images.unsplash.com/photo-1478737270239-2f63b131b906?auto=format&fit=crop&w=400&h=225' }
    ];

    // Simple topic-based matching for now
    let selected = environments[4]; // Default to studio
    const topicLower = topic.toLowerCase();

    if (topicLower.includes('nasa') || topicLower.includes('space') || topicLower.includes('moon')) {
      selected = environments[0];
    } else if (topicLower.includes('construction') || topicLower.includes('engineering')) {
      selected = environments[2];
    } else if (topicLower.includes('war') || topicLower.includes('military') || topicLower.includes('cold war')) {
      selected = environments[3];
    }

    return { ...selected, description: `Selected for topic: ${topic}` } as AvatarEnvironment;
  },

  /**
   * Generates an Avatar Video - placeholder for HeyGen/Synthesia integration.
   * Returns a placeholder URL until real video generation API is connected.
   */
  async generateAvatarVideo(avatarId: string, audioName: string, envId: string): Promise<string> {
    // TODO: Integrate with HeyGen or Synthesia API for real avatar video generation
    // For now, return a placeholder video while showing the generation is in progress
    const result = await apiCall<{ response: string }>('/chat', {
      message: `Generate a video production brief for an avatar video with:
        - Avatar ID: ${avatarId}
        - Audio: ${audioName}
        - Environment: ${envId}

        Return a brief production note confirming the video parameters are valid.`,
      systemInstruction: 'You are a video production assistant.',
      history: []
    });

    // Log the AI response for debugging
    console.log('Avatar video generation brief:', result.response);

    // Return sample video URL - replace with real API response when integrated
    return "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
  }
};
