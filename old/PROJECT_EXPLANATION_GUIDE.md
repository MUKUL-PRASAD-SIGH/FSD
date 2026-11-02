# HackElite AI: Architecture, Integration & Professor Viva Defense Guide
**Course**: 24CIE554 - Full Stack Development  
**Project**: HackElite AI: An Intelligent Technical Opportunity Discovery, Recommendation and Analytics Platform  
**Architecture**: MERN Stack (React 18 + Vite, Node.js + Express.js REST API, MongoDB + Mongoose)

---

## 1. Architectural Blueprint & File Structure

```
FSD_PROJ/
├── backend/
│   ├── config/
│   │   └── db.js                        # Resilient MongoDB connection with Mongoose
│   ├── controllers/
│   │   ├── authController.js            # JWT auth, register, login, profile management
│   │   ├── opportunityController.js     # Opportunity CRUD, multi-attribute filter & search
│   │   ├── applicationController.js     # Student application submission, timeline, status updates
│   │   ├── teamController.js            # Team formation, join requests, proposal documents
│   │   ├── analyticsController.js       # Aggregation pipelines, domain distribution, funnel KPIs
│   │   └── aiController.js              # Contextual grounding engine + Gemini AI integration
│   ├── middleware/
│   │   ├── authMiddleware.js            # JWT verification & Role-Based Access Control (RBAC)
│   │   ├── loggerMiddleware.js          # Request-response lifecycle audit telemetry
│   │   ├── uploadMiddleware.js          # Multer disk storage for resumes and project decks
│   │   └── errorMiddleware.js           # Centralized exception translation & 404 handler
│   ├── models/
│   │   ├── User.js                      # Schema: Credentials, roles (student/admin), skills, college
│   │   ├── Opportunity.js               # Schema: Domains, types, rewards, deadlines, tags, indexes
│   │   ├── Application.js               # Schema: Multi-stage status, timeline audit, resume paths
│   │   ├── SavedItem.js                 # Schema: Bookmarked opportunities
│   │   └── Team.js                      # Schema: Collaborative rosters, pitches, join requests
│   ├── routes/
│   │   ├── authRoutes.js                # /api/auth
│   │   ├── opportunityRoutes.js         # /api/opportunities
│   │   ├── applicationRoutes.js         # /api/applications
│   │   ├── teamRoutes.js                # /api/teams
│   │   ├── analyticsRoutes.js           # /api/analytics
│   │   └── aiRoutes.js                  # /api/ai
│   ├── logs/
│   │   └── server_audit.log             # Persistent JSON Lines audit log
│   ├── uploads/                         # Statically served files (resumes, pitch attachments)
│   ├── utils/
│   │   └── seedData.js                  # Database seeder with sample accounts & listings
│   ├── server.js                        # Express server entrypoint & CORS configuration
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx               # Navigation bar, audit log trigger, AI launcher, role pill
│   │   │   ├── OpportunityCard.jsx      # Opportunity card with domain pills, rewards, countdown
│   │   │   ├── OpportunityModal.jsx     # Detailed criteria, requirements, bookmark, apply trigger
│   │   │   ├── ApplyModal.jsx           # Application modal with resume file upload & pitch
│   │   │   ├── AdminOpportunityModal.jsx# Opportunity creation and editing form (Admin CRUD)
│   │   │   ├── ApplicationReviewModal.jsx # Admin review dossier with decision & feedback notes
│   │   │   ├── AiAssistantDrawer.jsx    # Interactive AI chatbot with DB-grounded recommendations
│   │   │   ├── AuditLogModal.jsx        # Live backend request-response inspector for viva demo
│   │   │   ├── CreateTeamModal.jsx      # Collaborative team builder with document upload
│   │   │   └── JoinTeamModal.jsx        # Team membership request dialog
│   │   ├── context/
│   │   │   ├── AuthContext.jsx          # Session state, JWT storage, role discrimination
│   │   │   └── ToastContext.jsx         # Non-blocking user feedback notifications
│   │   ├── services/
│   │   │   └── api.js                   # Centralized Axios service with request/response interceptors
│   │   ├── styles/
│   │   │   └── index.css                # Premium Vanilla CSS design system with glassmorphism
│   │   ├── views/
│   │   │   ├── LandingPage.jsx          # Glassmorphic high-converting landing page & hero showcase
│   │   │   ├── DiscoveryView.jsx        # Search, domain chips, filter selects, opportunity grid
│   │   │   ├── ApplicationTrackerView.jsx # 4-stage stepper, audit history, committee feedback
│   │   │   ├── TeamFormationView.jsx    # Roster display, pitch deck links, join request manager
│   │   │   ├── AdminDashboardView.jsx   # Opportunity table & candidate dossier evaluation
│   │   │   ├── AnalyticsView.jsx        # Aggregated KPI metric cards, domain & funnel bar charts
│   │   │   └── AuthModal.jsx            # Sign In / Register with 1-click viva test accounts
│   │   ├── App.jsx                      # Main SPA layout and view orchestrator
│   │   └── main.jsx                     # Application bootstrap with Providers
│   ├── index.html                       # HTML5 template with Inter typography
│   ├── vite.config.js
│   └── package.json
│
└── README.md
```

