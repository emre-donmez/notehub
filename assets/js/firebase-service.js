/**
 * Firebase Service
 * Handles Firebase initialization, authentication, and Firestore operations
 */
class FirebaseService {
    constructor() {
        this.app = null;
        this.db = null;
        this.auth = null;
        this.user = null;
        this.isInitialized = false;
        this.authStateChangeCallbacks = [];
    }

    /**
     * Initialize Firebase with direct configuration
     * @returns {Promise<boolean>} True if initialized successfully
     */
    async initialize() {
        if (this.isInitialized) {
            return true;
        }

        try {
            // Check if Firebase SDK is loaded
            if (typeof firebase === 'undefined') {
                console.error('Firebase SDK not loaded');
                return false;
            }

            // Check if Firebase config is available
            if (typeof firebaseConfig === 'undefined') {
                console.error('Firebase configuration not found');
                return false;
            }

            // Initialize Firebase
            this.app = firebase.initializeApp(firebaseConfig);
            this.db = firebase.firestore();
            this.auth = firebase.auth();

            // Set up authentication state listener
            this.auth.onAuthStateChanged((user) => {
                this.user = user;
                this.authStateChangeCallbacks.forEach(callback => callback(user));
            });

            this.isInitialized = true;
            console.log('Firebase initialized successfully');
            return true;
        } catch (error) {
            console.error('Firebase initialization failed:', error);
            return false;
        }
    }

    /**
     * Add authentication state change listener
     * @param {Function} callback - Callback function to execute on auth state change
     */
    onAuthStateChange(callback) {
        this.authStateChangeCallbacks.push(callback);
    }

    /**
     * Sign in with Google
     * @returns {Promise<Object|null>} User object or null if failed
     */
    async signInWithGoogle() {
        if (!this.auth) return null;

        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            const result = await this.auth.signInWithPopup(provider);
            return result.user;
        } catch (error) {
            console.error('Google sign-in failed:', error);
            throw error;
        }
    }

    /**
     * Sign out current user
     * @returns {Promise<void>}
     */
    async signOut() {
        if (!this.auth) return;

        try {
            await this.auth.signOut();
        } catch (error) {
            console.error('Sign-out failed:', error);
            throw error;
        }
    }

    /**
     * Save user notes to Firestore
     * @param {Object} data - Notes data to save
     * @returns {Promise<boolean>} True if saved successfully
     */
    async saveUserNotes(data) {
        if (!this.db || !this.user) {
            throw new Error('Firebase not initialized or user not authenticated');
        }

        try {
            const notesData = {
                ...data,
                lastModified: firebase.firestore.FieldValue.serverTimestamp(),
                userId: this.user.uid
            };

            await this.db.collection('userNotes').doc(this.user.uid).set(notesData);
            return true;
        } catch (error) {
            console.error('Failed to save notes to Firebase:', error);
            throw error;
        }
    }

    /**
     * Load user notes from Firestore
     * @returns {Promise<Object|null>} Notes data or null if not found
     */
    async loadUserNotes() {
        if (!this.db || !this.user) {
            throw new Error('Firebase not initialized or user not authenticated');
        }

        try {
            const doc = await this.db.collection('userNotes').doc(this.user.uid).get();
            
            if (doc.exists) {
                const data = doc.data();
                // Remove Firebase-specific fields
                delete data.lastModified;
                delete data.userId;
                return data;
            }
            return null;
        } catch (error) {
            console.error('Failed to load notes from Firebase:', error);
            throw error;
        }
    }

    /**
     * Check if user is authenticated
     * @returns {boolean} True if user is authenticated
     */
    isAuthenticated() {
        return this.user !== null;
    }

    /**
     * Get current user information
     * @returns {Object|null} User object or null
     */
    getCurrentUser() {
        return this.user;
    }
}

// Export singleton instance
const firebaseService = new FirebaseService();