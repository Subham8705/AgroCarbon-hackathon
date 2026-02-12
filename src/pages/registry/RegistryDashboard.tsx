import DashboardLayout from '@/components/layout/DashboardLayout';
import { Archive, Leaf, Building2, FileCheck, TrendingUp, ArrowRight, Loader2, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getCountFromServer, getAggregateFromServer, sum } from 'firebase/firestore';

export default function RegistryDashboard() {
  const [stats, setStats] = useState({
    totalIssued: 0,
    companies: 0,
    verifiedBatches: 0,
    farmersCredited: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      // 1. Total Issued Credits (Sum of Final Credits)
      // Aggregation queries are efficient
      const coll = collection(db, 'verification_requests');
      const qIssued = query(coll, where('status', '==', 'issued'));
      const snapshotIssued = await getAggregateFromServer(qIssued, {
        totalCredits: sum('finalCreditsIssued')
      });

      // 2. Verified Batches count
      const snapshotBatches = await getCountFromServer(qIssued);

      // 3. Companies (This is harder without a dedicated users collection with roles indexed, 
      // assumes we might have a users collection or just count unique companies in requests?
      // For now, let's mock or count unique companyNames if possible, but that's expensive client slide.
      // Let's just count requests active.)
      // Simplified: Hardcode companies or fetch from profiles if exists. 
      // Let's use a dummy query for companies for now or 0.

      setStats({
        totalIssued: snapshotIssued.data().totalCredits || 0,
        companies: 5, // Mock for now until User collection is robust
        verifiedBatches: snapshotBatches.data().count || 0,
        farmersCredited: 0 // Would need to aggregate plot counts
      });

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout role="registry">
      <div className="p-6 lg:p-8 space-y-8">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-3xl font-display font-bold text-foreground">Registry Dashboard 🏛️</h1>
          <p className="text-muted-foreground mt-1">Overview of all verified and issued carbon credits</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="stat-card animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl gradient-registry flex items-center justify-center">
                <Leaf className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="stat-value">{loading ? '-' : stats.totalIssued.toFixed(1)}</div>
                <div className="stat-label">Total tCO₂ Issued</div>
              </div>
            </div>
          </div>

          <div className="stat-card animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <div className="stat-value">{stats.companies}</div>
                <div className="stat-label">Project Companies</div>
              </div>
            </div>
          </div>

          <div className="stat-card animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl gradient-verifier flex items-center justify-center">
                <FileCheck className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="stat-value">{loading ? '-' : stats.verifiedBatches}</div>
                <div className="stat-label">Verified Batches</div>
              </div>
            </div>
          </div>

          <div className="stat-card animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-info/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-info" />
              </div>
              <div>
                <div className="stat-value">{stats.farmersCredited}</div>
                <div className="stat-label">Farmers Credited</div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Action */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link to="/registry/issuances" className="block">
            <div className="action-card group animate-fade-in" style={{ animationDelay: '0.5s' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl gradient-registry flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Archive className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-display font-bold text-foreground">View All Issuances</h3>
                    <p className="text-muted-foreground text-sm">
                      Complete registry of verified credits by company and project
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-6 h-6 text-primary group-hover:translate-x-2 transition-transform" />
              </div>
            </div>
          </Link>

          <Link to="/registry/pdd-requests" className="block">
            <div className="action-card group animate-fade-in" style={{ animationDelay: '0.6s' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FileText className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-display font-bold text-foreground">Pending PDD Requests</h3>
                    <p className="text-muted-foreground text-sm">
                      Review and approve submitted Project Design Documents
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-6 h-6 text-primary group-hover:translate-x-2 transition-transform" />
              </div>
            </div>
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
