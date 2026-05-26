// KanbanColumn.jsx — droppable column with sortable task list
//
// POLISH: column highlight on isOver uses a smoother transition.
// Empty state animates more expressively during drag-over.
// Add task button has a more satisfying hover state.

import React, { useState, memo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import TaskCard from './TaskCard';

const COLUMN_META = {
  todo: {
    label:    'To Do',
    emoji:    '📋',
    accent:   'border-nibbli-purple/40',
    badge:    'bg-nibbli-purple/20 text-nibbli-purpleDark',
    btnColor: 'text-nibbli-purpleDark hover:bg-nibbli-purple/10',
    dropBg:   'bg-nibbli-purple/5',
    dropRing: 'ring-2 ring-nibbli-purple/20',
  },
  doing: {
    label:    'Doing',
    emoji:    '⚡',
    accent:   'border-nibbli-yellow/60',
    badge:    'bg-nibbli-yellow/40 text-yellow-700',
    btnColor: 'text-yellow-600 hover:bg-nibbli-yellow/20',
    dropBg:   'bg-nibbli-yellow/10',
    dropRing: 'ring-2 ring-yellow-200',
  },
  done: {
    label:    'Done',
    emoji:    '✅',
    accent:   'border-emerald-300',
    badge:    'bg-emerald-100 text-emerald-700',
    btnColor: 'text-emerald-600 hover:bg-emerald-50',
    dropBg:   'bg-emerald-50',
    dropRing: 'ring-2 ring-emerald-200',
  },
};

function KanbanColumnInner({ status, tasks, editingMap, onDelete, onCreateTask }) {
  const [adding,   setAdding]   = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const meta = COLUMN_META[status];
  const { setNodeRef, isOver } = useDroppable({ id: status });

  const handleAdd = (e) => {
    e.preventDefault();
    if (newTitle.trim()) {
      onCreateTask(newTitle.trim());
      setNewTitle('');
      setAdding(false);
    }
  };

  return (
    <div
      className={`
        flex flex-col rounded-xl2 border-t-2 ${meta.accent}
        border border-nibbli-border min-h-0 flex-1
        transition-all duration-200 ease-out
        ${isOver ? `${meta.dropBg} ${meta.dropRing}` : 'bg-nibbli-bg'}
      `}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-nibbli-border">
        <span className="text-base">{meta.emoji}</span>
        <h3 className="font-semibold text-sm text-nibbli-text">{meta.label}</h3>
        <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full transition-all ${meta.badge}`}>
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3 space-y-2.5"
      >
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              editingBy={editingMap[task.id] || null}
              onDelete={onDelete}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && !adding && (
          <div
            className={`
              flex flex-col items-center justify-center h-20 rounded-xl
              border-2 border-dashed text-xs transition-all duration-200
              ${isOver
                ? 'border-nibbli-purple/50 text-nibbli-purpleDark bg-white scale-[1.02]'
                : 'border-nibbli-border text-nibbli-muted'
              }
            `}
          >
            {isOver ? (
              <>
                <span className="text-lg mb-0.5">✦</span>
                <span>Drop here</span>
              </>
            ) : 'No tasks yet'}
          </div>
        )}
      </div>

      {/* Add task */}
      <div className="px-3 pb-3">
        {adding ? (
          <form onSubmit={handleAdd} className="space-y-2">
            <textarea
              autoFocus
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) handleAdd(e);
                if (e.key === 'Escape') { setAdding(false); setNewTitle(''); }
              }}
              placeholder="Task title…"
              rows={2}
              maxLength={120}
              className="
                w-full px-3 py-2 text-sm rounded-xl border border-nibbli-border
                bg-white text-nibbli-text placeholder-nibbli-muted resize-none
                focus:outline-none focus:ring-2 focus:ring-nibbli-purple transition
              "
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!newTitle.trim()}
                className="
                  flex-1 py-1.5 rounded-lg text-xs font-semibold
                  bg-nibbli-purpleDark text-white
                  hover:opacity-90 active:scale-95
                  disabled:opacity-40 transition-all duration-150
                "
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => { setAdding(false); setNewTitle(''); }}
                className="
                  flex-1 py-1.5 rounded-lg text-xs font-semibold
                  bg-nibbli-bg text-nibbli-muted
                  hover:bg-nibbli-border active:scale-95
                  transition-all duration-150
                "
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className={`
              w-full py-2 rounded-xl text-xs font-medium
              border border-dashed border-nibbli-border
              hover:border-solid hover:scale-[1.01]
              active:scale-[0.99]
              ${meta.btnColor} transition-all duration-150
            `}
          >
            + Add task
          </button>
        )}
      </div>
    </div>
  );
}

// Memo: re-render only when tasks, editingMap, or handlers actually change
const KanbanColumn = memo(KanbanColumnInner, (prev, next) =>
  prev.status   === next.status   &&
  prev.tasks    === next.tasks    &&
  prev.editingMap === next.editingMap &&
  prev.onDelete === next.onDelete &&
  prev.onCreateTask === next.onCreateTask
);
export default KanbanColumn;
