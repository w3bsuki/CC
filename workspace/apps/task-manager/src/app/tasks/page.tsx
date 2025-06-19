'use client';

import React from 'react';
import { Navigation } from '@/components/layout/Navigation';
import { TaskList } from '@/components/task/TaskList';

export default function TasksPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main>
        <TaskList />
      </main>
    </div>
  );
}