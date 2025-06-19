export type Priority = 'low' | 'medium' | 'high';

export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  status: TaskStatus;
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  categoryId?: string;
  tags: string[];
  completedAt?: Date;
  isArchived: boolean;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskFilter {
  status?: TaskStatus[];
  priority?: Priority[];
  categoryId?: string;
  tags?: string[];
  search?: string;
  dueDateRange?: {
    start?: Date;
    end?: Date;
  };
  isArchived?: boolean;
}

export interface TaskSort {
  field: 'title' | 'dueDate' | 'priority' | 'status' | 'createdAt' | 'updatedAt';
  direction: 'asc' | 'desc';
}

export interface UIState {
  theme: 'light' | 'dark' | 'system';
  sidebarOpen: boolean;
  currentView: 'list' | 'kanban' | 'calendar';
  filter: TaskFilter;
  sort: TaskSort;
  selectedTasks: string[];
  isLoading: boolean;
  error: string | null;
}

export interface SyncState {
  lastSync: Date | null;
  pendingActions: number;
  isOnline: boolean;
  syncInProgress: boolean;
}