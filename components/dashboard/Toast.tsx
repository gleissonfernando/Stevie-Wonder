"use client";

import { CheckCircle2, Loader2, TriangleAlert, XCircle } from "lucide-react";
import type { ToastKind } from "@/lib/types";

type ToastProps = {
  kind: ToastKind;
  message: string;
};

const styles: Record<ToastKind, string> = {
  success: "border-panel-green/40 bg-panel-green/15 text-panel-text",
  error: "border-panel-red/40 bg-panel-red/15 text-panel-text",
  warning: "border-panel-yellow/40 bg-panel-yellow/15 text-panel-text",
  loading: "border-panel-blue/40 bg-panel-blue/15 text-panel-text"
};

export function Toast({ kind, message }: ToastProps) {
  const Icon = kind === "success" ? CheckCircle2 : kind === "error" ? XCircle : kind === "warning" ? TriangleAlert : Loader2;

  return (
    <div className={`fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-3 rounded-md border px-4 py-3 text-sm shadow-soft ${styles[kind]}`}>
      <Icon className={`h-5 w-5 shrink-0 ${kind === "loading" ? "animate-spin" : ""}`} />
      <span>{message}</span>
    </div>
  );
}
