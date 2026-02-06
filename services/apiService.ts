/**
 * Client-side API service that proxies all AI requests through our secure backend.
 * In production, uses Vertex AI via service account auth (no API key exposure).
 */

// In dev, Vite proxy routes /api → Flask. In prod, VITE_API_URL is baked in at build time.
const API_BASE = import.meta.env.VITE_API_URL || '';

async function fetchAPI(endpoint: string, body: any) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || 'API request failed');
    }

    return response.json();
}

export const apiService = {
    // Research with engine selection (gemini_pro, vertex_ai, perplexity, google_deep_research)
    async summarizeResearch(topic: string, engine: string = 'gemini_pro', systemInstruction: string = '') {
        return fetchAPI('/api/research', { topic, engine, systemInstruction });
    },

    // Generate series structure with episodes and themes
    async generateSeriesStructure(premise: string, episodesCount: number = 3) {
        return fetchAPI('/api/series-structure', { premise, episodesCount });
    },

    // Multi-agent script generation
    async generateScriptMultiAgent(
        title: string,
        description: string,
        duration: number,
        referenceStyle: string,
        researchContext: string[],
        archiveContext: string[]
    ) {
        return fetchAPI('/api/generate-script', {
            title, description, duration, referenceStyle, researchContext, archiveContext
        });
    },

    // Archive search simulation
    async searchArchive(query: string, source: string) {
        return fetchAPI('/api/search-archive', { query, source });
    },

    // Clip visual analysis
    async analyzeClip(clipTitle: string) {
        return fetchAPI('/api/analyze-clip', { clipTitle });
    },

    // Interview planning
    async generateInterviewPlan(sceneContext: string, topic: string) {
        return fetchAPI('/api/interview-plan', { sceneContext, topic });
    },

    // Expert discovery with Google Search grounding
    async findExpertCandidates(topic: string) {
        return fetchAPI('/api/find-experts', { topic });
    },

    // Script beat refinement
    async refineScriptBeat(currentContent: string, instruction: string, context?: string) {
        const result = await fetchAPI('/api/refine-beat', { currentContent, instruction, context });
        return result.refined;
    },

    // Video generation (Veo)
    async generateArchiveBroll(prompt: string) {
        const result = await fetchAPI('/api/generate-broll', { prompt });
        return result.videoUri;
    },

    // Chat with context
    async chat(message: string, systemInstruction: string, history: any[] = []) {
        const result = await fetchAPI('/api/chat', { message, systemInstruction, history });
        return result.response;
    },

    // Index a source (URL, text, or YouTube) via Vertex AI analysis
    async indexSource(data: { type: string; url?: string; content?: string; title?: string }) {
        return fetchAPI('/api/index-source', data);
    },

    // Analyze an uploaded document
    async analyzeDocument(data: { content: string; fileName: string; fileType: string }) {
        return fetchAPI('/api/analyze-document', data);
    },

    // Multi-source research query (NotebookLM-style)
    async querySources(data: { query: string; sources: any[]; engine?: string }) {
        return fetchAPI('/api/query-sources', data);
    }
};

// Re-export as geminiService for backwards compatibility with existing components
export const geminiService = apiService;
