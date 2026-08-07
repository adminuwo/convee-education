# Enterprise AI Collaboration Platform - PRD Snapshot

## What was built (Phase 1 & 2 - COMPLETE)

**Stack:** Node.js 20 + Express + TypeScript + Prisma + PostgreSQL 15 (backend on port 8001) · Python FastAPI LLM bridge (internal port 8002, using Emergent LLM Key with default model gpt-5.4) · React + JSX + TailwindCSS + shadcn/ui + Socket.IO + Recharts + Framer Motion + dnd-kit + react-virtuoso (frontend).

**Modules delivered end-to-end:**
- Auth: email/password + JWT + refresh token rotation with jti; Google OAuth endpoints stubbed (activates when GOOGLE_CLIENT_ID/SECRET are added to `/app/backend/.env`)
- Organizations: multi-tenant with Organization → Department → Team → Project hierarchy; role-based membership (OWNER, ADMIN, DIRECTOR, DEPT_HEAD, MANAGER, EMPLOYEE, GUEST); invite flow
- Chat: PUBLIC/PRIVATE/DIRECT/TEAM/DEPARTMENT/PROJECT/ANNOUNCEMENT channels; realtime via Socket.IO; threads, reactions, pins, edit/delete, search, typing indicators
- AI Assistant: dedicated page + @AI in-channel mention; in-channel actions (Summarize channel, Generate tasks); Sprint planner endpoint
- Tasks: Kanban (drag-drop), List, Calendar views; multi-assignee; checklist; dependencies; comments; accept/reject/submit workflow
- Meetings: schedule, attendees, notes editor, AI summary
- Files: upload, download, search (stored on local disk)
- Dashboards: Employee, Manager, Org Admin, Director, Super Admin, Analytics (role-scoped)
- Admin panel: members, departments/teams, projects
- Notifications: in-app real-time with unread badge
- Global search: users/messages/tasks/projects/channels/files, plus Command Palette (Ctrl+K)
- Theme: dark/light modes; enterprise "Convee" brand identity

## Testing status
- POC test script (`/app/backend/src/scripts/test-poc.ts`): **17/17 steps PASSED**
- Testing agent: **Backend 100% (39/39 endpoints), Frontend 95%**

## Test credentials (seeded)
See `/app/memory/test_credentials.md`
- Super admin: admin@platform.io / SuperAdmin123!
- Demo owner: demo@acme.com / Demo1234!
- Employees: sarah@acme.com, mike@acme.com, priya@acme.com, jordan@acme.com (Demo1234!)

## Known items / deferred
- Google OAuth: awaiting user's GOOGLE_CLIENT_ID/SECRET (endpoints return 503 until then; email/password works fully)
- Redis Pub/Sub for Socket.IO horizontal scaling: not needed for MVP; add when scaling beyond single instance
- GCP deployment configs (Cloud Run, Cloud SQL, Terraform, Cloud Build): user explicitly skipped
- MFA, semantic search, video conferencing, recurring task scheduler, executive AI weekly report: deferred to future phase
- Recharts occasionally logs "width/height -1" warnings during initial mount (cosmetic)

## URLs
- App: https://workstream-hub-10.preview.emergentagent.com
- API docs: https://workstream-hub-10.preview.emergentagent.com/api/docs
