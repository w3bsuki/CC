'use client';

import React, { useEffect, useState } from 'react';
import { useTaskStore } from '@/store';
import { TaskItem } from './TaskItem';
import { TaskForm } from './TaskForm';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Task, TaskStatus, Priority } from '@/store/types';

export function TaskList() {
  const {
    tasks,
    filter,
    sort,
    setFilter,
    setSort,
    getFilteredTasks,
  } = useTaskStore();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);

  useEffect(() => {
    const filtered = getFilteredTasks();
    setFilteredTasks(filtered);
  }, [tasks, filter, sort, getFilteredTasks]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setFilter({ search: query });
  };

  const handleStatusFilter = (status: TaskStatus | 'all') => {
    if (status === 'all') {
      setFilter({ status: undefined });
    } else {
      setFilter({ status: [status] });
    }
  };

  const handlePriorityFilter = (priority: Priority | 'all') => {
    if (priority === 'all') {
      setFilter({ priority: undefined });
    } else {
      setFilter({ priority: [priority] });
    }
  };

  const handleSort = (field: string) => {
    const direction = sort.field === field && sort.direction === 'asc' ? 'desc' : 'asc';
    setSort({ field: field as any, direction });
  };

  const statusCounts = {
    all: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">My Tasks</h1>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          + New Task
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <Input
              type="search"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              onChange={(e) => handleStatusFilter(e.target.value as any)}
              className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status ({statusCounts.all})</option>
              <option value="pending">Pending ({statusCounts.pending})</option>
              <option value="in_progress">In Progress ({statusCounts.in_progress})</option>
              <option value="completed">Completed ({statusCounts.completed})</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <select
              onChange={(e) => handlePriorityFilter(e.target.value as any)}
              className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Priority</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>
        </div>

        {/* Sort Options */}
        <div className="flex gap-2 mt-4">
          <span className="text-sm text-gray-600">Sort by:</span>
          <button
            onClick={() => handleSort('dueDate')}
            className={`text-sm px-2 py-1 rounded ${
              sort.field === 'dueDate' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Due Date {sort.field === 'dueDate' && (sort.direction === 'asc' ? '↑' : '↓')}
          </button>
          <button
            onClick={() => handleSort('priority')}
            className={`text-sm px-2 py-1 rounded ${
              sort.field === 'priority' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Priority {sort.field === 'priority' && (sort.direction === 'asc' ? '↑' : '↓')}
          </button>
          <button
            onClick={() => handleSort('createdAt')}
            className={`text-sm px-2 py-1 rounded ${
              sort.field === 'createdAt' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Created {sort.field === 'createdAt' && (sort.direction === 'asc' ? '↑' : '↓')}
          </button>
        </div>
      </div>

      {/* Tasks Grid */}
      <div className="space-y-4">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <div className="text-gray-400 text-6xl mb-4">📝</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks found</h3>
            <p className="text-gray-600 mb-4">
              {searchQuery || filter.status || filter.priority 
                ? 'Try adjusting your filters or search query.'
                : 'Get started by creating your first task!'
              }
            </p>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              Create Your First Task
            </Button>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <TaskItem key={task.id} task={task} />
          ))
        )}
      </div>

      {/* Create Task Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Task"
        size="lg"
      >
        <TaskForm onClose={() => setIsCreateModalOpen(false)} />
      </Modal>
    </div>
  );
}