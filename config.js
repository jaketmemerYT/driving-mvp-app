// config.js

// run_all.bat script updates api_base.json which gets assigned here
import api from './api_base.json';
export const API_BASE = api.API_BASE;

// Set ONE of the tile templates below (comment the others).

// MapTiler Streets (raster) — recommended
export const TILE_URL =
  'https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key={key}';
export const TILE_API_KEY = 'mR436qZUD1j69rWiB5Bc';

// If you later use satellite (MapTiler)
//export const TILE_URL =
//  'https://api.maptiler.com/tiles/satellite/{z}/{x}/{y}.jpg?key={key}';

// If you don’t want tiles (use platform default), set TILE_URL to null:
/// export const TILE_URL = null; export const TILE_API_KEY = null;
