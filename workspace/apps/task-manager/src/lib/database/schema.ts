export const DB_CONFIG = {
  NAME: 'TaskManagerDB',
  VERSION: 1,
} as const;

export const OBJECT_STORES = {
  TASKS: 'tasks',
  CATEGORIES: 'categories',
  SETTINGS: 'settings',
  SYNC_ACTIONS: 'syncActions',
  TAGS: 'tags',
  ATTACHMENTS: 'attachments',
} as const;

export const INDEXES = {
  TASKS: {
    BY_STATUS: 'by-status',
    BY_PRIORITY: 'by-priority',
    BY_CATEGORY: 'by-category',
    BY_DUE_DATE: 'by-due-date',
    BY_CREATED_AT: 'by-created-at',
    BY_UPDATED_AT: 'by-updated-at',
    BY_ARCHIVED: 'by-archived',
    BY_TAGS: 'by-tags',
  },
  CATEGORIES: {
    BY_NAME: 'by-name',
    BY_CREATED_AT: 'by-created-at',
  },
  SYNC_ACTIONS: {
    BY_STATUS: 'by-status',
    BY_TIMESTAMP: 'by-timestamp',
    BY_ENTITY: 'by-entity',
    BY_TYPE: 'by-type',
  },
  TAGS: {
    BY_NAME: 'by-name',
    BY_USAGE_COUNT: 'by-usage-count',
  },
  ATTACHMENTS: {
    BY_TASK_ID: 'by-task-id',
    BY_TYPE: 'by-type',
    BY_CREATED_AT: 'by-created-at',
  },
} as const;

export interface DBSchema {
  version: number;
  stores: Array<{
    name: string;
    keyPath: string;
    autoIncrement?: boolean;
    indexes: Array<{
      name: string;
      keyPath: string | string[];
      unique?: boolean;
      multiEntry?: boolean;
    }>;
  }>;
}

export const SCHEMA_V1: DBSchema = {
  version: 1,
  stores: [
    {
      name: OBJECT_STORES.TASKS,
      keyPath: 'id',
      indexes: [
        { name: INDEXES.TASKS.BY_STATUS, keyPath: 'status' },
        { name: INDEXES.TASKS.BY_PRIORITY, keyPath: 'priority' },
        { name: INDEXES.TASKS.BY_CATEGORY, keyPath: 'categoryId' },
        { name: INDEXES.TASKS.BY_DUE_DATE, keyPath: 'dueDate' },
        { name: INDEXES.TASKS.BY_CREATED_AT, keyPath: 'createdAt' },
        { name: INDEXES.TASKS.BY_UPDATED_AT, keyPath: 'updatedAt' },
        { name: INDEXES.TASKS.BY_ARCHIVED, keyPath: 'isArchived' },
        { name: INDEXES.TASKS.BY_TAGS, keyPath: 'tags', multiEntry: true },
      ],
    },
    {
      name: OBJECT_STORES.CATEGORIES,
      keyPath: 'id',
      indexes: [
        { name: INDEXES.CATEGORIES.BY_NAME, keyPath: 'name', unique: true },
        { name: INDEXES.CATEGORIES.BY_CREATED_AT, keyPath: 'createdAt' },
      ],
    },
    {
      name: OBJECT_STORES.SETTINGS,
      keyPath: 'id',
      indexes: [],
    },
    {
      name: OBJECT_STORES.SYNC_ACTIONS,
      keyPath: 'id',
      indexes: [
        { name: INDEXES.SYNC_ACTIONS.BY_STATUS, keyPath: 'status' },
        { name: INDEXES.SYNC_ACTIONS.BY_TIMESTAMP, keyPath: 'timestamp' },
        { name: INDEXES.SYNC_ACTIONS.BY_ENTITY, keyPath: 'entity' },
        { name: INDEXES.SYNC_ACTIONS.BY_TYPE, keyPath: 'type' },
      ],
    },
    {
      name: OBJECT_STORES.TAGS,
      keyPath: 'id',
      indexes: [
        { name: INDEXES.TAGS.BY_NAME, keyPath: 'name', unique: true },
        { name: INDEXES.TAGS.BY_USAGE_COUNT, keyPath: 'usageCount' },
      ],
    },
    {
      name: OBJECT_STORES.ATTACHMENTS,
      keyPath: 'id',
      indexes: [
        { name: INDEXES.ATTACHMENTS.BY_TASK_ID, keyPath: 'taskId' },
        { name: INDEXES.ATTACHMENTS.BY_TYPE, keyPath: 'type' },
        { name: INDEXES.ATTACHMENTS.BY_CREATED_AT, keyPath: 'createdAt' },
      ],
    },
  ],
};

export interface DBTag {
  id: string;
  name: string;
  color?: string;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DBAttachment {
  id: string;
  taskId: string;
  name: string;
  type: string;
  size: number;
  data: ArrayBuffer | string; // Binary data or base64 encoded
  createdAt: string;
}

// Validation rules for schema
export const VALIDATION_RULES = {
  TASK_TITLE_MAX_LENGTH: 200,
  TASK_DESCRIPTION_MAX_LENGTH: 1000,
  CATEGORY_NAME_MAX_LENGTH: 50,
  TAG_NAME_MAX_LENGTH: 30,
  ATTACHMENT_MAX_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_TAGS_PER_TASK: 10,
  MAX_ATTACHMENTS_PER_TASK: 5,
} as const;

// Schema migration functions
export function getSchemaForVersion(version: number): DBSchema {
  switch (version) {
    case 1:
      return SCHEMA_V1;
    default:
      throw new Error(`Unsupported schema version: ${version}`);
  }
}

export function needsMigration(currentVersion: number, targetVersion: number): boolean {
  return currentVersion < targetVersion;
}

export function getMigrationPath(fromVersion: number, toVersion: number): number[] {
  const path: number[] = [];
  for (let version = fromVersion + 1; version <= toVersion; version++) {
    path.push(version);
  }
  return path;
}