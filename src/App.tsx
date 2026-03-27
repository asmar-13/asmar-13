import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Mic, Square, Loader2, Copy, Check, Trash2, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export default function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState<string>('');
  const [history, setHistory] = useState<{ text: string; timestamp: Date }[]>([]);
  const [copied, setCopied] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Timer for recording
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingTime(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        await processAudio(audioBlob);
        // Stop all tracks to release the microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone access denied or not available.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (blob: Blob) => {
    setIsProcessing(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [
            {
              parts: [
                { text: "Transcribe this audio accurately. Only return the transcribed text, nothing else." },
                {
                  inlineData: {
                    mimeType: "audio/wav",
                    data: base64Data
                  }
                }
              ]
            }
          ]
        });

        const text = response.text || "No speech detected.";
        setTranscription(text);
        setHistory(prev => [{ text, timestamp: new Date() }, ...prev]);
      };
    } catch (err) {
      console.error("Transcription error:", err);
      setTranscription("Error processing audio. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(transcription);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clearHistory = () => {
    setHistory([]);
    setTranscription('');
  };

  return (
    <div className="min-h-screen bg-[#E6E6E6] flex items-center justify-center p-4 font-mono">
      <div className="w-full max-w-md bg-[#151619] rounded-2xl shadow-2xl overflow-hidden border border-[#2A2B2F] flex flex-col h-[600px]">
        
        {/* Header / Hardware Panel */}
        <div className="p-6 border-bottom border-[#2A2B2F] bg-[#1A1B1E]">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#FF4444] animate-pulse" />
              <span className="text-[10px] uppercase tracking-widest text-[#8E9299]">EchoTranscribe v1.0</span>
            </div>
            <div className="text-[#8E9299] text-[10px] uppercase tracking-widest">Signal: Active</div>
          </div>
          
          {/* Main Display */}
          <div className="bg-[#0A0B0D] rounded-lg p-4 border border-[#2A2B2F] h-32 flex flex-col justify-center items-center relative overflow-hidden">
            <div className="absolute top-2 left-2 text-[9px] text-[#444] uppercase">Monitor</div>
            
            <AnimatePresence mode="wait">
              {isRecording ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center"
                >
                  <div className="text-3xl text-[#FF4444] font-bold tracking-tighter mb-1">
                    {formatTime(recordingTime)}
                  </div>
                  <div className="text-[10px] text-[#FF4444] uppercase tracking-widest animate-pulse">Recording...</div>
                </motion.div>
              ) : isProcessing ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center"
                >
                  <Loader2 className="w-8 h-8 text-[#00FF00] animate-spin mb-2" />
                  <div className="text-[10px] text-[#00FF00] uppercase tracking-widest">Processing Signal</div>
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center"
                >
                  <Volume2 className="w-8 h-8 text-[#8E9299] mb-2 opacity-20" />
                  <div className="text-[10px] text-[#444] uppercase tracking-widest">System Ready</div>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Visualizer Mock */}
            <div className="absolute bottom-0 left-0 w-full h-1 flex items-end gap-[1px] px-1">
              {[...Array(40)].map((_, i) => (
                <div 
                  key={i} 
                  className={`flex-1 bg-[#2A2B2F] transition-all duration-100 ${isRecording ? 'bg-[#FF4444]' : ''}`}
                  style={{ height: isRecording ? `${Math.random() * 100}%` : '2px' }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="p-6 flex justify-center gap-6 bg-[#1A1B1E]">
          {!isRecording ? (
            <button 
              onClick={startRecording}
              disabled={isProcessing}
              className="group relative w-16 h-16 rounded-full bg-[#2A2B2F] flex items-center justify-center transition-all hover:bg-[#3A3B3F] active:scale-95 disabled:opacity-50"
            >
              <div className="absolute inset-0 rounded-full border border-dashed border-[#444] group-hover:rotate-45 transition-transform duration-500" />
              <Mic className="w-6 h-6 text-[#FFFFFF]" />
            </button>
          ) : (
            <button 
              onClick={stopRecording}
              className="group relative w-16 h-16 rounded-full bg-[#FF4444] flex items-center justify-center transition-all hover:bg-[#FF5555] active:scale-95 shadow-[0_0_20px_rgba(255,68,68,0.3)]"
            >
              <div className="absolute inset-0 rounded-full border border-dashed border-white/30 animate-spin-slow" />
              <Square className="w-6 h-6 text-[#FFFFFF] fill-current" />
            </button>
          )}
        </div>

        {/* Output / History */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#151619] custom-scrollbar">
          <div className="flex justify-between items-center sticky top-0 bg-[#151619] py-2 z-10">
            <h3 className="text-[10px] text-[#8E9299] uppercase tracking-widest">Transcription Log</h3>
            <div className="flex gap-2">
              {transcription && (
                <button 
                  onClick={copyToClipboard}
                  className="p-1.5 rounded hover:bg-[#2A2B2F] text-[#8E9299] transition-colors"
                  title="Copy to clipboard"
                >
                  {copied ? <Check className="w-3 h-3 text-[#00FF00]" /> : <Copy className="w-3 h-3" />}
                </button>
              )}
              <button 
                onClick={clearHistory}
                className="p-1.5 rounded hover:bg-[#2A2B2F] text-[#8E9299] transition-colors"
                title="Clear history"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          <AnimatePresence>
            {history.length === 0 && !isProcessing && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full flex items-center justify-center text-[#444] text-[11px] italic"
              >
                No signals detected yet...
              </motion.div>
            )}

            {history.map((item, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-4 rounded-lg bg-[#1A1B1E] border border-[#2A2B2F] group"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[9px] text-[#444] font-bold">
                    {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <div className="w-1 h-1 rounded-full bg-[#00FF00] opacity-50" />
                </div>
                <p className="text-[#FFFFFF] text-sm leading-relaxed selection:bg-[#00FF00] selection:text-black">
                  {item.text}
                </p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #2A2B2F;
          border-radius: 10px;
        }
        .animate-spin-slow {
          animation: spin 8s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
