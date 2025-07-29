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
     * Save user profile (metadata) to Firestore
     * @param {Object} profileData - Profile data with activeTabId, tabCounter, noteOrder
     * @returns {Promise<boolean>} True if saved successfully
     */
    async saveUserProfile(profileData) {
        if (!this.db || !this.user) {
            throw new Error('Firebase not initialized or user not authenticated');
        }

        try {
            const profile = {
                ...profileData,
                lastModified: firebase.firestore.FieldValue.serverTimestamp(),
                userId: this.user.uid
            };

            await this.db.collection('userProfiles').doc(this.user.uid).set(profile);
            return true;
        } catch (error) {
            console.error('Failed to save user profile to Firebase:', error);
            throw error;
        }
    }

    /**
     * Load user profile (metadata) from Firestore
     * @returns {Promise<Object|null>} Profile data or null if not found
     */
    async loadUserProfile() {
        if (!this.db || !this.user) {
            throw new Error('Firebase not initialized or user not authenticated');
        }

        try {
            const doc = await this.db.collection('userProfiles').doc(this.user.uid).get();
            
            if (doc.exists) {
                const data = doc.data();
                // Remove Firebase-specific fields
                delete data.lastModified;
                delete data.userId;
                return data;
            }
            return null;
        } catch (error) {
            console.error('Failed to load user profile from Firebase:', error);
            throw error;
        }
    }

    /**
     * Save individual note to Firestore
     * @param {Object} note - Note object with id, title, content
     * @returns {Promise<boolean>}
     */
    async saveNote(note) {
        if (!this.db || !this.user) {
            throw new Error('Firebase not initialized or user not authenticated');
        }

        try {
            const noteData = {
                id: note.id,
                title: note.title,
                content: note.content,
                lastModified: firebase.firestore.FieldValue.serverTimestamp(),
                userId: this.user.uid
            };

            await this.db.collection('notes').doc(`${this.user.uid}_${note.id}`).set(noteData);
            return true;
        } catch (error) {
            console.error('Failed to save note to Firebase:', error);
            throw error;
        }
    }

    /**
     * Load individual note from Firestore
     * @param {number} noteId - Note ID to load
     * @returns {Promise<Object|null>} Note data or null if not found
     */
    async loadNote(noteId) {
        if (!this.db || !this.user) {
            throw new Error('Firebase not initialized or user not authenticated');
        }

        try {
            const doc = await this.db.collection('notes').doc(`${this.user.uid}_${noteId}`).get();
            
            if (doc.exists) {
                const data = doc.data();
                // Remove Firebase-specific fields
                delete data.lastModified;
                delete data.userId;
                return data;
            }
            return null;
        } catch (error) {
            console.error('Failed to load note from Firebase:', error);
            throw error;
        }
    }

    /**
     * Load all user notes from Firestore
     * @returns {Promise<Array>} Array of note objects
     */
    async loadAllUserNotes() {
        if (!this.db || !this.user) {
            throw new Error('Firebase not initialized or user not authenticated');
        }

        try {
            const querySnapshot = await this.db.collection('notes')
                .where('userId', '==', this.user.uid)
                .get();
            
            const notes = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                // Remove Firebase-specific fields
                delete data.lastModified;
                delete data.userId;
                notes.push(data);
            });

            return notes;
        } catch (error) {
            console.error('Failed to load all notes from Firebase:', error);
            throw error;
        }
    }

    /**
     * Delete note from Firestore
     * @param {number} noteId - Note ID to delete
     * @returns {Promise<boolean>} True if deleted successfully
     */
    async deleteNote(noteId) {
        if (!this.db || !this.user) {
            throw new Error('Firebase not initialized or user not authenticated');
        }

        try {
            await this.db.collection('notes').doc(`${this.user.uid}_${noteId}`).delete();
            return true;
        } catch (error) {
            console.error('Failed to delete note from Firebase:', error);
            throw error;
        }
    }

    /**
     * Save user notes using new document-based structure
     * @param {Object} data - Notes data to save (backwards compatibility)
     * @returns {Promise<boolean>} True if saved successfully
     */
    async saveUserNotes(data) {
        if (!this.db || !this.user) {
            throw new Error('Firebase not initialized or user not authenticated');
        }

        try {
            // Extract profile data
            const profileData = {
                activeTabId: data.activeTabId,
                noteOrder: data.tabs ? data.tabs.map(tab => tab.id) : []
            };

            // Save profile
            await this.saveUserProfile(profileData);

            // Save individual notes
            if (data.tabs && Array.isArray(data.tabs)) {
                const savePromises = data.tabs.map(tab => this.saveNote(tab));
                await Promise.all(savePromises);
            }

            return true;
        } catch (error) {
            console.error('Failed to save user notes:', error);
            throw error;
        }
    }

    /**
     * Load user notes using new document-based structure
     * @returns {Promise<Object|null>} Notes data in old format (backwards compatibility)
     */
    async loadUserNotes() {
        if (!this.db || !this.user) {
            throw new Error('Firebase not initialized or user not authenticated');
        }

        try {
            // Load profile and notes
            const [profile, allNotes] = await Promise.all([
                this.loadUserProfile(),
                this.loadAllUserNotes()
            ]);

            if (!profile && allNotes.length === 0) {
                return null;
            }

            // Sort notes according to noteOrder from profile
            let sortedNotes = allNotes;
            if (profile && profile.noteOrder) {
                sortedNotes = profile.noteOrder
                    .map(id => allNotes.find(note => note.id === id))
                    .filter(note => note !== undefined);
                
                // Add any notes not in the order (in case of inconsistency)
                const orderedIds = new Set(profile.noteOrder);
                const unorderedNotes = allNotes.filter(note => !orderedIds.has(note.id));
                sortedNotes.push(...unorderedNotes);
            }

            // Return in old format for backwards compatibility
            return {
                tabs: sortedNotes,
                activeTabId: profile?.activeTabId || (sortedNotes.length > 0 ? sortedNotes[0].id : null)
            };
        } catch (error) {
            console.error('Failed to load user notes:', error);
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

    /**
     * Save encryption settings to Firestore for cross-device sync
     * @param {Object} encryptionSettings - Encryption settings (salt, algorithm, etc.)
     * @returns {Promise<boolean>} True if saved successfully
     */
    async saveEncryptionSettings(encryptionSettings) {
        if (!this.db || !this.user) {
            throw new Error('Firebase not initialized or user not authenticated');
        }

        try {
            const settings = {
                ...encryptionSettings,
                lastModified: firebase.firestore.FieldValue.serverTimestamp(),
                userId: this.user.uid
            };

            await this.db.collection('encryptionSettings').doc(this.user.uid).set(settings);
            console.log('? Encryption settings saved to cloud');
            return true;
        } catch (error) {
            console.error('Failed to save encryption settings to Firebase:', error);
            throw error;
        }
    }

    /**
     * Load encryption settings from Firestore for cross-device sync
     * @returns {Promise<Object|null>} Encryption settings or null if not found
     */
    async loadEncryptionSettings() {
        if (!this.db || !this.user) {
            throw new Error('Firebase not initialized or user not authenticated');
        }

        try {
            const doc = await this.db.collection('encryptionSettings').doc(this.user.uid).get();
            
            if (doc.exists) {
                const data = doc.data();
                // Remove Firebase-specific fields
                delete data.lastModified;
                delete data.userId;
                console.log('? Encryption settings loaded from cloud');
                return data;
            }
            console.log('?? No encryption settings found in cloud');
            return null;
        } catch (error) {
            console.error('Failed to load encryption settings from Firebase:', error);
            throw error;
        }
    }

    /**
     * Delete encryption settings from Firestore
     * @returns {Promise<boolean>} True if deleted successfully
     */
    async deleteEncryptionSettings() {
        if (!this.db || !this.user) {
            throw new Error('Firebase not initialized or user not authenticated');
        }

        try {
            await this.db.collection('encryptionSettings').doc(this.user.uid).delete();
            console.log('? Encryption settings deleted from cloud');
            return true;
        } catch (error) {
            console.error('Failed to delete encryption settings from Firebase:', error);
            throw error;
        }
    }
}

// Export singleton instance
const firebaseService = new FirebaseService();