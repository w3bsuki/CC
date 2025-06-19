import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { UIState, SyncState } from './types';

interface UIStore extends UIState {
  // Theme actions
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleTheme: () => void;
  
  // Navigation actions
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setCurrentView: (view: 'list' | 'kanban' | 'calendar') => void;
  
  // Selection actions
  selectTask: (taskId: string) => void;
  deselectTask: (taskId: string) => void;
  selectAllTasks: (taskIds: string[]) => void;
  clearSelection: () => void;
  
  // Loading and error states
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

interface SyncStore extends SyncState {
  // Sync actions
  setLastSync: (date: Date) => void;
  setPendingActions: (count: number) => void;
  incrementPendingActions: () => void;
  decrementPendingActions: () => void;
  setOnlineStatus: (online: boolean) => void;
  setSyncInProgress: (inProgress: boolean) => void;
}

export const useUIStore = create<UIStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        theme: 'system',
        sidebarOpen: true,
        currentView: 'list',
        filter: {},
        sort: { field: 'dueDate', direction: 'asc' },
        selectedTasks: [],
        isLoading: false,
        error: null,

        // Theme actions
        setTheme: (theme) => set({ theme }),
        
        toggleTheme: () => {
          const currentTheme = get().theme;
          const newTheme = currentTheme === 'light' ? 'dark' : 'light';
          set({ theme: newTheme });
        },

        // Navigation actions
        setSidebarOpen: (open) => set({ sidebarOpen: open }),
        
        toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),
        
        setCurrentView: (view) => set({ currentView: view }),

        // Selection actions
        selectTask: (taskId) => {
          const selectedTasks = get().selectedTasks;
          if (!selectedTasks.includes(taskId)) {
            set({ selectedTasks: [...selectedTasks, taskId] });
          }
        },

        deselectTask: (taskId) => {
          set({
            selectedTasks: get().selectedTasks.filter((id) => id !== taskId),
          });
        },

        selectAllTasks: (taskIds) => set({ selectedTasks: taskIds }),
        
        clearSelection: () => set({ selectedTasks: [] }),

        // Loading and error states
        setLoading: (loading) => set({ isLoading: loading }),
        
        setError: (error) => set({ error }),
        
        clearError: () => set({ error: null }),
      }),
      {
        name: 'ui-storage',
        version: 1,
      }
    ),
    {
      name: 'ui-store',
    }
  )
);

export const useSyncStore = create<SyncStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        lastSync: null,
        pendingActions: 0,
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
        syncInProgress: false,

        // Sync actions
        setLastSync: (date) => set({ lastSync: date }),
        
        setPendingActions: (count) => set({ pendingActions: count }),
        
        incrementPendingActions: () => 
          set({ pendingActions: get().pendingActions + 1 }),
        
        decrementPendingActions: () => 
          set({ pendingActions: Math.max(0, get().pendingActions - 1) }),
        
        setOnlineStatus: (online) => set({ isOnline: online }),
        
        setSyncInProgress: (inProgress) => set({ syncInProgress: inProgress }),
      }),
      {
        name: 'sync-storage',
        version: 1,
      }
    ),
    {
      name: 'sync-store',
    }
  )
);