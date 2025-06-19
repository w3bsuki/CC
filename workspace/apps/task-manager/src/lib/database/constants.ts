// Database configuration constants
export const DATABASE_CONFIG = {
  NAME: 'TaskManagerDB',
  VERSION: 1,
  TIMEOUT: 10000, // 10 seconds
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 second
} as const;

// Performance and storage limits
export const STORAGE_LIMITS = {
  MAX_TASKS: 10000,
  MAX_CATEGORIES: 100,
  MAX_TAGS: 500,
  MAX_ATTACHMENTS_PER_TASK: 5,
  MAX_ATTACHMENT_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_TOTAL_STORAGE: 100 * 1024 * 1024, // 100MB
  CLEANUP_THRESHOLD: 80 * 1024 * 1024, // 80MB
} as const;

// Sync and offline operation constants
export const SYNC_CONFIG = {
  MAX_PENDING_ACTIONS: 1000,
  BATCH_SIZE: 50,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 2000, // 2 seconds
  CLEANUP_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours
  MAX_ACTION_AGE: 7 * 24 * 60 * 60 * 1000, // 7 days
} as const;

// Query optimization constants
export const QUERY_CONFIG = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  SEARCH_DEBOUNCE: 300, // milliseconds
  INDEX_SCAN_LIMIT: 1000,
  BULK_OPERATION_SIZE: 100,
} as const;

// Cache configuration
export const CACHE_CONFIG = {
  TTL: 5 * 60 * 1000, // 5 minutes
  MAX_ENTRIES: 100,
  CLEANUP_INTERVAL: 10 * 60 * 1000, // 10 minutes
} as const;

// Error types and codes
export const ERROR_CODES = {
  DATABASE_NOT_AVAILABLE: 'DB_NOT_AVAILABLE',
  VERSION_MISMATCH: 'VERSION_MISMATCH',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  MIGRATION_FAILED: 'MIGRATION_FAILED',
  CORRUPTION_DETECTED: 'CORRUPTION_DETECTED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
} as const;

// Priority levels for different operations
export const OPERATION_PRIORITY = {
  CRITICAL: 1,  // Data integrity operations
  HIGH: 2,      // User-initiated operations
  MEDIUM: 3,    // Background sync operations
  LOW: 4,       // Cleanup and optimization
} as const;

// Transaction modes
export const TRANSACTION_MODES = {
  READ_ONLY: 'readonly',
  READ_WRITE: 'readwrite',
  VERSION_CHANGE: 'versionchange',
} as const;

// Default values for various entities
export const DEFAULTS = {
  TASK_PRIORITY: 'medium',
  TASK_STATUS: 'pending',
  CATEGORY_COLOR: '#3b82f6',
  TAG_COLOR: '#6b7280',
  SYNC_STATUS: 'pending',
  SYNC_RETRY_COUNT: 0,
  PAGE_SIZE: 20,
  SORT_DIRECTION: 'desc',
  SORT_FIELD: 'createdAt',
} as const;

// Feature flags
export const FEATURES = {
  OFFLINE_SUPPORT: true,
  BACKGROUND_SYNC: true,
  PUSH_NOTIFICATIONS: true,
  FILE_ATTACHMENTS: true,
  DATA_ENCRYPTION: false, // Disabled by default
  ANALYTICS: false,       // Disabled by default
  CLOUD_SYNC: false,      // Future feature
} as const;

// Performance monitoring thresholds
export const PERFORMANCE_THRESHOLDS = {
  SLOW_QUERY_MS: 100,
  SLOW_TRANSACTION_MS: 500,
  MEMORY_WARNING_MB: 50,
  STORAGE_WARNING_MB: 80,
  CPU_WARNING_PERCENT: 80,
} as const;

// Maintenance schedules
export const MAINTENANCE_SCHEDULE = {
  CLEANUP_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours
  OPTIMIZATION_INTERVAL: 7 * 24 * 60 * 60 * 1000, // 7 days
  BACKUP_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours
  HEALTH_CHECK_INTERVAL: 60 * 60 * 1000, // 1 hour
} as const;

// Validation patterns and limits
export const VALIDATION = {
  PATTERNS: {
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    URL: /^https?:\/\/.+/,
    COLOR_HEX: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
    TAG_NAME: /^[a-zA-Z0-9_-]+$/,
    TASK_ID: /^task_[0-9]+_[a-zA-Z0-9]+$/,
  },
  LENGTHS: {
    TASK_TITLE_MIN: 1,
    TASK_TITLE_MAX: 200,
    TASK_DESCRIPTION_MAX: 1000,
    CATEGORY_NAME_MIN: 1,
    CATEGORY_NAME_MAX: 50,
    TAG_NAME_MIN: 1,
    TAG_NAME_MAX: 30,
    ATTACHMENT_NAME_MAX: 100,
  },
  LIMITS: {
    MAX_TAGS_PER_TASK: 10,
    MAX_ATTACHMENTS_PER_TASK: 5,
    MAX_NESTING_DEPTH: 5,
    MAX_BULK_OPERATIONS: 100,
  },
} as const;

// Event types for database operations
export const EVENT_TYPES = {
  TASK_CREATED: 'task:created',
  TASK_UPDATED: 'task:updated',
  TASK_DELETED: 'task:deleted',
  TASK_COMPLETED: 'task:completed',
  CATEGORY_CREATED: 'category:created',
  CATEGORY_UPDATED: 'category:updated',
  CATEGORY_DELETED: 'category:deleted',
  TAG_CREATED: 'tag:created',
  TAG_UPDATED: 'tag:updated',
  SYNC_STARTED: 'sync:started',
  SYNC_COMPLETED: 'sync:completed',
  SYNC_FAILED: 'sync:failed',
  DATABASE_READY: 'database:ready',
  DATABASE_ERROR: 'database:error',
} as const;

// Status indicators
export const STATUS = {
  SYNC: {
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
  },
  HEALTH: {
    HEALTHY: 'healthy',
    WARNING: 'warning',
    ERROR: 'error',
    CRITICAL: 'critical',
  },
  CONNECTION: {
    ONLINE: 'online',
    OFFLINE: 'offline',
    DEGRADED: 'degraded',
  },
} as const;