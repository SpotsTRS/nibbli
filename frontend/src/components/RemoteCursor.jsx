// RemoteCursor.jsx — renders ONE remote user's cursor.
//
// PERFORMANCE: position uses CSS transform (GPU-composited) instead of
// left/top (layout-triggering). This is the single biggest smoothness win —
// no layout recalculation on every animation frame.
//
// PERFORMANCE: wrapped in React.memo with a custom comparator that only
// re-renders when meaningful data actually changes. The rAF loop in useCursor
// calls setRemoteCursors 60x/sec; without memo every remote cursor re-renders
// on every frame even when it didn't move.

import React, { memo } from 'react';

const CURSOR_IMAGES = {
  normal:   '/cursors/bunny.svg',
  click:    '/cursors/Click.svg',
  grabbing: '/cursors/Grabbing.svg',
  hehe:     '/cursors/Hehe.svg',
};

// Scale per state — gives expressive visual feedback on transitions
const STATE_SCALE = {
  normal:   1,
  click:    1.18,
  grabbing: 1.08,
  hehe:     1.28,
};

function RemoteCursorInner({ cursor, boardWidth, boardHeight, inactivityMs }) {
  const { userId, userName, color, x, y, state, lastSeen } = cursor;

  // De-normalise 0–1 → px for the CSS transform
  const px = x * boardWidth;
  const py = y * boardHeight;

  // Inactivity fade — purely opacity, no layout
  const age     = Date.now() - lastSeen;
  const opacity = age > inactivityMs
    ? Math.max(0, 1 - (age - inactivityMs) / inactivityMs)
    : 1;

  const scale  = STATE_SCALE[state] ?? 1;
  const isHehe = state === 'hehe';
  const size   = 34 * scale;
  const imgSrc = CURSOR_IMAGES[state] ?? CURSOR_IMAGES.normal;

  return (
    <div
      style={{
        // PERFORMANCE: transform is GPU-composited — no layout, no paint.
        // translate3d forces the element onto its own compositor layer.
        position:      'absolute',
        top:           0,
        left:          0,
        transform:     `translate3d(${px}px, ${py}px, 0)`,
        pointerEvents: 'none',
        zIndex:        9999,
        opacity,
        // Only transition opacity — position is handled by rAF lerp
        transition:    'opacity 0.4s ease',
        willChange:    'transform, opacity',
      }}
    >
      {/* key={userId-state} forces remount on state change → instant image swap */}
      <img
        key={`${userId}-${state}`}
        src={imgSrc}
        alt=""
        width={size}
        height={size}
        draggable={false}
        style={{
          display:       'block',
          filter:        'drop-shadow(0 2px 5px rgba(0,0,0,0.20))',
          // Scale and hehe rotation via transform — GPU composited
          transform:     isHehe ? 'rotate(-10deg)' : 'none',
          transition:    'width 0.08s ease, height 0.08s ease, transform 0.12s cubic-bezier(.34,1.56,.64,1)',
          animation:     isHehe ? 'cursorHeheBounce 0.32s ease infinite alternate' : 'none',
          pointerEvents: 'none',
        }}
      />

      {/* Username pill */}
      <div
        style={{
          position:        'absolute',
          top:             '28px',
          left:            '20px',
          backgroundColor: color,
          color:           darkenHex(color, 0.5),
          borderRadius:    '999px',
          padding:         '2px 9px',
          fontSize:        '11px',
          fontWeight:      600,
          whiteSpace:      'nowrap',
          boxShadow:       '0 2px 8px rgba(0,0,0,0.13)',
          lineHeight:      1.4,
          userSelect:      'none',
          pointerEvents:   'none',
          animation:       isHehe ? 'cursorHeheBounce 0.32s ease infinite alternate' : 'none',
        }}
      >
        {isHehe ? `${userName} hehe` : userName}
      </div>
    </div>
  );
}

// Custom memo comparator — only re-render when something visually meaningful changed.
// x/y change every rAF frame (handled via transform, must re-render for new px/py).
// state, opacity inputs (lastSeen), and size inputs need re-renders too.
// userName and color are stable after join.
function areEqual(prev, next) {
  const pc = prev.cursor;
  const nc = next.cursor;
  return (
    pc.x         === nc.x         &&
    pc.y         === nc.y         &&
    pc.state     === nc.state     &&
    pc.lastSeen  === nc.lastSeen  &&
    pc.userName  === nc.userName  &&
    pc.color     === nc.color     &&
    prev.boardWidth  === next.boardWidth  &&
    prev.boardHeight === next.boardHeight
  );
}

const RemoteCursor = memo(RemoteCursorInner, areEqual);
export default RemoteCursor;

function darkenHex(hex, amount) {
  try {
    const n = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, ((n >> 16) & 0xff) * (1 - amount));
    const g = Math.max(0, ((n >>  8) & 0xff) * (1 - amount));
    const b = Math.max(0, ( n        & 0xff) * (1 - amount));
    return `rgb(${r|0},${g|0},${b|0})`;
  } catch { return '#333'; }
}
