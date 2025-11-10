// StealthMsg Main Application Logic (Supabase Version)

let currentUser = null;
let currentChatUser = null;
let userKeypair = null;
let conversationKeys = {}; // Cache for conversation AES keys
let messageSubscription = null; // Supabase real-time subscription for messages

// DOM Elements
const authSection = document.getElementById('auth-section');
const chatSection = document.getElementById('chat-section');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const logoutBtn = document.getElementById('logout-btn');
const encryptBtn = document.getElementById('encrypt-btn');
const sendBtn = document.getElementById('send-btn');
const searchUsers = document.getElementById('search-users');
const usersList = document.getElementById('users');
const messagesDiv = document.getElementById('messages');
const messageText = document.getElementById('message-text');

// Global variables for encrypted message
let encryptedMessageData = null;

// Auth Functions (Supabase Version)
async function registerUser(username, email, password) {
    try {
        // Create Supabase Auth user
        const { data, error } = await window.supabase.auth.signUp({
            email: email,
            password: password
        });
        if (error) throw error;

        const supabaseUser = data.user;

        // Generate keypair
        userKeypair = await generateKeypair();
        const publicKeyBase64 = await exportPublicKey(userKeypair.publicKey);

        // Store user data in Supabase
        const { error: insertError } = await window.supabase
            .from('users')
            .insert({
                id: supabaseUser.id,
                username: username,
                email: email,
                public_key: publicKeyBase64,
                created_at: new Date().toISOString()
            });
        if (insertError) throw insertError;

        // Set current user
        currentUser = { uid: supabaseUser.id, email: email, username: username };

        alert('Registration successful! Welcome to StealthMsg.');
        await handleUserLogin();
    } catch (error) {
        console.error('Error registering user:', error);
        alert('Error registering: ' + error.message);
    }
}

async function loginUser(email, password) {
    try {
        // Sign in with Supabase Auth
        const { data, error } = await window.supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        if (error) throw error;

        const supabaseUser = data.user;

        // Get user data from Supabase
        const { data: userData, error: fetchError } = await window.supabase
            .from('users')
            .select('*')
            .eq('id', supabaseUser.id)
            .single();
        if (fetchError) throw fetchError;

        // Generate keypair (in real app, load from secure storage)
        userKeypair = await generateKeypair();

        // Set current user
        currentUser = { uid: supabaseUser.id, email: userData.email, username: userData.username };

        alert('Login successful! Welcome back to StealthMsg.');
        await handleUserLogin();
    } catch (error) {
        console.error('Error logging in:', error);
        alert('Error logging in: ' + error.message);
    }
}

async function handleUserLogin() {
    if (!currentUser) return;

    // Request notification permission
    if (Notification.permission === 'default') {
        Notification.requestPermission();
    }

    // Switch to chat UI
    authSection.style.display = 'none';
    chatSection.style.display = 'flex';

    loadUsers();

    // Start real-time message listening
    startMessageListening();
}

function startMessageListening() {
    // Stop any existing subscription
    if (messageSubscription) {
        messageSubscription.unsubscribe();
    }

    // Listen for new messages in real-time using Supabase
    messageSubscription = window.supabase
        .channel('messages')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `to=eq.${currentUser.email}`
        }, (payload) => {
            const message = payload.new;
            // Only show notification if message is for current chat
            if (currentChatUser && message.from === currentChatUser.email) {
                playNotificationSound();
                if (Notification.permission === 'granted') {
                    new Notification('New message from ' + currentChatUser.username, {
                        body: 'You have a new encrypted message',
                        icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJDMTMuMSAyIDE0IDIuOSAxNCA0VjE2QzE0IDE3LjEgMTMuMSAxOCA5IDE4QzQuOSAxOCA0IDE3LjEgNCAxNlY0QzQgMi45IDQuOSAyIDYgMkgxOEMxOC45IDIgMjAgMi45IDIwIDRWMTZIMTJWMjBaIiBmaWxsPSIjMDBGRjAwIi8+Cjwvc3ZnPgo='
                    });
                }
                loadMessages(); // Reload messages to show new one
            }
        })
        .subscribe();
}

// UI Functions
async function loadUsers() {
    // Load users from Supabase
    const { data: users, error } = await window.supabase
        .from('users')
        .select('*');
    if (error) {
        console.error('Error loading users:', error);
        return;
    }

    usersList.innerHTML = '';
    users.forEach((user) => {
        if (user.email !== currentUser.email) {
            const li = document.createElement('li');
            li.textContent = user.username;
            li.onclick = () => selectChatUser(user);
            usersList.appendChild(li);
        }
    });
}

function selectChatUser(user) {
    currentChatUser = user;
    messagesDiv.innerHTML = '';

    // Reset message input when switching users
    messageText.value = '';
    encryptedMessageData = null;
    encryptBtn.style.display = 'inline-block';
    sendBtn.style.display = 'none';

    loadMessages();
}

