/**
 * store/index.ts
 *
 * Estado global de la app con Zustand.
 * Dividido en slices lógicos: auth, session, earbuds.
 */

import { create } from 'zustand';
import { UserProfile, EarbudProfile, EarbudSide, TranscriptLine, SessionStatus, LanguageCode } from '@/types';
import { DEFAULT_EARBUD_PROFILE } from '@/constants/languages';

// ─── Auth slice ───────────────────────────────────────────────────
interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  setUser: (user: UserProfile | null, token: string | null) => void;
  setLoading: (v: boolean) => void;
}

// ─── Session slice ────────────────────────────────────────────────
interface SessionState {
  status: SessionStatus;
  transcript: TranscriptLine[];
  currentSessionId: string | null;
  setStatus: (s: SessionStatus) => void;
  addLine: (line: TranscriptLine) => void;
  clearTranscript: () => void;
  startSession: (id: string) => void;
  endSession: () => void;
}

// ─── Earbud slice ─────────────────────────────────────────────────
interface EarbudState {
  profileA: EarbudProfile;
  profileB: EarbudProfile;
  updateProfile: (side: EarbudSide, patch: Partial<EarbudProfile>) => void;
}

// ─── Store completo ───────────────────────────────────────────────
interface AppStore extends AuthState, SessionState, EarbudState {}

const defaultProfileA: EarbudProfile = {
  ...DEFAULT_EARBUD_PROFILE,
  side: 'A',
  inputLang: 'ES',
  outputLang: 'EN',
};

const defaultProfileB: EarbudProfile = {
  ...DEFAULT_EARBUD_PROFILE,
  side: 'B',
  inputLang: 'EN',
  outputLang: 'ES',
};

export const useStore = create<AppStore>((set) => ({
  // Auth
  user: null,
  token: null,
  isLoading: true,
  setUser: (user, token) => set({ user, token }),
  setLoading: (isLoading) => set({ isLoading }),

  // Session
  status: 'idle',
  transcript: [],
  currentSessionId: null,
  setStatus: (status) => set({ status }),
  addLine: (line) =>
    set((state) => ({
      transcript: [...state.transcript.slice(-199), line], // máx 200 líneas en memoria
    })),
  clearTranscript: () => set({ transcript: [] }),
  startSession: (id) =>
    set({ currentSessionId: id, status: 'active', transcript: [] }),
  endSession: () =>
    set({ currentSessionId: null, status: 'idle' }),

  // Earbuds
  profileA: defaultProfileA,
  profileB: defaultProfileB,
  updateProfile: (side, patch) =>
    set((state) =>
      side === 'A'
        ? { profileA: { ...state.profileA, ...patch } }
        : { profileB: { ...state.profileB, ...patch } },
    ),
}));

// Selectores derivados (evitan re-renders innecesarios)
export const selectUser = (s: AppStore) => s.user;
export const selectToken = (s: AppStore) => s.token;
export const selectIsAuthenticated = (s: AppStore) => s.user !== null;
export const selectStatus = (s: AppStore) => s.status;
export const selectTranscript = (s: AppStore) => s.transcript;
export const selectProfileA = (s: AppStore) => s.profileA;
export const selectProfileB = (s: AppStore) => s.profileB;
