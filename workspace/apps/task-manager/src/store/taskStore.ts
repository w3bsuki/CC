import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { Task, Category, TaskFilter, TaskSort, Priority, TaskStatus } from './types';

interface TaskState {
  tasks: Task[];
  categories: Category[];
  filter: TaskFilter;
  sort: TaskSort;
  
  // Actions
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  completeTask: (id: string) => void;
  archiveTask: (id: string) => void;
  unarchiveTask: (id: string) => void;
  
  addCategory: (category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
  
  setFilter: (filter: Partial<TaskFilter>) => void;
  clearFilter: () => void;
  setSort: (sort: TaskSort) => void;
  
  getFilteredTasks: () => Task[];
  getTasksByCategory: (categoryId: string) => Task[];
  getTasksByStatus: (status: TaskStatus) => Task[];
  getOverdueTasks: () => Task[];
}

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

export const useTaskStore = create<TaskState>()(
  devtools(
    persist(
      (set, get) => ({
        tasks: [],
        categories: [
          {
            id: 'default',
            name: 'Personal',
            color: '#3b82f6',
            description: 'Personal tasks',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'work',
            name: 'Work',
            color: '#ef4444',
            description: 'Work-related tasks',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        filter: {},
        sort: { field: 'dueDate', direction: 'asc' },

        addTask: (taskData) => {
          const newTask: Task = {
            ...taskData,
            id: generateId(),
            createdAt: new Date(),
            updatedAt: new Date(),
            isArchived: false,
          };
          set((state) => ({
            tasks: [...state.tasks, newTask],
          }));
        },

        updateTask: (id, updates) => {
          set((state) => ({
            tasks: state.tasks.map((task) =>
              task.id === id
                ? { ...task, ...updates, updatedAt: new Date() }
                : task
            ),
          }));
        },

        deleteTask: (id) => {
          set((state) => ({
            tasks: state.tasks.filter((task) => task.id !== id),
          }));
        },

        completeTask: (id) => {
          set((state) => ({
            tasks: state.tasks.map((task) =>
              task.id === id
                ? {
                    ...task,
                    status: 'completed' as TaskStatus,
                    completedAt: new Date(),
                    updatedAt: new Date(),
                  }
                : task
            ),
          }));
        },

        archiveTask: (id) => {
          set((state) => ({
            tasks: state.tasks.map((task) =>
              task.id === id
                ? { ...task, isArchived: true, updatedAt: new Date() }
                : task
            ),
          }));
        },

        unarchiveTask: (id) => {
          set((state) => ({
            tasks: state.tasks.map((task) =>
              task.id === id
                ? { ...task, isArchived: false, updatedAt: new Date() }
                : task
            ),
          }));
        },

        addCategory: (categoryData) => {
          const newCategory: Category = {
            ...categoryData,
            id: generateId(),
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          set((state) => ({
            categories: [...state.categories, newCategory],
          }));
        },

        updateCategory: (id, updates) => {
          set((state) => ({
            categories: state.categories.map((category) =>
              category.id === id
                ? { ...category, ...updates, updatedAt: new Date() }
                : category
            ),
          }));
        },

        deleteCategory: (id) => {
          set((state) => ({
            categories: state.categories.filter((category) => category.id !== id),
            tasks: state.tasks.map((task) =>
              task.categoryId === id
                ? { ...task, categoryId: undefined, updatedAt: new Date() }
                : task
            ),
          }));
        },

        setFilter: (newFilter) => {
          set((state) => ({
            filter: { ...state.filter, ...newFilter },
          }));
        },

        clearFilter: () => {
          set({ filter: {} });
        },

        setSort: (sort) => {
          set({ sort });
        },

        getFilteredTasks: () => {
          const { tasks, filter } = get();
          let filteredTasks = tasks;

          if (filter.status) {
            filteredTasks = filteredTasks.filter((task) =>
              filter.status!.includes(task.status)
            );
          }

          if (filter.priority) {
            filteredTasks = filteredTasks.filter((task) =>
              filter.priority!.includes(task.priority)
            );
          }

          if (filter.categoryId) {
            filteredTasks = filteredTasks.filter(
              (task) => task.categoryId === filter.categoryId
            );
          }

          if (filter.tags && filter.tags.length > 0) {
            filteredTasks = filteredTasks.filter((task) =>
              filter.tags!.some((tag) => task.tags.includes(tag))
            );
          }

          if (filter.search) {
            const searchLower = filter.search.toLowerCase();
            filteredTasks = filteredTasks.filter(
              (task) =>
                task.title.toLowerCase().includes(searchLower) ||
                task.description?.toLowerCase().includes(searchLower)
            );
          }

          if (filter.isArchived !== undefined) {
            filteredTasks = filteredTasks.filter(
              (task) => task.isArchived === filter.isArchived
            );
          }

          if (filter.dueDateRange) {
            filteredTasks = filteredTasks.filter((task) => {
              if (!task.dueDate) return false;
              const dueDate = new Date(task.dueDate);
              if (filter.dueDateRange!.start && dueDate < filter.dueDateRange!.start) {
                return false;
              }
              if (filter.dueDateRange!.end && dueDate > filter.dueDateRange!.end) {
                return false;
              }
              return true;
            });
          }

          return filteredTasks;
        },

        getTasksByCategory: (categoryId) => {
          return get().tasks.filter((task) => task.categoryId === categoryId);
        },

        getTasksByStatus: (status) => {
          return get().tasks.filter((task) => task.status === status);
        },

        getOverdueTasks: () => {
          const now = new Date();
          return get().tasks.filter(
            (task) =>
              task.dueDate &&
              new Date(task.dueDate) < now &&
              task.status !== 'completed'
          );
        },
      }),
      {
        name: 'task-storage',
        version: 1,
      }
    ),
    {
      name: 'task-store',
    }
  )
);