# HackElite AI — Intelligent Technical Opportunity Discovery, Recommendation & Analytics Platform

[![Course](https://img.shields.io/badge/Course-24CIE554%20Full%20Stack%20Development-4f46e5?style=for-the-badge)](.)
[![Stack](https://img.shields.io/badge/Stack-MERN%20%2B%20Three.js%20WebGL-06b6d4?style=for-the-badge)](.)
[![Auth](https://img.shields.io/badge/Auth-JWT%20%2B%20RBAC-10b981?style=for-the-badge)](.)
[![UI](https://img.shields.io/badge/UI-Glassmorphism%20%2B%20Dark%2FLight%20Mode-a855f7?style=for-the-badge)](.)
[![3D](https://img.shields.io/badge/3D%20Engine-Three.js%20r0.186%20WebGL2-f59e0b?style=for-the-badge)](.)

---

## 1. Project Overview & Abstract

### 1.1 Abstract

University students face severe friction when seeking career-defining technical opportunities — such as global hackathons, high-stipend corporate internships, algorithmic coding competitions, and academic research grants. These opportunities are currently scattered across disparate Discord servers, transient WhatsApp groups, closed Telegram channels, and unstructured job boards. This fragmentation leads to missed application deadlines, zero status visibility, and disorganized team formation.

**HackElite AI** is an intelligent, full-stack web application engineered on the **MERN stack** (MongoDB · Express.js · React 19 · Node.js) for course **24CIE554 — Full Stack Development**. The platform centralises, curates, and monitors technical opportunities through seven tightly integrated modules:

| # | Module | Key Capability |
|---|--------|----------------|
| 1 | **Opportunity Discovery & Filter** | Multi-attribute search by domain, location, company, deadline |
| 2 | **AI Assistant & Recommender** | Contextual Gemini-powered chat grounded in live MongoDB data |
| 3 | **Team Formation** | Recruiter board with project deck file upload |
| 4 | **Application Tracker** | 4-stage Kanban pipeline with feedback visibility |
| 5 | **Analytics Dashboard** | Real-time KPIs, domain distribution, deadline heatmaps |
| 6 | **Admin Console** | Full CRUD authority, applicant dossier review, status control |
| 7 | **Audit Telemetry** | Request/response logging middleware exposed via REST endpoint |

A dedicated **Three.js WebGL 2.0 Neural Constellation Engine** renders a hyper-interactive 3D particle network as the application backdrop — demonstrating advanced browser-side graphics programming integrated cleanly into the MERN architecture.

---

### 1.2 Academic & Team Details

| Field | Value |
|-------|-------|
| **Course Code** | `24CIE554` |
| **Course Title** | Full Stack Development |
| **Degree / Semester** | B.Tech. Computer Science & Engineering |
| **Project Title** | *HackElite AI: An Intelligent Technical Opportunity Discovery, Recommendation and Analytics Platform* |
| **Lead Engineer** | Student Developer — Roll No. 24CIE554-FSD-01 |
| **UI/UX Collaborator** | Student Developer — Roll No. 24CIE554-FSD-02 |
| **Faculty Evaluator** | Department of Computer Science & Engineering |

---

## 2. System Architecture & Data Flow

### 2.1 High-Level Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          CLIENT TIER  (Browser)                              │
│                                                                              │
│  ┌────────────────────┐          ┌──────────────────────────────────────┐   │
│  │  Student User      │          │  Administrator / Faculty              │   │
│  │  Discovery · Teams │          │  CRUD · Dossier Review · Analytics   │   │
│  │  Tracker · AI Chat │          │  Audit Logs · Status Control         │   │
│  └────────┬───────────┘          └──────────────┬───────────────────────┘   │
│           │                                     │                           │
│  ┌────────▼─────────────────────────────────────▼───────────────────────┐   │
│  │              React 19 + Vite SPA  (frontend/src/)                    │   │
│  │                                                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │  Three.js WebGL 2.0 Neural Constellation Engine (fixed layer)   │ │   │
│  │  │  • 4 200-node particle BufferGeometry  +  custom ShaderMaterial  │ │   │
│  │  │  • Mouse-physics · Click shockwaves · Scroll parallax           │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                       │   │
│  │  ThemeContext (dark/light) · AuthContext (JWT) · ToastContext        │   │
│  │  Navbar · LandingPage · DiscoveryView · AnalyticsView               │   │
│  │  ApplicationTrackerView · TeamFormationView · AdminDashboardView     │   │
│  └───────────────────────────────┬───────────────────────────────────────┘   │
│                                  │  Axios HTTP · REST/JSON                   │
└──────────────────────────────────┼──────────────────────────────────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │   API SERVER TIER (Node.js)  │
                    │                              │
                    │  Express.js v5 REST API      │
                    │  PORT 5001                   │
                    │                              │
                    │  ┌──────────────────────┐   │
                    │  │ Middleware Stack      │   │
                    │  │  cors · helmet        │   │
                    │  │  express-json         │   │
                    │  │  loggerMiddleware ──► │───┼──► logs/server_audit.log
                    │  └──────────┬───────────┘   │
                    │             │                │
                    │  ┌──────────▼───────────┐   │
                    │  │  Route Handlers       │   │
                    │  │  /api/auth            │   │
                    │  │  /api/opportunities   │   │
                    │  │  /api/applications    │   │
                    │  │  /api/teams           │   │
                    │  │  /api/analytics       │   │
                    │  │  /api/ai              │   │
                    │  │  /api/logs            │   │
                    │  └──────────┬───────────┘   │
                    │             │                │
                    │  ┌──────────▼───────────┐   │
                    │  │  JWT Auth Guard       │   │
                    │  │  Role: student/admin  │   │
                    │  └──────────┬───────────┘   │
                    └─────────────┼───────────────┘
                                  │  Mongoose ODM
                    ┌─────────────▼───────────────┐
                    │   DATA TIER  (MongoDB)        │
                    │                              │
                    │  Database: hackelite_db      │
                    │                              │
                    │  Collections                 │
                    │  ├── users                   │
                    │  ├── opportunities           │
                    │  ├── applications            │
                    │  └── teams                   │
                    └─────────────┬───────────────┘
                                  │  REST calls
                    ┌─────────────▼───────────────┐
                    │   AI INFERENCE LAYER          │
                    │                              │
                    │  Google Gemini 1.5 Flash API │
                    │  System prompt grounded in   │
                    │  live MongoDB opportunity    │
                    │  and application data        │
                    └──────────────────────────────┘
```

### 2.2 Request / Response Lifecycle

```
Browser           React SPA              Express API          MongoDB        Gemini
  │                   │                      │                   │              │
  │──click/event─────►│                      │                   │              │
  │                   │──Axios POST/GET──────►│                   │              │
  │                   │                      │──loggerMiddleware─►│ (write log)  │
  │                   │                      │──verifyToken──────►│              │
  │                   │                      │──Mongoose query───►│              │
  │                   │                      │◄──document(s)──────│              │
  │                   │                      │                   │              │
  │                   │    (AI routes only)  │──fetch system────►│              │
  │                   │                      │   prompt + data   │              │
  │                   │                      │──────────────────────────────────►│
  │                   │                      │◄──────────────── AI response ────│
  │                   │◄──JSON response──────│                   │              │
  │◄──UI state update─│                      │                   │              │
```

---

## 3. Technology Stack

### 3.1 Frontend

| Technology | Version | Role |
|------------|---------|------|
| **React** | 19.2 | Component-based SPA framework |
| **Vite** | 8.3 | HMR build toolchain, ES-module bundler |
| **Three.js** | 0.186 | WebGL 2.0 3D rendering engine |
| **React Router DOM** | 7.18 | Client-side navigation |
| **Lucide React** | 1.52 | Icon set |
| **Axios** | 1.20 | HTTP client with interceptors |
| **Vanilla CSS** | — | Custom glassmorphism design system |

### 3.2 Backend

| Technology | Version | Role |
|------------|---------|------|
| **Node.js** | ≥ 18 LTS | JavaScript runtime |
| **Express.js** | 5.x | REST API framework |
| **Mongoose** | 8.x | MongoDB ODM |
| **JSON Web Token** | — | Stateless authentication |
| **bcryptjs** | — | Password hashing |
| **multer** | — | Multipart file upload |
| **dotenv** | — | Environment variable management |
| **cors / helmet** | — | Security middleware |

### 3.3 Database & AI

| Technology | Role |
|------------|------|
| **MongoDB** (local) | Primary document store — `hackelite_db` |
| **Google Gemini 1.5 Flash** | AI assistant inference |

---

## 4. Interactive 3D WebGL / Three.js Neural Constellation Engine

> **File:** `frontend/src/components/Background3D.jsx`  
> **Library:** Three.js r0.186 (WebGL 2.0)  
> **Bundle Size:** ~605 KB minified (lazy-chunked by Vite)  
> **Target:** 60+ FPS on mid-range hardware via GPU-accelerated rendering

### 4.1 Architecture & Rendering Pipeline

The 3D engine is implemented as a self-contained React functional component that bootstraps a complete Three.js scene inside a single `useEffect`. All physics state lives in `Float32Array` buffers and mutable `useRef` objects — React **never re-renders** during the animation loop, ensuring zero UI jank.

```
Bootstrap (once on mount)
  │
  ├─► WebGLRenderer  (antialias, high-performance GPU hint, DPR ≤ 2)
  ├─► PerspectiveCamera  (FOV 60°, Z=180)
  ├─► Fog  (matches bg colour — creates depth illusion)
  │
  ├─► PARTICLE SYSTEM
  │    ├─ BufferGeometry  (4 200 vertices, Float32Array positions)
  │    ├─ Custom ShaderMaterial  (GLSL vertex + fragment)
  │    │    ├─ Vertex:   depth-attenuated gl_PointSize, per-particle colour
  │    │    └─ Fragment: soft radial disc + inner glow core (smoothstep)
  │    └─ AdditiveBlending  → particles brighten each other where they cluster
  │
  ├─► EDGE NETWORK
  │    ├─ LineSegments  (pre-allocated 8 000-segment Float32Array)
  │    ├─ DynamicDrawUsage  (GPU buffer hint for frequent updates)
  │    └─ Rebuilt every 3rd frame with early-exit O(n²) + stride subsampling
  │
  └─► SHOCKWAVE MESH
       ├─ SphereGeometry wireframe  (reused across click events)
       └─ Scale + opacity animated via MeshBasicMaterial per frame

RAF Loop (tick)
  ├─ Physics integration  (spring + damping per particle)
  ├─ Mouse field          (attract / repel depending on cursor speed)
  ├─ Shockwave impulses   (radial burst for 25 frames post-click)
  ├─ Lissajous drift      (per-particle breathing oscillation)
  ├─ Edge rebuild         (every 3rd frame)
  └─ renderer.render()
```

### 4.2 Interactive Physics — Detailed Breakdown

#### Mouse Tracking & Fluid Physics

Every `mousemove` event projects the 2D cursor into 3D world-space using a `THREE.Raycaster`. The resulting `Vector3` becomes the centre of a **38-unit influence sphere**. For each particle inside this sphere:

- **Slow cursor** (`speed < 18 px/frame`) → **attraction force** pulls nodes toward the cursor, creating a gravitational lens effect.
- **Fast cursor** (`speed ≥ 18 px/frame`) → **repulsion force** scatters nodes outward, mimicking a fluid pressure wave.

Additionally, the **constellation rotates** to follow the mouse — a smooth `lerp` interpolation at 3% per frame prevents snapping.

```
force = (mouseVelocity > FAST_THRESH) ? REPEL_FORCE : ATTRACT_FORCE
falloff = 1 - (distance / influenceRadius)
velocity += sign * (direction / distance) * force * falloff
```

#### Click Shockwaves & Spring Physics

Clicking anywhere on the page:
1. Casts a ray from the camera through the NDC click coordinates.
2. Computes the 3D origin in the constellation's **local coordinate space** (by applying the inverse world matrix — shockwave aligns with the rotating mesh).
3. Pushes a `{origin, age}` object onto a `shockwaves[]` array.
4. For the next **25 frames**, every particle within `52 world-units` receives an outward radial velocity impulse proportional to `(1 − dist/radius) × SHOCKWAVE_FORCE`.
5. A semi-transparent wireframe sphere **expands and fades** over 80 frames as a visual echo of the shockwave.
6. Spring physics (`k = 0.045`, `damping = 0.88`) snaps all displaced particles back to their Lissajous-modulated home positions.

#### Scroll Parallax Camera

```
targetCamZ = clamp(CAMERA_Z_DEFAULT − scrollY × 0.04, 80, 280)
camera.position.z = lerp(camera.position.z, targetCamZ, 0.05)
```
Scrolling zooms the camera **into** the constellation — the particle field fills the screen as the user descends the landing page, creating a cinematic immersion effect.

#### Idle Breathing (Lissajous Drift)

Each particle has a unique 3-axis Lissajous oscillation applied to its rest position every frame:

```glsl
home.x = rest.x + sin(t × freqX + phaseX) × DRIFT_AMP
home.y = rest.y + cos(t × freqY + phaseY) × DRIFT_AMP
home.z = rest.z + sin(t × freqZ + phaseZ) × DRIFT_AMP × 0.5
```
This makes the constellation **breathe and pulsate** even without any user interaction.

### 4.3 Theme Adaptation

| Mode | Background | Node Colours | Edge | Glow |
|------|-----------|-------------|------|------|
| **Dark** | `#03050f` void black | Indigo · Cyan · Violet · Emerald · White | `#334155` slate | 100% intensity |
| **Light** | `#f1f5f9` pearl | Indigo · Cobalt · Purple · Teal · Charcoal | `#94a3b8` muted | 35% intensity |

Theme changes are applied live via the second `useEffect([isDark])` — no scene teardown required. Node colours and glow intensities are recomputed, GPU buffer attributes are marked dirty (`needsUpdate = true`), and the renderer clear colour updates atomically.

### 4.4 Performance Optimisations

| Technique | Detail |
|-----------|--------|
| **Single draw call** | All 4 200 particles rendered as one `THREE.Points` object |
| **Float32Array physics** | Zero heap allocation inside the RAF loop |
| **DPR cap at 2×** | Avoids 3× pixel density on high-end displays |
| **Edge stride subsampling** | Alternates between full and half particle checks |
| **Early-exit distance²** | Avoids `Math.sqrt` for distant pairs |
| **4-edges-per-particle cap** | Prevents visual clutter + bounds edge count |
| **Edge rebuilt every 3 frames** | Triples effective edge computation budget |
| **AdditiveBlending + depthWrite:false** | GPU-side transparency with no Z-sort overhead |
| **Fog** | Kills far-away overdraw cheaply on the GPU |

### 4.5 z-index Stacking Contract

```
z-index: 100   →  .navbar  (sticky)
z-index:   1   →  .app-container  (all UI panels, modals, buttons)
z-index:   0   →  Background3D canvas  (fixed, full-viewport)
pointer-events: none on canvas  →  all click/scroll events pass through to UI
```

---

## 5. Core Feature Modules

### 5.1 Authentication & Role-Based Access Control

- **JWT-based stateless auth** — tokens signed with `JWT_SECRET`, stored in React state (not localStorage for XSS safety).
- Two roles: `student` and `admin`.
- Express middleware `verifyToken` + `requireAdmin` guards every protected route.
- Frontend gates views with `useAuth()` context hook.
- Demo accounts seeded via `backend/utils/seedData.js`.

**Auth Routes:**
```
POST /api/auth/register   →  Create account (student by default)
POST /api/auth/login      →  Returns { token, user }
GET  /api/auth/me         →  Validate & decode current token
```

### 5.2 Opportunity CRUD & Admin Dashboard

Admins manage the full opportunity lifecycle:

```
GET    /api/opportunities          →  All listings (paginated, filterable)
POST   /api/opportunities          →  Create [Admin only]
PUT    /api/opportunities/:id      →  Update [Admin only]
DELETE /api/opportunities/:id      →  Delete [Admin only]
GET    /api/opportunities/:id      →  Single opportunity detail
```

**Opportunity Schema (MongoDB):**
```js
{
  title, company, type,           // Hackathon | Internship | Competition | Grant
  domain, location, modality,     // Remote | Hybrid | On-site
  stipend, deadline, description,
  skills: [String],
  externalLink,
  status: 'active' | 'closed',
  applicantCount,
  createdAt, updatedAt
}
```

### 5.3 Search, Filtering & Discovery

Multi-attribute filtering applied in one Mongoose query:
- **Text search** across `title`, `company`, `description`
- **Domain** chip filter (AI/ML, Web Dev, Cybersecurity, etc.)
- **Type** dropdown (Hackathon / Internship / Competition / Grant)
- **Modality** (Remote / Hybrid / On-site)
- **Deadline** sort (ascending)

### 5.4 Application Tracker

```
POST   /api/applications           →  Submit application (Student)
GET    /api/applications/mine      →  All applications for current student
GET    /api/applications/:oppId    →  Applications for an opportunity [Admin]
PUT    /api/applications/:id       →  Update status + feedback [Admin]
DELETE /api/applications/:id       →  Withdraw [Student]
```

**Status Pipeline:** `Submitted → Under Review → Shortlisted → Selected / Rejected`

Visualised as a 4-column Kanban board in `ApplicationTrackerView.jsx`.

### 5.5 Team Formation & File Upload

```
GET    /api/teams                  →  All open teams
POST   /api/teams                  →  Create team with project deck upload
POST   /api/teams/:id/join         →  Join an existing team
DELETE /api/teams/:id              →  Disband team [Creator only]
```

File uploads handled by `multer` — stored in `backend/uploads/`. Project deck PDFs/images attached during team creation.

### 5.6 Analytics Dashboard

```
GET  /api/analytics/summary        →  Aggregate KPIs
GET  /api/analytics/domain-dist    →  Opportunities by domain
GET  /api/analytics/app-trend      →  Application volume over time
GET  /api/analytics/top-companies  →  Most active organisations
```

Frontend renders four interactive chart panels using pure CSS + SVG:
- **KPI cards** (total opportunities, applications, teams, acceptance rate)
- **Domain distribution** bar chart
- **Application trend** line graph
- **Deadline proximity** heat indicator

### 5.7 AI Assistant (Gemini 1.5 Flash)

```
POST  /api/ai/chat                 →  { message } → { reply }
```

The backend constructs a **grounded system prompt** by fetching live opportunity and application data from MongoDB, then sends the combined context + user message to `gemini-1.5-flash`. The assistant can answer questions like:

> *"Which AI hackathons have deadlines in the next 30 days that match my Python skills?"*

### 5.8 Audit Log Middleware & Telemetry

Every request is recorded by `backend/middleware/loggerMiddleware.js`:

```js
{
  timestamp, method, url, statusCode,
  responseTimeMs, ip, userAgent,
  userId, role   // if JWT present
}
```

Logs are written to `backend/logs/server_audit.log` (JSON Lines format) and exposed via:
```
GET  /api/logs/view   →  Last N log entries [Admin only]
```

The **Live Audit Log Terminal** in the landing page polls this endpoint and streams entries into the glowing terminal feed UI.

---

## 6. Glassmorphism UI Design System

All UI components use a physics-accurate glassmorphism implementation via CSS custom properties:

```css
--glass-blur:   24px;                              /* Heavy backdrop-filter */
--glass-bg:     rgba(18, 24, 38, 0.68);            /* Semi-transparent dark glass */
--glass-border: rgba(255, 255, 255, 0.12);          /* Micro-border top highlight */
--glass-shadow: 0 8px 32px rgba(0,0,0,0.35),        /* Ambient elevation */
                inset 0 1px 0 rgba(255,255,255,0.14); /* Inner top sheen */
```

**Theme switching** is instant — a `data-theme="light"` attribute on `<html>` overrides all CSS variables simultaneously. User preference is persisted to `localStorage`; OS `prefers-color-scheme` is honoured on first visit.

---

## 7. Project Directory Structure

```
FSD_PROJ/
│
├── backend/
│   ├── config/
│   │   └── db.js                    # Mongoose connection
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── opportunityController.js
│   │   ├── applicationController.js
│   │   ├── teamController.js
│   │   ├── analyticsController.js
│   │   └── aiController.js
│   ├── middleware/
│   │   ├── authMiddleware.js        # verifyToken, requireAdmin
│   │   └── loggerMiddleware.js      # Audit telemetry
│   ├── models/
│   │   ├── User.js
│   │   ├── Opportunity.js
│   │   ├── Application.js
│   │   └── Team.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── opportunities.js
│   │   ├── applications.js
│   │   ├── teams.js
│   │   ├── analytics.js
│   │   ├── ai.js
│   │   └── logs.js
│   ├── utils/
│   │   └── seedData.js              # Demo data seeder
│   ├── logs/
│   │   └── server_audit.log         # Runtime audit log (JSON Lines)
│   ├── uploads/                     # Multer file destination
│   ├── .env                         # Environment variables
│   └── server.js                    # Express entry point
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Background3D.jsx     ← Three.js WebGL Neural Constellation
│   │   │   ├── Navbar.jsx           ← Theme toggle + navigation
│   │   │   ├── OpportunityCard.jsx
│   │   │   ├── OpportunityModal.jsx
│   │   │   ├── ApplyModal.jsx
│   │   │   ├── AiAssistantDrawer.jsx
│   │   │   ├── AuditLogModal.jsx
│   │   │   ├── AdminOpportunityModal.jsx
│   │   │   ├── ApplicationReviewModal.jsx
│   │   │   ├── CreateTeamModal.jsx
│   │   │   └── JoinTeamModal.jsx
│   │   ├── context/
│   │   │   ├── AuthContext.jsx      ← JWT state + role helpers
│   │   │   ├── ThemeContext.jsx     ← dark/light toggle + localStorage
│   │   │   └── ToastContext.jsx     ← Global notification system
│   │   ├── services/
│   │   │   └── api.js               ← Axios instance + interceptors
│   │   ├── styles/
│   │   │   ├── index.css            ← Global design system + glassmorphism
│   │   │   └── theme.css            ← Light-mode CSS variable overrides
│   │   ├── views/
│   │   │   ├── LandingPage.jsx      ← Hero + features + AI simulator + telemetry
│   │   │   ├── DiscoveryView.jsx
│   │   │   ├── ApplicationTrackerView.jsx
│   │   │   ├── TeamFormationView.jsx
│   │   │   ├── AdminDashboardView.jsx
│   │   │   └── AnalyticsView.jsx
│   │   ├── App.jsx                  ← Root layout, modal orchestration
│   │   └── main.jsx                 ← React root + context providers
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
└── README.md
```

---

## 8. Local Installation & Setup Guide

### 8.1 Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | ≥ 18 LTS |
| npm | ≥ 9 |
| MongoDB | ≥ 6 (local) |
| Git | Any |

### 8.2 Clone & Install

```bash
# 1. Clone the repository
git clone https://github.com/MUKUL-PRASAD-SIGH/FSD.git
cd FSD

# 2. Install backend dependencies
cd backend
npm install

# 3. Install frontend dependencies
cd ../frontend
npm install
```

### 8.3 Start MongoDB

The backend needs a MongoDB server reachable at `127.0.0.1:27017`
(install [MongoDB Community](https://www.mongodb.com/try/download/community); on Windows it runs as the `MongoDB` service).
Verify it is up before continuing:

```bash
# Windows PowerShell
Test-NetConnection 127.0.0.1 -Port 27017
```

### 8.4 Environment Configuration

Create `backend/.env`:

```env
# Server
PORT=5001
NODE_ENV=development

# MongoDB
MONGO_URI=mongodb://127.0.0.1:27017/hackelite_db

# JWT
JWT_SECRET=your_super_secret_key_change_this_in_production
JWT_EXPIRES_IN=7d

# Optional: Google Gemini AI (without it, the built-in answer engine is used)
# GEMINI_API_KEY=your_gemini_api_key_here
```

> **Port note:** the API runs on **5001** and the frontend calls `http://localhost:5001/api`
> (see `frontend/src/services/api.js`). If you change `PORT`, update that file as well,
> plus the upload links in `ApplicationReviewModal.jsx` and `TeamFormationView.jsx`.
> Port 5001 is used because 5000 is often occupied by other local servers.

### 8.5 Seed Demo Data

> **Warning:** the seed script deletes all existing users, opportunities, applications, saved items and teams first.

```bash
cd backend
npm run seed
```

This creates:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@hackelite.ai` | `AdminPassword123` |
| Student | `alex@student.edu` | `StudentPassword123` |
| Student | `priya@student.edu` | `StudentPassword123` |
| Student | `marcus@student.edu` | `StudentPassword123` |

plus sample opportunities across all domains and types.

### 8.6 Run the Application

**Terminal 1 — Backend API:**
```bash
cd backend
npm start
# ✔ HACKELITE AI BACKEND SERVER RUNNING ON PORT 5001
# ✔ MongoDB Connected Successfully
```

**Terminal 2 — Frontend Dev Server:**
```bash
cd frontend
npm run dev
# ✔ Local: http://localhost:5173
```

Open **http://localhost:5173**, then register a new account or use the 1-click demo buttons in the sign-in dialog.

**Quick check that the API is up:** `curl http://localhost:5001/` should return `"status":"ONLINE"`.

**Troubleshooting**
- *"Could not sign in" / generic errors* — another app is probably answering on the API port; check with `curl http://localhost:5001/`.
- *Demo login says "User not found"* — run the seed (8.5).
- *Backend exits on start* — MongoDB is not running (8.3).

### 8.7 Production Build

```bash
cd frontend
npm run build
# Outputs to frontend/dist/
```

---

## 9. API Reference

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/register` | None | Register new student account |
| `POST` | `/api/auth/login` | None | Login, returns JWT |
| `GET` | `/api/auth/me` | Bearer | Validate token, return user |

### Opportunities
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/opportunities` | None | List all (query: `search,domain,type,modality`) |
| `GET` | `/api/opportunities/:id` | None | Single opportunity |
| `POST` | `/api/opportunities` | Admin | Create opportunity |
| `PUT` | `/api/opportunities/:id` | Admin | Update opportunity |
| `DELETE` | `/api/opportunities/:id` | Admin | Delete opportunity |

### Applications
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/applications` | Student | Submit application |
| `GET` | `/api/applications/mine` | Student | My applications |
| `GET` | `/api/applications/:oppId` | Admin | Applications for opportunity |
| `PUT` | `/api/applications/:id` | Admin | Update status + feedback |
| `DELETE` | `/api/applications/:id` | Student | Withdraw application |

### Teams
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/teams` | Bearer | All active teams |
| `POST` | `/api/teams` | Student | Create team (multipart with file) |
| `POST` | `/api/teams/:id/join` | Student | Join team |
| `DELETE` | `/api/teams/:id` | Student | Disband team |

### Analytics
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/analytics/summary` | Admin | KPI aggregation |
| `GET` | `/api/analytics/domain-dist` | Admin | Domain distribution |
| `GET` | `/api/analytics/app-trend` | Admin | Application timeline |

### AI & Logs
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/ai/chat` | Bearer | Send message to Gemini assistant |
| `GET` | `/api/logs/view` | Admin | Last 100 audit log entries |

---

## 10. Key Implementation Highlights (Viva Defense Notes)

### Why MERN?
MongoDB's flexible document model suits evolving opportunity schemas (skills arrays, nested metadata). React's component model + Vite's HMR delivers fast iteration. Express's middleware chain cleanly separates concerns.

### Why Three.js (not Canvas 2D)?
Three.js exposes WebGL 2.0's GPU pipeline directly — allowing custom GLSL shaders for per-particle glow effects and `AdditiveBlending` that cannot be replicated in Canvas 2D at this fidelity. The `BufferGeometry` + `Float32Array` approach ensures zero heap allocation in the 60 FPS loop.

### Why custom ShaderMaterial?
`THREE.PointsMaterial` doesn't support per-particle colour variation or the inner glow `smoothstep` kernel. The custom GLSL vertex+fragment pair adds ~40 lines but unlocks full GPU control over every pixel of every particle.

### Spring Physics Design Decision
Hooke's Law (`F = kx`) is applied per-frame against each particle's displacement from its Lissajous home target. Velocity damping at 88% per frame creates **critical damping** — particles return to rest without oscillating past the target. This was chosen over stiff RK4 integration because the visual difference is imperceptible at 60 FPS.

### Shockwave Local-Space Alignment
The shockwave origin is transformed by `points.matrixWorld.invert()` before being stored. This ensures the impulse correctly aligns with the rotating constellation, not the fixed world axes — a subtle but critical correctness detail.

---

## 11. Audit Log Format

Every server request produces one JSON line in `backend/logs/server_audit.log`:

```json
{
  "timestamp": "2026-10-08T05:14:22.341Z",
  "method": "POST",
  "url": "/api/auth/login",
  "statusCode": 200,
  "responseTimeMs": 47,
  "ip": "::1",
  "userAgent": "Mozilla/5.0 ...",
  "userId": "66f3a...",
  "role": "student"
}
```

This log is streamed into the **Live Audit Terminal** on the landing page for live viva demonstration.

---

## 12. License & Academic Integrity

This project is submitted as original coursework for **24CIE554 — Full Stack Development**. All code was written by the project team. External libraries (Three.js, Express, Mongoose, React) are used under their respective open-source licenses (MIT/BSD).

---

*HackElite AI · Course 24CIE554 · Full Stack Development · Built with the MERN Stack + Three.js WebGL 2.0*