---

## 2. Walkthrough: Frontend to Backend REST API Communication

The frontend communicates with the backend through a **Centralized Service Layer** (`src/services/api.js`) built on top of Axios.

### Request Interception
Every outbound HTTP call passes through the **Axios Request Interceptor**:
```javascript
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('hackelite_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```
- **Why this matters for your viva**: The user does not have to manually pass authorization tokens in individual components. Once a user logs in, the JWT token stored in `localStorage` is automatically injected into the HTTP `Authorization` header for all protected endpoints (`/api/applications/my`, `/api/opportunities`, etc.).

### Response Interception
Responses and errors pass through the **Axios Response Interceptor**:
```javascript
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('hackelite_token');
      localStorage.removeItem('hackelite_user');
    }
    return Promise.reject(error);
  }
);
```
- If an authorization token expires or is tampered with, the interceptor purges the stale session and ensures clean state recovery.

---

## 3. Walkthrough: Comprehensive Request-Response Logging Middleware

The backend features custom audit middleware (`backend/middleware/loggerMiddleware.js`) registered globally via `app.use(requestLogger);` in `server.js`.

### How the Middleware Works Internally:
1. **Request Intake**:
   - Captures high-resolution start time using `process.hrtime()`.
   - Assigns an incremental request sequence ID (`reqId`).
   - Extracts HTTP Method, Route URL, Client IP, and Query parameters.
   - Extracts user context from the incoming `Authorization` header.
   - **Sanitizes incoming payloads**: Masks sensitive fields like `password` or `token` so credentials are never leaked in terminal logs or persistent files.
2. **Response Interception**:
   - Hooks into Node's `res.end` method.
   - Calculates the exact execution duration in milliseconds:
     $$\text{durationMs} = \frac{\Delta\text{seconds} \times 10^9 + \Delta\text{nanoseconds}}{10^6}$$
   - Formats a colored terminal audit block with ANSI escape codes.
   - Appends a structured JSON Line to `backend/logs/server_audit.log`.

### Sample Terminal Log Output:
```text
--------------------------------------------------------------------------------
[REQ #5] 2026-10-07T21:11:09.540Z | GET /api/applications/my
   ├─ Client IP: ::1 | Context: User: Alex Chen (ID: 6ac6b28d8def0cbdd88aab64, Role: student)
   ├─ Query Params: -
   ├─ Request Body: -
   └─ Response: 200 | 30.40 ms | Status: OK
--------------------------------------------------------------------------------
[REQ #6] 2026-10-07T21:13:56.005Z | POST /api/ai/chat
   ├─ Client IP: ::1 | Context: Auth: Anonymous
   ├─ Query Params: -
   ├─ Request Body: {"message":"Recommend hackathons for React and AI"}
   └─ Response: 200 | 8.91 ms | Status: OK
```

