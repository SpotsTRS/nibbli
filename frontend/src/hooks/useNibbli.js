// useNibbli.js — all real-time board + chat state in one hook
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from '../context/SocketContext';

export function useNibbli() {
  const { socket } = useSocket();

  const [user,         setUser]         = useState(null);
  const [rooms,        setRooms]        = useState([]);
  const [currentRoom,  setCurrentRoom]  = useState(null);
  const [tasks,        setTasks]        = useState([]);
  const [activities,   setActivities]   = useState([]);
  const [onlineUsers,  setOnlineUsers]  = useState([]);
  const [editingMap,   setEditingMap]   = useState({});
  const [joined,       setJoined]       = useState(false);
  const [messages,     setMessages]     = useState([]);
  const [typingUsers,  setTypingUsers]  = useState([]);

  const typingTimerRef = useRef(null);

  // ── PRODUCTION FIX: clean listener registration ────────────────────────────
  // All listeners are registered in ONE useEffect with a proper cleanup that
  // calls socket.off() for every socket.on() added.
  // This prevents duplicate listener accumulation that happens in React Strict
  // Mode (effects run twice in dev) and during Socket.IO reconnections.
  // Each handler is defined inline so the off() calls reference the exact same
  // function instance captured in this effect run.

  useEffect(() => {
    if (!socket) return;

    function onUserJoined({ user: u, rooms: r }) {
      setUser(u);
      setRooms(r);
      setJoined(true);
    }

    function onRoomState({ tasks: t, activities: a, users: u, messages: m }) {
      setTasks(t);
      setActivities(a);
      setOnlineUsers(u);
      setMessages(m || []);
      setTypingUsers([]);
    }

    function onUsersUpdate(users) { setOnlineUsers(users); }

    function onTaskCreated(task) {
      setTasks(prev => [...prev, task]);
    }

    function onTaskMoved({ taskId, newStatus }) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    }

    function onTaskDeleted({ taskId }) {
      setTasks(prev => prev.filter(t => t.id !== taskId));
    }

    function onActivityNew(entry) {
      setActivities(prev => [entry, ...prev].slice(0, 50));
    }

    function onEditingUpdate({ taskId, userName }) {
      setEditingMap(prev => {
        const next = { ...prev };
        if (userName) next[taskId] = userName;
        else          delete next[taskId];
        return next;
      });
    }

    function onChatMessage(msg) {
      setMessages(prev => [...prev, msg].slice(-200));
    }

    function onChatTyping(names) {
      setTypingUsers(names);
    }

    // Register all listeners
    socket.on('user:joined',        onUserJoined);
    socket.on('room:state',         onRoomState);
    socket.on('users:update',       onUsersUpdate);
    socket.on('task:created',       onTaskCreated);
    socket.on('task:moved',         onTaskMoved);
    socket.on('task:deleted',       onTaskDeleted);
    socket.on('activity:new',       onActivityNew);
    socket.on('task:editingUpdate', onEditingUpdate);
    socket.on('chat:message',       onChatMessage);
    socket.on('chat:typing',        onChatTyping);

    // ── Cleanup: remove every listener that was added above ──────────────────
    // Without this, reconnections stack duplicate handlers and every event
    // fires N times (once per reconnection + initial mount in Strict Mode).
    return () => {
      socket.off('user:joined',        onUserJoined);
      socket.off('room:state',         onRoomState);
      socket.off('users:update',       onUsersUpdate);
      socket.off('task:created',       onTaskCreated);
      socket.off('task:moved',         onTaskMoved);
      socket.off('task:deleted',       onTaskDeleted);
      socket.off('activity:new',       onActivityNew);
      socket.off('task:editingUpdate', onEditingUpdate);
      socket.off('chat:message',       onChatMessage);
      socket.off('chat:typing',        onChatTyping);
    };
  }, [socket]); // re-run only when the socket instance itself changes

  // ── Actions ────────────────────────────────────────────────────────────────

  const joinApp = useCallback((name) => {
    if (!socket || !name.trim()) return;
    socket.emit('user:join', { name: name.trim() });
  }, [socket]);

  const joinRoom = useCallback((roomId) => {
    if (!socket) return;
    socket.emit('room:join', { roomId });
    setCurrentRoom(roomId);
    setTasks([]);
    setActivities([]);
    setOnlineUsers([]);
    setEditingMap({});
    setMessages([]);
    setTypingUsers([]);
  }, [socket]);

  const createTask = useCallback((title) => {
    if (!socket || !currentRoom || !title.trim()) return;
    socket.emit('task:create', { roomId: currentRoom, title });
  }, [socket, currentRoom]);

  const moveTask = useCallback((taskId, newStatus) => {
    if (!socket || !currentRoom) return;
    socket.emit('task:move', { roomId: currentRoom, taskId, newStatus });
  }, [socket, currentRoom]);

  const deleteTask = useCallback((taskId) => {
    if (!socket || !currentRoom) return;
    socket.emit('task:delete', { roomId: currentRoom, taskId });
  }, [socket, currentRoom]);

  const sendMessage = useCallback((text) => {
    if (!socket || !currentRoom || !text.trim()) return;
    clearTimeout(typingTimerRef.current);
    socket.emit('chat:stopTyping', { roomId: currentRoom });
    socket.emit('chat:send', { roomId: currentRoom, text });
  }, [socket, currentRoom]);

  const notifyTyping = useCallback(() => {
    if (!socket || !currentRoom) return;
    socket.emit('chat:typing', { roomId: currentRoom });
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socket.emit('chat:stopTyping', { roomId: currentRoom });
    }, 2500);
  }, [socket, currentRoom]);

  return {
    user, rooms, currentRoom, tasks,
    activities, onlineUsers, editingMap, joined,
    messages, typingUsers,
    joinApp, joinRoom, createTask, moveTask, deleteTask,
    sendMessage, notifyTyping,
  };
}