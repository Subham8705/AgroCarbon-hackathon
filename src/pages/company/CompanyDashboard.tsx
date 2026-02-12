import DashboardLayout from '@/components/layout/DashboardLayout';
import { Users, Package, Send, TrendingUp, Leaf, ArrowRight, Building2, Check, Clock, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function CompanyDashboard() {
  const { user } = useAuth();
  const [pddStatus, setPddStatus] = useState<string>('not_started');
  const [projectId, setProjectId] = useState<string>('');

  useEffect(() => {
    if (user?.id) fetchPDDStatus();
  }, [user]);

  const fetchPDDStatus = async () => {
    const q = query(collection(db, 'pdd_requests'), where('companyId', '==', user?.id));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const data = snap.docs[0].data();
      setPddStatus(data.status);
      setProjectId(data.registryProjectId || '');
    }
  };

  return (
    <DashboardLayout role="company">
      <div className="p-6 lg:p-8 space-y-8">
        {/* Header */}
        <div className="animate-fade-in flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Company Dashboard 🏢</h1>
            <p className="text-muted-foreground mt-1">Manage farmers, batches, and verification requests</p>
          </div>

          {/* Status Indicator */}
          <div className={`px-4 py-3 rounded-lg border flex items-center gap-3 ${pddStatus === 'validated'
            ? 'bg-green-100 text-green-700 border-green-200'
            : pddStatus === 'rejected'
              ? 'bg-red-100 text-red-700 border-red-200'
              : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}>
            {pddStatus === 'validated' ? <Check className="w-5 h-5" /> :
              pddStatus === 'rejected' ? <X className="w-5 h-5" /> :
                <Clock className="w-5 h-5" />}
            <div className="flex flex-col gap-1">
              <span className="font-bold text-sm">Project Status: {pddStatus === 'validated' ? 'VALIDATED' : pddStatus.replace('_', ' ').toUpperCase()}</span>
              {pddStatus === 'validated' && projectId && (
                <span className="text-lg font-mono font-bold tracking-wide">ID: {projectId}</span>
              )}
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="stat-card animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <div className="stat-value">127</div>
                <div className="stat-label">Total Farmers</div>
              </div>
            </div>
          </div>

          <div className="stat-card animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                <Leaf className="w-6 h-6 text-accent" />
              </div>
              <div>
                <div className="stat-value">452</div>
                <div className="stat-label">Total Acres</div>
              </div>
            </div>
          </div>

          <div className="stat-card animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-info/10 flex items-center justify-center">
                <Package className="w-6 h-6 text-info" />
              </div>
              <div>
                <div className="stat-value">3</div>
                <div className="stat-label">Active Batches</div>
              </div>
            </div>
          </div>

          <div className="stat-card animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl gradient-verifier flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="stat-value">89.5</div>
                <div className="stat-label">Est. tCO₂</div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Action Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Link to="/company/farmers" className="block">
            <div className="action-card group h-full animate-fade-in" style={{ animationDelay: '0.5s' }}>
              <div className="w-14 h-14 rounded-2xl gradient-farmer flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Users className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-display font-bold text-foreground mb-2">Farmer List</h3>
              <p className="text-muted-foreground text-sm mb-4">
                View and manage all enrolled farmers with their plot details and carbon estimates.
              </p>
              <div className="flex items-center gap-2 text-primary font-medium text-sm">
                View Farmers
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>

          <Link to="/company/batches" className="block">
            <div className="action-card group h-full animate-fade-in" style={{ animationDelay: '0.6s' }}>
              <div className="w-14 h-14 rounded-2xl gradient-company flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Package className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-display font-bold text-foreground mb-2">Batch View</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Auto-grouped monthly batches with farmer counts and carbon totals.
              </p>
              <div className="flex items-center gap-2 text-primary font-medium text-sm">
                View Batches
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>

          <Link to="/company/verification" className="block">
            <div className="action-card group h-full animate-fade-in" style={{ animationDelay: '0.7s' }}>
              <div className="w-14 h-14 rounded-2xl gradient-verifier flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Send className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-display font-bold text-foreground mb-2">Verification</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Select verifiers and send batches for carbon credit verification.
              </p>
              <div className="flex items-center gap-2 text-primary font-medium text-sm">
                Manage Verification
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>

          <Link to="/company/pdd" className="block">
            <div className="action-card group h-full animate-fade-in" style={{ animationDelay: '0.8s' }}>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Building2 className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-display font-bold text-foreground mb-2">Project Registration</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Submit PDD to registry and get your Project ID.
              </p>
              <div className="flex items-center gap-2 text-primary font-medium text-sm">
                Manage PDD
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>
        </div>

        {/* Recent Activity */}
        <div className="card-elevated p-6 animate-fade-in" style={{ animationDelay: '0.8s' }}>
          <h3 className="text-lg font-display font-bold text-foreground mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {[
              { action: 'New farmer enrolled', detail: 'Ravi Kumar - 4 acres', time: '2 hours ago', icon: Users },
              { action: 'Batch sent for verification', detail: 'Batch Jan 2026 - 45 farmers', time: '1 day ago', icon: Send },
              { action: 'Verification completed', detail: 'Batch Dec 2025 - 12.5 tCO₂ verified', time: '3 days ago', icon: Package },
            ].map((item, index) => (
              <div key={index} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground">{item.action}</div>
                  <div className="text-sm text-muted-foreground truncate">{item.detail}</div>
                </div>
                <div className="text-xs text-muted-foreground shrink-0">{item.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
