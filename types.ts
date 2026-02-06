
export type ProjectPhase = 'planning' | 'research' | 'archive' | 'scripting' | 'expert_interview' | 'voice_over' | 'assembly' | 'review' | 'settings' | 'cloud_management';

export type UserRole = 'producer' | 'editor' | 'researcher' | 'legal' | 'archivist';

export interface UserProfile {
  id: string;
  username: string;
  role: UserRole;
  avatar: string;
  bio: string;
  customInstructions: string;
  gcpProjectId?: string;
  vertexModelId?: string;
  elevenLabsApiKey?: string; 
}

export interface DocumentaryProject {
  id: string;
  title: string;
  description: string;
  series_name?: string;
  episode_number?: number;
  target_duration_minutes: number;
  target_format: 'documentary' | 'explainer' | 'short_form' | 'educational';
  current_phase: ProjectPhase;
  progress: number;
  status: 'active' | 'completed' | 'on_hold';
  created_at: string;
  template_id?: string;
  
  // Collaboration Fields
  locked_by?: string; // User ID of the person currently editing
  locked_by_avatar?: string;
  viewers?: string[]; // IDs of people watching
}

export interface ResearchSeries {
  id: string;
  title: string;
  icon: string;
}

export interface ResearchEpisode {
  id: string;
  series_id: string;
  episode_number: number;
  title: string;
  status: 'planning' | 'researching' | 'locked';
  focus?: string;
}

export interface ManualSource {
  id: string;
  title: string;
  url: string;
  added_at: string;
}

export interface DocumentaryNotebook {
  id: string;
  project_id: string;
  series_id: string;
  episode_id: string; 
  title: string;
  topic: string;
  status: 'pending' | 'researching' | 'complete' | 'failed';
  research_engine: 'gemini_pro' | 'vertex_ai' | 'perplexity' | 'google_deep_research';
  source_count: number;
  summary?: string;
  key_topics?: string[];
  grounding_urls?: string[];
  manual_sources?: ManualSource[];
  linked_clip_ids?: string[];
  user_notes?: string;
  last_updated?: string;
}

export interface KnowledgeAsset {
  id: string;
  project_id: string;
  series_id: string;
  episode_id: string;
  name: string;
  type: 'pdf' | 'docx' | 'txt' | 'csv';
  size: string;
  upload_date: string;
  status: 'uploading' | 'vectorizing' | 'indexing' | 'ready'; 
  vector_id?: string; 
  analysis_summary?: string;
}

export interface ArchiveFolder {
  id: string;
  name: string;
  type: 'local' | 'external_api' | 'cloud_bucket';
  api_source?: 'nasa' | 'getty' | 'ap' | 'archive_org';
  icon?: string;
}

export interface ArchiveClip {
  id: string;
  project_id: string;
  folder_id?: string;
  title: string;
  description?: string;
  archive_source?: string;
  thumbnail_url?: string;
  preview_url?: string;
  duration_seconds: number;
  in_point: number;
  out_point?: number;
  category?: 'Historical' | 'Interview' | 'B-Roll' | 'Recreation' | 'Infographic' | 'Establishing' | 'AI-Generated';
  visual_description?: string;
  transcript?: string;
  quality_score?: number;
  mood?: string;
  is_generating?: boolean;
  linked_beat_id?: string;
}

export interface ScriptBeat {
  id: string;
  type: 'voice_over' | 'expert' | 'archive' | 'ai_visual' | 'title';
  content?: string;
  speaker?: string;
  placeholder?: boolean;
  topic?: string;
  duration_seconds: number;
  archive_clip_ids?: string[];
  ai_gap_id?: string;
  visual_url?: string;
  is_generating_visual?: boolean;
}

export interface ScriptScene {
  id: string;
  scene_number: number;
  title: string;
  beats: ScriptBeat[];
}

export interface ScriptPart {
  id: string;
  part_number: number;
  title: string;
  scenes: ScriptScene[];
}

export interface DocumentaryScript {
  id: string;
  project_id: string;
  version: number;
  is_current: boolean;
  status: 'draft' | 'review' | 'approved' | 'archived';
  parts: ScriptPart[];
  estimated_duration_minutes: number;
}

