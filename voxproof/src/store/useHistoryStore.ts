import { create } from "zustand";
import { AnalysisResult, VerdictType } from "@/lib/api/types";
import { generateMockResult } from "@/lib/api/mockAdapter";

interface HistoryState {
  items: AnalysisResult[];
  filter: "all" | VerdictType;
  searchQuery: string;
  viewMode: "list" | "grid";
  sortBy: "date" | "score" | "duration";
  sortOrder: "asc" | "desc";

  addItem: (item: AnalysisResult) => void;
  deleteItem: (id: string) => void;
  clearHistory: () => void;
  setFilter: (filter: "all" | VerdictType) => void;
  setSearchQuery: (query: string) => void;
  setViewMode: (mode: "list" | "grid") => void;
  setSortBy: (sort: HistoryState["sortBy"]) => void;
  toggleSortOrder: () => void;
}

// Initial seed analyses for rich UX presentation out of the box
const initialItems: AnalysisResult[] = [
  generateMockResult("ceo_voice_authorization_call.wav", 1024 * 512),
  generateMockResult("customer_support_verification_sample.mp3", 1024 * 320),
  generateMockResult("podcast_interview_bonafide_host.flac", 1024 * 1200),
  generateMockResult("telephony_ivr_spoofed_attack_01.wav", 1024 * 280),
  generateMockResult("banking_onboarding_biometric_clip.wav", 1024 * 440),
];

export const useHistoryStore = create<HistoryState>((set) => ({
  items: initialItems,
  filter: "all",
  searchQuery: "",
  viewMode: "list",
  sortBy: "date",
  sortOrder: "desc",

  addItem: (item) =>
    set((state) => ({
      items: [item, ...state.items.filter((i) => i.id !== item.id)],
    })),

  deleteItem: (id) =>
    set((state) => ({
      items: state.items.filter((i) => i.id !== id),
    })),

  clearHistory: () => set({ items: [] }),

  setFilter: (filter) => set({ filter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setViewMode: (viewMode) => set({ viewMode }),
  setSortBy: (sortBy) => set({ sortBy }),
  toggleSortOrder: () =>
    set((state) => ({
      sortOrder: state.sortOrder === "asc" ? "desc" : "asc",
    })),
}));
