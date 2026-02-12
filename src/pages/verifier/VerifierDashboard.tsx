import DashboardLayout from '@/components/layout/DashboardLayout';
import { ClipboardCheck, FileCheck, Shield, TrendingUp, Clock, ArrowRight, Package } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function VerifierDashboard() {
  return (
    <DashboardLayout role="verifier">
      <div className="p-6 lg:p-8 space-y-8">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-3xl font-display font-bold text-foreground">Verifier Dashboard 🔬</h1>
          <p className="text-muted-foreground mt-1">Review and verify carbon credit batches</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="stat-card animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-pending/10 flex items-center justify-center">
                <Clock className="w-6 h-6 text-pending" />
              </div>
              <div>
                <div className="stat-value">3</div>
                <div className="stat-label">Pending Requests</div>
              </div>
            </div>
          </div>
          
          <div className="stat-card animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl gradient-verifier flex items-center justify-center">
                <FileCheck className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="stat-value">28</div>
                <div className="stat-label">Verified This Month</div>
              </div>
            </div>
          </div>
          
          <div className="stat-card animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <div>
                <div className="stat-value">156</div>
                <div className="stat-label">Total Verifications</div>
              </div>
            </div>
          </div>
          
          <div className="stat-card animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                <Shield className="w-6 h-6 text-accent" />
              </div>
              <div>
                <div className="stat-value">4.8</div>
                <div className="stat-label">Avg Rating</div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Link to="/verifier/requests" className="block">
            <div className="action-card group h-full animate-fade-in" style={{ animationDelay: '0.5s' }}>
              <div className="w-14 h-14 rounded-2xl gradient-verifier flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <ClipboardCheck className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-display font-bold text-foreground mb-2">Incoming Requests</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Review pending verification requests from project companies. Inspect plots and submit verified credits.
              </p>
              <div className="flex items-center justify-between">
                <span className="status-pending">3 Pending</span>
                <div className="flex items-center gap-2 text-primary font-medium text-sm">
                  View Requests
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          </Link>

          <Link to="/verifier/verified" className="block">
            <div className="action-card group h-full animate-fade-in" style={{ animationDelay: '0.6s' }}>
              <div className="w-14 h-14 rounded-2xl gradient-farmer flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <FileCheck className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-display font-bold text-foreground mb-2">Verified Credits</h3>
              <p className="text-muted-foreground text-sm mb-4">
                View your verification history and all credits you've verified for the registry.
              </p>
              <div className="flex items-center justify-between">
                <span className="status-approved">28 This Month</span>
                <div className="flex items-center gap-2 text-primary font-medium text-sm">
                  View History
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Recent Verifications */}
        <div className="card-elevated p-6 animate-fade-in" style={{ animationDelay: '0.7s' }}>
          <h3 className="text-lg font-display font-bold text-foreground mb-4">Recent Verifications</h3>
          <div className="space-y-4">
            {[
              { project: 'Regenerative Cotton Initiative', batch: 'Jan 2026', plots: 45, credits: 82.4, date: '2 days ago' },
              { project: 'Sustainable Rice Farming', batch: 'Dec 2025', plots: 38, credits: 68.2, date: '1 week ago' },
              { project: 'Agroforestry Carbon Project', batch: 'Dec 2025', plots: 52, credits: 95.1, date: '2 weeks ago' },
            ].map((item, index) => (
              <div key={index} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="w-10 h-10 rounded-lg gradient-verifier flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground">{item.project}</div>
                  <div className="text-sm text-muted-foreground">{item.batch} • {item.plots} plots</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-primary">{item.credits} tCO₂</div>
                  <div className="text-xs text-muted-foreground">{item.date}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
