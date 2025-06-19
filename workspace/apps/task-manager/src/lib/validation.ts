import { Task, Category, Priority, TaskStatus } from '@/store/types';
import { VALIDATION_RULES, ERROR_MESSAGES, PRIORITIES, TASK_STATUSES } from './constants';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateTask(task: Partial<Task>): ValidationResult {
  const errors: string[] = [];

  // Title validation
  if (!task.title || task.title.trim().length === 0) {
    errors.push(ERROR_MESSAGES.TASK_TITLE_REQUIRED);
  } else if (task.title.length > VALIDATION_RULES.TASK_TITLE_MAX_LENGTH) {
    errors.push(ERROR_MESSAGES.TASK_TITLE_TOO_LONG);
  }

  // Description validation
  if (task.description && task.description.length > VALIDATION_RULES.TASK_DESCRIPTION_MAX_LENGTH) {
    errors.push(ERROR_MESSAGES.TASK_DESCRIPTION_TOO_LONG);
  }

  // Priority validation
  if (task.priority && !isValidPriority(task.priority)) {
    errors.push(ERROR_MESSAGES.INVALID_PRIORITY);
  }

  // Status validation
  if (task.status && !isValidStatus(task.status)) {
    errors.push(ERROR_MESSAGES.INVALID_STATUS);
  }

  // Due date validation
  if (task.dueDate && !isValidDate(task.dueDate)) {
    errors.push(ERROR_MESSAGES.INVALID_DATE);
  }

  // Tags validation
  if (task.tags) {
    if (task.tags.length > VALIDATION_RULES.MAX_TAGS_PER_TASK) {
      errors.push(`Cannot have more than ${VALIDATION_RULES.MAX_TAGS_PER_TASK} tags per task`);
    }

    for (const tag of task.tags) {
      if (tag.length < VALIDATION_RULES.TAG_MIN_LENGTH || tag.length > VALIDATION_RULES.TAG_MAX_LENGTH) {
        errors.push(`Tag "${tag}" must be between ${VALIDATION_RULES.TAG_MIN_LENGTH} and ${VALIDATION_RULES.TAG_MAX_LENGTH} characters`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateCategory(category: Partial<Category>): ValidationResult {
  const errors: string[] = [];

  // Name validation
  if (!category.name || category.name.trim().length === 0) {
    errors.push(ERROR_MESSAGES.CATEGORY_NAME_REQUIRED);
  } else if (category.name.length > VALIDATION_RULES.CATEGORY_NAME_MAX_LENGTH) {
    errors.push(ERROR_MESSAGES.CATEGORY_NAME_TOO_LONG);
  }

  // Description validation
  if (category.description && category.description.length > VALIDATION_RULES.CATEGORY_DESCRIPTION_MAX_LENGTH) {
    errors.push(`Category description cannot exceed ${VALIDATION_RULES.CATEGORY_DESCRIPTION_MAX_LENGTH} characters`);
  }

  // Color validation
  if (category.color && !isValidHexColor(category.color)) {
    errors.push('Invalid color format. Please use a valid hex color code.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function isValidPriority(priority: string): priority is Priority {
  return Object.values(PRIORITIES).includes(priority as Priority);
}

export function isValidStatus(status: string): status is TaskStatus {
  return Object.values(TASK_STATUSES).includes(status as TaskStatus);
}

export function isValidDate(date: Date | string): boolean {
  if (typeof date === 'string') {
    const parsedDate = new Date(date);
    return !isNaN(parsedDate.getTime());
  }
  return date instanceof Date && !isNaN(date.getTime());
}

export function isValidHexColor(color: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

export function sanitizeTaskInput(input: Partial<Task>): Partial<Task> {
  const sanitized: Partial<Task> = {};

  if (input.title !== undefined) {
    sanitized.title = input.title.trim();
  }

  if (input.description !== undefined) {
    sanitized.description = input.description.trim() || undefined;
  }

  if (input.priority !== undefined && isValidPriority(input.priority)) {
    sanitized.priority = input.priority;
  }

  if (input.status !== undefined && isValidStatus(input.status)) {
    sanitized.status = input.status;
  }

  if (input.dueDate !== undefined) {
    sanitized.dueDate = input.dueDate instanceof Date ? input.dueDate : new Date(input.dueDate);
  }

  if (input.categoryId !== undefined) {
    sanitized.categoryId = input.categoryId.trim() || undefined;
  }

  if (input.tags !== undefined) {
    sanitized.tags = input.tags
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)
      .slice(0, VALIDATION_RULES.MAX_TAGS_PER_TASK);
  }

  if (input.isArchived !== undefined) {
    sanitized.isArchived = Boolean(input.isArchived);
  }

  return sanitized;
}

export function sanitizeCategoryInput(input: Partial<Category>): Partial<Category> {
  const sanitized: Partial<Category> = {};

  if (input.name !== undefined) {
    sanitized.name = input.name.trim();
  }

  if (input.description !== undefined) {
    sanitized.description = input.description.trim() || undefined;
  }

  if (input.color !== undefined && isValidHexColor(input.color)) {
    sanitized.color = input.color.toLowerCase();
  }

  return sanitized;
}

export function validateTaskUpdate(existingTask: Task, updates: Partial<Task>): ValidationResult {
  const mergedTask = { ...existingTask, ...updates };
  return validateTask(mergedTask);
}

export function validateCategoryUpdate(existingCategory: Category, updates: Partial<Category>): ValidationResult {
  const mergedCategory = { ...existingCategory, ...updates };
  return validateCategory(mergedCategory);
}

// Validation for bulk operations
export function validateTaskBatch(tasks: Partial<Task>[]): { valid: Partial<Task>[]; invalid: { task: Partial<Task>; errors: string[] }[] } {
  const valid: Partial<Task>[] = [];
  const invalid: { task: Partial<Task>; errors: string[] }[] = [];

  for (const task of tasks) {
    const validation = validateTask(task);
    if (validation.isValid) {
      valid.push(task);
    } else {
      invalid.push({ task, errors: validation.errors });
    }
  }

  return { valid, invalid };
}

export function validateCategoryBatch(categories: Partial<Category>[]): { valid: Partial<Category>[]; invalid: { category: Partial<Category>; errors: string[] }[] } {
  const valid: Partial<Category>[] = [];
  const invalid: { category: Partial<Category>; errors: string[] }[] = [];

  for (const category of categories) {
    const validation = validateCategory(category);
    if (validation.isValid) {
      valid.push(category);
    } else {
      invalid.push({ category, errors: validation.errors });
    }
  }

  return { valid, invalid };
}