import { openDB, IDBPDatabase } from 'idb';
import { DB_CONFIG } from './schema';
import { runMigrations, validateMigration } from './migrations';

let dbInstance: IDBPDatabase<any> | null = null;
let initializationPromise: Promise<IDBPDatabase<any>> | null = null;

// Database initialization with proper error handling and retry logic
export async function initializeDatabase(): Promise<IDBPDatabase<any>> {
  // Return existing instance if available
  if (dbInstance) {
    return dbInstance;
  }

  // Return existing initialization promise if in progress
  if (initializationPromise) {
    return initializationPromise;
  }

  // Start new initialization
  initializationPromise = performInitialization();
  
  try {
    dbInstance = await initializationPromise;
    return dbInstance;
  } catch (error) {
    // Reset promise on failure to allow retry
    initializationPromise = null;
    throw error;
  }
}

async function performInitialization(): Promise<IDBPDatabase<any>> {
  const maxRetries = 3;
  let retryCount = 0;
  let lastError: Error | null = null;

  while (retryCount < maxRetries) {
    try {
      console.log(`Initializing database (attempt ${retryCount + 1}/${maxRetries})`);
      
      const database = await openDB(DB_CONFIG.NAME, DB_CONFIG.VERSION, {
        upgrade: async (database, oldVersion, newVersion, transaction) => {
          console.log(`Database upgrade triggered: ${oldVersion} -> ${newVersion}`);
          
          try {
            await runMigrations(database, transaction, oldVersion, newVersion || DB_CONFIG.VERSION);
          } catch (error) {
            console.error('Migration failed:', error);
            throw error;
          }
        },
        
        blocked: () => {
          console.warn('Database upgrade blocked by another connection');
          // Handle blocked upgrade (e.g., show user message to close other tabs)
        },
        
        blocking: () => {
          console.warn('Database connection is blocking an upgrade');
          // Close the database to allow upgrade
          if (dbInstance) {
            dbInstance.close();
            dbInstance = null;
          }
        },
        
        terminated: () => {
          console.warn('Database connection was terminated');
          dbInstance = null;
          initializationPromise = null;
        },
      });

      // Validate the database after opening
      const isValid = await validateMigration(database, DB_CONFIG.VERSION);
      if (!isValid) {
        throw new Error('Database validation failed after initialization');
      }

      // Set up connection monitoring
      setupConnectionMonitoring(database);

      console.log('Database initialized successfully');
      return database;

    } catch (error) {
      console.error(`Database initialization attempt ${retryCount + 1} failed:`, error);
      lastError = error as Error;
      retryCount++;

      if (retryCount < maxRetries) {
        // Wait before retry with exponential backoff
        const delay = Math.pow(2, retryCount) * 1000;
        console.log(`Retrying database initialization in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries failed
  throw new Error(`Database initialization failed after ${maxRetries} attempts. Last error: ${lastError?.message}`);
}

function setupConnectionMonitoring(database: IDBPDatabase<any>) {
  // Monitor for version changes
  database.addEventListener('versionchange', (event) => {
    console.log('Database version change detected');
    database.close();
    dbInstance = null;
    initializationPromise = null;
    
    // Notify user to reload
    if (typeof window !== 'undefined') {
      console.warn('Database schema updated. Application reload recommended.');
    }
  });

  // Monitor for unexpected closures
  database.addEventListener('close', () => {
    console.warn('Database connection closed unexpectedly');
    dbInstance = null;
    initializationPromise = null;
  });
}

// Get database instance (initializes if needed)
export async function getDatabase(): Promise<IDBPDatabase<any>> {
  return await initializeDatabase();
}

// Close database connection
export function closeDatabase(): void {
  if (dbInstance) {
    console.log('Closing database connection');
    dbInstance.close();
    dbInstance = null;
    initializationPromise = null;
  }
}

// Health check function
export async function checkDatabaseHealth(): Promise<{
  isHealthy: boolean;
  version: number;
  stores: string[];
  error?: string;
}> {
  try {
    const database = await getDatabase();
    
    return {
      isHealthy: true,
      version: database.version,
      stores: Array.from(database.objectStoreNames),
    };
  } catch (error) {
    console.error('Database health check failed:', error);
    return {
      isHealthy: false,
      version: 0,
      stores: [],
      error: (error as Error).message,
    };
  }
}

// Database statistics
export async function getDatabaseStats(): Promise<{
  size: number;
  taskCount: number;
  categoryCount: number;
  tagCount: number;
  syncActionCount: number;
}> {
  try {
    const database = await getDatabase();
    
    const [taskCount, categoryCount, tagCount, syncActionCount] = await Promise.all([
      database.count('tasks'),
      database.count('categories'),
      database.count('tags'),
      database.count('syncActions'),
    ]);

    // Estimate database size (simplified)
    const estimatedSize = (taskCount * 1000) + (categoryCount * 500) + (tagCount * 200) + (syncActionCount * 300);

    return {
      size: estimatedSize,
      taskCount,
      categoryCount,
      tagCount,
      syncActionCount,
    };
  } catch (error) {
    console.error('Failed to get database statistics:', error);
    return {
      size: 0,
      taskCount: 0,
      categoryCount: 0,
      tagCount: 0,
      syncActionCount: 0,
    };
  }
}

// Clear all data (for testing/reset)
export async function clearAllData(): Promise<void> {
  try {
    const database = await getDatabase();
    
    console.log('Clearing all database data');
    
    const storeNames = Array.from(database.objectStoreNames);
    const transaction = database.transaction(storeNames, 'readwrite');
    
    // Clear all stores
    await Promise.all(
      storeNames.map(storeName => 
        transaction.objectStore(storeName).clear()
      )
    );

    console.log('All data cleared successfully');
    
    // Reinitialize with default data
    const initContext = {
      database,
      transaction,
      oldVersion: 0,
      newVersion: DB_CONFIG.VERSION,
    };
    
    // Run migrations to restore default data
    await runMigrations(database, transaction, 0, DB_CONFIG.VERSION);
    
    console.log('Default data restored');
  } catch (error) {
    console.error('Failed to clear database data:', error);
    throw error;
  }
}

// Export data for backup
export async function exportDatabaseData(): Promise<{
  version: number;
  exportDate: string;
  data: Record<string, any[]>;
}> {
  try {
    const database = await getDatabase();
    const storeNames = Array.from(database.objectStoreNames);
    
    const data: Record<string, any[]> = {};
    
    for (const storeName of storeNames) {
      data[storeName] = await database.getAll(storeName);
    }

    return {
      version: database.version,
      exportDate: new Date().toISOString(),
      data,
    };
  } catch (error) {
    console.error('Failed to export database data:', error);
    throw error;
  }
}

// Import data from backup
export async function importDatabaseData(backupData: {
  version: number;
  exportDate: string;
  data: Record<string, any[]>;
}): Promise<void> {
  try {
    const database = await getDatabase();
    
    console.log('Importing database data from backup');
    
    // Clear existing data first
    await clearAllData();
    
    // Import data store by store
    for (const [storeName, items] of Object.entries(backupData.data)) {
      if (database.objectStoreNames.contains(storeName)) {
        const transaction = database.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        
        for (const item of items) {
          await store.put(item);
        }
      }
    }

    console.log('Database data import completed');
  } catch (error) {
    console.error('Failed to import database data:', error);
    throw error;
  }
}

// Database maintenance
export async function performMaintenance(): Promise<{
  success: boolean;
  operations: string[];
  errors: string[];
}> {
  const operations: string[] = [];
  const errors: string[] = [];

  try {
    const database = await getDatabase();
    
    // Clean up old sync actions
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 7); // Remove sync actions older than 7 days
      
      const transaction = database.transaction('syncActions', 'readwrite');
      const store = transaction.objectStore('syncActions');
      const index = store.index('by-timestamp');
      
      const range = IDBKeyRange.upperBound(cutoffDate.toISOString());
      const oldActions = await index.getAllKeys(range);
      
      for (const key of oldActions) {
        await store.delete(key);
      }
      
      operations.push(`Cleaned up ${oldActions.length} old sync actions`);
    } catch (error) {
      errors.push(`Sync action cleanup failed: ${(error as Error).message}`);
    }

    // Update tag usage counts
    try {
      const tasks = await database.getAll('tasks');
      const tagCounts: Record<string, number> = {};
      
      for (const task of tasks) {
        if (task.tags && Array.isArray(task.tags)) {
          for (const tag of task.tags) {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          }
        }
      }
      
      const transaction = database.transaction('tags', 'readwrite');
      const store = transaction.objectStore('tags');
      const allTags = await store.getAll();
      
      for (const tag of allTags) {
        const newCount = tagCounts[tag.name] || 0;
        if (tag.usageCount !== newCount) {
          tag.usageCount = newCount;
          tag.updatedAt = new Date().toISOString();
          await store.put(tag);
        }
      }
      
      operations.push('Updated tag usage counts');
    } catch (error) {
      errors.push(`Tag usage count update failed: ${(error as Error).message}`);
    }

    return {
      success: errors.length === 0,
      operations,
      errors,
    };
  } catch (error) {
    console.error('Database maintenance failed:', error);
    return {
      success: false,
      operations,
      errors: [`Maintenance failed: ${(error as Error).message}`],
    };
  }
}