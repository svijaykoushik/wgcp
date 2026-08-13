import React from 'react';

export function SkeletonCard({ index = 0 }: { index?: number }) {
  return (
    <div
      className="flex flex-col p-6 bg-bg-secondary/70 border border-card-border rounded-2xl card-stagger-enter select-none"
      style={{ '--stagger-index': index } as React.CSSProperties}
    >
      {/* Icon + Badge row */}
      <div className="flex items-center justify-between mb-4">
        <div className="skeleton w-12 h-12 rounded-xl" />
        <div className="skeleton w-20 h-5 rounded-full" />
      </div>

      {/* Title */}
      <div className="skeleton w-3/4 h-6 rounded-md mb-2" />

      {/* Description */}
      <div className="space-y-1.5 mb-4">
        <div className="skeleton w-full h-4 rounded-md" />
        <div className="skeleton w-2/3 h-4 rounded-md" />
      </div>

      {/* Genre tags */}
      <div className="flex gap-2 mb-6">
        <div className="skeleton w-16 h-5 rounded-md" />
        <div className="skeleton w-12 h-5 rounded-md" />
      </div>

      {/* Button */}
      <div className="skeleton w-full h-10 rounded-xl mt-auto" />
    </div>
  );
}
export default SkeletonCard;
