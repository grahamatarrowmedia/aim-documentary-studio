import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { VertexAI, HarmCategory, HarmBlockThreshold } from '@google-cloud/vertexai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// CORS - allow localhost in dev, same origin in production
app.use(cors({
    origin: isProduction ? false : ['http://localhost:3000', 'http://localhost:5173']
}));
app.use(express.json());

// ========== Vertex AI Configuration ==========
// Support both GCP_PROJECT_ID (local) and GCP_PROJECT (Cloud Run)
const PROJECT_ID = process.env.GCP_PROJECT_ID || process.env.GCP_PROJECT || 'gbr-aim-aiengine-prod';
const LOCATION = process.env.GCP_LOCATION || 'us-central1';

// Initialize Vertex AI
// Authentication: Uses Application Default Credentials (ADC)
// Set GOOGLE_APPLICATION_CREDENTIALS env var to your service account JSON path
const getVertexAI = () => {
    if (!PROJECT_ID) {
        throw new Error('GCP_PROJECT_ID is not configured. Set it in your .env file.');
    }
    return new VertexAI({ project: PROJECT_ID, location: LOCATION });
};

// Get generative model with safety settings
const getModel = (modelName: string = 'gemini-2.0-flash') => {
    const vertexAI = getVertexAI();
    return vertexAI.getGenerativeModel({
        model: modelName,
        safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        ],
    });
};

// ========== AI Proxy Routes ==========

