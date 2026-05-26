// KanbanBoard.jsx — DnDContext root with live cursor overlay

import React, { useState, useRef, memo } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import KanbanColumn  from './KanbanColumn';
import TaskCard      from './TaskCard';
import CursorOverlay from './CursorOverlay';
import LocalCursor   from './LocalCursor';
import { useCursor } from '../hooks/useCursor';

const STATUSES = ['todo', 'doing', 'done'];

function KanbanBoardInner({
  tasks, editingMap,
  onMove, onDelete, onCreate,
  user, currentRoom,
}) {
  const [activeTask, setActiveTask] = useState(null);
  const boardRef = useRef(null);

  const {
    localState,
    remoteCursors,
    setDraggingState,
    INACTIVITY_MS,
  } = useCursor(currentRoom, user, boardRef);

  // POLISH: distance:5 prevents accidental drag on fast clicks.
  // delay alternative would be jankier for a Kanban card.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const tasksByStatus = STATUSES.reduce((acc, s) => {
    acc[s] = tasks.filter(t => t.status === s);
    return acc;
  }, {});

  function findColumnOfTask(taskId) {
    return STATUSES.find(s => tasksByStatus[s].some(t => t.id === taskId));
  }

  function handleDragStart({ active }) {
    const task = tasks.find(t => t.id === active.id);
    setActiveTask(task || null);
    setDraggingState(true);
  }

  function handleDragEnd({ active, over }) {
    setActiveTask(null);
    setDraggingState(false);
    if (!over) return;

    const draggedId = active.id;
    const overId    = over.id;
    const sourceCol = findColumnOfTask(draggedId);
    const targetCol = STATUSES.includes(overId)
      ? overId
      : findColumnOfTask(overId);

    if (!sourceCol || !targetCol) return;
    if (sourceCol !== targetCol) onMove(draggedId, targetCol);
  }

  function handleDragCancel() {
    setActiveTask(null);
    setDraggingState(false);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div
        ref={boardRef}
        className="flex gap-4 h-full min-h-0"
        style={{ position: 'relative', cursor: 'none' }}
      >
        {STATUSES.map(status => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={tasksByStatus[status]}
            editingMap={editingMap}
            onDelete={onDelete}
            onCreateTask={onCreate}
          />
        ))}

        <CursorOverlay
          remoteCursors={remoteCursors}
          inactivityMs={INACTIVITY_MS}
          boardRef={boardRef}
        />

        {user && (
          <LocalCursor
            state={localState}
            boardRef={boardRef}
            userName={user.name}
            color={user.color}
          />
        )}
      </div>

      {/*
        dropAnimation={null} — the overlay disappears instantly when dropped.
        This is intentional and correct: the destination TaskCard fades in via
        its own opacity transition. A custom drop animation fighting dnd-kit's
        internal transform measurement causes the "snap back" glitch.
        Trello, Linear, and Figma all use this same instant-dismiss pattern.
      */}
      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div
            className="pointer-events-none"
            style={{
              transform:    'rotate(2deg) scale(1.05)',
              boxShadow:    '0 16px 40px rgba(139,92,246,0.25)',
              borderRadius: '1rem',
              opacity:      0.95,
            }}
          >
            <TaskCard
              task={activeTask}
              editingBy={null}
              onDelete={() => {}}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

const KanbanBoard = memo(KanbanBoardInner);
export default KanbanBoard;