async function loadMessages() {
    if (!currentChatUser) return;

    // Load messages from Supabase
    const { data: messages, error } = await window.supabase
        .from('messages')
        .select('*')
        .or(`and(from.eq.${currentUser.email},to.eq.${currentChatUser.email}),and(from.eq.${currentChatUser.email},to.eq.${currentUser.email})`)
        .order('created_at', { ascending: true });
    if (error) {
        console.error('Error loading messages:', error);
        return;
    }

    messagesDiv.innerHTML = '';
    for (const message of messages) {
        await displayMessage(message);
    }
}

function playNotificationSound() {
    // Create a simple beep sound using Web Audio API
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800; // Frequency in Hz
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
        console.log('Audio notification not supported');
    }
}

async function displayMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    if (message.from === currentUser.email) {
        messageDiv.classList.add('own');
    }

    if (message.ciphertext) {
        // Encrypted message
        const decryptBtn = document.createElement('button');
        decryptBtn.textContent = 'Decrypt';
        decryptBtn.onclick = async () => {
            try {
                const key = await getConversationKey(message.from === currentUser.email ? message.to : message.from);
                const plaintext = await decryptMessage(key, message.ciphertext, message.nonce);
                messageDiv.innerHTML = `<strong>${message.from}:</strong> ${plaintext}`;
            } catch (error) {
                console.error('Decryption failed:', error);
                alert('Failed to decrypt message.');
            }
        };
        messageDiv.appendChild(decryptBtn);
    } else {
        // Plaintext (shouldn't happen in encrypted app)
        messageDiv.textContent = `${message.from}: ${message.plaintext}`;
    }

    messagesDiv.appendChild(messageDiv);
}

async function getConversationKey(otherEmail) {
    if (conversationKeys[otherEmail]) {
        return conversationKeys[otherEmail];
    }

    // Get other user's public key from Supabase
    const { data: users, error } = await window.supabase
        .from('users')
        .select('public_key')
        .eq('email', otherEmail)
        .single();
    if (error || !users) {
        throw new Error('User not found');
    }

    const otherPublicKey = await importPublicKey(users.public_key);

    const key = await generateConversationKey(userKeypair.privateKey, otherPublicKey);
    conversationKeys[otherEmail] = key;
    return key;
}

async function sendMessage() {
    const text = messageText.value.trim();
    if (!text || !currentChatUser) return;

    try {
        const key = await getConversationKey(currentChatUser.email);
        const encrypted = await encryptMessage(key, text);

        // Store message in Supabase
        const { error } = await window.supabase
            .from('messages')
            .insert({
                from: currentUser.email,
                to: currentChatUser.email,
                ciphertext: encrypted.ciphertext,
                nonce: encrypted.nonce,
                created_at: new Date().toISOString()
            });
        if (error) throw error;

        messageText.value = '';

        // Reload messages to show the new one
        loadMessages();
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message.');
    }
}

// Event Listeners
loginBtn.addEventListener('click', () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    if (email && password) loginUser(email, password);
});

registerBtn.addEventListener('click', () => {
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    if (username && email && password) registerUser(username, email, password);
});

logoutBtn.addEventListener('click', () => {
    // Stop message polling
    if (messagePollingInterval) {
        clearInterval(messagePollingInterval);
        messagePollingInterval = null;
    }

    currentUser = null;
    currentChatUser = null;
    userKeypair = null;
    conversationKeys = {};
    authSection.style.display = 'flex';
    chatSection.style.display = 'none';
});

// Encrypt button - Step 1: Encrypt the message
encryptBtn.addEventListener('click', async () => {
    const text = messageText.value.trim();
    if (!text) {
        alert('Please type a message first.');
        return;
    }

    if (!currentChatUser) {
        alert('Please select a recipient first.');
        return;
    }

    try {
        const key = await getConversationKey(currentChatUser.email);
        encryptedMessageData = await encryptMessage(key, text);

        // Replace textarea content with encrypted text
        messageText.value = encryptedMessageData.ciphertext;

        // Show send button, hide encrypt button
        encryptBtn.style.display = 'none';
        sendBtn.style.display = 'inline-block';

        alert('Message encrypted! Now click "Send" to send it.');
    } catch (error) {
        console.error('Encryption failed:', error);
        alert('Failed to encrypt message.');
    }
});

// Send button - Step 2: Send the encrypted message
sendBtn.addEventListener('click', async () => {
    if (!encryptedMessageData) {
        alert('No encrypted message to send.');
        return;
    }

    try {
        // Store message in Supabase
        const { error } = await window.supabase
            .from('messages')
            .insert({
                from: currentUser.email,
                to: currentChatUser.email,
                ciphertext: encryptedMessageData.ciphertext,
                nonce: encryptedMessageData.nonce,
                created_at: new Date().toISOString()
            });
        if (error) throw error;

        // Reset UI
        messageText.value = '';
        encryptedMessageData = null;
        encryptBtn.style.display = 'inline-block';
        sendBtn.style.display = 'none';

        // Reload messages to show the new one
        loadMessages();

        alert('Message sent successfully!');
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message.');
    }
});

searchUsers.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const users = usersList.querySelectorAll('li');
    users.forEach(user => {
        user.style.display = user.textContent.toLowerCase().includes(searchTerm) ? 'block' : 'none';
    });
});
