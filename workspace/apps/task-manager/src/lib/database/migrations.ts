import { IDBPDatabase } from 'idb';
import { DBSchema, getSchemaForVersion, OBJECT_STORES } from './schema';

export interface MigrationContext {
  database: IDBPDatabase<any>;
  transaction: any;
  oldVersion: number;
  newVersion: number;
}

export type MigrationFunction = (context: MigrationContext) => Promise<void>;

// Migration registry
const migrations: Map<number, MigrationFunction> = new Map();

// Register migration for version 1 (initial schema)
migrations.set(1, async (context: MigrationContext) => {
  const { database } = context;
  const schema = getSchemaForVersion(1);

  console.log('Running migration to version 1: Creating initial schema');

  // Create all object stores defined in schema
  for (const store of schema.stores) {
    if (!database.objectStoreNames.contains(store.name)) {
      const objectStore = database.createObjectStore(store.name, {
        keyPath: store.keyPath,
        autoIncrement: store.autoIncrement || false,
      });

      // Create indexes
      for (const index of store.indexes) {
        objectStore.createIndex(index.name, index.keyPath, {
          unique: index.unique || false,
          multiEntry: index.multiEntry || false,
        });
      }

      console.log(`Created object store: ${store.name} with ${store.indexes.length} indexes`);
    }
  }

  // Initialize default data
  await initializeDefaultData(context);
});

async function initializeDefaultData(context: MigrationContext) {
  const { database } = context;

  try {
    // Default categories
    const defaultCategories = [
      {
        id: 'personal',
        name: 'Personal',
        color: '#3b82f6',
        description: 'Personal tasks and activities',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'work',
        name: 'Work',
        color: '#ef4444',
        description: 'Work-related tasks and projects',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'health',
        name: 'Health',
        color: '#10b981',
        description: 'Health and fitness related tasks',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'shopping',
        name: 'Shopping',
        color: '#f59e0b',
        description: 'Shopping lists and purchases',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    // Add categories if the store is empty
    if (database.objectStoreNames.contains(OBJECT_STORES.CATEGORIES)) {
      const tx = database.transaction(OBJECT_STORES.CATEGORIES, 'readwrite');
      const store = tx.objectStore(OBJECT_STORES.CATEGORIES);
      
      for (const category of defaultCategories) {
        try {
          await store.add(category);
        } catch (error) {
          // Category might already exist, skip
          console.log(`Category ${category.name} already exists, skipping`);
        }
      }
    }

    // Default settings
    const defaultSettings = {
      id: 'general',
      theme: 'system',
      notifications: true,
      autoArchive: false,
      archiveDays: 30,
      defaultCategory: 'personal',
      syncEnabled: true,
      language: 'en',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      dateFormat: 'MM/dd/yyyy',
      timeFormat: '12h',
      firstDayOfWeek: 0, // Sunday
      reminderDefaults: {
        enabled: true,
        defaultTime: '09:00',
        advanceNotice: 15, // minutes
      },
      privacy: {
        analytics: false,
        crashReporting: true,
        usageData: false,
      },
      backup: {
        autoBackup: true,
        backupFrequency: 'weekly',
        maxBackups: 5,
      },
      lastCleanup: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Add settings if the store is empty
    if (database.objectStoreNames.contains(OBJECT_STORES.SETTINGS)) {
      const tx = database.transaction(OBJECT_STORES.SETTINGS, 'readwrite');
      const store = tx.objectStore(OBJECT_STORES.SETTINGS);
      
      try {
        await store.add(defaultSettings);
      } catch (error) {
        // Settings might already exist, skip
        console.log('Settings already exist, skipping default initialization');
      }
    }

    // Default tags
    const defaultTags = [
      {
        id: 'urgent',
        name: 'urgent',
        color: '#ef4444',
        usageCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'important',
        name: 'important',
        color: '#f59e0b',
        usageCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'quick',
        name: 'quick',
        color: '#10b981',
        usageCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    // Add tags if the store exists and is empty
    if (database.objectStoreNames.contains(OBJECT_STORES.TAGS)) {
      const tx = database.transaction(OBJECT_STORES.TAGS, 'readwrite');
      const store = tx.objectStore(OBJECT_STORES.TAGS);
      
      for (const tag of defaultTags) {
        try {
          await store.add(tag);
        } catch (error) {
          // Tag might already exist, skip
          console.log(`Tag ${tag.name} already exists, skipping`);
        }
      }
    }

    console.log('Default data initialization completed');
  } catch (error) {
    console.error('Failed to initialize default data:', error);
    throw error;
  }
}

// Main migration runner
export async function runMigrations(
  database: IDBPDatabase<any>,
  transaction: any,
  oldVersion: number,
  newVersion: number
): Promise<void> {
  console.log(`Starting database migration from version ${oldVersion} to ${newVersion}`);

  const context: MigrationContext = {
    database,
    transaction,
    oldVersion,
    newVersion,
  };

  // Run migrations sequentially
  for (let version = oldVersion + 1; version <= newVersion; version++) {
    const migration = migrations.get(version);
    if (migration) {
      console.log(`Running migration for version ${version}`);
      await migration(context);
      console.log(`Completed migration for version ${version}`);
    } else {
      console.warn(`No migration found for version ${version}`);
    }
  }

  console.log(`Database migration completed successfully`);
}

// Utility function to check if migration is needed
export function isMigrationNeeded(currentVersion: number, targetVersion: number): boolean {
  return currentVersion < targetVersion;
}

// Utility function to get available migration versions
export function getAvailableMigrations(): number[] {
  return Array.from(migrations.keys()).sort((a, b) => a - b);
}

// Function to validate migration integrity
export async function validateMigration(database: IDBPDatabase<any>, version: number): Promise<boolean> {
  try {
    const schema = getSchemaForVersion(version);
    
    // Check if all required stores exist
    for (const store of schema.stores) {
      if (!database.objectStoreNames.contains(store.name)) {
        console.error(`Missing object store: ${store.name}`);
        return false;
      }
    }

    // Check if basic data exists
    const categoriesCount = await database.count(OBJECT_STORES.CATEGORIES);
    const settingsExists = await database.get(OBJECT_STORES.SETTINGS, 'general');
    
    if (categoriesCount === 0) {
      console.warn('No categories found after migration');
    }
    
    if (!settingsExists) {
      console.warn('Default settings not found after migration');
    }

    return true;
  } catch (error) {
    console.error('Migration validation failed:', error);
    return false;
  }
}

// Emergency rollback function (limited support)
export async function rollbackToVersion(database: IDBPDatabase<any>, targetVersion: number): Promise<void> {
  console.warn(`Rollback to version ${targetVersion} requested`);
  
  // Note: IndexedDB doesn't support schema rollbacks natively
  // This would require careful planning and potentially data loss
  // For now, we'll just log the request
  
  throw new Error('Database rollback is not currently supported. Please clear application data and restart.');
}