app.post('/api/research', async (req, res) => {
    try {
        const { topic, engine, systemInstruction } = req.body;

        // Select model based on engine complexity
        let modelName = 'gemini-2.0-flash';
        if (engine === 'google_deep_research' || engine === 'vertex_ai') {
            modelName = 'gemini-2.0-pro';
        }

        const model = getModel(modelName);

        let prompt = `Perform a deep research analysis on: "${topic}". 
      Return JSON with: summary (string), key_facts (array), expert_suggestions (array).
      Focus on factual accuracy and provide a consolidated brief suitable for documentary production.`;

        if (engine === 'vertex_ai') {
            prompt = `[VERTEX_AI_ENTERPRISE_MODE] Using internal knowledge base context, analyze: "${topic}".
        Prioritize compliance with brand guidelines and internal production standards.
        Return JSON with: summary, key_facts, expert_suggestions.`;
        } else if (engine === 'google_deep_research') {
            prompt = `[DEEP_RESEARCH_MODE] Perform multi-step reasoning to find obscure academic and primary sources on: "${topic}".
        Cross-reference all claims. Return JSON with: summary, key_facts, expert_suggestions.`;
        }

        if (systemInstruction) {
            prompt = `${systemInstruction}\n\n${prompt}`;
        }

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.7,
            },
        });

        const response = result.response;
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

        res.json(JSON.parse(text.trim()));
    } catch (error: any) {
        console.error('Research API Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/series-structure', async (req, res) => {
    try {
        const { premise, episodesCount = 3 } = req.body;
        const model = getModel('gemini-2.0-pro');

        const prompt = `You are a Series Producer. Based on the premise: "${premise}", create a research structure for a ${episodesCount}-part documentary series.
      Return JSON with:
      - episodes: Array of { title, research_focus, suggested_engine }
      - themes: Array of { title, research_focus, suggested_engine }
      suggested_engine should be: 'vertex_ai', 'google_deep_research', 'perplexity', or 'gemini_pro'.`;

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
        });

        const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        res.json(JSON.parse(text.trim()));
    } catch (error: any) {
        console.error('Series Structure API Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/search-archive', async (req, res) => {
    try {
        const { query, source } = req.body;
        const model = getModel('gemini-2.0-flash');

        const prompt = `You are an archive search specialist. Search the "${source}" archive for documentary footage related to: "${query}".

        Based on your knowledge of what would be available in ${source}'s archive, provide realistic archive footage results that would be valuable for documentary production.

        Return JSON array of archive clips with:
        - title: string (descriptive title of the footage)
        - duration_seconds: number (realistic duration 30-300 seconds)
        - visual_description: string (detailed description of what the footage shows)
        - archive_source: string (specific collection or sub-archive)
        - category: string (news/documentary/raw_footage/interview/b-roll)
        - year_range: string (estimated era of footage)
        - quality: string (HD/SD/4K/Film)

        Provide 5-8 relevant results.`;

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
        });

        const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
        res.json(JSON.parse(text.trim()));
    } catch (error: any) {
        console.error('Archive Search API Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/analyze-clip', async (req, res) => {
    try {
        const { clipTitle } = req.body;
        const model = getModel('gemini-2.0-flash');

        const prompt = `Provide visual analysis for: "${clipTitle}".
      Return JSON: { visual_description, mood, quality_score (0-100) }`;

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
        });

        const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        res.json(JSON.parse(text.trim()));
    } catch (error: any) {
        console.error('Clip Analysis API Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generate-script', async (req, res) => {
    try {
        const { title, description, duration, referenceStyle, researchContext, archiveContext } = req.body;
        const model = getModel('gemini-2.0-pro');

        const prompt = `ACT AS: Lead Scriptwriter Agent for Vertex AI Studio.
      Project: "${title}" - ${description}
      Duration: ${duration} minutes
      Style: ${referenceStyle || 'Standard Documentary'}
      Research: ${(researchContext || []).join('; ')}
      Archives: ${(archiveContext || []).join('; ')}
      
      Generate script structure with Parts > Scenes > Beats as JSON array.`;

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
        });

        const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
        res.json(JSON.parse(text.trim()));
    } catch (error: any) {
        console.error('Script Generation API Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/find-experts', async (req, res) => {
    try {
        const { topic } = req.body;
        const model = getModel('gemini-2.0-pro');

        const prompt = `Find 3 real-world experts on: "${topic}".
      Return JSON array: { name, title, relevance, affiliation, relevance_score (0.0-1.0) }`;

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
        });

        const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
        res.json(JSON.parse(text.trim()));
    } catch (error: any) {
        console.error('Expert Search API Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/refine-beat', async (req, res) => {
    try {
        const { currentContent, instruction, context } = req.body;
        const model = getModel('gemini-2.0-flash');

        const prompt = `You are a script doctor. Rewrite this beat: "${currentContent}"
      Instruction: "${instruction}"
      ${context ? `Context: ${context}` : ''}
      Return ONLY the rewritten text, no markdown or explanations.`;

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });

        const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || currentContent;
        res.json({ refined: text.trim() });
    } catch (error: any) {
        console.error('Refine Beat API Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/interview-plan', async (req, res) => {
    try {
        const { sceneContext, topic } = req.body;
        const model = getModel('gemini-2.0-flash');

        const prompt = `CONTEXT: Documentary scene about "${sceneContext}".
      TOPIC: ${topic}
      
      Return JSON: { ideal_soundbite (15-20 sec quote), questions (3 interview questions) }`;

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
        });

        const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        res.json(JSON.parse(text.trim()));
    } catch (error: any) {
        console.error('Interview Plan API Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== Source Indexing & Analysis (NotebookLM-style) ==========

// Index a source: URL, text, or YouTube - uses Vertex AI to analyze content
app.post('/api/index-source', async (req, res) => {
    try {
        const { type, url, content, title } = req.body;
        const model = getModel('gemini-2.0-flash');

        let sourceContent = content || '';
        let extractedTitle = title || '';

        // For URLs, fetch and analyze the content
        if ((type === 'url' || type === 'youtube') && url) {
            // Use Vertex AI to analyze the URL content
            const analysisPrompt = type === 'youtube'
                ? `Analyze this YouTube video URL: "${url}"
                   Provide a comprehensive summary of what this video likely contains based on the URL structure.
                   Return JSON with:
                   - title: string (inferred title)
                   - summary: string (200-300 words)
                   - key_topics: array of strings (5-8 topics)
                   - key_facts: array of strings (5-8 facts)
                   - suggested_questions: array of 3 research questions this source could answer`
                : `Analyze this web URL: "${url}"
                   Provide a comprehensive analysis of what this page likely contains.
                   Return JSON with:
                   - title: string (inferred title)
                   - summary: string (200-300 words)
                   - key_topics: array of strings (5-8 topics)
                   - key_facts: array of strings (5-8 facts)
                   - content_type: string (article/research/news/government/etc)
                   - suggested_questions: array of 3 research questions this source could answer`;

            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: analysisPrompt }] }],
                generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
            });

            const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
            const analysis = JSON.parse(text.trim());

            res.json({
                status: 'indexed',
                title: analysis.title || extractedTitle || url,
                summary: analysis.summary,
                key_topics: analysis.key_topics || [],
                key_facts: analysis.key_facts || [],
                content_type: analysis.content_type || type,
                suggested_questions: analysis.suggested_questions || []
            });
        }
        // For text content, analyze directly
        else if (type === 'text' && (content || sourceContent)) {
            const analysisPrompt = `Analyze this research document/text:

            "${(content || sourceContent).substring(0, 15000)}"

            Return JSON with:
            - title: string (infer a title if not obvious)
            - summary: string (200-300 words comprehensive summary)
            - key_topics: array of strings (5-8 main topics)
            - key_facts: array of strings (5-8 key facts)
            - content_type: string (research/transcript/notes/article/etc)
            - suggested_questions: array of 3 research questions this text could answer`;

            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: analysisPrompt }] }],
                generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
            });

            const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
            const analysis = JSON.parse(text.trim());

            res.json({
                status: 'indexed',
                title: analysis.title || extractedTitle || 'Text Document',
                summary: analysis.summary,
                key_topics: analysis.key_topics || [],
                key_facts: analysis.key_facts || [],
                content_type: analysis.content_type || 'text',
                suggested_questions: analysis.suggested_questions || []
            });
        }
        else {
            res.status(400).json({ error: 'Invalid source type or missing content' });
        }
    } catch (error: any) {
        console.error('Index Source API Error:', error);
        res.status(500).json({ error: error.message, status: 'error' });
    }
});

