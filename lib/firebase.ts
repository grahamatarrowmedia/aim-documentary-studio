import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, User, onAuthStateChanged } from 'firebase/auth';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

// Only initialize if config is provided
const app = firebaseConfig.apiKey ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
const googleProvider = new GoogleAuthProvider();

export const firebaseAuth = {
    async signInWithGoogle(): Promise<User | null> {
        if (!auth) {
            console.warn('Firebase not configured');
            return null;
        }
        try {
            const result = await signInWithPopup(auth, googleProvider);
            return result.user;
        } catch (error) {
            console.error('Google Sign-In Error:', error);
            throw error;
        }
    },

    async signOut(): Promise<void> {
        if (!auth) return;
        await signOut(auth);
    },

    onAuthStateChanged(callback: (user: User | null) => void): () => void {
        if (!auth) {
            callback(null);
            return () => { };
        }
        return onAuthStateChanged(auth, callback);
    },

    getCurrentUser(): User | null {
        return auth?.currentUser || null;
    },
};
