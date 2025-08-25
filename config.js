// config.js
// API base comes from run_all.bat writing api_base.json (fallback to localhost for dev)
import api from './api_base.json';
export const API_BASE = api?.API_BASE || 'http://localhost:3000';

// ---- Map tiles (MapTiler) ----
export const USE_MAP_TILES       = true;
export const MAPTILER_STYLE      = 'streets-v2'; // 'streets-v2', 'outdoor-v2', 'satellite', etc.
export const MAPTILER_TILE_SIZE  = 256;          // 256 works everywhere with UrlTile
export const MAPTILER_MAX_Z      = 19;
export const MAPTILER_KEY        = 'JQ0211GgaJpA6x8HhrjH'; // <-- your key
//export const MAPTILER_KEY    = 'mR436qZUD1j69rWiB5Bc'; // <- your 2nd key

// IMPORTANT: keep this EXACT shape (no /tiles, no @2x)
export const MAPTILER_TILE_URL_TEMPLATE =
  'https://api.maptiler.com/maps/{style}/{z}/{x}/{y}.png?key={key}';
