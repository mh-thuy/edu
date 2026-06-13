# Edu Center Management Foundation

Technical foundation for a classroom rental center management system.

This repository currently includes:

- Next.js 15 (App Router) + TypeScript strict mode
- Material UI v7 + MUI X DataGrid + Material Icons
- React Hook Form + Zod validation
- Server Actions based authentication
- Role-based route protection (ADMIN, STAFF, TEACHER)
- PostgreSQL + Prisma ORM + migration + seed setup
- Docker Compose for local database

## 1. Prerequisites

- Node.js 20+
- npm 10+
- Docker + Docker Compose

## 2. Environment Setup

Copy the environment template:

```bash
cp .env.example .env
```

Required values:

- `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/classroom_rental?schema=public"`
- `DB_NAME=classroom_rental`
- `POSTGRES_USER=postgres`
- `POSTGRES_PASSWORD=postgres`
- `PORT=5432`
- `SESSION_SECRET` must be at least 32 characters

## 3. Start Database

```bash
docker compose up -d
```

## 4. Install Dependencies

```bash
npm install
```

## 5. Prisma Migration + Seed

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

Seed users:

- `admin@example.com` / `123456` (ADMIN)
- `staff@example.com` / `123456` (STAFF)
- `teacher@example.com` / `123456` (TEACHER)

## 6. Run App

```bash
npm run dev
```

Open `http://localhost:3000`.

## Authentication + Authorization Flow

- Unauthenticated users are redirected to `/login`
- Authenticated users cannot access `/login`
- Session persists across page refresh via signed cookie
- Route role guards:
	- `/admin` => ADMIN
	- `/staff` => ADMIN, STAFF
	- `/teacher` => ADMIN, STAFF, TEACHER

## Project Structure

```text
src/
	app/
	components/
	modules/
	hooks/
	services/
	server-actions/
	schemas/
	lib/
	utils/
	types/
	constants/
prisma/
	migrations/
	seed.ts
```

This is phase 1 foundation only. Business modules will be implemented in following steps.