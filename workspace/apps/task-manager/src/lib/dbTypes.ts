export interface DBTask {
  id?: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed';
  dueDate?: string; // ISO string for IndexedDB storage
  createdAt: string; // ISO string for IndexedDB storage
  updatedAt: string; // ISO string for IndexedDB storage
  categoryId?: string;
  tags: string[];
  completedAt?: string; // ISO string for IndexedDB storage
  isArchived: boolean;
}

export interface DBCategory {
  id?: string;
  name: string;
  color: string;
  description?: string;
  createdAt: string; // ISO string for IndexedDB storage
  updatedAt: string; // ISO string for IndexedDB storage
}

export interface DBSettings {
  id: string;
  theme: 'light' | 'dark' | 'system';
  notifications: boolean;
  autoArchive: boolean;
  archiveDays: number;
  defaultCategory?: string;
  syncEnabled: boolean;
  lastCleanup?: string; // ISO string for IndexedDB storage
}

export interface DBSyncAction {
  id?: string;
  type: 'create' | 'update' | 'delete';
  entity: 'task' | 'category' | 'settings';
  entityId: string;
  data?: any;
  timestamp: string; // ISO string for IndexedDB storage
  status: 'pending' | 'completed' | 'failed';
  retryCount: number;
}

export interface TaskManagerDB {
  tasks: DBTask;
  categories: DBCategory;
  settings: DBSettings;
  syncActions: DBSyncAction;
}