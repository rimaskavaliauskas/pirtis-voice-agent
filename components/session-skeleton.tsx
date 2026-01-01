'use client';

interface SessionSkeletonProps {
  className?: string;
}

/**
 * Skeleton loading state for the session page
 * Reduces perceived load time by showing the expected layout structure
 */
export function SessionSkeleton({ className = '' }: SessionSkeletonProps) {
  return (
    <main className={`min-h-screen p-4 md:p-8 ${className}`}>
      <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
        {/* Header skeleton */}
        <div className="text-center space-y-4">
          {/* Title */}
          <div className="h-8 bg-muted rounded-lg w-64 mx-auto" />
          {/* Round indicator */}
          <div className="flex items-center justify-center gap-2">
            <div className="h-6 bg-muted rounded-full w-24" />
            <div className="h-6 bg-muted rounded-full w-32" />
          </div>
        </div>

        {/* Questions grid skeleton */}
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="border rounded-xl p-4 space-y-3 bg-card"
            >
              {/* Question header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-muted" />
                  <div className="h-4 bg-muted rounded w-20" />
                </div>
                <div className="h-6 bg-muted rounded-full w-16" />
              </div>
              {/* Question text */}
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-full" />
                <div className="h-4 bg-muted rounded w-4/5" />
                <div className="h-4 bg-muted rounded w-3/5" />
              </div>
            </div>
          ))}
        </div>

        {/* Active question area skeleton */}
        <div className="border rounded-xl p-6 bg-card">
          <div className="space-y-6">
            {/* Question title */}
            <div className="text-center space-y-3">
              <div className="h-5 bg-muted rounded w-24 mx-auto" />
              <div className="h-4 bg-muted rounded w-3/4 mx-auto" />
            </div>

            {/* Audio recorder placeholder */}
            <div className="max-w-sm mx-auto">
              <div className="flex flex-col items-center gap-4 py-8">
                {/* Microphone button */}
                <div className="w-20 h-20 rounded-full bg-muted" />
                {/* Instructions */}
                <div className="h-4 bg-muted rounded w-48" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default SessionSkeleton;
