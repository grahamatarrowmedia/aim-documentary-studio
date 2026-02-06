#!/usr/bin/env bash
# =============================================================================
# AiM Documentary Studio — One-time GCP Infrastructure Setup
#
# Run this once to provision all required GCP resources:
#   chmod +x scripts/setup-gcp.sh && ./scripts/setup-gcp.sh
#
# Prerequisites:
#   - gcloud CLI installed and authenticated
#   - You have Owner/Editor role on the target GCP project
# =============================================================================
set -euo pipefail

PROJECT_ID="fremantle-ai-studio-prod"
REGION="europe-west1"
REPO_NAME="aim"
SERVICE_NAME="aim-documentary-studio"
GITHUB_OWNER="grahamatarrowmedia"
GITHUB_REPO="aim-documentary-studio"

echo "==> Setting active project to ${PROJECT_ID}"
gcloud config set project "${PROJECT_ID}"

# ---------- 1. Enable required APIs ----------
echo "==> Enabling required APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  aiplatform.googleapis.com \
  secretmanager.googleapis.com

# ---------- 2. Create Artifact Registry Docker repo ----------
echo "==> Creating Artifact Registry repository '${REPO_NAME}' in ${REGION}..."
if gcloud artifacts repositories describe "${REPO_NAME}" \
    --location="${REGION}" --format="value(name)" 2>/dev/null; then
  echo "    Repository already exists, skipping."
else
  gcloud artifacts repositories create "${REPO_NAME}" \
    --repository-format=docker \
    --location="${REGION}" \
    --description="AiM Docker images"
fi

# ---------- 3. Get Cloud Build service account ----------
PROJECT_NUMBER=$(gcloud projects describe "${PROJECT_ID}" --format="value(projectNumber)")
CLOUD_BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
echo "==> Cloud Build service account: ${CLOUD_BUILD_SA}"

# ---------- 4. Grant IAM roles to Cloud Build SA ----------
echo "==> Granting IAM roles to Cloud Build service account..."

# Cloud Run Admin — deploy services
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/run.admin" \
  --condition=None \
  --quiet

# Service Account User — act as the Cloud Run runtime SA
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/iam.serviceAccountUser" \
  --condition=None \
  --quiet

# Artifact Registry Writer — push images
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/artifactregistry.writer" \
  --condition=None \
  --quiet

# Secret Manager Accessor — read build-time secrets
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/secretmanager.secretAccessor" \
  --condition=None \
  --quiet

# ---------- 5. Create Cloud Build GitHub trigger ----------
echo "==> Creating Cloud Build GitHub trigger..."
if gcloud builds triggers describe "${SERVICE_NAME}-main" \
    --region="${REGION}" --format="value(name)" 2>/dev/null; then
  echo "    Trigger already exists, skipping."
else
  gcloud builds triggers create github \
    --name="${SERVICE_NAME}-main" \
    --repo-name="${GITHUB_REPO}" \
    --repo-owner="${GITHUB_OWNER}" \
    --branch-pattern="^main$" \
    --build-config=cloudbuild.yaml \
    --region="${REGION}"
fi

# ---------- 6. Remind about secrets ----------
echo ""
echo "============================================================"
echo " Setup complete!"
echo "============================================================"
echo ""
echo " Next steps:"
echo ""
echo " 1. Create secrets in Secret Manager (if not already done):"
echo ""
echo "    gcloud secrets create VITE_SUPABASE_URL --replication-policy=automatic"
echo "    echo -n 'https://your-project.supabase.co' | gcloud secrets versions add VITE_SUPABASE_URL --data-file=-"
echo ""
echo "    Repeat for: VITE_SUPABASE_ANON_KEY, VITE_FIREBASE_API_KEY,"
echo "    VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID,"
echo "    VITE_ELEVENLABS_API_KEY, GEMINI_API_KEY"
echo ""
echo " 2. Push to main to trigger the first build:"
echo "    git push origin main"
echo ""
echo " 3. Monitor the build:"
echo "    gcloud builds list --region=${REGION} --limit=5"
echo ""
echo " 4. Check the deployed service:"
echo "    gcloud run services describe ${SERVICE_NAME} --region=${REGION} --format='value(status.url)'"
echo ""
