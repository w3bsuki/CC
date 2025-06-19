import { openDB, IDBPDatabase } from 'idb';
import { DBTask, DBCategory, DBSettings, DBSyncAction } from './dbTypes';

const DB_NAME = 'TaskManagerDB';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<any> | null = null;

export async function initDB(): Promise<IDBPDatabase<any>> {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    dbInstance = await openDB(DB_NAME, DB_VERSION, {
      upgrade(database, oldVersion, newVersion, transaction) {
        console.log(`Upgrading database from version ${oldVersion} to ${newVersion}`);

        // Create tasks store
        if (!database.objectStoreNames.contains('tasks')) {
          const tasksStore = database.createObjectStore('tasks', { keyPath: 'id' });
          tasksStore.createIndex('by-status', 'status');
          tasksStore.createIndex('by-priority', 'priority');
          tasksStore.createIndex('by-category', 'categoryId');
          tasksStore.createIndex('by-due-date', 'dueDate');
          tasksStore.createIndex('by-created-at', 'createdAt');
          tasksStore.createIndex('by-archived', 'isArchived');
        }

        // Create categories store
        if (!database.objectStoreNames.contains('categories')) {
          const categoriesStore = database.createObjectStore('categories', { keyPath: 'id' });
          categoriesStore.createIndex('by-name', 'name');
          categoriesStore.createIndex('by-created-at', 'createdAt');
        }

        // Create settings store
        if (!database.objectStoreNames.contains('settings')) {
          database.createObjectStore('settings', { keyPath: 'id' });
        }

        // Create sync actions store
        if (!database.objectStoreNames.contains('syncActions')) {
          const syncActionsStore = database.createObjectStore('syncActions', { keyPath: 'id' });
          syncActionsStore.createIndex('by-status', 'status');
          syncActionsStore.createIndex('by-timestamp', 'timestamp');
          syncActionsStore.createIndex('by-entity', 'entity');
        }
      },
      blocked() {
        console.warn('Database upgrade blocked');
      },
      blocking() {
        console.warn('Database upgrade blocking');
      },
      terminated() {
        console.warn('Database connection terminated');
        dbInstance = null;
      },
    });

    // Initialize default data
    await initializeDefaultData(dbInstance);

    return dbInstance;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw new Error('Database initialization failed');
  }
}

async function initializeDefaultData(db: IDBPDatabase<any>) {
  const transaction = db.transaction(['categories', 'settings'], 'readwrite');

  try {
    // Initialize default categories if none exist
    const categoriesCount = await transaction.objectStore('categories').count();
    if (categoriesCount === 0) {
      const defaultCategories: DBCategory[] = [
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
      ];

      for (const category of defaultCategories) {
        await transaction.objectStore('categories').add(category);
      }
    }

    // Initialize default settings if none exist
    const settingsExists = await transaction.objectStore('settings').get('general');
    if (!settingsExists) {
      const defaultSettings: DBSettings = {
        id: 'general',
        theme: 'system',
        notifications: true,
        autoArchive: false,
        archiveDays: 30,
        defaultCategory: 'personal',
        syncEnabled: true,
        lastCleanup: new Date().toISOString(),
      };

      await transaction.objectStore('settings').add(defaultSettings);
    }

    await transaction.done;
    console.log('Default data initialized successfully');
  } catch (error) {
    console.error('Failed to initialize default data:', error);
    transaction.abort();
    throw error;
  }
}

export async function getDB(): Promise<IDBPDatabase<any>> {
  if (!dbInstance) {
    return await initDB();
  }
  return dbInstance;
}

export function closeDB(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

// Database health check
export async function checkDBHealth(): Promise<boolean> {
  try {
    const db = await getDB();
    // Simple test operation
    await db.count('tasks');
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

// Clear all data (for testing/reset purposes)
export async function clearAllData(): Promise<void> {
  try {
    const db = await getDB();
    const transaction = db.transaction(['tasks', 'categories', 'settings', 'syncActions'], 'readwrite');

    await Promise.all([
      transaction.objectStore('tasks').clear(),
      transaction.objectStore('categories').clear(),
      transaction.objectStore('settings').clear(),
      transaction.objectStore('syncActions').clear(),
    ]);

    await transaction.done;
    
    // Reinitialize default data
    await initializeDefaultData(db);
    
    console.log('All data cleared and reinitialized');
  } catch (error) {
    console.error('Failed to clear data:', error);
    throw error;
  }
}