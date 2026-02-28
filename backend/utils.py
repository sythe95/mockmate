import os
import base64
import requests
import urllib3
from pypdf import PdfReader
from dotenv import load_dotenv
import json
import sqlite3
import datetime
from gtts import gTTS
import io
import re

# Load environment variables
load_dotenv()

# --- CRITICAL FIX: Disable SSL Warnings ---
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def extract_text_from_pdf(uploaded_file):
    try:
        # FIX: Check if it's a string (file path) or a file object
        if isinstance(uploaded_file, str):
            reader = PdfReader(uploaded_file)
        else:
            reader = PdfReader(uploaded_file)
            
        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""
        print(f"DEBUG: Extracted {len(text)} chars from PDF")
        return text
    except Exception as e:
        print(f"ERROR: PDF Extraction failed: {e}")
        return ""
    
def save_interview(resume_text, chat_history, feedback_json):
    """
    Saves the interview data including full chat history to SQLite.
    """
    conn = sqlite3.connect('mockmate.db')
    c = conn.cursor()
    
    # Create table (if new)
    c.execute('''CREATE TABLE IF NOT EXISTS interviews
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  date TEXT,
                  resume_snippet TEXT,
                  score INTEGER,
                  verdict TEXT,
                  feedback TEXT,
                  chat_history TEXT)''') # Added chat_history column
    
    # MIGRATION: Check if chat_history column exists (for existing users)
    c.execute("PRAGMA table_info(interviews)")
    columns = [info[1] for info in c.fetchall()]
    if 'chat_history' not in columns:
        c.execute("ALTER TABLE interviews ADD COLUMN chat_history TEXT")
        conn.commit()

    # Insert data
    c.execute("INSERT INTO interviews (date, resume_snippet, score, verdict, feedback, chat_history) VALUES (?, ?, ?, ?, ?, ?)",
              (datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
               resume_text[:100] + "...",
               feedback_json.get('score', 0),
               feedback_json.get('verdict', 'N/A'),
               json.dumps(feedback_json),
               json.dumps(chat_history))) # Serialize list to JSON string
    
    conn.commit()
    conn.close()

def load_interviews():
    """
    Fetches all past interviews, including chat history.
    """
    conn = sqlite3.connect('mockmate.db')
    c = conn.cursor()
    
    # Ensure table exists
    c.execute('''CREATE TABLE IF NOT EXISTS interviews
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  date TEXT,
                  resume_snippet TEXT,
                  score INTEGER,
                  verdict TEXT,
                  feedback TEXT,
                  chat_history TEXT)''')
    
    # Select all columns including chat_history
    c.execute("SELECT id, date, score, verdict, feedback, chat_history FROM interviews ORDER BY id DESC")
    data = c.fetchall()
    conn.close()
    return data

def transcribe_audio(audio_file_path):
    """
    The Ears: Groq Whisper (Via Raw HTTP Request to bypass SSL)
    """
    url = "https://api.groq.com/openai/v1/audio/transcriptions"
    
    headers = {
        "Authorization": f"Bearer {os.getenv('GROQ_API_KEY')}"
    }
    
    try:
        with open(audio_file_path, "rb") as file:
            files = {
                "file": (os.path.basename(audio_file_path), file, "audio/wav"),
                "model": (None, "whisper-large-v3"),
                "language": (None, "en"),
                "response_format": (None, "json")
            }
            
            # verify=False is the magic fix here
            response = requests.post(url, headers=headers, files=files, verify=False)
            
        if response.status_code == 200:
            return response.json().get("text", "")
        else:
            print(f"Whisper Error {response.status_code}: {response.text}")
            return "Error hearing audio."
            
    except Exception as e:
        print(f"Whisper Connection Error: {e}")
        return "System Offline (Audio)."

