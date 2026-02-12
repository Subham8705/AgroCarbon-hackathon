import DashboardLayout from '@/components/layout/DashboardLayout';
import { Package, ShoppingBag, TrendingUp, ArrowRight, Leaf, Globe } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function BuyerDashboard() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalCredits: 0,
        carbonOffset: 0,
        projectsSupported: 0,
        activeOrders: 0
    });
    const [recentTransactions, setRecentTransactions] = useState<any[]>([]);

    useEffect(() => {
        if (user?.id) {
            fetchDashboardData();
        }
    }, [user?.id]);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            // Fetch Transactions
            const txnsQ = query(
                collection(db, 'transactions'),
                where('buyerId', '==', user?.id),
                orderBy('createdAt', 'desc')
            );
            const txnsSnap = await getDocs(txnsQ);
            const transactions = txnsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Calculate Stats
            let totalCredits = 0;
            const uniqueSellers = new Set();

            transactions.forEach((t: any) => {
                totalCredits += t.quantity || 0;
                if (t.sellerId) uniqueSellers.add(t.sellerId);
            });

            setStats({
                totalCredits,
                carbonOffset: totalCredits, // Assuming 1 credit = 1 tonne
                projectsSupported: uniqueSellers.size,
                activeOrders: transactions.length // Total orders for now
            });

            setRecentTransactions(transactions.slice(0, 5));

        } catch (error) {
            console.error("Error fetching buyer dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardLayout role="buyer">
            <div className="p-6 lg:p-8 space-y-8">
                {/* Header */}
                <div className="animate-fade-in flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-display font-bold text-foreground">Buyer Dashboard 🌍</h1>
                        <p className="text-muted-foreground mt-1">Track your carbon offsets and purchase new credits</p>
                    </div>

                    <Link to="/buyer/marketplace" className="btn-primary gap-2">
                        <ShoppingBag className="w-5 h-5" />
                        Buy Credits
                        <ArrowRight className="w-5 h-5" />
                    </Link>
                </div>

                {/* Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="stat-card animate-fade-in" style={{ animationDelay: '0.1s' }}>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                                <Leaf className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <div className="stat-value">{loading ? '-' : stats.totalCredits}</div>
                                <div className="stat-label">Total Credits</div>
                            </div>
                        </div>
                    </div>

                    <div className="stat-card animate-fade-in" style={{ animationDelay: '0.2s' }}>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                                <TrendingUp className="w-6 h-6 text-accent" />
                            </div>
                            <div>
                                <div className="stat-value">{loading ? '-' : `${stats.carbonOffset} t`}</div>
                                <div className="stat-label">Carbon Offset</div>
                            </div>
                        </div>
                    </div>

                    <div className="stat-card animate-fade-in" style={{ animationDelay: '0.3s' }}>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-info/10 flex items-center justify-center">
                                <Globe className="w-6 h-6 text-info" />
                            </div>
                            <div>
                                <div className="stat-value">{loading ? '-' : stats.projectsSupported}</div>
                                <div className="stat-label">Projects Supported</div>
                            </div>
                        </div>
                    </div>

                    <div className="stat-card animate-fade-in" style={{ animationDelay: '0.4s' }}>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl gradient-buyer flex items-center justify-center">
                                <Package className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <div className="stat-value">{loading ? '-' : stats.activeOrders}</div>
                                <div className="stat-label">Total Orders</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Quick Actions */}
                    <div className="lg:col-span-1 space-y-6">
                        <h3 className="text-xl font-bold font-display text-foreground">Quick Actions</h3>
                        <div className="grid grid-cols-1 gap-4">
                            <Link to="/buyer/marketplace" className="block">
                                <div className="action-card group h-full animate-fade-in" style={{ animationDelay: '0.5s' }}>
                                    <div className="w-12 h-12 rounded-xl gradient-buyer flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <ShoppingBag className="w-6 h-6 text-white" />
                                    </div>
                                    <h3 className="text-lg font-bold text-foreground mb-1">Browse Marketplace</h3>
                                    <p className="text-muted-foreground text-sm mb-3">
                                        Discover and fund verified carbon projects.
                                    </p>
                                    <div className="flex items-center gap-2 text-primary font-medium text-sm">
                                        View Projects
                                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </div>
                            </Link>

                            <Link to="/buyer/purchases" className="block">
                                <div className="action-card group h-full animate-fade-in" style={{ animationDelay: '0.6s' }}>
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <Package className="w-6 h-6 text-white" />
                                    </div>
                                    <h3 className="text-lg font-bold text-foreground mb-1">My Purchases</h3>
                                    <p className="text-muted-foreground text-sm mb-3">
                                        View history and download certificates.
                                    </p>
                                    <div className="flex items-center gap-2 text-primary font-medium text-sm">
                                        View History
                                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </div>
                            </Link>
                        </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="lg:col-span-2">
                        <h3 className="text-xl font-bold font-display text-foreground mb-4">Recent Activity</h3>
                        {loading ? (
                            <div className="space-y-4">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="h-20 bg-muted/20 animate-pulse rounded-xl" />
                                ))}
                            </div>
                        ) : recentTransactions.length > 0 ? (
                            <div className="space-y-4">
                                {recentTransactions.map((txn, i) => (
                                    <div key={txn.id} className="card-elevated p-4 flex items-center justify-between animate-fade-in" style={{ animationDelay: `${0.1 * i}s` }}>
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                                                <Leaf className="w-5 h-5 text-green-600" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-foreground">Purchased {txn.quantity} Credits</h4>
                                                <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                    <span>{txn.sellerName}</span>
                                                    <span>•</span>
                                                    <span>{txn.createdAt?.toDate().toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-foreground">₹{txn.totalAmount?.toLocaleString()}</div>
                                            <div className="text-xs text-emerald-600 font-medium">Completed</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="card-elevated p-8 text-center text-muted-foreground">
                                No recent purchases found.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
