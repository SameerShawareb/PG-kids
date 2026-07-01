# PG Kids Platform

A full-stack, role-based platform for managing and consuming children’s video content in a safer, structured, and multilingual environment.

---

## Table of Contents

- [Overview](#overview)
- [Core Capabilities](#core-capabilities)
- [Technology Stack](#technology-stack)
- [Repository Structure](#repository-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Configuration](#environment-configuration)
  - [Run the Application](#run-the-application)
- [Configuration Reference](#configuration-reference)
- [Available Scripts](#available-scripts)
- [API Surface (High Level)](#api-surface-high-level)
- [Security & Safety Highlights](#security--safety-highlights)
- [Troubleshooting](#troubleshooting)
- [GitHub Publishing Workflow](#github-publishing-workflow)

---

## Overview

**PG Kids Platform** consists of:
- A **Frontend** client built with React + Vite.
- A **Backend API** built with Node.js, Express, Sequelize, and PostgreSQL.

The platform supports multiple user roles (such as parent, admin, and content manager), content management, subscriptions, child profile controls, watch history, and parent-PIN protection flows.

---

## Core Capabilities

- **Authentication & Account Management**
  - Register/login flows
  - Profile retrieval and update
  - Password change with security checks
  - Parent PIN set/verify/remove flow

- **Child Profile Management**
  - Create/update/delete child profiles
  - Child safety controls (e.g., profile locking)

- **Content Experience**
  - Browse/search content
  - Protected playback endpoint
  - Thumbnail retrieval
  - Watch activity logging and recent history

- **Subscription System**
  - Parent/admin subscription activation and cancellation
  - Active plan listing
  - Admin plan lifecycle management (create/update/archive/restore)

- **Administrative Operations**
  - Content CRUD and upload workflows
  - Category/series/season/episode organization
  - Admin user listing/details/status controls

---

## Technology Stack

### Frontend
- React 18
- Vite
- Axios
- i18next / react-i18next
- UI ecosystem includes MUI, Radix UI, and supporting libraries

### Backend
- Node.js (CommonJS)
- Express 5
- Sequelize ORM
- PostgreSQL
- bcrypt for credential hashing
- dotenv for environment configuration

---

## Repository Structure

```text
PG-kids/
├── Backend/
│   ├── config/
│   ├── controllers/
│   ├── docs/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── scripts/
│   ├── utils/
│   └── server.js
├── Frontend/
│   ├── public/
│   ├── src/
│   └── vite.config.ts
├── package.json
└── README.md
```

---

## Getting Started

### Prerequisites

Make sure the following are installed locally:

- **Node.js** (recommended: current LTS, e.g., v20+)
- **npm**
- **PostgreSQL**
- **Git**

### Installation

1. Clone the repository:

```bash
git clone https://github.com/SameerShawareb/PG-kids.git
cd PG-kids
```

2. Install root dependencies:

```bash
npm install
```

3. Install frontend and backend dependencies:

```bash
npm run install:all
```

4. Create your PostgreSQL database (example):

```sql
CREATE DATABASE pg_kids_db;
```

### Environment Configuration

Create a new file:

- `Backend/.env`

Recommended starter values:

```env
# App
PORT=3000
NODE_ENV=development
CORS_ORIGINS=http://localhost:5173

# Database (Option A: discrete fields)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pg_kids_db
DB_USER=postgres
DB_PASSWORD=your_password
DB_LOGGING=false
DB_SYNC_ALTER=true

# Database (Option B: full URL)
# DATABASE_URL=postgres://postgres:your_password@localhost:5432/pg_kids_db

# Auth / security
AUTH_TOKEN_SECRET=change_this_secret
AUTH_TOKEN_TTL_HOURS=12
ADMIN_SETUP_TOKEN=change_this_setup_token
PARENT_UNLOCK_TOKEN_TTL_MINUTES=5

# Upload/media (optional)
UPLOAD_DIR=uploads
MAX_MEDIA_FILE_SIZE_MB=100

# Seeder behavior (optional)
SEED_VIDEOS_PER_WORLD=3
```

> **Important:** Never commit real secrets to source control.

### Run the Application

From repository root:

```bash
npm run dev
```

Expected local endpoints:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- Health check: `http://localhost:3000/api/health`

---

## Configuration Reference

| Variable | Purpose |
|---|---|
| `PORT` | Backend server port (default `3000`) |
| `CORS_ORIGINS` | Comma-separated allowed frontend origins |
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | PostgreSQL connection fields |
| `DATABASE_URL` | Full PostgreSQL connection string (alternative to discrete DB vars) |
| `DB_SYNC_ALTER` | Enables Sequelize sync with alter mode (`true/false`) |
| `DB_LOGGING` | Enables SQL logging when `true` |
| `AUTH_TOKEN_SECRET` | JWT signing secret |
| `AUTH_TOKEN_TTL_HOURS` | Auth token lifetime in hours |
| `ADMIN_SETUP_TOKEN` | Required token for privileged registration flows |
| `PARENT_UNLOCK_TOKEN_TTL_MINUTES` | Parent unlock token duration |
| `UPLOAD_DIR` | Relative/absolute upload directory |
| `MAX_MEDIA_FILE_SIZE_MB` | Upload file-size cap in MB |
| `SEED_VIDEOS_PER_WORLD` | Seeder-generated world video volume |

---

## Available Scripts

### Root (`package.json`)

```bash
npm run install:all    # Install Backend + Frontend deps
npm run dev:backend    # Run backend in dev mode
npm run dev:frontend   # Run frontend in dev mode
npm run dev            # Run both concurrently
npm start              # Start backend
```

### Backend (`Backend/package.json`)

```bash
npm run dev                         # nodemon server.js
npm start                           # node server.js
npm run test                        # syntax checks
npm run test:smoke:parent-pin-removal
npm run seed                        # seed demo data
npm run db:tune                     # apply DB tuning SQL
npm run db:phase-e                  # apply phase-e schema changes
npm run db:add-video-url
npm run db:add-watch-history
npm run seed:world-videos
npm run seed:replace-random-urls
```

### Frontend (`Frontend/package.json`)

```bash
npm run dev      # start Vite dev server
npm run build    # production build
```

---

## API Surface (High Level)

The backend mounts the following route groups:

- `/api/auth` — authentication, account updates, password, parent PIN
- `/api/profiles` and `/api/child-profiles` — child profile management and safety settings
- `/api/content` — browse/search, playback, thumbnails, history
- `/api/plans` — subscription plans (public + admin)
- `/api/subscriptions` — current subscription operations
- `/api/admin/content` — content management and upload
- `/api/admin/organization` — taxonomy/organization entities
- `/api/admin/users` — admin user management

For phase-level backend details, see:
- `Backend/docs/PHASE_E_BACKEND_API.md`

---

## Security & Safety Highlights

- Passwords and parent PIN values are hashed (bcrypt)
- Role-based authorization for admin and content-manager capabilities
- Request rate limiting on sensitive operations (auth, password change, PIN verify, uploads)
- Parent unlock token support for safety-controlled child profile actions
- Restricted media access via protected playback/thumbnail endpoints
- Security-focused response headers and basic CORS controls

---

## Troubleshooting

### 1) Database connection fails

- Confirm PostgreSQL service is running
- Verify DB credentials in `Backend/.env`
- Ensure the database exists
- If using `DATABASE_URL`, validate format and credentials

### 2) CORS errors in browser

- Ensure frontend origin is included in `CORS_ORIGINS`
- Example: `CORS_ORIGINS=http://localhost:5173`

### 3) Frontend cannot reach backend

- Backend default is `http://localhost:3000`
- Frontend Axios base URL is currently set in `Frontend/src/api/axios.ts`
- If backend port changes, update the frontend base URL accordingly

### 4) Port already in use

- Change `PORT` in `Backend/.env`
- Or terminate the conflicting process

---

## GitHub Publishing Workflow

I can prepare and edit files locally, but pushing to GitHub must be done from your machine/account.

After reviewing this README, run:

```bash
git add README.md
git commit -m "docs: rewrite README with detailed professional project documentation"
git push origin <your-branch-name>
```

If you want, I can also prepare:
- a polished **Arabic README** (`README.ar.md`),
- architecture diagrams (Mermaid),
- and a contributor guide (`CONTRIBUTING.md`).

---

If you'd like, I can now create a **short executive one-page README version** for stakeholders, and keep this one as the technical reference.