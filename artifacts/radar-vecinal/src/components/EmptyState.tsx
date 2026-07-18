/**
 * EmptyState — Estado vacío reutilizable, amigable y consistente.
 *
 * En vez de una lista en blanco, explica en lenguaje sencillo qué es esta
 * sección y (opcionalmente) ofrece una acción para empezar.
 */
import { Link } from "wouter";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  message: string;
  /** Acción opcional: enlace interno (href) o botón (onClick). */
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  children?: ReactNode;
  tone?: "neutral" | "positive";
}

export default function EmptyState({
  icon: Icon, title, message, actionLabel, actionHref, onAction, children, tone = "neutral",
}: EmptyStateProps) {
  const ring = tone === "positive" ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400" : "bg-white/[0.04] border-white/10 text-muted-foreground";
  const action = actionLabel && (
    <span className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary/15 border border-primary/40 text-primary text-sm font-semibold hover:bg-primary/25 transition-colors cursor-pointer">
      {actionLabel}
    </span>
  );

  return (
    <div className="flex flex-col items-center text-center gap-3 py-12 px-6">
      <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center ${ring}`}>
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-[15px] font-semibold text-white">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">{message}</p>
      {actionLabel && (
        actionHref ? <Link href={actionHref}>{action}</Link> : <button onClick={onAction}>{action}</button>
      )}
      {children}
    </div>
  );
}
