import { getDB } from './db';
import { DBTask, DBCategory, DBSettings, DBSyncAction } from './dbTypes';
import { Task, Category } from '@/store/types';

// Utility functions to convert between app types and DB types
function taskToDBTask(task: Task): DBTask {
  return {
    ...task,
    dueDate: task.dueDate?.toISOString(),
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    completedAt: task.completedAt?.toISOString(),
  };
}

function dbTaskToTask(dbTask: DBTask): Task {
  return {
    ...dbTask,
    id: dbTask.id!,
    dueDate: dbTask.dueDate ? new Date(dbTask.dueDate) : undefined,
    createdAt: new Date(dbTask.createdAt),
    updatedAt: new Date(dbTask.updatedAt),
    completedAt: dbTask.completedAt ? new Date(dbTask.completedAt) : undefined,
  };
}

function categoryToDBCategory(category: Category): DBCategory {
  return {
    ...category,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

function dbCategoryToCategory(dbCategory: DBCategory): Category {
  return {
    ...dbCategory,
    id: dbCategory.id!,
    createdAt: new Date(dbCategory.createdAt),
    updatedAt: new Date(dbCategory.updatedAt),
  };
}

// Task operations
export async function getAllTasks(): Promise<Task[]> {
  try {
    const db = await getDB();
    const dbTasks = await db.getAll('tasks');
    return dbTasks.map(dbTaskToTask);
  } catch (error) {
    console.error('Failed to get all tasks:', error);
    throw error;
  }
}

export async function getTaskById(id: string): Promise<Task | undefined> {
  try {
    const db = await getDB();
    const dbTask = await db.get('tasks', id);
    return dbTask ? dbTaskToTask(dbTask) : undefined;
  } catch (error) {
    console.error('Failed to get task by id:', error);
    throw error;
  }
}

export async function createTask(task: Task): Promise<void> {
  try {
    const db = await getDB();
    const dbTask = taskToDBTask(task);
    await db.add('tasks', dbTask);
  } catch (error) {
    console.error('Failed to create task:', error);
    throw error;
  }
}

export async function updateTask(task: Task): Promise<void> {
  try {
    const db = await getDB();
    const dbTask = taskToDBTask(task);
    await db.put('tasks', dbTask);
  } catch (error) {
    console.error('Failed to update task:', error);
    throw error;
  }
}

export async function deleteTask(id: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('tasks', id);
  } catch (error) {
    console.error('Failed to delete task:', error);
    throw error;
  }
}

export async function getTasksByStatus(status: string): Promise<Task[]> {
  try {
    const db = await getDB();
    const dbTasks = await db.getAllFromIndex('tasks', 'by-status', status);
    return dbTasks.map(dbTaskToTask);
  } catch (error) {
    console.error('Failed to get tasks by status:', error);
    throw error;
  }
}

export async function getTasksByCategory(categoryId: string): Promise<Task[]> {
  try {
    const db = await getDB();
    const dbTasks = await db.getAllFromIndex('tasks', 'by-category', categoryId);
    return dbTasks.map(dbTaskToTask);
  } catch (error) {
    console.error('Failed to get tasks by category:', error);
    throw error;
  }
}

export async function getOverdueTasks(): Promise<Task[]> {
  try {
    const db = await getDB();
    const allTasks = await db.getAll('tasks');
    const now = new Date().toISOString();
    
    const overdueTasks = allTasks.filter(
      (task) =>
        task.dueDate &&
        task.dueDate < now &&
        task.status !== 'completed'
    );
    
    return overdueTasks.map(dbTaskToTask);
  } catch (error) {
    console.error('Failed to get overdue tasks:', error);
    throw error;
  }
}

// Category operations
export async function getAllCategories(): Promise<Category[]> {
  try {
    const db = await getDB();
    const dbCategories = await db.getAll('categories');
    return dbCategories.map(dbCategoryToCategory);
  } catch (error) {
    console.error('Failed to get all categories:', error);
    throw error;
  }
}

export async function getCategoryById(id: string): Promise<Category | undefined> {
  try {
    const db = await getDB();
    const dbCategory = await db.get('categories', id);
    return dbCategory ? dbCategoryToCategory(dbCategory) : undefined;
  } catch (error) {
    console.error('Failed to get category by id:', error);
    throw error;
  }
}

export async function createCategory(category: Category): Promise<void> {
  try {
    const db = await getDB();
    const dbCategory = categoryToDBCategory(category);
    await db.add('categories', dbCategory);
  } catch (error) {
    console.error('Failed to create category:', error);
    throw error;
  }
}

export async function updateCategory(category: Category): Promise<void> {
  try {
    const db = await getDB();
    const dbCategory = categoryToDBCategory(category);
    await db.put('categories', dbCategory);
  } catch (error) {
    console.error('Failed to update category:', error);
    throw error;
  }
}

export async function deleteCategory(id: string): Promise<void> {
  try {
    const db = await getDB();
    
    // Start transaction to delete category and update tasks
    const tx = db.transaction(['categories', 'tasks'], 'readwrite');
    
    // Delete the category
    await tx.objectStore('categories').delete(id);
    
    // Update all tasks that belong to this category
    const tasksInCategory = await tx.objectStore('tasks').index('by-category').getAll(id);
    for (const task of tasksInCategory) {
      task.categoryId = undefined;
      task.updatedAt = new Date().toISOString();
      await tx.objectStore('tasks').put(task);
    }
    
    await tx.complete;
  } catch (error) {
    console.error('Failed to delete category:', error);
    throw error;
  }
}

// Settings operations
export async function getSettings(): Promise<DBSettings | undefined> {
  try {
    const db = await getDB();
    return await db.get('settings', 'general');
  } catch (error) {
    console.error('Failed to get settings:', error);
    throw error;
  }
}

export async function updateSettings(settings: Partial<DBSettings>): Promise<void> {
  try {
    const db = await getDB();
    const currentSettings = await db.get('settings', 'general');
    
    if (currentSettings) {
      const updatedSettings = { ...currentSettings, ...settings };
      await db.put('settings', updatedSettings);
    } else {
      // Create default settings with updates
      const defaultSettings: DBSettings = {
        id: 'general',
        theme: 'system',
        notifications: true,
        autoArchive: false,
        archiveDays: 30,
        syncEnabled: true,
        lastCleanup: new Date().toISOString(),
        ...settings,
      };
      await db.add('settings', defaultSettings);
    }
  } catch (error) {
    console.error('Failed to update settings:', error);
    throw error;
  }
}

// Sync actions operations
export async function addSyncAction(action: Omit<DBSyncAction, 'id'>): Promise<void> {
  try {
    const db = await getDB();
    const syncAction: DBSyncAction = {
      ...action,
      id: `${action.type}_${action.entity}_${action.entityId}_${Date.now()}`,
    };
    await db.add('syncActions', syncAction);
  } catch (error) {
    console.error('Failed to add sync action:', error);
    throw error;
  }
}

export async function getPendingSyncActions(): Promise<DBSyncAction[]> {
  try {
    const db = await getDB();
    return await db.getAllFromIndex('syncActions', 'by-status', 'pending');
  } catch (error) {
    console.error('Failed to get pending sync actions:', error);
    throw error;
  }
}

export async function updateSyncAction(id: string, updates: Partial<DBSyncAction>): Promise<void> {
  try {
    const db = await getDB();
    const existing = await db.get('syncActions', id);
    if (existing) {
      await db.put('syncActions', { ...existing, ...updates });
    }
  } catch (error) {
    console.error('Failed to update sync action:', error);
    throw error;
  }
}

export async function deleteSyncAction(id: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('syncActions', id);
  } catch (error) {
    console.error('Failed to delete sync action:', error);
    throw error;
  }
}

// Bulk operations for performance
export async function bulkCreateTasks(tasks: Task[]): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('tasks', 'readwrite');
    
    await Promise.all(
      tasks.map((task) => 
        tx.objectStore('tasks').add(taskToDBTask(task))
      )
    );
    
    await tx.complete;
  } catch (error) {
    console.error('Failed to bulk create tasks:', error);
    throw error;
  }
}

export async function bulkUpdateTasks(tasks: Task[]): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('tasks', 'readwrite');
    
    await Promise.all(
      tasks.map((task) => 
        tx.objectStore('tasks').put(taskToDBTask(task))
      )
    );
    
    await tx.complete;
  } catch (error) {
    console.error('Failed to bulk update tasks:', error);
    throw error;
  }
}

export async function bulkDeleteTasks(ids: string[]): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('tasks', 'readwrite');
    
    await Promise.all(
      ids.map((id) => tx.objectStore('tasks').delete(id))
    );
    
    await tx.complete;
  } catch (error) {
    console.error('Failed to bulk delete tasks:', error);
    throw error;
  }
}