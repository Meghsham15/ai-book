import type { ChatSource } from "@/types/domain"

export type ChatStreamEvent =
  | { type: "sources"; sources: ChatSource[] }
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; error: string }
