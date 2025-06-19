'use client';

import React, { useState } from 'react';
import { useTaskStore } from '@/store';
import { Task, TaskStatus } from '@/store/types';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { TaskForm } from './TaskForm';
import { format } from 'date-fns';

interface TaskItemProps {
  task: Task;
}

export function TaskItem({ task }: TaskItemProps) {
  const { updateTask, deleteTask, completeTask } = useTaskStore();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const priorityColors = {
    low: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-red-100 text-red-800',
  };

  const statusColors = {
    pending: 'bg-gray-100 text-gray-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
  };

  const handleStatusChange = (newStatus: TaskStatus) => {
    if (newStatus === 'completed') {
      completeTask(task.id);
    } else {
      updateTask(task.id, { status: newStatus });
    }
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this task?')) {
      deleteTask(task.id);
    }
  };

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';

  return (
    <>
      <div className={`bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow ${
        isOverdue ? 'border-l-4 border-red-500' : ''
      }`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Title and Status */}
            <div className="flex items-center gap-3 mb-2">
              <h3 className={`text-lg font-semibold ${
                task.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-900'
              }`}>
                {task.title}
              </h3>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${priorityColors[task.priority]}`}>
                {task.priority}
              </span>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[task.status]}`}>
                {task.status.replace('_', ' ')}
              </span>
            </div>

            {/* Description */}
            {task.description && (
              <p className="text-gray-600 mb-3">{task.description}</p>
            )}

            {/* Meta Information */}
            <div className="flex flex-wrap gap-4 text-sm text-gray-500">
              {task.dueDate && (
                <div className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-medium' : ''}`}>
                  <span>📅</span>
                  <span>Due: {format(new Date(task.dueDate), 'MMM dd, yyyy')}</span>
                  {isOverdue && <span className="text-red-600 font-bold">OVERDUE</span>}
                </div>
              )}
              <div className="flex items-center gap-1">
                <span>📁</span>
                <span>Category: {task.categoryId || 'None'}</span>
              </div>
              <div className="flex items-center gap-1">
                <span>🕒</span>
                <span>Created: {format(new Date(task.createdAt), 'MMM dd, yyyy')}</span>
              </div>
            </div>

            {/* Tags */}
            {task.tags && task.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {task.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 ml-4">
            {/* Status Toggle */}
            <select
              value={task.status}
              onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
              className="text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditModalOpen(true)}
              >
                ✏️
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={handleDelete}
              >
                🗑️
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Task"
        size="lg"
      >
        <TaskForm 
          task={task}
          onClose={() => setIsEditModalOpen(false)} 
        />
      </Modal>
    </>
  );
}