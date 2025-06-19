import { Task, Category, Priority, TaskStatus } from '@/store/types';
import {
  getAllTasks,
  getTaskById,
  createTask as dbCreateTask,
  updateTask as dbUpdateTask,
  deleteTask as dbDeleteTask,
  getTasksByStatus,
  getTasksByCategory,
  getOverdueTasks,
  bulkCreateTasks,
  bulkUpdateTasks,
  bulkDeleteTasks,
} from './dbOperations';
import { validateTask, sanitizeTaskInput, ValidationResult } from './validation';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from './constants';

export interface TaskOperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface TaskSearchOptions {
  query?: string;
  status?: TaskStatus[];
  priority?: Priority[];
  categoryId?: string;
  tags?: string[];
  dueDateStart?: Date;
  dueDateEnd?: Date;
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
}

export interface TaskSortOptions {
  field: 'title' | 'dueDate' | 'priority' | 'status' | 'createdAt' | 'updatedAt';
  direction: 'asc' | 'desc';
}

// Generate unique ID
function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Create a new task
export async function createTask(
  taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>
): Promise<TaskOperationResult<Task>> {
  try {
    // Sanitize input
    const sanitized = sanitizeTaskInput(taskData);
    
    // Create full task object
    const now = new Date();
    const task: Task = {
      id: generateTaskId(),
      title: sanitized.title || '',
      description: sanitized.description,
      priority: sanitized.priority || 'medium',
      status: sanitized.status || 'pending',
      dueDate: sanitized.dueDate,
      categoryId: sanitized.categoryId,
      tags: sanitized.tags || [],
      isArchived: sanitized.isArchived || false,
      createdAt: now,
      updatedAt: now,
    };

    // Validate task
    const validation = validateTask(task);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.errors.join(', '),
      };
    }

    // Save to database
    await dbCreateTask(task);

    return {
      success: true,
      data: task,
    };
  } catch (error) {
    console.error('Failed to create task:', error);
    return {
      success: false,
      error: ERROR_MESSAGES.DATABASE_ERROR,
    };
  }
}

// Update an existing task
export async function updateTask(
  id: string,
  updates: Partial<Omit<Task, 'id' | 'createdAt'>>
): Promise<TaskOperationResult<Task>> {
  try {
    // Get existing task
    const existingTask = await getTaskById(id);
    if (!existingTask) {
      return {
        success: false,
        error: 'Task not found',
      };
    }

    // Sanitize updates
    const sanitized = sanitizeTaskInput(updates);

    // Merge with existing task
    const updatedTask: Task = {
      ...existingTask,
      ...sanitized,
      updatedAt: new Date(),
    };

    // Validate updated task
    const validation = validateTask(updatedTask);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.errors.join(', '),
      };
    }

    // Save to database
    await dbUpdateTask(updatedTask);

    return {
      success: true,
      data: updatedTask,
    };
  } catch (error) {
    console.error('Failed to update task:', error);
    return {
      success: false,
      error: ERROR_MESSAGES.DATABASE_ERROR,
    };
  }
}

// Delete a task
export async function deleteTask(id: string): Promise<TaskOperationResult> {
  try {
    const existingTask = await getTaskById(id);
    if (!existingTask) {
      return {
        success: false,
        error: 'Task not found',
      };
    }

    await dbDeleteTask(id);

    return {
      success: true,
    };
  } catch (error) {
    console.error('Failed to delete task:', error);
    return {
      success: false,
      error: ERROR_MESSAGES.DATABASE_ERROR,
    };
  }
}

// Complete a task
export async function completeTask(id: string): Promise<TaskOperationResult<Task>> {
  return updateTask(id, {
    status: 'completed',
    completedAt: new Date(),
  });
}

// Archive a task
export async function archiveTask(id: string): Promise<TaskOperationResult<Task>> {
  return updateTask(id, {
    isArchived: true,
  });
}

// Unarchive a task
export async function unarchiveTask(id: string): Promise<TaskOperationResult<Task>> {
  return updateTask(id, {
    isArchived: false,
  });
}

