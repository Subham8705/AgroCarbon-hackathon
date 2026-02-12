import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole } from '@/types';
import { auth, db } from '@/lib/firebase';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<User | null>;
  signup: (data: SignupData) => Promise<void>;
  logout: () => void;
  setUserRole: (role: UserRole) => void;
}

interface SignupData {
  role: UserRole;
  phone: string;
  password: string;
  name: string;
  email?: string;
  companyName?: string;
  organization?: string;
  licenseNumber?: string;
  // Extras for Project Company
  minAcres?: number;
  capacity?: number;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Monitor Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        // User is signed in, fetch user details from Firestore
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            setUser(userDoc.data() as User);
          } else {
            console.error('User document not found in Firestore');
            setUser(null);
            // Optionally sign out if no user doc flows
            // await signOut(auth); 
          }
        } catch (error) {
          console.error('Error fetching user details:', error);
          setUser(null);
        }
      } else {
        // User is signed out
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (phone: string, password: string): Promise<User | null> => {
    setIsLoading(true);
    try {
      // NOTE: Firebase Auth uses Email/Password.
      // The Login UI asks for "Phone", but we should probably swap it to Email for standards.
      // Or, if we assume "Phone" is the identifier, we need to construct a fake email 
      // like `phone@carbonconnect.local` OR assume the User enters Email in the "Phone" field.
      // given the previous step plan, we said we'd update Login to use Email.
      // But for now, let's treat the 'phone' argument as 'email' if it looks like one, or construct one.

      let emailToUse = phone;
      if (!phone.includes('@')) {
        // Fallback logic if user enters just numbers (temporary hack if UI not updated)
        emailToUse = `${phone}@carbonconnect.local`;
      }

      const userCredential = await signInWithEmailAndPassword(auth, emailToUse, password);

      // Fetch doc immediately to return it for UI redirection logic
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        return userData;
      }

      // State is also handled by onAuthStateChanged listener eventually
      return null;
    } catch (error: any) {
      console.error("Login error", error);
      throw new Error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (data: SignupData) => {
    setIsLoading(true);
    try {
      // Create Auth User
      // Prefer email from data.email, else fallback to synthetic email from phone
      const emailToUse = data.email && data.email.includes('@') ? data.email : `${data.phone}@agrocarbon.com`;

      const userCredential = await createUserWithEmailAndPassword(auth, emailToUse, data.password);
      const firebaseUser = userCredential.user;

      // Create User Document
      const newUser: User & { minAcres?: number; capacity?: number; companyName?: string; } = {
        id: firebaseUser.uid,
        role: data.role,
        phone: data.phone,
        name: data.name,
        email: emailToUse,
        createdAt: new Date(),
        // Add company specific fields if they exist
        ...(data.role === 'company' && {
          companyName: data.companyName,
          minAcres: data.minAcres,
          capacity: data.capacity
        }),
        // Add others if needed
        ...(data.role === 'verifier' && {
          organization: data.organization,
          licenseNumber: data.licenseNumber
        })
      };

      await setDoc(doc(db, 'users', firebaseUser.uid), newUser);

      setUser(newUser); // Optimistic update
    } catch (error: any) {
      console.error("Signup error", error);
      throw new Error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      localStorage.removeItem('agrocarbon_user'); // Cleanup legacy if exists
    } catch (error) {
      console.error("Logout error", error);
    }
  };

  const setUserRole = (role: UserRole) => {
    // This was a mock helper. In real Firebase, role is fixed in DB.
    // We can update DB if really needed, but usually we don't switch roles on the fly.
    if (user) {
      setUser({ ...user, role });
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout, setUserRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
