# Driving MVP App

A React Native (Expo) MVP for authoring trails, recording runs, and comparing on leaderboards. It uses Google/Apple maps via `react-native-maps` (with optional MapTiler tiles), plus a small snapshot layer for smooth list thumbnails.

## Table of Contents
- [Architecture](#architecture)
- [Core Concepts](#core-concepts)
- [Colors & Deviation](#colors--deviation)
- [Screens](#screens)
- [Data & API](#data--api)
- [Map Rendering](#map-rendering)
- [Performance](#performance)
- [Development](#development)
- [Known Issues / Notes](#known-issues--notes)

---

## Architecture

- **App.js**  
  - If no active user in `UserContext`, shows **AuthNavigator** (UserList, AddUser).
  - Otherwise shows **MainTabs** (Home, Trails, Runs, Groups, Categories, Profile).

- **UserContext**  
  - Stores the active user profile and preferences, e.g. route colors & thresholds.

- **Stacks inside tabs**  
  - **Trails**: TrailList → TrailDetail → AddTrail → Tracker
  - **Runs**: RunList → RunDetail → AddRun → Tracker
  - **Groups**: GroupList → AddGroup
  - **Categories**: CategoryList → AddCategory
  - **Profile**: ProfileHome → Contact, VehicleList → AddVehicle, Preferences, UserList, AddUser

---

## Core Concepts

- **Trail (official route)**  
  Authored once via **AddTrail** (or future editor). Stored as `coords` (start), optional `endCoords`, and `route` polyline. Rendered in *Official Route Color*.

- **Run (user attempt)**  
  Recorded via **Tracker** launched from **AddRun**. Run’s live polyline is colored based on deviation from the official route:
  - within threshold → *Live Route Color*
  - beyond warn threshold → *Warning Color 1*
  - beyond critical threshold → *Warning Color 2*

- **Preferences** (per active user)  
  - `liveRouteColor`, `officialRouteColor`, `warningColor1`, `warningColor2`
  - `warningThreshold1` (ft), `warningThreshold2` (ft)

---

## Colors & Deviation

- Centralized in `useRouteColors()`:
  - Provides colors + thresholds.
  - Exposes **granular signatures** for caching:
    - `signatureOfficial` (only official color)
    - `signatureRunThumb` (live/warn/critical colors and thresholds)
- **Tracker** uses `useRouteColors()` for real-time deviation styling and (optionally) haptics on threshold crossings.
- **Thumbnails** regenerate when the relevant color signatures change:
  - TrailList depends on `signatureOfficial` only.
  - RunList depends on `signatureRunThumb`.

---

## Screens

### Auth
- **UserList**: Select active profile. Shows all profiles, marks “Active”, supports **Edit**, **Delete**, and a **New** button.
- **AddUser**: Create or edit a profile. On create, new profile becomes active.

### Home
- Leaderboard marquee for most popular trail, cycling through top runs.  
- Shows current **ActiveUserPill** and allows quick switching.

### Trails
- **TrailList**:  
  - Scrollable cards with category chips and a **thumbnail map** (snapshot to avoid flicker).
  - Tapping a card → **TrailDetail**.
  - Thumbnail re-snapshots when `signatureOfficial` changes.
- **TrailDetail**:  
  - Read-only map; fits to official polyline + markers.
  - Start Run (navigates to Tracker via AddRun flow if required).
- **AddTrail**:  
  - Records an official route (no deviation logic here).
  - Drawn using **Official Route Color** for visual consistency.

### Runs
- **RunList**:  
  - Filter by groups/categories.
  - **Thumbnail map** shows official route + run colored by deviation.
  - Re-snapshots when `signatureRunThumb` changes.
- **RunDetail**:  
  - Read-only map of the run vs. official route; honors Preferences colors.
- **AddRun**:  
  - Choose trail, group, vehicle, categories → launches **Tracker**.

### Tracker
- Live recorder:
  - Centers camera on you, shows official polyline (official color),
  - Draws your live route with deviation-aware colors.
  - Optional **haptics** on crossing thresholds.
  - On stop, uploads and navigates to **RunDetail**.

### Groups / Categories
- Simple CRUD lists with add screens, used for filtering and labeling.

### Profile
- **ProfileHome**: Entry to Contact, My Vehicles, Preferences, Switch Profile.
- **VehicleList**: Now has a **New** button; scoped to active user.
- **AddVehicle**: Add vehicle for the active user.
- **Preferences**: Color + threshold pickers; saves to user prefs. Triggers thumbnail cache invalidation via signatures.
- **UserList / AddUser**: As above.

---

## Data & API

Assumed REST endpoints (adjust to your backend):

- Users:  
  `GET /api/users`, `GET /api/users/:id`, `POST /api/users`, `PUT /api/users/:id`, `DELETE /api/users/:id`

- Vehicles:  
  `GET /api/vehicles?userId=...`, `POST /api/vehicles`, `PUT /api/vehicles/:id`, `DELETE /api/vehicles/:id`

- Trails:  
  `GET /api/trailheads`, `GET /api/trailheads/:id`, `POST /api/trailheads`  
  `GET /api/trailheads/:id/categories`

- Runs (routes):  
  `GET /api/routes`, `GET /api/routes?userId=...`, `POST /api/routes`

- Leaderboard:  
  `GET /api/leaderboard/:trailId` → top runs for a trail

---

## Map Rendering

- **MapBase**: shared `MapView` wrapper with optional **MapTiler UrlTile** overlay. If tiles fail, MapBase falls back to default provider (never blanks the map).
- **MapThumbSnapshot**: miniature `MapView` that:
  - fits to provided route coords,
  - waits a tick for tiles/overlays,
  - captures a snapshot via `takeSnapshot` for buttery scrolling,
  - caches images by `cacheKey` (uses color/threshold **signatures** to know when to refresh),
  - keeps a live map behind the image until the snapshot is ready (so no blank flashes).

---

## Performance

- **List thumbnails**: snapshot + small memory cache per key (no flicker).
- **Downsampled polylines**: limit to ~200–300 points in list views.
- **Android** quirks: `removeClippedSubviews=false` for FlatList to avoid premature unmounts of map views on some OEM builds.

---

## Development

- Expo managed: `npx expo install` for deps (including `expo-haptics`).
- Maps: configure Google Maps / Apple Maps as usual; **optional** MapTiler key in `config.js` to enable UrlTile overlay.
- Preferences are stored in `UserContext`’s user object; saving them triggers re-renders and thumbnail refresh via signatures.

---

## Known Issues / Notes

- **Hook rules**: Never call hooks inside `renderItem` callbacks; use memoized row components instead (we do this now).
- **Thumbnail refresh**: If the **underlying geometry changes** (e.g., trail officially edited), you may want to add a `routeHash` to the cache key (e.g., `trail:${id}:${signatureOfficial}:${routeHash}`) to force fresh snapshots.
- **Deletion safety**: We block deleting the active profile; switch first.