// Get all tasks with optional filtering and sorting
export async function getTasks(
  options: TaskSearchOptions = {},
  sort: TaskSortOptions = { field: 'createdAt', direction: 'desc' }
): Promise<TaskOperationResult<Task[]>> {
  try {
    let tasks = await getAllTasks();

    // Apply filters
    if (!options.includeArchived) {
      tasks = tasks.filter(task => !task.isArchived);
    }

    if (options.status && options.status.length > 0) {
      tasks = tasks.filter(task => options.status!.includes(task.status));
    }

    if (options.priority && options.priority.length > 0) {
      tasks = tasks.filter(task => options.priority!.includes(task.priority));
    }

    if (options.categoryId) {
      tasks = tasks.filter(task => task.categoryId === options.categoryId);
    }

    if (options.tags && options.tags.length > 0) {
      tasks = tasks.filter(task =>
        options.tags!.some(tag => task.tags.includes(tag))
      );
    }

    if (options.dueDateStart) {
      tasks = tasks.filter(task =>
        task.dueDate && task.dueDate >= options.dueDateStart!
      );
    }

    if (options.dueDateEnd) {
      tasks = tasks.filter(task =>
        task.dueDate && task.dueDate <= options.dueDateEnd!
      );
    }

    if (options.query) {
      const query = options.query.toLowerCase();
      tasks = tasks.filter(task =>
        task.title.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query) ||
        task.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Apply sorting
    tasks.sort((a, b) => {
      let aValue: any = a[sort.field];
      let bValue: any = b[sort.field];

      // Handle date fields
      if (sort.field === 'dueDate' || sort.field === 'createdAt' || sort.field === 'updatedAt') {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      }

      // Handle priority sorting
      if (sort.field === 'priority') {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        aValue = priorityOrder[aValue as Priority];
        bValue = priorityOrder[bValue as Priority];
      }

      // Handle status sorting
      if (sort.field === 'status') {
        const statusOrder = { pending: 1, in_progress: 2, completed: 3 };
        aValue = statusOrder[aValue as TaskStatus];
        bValue = statusOrder[bValue as TaskStatus];
      }

      if (aValue < bValue) {
        return sort.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sort.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });

    // Apply pagination
    if (options.offset || options.limit) {
      const start = options.offset || 0;
      const end = options.limit ? start + options.limit : undefined;
      tasks = tasks.slice(start, end);
    }

    return {
      success: true,
      data: tasks,
    };
  } catch (error) {
    console.error('Failed to get tasks:', error);
    return {
      success: false,
      error: ERROR_MESSAGES.DATABASE_ERROR,
    };
  }
}

// Get tasks by specific criteria
export async function getTasksByStatusFilter(status: TaskStatus): Promise<TaskOperationResult<Task[]>> {
  try {
    const tasks = await getTasksByStatus(status);
    return {
      success: true,
      data: tasks,
    };
  } catch (error) {
    console.error('Failed to get tasks by status:', error);
    return {
      success: false,
      error: ERROR_MESSAGES.DATABASE_ERROR,
    };
  }
}

export async function getTasksByCategoryFilter(categoryId: string): Promise<TaskOperationResult<Task[]>> {
  try {
    const tasks = await getTasksByCategory(categoryId);
    return {
      success: true,
      data: tasks,
    };
  } catch (error) {
    console.error('Failed to get tasks by category:', error);
    return {
      success: false,
      error: ERROR_MESSAGES.DATABASE_ERROR,
    };
  }
}

export async function getOverdueTasksFilter(): Promise<TaskOperationResult<Task[]>> {
  try {
    const tasks = await getOverdueTasks();
    return {
      success: true,
      data: tasks,
    };
  } catch (error) {
    console.error('Failed to get overdue tasks:', error);
    return {
      success: false,
      error: ERROR_MESSAGES.DATABASE_ERROR,
    };
  }
}

// Bulk operations
export async function createTasksBulk(
  tasksData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>[]
): Promise<TaskOperationResult<Task[]>> {
  try {
    const now = new Date();
    const tasks: Task[] = tasksData.map(taskData => {
      const sanitized = sanitizeTaskInput(taskData);
      return {
        id: generateTaskId(),
        title: sanitized.title || '',
        description: sanitized.description,
        priority: sanitized.priority || 'medium',
        status: sanitized.status || 'pending',
        dueDate: sanitized.dueDate,
        categoryId: sanitized.categoryId,
        tags: sanitized.tags || [],
        isArchived: sanitized.isArchived || false,
        createdAt: now,
        updatedAt: now,
      };
    });

    // Validate all tasks
    const validationErrors: string[] = [];
    for (let i = 0; i < tasks.length; i++) {
      const validation = validateTask(tasks[i]);
      if (!validation.isValid) {
        validationErrors.push(`Task ${i + 1}: ${validation.errors.join(', ')}`);
      }
    }

    if (validationErrors.length > 0) {
      return {
        success: false,
        error: validationErrors.join('; '),
      };
    }

    await bulkCreateTasks(tasks);

    return {
      success: true,
      data: tasks,
    };
  } catch (error) {
    console.error('Failed to create tasks in bulk:', error);
    return {
      success: false,
      error: ERROR_MESSAGES.DATABASE_ERROR,
    };
  }
}

export async function deleteTasksBulk(ids: string[]): Promise<TaskOperationResult> {
  try {
    await bulkDeleteTasks(ids);
    return {
      success: true,
    };
  } catch (error) {
    console.error('Failed to delete tasks in bulk:', error);
    return {
      success: false,
      error: ERROR_MESSAGES.DATABASE_ERROR,
    };
  }
}

// Task statistics
export async function getTaskStatistics(): Promise<TaskOperationResult<{
  total: number;
  completed: number;
  pending: number;
  inProgress: number;
  overdue: number;
  byPriority: Record<Priority, number>;
  byCategory: Record<string, number>;
}>> {
  try {
    const tasks = await getAllTasks();
    const now = new Date();

    const stats = {
      total: tasks.length,
      completed: tasks.filter(t => t.status === 'completed').length,
      pending: tasks.filter(t => t.status === 'pending').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      overdue: tasks.filter(t => 
        t.dueDate && 
        new Date(t.dueDate) < now && 
        t.status !== 'completed'
      ).length,
      byPriority: {
        low: tasks.filter(t => t.priority === 'low').length,
        medium: tasks.filter(t => t.priority === 'medium').length,
        high: tasks.filter(t => t.priority === 'high').length,
      },
      byCategory: tasks.reduce((acc, task) => {
        const categoryId = task.categoryId || 'uncategorized';
        acc[categoryId] = (acc[categoryId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    return {
      success: true,
      data: stats,
    };
  } catch (error) {
    console.error('Failed to get task statistics:', error);
    return {
      success: false,
      error: ERROR_MESSAGES.DATABASE_ERROR,
    };
  }
}