// socketHandlers.js — all Socket.IO events in one place
const store = require('./store');

// Easter egg audio cooldown per room: roomId → timestamp of last trigger
const easterEggCooldown = {};
const EASTER_EGG_COOLDOWN_MS = 3000; // minimum 3s between triggers per room

module.exports = function registerHandlers(io, socket) {

  // ─── JOIN / LEAVE ──────────────────────────────────────────────────────────

  socket.on('user:join', ({ name }) => {
    const user = store.addUser(socket.id, name);
    socket.emit('user:joined', { user, rooms: store.getAllRooms() });
    console.log(`[+] ${name} connected`);
  });

  socket.on('room:join', ({ roomId }) => {
    const user = store.getUser(socket.id);
    if (!user) return;

    // Leave previous room — clear typing state there
    if (user.roomId) {
      store.stopTyping(user.roomId, user.name);
      io.to(user.roomId).emit('chat:typing', store.getTypingUsers(user.roomId));
      socket.leave(user.roomId);
      io.to(user.roomId).emit('users:update', store.getUsersInRoom(user.roomId));
      // Tell old room this cursor is gone
      socket.to(user.roomId).emit('cursor:userLeft', { userId: socket.id });
    }

    store.setUserRoom(socket.id, roomId);
    socket.join(roomId);

    // Send full room state (tasks + activities + messages) to joining user
    socket.emit('room:state', {
      tasks:      store.getTasks(roomId),
      activities: store.getActivities(roomId),
      users:      store.getUsersInRoom(roomId),
      messages:   store.getMessages(roomId),
    });

    io.to(roomId).emit('users:update', store.getUsersInRoom(roomId));

    store.addActivity(roomId, `${user.name} joined the room`);
    io.to(roomId).emit('activity:new', store.getActivities(roomId)[0]);

    console.log(`[~] ${user.name} joined room ${roomId}`);
  });

  // ─── TASKS ────────────────────────────────────────────────────────────────

  socket.on('task:create', ({ roomId, title }) => {
    const user = store.getUser(socket.id);
    if (!user || !title.trim()) return;
    const task = store.createTask(roomId, title.trim(), user.name);
    io.to(roomId).emit('task:created', task);
    io.to(roomId).emit('activity:new', store.getActivities(roomId)[0]);
  });

  socket.on('task:move', ({ roomId, taskId, newStatus }) => {
    const user = store.getUser(socket.id);
    if (!user) return;
    const task = store.moveTask(roomId, taskId, newStatus, user.name);
    if (!task) return;
    io.to(roomId).emit('task:moved', { taskId, newStatus });
    io.to(roomId).emit('activity:new', store.getActivities(roomId)[0]);
  });

  socket.on('task:delete', ({ roomId, taskId }) => {
    const user = store.getUser(socket.id);
    if (!user) return;
    const task = store.deleteTask(roomId, taskId, user.name);
    if (!task) return;
    io.to(roomId).emit('task:deleted', { taskId });
    io.to(roomId).emit('activity:new', store.getActivities(roomId)[0]);
  });

  // ─── EDITING INDICATORS ───────────────────────────────────────────────────

  socket.on('task:editing', ({ roomId, taskId }) => {
    const user = store.getUser(socket.id);
    if (!user) return;
    store.setEditing(taskId, socket.id, user.name);
    socket.to(roomId).emit('task:editingUpdate', { taskId, userName: user.name });
  });

  socket.on('task:editingStop', ({ roomId, taskId }) => {
    store.clearEditing(socket.id);
    socket.to(roomId).emit('task:editingUpdate', { taskId, userName: null });
  });

  // ─── CHAT ─────────────────────────────────────────────────────────────────

  socket.on('chat:send', ({ roomId, text }) => {
    const user = store.getUser(socket.id);
    if (!user || !text.trim()) return;

    store.stopTyping(roomId, user.name);
    io.to(roomId).emit('chat:typing', store.getTypingUsers(roomId));

    const msg = store.addMessage(roomId, user, text);
    if (!msg) return;
    io.to(roomId).emit('chat:message', msg);
  });

  socket.on('chat:typing', ({ roomId }) => {
    const user = store.getUser(socket.id);
    if (!user) return;
    store.startTyping(roomId, user.name);
    socket.to(roomId).emit('chat:typing', store.getTypingUsers(roomId));
  });

  socket.on('chat:stopTyping', ({ roomId }) => {
    const user = store.getUser(socket.id);
    if (!user) return;
    store.stopTyping(roomId, user.name);
    socket.to(roomId).emit('chat:typing', store.getTypingUsers(roomId));
  });

  // ─── CURSOR PRESENCE ──────────────────────────────────────────────────────

  socket.on('cursor:move', ({ roomId, x, y, state }) => {
    const user = store.getUser(socket.id);
    if (!user) return;
    socket.to(roomId).emit('cursor:move', {
      userId:   socket.id,
      x,
      y,
      state,
      userName: user.name,
      color:    user.color,
    });
  });

  socket.on('cursor:state', ({ roomId, state }) => {
    const user = store.getUser(socket.id);
    if (!user) return;
    socket.to(roomId).emit('cursor:state', {
      userId: socket.id,
      state,
    });
  });

  socket.on('cursor:leave', ({ roomId }) => {
    socket.to(roomId).emit('cursor:userLeft', { userId: socket.id });
  });

  // ─── EASTER EGG AUDIO ─────────────────────────────────────────────────────
  // Client emits this when right-click fires. Server broadcasts to the whole
  // room (including sender) so everyone hears the sound together.
  // A per-room cooldown prevents spam from rapid right-clicking.

  socket.on('cursor:easterEgg', ({ roomId }) => {
    const user = store.getUser(socket.id);
    if (!user) return;

    const now      = Date.now();
    const lastTime = easterEggCooldown[roomId] || 0;

    if (now - lastTime < EASTER_EGG_COOLDOWN_MS) return; // still on cooldown

    easterEggCooldown[roomId] = now;

    // Broadcast to ENTIRE room (io.to, not socket.to) so sender hears it too
    io.to(roomId).emit('cursor:easterEgg');
  });

  // ─── DISCONNECT ───────────────────────────────────────────────────────────

  socket.on('disconnect', () => {
    const user = store.removeUser(socket.id);
    if (!user) return;

    if (user.roomId) {
      const updated = store.getUsersInRoom(user.roomId);
      io.to(user.roomId).emit('users:update', updated);
      io.to(user.roomId).emit('chat:typing', store.getTypingUsers(user.roomId));
      io.to(user.roomId).emit('cursor:userLeft', { userId: socket.id });
      store.addActivity(user.roomId, `${user.name} left the room`);
      io.to(user.roomId).emit('activity:new', store.getActivities(user.roomId)[0]);
    }

    console.log(`[-] ${user.name} disconnected`);
  });
};
