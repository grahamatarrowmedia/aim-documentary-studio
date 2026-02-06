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

async function fetchGET(endpoint: string) {
    const response = await fetch(`${API_BASE}${endpoint}`);
    if (!response.ok) throw new Error(`GET ${endpoint} failed`);
    return response.json();
}

async function fetchPUT(endpoint: string, body: any) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`PUT ${endpoint} failed`);
    return response.json();
}

async function fetchDELETE(endpoint: string) {
    const response = await fetch(`${API_BASE}${endpoint}`, { method: 'DELETE' });
    if (!response.ok) throw new Error(`DELETE ${endpoint} failed`);
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
    },

    // User profiles
    async getUsers() {
        const response = await fetch(`${API_BASE}/api/users`);
        if (!response.ok) throw new Error('Failed to fetch users');
        return response.json();
    },

    async seedUsers() {
        return fetchAPI('/api/users/seed', {});
    },

    async updateUser(userId: string, data: Record<string, any>) {
        const response = await fetch(`${API_BASE}/api/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to update user');
        return response.json();
    },

    // Projects
    async getProjects() { return fetchGET('/api/projects'); },
    async createProject(data: Record<string, any>) { return fetchAPI('/api/projects', data); },
    async updateProject(id: string, data: Record<string, any>) { return fetchPUT(`/api/projects/${id}`, data); },
    async deleteProject(id: string) { return fetchDELETE(`/api/projects/${id}`); },

    // Series
    async getSeriesByProject(projectId: string) { return fetchGET(`/api/projects/${projectId}/series`); },
    async createSeries(data: Record<string, any>) { return fetchAPI('/api/series', data); },
    async updateSeries(id: string, data: Record<string, any>) { return fetchPUT(`/api/series/${id}`, data); },
    async deleteSeries(id: string) { return fetchDELETE(`/api/series/${id}`); },

    // Episodes
    async getEpisodesByProject(projectId: string) { return fetchGET(`/api/projects/${projectId}/episodes`); },
    async createEpisode(data: Record<string, any>) { return fetchAPI('/api/episodes', data); },
    async updateEpisode(id: string, data: Record<string, any>) { return fetchPUT(`/api/episodes/${id}`, data); },
    async deleteEpisode(id: string) { return fetchDELETE(`/api/episodes/${id}`); },

    // Research
    async getResearchByProject(projectId: string) { return fetchGET(`/api/projects/${projectId}/research`); },
    async createResearch(data: Record<string, any>) { return fetchAPI('/api/research', data); },
    async updateResearch(id: string, data: Record<string, any>) { return fetchPUT(`/api/research/${id}`, data); },
    async deleteResearch(id: string) { return fetchDELETE(`/api/research/${id}`); },

    // Assets (archive clips, research sources)
    async getAssetsByProject(projectId: string) { return fetchGET(`/api/projects/${projectId}/assets`); },
    async createAsset(data: Record<string, any>) { return fetchAPI('/api/assets', data); },
    async updateAsset(id: string, data: Record<string, any>) { return fetchPUT(`/api/assets/${id}`, data); },
    async deleteAsset(id: string) { return fetchDELETE(`/api/assets/${id}`); },

    // Scripts
    async getScriptsByProject(projectId: string) { return fetchGET(`/api/projects/${projectId}/scripts`); },
    async createScript(data: Record<string, any>) { return fetchAPI('/api/scripts', data); },
    async updateScript(id: string, data: Record<string, any>) { return fetchPUT(`/api/scripts/${id}`, data); },
    async deleteScript(id: string) { return fetchDELETE(`/api/scripts/${id}`); },

    // Interviews
    async getInterviewsByProject(projectId: string) { return fetchGET(`/api/projects/${projectId}/interviews`); },
    async createInterview(data: Record<string, any>) { return fetchAPI('/api/interviews', data); },
    async updateInterview(id: string, data: Record<string, any>) { return fetchPUT(`/api/interviews/${id}`, data); },
    async deleteInterview(id: string) { return fetchDELETE(`/api/interviews/${id}`); },

    // Shots (timeline items, voice-overs)
    async getShotsByProject(projectId: string) { return fetchGET(`/api/projects/${projectId}/shots`); },
    async createShot(data: Record<string, any>) { return fetchAPI('/api/shots', data); },
    async updateShot(id: string, data: Record<string, any>) { return fetchPUT(`/api/shots/${id}`, data); },
    async deleteShot(id: string) { return fetchDELETE(`/api/shots/${id}`); }
};

// Re-export as geminiService for backwards compatibility with existing components
export const geminiService = apiService;
