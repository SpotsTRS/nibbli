// LocalCursor.jsx — the local user's own cursor overlay.
//
// PERFORMANCE: position is updated via direct DOM style mutation (no React
// state, no re-renders) on every pointermove. This gives zero-overhead
// sub-frame position updates — the cursor tracks the mouse with no React
// scheduler latency. Only state/visibility changes cause React re-renders.

import React, { useState, useEffect, useRef, memo } from 'react';

const CURSOR_IMAGES = {
  normal:   '/cursors/Hand.svg',
  click:    '/cursors/Click.svg',
  grabbing: '/cursors/Grabbing.svg',
  hehe:     '/cursors/Hehe.svg',
};

const STATE_SCALE = {
  normal:   1,
  click:    1.15,
  grabbing: 1.05,
  hehe:     1.3,
};

function LocalCursorInner({ state, boardRef, userName, color }) {
  const [visible, setVisible] = useState(false);

  // Ref to the wrapper div — we mutate its style directly for position updates
  const wrapperRef = useRef(null);

  // PERFORMANCE: direct DOM mutation for position — bypasses React entirely.
  // setPos (state) was being called 60+/sec causing continuous re-renders.
  // Now position updates happen synchronously in the event handler with zero
  // React scheduler overhead.
  useEffect(() => {
    const board = boardRef?.current;
    if (!board) return;

    function onPointerMove(e) {
      const rect = board.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;

      if (!inside) {
        setVisible(false);
        return;
      }

      setVisible(true);

      // Direct DOM mutation — no React, no state, no re-render
      if (wrapperRef.current) {
        wrapperRef.current.style.transform = `translate3d(${x - 2}px, ${y - 2}px, 0)`;
      }
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, [boardRef]);

  // Hide native cursor on board, restore on leave
  useEffect(() => {
    const board = boardRef?.current;
    if (!board) return;
    const onEnter = () => { board.style.cursor = 'none'; };
    const onLeave = () => { board.style.cursor = ''; };
    board.addEventListener('mouseenter', onEnter);
    board.addEventListener('mouseleave', onLeave);
    return () => {
      board.removeEventListener('mouseenter', onEnter);
      board.removeEventListener('mouseleave', onLeave);
      board.style.cursor = '';
    };
  }, [boardRef]);

  if (!visible) return null;

  const scale  = STATE_SCALE[state] ?? 1;
  const isHehe = state === 'hehe';
  const imgSrc = CURSOR_IMAGES[state] ?? CURSOR_IMAGES.normal;
  const size   = 36 * scale;

  return (
    // PERFORMANCE: position via transform3d, starting offscreen.
    // The actual position is set imperatively by onPointerMove above.
    <div
      ref={wrapperRef}
      style={{
        position:      'absolute',
        top:           0,
        left:          0,
        transform:     'translate3d(-999px, -999px, 0)',
        pointerEvents: 'none',
        zIndex:        10000,
        willChange:    'transform',
      }}
    >
      {/* key=state forces remount → instant image swap, no flicker */}
      <img
        key={state}
        src={imgSrc}
        alt=""
        width={size}
        height={size}
        draggable={false}
        style={{
          display:       'block',
          filter:        'drop-shadow(0 2px 6px rgba(0,0,0,0.22))',
          transform:     isHehe ? 'rotate(-12deg)' : 'none',
          transition:    'width 0.08s ease, height 0.08s ease, transform 0.12s cubic-bezier(.34,1.56,.64,1)',
          animation:     isHehe ? 'cursorHeheBounce 0.3s ease infinite alternate' : 'none',
          pointerEvents: 'none',
        }}
      />

      {/* Username pill */}
      <div
        style={{
          position:        'absolute',
          top:             '28px',
          left:            '22px',
          backgroundColor: color,
          color:           darkenHex(color, 0.5),
          borderRadius:    '999px',
          padding:         '2px 8px',
          fontSize:        '11px',
          fontWeight:      700,
          whiteSpace:      'nowrap',
          boxShadow:       '0 2px 8px rgba(0,0,0,0.14)',
          lineHeight:      1.4,
          userSelect:      'none',
          pointerEvents:   'none',
          border:          `1.5px solid ${darkenHex(color, 0.15)}`,
          animation:       isHehe ? 'cursorHeheBounce 0.3s ease infinite alternate' : 'none',
        }}
      >
        {isHehe ? `${userName} hehe` : `${userName} (you)`}
      </div>
    </div>
  );
}

// Only re-render when state, name, or color changes.
// Position updates bypass React entirely via direct DOM mutation.
const LocalCursor = memo(LocalCursorInner, (prev, next) =>
  prev.state    === next.state    &&
  prev.userName === next.userName &&
  prev.color    === next.color
);

export default LocalCursor;

function darkenHex(hex, amount) {
  try {
    const n = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, ((n >> 16) & 0xff) * (1 - amount));
    const g = Math.max(0, ((n >>  8) & 0xff) * (1 - amount));
    const b = Math.max(0, ( n        & 0xff) * (1 - amount));
    return `rgb(${r|0},${g|0},${b|0})`;
  } catch { return '#333'; }
}
