# 🎙️ MockMate: AI Technical Hiring Manager

![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi)
![Model](https://img.shields.io/badge/Model-GPT--OSS--120B-412991?style=for-the-badge)
![Whisper](https://img.shields.io/badge/STT-Whisper--large--v3-f55036?style=for-the-badge)
![ElevenLabs](https://img.shields.io/badge/ElevenLabs-Turbo_v2.5-black?style=for-the-badge)

MockMate is a production-grade, full-stack AI interview platform designed to simulate high-stakes technical interviews. It ingests candidate resumes, orchestrates real-time conversational AI with ultra-low latency voice models, and generates detailed post-interview analytics using chain-of-thought evaluation.

## ✨ Core Features

* **Resume-Grounded Context Engine:** Extracts and parses PDF resumes to dynamically tailor the technical interview questions to the candidate's exact professional experience.
* **Ultra-Low Latency Voice Flow:** Integrates **Whisper-large-v3** for instantaneous Speech-to-Text and **ElevenLabs** for ultra-realistic, conversational Text-to-Speech, complete with gTTS fallback architecture.
* **The "Shadow Dossier" (Chain of Thought):** Features a transparent backend monologue where the **120B parameter LLM** evaluates candidate responses in real-time *before* speaking, reducing hallucination and ensuring objective grading.
* **Data-Driven Analytics:** Post-interview dashboards feature interactive, animated Radar Charts (via Recharts) mapping fidelity across Technical Skills, Problem Solving, and Communication.
* **Premium Glassmorphism UI:** Built with Next.js, Tailwind CSS, and Framer Motion for a fluid, state-driven, "Vercel-tier" user experience.

## 🧠 System Architecture

### 1. Client Input Layer
*   **Audio Capture:** Captured via the browser's [MediaDevices API](https://developer.mozilla.org).
*   **Backend:** Sent directly to a [FastAPI](https://fastapi.tiangolo.com) server for ingestion.

### 2. Transcription (ASR)
*   **Engine:** [Groq's Whisper-large-v3](https://console.groq.com) provides near-instantaneous speech-to-text conversion.

### 3. Context Management
*   **Resume Injection:** Injects structured candidate data into the prompt.
*   **Sliding History:** Manages short-term memory through a rolling chat history window.

### 4. Parallel AI Execution (GPT-OSS 120B)
The architecture forks the processing into two distinct, concurrent tasks:
*   **Task A | Shadow Dossier:** Generates an internal **Chain-of-Thought (CoT)** evaluation, with results persisted to [SQLite](https://www.sqlite.org).
*   **Task B | Response:** Generates the natural, outward-facing conversational text.

### 5. Voice Synthesis (TTS)
*   **Engine:** [ElevenLabs](https://elevenlabs.io) converts text to high-fidelity audio.
*   **Delivery:** Uses low-latency **streaming** to minimize the time-to-first-byte for the user.

## 🛠️ Tech Stack
### Frontend Ops:

-  Next.js (App Router) & React
- Tailwind CSS (Custom scrollbars & Glassmorphism)
- Framer Motion (Staggered text reveals & layout transitions)
- Recharts (SVG Gradient Data Visualization)

### Backend & AI Ops:

- Python 3.10+ & FastAPI (Asynchronous endpoints)
- PyPDF2 (Document extraction pipeline)
- SQLite (Persistent shadow dossier and transcript history)
- External Models: openai/gpt-oss-120b (Logic), whisper-large-v3 (STT), eleven_turbo_v2_5 (TTS)

## 🚀 Local Deployment
### Prerequisites
- Node.js (v18+)
- Python 3.10+
- API Keys for your LLM provider, Groq (for STT), and ElevenLabs

### 1. Backend Setup
```Bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```
Configure your environment variables in backend/.env:

```Ini, TOML
LLM_API_KEY=your_llm_api_key_here
GROQ_API_KEY=your_groq_key_here
ELEVENLABS_API_KEY=your_elevenlabs_key_here
```
Boot the API server:

```Bash
uvicorn main:app --reload --port 8001
```
### 2. Frontend Setup
```Bash
cd ../frontend
npm install
npm run dev
```
The application will be live at http://localhost:3000.
