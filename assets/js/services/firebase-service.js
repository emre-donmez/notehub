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
     * Initialize Firebase
     */
    async initialize() {
        if (this.isInitialized) {
            return true;
        }

        try {
            if (typeof firebase === 'undefined') {
                console.error('Firebase SDK not loaded');
                return false;
            }

            if (typeof firebaseConfig === 'undefined') {
                console.error('Firebase configuration not found');
                return false;
            }

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
     */
    onAuthStateChange(callback) {
        this.authStateChangeCallbacks.push(callback);
    }

    /**
     * Sign in with Google
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
     */
    async loadUserProfile() {
        if (!this.db || !this.user) {
            throw new Error('Firebase not initialized or user not authenticated');
        }

        try {
            const doc = await this.db.collection('userProfiles').doc(this.user.uid).get();
            
            if (doc.exists) {
                const data = doc.data();
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
     */
    async loadNote(noteId) {
        if (!this.db || !this.user) {
            throw new Error('Firebase not initialized or user not authenticated');
        }

        try {
            const doc = await this.db.collection('notes').doc(`${this.user.uid}_${noteId}`).get();
            
            if (doc.exists) {
                const data = doc.data();
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
     * Save user notes using document-based structure
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
     * Load user notes using document-based structure
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
                
                // Add any notes not in the order
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
     */
    isAuthenticated() {
        return this.user !== null;
    }

    /**
     * Get current user information
     */
    getCurrentUser() {
        return this.user;
    }
}

// Export singleton instance
const firebaseService = new FirebaseService();