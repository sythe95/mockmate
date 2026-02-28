"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { Calendar, Award, MessageSquare, ChevronDown, ChevronUp, ArrowLeft, BarChart3 } from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import Link from "next/link";

type InterviewHistory = {
  id: number;
  date: string;
  score: number;
  verdict: string;
  feedback: any;
  chat_history: { role: string; content: string }[];
};

export default function HistoryPage() {
  const [history, setHistory] = useState<InterviewHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001";

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await axios.get(`${API_URL}/history`);
        setHistory(res.data);
      } catch (error) {
        console.error("Failed to fetch history:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [API_URL]);

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // --- AMBIENT BACKGROUND: DEEP SPACE AURORA ---
  const AmbientBackground = () => (
    <div className="fixed inset-0 z-0 bg-[#030305] overflow-hidden pointer-events-none">
      <motion.div
        animate={{ x: ["-10vw", "10vw", "-10vw"], y: ["-10vh", "10vh", "-10vh"] }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute top-0 left-[10%] w-[50vw] h-[50vw] rounded-full bg-blue-600/10 blur-[120px]"
      />
      <motion.div
        animate={{ x: ["10vw", "-10vw", "10vw"], y: ["10vh", "-10vh", "10vh"] }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        className="absolute bottom-0 right-[10%] w-[60vw] h-[60vw] rounded-full bg-indigo-600/10 blur-[120px]"
      />
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030305] text-white flex items-center justify-center relative">
        <AmbientBackground />
        <div className="relative z-10 animate-pulse flex flex-col items-center gap-6">
          <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin shadow-[0_0_30px_rgba(59,130,246,0.3)]"></div>
          <p className="text-blue-300 font-light tracking-widest uppercase">Accessing Archives...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#030305] text-slate-200 selection:bg-blue-500/30 font-sans pb-20">
      
      {/* PUT IT HERE: This guarantees the CSS loads immediately and permanently */}
      <style dangerouslySetInnerHTML={{
        __html: `
          /* Firefox Support */
          .transcript-scroll {
            scrollbar-width: thin;
            scrollbar-color: rgba(255, 255, 255, 0.25) transparent;
          }
          
          /* Chrome, Edge, Safari Support */
          .transcript-scroll::-webkit-scrollbar { 
            width: 8px; 
            display: block; /* Forces it to render */
          }
          .transcript-scroll::-webkit-scrollbar-track { 
            background: rgba(0, 0, 0, 0.2); /* Slight dark track to show boundaries */
            border-radius: 10px;
            margin-block: 10px; /* Adds padding to top and bottom of scrollbar */
          }
          .transcript-scroll::-webkit-scrollbar-thumb { 
            background: rgba(255, 255, 255, 0.25); 
            border-radius: 10px; 
            border: 2px solid transparent; /* Creates padding inside the track */
            background-clip: padding-box;
          }
          .transcript-scroll::-webkit-scrollbar-thumb:hover { 
            background: rgba(255, 255, 255, 0.4); 
          }
        `
      }} />

      <AmbientBackground />

      <div className="relative z-10 max-w-6xl mx-auto p-8 pt-16">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div>
            <h1 className="text-5xl font-black bg-gradient-to-br from-white via-blue-200 to-blue-600 bg-clip-text text-transparent mb-3 tracking-tight">
              Shadow Dossiers
            </h1>
            <p className="text-slate-400 text-lg font-light">Review your past evaluations and architectural deep-dives.</p>
          </div>
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white backdrop-blur-md bg-white/5 border border-white/10 px-6 py-3 rounded-full transition-all hover:bg-white/10 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]">
            <ArrowLeft className="w-4 h-4" /> Return to Terminal
          </Link>
        </div>

        {/* Empty State */}
        {history.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-32 backdrop-blur-2xl bg-white/[0.02] border border-white/5 rounded-[3rem] shadow-2xl">
            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/10 shadow-inner">
              <MessageSquare className="w-10 h-10 text-slate-500" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">No Archives Found</h2>
            <p className="text-slate-400 max-w-md mx-auto">Return to the main terminal and initiate a session with Shreya to generate your first report.</p>
          </motion.div>
        ) : (
          /* History List */
          <div className="space-y-6">
            {history.map((session, index) => {
              const radarData = session.feedback?.category_scores
                ? Object.keys(session.feedback.category_scores).map((key) => ({
                    subject: key,
                    A: session.feedback.category_scores[key],
                    fullMark: 10,
                  }))
                : [];

              const isExpanded = expandedId === session.id;

              return (
                <motion.div 
                  key={session.id}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
                  className="backdrop-blur-xl bg-white/[0.03] border border-white/10 rounded-[2rem] overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition-all"
                >
                  {/* Card Header (Clickable) */}
                  <div 
                    onClick={() => toggleExpand(session.id)}
                    className="p-6 md:p-8 flex flex-wrap items-center justify-between cursor-pointer hover:bg-white/[0.05] transition-colors group"
                  >
                    <div className="flex flex-wrap items-center gap-6 md:gap-12 w-full md:w-auto">
                      <div className="flex items-center gap-3 text-slate-300">
                        <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors">
                          <Calendar className="w-5 h-5 text-blue-400" />
                        </div>
                        <span className="font-medium tracking-wide">{session.date.split(" ")[0]}</span>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <Award className={`w-6 h-6 ${session.score >= 70 ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" : session.score >= 50 ? "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" : "text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.8)]"}`} />
                        <span className="font-black text-2xl text-white">{session.score}<span className="text-sm text-slate-500 font-medium">/100</span></span>
                      </div>
                      
                      <div className="px-4 py-1.5 backdrop-blur-md bg-white/5 border border-white/10 rounded-full text-sm font-bold text-slate-300 shadow-inner">
                        {session.verdict}
                      </div>
                    </div>
                    
                    <div className="w-full md:w-auto flex justify-end mt-4 md:mt-0">
                      <div className="p-2 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors">
                        {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="border-t border-white/[0.05] bg-black/20"
                      >
                        <div className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                          
                          {/* Left Col: Radar & Summary */}
                          <div className="space-y-6">
                            <div className="backdrop-blur-md bg-white/[0.02] border border-white/[0.05] p-6 rounded-3xl shadow-inner">
                              <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-blue-400" /> Executive Summary
                              </h4>
                              <p className="text-slate-300 text-sm leading-relaxed font-light">{session.feedback?.feedback_summary || "No summary generated."}</p>
                            </div>
                            
                            <div className="backdrop-blur-md bg-white/[0.02] rounded-3xl p-6 border border-white/[0.05] shadow-inner relative overflow-hidden">
                              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-[40px] rounded-full" />
                              <ResponsiveContainer width="100%" height={260}>
                                <RadarChart cx="50%" cy="50%" outerRadius="60%" data={radarData}>
                                  <PolarGrid stroke="rgba(255,255,255,0.05)" />
                                  
                                  {/* FIX 2: CUSTOM TICK TO FORCE WORD WRAPPING */}
                                  <PolarAngleAxis 
                                    dataKey="subject" 
                                    tick={(props: any) => {
                                      const { payload, x, y } = props;
                                      const words = payload.value.split(' '); // Split "Experience Match" into ["Experience", "Match"]
                                      
                                      return (
                                        <text x={x} y={y} textAnchor="middle" fill="#64748b" fontSize={11} fontWeight={600}>
                                          {words.map((word: string, index: number) => (
                                            <tspan x={x} dy={index === 0 ? 0 : 14} key={index}>
                                              {word}
                                            </tspan>
                                          ))}
                                        </text>
                                      );
                                    }} 
                                  />
                                  
                                  <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
                                  <Radar name="Score" dataKey="A" stroke="#38bdf8" strokeWidth={2} fill="url(#historyGradient)" fillOpacity={0.4} />
                                  <defs>
                                    <linearGradient id="historyGradient" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.8}/>
                                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                  </defs>
                                </RadarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          {/* Right Col: Transcript */}
                          <div className="lg:col-span-2 flex flex-col">
                            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2 ml-2">
                              <MessageSquare className="w-4 h-4 text-blue-400" /> Interview Transcript
                            </h4>
                            
                            {/* DELETED THE STYLE TAG FROM HERE */}

                            {/* Changed 'glass-scroll' to 'transcript-scroll' */}
                            <div className="transcript-scroll flex-1 backdrop-blur-md bg-black/40 rounded-3xl border border-white/[0.05] p-6 h-[450px] overflow-y-auto space-y-6 shadow-inner pr-4">
                              {session.chat_history?.map((msg, i) => (
                                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                  <div className={`max-w-[85%] p-5 text-[0.95rem] leading-relaxed shadow-lg relative group ${
                                    msg.role === "user" 
                                      ? "bg-gradient-to-br from-blue-600/90 to-indigo-600/90 text-white rounded-[1.5rem] rounded-br-sm border border-blue-500/20" 
                                      : "backdrop-blur-xl bg-white/[0.05] border border-white/10 text-slate-200 rounded-[1.5rem] rounded-tl-sm shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
                                  }`}>
                                    <span className={`block text-[0.65rem] font-black uppercase tracking-widest mb-2 ${msg.role === "user" ? "text-blue-200/70" : "text-emerald-400/70"}`}>
                                      {msg.role === "user" ? "You" : "Shreya"}
                                    </span>
                                    {msg.content}
                                  </div>
                                </div>
                              ))}
                            </div>

                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}