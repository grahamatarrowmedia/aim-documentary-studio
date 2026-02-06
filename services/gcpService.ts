
import { GCSBucket, VertexModelStatus, CloudStats } from '../types';

/**
 * Service to interact with Google Cloud Platform resources.
 * Calls backend API which wraps the @google-cloud SDKs.
 */

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `API call failed: ${response.status}`);
  }

  return response.json();
}

export const gcpService = {

  /**
   * Fetches the current status of GCS Buckets.
   */
  async listBuckets(): Promise<GCSBucket[]> {
    try {
      return await apiCall<GCSBucket[]>('/gcs/buckets');
    } catch (error) {
      console.error('Failed to list GCS buckets:', error);
      // Return fallback data if API not yet implemented
      return [
        { name: 'aim-archive-master', region: 'us-central1', storageClass: 'Standard', fileCount: 450, sizeGb: 1200 },
        { name: 'aim-dailies-raw', region: 'europe-west1', storageClass: 'Nearline', fileCount: 120, sizeGb: 450 },
        { name: 'aim-ai-outputs', region: 'us-central1', storageClass: 'Standard', fileCount: 30, sizeGb: 5 },
      ];
    }
  },

  /**
   * Fetches the current status of Vertex AI Models.
   */
  async listModels(): Promise<VertexModelStatus[]> {
    try {
      return await apiCall<VertexModelStatus[]>('/vertex/models');
    } catch (error) {
      console.error('Failed to list Vertex AI models:', error);
      // Return fallback data if API not yet implemented
      return [
        { id: 'v-1', name: 'Gemini 2.0 Pro', version: 'v2.0', status: 'active', latencyMs: 140, callsPerMin: 12 },
        { id: 'v-2', name: 'Gemini 2.0 Flash', version: 'v2.0', status: 'active', latencyMs: 80, callsPerMin: 30 },
        { id: 'v-3', name: 'Vertex AI Enterprise', version: 'v1.0', status: 'active', latencyMs: 200, callsPerMin: 10 },
        { id: 'v-4', name: 'AiM Compliance Bot', version: 'v1.2', status: 'active', latencyMs: 95, callsPerMin: 8 },
      ];
    }
  },

  /**
   * Triggers a model deployment/rollout on Vertex AI.
   */
  async deployModelVersion(modelId: string, currentVersion: string): Promise<string> {
    try {
      const result = await apiCall<{ newVersion: string }>('/vertex/deploy', {
        method: 'POST',
        body: JSON.stringify({ modelId, currentVersion })
      });
      return result.newVersion;
    } catch (error) {
      console.error('Failed to deploy model version:', error);
      // Fallback version increment logic
      const verParts = currentVersion.replace('v', '').split('.');
      return `v${verParts[0]}.${parseInt(verParts[1]) + 1}`;
    }
  },

  /**
   * Purges the CDN cache for the frontend application.
   */
  async purgeCache(): Promise<boolean> {
    try {
      const result = await apiCall<{ success: boolean }>('/gcs/purge-cache', {
        method: 'POST'
      });
      return result.success;
    } catch (error) {
      console.error('Failed to purge cache:', error);
      return false;
    }
  },

  /**
   * Fetches live infrastructure stats (Firestore counts, GCS summary).
   */
  async getStats(): Promise<CloudStats | null> {
    try {
      return await apiCall<CloudStats>('/cloud/stats');
    } catch (error) {
      console.error('Failed to fetch cloud stats:', error);
      return null;
    }
  }
};
