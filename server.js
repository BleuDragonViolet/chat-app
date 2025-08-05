require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');
const User = require('./models/User');
const Message = require('./models/Message');
require('./config/passport')(passport);

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// DB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ MongoDB connecté'))
  .catch(err => console.error(err));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static + form parser
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// Sessions
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
}));

// Auth
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

// Middlewares perso
app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});

// Auth routes
app.get('/', (req, res) => res.render('index'));
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  async (req, res) => {
    if (!req.user.pseudo) return res.redirect('/pseudo');
    res.redirect('/chat');
  }
);

// Choix du pseudo
app.get('/pseudo', (req, res) => {
  if (!req.isAuthenticated()) return res.redirect('/');
  res.render('pseudo');
});
app.post('/pseudo', async (req, res) => {
  if (!req.isAuthenticated()) return res.redirect('/');
  await User.findByIdAndUpdate(req.user.id, { pseudo: req.body.pseudo });
  res.redirect('/chat');
});

// Chat
app.get('/chat', (req, res) => {
  if (!req.isAuthenticated()) return res.redirect('/');
  if (!req.user.pseudo) return res.redirect('/pseudo');
  res.render('chat', { user: req.user });
});

// Déconnexion
app.get('/logout', (req, res) => {
  req.logout(err => {
    if (err) console.log(err);
    res.redirect('/');
  });
});

// Socket.io
let onlineUsers = {};

io.on('connection', socket => {
  let userId;

  socket.on('register', async data => {
    userId = data.id;
    const user = await User.findById(userId);
    if (user) {
      onlineUsers[userId] = { socketId: socket.id, pseudo: user.pseudo };
      io.emit('update-users', Object.entries(onlineUsers).map(([id, u]) => ({ id, pseudo: u.pseudo })));
    }
  });

  socket.on('chat-message', async ({ sender, content }) => {
    const msg = new Message({ sender, content });
    await msg.save();
    io.emit('chat-message', { sender, content });
  });

  socket.on('private-request', ({ from, to }) => {
    const recipient = onlineUsers[to];
    if (recipient) {
      io.to(recipient.socketId).emit('private-request', { fromId: userId, fromPseudo: from });
    }
  });

  socket.on('private-accept', ({ fromId }) => {
    const partner = onlineUsers[fromId];
    if (partner) {
      const roomId = [userId, fromId].sort().join('-');
      io.to(partner.socketId).emit('private-accepted', { roomId });
      socket.emit('private-accepted', { roomId });
    }
  });

  socket.on('private-message', ({ roomId, sender, content }) => {
    io.to(roomId).emit('private-message', { sender, content });
  });

  socket.on('join-room', roomId => socket.join(roomId));

  socket.on('disconnect', () => {
    delete onlineUsers[userId];
    io.emit('update-users', Object.entries(onlineUsers).map(([id, u]) => ({ id, pseudo: u.pseudo })));
  });
});

// Lancer serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Serveur lancé sur le port ${PORT}`));
