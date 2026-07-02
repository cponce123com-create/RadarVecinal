import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Brain, CheckCircle, Trophy, Star, ChevronRight, AlertCircle, RotateCcw, Award, X, Sparkles } from "lucide-react";

interface Question {
  question: string;
  options: string[];
  correctIndex: number;
}

interface Topic {
  id: number;
  slug: string;
  title: string;
  summary: string;
  content: string;
  icon: string;
  difficulty: number;
  questions: Question[];
  xpReward: number;
}

const DIFFICULTY_META = ["Fácil", "Media", "Difícil", "Experto", "Maestro"];
const ACHIEVEMENTS = [
  { id: "first_quiz",  label: "Primer Quiz",          desc: "Completa tu primera lección",       icon: "🎓", xp: 50 },
  { id: "perfect",     label: "Perfect Score",        desc: "Saca 100% en cualquier quiz",       icon: "🌟", xp: 100 },
  { id: "scholar",     label: "Estudioso",            desc: "Completa 3 lecciones",              icon: "📚", xp: 200 },
  { id: "expert",      label: "Ciudadano Experto",    desc: "Completa todas las lecciones",      icon: "🏆", xp: 500 },
];

/** Inspirado en Civix — Civic Education module with gamification */
export default function CivicEducation() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [activeTopic, setActiveTopic] = useState<Topic | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [progress, setProgress] = useState<Record<number, { completed: boolean; score: number; xpEarned: number }>>({});
  const [loading, setLoading] = useState(true);

  // XP y logros desde localStorage (persistencia offline + API si logueado)
  const [totalXp, setTotalXp] = useState(() => parseInt(localStorage.getItem("civic_xp") || "0"));
  const [achievements, setAchievements] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("civic_achievements") || "[]"); } catch { return []; }
  });

  useEffect(() => {
    fetch("/api/civic-education/topics")
      .then(r => r.json())
      .then(d => setTopics(d.topics ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const startQuiz = (topic: Topic) => {
    setActiveTopic(topic);
    setCurrentQ(0);
    setAnswers([]);
    setShowResult(false);
  };

  const answer = (idx: number) => {
    if (!activeTopic) return;
    const newAnswers = [...answers, idx];
    setAnswers(newAnswers);

    if (newAnswers.length >= activeTopic.questions.length) {
      finishQuiz(activeTopic, newAnswers);
    } else {
      setCurrentQ(currentQ + 1);
    }
  };

  const finishQuiz = (topic: Topic, ans: number[]) => {
    const correct = ans.filter((a, i) => a === topic.questions[i]?.correctIndex).length;
    const score = Math.round((correct / topic.questions.length) * 100);
    const xpEarned = score >= 80 ? topic.xpReward : Math.round(topic.xpReward * 0.5);

    // Guardar en localStorage
    const newXp = totalXp + xpEarned;
    setTotalXp(newXp);
    localStorage.setItem("civic_xp", String(newXp));
    setProgress(p => ({ ...p, [topic.id]: { completed: true, score, xpEarned } }));

    // Achievements
    const newAchievements = [...achievements];
    if (!newAchievements.includes("first_quiz")) {
      newAchievements.push("first_quiz");
      localStorage.setItem("civic_achievements", JSON.stringify(newAchievements));
    }
    if (score === 100 && !newAchievements.includes("perfect")) {
      newAchievements.push("perfect");
      localStorage.setItem("civic_achievements", JSON.stringify(newAchievements));
    }
    const completedCount = Object.keys(progress).length + 1;
    if (completedCount >= 3 && !newAchievements.includes("scholar")) {
      newAchievements.push("scholar");
      localStorage.setItem("civic_achievements", JSON.stringify(newAchievements));
    }
    if (completedCount >= topics.length && !newAchievements.includes("expert")) {
      newAchievements.push("expert");
      localStorage.setItem("civic_achievements", JSON.stringify(newAchievements));
    }
    setAchievements(newAchievements);

    // Sync with API if logged in
    fetch("/api/civic-education/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicId: topic.id, completed: true, score, xpEarned }),
    }).catch(() => {});

    setShowResult(true);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-6 h-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col gap-5 max-w-3xl mx-auto pb-8">
      {/* Stats bar */}
      <div className="flex items-center gap-4 p-4 rounded-xl bg-card border border-white/5">
        <Trophy className="w-8 h-8 text-yellow-500" />
        <div className="flex-1">
          <p className="text-lg font-bold text-white">{totalXp} XP</p>
          <p className="text-xs text-muted-foreground">
            {achievements.length}/{ACHIEVEMENTS.length} logros desbloqueados
          </p>
        </div>
        <div className="flex gap-1">
          {ACHIEVEMENTS.filter(a => achievements.includes(a.id)).slice(0, 3).map(a => (
            <span key={a.id} className="text-lg" title={a.label}>{a.icon}</span>
          ))}
        </div>
      </div>

      {/* Quiz active */}
      {activeTopic && !showResult && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-card border border-white/5 overflow-hidden">
          <div className="p-4 border-b border-white/5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                <span className="text-sm font-bold text-white">{activeTopic.title}</span>
              </div>
              <button onClick={() => setActiveTopic(null)} className="text-muted-foreground hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex gap-1">
              {activeTopic.questions.map((_, i) => (
                <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < answers.length ? "bg-primary" : "bg-white/10"}`} />
              ))}
            </div>
          </div>
          <div className="p-5">
            <p className="text-xs text-muted-foreground mb-1">Pregunta {currentQ + 1} de {activeTopic.questions.length}</p>
            <p className="text-white font-semibold mb-4">{activeTopic.questions[currentQ]?.question}</p>
            <div className="flex flex-col gap-2">
              {activeTopic.questions[currentQ]?.options.map((opt, i) => (
                <button key={i} onClick={() => answer(i)}
                  className="w-full text-left p-3 rounded-xl bg-white/5 border border-white/8 hover:border-primary/50 hover:bg-primary/5 transition-all text-sm text-white">
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Quiz results */}
      <AnimatePresence>
        {showResult && activeTopic && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="rounded-xl bg-card border border-green-500/30 p-6 text-center">
            <Sparkles className="w-10 h-10 text-yellow-500 mx-auto mb-3" />
            <p className="text-xl font-bold text-white mb-1">¡Lección completada!</p>
            <p className="text-3xl font-bold text-primary mb-2">{progress[activeTopic.id]?.score}%</p>
            <p className="text-sm text-muted-foreground mb-4">+{progress[activeTopic.id]?.xpEarned} XP ganados</p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => { setShowResult(false); setActiveTopic(null); }}
                className="px-4 py-2 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-all">
                Volver
              </button>
              <button onClick={() => startQuiz(activeTopic)}
                className="px-4 py-2 rounded-xl bg-primary/20 border border-primary/40 text-primary text-sm font-bold hover:bg-primary/30 transition-all">
                <RotateCcw className="w-4 h-4 inline mr-1" /> Repetir
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Achievements */}
      {achievements.length > 0 && (
        <div className="p-4 rounded-xl bg-card border border-yellow-500/20">
          <p className="text-sm font-bold text-white mb-3 flex items-center gap-2"><Award className="w-4 h-4 text-yellow-500" /> Logros</p>
          <div className="flex flex-wrap gap-2">
            {ACHIEVEMENTS.filter(a => achievements.includes(a.id)).map(a => (
              <div key={a.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <span>{a.icon}</span>
                <span className="text-xs font-medium text-yellow-400">{a.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Topic list */}
      <div className="flex flex-col gap-2">
        {topics.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No hay lecciones disponibles</div>
        ) : topics.map((t, i) => {
          const done = progress[t.id];
          return (
            <motion.div key={t.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="p-4 rounded-xl bg-card border border-white/5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-white text-sm">{t.title}</p>
                  <span className="text-[10px] text-muted-foreground/60 px-1.5 py-0.5 rounded bg-white/5">
                    {DIFFICULTY_META[t.difficulty - 1] ?? "Fácil"}
                  </span>
                  {done?.completed && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground/70 mt-0.5">{t.summary}</p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                  {t.questions.length} preguntas · +{t.xpReward} XP · {done ? `${done.score}%` : "No completado"}
                </p>
              </div>
              <button onClick={() => startQuiz(t)}
                className="flex items-center gap-1 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/20 transition-all flex-shrink-0">
                {done?.completed ? "Repasar" : "Empezar"} <ChevronRight className="w-3 h-3" />
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
