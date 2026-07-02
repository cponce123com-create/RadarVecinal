import { useState } from "react";
import { ThumbsUp } from "lucide-react";

interface Props {
  reportId: string;
  initialCount: number;
  initialVoted?: boolean;
}

/**
 * VoteButton — Upvote/downvote toggle para reportes.
 * Inspirado en CivicPulse (community validation).
 */
export default function VoteButton({ reportId, initialCount, initialVoted = false }: Props) {
  const [voted, setVoted] = useState(initialVoted);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/${reportId}/vote`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setVoted(data.voted);
        setCount(data.confirmedCount);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
        voted
          ? "bg-primary/20 text-primary border border-primary/30"
          : "bg-white/5 text-muted-foreground border border-white/8 hover:border-white/20"
      } ${loading ? "opacity-50" : ""}`}
    >
      <ThumbsUp className={`w-3.5 h-3.5 ${voted ? "fill-primary" : ""}`} />
      {count > 0 && <span>{count}</span>}
      {count === 0 && <span className="text-[10px]">Votar</span>}
    </button>
  );
}
