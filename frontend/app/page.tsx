"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { UploadCloud, FileText, Loader2, Mic, Square, Send, ChevronRight, History } from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import Link from "next/link";

type Phase = "UPLOAD" | "INTERVIEW" | "FEEDBACK";
type Message = { role: "user" | "assistant"; content: string };

// Animated text component for Shreya's responses
const AnimatedText = ({ text }: { text: string }) => {
  const words = text.split(" ");
  
  return (
    <motion.div className="flex flex-wrap relative z-10">
      {words.map((word, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, filter: "blur(4px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{
            duration: 0.2,
            delay: i * 0.25, // Adjust this delay to match speech speed
            ease: "easeOut"
          }}
          className="mr-1.5 mb-1"
        >
          {word}
        </motion.span>
      ))}
    </motion.div>
  );
};

export default function Home() {
  const [phase, setPhase] = useState<Phase>("UPLOAD");

  // --- UPLOAD STATE ---
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [resumeText, setResumeText] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- INTERVIEW STATE ---
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [analysisLog, setAnalysisLog] = useState<string[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [textInput, setTextInput] = useState("");
  
  // Audio & Voice
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- FEEDBACK STATE ---
  const [feedbackData, setFeedbackData] = useState<any>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001";

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isThinking]);

  useEffect(() => {
    if (audioUrl && audioPlayerRef.current) {
      audioPlayerRef.current.play().catch(e => console.error("Autoplay blocked:", e));
    }
  }, [audioUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post(`${API_URL}/extract-resume`, formData);
      setResumeText(res.data.resume_text);
    } catch (error) {
      alert("Failed to parse resume.");
    } finally {
      setIsUploading(false);
    }
  };

  const startInterview = async () => {
    setPhase("INTERVIEW");
    setIsThinking(true);
    try {
      const fd = new FormData();
      fd.append("resume_text", resumeText || "");
      
      const res = await axios.post(`${API_URL}/start-interview`, fd);
      
      setAnalysisLog([`Turn 0 (Intro): ${res.data.ai_analysis}`]);
      setChatHistory([{ role: "assistant", content: res.data.ai_speech }]);
      
      if (res.data.audio_base64) {
        setAudioUrl(`data:audio/wav;base64,${res.data.audio_base64}`);
      }
    } catch (e) {
      alert("Failed to start interview.");
    } finally {
      setIsThinking(false);
    }
  };

  const handleSend = async (audioBlob?: Blob) => {
    if (!audioBlob && !textInput.trim()) return;

    const userMessage = textInput.trim();
    if (!audioBlob) {
      setChatHistory(prev => [...prev, { role: "user", content: userMessage }]);
      setTextInput("");
    }
    
    setIsThinking(true);
    try {
      const fd = new FormData();
      fd.append("resume_text", resumeText || "");
      fd.append("chat_history_json", JSON.stringify(chatHistory)); 
      
      if (audioBlob) {
        fd.append("audio_file", audioBlob, "recording.webm");
        setChatHistory(prev => [...prev, { role: "user", content: "🎤 [Processing Voice...]" }]);
      } else {
        fd.append("user_text", userMessage);
      }

      const res = await axios.post(`${API_URL}/chat`, fd);
      
      if (audioBlob && res.data.user_text) {
        setChatHistory(prev => {
          const newHist = [...prev];
          newHist[newHist.length - 1].content = res.data.user_text;
          return newHist;
        });
      }

      setAnalysisLog(prev => [...prev, `Turn ${Math.floor(chatHistory.length/2) + 1}: ${res.data.ai_analysis}`]);
      setChatHistory(prev => [...prev, { role: "assistant", content: res.data.ai_speech }]);
      
      if (res.data.audio_base64) {
        setAudioUrl(`data:audio/wav;base64,${res.data.audio_base64}`);
      }
    } catch(e) {
      alert("Network Error");
    } finally {
      setIsThinking(false);
    }
  };

  const startVoiceRecord = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      setTextInput(""); // Clears the input box so it looks clean while recording

      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        handleSend(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (e) { alert("Microphone access denied."); }
  };

  const stopVoiceRecord = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const endInterview = async () => {
    setIsThinking(true);
    try {
      const res = await axios.post(`${API_URL}/generate-feedback`, {
        resume_text: resumeText,
        chat_history: chatHistory,
        analysis_log: analysisLog
      });
      setFeedbackData(res.data);
      setPhase("FEEDBACK");
    } catch(e) { alert("Failed to generate report."); } finally { setIsThinking(false); }
  };

  // --- AMBIENT BACKGROUND: DEEP SPACE AURORA ---
  const AmbientBackground = () => (
    <div className="fixed inset-0 z-0 bg-[#030305] overflow-hidden pointer-events-none">
      
      {/* 1. Deep Blue Drift */}
      <motion.div
        animate={{
          x: ["-10vw", "10vw", "-10vw"],
          y: ["-10vh", "10vh", "-10vh"],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute top-0 left-[10%] w-[50vw] h-[50vw] rounded-full bg-blue-600/20 blur-[120px]"
      />

      {/* 2. Deep Violet/Indigo Drift */}
      <motion.div
        animate={{
          x: ["10vw", "-10vw", "10vw"],
          y: ["10vh", "-10vh", "10vh"],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        className="absolute bottom-0 right-[10%] w-[60vw] h-[60vw] rounded-full bg-indigo-600/15 blur-[120px]"
      />

      {/* 3. Ultra-fine premium grain to prevent color banding */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );

  return (
    <div className="relative min-h-screen bg-transparent text-slate-200 selection:bg-blue-500/30 font-sans">
      <AmbientBackground />

      <div className="relative z-10 h-full">
        {/* ==========================================
            RENDER: UPLOAD PHASE
            ========================================== */}
        {phase === "UPLOAD" && (
          <div className="flex min-h-screen flex-col items-center justify-center p-6">
            {!resumeText ? (
              <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: "easeOut" }} className="w-full max-w-xl flex flex-col items-center">
                
                <div className="text-center mb-10">
                  <motion.h1 initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="text-6xl font-black bg-gradient-to-br from-white via-blue-200 to-blue-600 bg-clip-text text-transparent mb-4 tracking-tight drop-shadow-sm">
                    MockMate
                  </motion.h1>
                  <p className="text-slate-400 text-lg font-light">Upload your resume to initialize Shreya.</p>
                  <Link href="/history" className="mt-4 inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 backdrop-blur-md bg-white/5 border border-white/10 px-5 py-2 rounded-full transition-all hover:bg-white/10 hover:shadow-[0_0_20px_rgba(59,130,246,0.2)]">
                    <History className="w-4 h-4" /> Access Shadow Dossiers
                  </Link>
                </div>

                <motion.div 
                  whileHover={{ scale: 1.02, translateY: -5 }} whileTap={{ scale: 0.98 }}
                  className="w-full max-w-md backdrop-blur-2xl bg-white/[0.04] border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.1)] hover:border-blue-500/40 rounded-3xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all group relative overflow-hidden"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {/* Subtle inner highlight on hover */}
                  <div className="absolute inset-0 bg-gradient-to-b from-white/[0.08] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  <input type="file" accept="application/pdf" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
                  
                  <AnimatePresence mode="wait">
                    {!file ? (
                      <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center relative z-10">
                        <div className="w-20 h-20 backdrop-blur-xl bg-white/[0.05] border border-white/10 rounded-2xl flex items-center justify-center mb-6 shadow-inner transform rotate-3 group-hover:rotate-0 transition-transform duration-300">
                          <UploadCloud className="text-blue-400 w-10 h-10 drop-shadow-[0_0_15px_rgba(96,165,250,0.5)]" />
                        </div>
                        <p className="text-slate-300 font-medium tracking-wide">Drag & drop or click to browse</p>
                      </motion.div>
                    ) : (
                      <motion.div key="file" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center relative z-10">
                        <div className="w-20 h-20 backdrop-blur-xl bg-blue-500/20 border border-blue-500/30 rounded-2xl flex items-center justify-center mb-6">
                          <FileText className="text-blue-300 w-10 h-10" />
                        </div>
                        <p className="text-slate-200 font-medium truncate max-w-[200px] text-lg">{file.name}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                {file && (
                  <motion.button
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} disabled={isUploading} onClick={handleUpload}
                    className="mt-8 relative group overflow-hidden rounded-full p-[1px]"
                  >
                    <span className="absolute inset-0 bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full opacity-70 group-hover:opacity-100 animate-pulse transition-opacity" />
                    <div className="relative flex items-center gap-2 bg-slate-950/80 backdrop-blur-xl px-10 py-4 rounded-full text-white font-semibold transition-all group-hover:bg-slate-900/50">
                      {isUploading ? <><Loader2 className="w-5 h-5 animate-spin text-blue-400" /> Linking Neural Nets...</> : "Initialize Profile"}
                    </div>
                  </motion.button>
                )}
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="backdrop-blur-2xl bg-white/5 border border-emerald-500/30 p-12 rounded-[2rem] text-center shadow-[0_0_50px_rgba(16,185,129,0.15)] relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />
                <div className="w-24 h-24 backdrop-blur-md bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-inner">
                  <FileText className="text-emerald-400 w-12 h-12" />
                </div>
                <h2 className="text-4xl font-bold mb-3 text-white">Profile Synchronized</h2>
                <p className="text-slate-400 mb-10 text-lg">Shreya is analyzing your experience...</p>
                <button onClick={startInterview} disabled={isThinking} className="group relative overflow-hidden rounded-full p-[1px] mx-auto block">
                  <span className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full opacity-70 group-hover:opacity-100 transition-opacity" />
                  <div className="relative flex items-center gap-3 bg-slate-950/80 backdrop-blur-xl px-12 py-5 rounded-full text-white font-bold text-lg transition-all group-hover:bg-transparent">
                    {isThinking ? <Loader2 className="w-6 h-6 animate-spin" /> : <>Enter Interview <ChevronRight className="w-5 h-5" /></>}
                  </div>
                </button>
              </motion.div>
            )}
          </div>
        )}

        {/* ==========================================
            RENDER: INTERVIEW PHASE
            ========================================== */}
        {phase === "INTERVIEW" && (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="flex flex-col h-screen max-w-5xl mx-auto relative z-10">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio ref={audioPlayerRef} src={audioUrl || undefined} />

            {/* Premium Glass Header */}
            <div className="backdrop-blur-2xl bg-[#030305]/40 border-b border-white/[0.08] px-8 py-5 flex justify-between items-center sticky top-0 z-30 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
              <div className="flex items-center gap-5">
                <div className="relative group">
                  <div className="w-12 h-12 rounded-2xl backdrop-blur-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-2xl shadow-inner transition-transform group-hover:scale-105">
                    🤖
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-[#030305] shadow-[0_0_10px_rgba(16,185,129,0.8)] animate-pulse" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white tracking-wide">Shreya</h3>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <p className="text-xs text-emerald-400 tracking-[0.2em] uppercase font-bold opacity-80">Recording Session</p>
                  </div>
                </div>
              </div>
              <button 
                onClick={endInterview} 
                disabled={isThinking || chatHistory.filter(msg => msg.role === "user").length < 3} 
                className="relative group overflow-hidden rounded-full p-[1px] disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-rose-500/50 to-orange-500/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative backdrop-blur-md bg-rose-500/10 border border-rose-500/20 text-rose-300 hover:text-rose-200 px-6 py-2.5 rounded-full text-sm font-bold transition-all group-hover:bg-rose-500/20">
                  Conclude Evaluation
                </div>
              </button>
            </div>

            {/* Chat Area - Hide scrollbar for cleaner look */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8 pb-48 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <AnimatePresence>
                {chatHistory.map((msg, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] p-6 text-[1.1rem] leading-relaxed shadow-2xl relative group ${
                      msg.role === "user" 
                        ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-[2rem] rounded-br-sm shadow-[0_10px_40px_rgba(59,130,246,0.2)]" 
                        : "backdrop-blur-2xl bg-white/[0.03] border border-white/10 text-slate-200 rounded-[2rem] rounded-tl-sm shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
                    }`}>
                      {/* Subtle hover glow for AI messages */}
                      {msg.role !== "user" && <div className="absolute inset-0 bg-white/[0.02] opacity-0 group-hover:opacity-100 rounded-[2rem] rounded-tl-sm transition-opacity duration-500 pointer-events-none" />}
                      
                      {/* NEW CONDITIONAL RENDERING HERE */}
                      <div className="relative z-10">
                        {msg.role === "user" ? (
                          <p>{msg.content}</p>
                        ) : (
                          <AnimatedText text={msg.content} />
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
                
                {isThinking && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                    <div className="backdrop-blur-2xl bg-white/[0.03] border border-white/10 p-5 rounded-[2rem] rounded-tl-sm flex items-center gap-4 shadow-lg shadow-black/20">
                      <div className="flex gap-1.5">
                        <motion.div className="w-2 h-2 bg-blue-400 rounded-full shadow-[0_0_8px_rgba(96,165,250,0.8)]" animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} />
                        <motion.div className="w-2 h-2 bg-blue-400 rounded-full shadow-[0_0_8px_rgba(96,165,250,0.8)]" animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} />
                        <motion.div className="w-2 h-2 bg-blue-400 rounded-full shadow-[0_0_8px_rgba(96,165,250,0.8)]" animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} />
                      </div>
                      <span className="text-blue-200/70 text-sm font-medium tracking-wide">Processing logic...</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div ref={chatEndRef} />
            </div>

            {/* Ultra-Premium Floating Input Area */}
            <div className="absolute bottom-8 left-0 right-0 px-8 z-30 pointer-events-none">
              <div className="max-w-4xl mx-auto pointer-events-auto">
                <div className="relative group">
                  {/* Outer animated glow ring */}
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/30 via-emerald-500/30 to-indigo-500/30 rounded-full blur opacity-30 group-hover:opacity-60 transition duration-1000 group-hover:duration-200" />
                  
                  {/* The actual frosted pill */}
                  <div className="relative backdrop-blur-3xl bg-[#030305]/60 border border-white/10 p-2 rounded-full shadow-[0_20px_40px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.05)] flex gap-3 items-center">
                    <button 
                      onMouseDown={startVoiceRecord} onMouseUp={stopVoiceRecord} onMouseLeave={stopVoiceRecord} disabled={isThinking} 
                      className={`p-4 rounded-full flex-shrink-0 transition-all duration-300 ${isRecording ? "bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.6)] scale-105" : "bg-white/[0.03] hover:bg-white/10 text-slate-300 border border-transparent hover:border-white/10"}`}
                    >
                      {isRecording ? <Square className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6" />}
                    </button>
                    
                    <input 
                      type="text" value={textInput} onChange={(e) => setTextInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSend()} 
                      placeholder={isRecording ? "Neural link active. Speak clearly..." : "Transmit your response..."} disabled={isRecording || isThinking}
                      className="flex-1 bg-transparent text-white px-2 py-4 focus:outline-none disabled:opacity-50 text-lg placeholder-slate-500 font-light"
                    />
                    
                    <button 
                      onClick={() => handleSend()} disabled={!textInput.trim() || isThinking} 
                      className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-white/5 disabled:to-white/5 disabled:text-slate-600 text-white rounded-full flex-shrink-0 transition-all shadow-[0_0_15px_rgba(59,130,246,0.4)] disabled:shadow-none border border-transparent disabled:border-white/5"
                    >
                      <Send className="w-6 h-6 ml-0.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ==========================================
            RENDER: FEEDBACK PHASE
            ========================================== */}
        {phase === "FEEDBACK" && feedbackData && (
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} className="min-h-screen p-8 overflow-y-auto">
            <div className="max-w-6xl mx-auto space-y-8 relative z-10">
              
              <div className="text-center mb-16 pt-10">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5 }} className="w-24 h-24 mx-auto backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center mb-6 shadow-2xl">
                  <span className="text-5xl">📊</span>
                </motion.div>
                <h1 className="text-6xl font-black mb-6 text-white tracking-tight">Diagnostic Complete</h1>
                <p className="text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">{feedbackData.feedback_summary}</p>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Score Card */}
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 p-10 rounded-[2.5rem] text-center flex flex-col justify-center relative overflow-hidden shadow-2xl group">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"/>
                  <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-4">Overall Fidelity</p>
                  <h2 className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-br from-blue-400 to-cyan-300 mb-6 drop-shadow-md">
                    {feedbackData.score}
                  </h2>
                  <div className="mx-auto bg-slate-900/50 backdrop-blur-md border border-white/10 px-6 py-2 rounded-full text-lg font-bold text-white shadow-inner">
                    {feedbackData.verdict}
                  </div>
                </div>

                {/* Radar Chart Card */}
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 p-8 rounded-[2.5rem] lg:col-span-2 shadow-2xl relative">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[50px] rounded-full" />
                  <ResponsiveContainer width="100%" height={350}>
                    <RadarChart cx="50%" cy="50%" outerRadius="75%" data={
                      feedbackData.category_scores ? Object.keys(feedbackData.category_scores).map(key => ({ subject: key, A: feedbackData.category_scores[key], fullMark: 10 })) : []
                    }>
                      <PolarGrid stroke="rgba(255,255,255,0.1)" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 13, fontWeight: 600 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
                      <Radar name="Score" dataKey="A" stroke="#38bdf8" strokeWidth={3} fill="url(#colorUv)" fillOpacity={0.5} />
                      <defs>
                        <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Strengths & Weaknesses */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="backdrop-blur-xl bg-emerald-950/20 border border-emerald-500/20 p-10 rounded-[2.5rem] shadow-[0_0_30px_rgba(16,185,129,0.05)]">
                  <h3 className="text-2xl font-bold text-emerald-400 mb-8 flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/20 rounded-lg"><span className="text-xl">📈</span></div> Strengths Identified
                  </h3>
                  <ul className="space-y-4">
                    {feedbackData.strong_areas?.map((item: string, i: number) => (
                      <li key={i} className="flex gap-4 text-slate-200 leading-relaxed"><span className="text-emerald-400 font-bold mt-1">✓</span> {item}</li>
                    ))}
                  </ul>
                </div>
                <div className="backdrop-blur-xl bg-rose-950/20 border border-rose-500/20 p-10 rounded-[2.5rem] shadow-[0_0_30px_rgba(244,63,94,0.05)]">
                  <h3 className="text-2xl font-bold text-rose-400 mb-8 flex items-center gap-3">
                    <div className="p-2 bg-rose-500/20 rounded-lg"><span className="text-xl">📉</span></div> Optimization Targets
                  </h3>
                  <ul className="space-y-4">
                    {feedbackData.weak_areas?.map((item: string, i: number) => (
                      <li key={i} className="flex gap-4 text-slate-200 leading-relaxed"><span className="text-rose-400 font-bold mt-1">✗</span> {item}</li>
                    ))}
                  </ul>
                </div>
              </div>
              
              <div className="text-center pt-12 pb-20">
                <button onClick={() => window.location.reload()} className="backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white px-10 py-4 rounded-full font-bold transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                  Initialize New Session
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}