import { create } from 'zustand';

interface User {
    uid: string;
    name: string;
    fcmToken: string;
}

interface RallyState {
    user: User | null;
    groups: any[];
    activeCall: any | null;
    setUser: (user: User | null) => void;
    setGroups: (groups: any[]) => void;
    setActiveCall: (call: any | null) => void;
}

export const useStore = create<RallyState>((set) => ({
    user: null,
    groups: [],
    activeCall: null,
    setUser: (user) => set({ user }),
    setGroups: (groups) => set({ groups }),
    setActiveCall: (call) => set({ activeCall: call }),
}));
