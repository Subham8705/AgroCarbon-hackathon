import DashboardLayout from '@/components/layout/DashboardLayout';
import { Package, Calendar, Download, ExternalLink, Loader2, Search, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';

export default function BuyerPurchases() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal State
    const [selectedTxn, setSelectedTxn] = useState<any | null>(null);
    const [viewCreditsLoading, setViewCreditsLoading] = useState(false);
    const [txnCredits, setTxnCredits] = useState<any[]>([]);

    useEffect(() => {
        if (user?.id) {
            fetchPurchases();
        }
    }, [user?.id]);

    const fetchPurchases = async () => {
        setLoading(true);
        try {
            try {
                const q = query(
                    collection(db, 'transactions'),
                    where('buyerId', '==', user?.id)
                );
                const snapshot = await getDocs(q);
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // Client-side sort to avoid composite index requirement
                data.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

                setTransactions(data);
            } catch (error) {
                console.error("Error fetching purchases:", error);
            } finally {
                setLoading(false);
            }
        } catch (error) {
            console.error("Error in fetchPurchases:", error);
        }
    };

    const handleViewCredits = async (txn: any) => {
        setSelectedTxn(txn);
        setViewCreditsLoading(true);
        setTxnCredits([]);

        try {
            // If creditIds are stored, fetch them
            if (txn.creditIds && txn.creditIds.length > 0) {
                const creditPromises = txn.creditIds.map((cid: string) =>
                    getDoc(doc(db, 'issued_credits', cid))
                );

                const creditSnaps = await Promise.all(creditPromises);
                const credits = creditSnaps.map(snap => ({ id: snap.id, ...snap.data() }));
                setTxnCredits(credits);
            }
        } catch (error) {
            console.error("Error fetching credit details", error);
        } finally {
            setViewCreditsLoading(false);
        }
    };

    const filteredTransactions = transactions.filter(t =>
        (t.sellerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <DashboardLayout role="buyer">
            <div className="p-6 lg:p-8 space-y-8">
                <div className="animate-fade-in flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-display font-bold text-foreground">My Purchases 📦</h1>
                        <p className="text-muted-foreground mt-1">History of your carbon credit purchases and retirements.</p>
                    </div>

                    <div className="relative max-w-xs w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            className="input-field pl-9 py-2 text-sm"
                            placeholder="Search purchases..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="card-elevated overflow-hidden animate-fade-in" style={{ animationDelay: '0.1s' }}>
                    {loading ? (
                        <div className="p-12 flex justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : filteredTransactions.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
                                    <tr>
                                        <th className="px-6 py-4">Transaction ID</th>
                                        <th className="px-6 py-4">Date</th>
                                        <th className="px-6 py-4">Seller/Project</th>
                                        <th className="px-6 py-4 text-center">Quantity</th>
                                        <th className="px-6 py-4 text-right">Amount</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {filteredTransactions.map((txn) => (
                                        <tr key={txn.id} className="hover:bg-muted/20 transition-colors">
                                            <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                                                {txn.id.slice(0, 8)}...
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="w-4 h-4 text-muted-foreground" />
                                                    {txn.createdAt?.toDate().toLocaleDateString()}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-medium text-foreground">
                                                {txn.sellerName || 'Unknown Project'}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                    {txn.quantity} tCO₂
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-medium">
                                                ₹{txn.totalAmount?.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                                    Success
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleViewCredits(txn)}
                                                    className="btn-outline text-xs h-8"
                                                >
                                                    View Credits
                                                </button>
                                                <button className="text-primary hover:text-primary/80 text-xs font-medium flex items-center gap-1">
                                                    <Download className="w-3 h-3" />
                                                    Cert
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="p-16 text-center text-muted-foreground">
                            <Package className="w-12 h-12 mx-auto mb-4 opacity-30" />
                            <h3 className="text-lg font-medium text-foreground">No purchases found</h3>
                            <p className="mt-2 max-w-sm mx-auto">
                                You haven't purchased any carbon credits yet.
                                Visit the marketplace to start offsetting your carbon footprint.
                            </p>
                        </div>
                    )}
                </div>

                {/* Credits Detail Modal */}
                {selectedTxn && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-card w-full max-w-2xl rounded-2xl shadow-xl border border-border flex flex-col max-h-[80vh]">
                            <div className="p-6 border-b border-border flex justify-between items-center">
                                <div>
                                    <h3 className="text-xl font-bold font-display">Purchased Credits</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Transaction: {selectedTxn.id}
                                    </p>
                                </div>
                                <button onClick={() => setSelectedTxn(null)} className="text-muted-foreground hover:text-foreground">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-0 overflow-y-auto flex-1">
                                {viewCreditsLoading ? (
                                    <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                                ) : (
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-muted/30 text-muted-foreground font-medium sticky top-0">
                                            <tr>
                                                <th className="px-6 py-3">Serial Number</th>
                                                <th className="px-6 py-3">Batch ID</th>
                                                <th className="px-6 py-3">Vintage</th>
                                                <th className="px-6 py-3">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {txnCredits.map((credit, idx) => (
                                                <tr key={credit.id || idx} className="hover:bg-muted/10">
                                                    <td className="px-6 py-3 font-mono text-xs">{credit.serialNumber || 'N/A'}</td>
                                                    <td className="px-6 py-3">{credit.batchId || '-'}</td>
                                                    <td className="px-6 py-3">{credit.vintage || new Date().getFullYear()}</td>
                                                    <td className="px-6 py-3">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                            Owned by You
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                            {txnCredits.length === 0 && (
                                                <tr>
                                                    <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                                                        No individual credit details found (Legacy transaction).
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            <div className="p-4 border-t border-border bg-muted/10 flex justify-end">
                                <button onClick={() => setSelectedTxn(null)} className="btn-primary">
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
