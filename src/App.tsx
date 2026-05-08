import React, { useState, useRef, useEffect } from "react";
import { 
  Music, 
  Mic2, 
  Upload, 
  Youtube, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Download, 
  Settings2,
  ListMusic,
  Activity,
  Sliders,
  Sparkles,
  Info,
  Clock,
  Gauge,
  Music2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import WaveSurfer from "wavesurfer.js";
import { cn } from "./lib/utils";
import { AudioStem, VideoInfo } from "./types";
import { AudioEngine } from "./services/audioEngine";
import { analyzeTrack } from "./services/geminiService";

// --- Components ---

interface StemSliderProps {
  stem: AudioStem;
  onChange: (val: number) => void;
}

const StemSlider: React.FC<StemSliderProps> = ({ stem, onChange }) => {
  return (
    <div className="flex flex-col items-center gap-6 bg-white/5 border border-white/5 backdrop-blur-xl p-6 rounded-[32px] hover:bg-white/[0.08] transition-all group">
      {/* Visual Indicator */}
      <div className="flex flex-col items-center gap-1">
        <span 
          className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1"
          style={{ color: stem.color }}
        >
          {stem.name}
        </span>
        <div className="flex gap-1">
          <button className={cn(
            "w-7 h-7 rounded-lg text-[10px] font-bold flex items-center justify-center transition-colors",
            stem.isSolo ? "bg-purple-500 text-white shadow-lg shadow-purple-500/20" : "bg-white/5 text-white/30 hover:bg-white/10"
          )}>
            S
          </button>
          <button className={cn(
            "w-7 h-7 rounded-lg text-[10px] font-bold flex items-center justify-center transition-colors",
            stem.isMuted ? "bg-red-500 text-white shadow-lg shadow-red-500/20" : "bg-white/5 text-white/30 hover:bg-white/10"
          )}>
            M
          </button>
        </div>
      </div>

      {/* Fader Track */}
      <div className="relative h-64 w-12 bg-black/40 rounded-full border border-white/5 p-1.5 flex flex-col justify-end group">
        {/* Scale Lines */}
        <div className="absolute inset-x-0 bottom-[80%] h-[1px] bg-white/5 mx-2" />
        <div className="absolute inset-x-0 bottom-[60%] h-[1px] bg-white/5 mx-2" />
        <div className="absolute inset-x-0 bottom-[40%] h-[1px] bg-white/5 mx-2" />
        <div className="absolute inset-x-0 bottom-[20%] h-[1px] bg-white/5 mx-2" />
        
        {/* Fill */}
        <div 
          className="absolute bottom-1.5 left-1.5 right-1.5 rounded-full bg-gradient-to-t opacity-20 pointer-events-none"
          style={{ 
            height: `calc(${stem.volume * 100}% - 12px)`,
            backgroundImage: `linear-gradient(to top, ${stem.color}, transparent)`
          }}
        />

        {/* Input */}
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={stem.volume}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 opacity-0 cursor-pointer z-10"
          style={{ writingMode: 'bt-lr' } as any}
        />

        {/* Knob */}
        <div 
          className="w-9 h-9 bg-white rounded-full shadow-2xl flex items-center justify-center transition-transform active:scale-95 z-0 relative pointer-events-none"
          style={{ marginBottom: `${stem.volume * (256 - 36 - 12)}px` }}
        >
          <div className="w-1 h-4 bg-gray-200 rounded-full" />
        </div>
      </div>
      
      <div className="font-mono text-[11px] text-white/40 tracking-wider">
        {Math.round(stem.volume * 100)}%
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState<"upload" | "studio">("upload");
  const [videoUrl, setVideoUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [trackAnalysis, setTrackAnalysis] = useState<any>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Stems State
  const [stems, setStems] = useState<AudioStem[]>([
    { id: "vocals", name: "VOCAL", color: "#A855F7", volume: 1, buffer: null, isActive: true },
    { id: "music", name: "INST", color: "#3B82F6", volume: 1, buffer: null, isActive: true },
  ]);

  const wavesurferRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const audioEngine = useRef<AudioEngine | null>(null);

  useEffect(() => {
    audioEngine.current = new AudioEngine();
    return () => audioEngine.current?.stop();
  }, []);

  useEffect(() => {
    if (wavesurferRef.current && audioUrl) {
      if (wavesurfer.current) wavesurfer.current.destroy();
      
      wavesurfer.current = WaveSurfer.create({
        container: wavesurferRef.current,
        waveColor: "rgba(255, 255, 255, 0.05)",
        progressColor: "rgba(96, 165, 250, 0.3)",
        cursorColor: "rgba(255, 255, 255, 0.2)",
        barWidth: 2,
        barRadius: 4,
        height: 60,
        normalize: true,
      });

      wavesurfer.current.load(audioUrl);
    }
  }, [audioUrl]);

  const handlePlayPause = async () => {
    if (!audioUrl) return;
    
    if (!isPlaying) {
      setIsProcessing(true);
      const buffer = await audioEngine.current!.loadAudio(audioUrl);
      audioEngine.current!.process(buffer);
      wavesurfer.current?.play();
      setIsPlaying(true);
      setIsProcessing(false);
    } else {
      audioEngine.current!.stop();
      wavesurfer.current?.pause();
      setIsPlaying(false);
    }
  };

  const handleYoutubeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrl) return;

    setIsLoading(true);
    try {
      const infoRes = await fetch(`/api/youtube-info?url=${encodeURIComponent(videoUrl)}`);
      const infoData = await infoRes.json();
      
      if (infoData.error) throw new Error(infoData.error);
      
      setVideoInfo(infoData);
      setAudioUrl(`/api/youtube?url=${encodeURIComponent(videoUrl)}`);
      setActiveTab("studio");
      
      // AI Analysis
      analyzeTrack(infoData.title, infoData.author).then(setTrackAnalysis);
    } catch (err: any) {
      alert("Error loading YouTube video: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      setVideoInfo({
        title: file.name,
        author: "Local File",
        thumbnail: "",
        duration: "0"
      });
      setActiveTab("studio");
      setTrackAnalysis(null);
    }
  };

  // Sync volumes
  useEffect(() => {
    if (audioEngine.current) {
      audioEngine.current.setVocalVolume(stems.find(s => s.id === "vocals")?.volume || 0);
      audioEngine.current.setMusicVolume(stems.find(s => s.id === "music")?.volume || 0);
    }
  }, [stems]);

  return (
    <div className="h-screen flex flex-col relative overflow-hidden">
      {/* Immersive Background */}
      <div className="atmospheric-bg">
        <div className="aurora-1" />
        <div className="aurora-2" />
      </div>

      {/* Header */}
      <header className="h-24 bg-black/40 backdrop-blur-xl border-b border-white/5 px-10 flex items-center justify-between shrink-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Music size={28} className="text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold tracking-tighter text-white uppercase italic">
              STEM<span className="text-purple-400">PHONIC</span>
            </h1>
            <span className="text-[9px] uppercase tracking-[0.4em] font-bold text-white/20 -mt-1">Neural Studio v1.0</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setActiveTab("upload")}
            className={cn(
              "px-6 py-2.5 rounded-full text-sm font-bold transition-all",
              activeTab === "upload" ? "bg-white/10 text-white" : "text-white/40 hover:text-white"
            )}
          >
            New Project
          </button>
          <button className="px-8 py-2.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-bold shadow-xl shadow-purple-500/20 active:scale-95 transition-transform">
            Export Mix
          </button>
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 overflow-y-auto px-10 py-10 z-10">
        <AnimatePresence mode="wait">
          {activeTab === "upload" ? (
            <motion.div 
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="min-h-full flex flex-col items-center justify-center max-w-5xl mx-auto w-full"
            >
              <div className="flex flex-col items-center text-center mb-16">
                <h2 className="text-5xl font-extrabold mb-6 tracking-tighter uppercase italic text-white">Import Waveform</h2>
                <p className="text-gray-400 text-lg max-w-xl">Deep-neural separation extracts vocals and music with precision. Paste a link or upload a file to begin.</p>
              </div>

              <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-10">
                {/* Upload Card */}
                <div className="relative group">
                  <label className="relative flex flex-col items-center justify-center p-12 h-[420px] rounded-[56px] border border-white/5 bg-black/40 backdrop-blur-xl hover:bg-black/60 hover:border-purple-500/30 transition-all cursor-pointer overflow-hidden">
                    <input type="file" className="hidden" accept="audio/*" onChange={handleFileUpload} />
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none" />
                    <div className="w-24 h-24 rounded-[32px] bg-purple-500/10 flex items-center justify-center mb-8 text-purple-400 group-hover:scale-110 transition-transform shadow-2xl">
                      <Upload size={40} />
                    </div>
                    <h3 className="text-2xl font-bold mb-3 italic uppercase">Local Library</h3>
                    <p className="text-gray-400 text-center">MP3, WAV, FLAC, AIFF</p>
                  </label>
                </div>

                {/* YouTube Card */}
                <div className="relative group">
                  <div className="relative flex flex-col items-center justify-center p-12 h-[420px] rounded-[56px] border border-white/5 bg-black/40 backdrop-blur-xl hover:bg-black/60 hover:border-blue-500/30 transition-all overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none" />
                    <div className="w-24 h-24 rounded-[32px] bg-blue-500/10 flex items-center justify-center mb-8 text-blue-500 group-hover:scale-110 transition-transform shadow-2xl">
                      <Youtube size={40} />
                    </div>
                    <h3 className="text-2xl font-bold mb-6 italic uppercase underline decoration-blue-500/50 decoration-4 underline-offset-8">Cloud Stream</h3>
                    <form onSubmit={handleYoutubeSubmit} className="w-full flex flex-col gap-4">
                      <input 
                        type="url" 
                        placeholder="Paste YouTube Link"
                        className="w-full px-6 py-5 rounded-3xl bg-white/5 border border-white/5 focus:outline-none focus:border-blue-500/50 text-base placeholder:text-gray-600 transition-all"
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                      />
                      <button 
                        disabled={isLoading || !videoUrl}
                        className="w-full py-5 rounded-3xl bg-white text-black font-extrabold text-sm hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-2xl active:scale-[0.98]"
                      >
                        {isLoading ? "ENGINE WARMING..." : "FETCH WAVEFORM"}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="studio"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="flex flex-col gap-8 max-w-screen-2xl mx-auto w-full h-full"
            >
              <div className="grid grid-cols-12 gap-8 items-start">
                {/* Waveform View */}
                <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
                  <div className="flex justify-between items-end">
                    <div>
                      <h2 className="text-3xl font-bold text-white uppercase italic tracking-tighter mb-1 truncate max-w-xl">{videoInfo?.title}</h2>
                      <div className="flex items-center gap-4 text-xs font-mono text-gray-500 uppercase tracking-widest">
                        <span>{videoInfo?.author}</span>
                        <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                        <span>Source: YouTube</span>
                        <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                        <span>48kHz Stereo</span>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-purple-400">A.I. Splitting Active</span>
                      <div className="h-1 w-24 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full w-full bg-purple-500 animate-pulse" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-black/60 backdrop-blur-2xl rounded-[40px] border border-white/5 p-8 flex flex-col gap-6">
                     {/* Multitrack Waveform Sim */}
                     <div className="space-y-4">
                        {stems.map((stem, i) => (
                          <div key={stem.id} className="relative h-24 bg-white/[0.02] rounded-3xl overflow-hidden group border border-white/[0.02]">
                             <div className="absolute left-6 top-4 z-10 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stem.color }} />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">{stem.name}</span>
                             </div>
                             
                             <div className="h-full w-full flex items-center gap-1 px-8 opacity-40">
                                {[...Array(64)].map((_, j) => {
                                  const h = Math.sin(j * 0.2 + i) * 30 + 50 + Math.random() * 20;
                                  return (
                                    <div 
                                      key={j} 
                                      className="flex-1 rounded-full transition-all group-hover:opacity-100"
                                      style={{ 
                                        height: `${h}%`, 
                                        backgroundColor: stem.color,
                                        opacity: isPlaying ? 0.8 : 0.4
                                      }}
                                    />
                                  );
                                })}
                             </div>
                             
                             {/* Playhead Indicator */}
                             <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent pointer-events-none" />
                          </div>
                        ))}
                     </div>

                     {/* Scrub bar */}
                     <div className="relative pt-6">
                        <div className="w-full h-[1px] bg-white/10" />
                        <div className="absolute left-1/3 top-0 h-full w-[2px] bg-white shadow-[0_0_20px_rgba(255,255,255,0.6)] z-20">
                          <div className="absolute -top-1 -left-[5px] w-3 h-3 bg-white rotate-45" />
                        </div>
                        <div className="flex justify-between mt-4 text-[10px] font-mono text-gray-500 uppercase tracking-widest">
                           <span>00:00:00</span>
                           <span className="text-white/40">In Progress</span>
                           <span>{videoInfo?.duration}s</span>
                        </div>
                     </div>
                  </div>
                </div>

                {/* Mixing Console */}
                <div className="col-span-12 lg:col-span-4 bg-black/60 backdrop-blur-2xl rounded-[40px] border border-white/5 p-8 flex flex-col h-full">
                  <h3 className="text-sm font-bold uppercase tracking-[0.25em] mb-12 text-gray-500 italic">Mixing Console</h3>
                  
                  <div className="flex-1 flex justify-around gap-4 min-h-[400px]">
                    {stems.map(stem => (
                      <StemSlider 
                        key={stem.id} 
                        stem={stem} 
                        onChange={(val) => {
                          setStems(prev => prev.map(s => s.id === stem.id ? { ...s, volume: val } : s));
                        }} 
                      />
                    ))}
                    
                    {/* Locked Stems */}
                    {["BASS", "DRUM"].map(name => (
                       <div key={name} className="flex flex-col items-center gap-6 bg-white/[0.01] border border-white/[0.01] border-dashed p-6 rounded-[32px] opacity-20 grayscale">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-white/50">{name}</span>
                          <div className="flex-1 w-12 bg-black/20 rounded-full border border-white/5 flex flex-col justify-end p-1">
                             <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                                <Settings2 size={16} />
                             </div>
                          </div>
                          <span className="text-[9px] font-bold text-blue-500 bg-blue-500/10 px-2 py-1 rounded">PRO</span>
                       </div>
                    ))}
                  </div>

                  {/* Master Meter */}
                  <div className="mt-12 flex flex-col gap-2">
                    <div className="flex justify-between text-[8px] font-mono font-bold text-gray-600 uppercase tracking-tighter px-1">
                       <span>-∞</span><span>-36</span><span>-24</span><span>-12</span><span>-6</span><span className="text-red-500">0</span>
                    </div>
                    <div className="space-y-1.5">
                       <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden">
                          <motion.div 
                            animate={{ width: isPlaying ? ["72%", "85%", "78%", "82%"] : "0%" }}
                            transition={{ repeat: Infinity, duration: 0.2 }}
                            className="h-full bg-gradient-to-r from-emerald-500 via-yellow-400 to-red-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" 
                          />
                       </div>
                       <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden">
                          <motion.div 
                           animate={{ width: isPlaying ? ["68%", "81%", "74%", "79%"] : "0%" }}
                           transition={{ repeat: Infinity, duration: 0.2, delay: 0.05 }}
                           className="h-full bg-gradient-to-r from-emerald-500 via-yellow-400 to-red-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" 
                          />
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Player */}
      <footer className="h-28 bg-black/80 backdrop-blur-3xl border-t border-white/10 px-12 flex items-center justify-between shrink-0 z-50">
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-6">
            <button className="text-gray-500 hover:text-white transition-colors"><Info size={20} /></button>
            <div className="w-16 h-16 rounded-2xl bg-white text-black flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 transition-all cursor-pointer" onClick={handlePlayPause}>
              {isProcessing ? <Activity size={28} className="animate-spin" /> : isPlaying ? <Pause fill="black" size={28} /> : <Play fill="black" size={28} className="ml-1.5" />}
            </div>
            <button className="text-gray-500 hover:text-white transition-colors" onClick={() => wavesurfer.current?.stop()}><VolumeX size={20} /></button>
          </div>
          
          <div className="h-10 w-[1px] bg-white/10" />
          
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white">Live Monitor On</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                 <div className="h-full w-1/3 bg-purple-500 rounded-full shadow-[0_0_10px_#a855f7]" />
              </div>
              <span className="text-[9px] font-mono text-gray-500">ENGINE LOAD 32%</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end">
           <span className="text-4xl font-light font-mono text-white tracking-widest tabular-nums leading-none">
             00:00.<span className="text-gray-600">00</span>
           </span>
           <span className="text-[9px] font-bold text-gray-600 uppercase tracking-[0.4em] mt-1">Timeline SMPTE</span>
        </div>
      </footer>
      {/* Global CSS */}
      <style>{`
        .vertical-slider {
          -webkit-appearance: slider-vertical;
          width: 8px;
          height: 100%;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 28px;
          width: 28px;
          border-radius: 50%;
          background: #ffffff;
          box-shadow: 0 4px 20px rgba(0,0,0,0.8);
          cursor: pointer;
          border: 4px solid #000;
          transition: transform 0.2s;
        }
        input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.1);
        }
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        .animate-scan {
          animation: scan 3s linear infinite;
        }
      `}</style>
    </div>
  );
}
