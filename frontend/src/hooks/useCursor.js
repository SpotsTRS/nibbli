// useCursor.js — single authoritative cursor presence hook for Nibbli.
//
// Socket events:
//   EMIT:    cursor:move       { roomId, x, y, state }
//   EMIT:    cursor:state      { roomId, state }
//   EMIT:    cursor:leave      { roomId }
//   EMIT:    cursor:easterEgg  { roomId }   ← NEW: triggers multiplayer audio
//   LISTEN:  cursor:move       { userId, x, y, state, userName, color }
//   LISTEN:  cursor:state      { userId, state }
//   LISTEN:  cursor:userLeft   { userId }
//   LISTEN:  cursor:easterEgg  (no payload)  ← NEW: play audio on all clients

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import faaahSrc from '../assets/audio/faaah.mp3';

const EMIT_INTERVAL_MS = 33;    // ~30fps emit — tighter than before, still throttled
const INACTIVITY_MS    = 4000;
// POLISH: faster lerp = cursor feels more alive and responsive.
// 0.16 took ~25 frames to cover 95% of distance (sluggish).
// 0.25 covers 95% in ~16 frames (~270ms at 60fps) — snappy but still smooth.
const LERP_FACTOR      = 0.25;
const CLICK_DURATION   = 300;   // slightly snappier click feedback

function resolveState(dragging, rightDown, clickActive, hoverActive) {
  if (dragging)                   return 'grabbing';
  if (rightDown)                  return 'hehe';
  if (clickActive || hoverActive) return 'click';
  return 'normal';
}

