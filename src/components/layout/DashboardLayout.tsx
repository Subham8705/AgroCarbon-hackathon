import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';
import {
  Leaf,
  Home,
  Calculator,
  FolderOpen,
  Users,
  Package,
  Send,
  ClipboardCheck,
  FileCheck,
  Archive,
  LogOut,
  Menu,
  X,
  TreePine,
  Shield,
  ShoppingBag,
  DollarSign,
  UserPlus,
  Map as MapIcon,
  Briefcase
} from 'lucide-react';
import { useState } from 'react';
import NotificationBell from './NotificationBell';

interface DashboardLayoutProps {
  children: ReactNode;
  role: UserRole;
}

const navItems: Record<UserRole, { label: string; icon: ReactNode; path: string }[]> = {
  farmer: [
    { label: 'Dashboard', icon: <Home className="w-5 h-5" />, path: '/farmer/dashboard' },
    { label: 'Estimate CO₂', icon: <Calculator className="w-5 h-5" />, path: '/farmer/estimate' },
    { label: 'Projects', icon: <FolderOpen className="w-5 h-5" />, path: '/farmer/projects' },
    { label: 'My Project', icon: <TreePine className="w-5 h-5" />, path: '/farmer/my-project' },
  ],
  company: [
    { label: 'Dashboard', icon: <Home className="w-5 h-5" />, path: '/company/dashboard' },
    { label: 'Requests', icon: <ClipboardCheck className="w-5 h-5" />, path: '/company/requests' },
    { label: 'Farmers', icon: <Users className="w-5 h-5" />, path: '/company/farmers' },
    { label: 'Batches', icon: <Package className="w-5 h-5" />, path: '/company/batches' },
    { label: 'VVB', icon: <Send className="w-5 h-5" />, path: '/company/verification' },
    { label: 'My PDD', icon: <FileCheck className="w-5 h-5" />, path: '/company/my-pdd' },
    { label: 'Project Registration', icon: <FolderOpen className="w-5 h-5" />, path: '/company/pdd' },
    { label: 'Issued Credits', icon: <Archive className="w-5 h-5" />, path: '/company/credits' },
    { label: 'Sales & Revenue', icon: <DollarSign className="w-5 h-5" />, path: '/company/sales' },
  ],
  verifier: [
    { label: 'Dashboard', icon: <Home className="w-5 h-5" />, path: '/verifier/dashboard' },
    { label: 'Requests', icon: <ClipboardCheck className="w-5 h-5" />, path: '/verifier/requests' },
    { label: 'Verified', icon: <FileCheck className="w-5 h-5" />, path: '/verifier/verified' },
  ],
  registry: [
    { label: 'Dashboard', icon: <Home className="w-5 h-5" />, path: '/registry/dashboard' },
    { label: 'Approvals', icon: <FileCheck className="w-5 h-5" />, path: '/registry/approvals' },
    { label: 'Issuances', icon: <Archive className="w-5 h-5" />, path: '/registry/issuances' },
    { label: 'PDD Requests', icon: <ClipboardCheck className="w-5 h-5" />, path: '/registry/pdd-requests' },
    { label: 'Validation Reviews', icon: <Shield className="w-5 h-5" />, path: '/registry/validation-reviews' },
  ],
  buyer: [
    { label: 'Dashboard', icon: <Home className="w-5 h-5" />, path: '/buyer/dashboard' },
    { label: 'Marketplace', icon: <ShoppingBag className="w-5 h-5" />, path: '/buyer/marketplace' },
    { label: 'My Purchases', icon: <Package className="w-5 h-5" />, path: '/buyer/purchases' },
  ],
  agent: [
    { label: 'Dashboard', icon: <Home className="w-5 h-5" />, path: '/agent/dashboard' },
    { label: 'Register Farmer', icon: <UserPlus className="w-5 h-5" />, path: '/agent/register' },
    { label: 'Map View', icon: <MapIcon className="w-5 h-5" />, path: '/agent/map' },
    { label: 'Available Projects', icon: <Briefcase className="w-5 h-5" />, path: '/agent/projects' },
    { label: 'My Projects', icon: <TreePine className="w-5 h-5" />, path: '/agent/my-projects' },
  ],
};

const roleColors: Record<UserRole, string> = {
  farmer: 'gradient-farmer',
  company: 'gradient-company',
  verifier: 'gradient-verifier',
  registry: 'gradient-registry',
  buyer: 'gradient-buyer',
  agent: 'gradient-company', // Reusing company gradient for now
};

const roleTitles: Record<UserRole, string> = {
  farmer: 'Farmer Portal',
  company: 'Company Portal',
  verifier: 'Verifier Portal',
  registry: 'Registry Portal',
  buyer: 'Buyer Portal',
  agent: 'Agent Portal',
};

export default function DashboardLayout({ children, role }: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const items = navItems[role];

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-sidebar border-r border-sidebar-border h-full flex-shrink-0">
        {/* Logo */}
        <div className="p-6 border-b border-sidebar-border">
          <Link to={items[0]?.path || '/'} className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${roleColors[role]} flex items-center justify-center`}>
              <Leaf className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-lg font-display font-bold text-sidebar-foreground">AgroCarbon</span>
              <div className="text-xs text-sidebar-foreground/60 capitalize">{role}</div>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {items.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                  }`}
              >
                {item.icon}
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
          {role === 'farmer' && <NotificationBell isSidebar />}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-sidebar-accent flex items-center justify-center text-sidebar-foreground font-medium">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-sidebar-foreground truncate">{user?.name}</div>
              <div className="text-xs text-sidebar-foreground/60 capitalize">{role}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b border-border z-50 flex items-center justify-between px-4">
        <Link to={items[0]?.path || '/'} className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg ${roleColors[role]} flex items-center justify-center`}>
            <Leaf className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-bold text-foreground">AgroCarbon</span>
        </Link>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-muted-foreground hover:text-foreground"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Mobile Menu */}
      <div
        className={`lg:hidden fixed top-16 left-0 bottom-0 w-64 bg-sidebar z-50 transform transition-transform ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <nav className="p-4 space-y-1">
          {items.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                  }`}
              >
                {item.icon}
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
          {role === 'farmer' && <NotificationBell isSidebar />}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-sidebar-border">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 lg:pt-0 pt-16 overflow-y-auto h-full">
        {children}
      </main>
    </div>
  );
}