export interface ExpertCandidate {
  id: string;
  name: string;
  title: string;
  relevance: string;
  source_url?: string;
  affiliation?: string;
  relevance_score?: number;
}

export interface AvatarEnvironment {
  id: string;
  name: string;
  category: 'NASA' | 'Superstructures' | 'Abandoned' | 'Studio';
  description: string;
  thumbnailUrl: string;
}

export interface DigitalTwin {
  id: string;
  name: string;
  thumbnailUrl: string;
  voice_match_score?: number;
}

export interface InterviewPlan {
  id: string;
  beat_id: string;
  scene_context: string;
  topic: string;
  ideal_soundbite: string; 
  questions: string[];
  candidates: ExpertCandidate[];
  status: 'planning' | 'ready' | 'booked';
  production_status?: 'pending_audio' | 'audio_uploaded' | 'environment_selected' | 'processing_avatar' | 'completed';
  audio_filename?: string;
  audio_duration?: number;
  selected_environment?: AvatarEnvironment;
  selected_avatar?: DigitalTwin;
  generated_video_url?: string;
  environment_rationale?: string;
}

export interface ElevenLabsSettings {
  stability: number;       
  similarity_boost: number; 
  style: number;           
  use_speaker_boost: boolean;
}

export interface VoiceOver {
  id: string;
  project_id: string;
  beat_id: string;
  voice_id: string;
  voice_name: string;
  voice_provider: 'elevenlabs' | 'local'; 
  text: string;
  audio_url?: string;
  duration_seconds: number;
  status: 'pending' | 'generating' | 'complete' | 'failed' | 'approved' | 'rejected';
  generation_settings?: ElevenLabsSettings; 
}

export interface TimelineItem {
  id: string;
  project_id: string;
  track_type: 'video' | 'audio' | 'music' | 'sfx' | 'expert' | 'graphics';
  track_index: number;
  start_time: number;
  end_time: number;
  duration: number;
  source_type: 'archive_clip' | 'voice_over' | 'expert_interview' | 'ai_generated' | 'music' | 'sfx' | 'title';
  source_id?: string;
  label?: string;
  color?: string;
}

export interface ReferenceDocument {
  id: string;
  name: string;
  type: 'pdf' | 'docx' | 'txt';
  size: string;
  uploadDate: string;
  analysis_status?: 'analyzing' | 'complete' | 'error';
  style_tags?: string[];
}

export interface GCSBucket {
  name: string;
  region: string;
  storageClass: string;
  fileCount: number;
  sizeGb: number;
}

export interface VertexModelStatus {
  id: string;
  name: string;
  version: string;
  status: 'active' | 'deploying' | 'error';
  latencyMs: number;
  callsPerMin: number;
  url?: string;
}

export interface CloudStats {
  firestore: Record<string, number>;
  totalDocuments: number;
  gcsBucketCount: number;
  primaryBucketSizeGb: number;
  primaryBucketFiles: number;
  region: string;
  project: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface VoiceTalent {
  id: string;
  name: string;
  category: string;
  provider: 'elevenlabs' | 'local';
  preview_url?: string;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  format: 'documentary' | 'explainer' | 'short_form' | 'educational';
}

export interface ResearchFolder {
  id: string;
  name: string;
  type: 'series_level' | 'episode_level';
  icon?: string;
}

export interface ResearchNode {
  id: string;
  type: 'mcp' | 'notebook';
  label: string;
  subLabel?: string;
  status: 'idle' | 'generating' | 'active' | 'complete';
  x: number;
  y: number;
  engine?: string;
}

// ---- Planning Phase Types ----

export interface PlanningSeries {
  id: string;
  title: string;
  logline?: string;
  icon?: string;
  episode_count?: number;
}

export interface EpisodePlan {
  id: string;
  series_id: string;
  episode_number: number;
  title: string;
  focus?: string;
  synopsis?: string;
  status?: 'planning' | 'researching' | 'locked';
}

export interface PlanningBrief {
  id: string;
  content: string;
  generated_at: string;
}

export interface PlanningReference {
  id: string;
  name: string;
  type: 'pdf' | 'docx' | 'txt';
  size: string;
  upload_date: string;
}
