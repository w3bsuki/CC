export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Task Manager PWA
        </h1>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600">
            Welcome to your offline-first task management application.
          </p>
          <p className="text-sm text-gray-500 mt-4">
            This PWA is built with Next.js 15, TypeScript, and IndexedDB for complete offline functionality.
          </p>
        </div>
      </div>
    </main>
  );
}