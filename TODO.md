# TODO List for StealthMsg Web App (Supabase Migration)

- [x] Create index.html: Basic HTML structure with auth forms and chat interface
- [x] Create style.css: Dark theme with green Omnitrix-inspired styling
- [x] Create firebase-config.js: Placeholder Firebase configuration (now supabase-config.js)
- [x] Create crypto.js: WebCrypto functions for key generation, derivation, encryption/decryption
- [x] Create main.js: App logic for auth, Firestore, UI events, crypto integration
- [x] Modify main.js: Replace localStorage auth with Supabase Auth
- [x] Modify main.js: Replace localStorage user storage with Supabase 'users' table
- [x] Modify main.js: Replace localStorage message storage with Supabase 'messages' table and real-time subscriptions
- [x] Update index.html: Add Supabase SDK scripts for Auth and Database
- [x] Update firebase-config.js to supabase-config.js: Replace placeholder with real Supabase config (user must provide URL and anon key)
- [x] Migrate loadUsers() from Firestore to Supabase
- [x] Migrate loadMessages() from Firestore to Supabase
- [x] Migrate getConversationKey() from Firestore to Supabase
- [x] Migrate sendMessage() from Firestore to Supabase
- [x] Migrate sendBtn event listener from Firestore to Supabase
- [x] Test authentication and real-time messaging with Supabase (app launched successfully)
- [ ] Implement offline/online state handling
- [x] Rename firebase-config.js to supabase-config.js for clarity