def get_ai_response(resume_text, conversation_history):
    """
    The Brain: Reverted to Text Tags (More reliable than JSON for this model).
    Returns: (speech_text, analysis_text)
    """
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {os.getenv('GROQ_API_KEY')}",
        "Content-Type": "application/json"
    }

    # 1. SLIDING WINDOW (Keep last 3 turns to save tokens)
    if len(conversation_history) > 6:
        short_history = conversation_history[-6:]
    else:
        short_history = conversation_history

    # 2. SYSTEM PROMPT (Text-based instructions)
    system_prompt = f"""
    You are Shreya, a Senior Technical Hiring Manager conducting a rigorous real-world interview.
    
    RESUME CONTEXT:
    {resume_text[:4000]}
    
    INTERVIEW STYLE:
    - Direct, analytical, and occasionally adversarial.
    - Do NOT validate answers ("Great", "Perfect").
    - Do NOT teach or explain concepts.
    - Probe weaknesses and interrupt vague answers.
    
    BEHAVIORAL RULES:
    1. Do NOT summarize their answer (e.g., "It sounds like...").
    2. If the answer is average, just say "Okay." or "I see." and move on.
    3. If vague, interrupt: "Be specific." or "Quantify that."

    QUESTION CONTROL RULES:
    - Ask ONLY ONE question at a time.
    - If multiple clarifications are needed, choose the MOST important one.
    - Do not combine multiple questions in one response.
    - Never use compound questions.
    - Keep follow-up under 2 sentences.
    
    ADAPTIVE STRATEGY (Internal Monologue):
    - If specificity is low -> Ask for numbers/examples.
    - If technically strong -> Shift to architecture/failure modes.
    - If answer feels rehearsed -> Introduce a constraint (budget, latency, infra).
    - If answer contradicts resume -> Challenge it.

    PIVOT STRATEGY:

    You must continuously evaluate whether to continue drilling or pivot.

    Pivot when any of the following is true:

    1. DEPTH SATISFIED:
    - The candidate has demonstrated clear understanding with specificity.
    - You have gathered signal about ownership and tradeoffs.

    2. REPEATED UNCERTAINTY:
    - The candidate says "I don't know" more than once.

    3. TOPIC EXHAUSTION:
    - You have asked 3 follow-up questions on the same concept.

    4. STRONG SIGNAL:
    - The candidate shows strength.
    - Escalate difficulty OR move to architecture/system-level thinking.

    5. WEAK SIGNAL:
    - Switch to a different resume project.

    6. TIME SIMULATION:
    - After 4–6 exchanges on one topic, move on.

    When pivoting:
    - Do not explain why.
    - Transition naturally.
    - Ask exactly one new question.
    
    IMPORTANT - OUTPUT FORMAT:
    You must output TWO sections using these exact tags:
    
    [ANALYSIS]
    (Write your hidden assessment here. e.g., "Candidate is vague. I will drill down.")
    
    [SPEECH]
    (Write your actual response to the candidate here.)
    
    CURRENT STATE:
    If history is empty, say ONLY:
    [ANALYSIS]
    Starting interview.
    [SPEECH]
    I'm Shreya. I've reviewed your resume. Tell me about yourself.
    """

    messages = [{"role": "system", "content": system_prompt}] + short_history

    payload = {
        "model": "openai/gpt-oss-120b", 
        "messages": messages,
        "temperature": 0.3,
        "max_tokens": 1000
    }

    try:
        response = requests.post(url, json=payload, headers=headers, verify=False) 
        
        if response.status_code == 200:
            full_text = response.json()["choices"][0]["message"]["content"]
            
            speech = "Error parsing speech."
            analysis = "Error parsing analysis."

            # ROBUST REGEX: Finds tags regardless of order or case
            # 1. Look for [ANALYSIS] ... [SPEECH] ...
            match1 = re.search(r'\[ANALYSIS\]\s*(.*?)\s*\[SPEECH\]\s*(.*)', full_text, re.DOTALL | re.IGNORECASE)
            # 2. Look for [SPEECH] ... [ANALYSIS] ... (In case model flips them)
            match2 = re.search(r'\[SPEECH\]\s*(.*?)\s*\[ANALYSIS\]\s*(.*)', full_text, re.DOTALL | re.IGNORECASE)

            if match1:
                analysis = match1.group(1).strip()
                speech = match1.group(2).strip()
            elif match2:
                speech = match2.group(1).strip()
                analysis = match2.group(2).strip()
            else:
                # Fallback: If tags are missing, assume it's just speech
                # Clean up any partial tags if they exist
                speech = full_text.replace("[SPEECH]", "").replace("[ANALYSIS]", "").strip()
                analysis = "No hidden analysis generated."
            
            return speech, analysis
        else:
            print(f"Groq API Error: {response.text}")
            return f"API Error {response.status_code}", "System Error"

    except Exception as e:
        print(f"Connection Error: {e}")
        return f"Connection Exception: {str(e)}", "System Offline"

def text_to_speech(text):
    """
    The Mouth: ElevenLabs with gTTS Fallback
    """
    elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY")
    
    # If no key, skip straight to fallback
    if not elevenlabs_api_key:
        return fallback_gtts(text)

    url = "https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL" # Shreya's voice ID
    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": elevenlabs_api_key
    }
    data = {
        "text": text,
        "model_id": "eleven_turbo_v2_5",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75}
    }

    try:
        response = requests.post(url, json=data, headers=headers, verify=False)
        if response.status_code == 200:
            return response.content
        else:
            print(f"ElevenLabs Error: {response.text}")
            return fallback_gtts(text) # Fallback on API failure
    except Exception as e:
        print(f"ElevenLabs Connection Error: {e}")
        return fallback_gtts(text) # Fallback on network error

def fallback_gtts(text):
    print("Using gTTS Fallback...")
    try:
        from gtts import gTTS
        import io
        tts = gTTS(text=text, lang='en', tld='co.in', slow=False)
        fp = io.BytesIO()
        tts.write_to_fp(fp)
        fp.seek(0)
        return fp.read()
    except Exception as e:
        print(f"gTTS Error: {e}")
        return None
    
def generate_feedback(conversation_history, analysis_log):
    """
    The Judge: Analyzes the entire interview and produces a JSON report.
    """
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {os.getenv('GROQ_API_KEY')}",
        "Content-Type": "application/json"
    }

    # --- FIX: Added explicit JSON Schema below ---
    system_prompt = f"""
    You are a Senior Hiring Manager grading a technical interview.
    
    TRANSCRIPT: {conversation_history}
    
    INTERVIEWER'S HIDDEN NOTES (The "Shadow Dossier"):
    {analysis_log}
    
    (Use these notes to see where the candidate struggled, even if they faked confidence.)
    
    OUTPUT FORMAT:
    Return valid JSON ONLY with this exact schema:
    {{
        "score": (integer 0-100),
        "verdict": (string "Hire", "No Hire", or "Strong Hire"),
        "feedback_summary": (string, 2-3 sentences),
        "weak_areas": [list of strings],
        "strong_areas": [list of strings],
        "category_scores": {{
            "Technical Skills": (int 1-10),
            "Communication": (int 1-10),
            "Problem Solving": (int 1-10),
            "Experience Match": (int 1-10)
        }}
    }}
    """

    messages = [{"role": "system", "content": system_prompt}] + conversation_history

    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": messages,
        "temperature": 0.2, 
        "response_format": {"type": "json_object"} 
    }

    try:
        response = requests.post(url, json=payload, headers=headers, verify=False)
        if response.status_code == 200:
            return json.loads(response.json()["choices"][0]["message"]["content"])
        else:
            return {"error": "Failed to generate feedback"}
    except Exception as e:
        return {"error": str(e)}