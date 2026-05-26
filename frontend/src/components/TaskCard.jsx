// TaskCard.jsx — draggable task card with delete button
//
// POLISH: hover shadow uses a pseudo-element opacity trick (via Tailwind's
// group + before: pseudo) so hover effects are GPU-composited, not repaints.
// The translate on hover gives a satisfying "lift" feel.
// DragOverlay card gets a stronger shadow + rotation for physical drag feel.

import React, { memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function TaskCardInner({ task, editingBy, onDelete }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    // CSS.Transform.toString uses translate3d — GPU composited
    transform:  CSS.Transform.toString(transform),
    // Use dnd-kit's own transition string at all times.
    // dnd-kit sets this to null while dragging (no transition during drag)
    // and supplies a settle transition on drop. Never override it with our
    // own CSS — two competing transitions on the same property cause the glitch.
    transition,
    opacity:    isDragging ? 0.35 : 1,
    cursor:     'none',
    willChange: isDragging ? 'transform' : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        group bg-white rounded-xl2 border border-nibbli-border
        shadow-card relative select-none
        hover:shadow-[0_6px_20px_rgba(139,92,246,0.16)]
        hover:-translate-y-0.5
        active:scale-[0.98]
        transition-[box-shadow] duration-150 ease-out
        ${isDragging ? 'ring-2 ring-nibbli-purple/50 z-50' : ''}
      `}
    >
      {/* Editing indicator */}
      {editingBy && (
        <div className="flex items-center gap-1 mb-2 text-xs text-nibbli-purpleDark font-medium animate-pulse px-3.5 pt-3">
          <span>✏️</span>
          <span>{editingBy} is editing…</span>
        </div>
      )}

      <div className="px-3.5 py-3">
        {/* Task title */}
        <p className="text-sm font-medium text-nibbli-text leading-snug pr-6">
          {task.title}
        </p>

        {/* Meta row */}
        <div className="flex items-center justify-between mt-2.5">
          <span className="text-xs text-nibbli-muted">by {task.createdBy}</span>
          <span className="text-xs text-nibbli-muted">{timeAgo(task.createdAt)}</span>
        </div>
      </div>

      {/* Delete button — pointer-events isolated so it doesn't trigger drag */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
        onPointerDown={(e) => e.stopPropagation()}
        className="
          absolute top-2.5 right-2.5
          opacity-0 group-hover:opacity-100
          w-6 h-6 rounded-md flex items-center justify-center
          text-nibbli-muted hover:bg-red-50 hover:text-red-400
          transition-all duration-150 text-xs
        "
        title="Delete task"
      >
        ✕
      </button>
    </div>
  );
}

// Memo: only re-render when task data, editingBy, or onDelete changes.
// This prevents unrelated board state updates from re-rendering every card.
const TaskCard = memo(TaskCardInner, (prev, next) =>
  prev.task.id        === next.task.id        &&
  prev.task.title     === next.task.title     &&
  prev.task.status    === next.task.status    &&
  prev.editingBy      === next.editingBy      &&
  prev.onDelete       === next.onDelete
);
export default TaskCard;

function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000)   return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}