### Persistent File Log (`backend/logs/server_audit.log`):
```json
{"reqId":5,"timestamp":"2026-10-07T21:11:09.540Z","method":"GET","endpoint":"/api/applications/my","ip":"::1","user":{"id":"6ac6b28d8def0cbdd88aab64","role":"student","email":"alex@student.edu"},"query":{},"statusCode":200,"durationMs":30.4}
```

---

## 4. Walkthrough: Authentication, Role-Based Access Control (RBAC), and Database Queries

### Step 1: User Authentication & Token Generation
1. The client sends a `POST /api/auth/login` request with `{ email, password }`.
2. `authController.loginUser`:
   - Looks up the user in MongoDB via `User.findOne({ email }).select('+password')`.
   - Uses `bcrypt.compare(enteredPassword, user.password)` to safely check hashed passwords.
   - Generates a signed JWT with `jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' })`.
   - Responds with the token and profile object (`{ id, name, email, role, skills }`).

### Step 2: Role-Based Authorization Pipeline
When a client requests a protected endpoint (e.g., `POST /api/opportunities` which requires Administrator role):
```javascript
router.post('/', protect, authorize('admin'), createOpportunity);
```
1. **`protect` Middleware**:
   - Extracts the token from `req.headers.authorization`.
   - Verifies the signature with `jwt.verify(token, JWT_SECRET)`.
   - Fetches the user record from MongoDB via `User.findById(decoded.id)`.
   - Binds the user object to `req.user`. If token is absent or corrupted, immediately terminates with `401 Unauthorized`.
2. **`authorize('admin')` Middleware**:
   - Inspects `req.user.role`.
   - If `req.user.role !== 'admin'`, terminates with `403 Forbidden`:
     ```json
     { "success": false, "message": "Forbidden: User role 'student' is not authorized to access this resource" }
     ```
   - If authorized, invokes `next()` to proceed to the controller.

### Step 3: Database Query Execution (Mongoose & Aggregations)
- **Compound Search & Filtering (`opportunityController.getOpportunities`)**:
  Combines regex queries across `title`, `company`, `description`, and `skillsRequired` with equality queries on `domain`, `type`, and `locationType`. Populates the creator via `.populate('postedBy', 'name email')`.
- **Analytics Aggregations (`analyticsController.getAnalyticsOverview`)**:
  Uses high-performance MongoDB aggregation pipelines:
  ```javascript
  const domainBreakdown = await Opportunity.aggregate([
    { $match: oppFilter },
    { $group: { _id: '$domain', count: { $sum: 1 }, totalApplicants: { $sum: '$applicantCount' } } },
    { $sort: { count: -1 } }
  ]);
  ```
  This computes counts and sums entirely within MongoDB's engine rather than in JavaScript memory.

---

## 5. Pre-Configured Demo Accounts for Academic Defense

| Role | Name | Email | Password | Pre-loaded Context |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | Dr. Katherine Vance | `admin@hackelite.ai` | `AdminPassword123` | Can create, edit, delete opportunities, and evaluate applicant dossiers. |
| **Student** | Alex Chen | `alex@student.edu` | `StudentPassword123` | Has 2 submitted applications (Shortlisted & Under Review), leader of "Agentic Architects" team. |
| **Student** | Priya Sharma | `priya@student.edu` | `StudentPassword123` | Accepted to AI Hackathon, PyTorch & ML researcher. |
| **Student** | Marcus Brody | `marcus@student.edu` | `StudentPassword123` | Cloud & DevOps candidate, pending application for Red Hat apprenticeship. |

*Quick Access Feature*: In the Sign In modal, use the **1-Click Professor Demo Buttons** ("Login as Admin" / "Login as Student") to test instantly without manual typing.
