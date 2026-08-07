# AI Resume Optimizer

An intelligent resume optimization engine that analyzes existing resumes against job descriptions and suggests targeted improvements for better ATS compatibility — while preserving the original document's design and formatting.

## Architecture

```
AI Resume Optimizer/
├── frontend/    → Next.js (App Router) + TypeScript + Tailwind CSS
├── backend/     → Express.js + TypeScript
└── shared/      → Shared TypeScript types
```

## Quick Start

### Prerequisites
- Node.js 18+
- A Gemini API key ([Get one here](https://aistudio.google.com/app/apikey))

### Setup

1. **Clone and install:**
```bash
# Install shared types
cd shared && npm install && npm run build && cd ..

# Install backend
cd backend && npm install && cd ..

# Install frontend
cd frontend && npm install && cd ..
```

2. **Configure environment:**
```bash
# Backend
cp .env.example backend/.env
# Edit backend/.env with your GEMINI_API_KEY

# Frontend
cp .env.example frontend/.env.local
# Edit frontend/.env.local
```

3. **Run development servers:**
```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## How It Works

1. **Upload** your existing resume (PDF or DOCX)
2. **Paste** the target job description
3. **Review** AI-suggested changes (additions, modifications, removals)
4. **Approve** only the changes you want
5. **Download** your optimized resume with original formatting preserved

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js, TypeScript, Tailwind CSS |
| Backend | Express.js, TypeScript |
| AI | Google Gemini (swappable provider architecture) |
| DOCX | PizZip + OpenXML |
| PDF | pdf.js-extract + pdf-lib |

## License

MIT