export function useCursor(currentRoom, user, boardRef) {
  const { socket } = useSocket();

  const [localState,    setLocalState]    = useState('normal');
  const [remoteCursors, setRemoteCursors] = useState({});

  const isDraggingRef    = useRef(false);
  const isRightDownRef   = useRef(false);
  const isClickActiveRef = useRef(false);
  const isHoverActiveRef = useRef(false);
  const localStateRef    = useRef('normal');

  const lastEmitRef = useRef(0);
  const pendingRef  = useRef(null);
  const lastPosRef  = useRef({ x: 0, y: 0 });
  const clickTimerRef = useRef(null);

  const audioRef = useRef(null);

  const rafRef     = useRef(null);
  const targetPos  = useRef({});
  const currentPos = useRef({});

  // ── Preload cursor assets ─────────────────────────────────────────────────
  useEffect(() => {
    audioRef.current = new Audio(faaahSrc);
    audioRef.current.volume = 0.55;
    ['Hand', 'Click', 'Grabbing', 'Hehe'].forEach(name => {
      const img = new Image(); img.src = `/cursors/${name}.svg`;
    });
  }, []);

  // ── State helpers ─────────────────────────────────────────────────────────

  function applyState() {
    const s = resolveState(
      isDraggingRef.current,
      isRightDownRef.current,
      isClickActiveRef.current,
      isHoverActiveRef.current,
    );
    localStateRef.current = s;
    setLocalState(s);
    return s;
  }

  function norm(clientX, clientY) {
    const el = boardRef?.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      x: (clientX - r.left) / r.width,
      y: (clientY - r.top)  / r.height,
    };
  }

  const emitNow = useCallback((pos, state) => {
    if (!socket || !currentRoom || !pos) return;
    lastEmitRef.current = Date.now();
    pendingRef.current  = null;
    socket.emit('cursor:move', { roomId: currentRoom, x: pos.x, y: pos.y, state });
  }, [socket, currentRoom]);

  const emitIfDue = useCallback((pos, state) => {
    if (!socket || !currentRoom || !pos) return;
    const now = Date.now();
    if (now - lastEmitRef.current < EMIT_INTERVAL_MS) {
      pendingRef.current = { pos, state };
      return;
    }
    lastEmitRef.current = now;
    pendingRef.current  = null;
    socket.emit('cursor:move', { roomId: currentRoom, x: pos.x, y: pos.y, state });
  }, [socket, currentRoom]);

  // ── Board mouse/pointer event listeners ───────────────────────────────────
  useEffect(() => {
    const board = boardRef?.current;
    if (!board || !currentRoom) return;

    function onPointerMove(e) {
      const pos = norm(e.clientX, e.clientY);
      if (!pos) return;
      lastPosRef.current = pos;
      emitIfDue(pos, localStateRef.current);
    }

    function onMouseOver(e) {
      if (isDraggingRef.current) return;
      let el = e.target;
      let isPointer = false;
      for (let i = 0; i < 5 && el && el !== board; i++) {
        if (getComputedStyle(el).cursor === 'pointer') { isPointer = true; break; }
        el = el.parentElement;
      }
      if (isPointer !== isHoverActiveRef.current) {
        isHoverActiveRef.current = isPointer;
        const s   = applyState();
        const pos = norm(e.clientX, e.clientY);
        emitNow(pos, s);
      }
    }

    function onMouseDown(e) {
      if (e.button === 0 && !isDraggingRef.current) {
        isClickActiveRef.current = true;
        const s   = applyState();
        const pos = norm(e.clientX, e.clientY);
        emitNow(pos, s);
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = setTimeout(() => {
          isClickActiveRef.current = false;
          const reverted = applyState();
          if (pendingRef.current?.pos) emitNow(pendingRef.current.pos, reverted);
        }, CLICK_DURATION);
      }

      if (e.button === 2) {
        e.preventDefault();
        if (!isRightDownRef.current) {
          // ── MULTIPLAYER AUDIO FIX ────────────────────────────────────────
          // Emit to server instead of playing locally. The server broadcasts
          // cursor:easterEgg to the whole room (including this client), so
          // everyone hears the sound at the same time. The actual audio.play()
          // is triggered by the socket listener below, not here.
          socket?.emit('cursor:easterEgg', { roomId: currentRoom });
        }
        isRightDownRef.current   = true;
        isClickActiveRef.current = false;
        clearTimeout(clickTimerRef.current);
        const s   = applyState();
        const pos = norm(e.clientX, e.clientY);
        emitNow(pos, s);
      }
    }

    function onMouseUp(e) {
      if (e.button === 2) {
        isRightDownRef.current = false;
        const s   = applyState();
        const pos = norm(e.clientX, e.clientY);
        emitNow(pos, s);
      }
    }

    function onContextMenu(e) { e.preventDefault(); }

    function onMouseLeave() {
      isHoverActiveRef.current = false;
      applyState();
      socket?.emit('cursor:leave', { roomId: currentRoom });
    }

    const flushId = setInterval(() => {
      if (pendingRef.current) {
        const { pos, state } = pendingRef.current;
        pendingRef.current   = null;
        socket?.emit('cursor:move', { roomId: currentRoom, x: pos.x, y: pos.y, state });
        lastEmitRef.current = Date.now();
      }
    }, EMIT_INTERVAL_MS);

    window.addEventListener('pointermove',  onPointerMove);
    board.addEventListener('mouseover',     onMouseOver);
    board.addEventListener('mousedown',     onMouseDown);
    board.addEventListener('mouseup',       onMouseUp);
    board.addEventListener('contextmenu',   onContextMenu);
    board.addEventListener('mouseleave',    onMouseLeave);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      board.removeEventListener('mouseover',    onMouseOver);
      board.removeEventListener('mousedown',    onMouseDown);
      board.removeEventListener('mouseup',      onMouseUp);
      board.removeEventListener('contextmenu',  onContextMenu);
      board.removeEventListener('mouseleave',   onMouseLeave);
      clearInterval(flushId);
      clearTimeout(clickTimerRef.current);
      socket?.emit('cursor:leave', { roomId: currentRoom });
    };
  }, [currentRoom, socket, boardRef, emitNow, emitIfDue]);

  // ── Remote cursor socket listeners ────────────────────────────────────────
  // PRODUCTION FIX: all handlers defined as named functions so the off() call
  // removes the exact same function reference — no stale duplicate listeners.

  useEffect(() => {
    if (!socket) return;

    function onMove({ userId, x, y, state, userName, color }) {
      if (!targetPos.current[userId]) {
        targetPos.current[userId]  = { x, y };
        currentPos.current[userId] = { x, y };
      } else {
        targetPos.current[userId] = { x, y };
      }
      // Wake up the rAF loop — it pauses itself when nothing is moving
      rafRef.current?.start();
      setRemoteCursors(prev => ({
        ...prev,
        [userId]: { ...prev[userId], userId, userName, color, state, lastSeen: Date.now() },
      }));
    }

    function onState({ userId, state }) {
      setRemoteCursors(prev =>
        prev[userId] ? { ...prev, [userId]: { ...prev[userId], state } } : prev
      );
    }

    function onUserLeft({ userId }) {
      delete targetPos.current[userId];
      delete currentPos.current[userId];
      setRemoteCursors(prev => { const n = { ...prev }; delete n[userId]; return n; });
    }

    // ── MULTIPLAYER AUDIO: play sound when server broadcasts easterEgg ───────
    // This fires on ALL clients in the room (the server uses io.to, not socket.to).
    // Each client plays their own local audio — no audio is transmitted over the
    // network, just the trigger signal.
    function onEasterEgg() {
      try {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {});
        }
      } catch (_) {}
    }

    socket.on('cursor:move',      onMove);
    socket.on('cursor:state',     onState);
    socket.on('cursor:userLeft',  onUserLeft);
    socket.on('cursor:easterEgg', onEasterEgg);

    return () => {
      socket.off('cursor:move',      onMove);
      socket.off('cursor:state',     onState);
      socket.off('cursor:userLeft',  onUserLeft);
      socket.off('cursor:easterEgg', onEasterEgg);
    };
  }, [socket]); // re-run only if socket instance changes

  // ── rAF lerp loop ─────────────────────────────────────────────────────────
  // PERFORMANCE: the loop tracks whether any cursor is still moving.
  // When all cursors have settled, rafActive goes false and the rAF
  // stops scheduling new frames — zero CPU cost at rest.
  // A new incoming cursor:move event restarts the loop via rafActive.
  useEffect(() => {
    let rafId = null;
    let rafActive = false;

    function tick() {
      let anyMoving = false;

      for (const uid in targetPos.current) {
        const tgt = targetPos.current[uid];
        const cur = currentPos.current[uid] || { ...tgt };
        const dx  = tgt.x - cur.x;
        const dy  = tgt.y - cur.y;

        // Stop lerping this cursor once it's within 0.03px — imperceptible
        if (Math.abs(dx) > 0.0003 || Math.abs(dy) > 0.0003) {
          currentPos.current[uid] = {
            x: cur.x + dx * LERP_FACTOR,
            y: cur.y + dy * LERP_FACTOR,
          };
          anyMoving = true;
        } else if (Math.abs(dx) > 0 || Math.abs(dy) > 0) {
          // Snap to exact target when close enough — prevents endless micro-lerp
          currentPos.current[uid] = { ...tgt };
          anyMoving = true; // one final update to land exactly
        }
      }

      if (anyMoving) {
        setRemoteCursors(prev => {
          const next = { ...prev };
          for (const uid in currentPos.current) {
            if (next[uid]) {
              next[uid] = {
                ...next[uid],
                x: currentPos.current[uid].x,
                y: currentPos.current[uid].y,
              };
            }
          }
          return next;
        });
        rafId = requestAnimationFrame(tick);
      } else {
        // Nothing moving — pause the loop
        rafActive = false;
        rafId     = null;
      }
    }

    // Expose a restart function so the socket listener can wake up the loop
    rafRef.current = {
      start() {
        if (!rafActive) {
          rafActive = true;
          rafId     = requestAnimationFrame(tick);
        }
      },
    };

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafActive = false;
    };
  }, []);

  // ── Inactivity cleanup ────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setRemoteCursors(prev => {
        const next = { ...prev }; let changed = false;
        for (const uid in next) {
          if (now - next[uid].lastSeen > INACTIVITY_MS * 2.5) {
            delete next[uid]; delete targetPos.current[uid]; delete currentPos.current[uid];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 3000);
    return () => clearInterval(id);
  }, []);

  // ── Drag state setter ─────────────────────────────────────────────────────
  const setDraggingState = useCallback((dragging) => {
    isDraggingRef.current    = dragging;
    isHoverActiveRef.current = false;
    if (!dragging) isClickActiveRef.current = false;
    const s = applyState();
    if (socket && currentRoom) {
      const pos = lastPosRef.current;
      if (pos.x !== 0 || pos.y !== 0) emitNow(pos, s);
      else socket.emit('cursor:state', { roomId: currentRoom, state: s });
    }
  }, [socket, currentRoom, emitNow]);

  return { localState, remoteCursors, setDraggingState, INACTIVITY_MS };
}