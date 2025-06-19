export const PRIORITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;

export const TASK_STATUSES = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
} as const;

export const PRIORITY_COLORS = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#ef4444',
} as const;

export const STATUS_COLORS = {
  pending: '#6b7280',
  in_progress: '#3b82f6',
  completed: '#10b981',
} as const;

export const PRIORITY_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
} as const;

export const STATUS_LABELS = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
} as const;

export const DEFAULT_CATEGORIES = [
  {
    id: 'personal',
    name: 'Personal',
    color: '#3b82f6',
    description: 'Personal tasks and activities',
  },
  {
    id: 'work',
    name: 'Work',
    color: '#ef4444',
    description: 'Work-related tasks and projects',
  },
  {
    id: 'health',
    name: 'Health',
    color: '#10b981',
    description: 'Health and fitness related tasks',
  },
] as const;

export const STORAGE_KEYS = {
  TASKS: 'task-storage',
  UI: 'ui-storage',
  SYNC: 'sync-storage',
} as const;

export const DB_CONFIG = {
  NAME: 'TaskManagerDB',
  VERSION: 1,
  STORES: {
    TASKS: 'tasks',
    CATEGORIES: 'categories',
    SETTINGS: 'settings',
    SYNC_ACTIONS: 'syncActions',
  },
} as const;

export const SYNC_CONFIG = {
  MAX_RETRY_COUNT: 3,
  RETRY_DELAY: 1000, // 1 second
  BATCH_SIZE: 50,
  OFFLINE_QUEUE_LIMIT: 1000,
} as const;

export const UI_CONFIG = {
  TASKS_PER_PAGE: 20,
  DEBOUNCE_DELAY: 300,
  ANIMATION_DURATION: 200,
  MOBILE_BREAKPOINT: 768,
} as const;

export const DATE_FORMATS = {
  DISPLAY: 'MMM dd, yyyy',
  DISPLAY_WITH_TIME: 'MMM dd, yyyy HH:mm',
  ISO: "yyyy-MM-dd'T'HH:mm:ss.SSSxxx",
  DATE_ONLY: 'yyyy-MM-dd',
} as const;

export const VALIDATION_RULES = {
  TASK_TITLE_MIN_LENGTH: 1,
  TASK_TITLE_MAX_LENGTH: 200,
  TASK_DESCRIPTION_MAX_LENGTH: 1000,
  CATEGORY_NAME_MIN_LENGTH: 1,
  CATEGORY_NAME_MAX_LENGTH: 50,
  CATEGORY_DESCRIPTION_MAX_LENGTH: 200,
  TAG_MIN_LENGTH: 1,
  TAG_MAX_LENGTH: 30,
  MAX_TAGS_PER_TASK: 10,
} as const;

export const ERROR_MESSAGES = {
  TASK_TITLE_REQUIRED: 'Task title is required',
  TASK_TITLE_TOO_LONG: `Task title cannot exceed ${VALIDATION_RULES.TASK_TITLE_MAX_LENGTH} characters`,
  TASK_DESCRIPTION_TOO_LONG: `Task description cannot exceed ${VALIDATION_RULES.TASK_DESCRIPTION_MAX_LENGTH} characters`,
  CATEGORY_NAME_REQUIRED: 'Category name is required',
  CATEGORY_NAME_TOO_LONG: `Category name cannot exceed ${VALIDATION_RULES.CATEGORY_NAME_MAX_LENGTH} characters`,
  INVALID_DATE: 'Invalid date format',
  INVALID_PRIORITY: 'Invalid priority level',
  INVALID_STATUS: 'Invalid task status',
  DATABASE_ERROR: 'Database operation failed',
  NETWORK_ERROR: 'Network connection failed',
  SYNC_ERROR: 'Synchronization failed',
} as const;

export const SUCCESS_MESSAGES = {
  TASK_CREATED: 'Task created successfully',
  TASK_UPDATED: 'Task updated successfully',
  TASK_DELETED: 'Task deleted successfully',
  TASK_COMPLETED: 'Task marked as completed',
  CATEGORY_CREATED: 'Category created successfully',
  CATEGORY_UPDATED: 'Category updated successfully',
  CATEGORY_DELETED: 'Category deleted successfully',
  SETTINGS_SAVED: 'Settings saved successfully',
  DATA_EXPORTED: 'Data exported successfully',
  DATA_IMPORTED: 'Data imported successfully',
} as const;