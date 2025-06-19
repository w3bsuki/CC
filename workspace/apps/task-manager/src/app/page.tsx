'use client';

import React, { useEffect, useState } from 'react';
import { useTaskStore } from '@/store';
import { Navigation } from '@/components/layout/Navigation';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

export default function Dashboard() {
  const { tasks, getTasksByStatus, getOverdueTasks } = useTaskStore();
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    overdue: 0,
  });

  useEffect(() => {
    const pending = getTasksByStatus('pending');
    const inProgress = getTasksByStatus('in_progress');
    const completed = getTasksByStatus('completed');
    const overdue = getOverdueTasks();

    setStats({
      total: tasks.length,
      pending: pending.length,
      inProgress: inProgress.length,
      completed: completed.length,
      overdue: overdue.length,
    });
  }, [tasks, getTasksByStatus, getOverdueTasks]);

  const recentTasks = tasks
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const upcomingTasks = tasks
    .filter(task => task.dueDate && task.status !== 'completed')
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">Welcome back! Here's what's happening with your tasks.</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-bold">📋</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Tasks</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                  <span className="text-yellow-600 font-bold">⏳</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Pending</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-bold">🔄</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">In Progress</p>
                <p className="text-2xl font-bold text-gray-900">{stats.inProgress}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 font-bold">✅</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Completed</p>
                <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-600 font-bold">🚨</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Overdue</p>
                <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Tasks */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Recent Tasks</h2>
                <Link href="/tasks" className="text-blue-600 hover:text-blue-700 text-sm">
                  View all →
                </Link>
              </div>
            </div>
            <div className="p-6">
              {recentTasks.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-gray-500">No tasks yet</p>
                  <Button className="mt-4">Create Your First Task</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentTasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{task.title}</h3>
                        <p className="text-sm text-gray-500">{task.priority} priority</p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        task.status === 'completed' ? 'bg-green-100 text-green-800' :
                        task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {task.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Upcoming Deadlines */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Upcoming Deadlines</h2>
                <Link href="/tasks" className="text-blue-600 hover:text-blue-700 text-sm">
                  View all →
                </Link>
              </div>
            </div>
            <div className="p-6">
              {upcomingTasks.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-gray-500">No upcoming deadlines</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {upcomingTasks.map((task) => {
                    const dueDate = new Date(task.dueDate!);
                    const isOverdue = dueDate < new Date();
                    const daysUntilDue = Math.ceil((dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                    
                    return (
                      <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">{task.title}</h3>
                          <p className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                            {isOverdue ? 'Overdue' : daysUntilDue === 0 ? 'Due today' : `Due in ${daysUntilDue} days`}
                          </p>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          task.priority === 'high' ? 'bg-red-100 text-red-800' :
                          task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {task.priority}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button className="justify-center">
                📝 Create New Task
              </Button>
              <Link href="/tasks">
                <Button variant="secondary" className="w-full justify-center">
                  📋 View All Tasks
                </Button>
              </Link>
              <Link href="/categories">
                <Button variant="secondary" className="w-full justify-center">
                  📁 Manage Categories
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}