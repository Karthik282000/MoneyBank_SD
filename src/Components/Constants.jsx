// Prefer the build-time env var (set REACT_APP_API_BASE_URL in .env or the host dashboard);
// falls back to the deployed Render URL so existing deploys keep working.
export const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';