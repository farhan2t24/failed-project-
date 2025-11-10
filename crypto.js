// WebCrypto API utilities for StealthMsg

// Generate X25519 keypair
async function generateKeypair() {
    const keyPair = await crypto.subtle.generateKey(
        {
            name: "ECDH",
            namedCurve: "P-256" // Note: WebCrypto uses P-256 for ECDH, not X25519 directly
        },
        true,
        ["deriveKey", "deriveBits"]
    );
    return keyPair;
}

// Export public key as base64
async function exportPublicKey(key) {
    const exported = await crypto.subtle.exportKey("spki", key);
    return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

// Import public key from base64
async function importPublicKey(base64Key) {
    const keyData = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
    return await crypto.subtle.importKey(
        "spki",
        keyData,
        {
            name: "ECDH",
            namedCurve: "P-256"
        },
        true,
        []
    );
}

// Derive shared secret using ECDH
async function deriveSharedSecret(privateKey, publicKey) {
    return await crypto.subtle.deriveBits(
        {
            name: "ECDH",
            public: publicKey
        },
        privateKey,
        256
    );
}

// HKDF for key expansion
async function hkdfExpand(sharedSecret, salt, info) {
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        sharedSecret,
        "HKDF",
        false,
        ["deriveKey"]
    );

    return await crypto.subtle.deriveKey(
        {
            name: "HKDF",
            hash: "SHA-256",
            salt: salt,
            info: info
        },
        keyMaterial,
        {
            name: "AES-GCM",
            length: 256
        },
        true,
        ["encrypt", "decrypt"]
    );
}

// Encrypt message with AES-256-GCM
async function encryptMessage(key, plaintext) {
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit nonce
    const encoded = new TextEncoder().encode(plaintext);

    const ciphertext = await crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        key,
        encoded
    );

    return {
        ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
        nonce: btoa(String.fromCharCode(...iv))
    };
}

// Decrypt message with AES-256-GCM
async function decryptMessage(key, ciphertext, nonce) {
    const iv = Uint8Array.from(atob(nonce), c => c.charCodeAt(0));
    const encrypted = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));

    const decrypted = await crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        key,
        encrypted
    );

    return new TextDecoder().decode(decrypted);
}

// Generate AES key for a conversation
async function generateConversationKey(myPrivateKey, theirPublicKey) {
    const sharedSecret = await deriveSharedSecret(myPrivateKey, theirPublicKey);
    const salt = crypto.getRandomValues(new Uint8Array(32)); // Random salt
    const info = new TextEncoder().encode("StealthMsg Conversation Key");
    return await hkdfExpand(sharedSecret, salt, info);
}
