from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import shutil
import os
import base64
import tempfile
import json

# Import your EXACT logic
from utils import (
    extract_text_from_pdf,
    transcribe_audio,
    get_ai_response,
    text_to_speech,
    generate_feedback,
    save_interview,
    load_interviews
)

app = FastAPI()

# --- CORS: Allow Frontend (Next.js) to talk to Backend ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000","http://10.0.14.180:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DATA MODELS (Type checking for inputs) ---
class ChatRequest(BaseModel):
    resume_text: str
    chat_history: List[Dict[str, str]]
    user_text: Optional[str] = None

class FeedbackRequest(BaseModel):
    resume_text: str
    chat_history: List[Dict[str, str]]
    analysis_log: List[str]

# --- ENDPOINTS ---

@app.post("/extract-resume")
async def process_resume(file: UploadFile = File(...)):
    """
    Receives PDF -> Returns extracted text.
    """
    try:
        # Save temp file for PyPDF logic
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name
            
        # Use YOUR logic function
        text = extract_text_from_pdf(tmp_path)
        
        # Clean up
        os.remove(tmp_path)
        
        if not text:
            raise HTTPException(status_code=400, detail="Could not extract text")
            
        return {"resume_text": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/start-interview")
async def start_interview(resume_text: str = Form(...)):
    """Triggers the initial greeting from Shreya (Turn 0)"""
    speech, analysis = get_ai_response(resume_text, [])
    audio_bytes = text_to_speech(speech)
    audio_base64 = base64.b64encode(audio_bytes).decode('utf-8') if audio_bytes else None

    return {
        "ai_speech": speech,
        "ai_analysis": analysis,
        "audio_base64": audio_base64
    }

@app.post("/chat")
async def chat_turn(
    resume_text: str = Form(...),
    chat_history_json: str = Form(...), # We'll parse this manually
    user_text: Optional[str] = Form(None),
    audio_file: Optional[UploadFile] = File(None)
):
    """
    Handles Voice OR Text input -> Returns AI Speech + Audio + Analysis.
    """
    import json
    chat_history = json.loads(chat_history_json)
    
    # 1. HANDLE INPUT (Voice or Text)
    final_user_text = user_text
    
    if audio_file:
        # Save temp audio for Whisper logic
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            shutil.copyfileobj(audio_file.file, tmp)
            tmp_path = tmp.name
        
        # Use YOUR logic: transcribe_audio
        final_user_text = transcribe_audio(tmp_path)
        os.remove(tmp_path)

    if not final_user_text:
        return {"error": "No input detected"}

    # Update history for the model
    chat_history.append({"role": "user", "content": final_user_text})

    # 2. GET AI RESPONSE (The Brain)
    # Use YOUR logic: get_ai_response
    speech, analysis = get_ai_response(resume_text, chat_history)

    # 3. GENERATE AUDIO (The Mouth)
    # Use YOUR logic: text_to_speech
    audio_bytes = text_to_speech(speech)
    audio_base64 = base64.b64encode(audio_bytes).decode('utf-8') if audio_bytes else None

    return {
        "user_text": final_user_text,
        "ai_speech": speech,
        "ai_analysis": analysis,
        "audio_base64": audio_base64
    }

@app.post("/generate-feedback")
async def get_feedback(request: FeedbackRequest):
    """
    Ends interview -> Generates Report -> Saves to DB.
    """
    # Use YOUR logic: generate_feedback
    feedback_json = generate_feedback(request.chat_history, request.analysis_log)
    
    # Use YOUR logic: save_interview
    # Note: We save it automatically when feedback is requested
    save_interview(request.resume_text, request.chat_history, feedback_json)
    
    return feedback_json

@app.get("/history")
async def get_history():
    """
    Fetches past interviews from SQLite.
    """
    # Use YOUR logic: load_interviews
    data = load_interviews()
    
    # Format for JSON response
    # Data structure from utils: (id, date, score, verdict, feedback, chat_history)
    formatted_history = []
    for row in data:
        formatted_history.append({
            "id": row[0],
            "date": row[1],
            "score": row[2],
            "verdict": row[3],
            "feedback": json.loads(row[4]) if row[4] else {},
            "chat_history": json.loads(row[5]) if row[5] else []
        })
        
    return formatted_history