import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ReactNode } from 'react';

import { UserRole } from '@/types';

interface ProtectedRouteProps {
    children: ReactNode;
    allowedRoles: UserRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
    const { user, isLoading } = useAuth();

    // Wait for auth state to be determined before redirecting
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-4 text-muted-foreground">Loading...</p>
                </div>
            </div>
        );
    }

    // If not logged in, redirect to login
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // If user role doesn't match allowed roles, redirect to their dashboard
    if (!allowedRoles.includes(user.role)) {
        const redirectPath = user.role === 'farmer' ? '/farmer/dashboard' :
            user.role === 'company' ? '/company/dashboard' :
                user.role === 'verifier' ? '/verifier/dashboard' :
                    user.role === 'registry' ? '/registry/dashboard' : '/login';
        return <Navigate to={redirectPath} replace />;
    }

    // User has correct role, render the page
    return <>{children}</>;
}