// Analyze uploaded document content (for files uploaded as base64 or text)
app.post('/api/analyze-document', async (req, res) => {
    try {
        const { content, fileName, fileType } = req.body;
        const model = getModel('gemini-2.0-pro');

        const analysisPrompt = `You are a research analyst. Analyze this document for documentary research:

        Document: "${fileName}" (${fileType})
        Content:
        "${content.substring(0, 20000)}"

        Provide a thorough analysis as JSON:
        - title: string (document title)
        - summary: string (300-500 words detailed summary)
        - key_topics: array of strings (all major topics covered)
        - key_facts: array of strings (all important facts, dates, names, events)
        - key_quotes: array of strings (notable quotes if any)
        - people_mentioned: array of { name, role, relevance }
        - timeline_events: array of { date, event } if chronological info exists
        - content_type: string (report/transcript/correspondence/research/etc)
        - reliability_assessment: string (assessment of source reliability)
        - suggested_questions: array of 5 research questions this document could answer
        - cross_reference_suggestions: array of 3 related topics to research`;

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: analysisPrompt }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
        });

        const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        res.json({
            status: 'indexed',
            ...JSON.parse(text.trim())
        });
    } catch (error: any) {
        console.error('Analyze Document API Error:', error);
        res.status(500).json({ error: error.message, status: 'error' });
    }
});

// Query across multiple sources (NotebookLM-style research)
app.post('/api/query-sources', async (req, res) => {
    try {
        const { query, sources, engine = 'google_deep_research' } = req.body;

        // Select model based on engine
        let modelName = 'gemini-2.0-flash';
        if (engine === 'google_deep_research' || engine === 'vertex_ai') {
            modelName = 'gemini-2.0-pro';
        }

        const model = getModel(modelName);

        // Build context from provided sources
        const sourceContext = sources.map((s: any, i: number) =>
            `[Source ${i + 1}: ${s.title}]\n${s.summary || ''}\nKey Facts: ${(s.key_facts || []).join('; ')}`
        ).join('\n\n---\n\n');

        const researchPrompt = engine === 'google_deep_research'
            ? `[DEEP RESEARCH MODE] You are a senior documentary researcher with access to the following indexed sources:

${sourceContext}

Research Question: "${query}"

Conduct a thorough multi-step analysis:
1. Cross-reference information across all sources
2. Identify corroborating evidence and contradictions
3. Note any gaps in the available information
4. Synthesize findings into a comprehensive response

Return JSON with:
- response: string (detailed 300-500 word answer synthesizing all sources)
- key_facts: array of strings (8-12 specific facts that answer the question)
- source_citations: array of { source_title, relevant_info } for each source used
- confidence_level: string (high/medium/low based on source quality)
- follow_up_questions: array of 3 questions for deeper research
- contradictions: array of any conflicting information found
- gaps: array of information gaps that need more sources`
            : `You are a documentary researcher. Based on these sources:

${sourceContext}

Question: "${query}"

Return JSON with:
- response: string (comprehensive answer)
- key_facts: array of strings (key facts)
- source_citations: array of { source_title, relevant_info }
- follow_up_questions: array of 2-3 questions`;

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: researchPrompt }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
        });

        const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        res.json(JSON.parse(text.trim()));
    } catch (error: any) {
        console.error('Query Sources API Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Chat endpoint for assistant
app.post('/api/chat', async (req, res) => {
    try {
        const { message, systemInstruction, history = [] } = req.body;
        const model = getModel('gemini-2.0-flash');

        // Build conversation contents
        const contents = history.map((msg: any) => ({
            role: msg.role === 'model' ? 'model' : 'user',
            parts: msg.parts
        }));
        contents.push({ role: 'user', parts: [{ text: message }] });

        const result = await model.generateContent({
            contents,
            systemInstruction: systemInstruction ? { role: 'user' as const, parts: [{ text: systemInstruction }] } : undefined,
        });

        const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
        res.json({ response: text });
    } catch (error: any) {
        console.error('Chat API Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Health check with Vertex AI status
app.get('/api/health', async (req, res) => {
    try {
        getVertexAI(); // Test that we can initialize
        res.json({
            status: 'ok',
            platform: 'Vertex AI',
            project: PROJECT_ID,
            location: LOCATION,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        res.json({
            status: 'error',
            platform: 'Vertex AI',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// In production, serve the built Vite frontend
if (isProduction) {
    const distPath = path.join(__dirname, '../dist');
    app.use(express.static(distPath));

    // SPA fallback - Express 5 syntax
    app.get('/{*splat}', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

app.listen(PORT, () => {
    console.log(`🎬 AiM Documentary Studio API running on port ${PORT}`);
    console.log(`   Mode: ${isProduction ? 'Production' : 'Development'}`);
    console.log(`   Platform: Vertex AI`);
    console.log(`   Project: ${PROJECT_ID}`);
    console.log(`   Location: ${LOCATION}`);
});
