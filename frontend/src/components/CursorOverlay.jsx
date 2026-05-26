// CursorOverlay.jsx — renders all remote users' cursors.
//
// PERFORMANCE: boardWidth/boardHeight are read once from the ref and only
// update when the board actually resizes (via ResizeObserver), not on every
// parent render. This prevents CursorOverlay from re-rendering when unrelated
// state changes happen in the parent.

import React, { memo, useState, useEffect, useRef } from 'react';
import RemoteCursor from './RemoteCursor';

function CursorOverlayInner({ remoteCursors, inactivityMs, boardRef }) {
  const [boardSize, setBoardSize] = useState({ width: 0, height: 0 });

  // PERFORMANCE: ResizeObserver updates dimensions only when board actually
  // resizes. boardRef.current.offsetWidth on every render causes forced
  // layout reads which can trigger extra layout passes.
  useEffect(() => {
    const el = boardRef?.current;
    if (!el) return;

    // Set initial size
    setBoardSize({ width: el.offsetWidth, height: el.offsetHeight });

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBoardSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [boardRef]);

  const entries = Object.values(remoteCursors);
  if (entries.length === 0 || boardSize.width === 0) return null;

  return (
    <div
      style={{
        position:      'absolute',
        inset:         0,
        pointerEvents: 'none',
        zIndex:        9999,
        overflow:      'visible',
        // PERFORMANCE: contain:layout prevents cursor movements from
        // triggering layout recalculations in sibling elements (columns, cards)
        contain:       'layout',
      }}
    >
      {entries.map(cursor => (
        <RemoteCursor
          key={cursor.userId}
          cursor={cursor}
          boardWidth={boardSize.width}
          boardHeight={boardSize.height}
          inactivityMs={inactivityMs}
        />
      ))}
    </div>
  );
}

// Re-render only when cursor data or board size actually changes
const CursorOverlay = memo(CursorOverlayInner);
export default CursorOverlay;
