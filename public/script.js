const socket = io();

socket.emit('register', user);

const chatBox = document.getElementById('chatBox');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const userList = document.getElementById('userList');
const notifications = document.getElementById('notifications');

// Envoyer message global
sendButton.onclick = () => {
  const content = messageInput.value.trim();
  if (content) {
    socket.emit('chat-message', { sender: user.pseudo, content });
    messageInput.value = '';
  }
};

// Afficher message global
socket.on('chat-message', ({ sender, content }) => {
  const msg = document.createElement('div');
  msg.className = 'message';
  msg.innerHTML = `<span class="username">${sender}</span>: ${content}`;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
});

// Mettre à jour liste utilisateurs
socket.on('update-users', users => {
  userList.innerHTML = '';
  users.forEach(u => {
    if (u.id !== user.id) {
      const div = document.createElement('div');
      div.className = 'user';
      div.textContent = u.pseudo;
      div.onclick = () => {
        socket.emit('private-request', { from: user.pseudo, to: u.id });
        notify(`Demande de MP envoyée à ${u.pseudo}`);
      };
      userList.appendChild(div);
    }
  });
});

// Notification de demande MP reçue
socket.on('private-request', ({ fromId, fromPseudo }) => {
  const notif = document.createElement('div');
  notif.className = 'notification';
  notif.innerHTML = `
    ${fromPseudo} veut discuter en privé
    <button onclick="acceptMP('${fromId}')">Accepter</button>
  `;
  notifications.appendChild(notif);
});

// Accepter MP
function acceptMP(fromId) {
  socket.emit('private-accept', { fromId });
}

// Room MP acceptée
socket.on('private-accepted', ({ roomId }) => {
  socket.emit('join-room', roomId);
  notify(`Discussion privée démarrée (${roomId})`);

  // Boîte MP simple (popup ?)
  const pmBox = document.createElement('div');
  pmBox.className = 'chat-box';
  pmBox.style.marginTop = '10px';

  const pmInput = document.createElement('input');
  pmInput.type = 'text';
  pmInput.placeholder = 'Message privé...';

  const pmSend = document.createElement('button');
  pmSend.textContent = 'Envoyer';

  pmSend.onclick = () => {
    const msg = pmInput.value.trim();
    if (msg) {
      socket.emit('private-message', { roomId, sender: user.pseudo, content: msg });
      pmInput.value = '';
    }
  };

  document.body.appendChild(pmBox);
  document.body.appendChild(pmInput);
  document.body.appendChild(pmSend);

  socket.on('private-message', ({ sender, content }) => {
    const msg = document.createElement('div');
    msg.className = 'message';
    msg.innerHTML = `<span class="username">${sender}</span> (MP): ${content}`;
    pmBox.appendChild(msg);
    pmBox.scrollTop = pmBox.scrollHeight;
  });
});

// Petite notif
function notify(text) {
  const notif = document.createElement('div');
  notif.className = 'notification';
  notif.textContent = text;
  notifications.appendChild(notif);
  setTimeout(() => notif.remove(), 5000);
}
