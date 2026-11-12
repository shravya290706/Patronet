# PATRONET

A full-stack online shopping platform built with React, FastAPI and Aiven cloud services.

## Technology Stack

**Frontend**
- React
- Vite
- TypeScript
- Tailwind CSS
- shadcn/ui

**Backend**
- Python 3.13+
- FastAPI
- Uvicorn
- SQLAlchemy
- Alembic
- Pydantic
- Ruff

**Cloud Infrastructure**
- Aiven PostgreSQL – relational database
- Aiven Apache Kafka – event streaming
- Aiven OpenSearch – product search

## Project Structure

```text
Patronet/
├── patronet-frontend/
│   ├── src/
│   ├── components.json
│   ├── package.json
│   └── package-lock.json
│
├── patronet-backend/
│   ├── app/
│   ├── certs/
│   │   └── ca.pem
│   ├── tests/
│   │   ├── test_kafka.py
│   │   ├── test_opensearch.py
│   │   └── test_postgres.py
│   └── requirements.txt
│
├── .env.example
├── .gitignore
├── LICENSE
└── README.md
```

## Prerequisites

Install:
- Git
- Node.js and npm
- Python 3.13+

## Getting Started

### 1. Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd Patronet
```

### 2. Configure environment variables

Copy `.env.example` to `.env` in the project root.

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Fill in the required connection details using your authorised Aiven project access.

Never commit `.env` or share service passwords publicly.

### 3. Backend setup

```powershell
cd patronet-backend
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Return to the backend directory whenever opening a new terminal and activate the virtual environment.

Start the backend:

```powershell
python -m uvicorn app.main:app --reload
```

Backend: http://127.0.0.1:8000

API documentation: http://127.0.0.1:8000/docs

Health check: http://127.0.0.1:8000/health

### 4. Frontend setup

Open another terminal from the repository root:

```powershell
cd patronet-frontend
npm install
npm run dev
```

Frontend: http://localhost:5173

## Running Integration Tests

From `patronet-backend`, with the virtual environment activated:

```powershell
python -m tests.test_postgres
python -m tests.test_kafka
python -m tests.test_opensearch
```

These tests use the configured Aiven services.

## Code Quality

Backend:

```powershell
ruff check .
python -m pip check
```

Frontend:

```powershell
npm run lint
npm run build
```

## Team Development

- Use separate Git branches for individual features.
- Pull the latest changes before starting work.
- Commit and push completed changes.
- Keep credentials and environment files private.
- Do not commit virtual environments or generated build files.

## Project Status

The frontend and backend foundations are established. All three Aiven services have passed basic connectivity and data-operation integration tests. Full shopping workflows are under development.
