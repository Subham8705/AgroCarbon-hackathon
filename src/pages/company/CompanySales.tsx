import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, Timestamp, doc, getDoc } from 'firebase/firestore';
import { ArrowUpRight, Calendar, ChevronDown, ChevronUp, DollarSign, Loader2, PieChart, Users, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface Transaction {
    id: string;
    buyerName: string;
    quantity: number;
    totalAmount: number;
    createdAt: any;
    creditIds: string[];
    pricePerUnit: number;
    razorpayPaymentId?: string;
}

interface PlotBreakdown {
    plotId: string;
    credits: number;
}

interface PayoutDetail {
    farmerId: string;
    farmerName: string;
    creditsSold: number;
    plotIds: string[];
    plots: PlotBreakdown[];
    // Computed values for display will be derived from pricePerUnit
}

interface SaleBreakdown {
    transaction: Transaction;
    payouts: PayoutDetail[];
    companyShare: number; // 20%
    platformFee: number; // 1%
}

interface PayoutRecord {
    transactionId: string;
    farmerId: string;
    plotId: string;
    amount: number;
    paidAt: any;
}

export default function CompanySales() {
    const { user } = useAuth();
    const [sales, setSales] = useState<SaleBreakdown[]>([]);
    const [payoutRecords, setPayoutRecords] = useState<PayoutRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedSale, setExpandedSale] = useState<string | null>(null);
    const [processingPayout, setProcessingPayout] = useState<string | null>(null); // "farmerId"

    useEffect(() => {
        if (user?.id) {
            fetchSales();
            fetchPayoutRecords();
        }
    }, [user?.id]);

    const fetchPayoutRecords = async () => {
        try {
            const q = query(collection(db, 'payout_records'), where('companyId', '==', user?.id));
            const snap = await getDocs(q);
            const data = snap.docs.map(d => d.data()) as PayoutRecord[];
            setPayoutRecords(data);
        } catch (e) {
            console.error("Error fetching payout records", e);
        }
    };

    const fetchSales = async () => {
        setLoading(true);
        try {
            // 1. Fetch Transactions
            const txQ = query(collection(db, 'transactions'), where('sellerId', '==', user?.id), where('type', '==', 'credit_purchase'));
            const txSnap = await getDocs(txQ);
            const transactions = txSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Transaction[];

            // Sort by date desc
            transactions.sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime());

            const breakdowns: SaleBreakdown[] = [];

            for (const tx of transactions) {
                if (!tx.creditIds || tx.creditIds.length === 0) continue;

                // 2. Fetch Credits involved in this TX
                const joinId = tx.razorpayPaymentId || tx.id;
                const creditsQ = query(collection(db, 'issued_credits'), where('transactionId', '==', joinId));
                const creditsSnap = await getDocs(creditsQ);
                const credits = creditsSnap.docs.map(d => d.data());

                // 3. Group by Plot/Farmer
                const batchCache: Record<string, any> = {};
                // Key by farmerId instead of plotId
                const payouts: Record<string, PayoutDetail> = {};

                for (const credit of credits) {
                    const batchId = credit.batchId;
                    const plotId = credit.plotId;

                    if (!batchCache[batchId]) {
                        // batchId in issued_credits is the Firestore Doc ID of the verification_request
                        try {
                            const vrRef = doc(db, 'verification_requests', batchId);
                            const vrSnap = await getDoc(vrRef);
                            if (vrSnap.exists()) {
                                batchCache[batchId] = vrSnap.data();
                            } else {
                                console.log('Verification Request not found for ID:', batchId);
                            }
                        } catch (e) {
                            console.error('Error fetching batch:', e);
                        }
                    }

                    const batchData = batchCache[batchId];
                    let farmerName = "Unknown Farmer";
                    let farmerId = "unknown";

                    // Prioritize direct farmer info from credit if available
                    if (credit.farmerId) {
                        farmerId = credit.farmerId;
                        farmerName = credit.farmerName || farmerName;
                    } else {
                        // Fallback to Batch Data lookup
                        const plotsList = batchData?.plotsData || batchData?.plotList;
                        if (plotsList) {
                            const farmer = plotsList.find((p: any) => p.farmerId === plotId || p.plotId === plotId);
                            if (farmer) {
                                farmerName = farmer.farmerName;
                                farmerId = farmer.farmerId;
                            }
                        }

                        // Fallback: If plotId is "farmer_123", try to parse it
                        if (farmerName === "Unknown Farmer" && plotId.startsWith('farmer_')) {
                            const extractedId = plotId.replace('farmer_', '');
                            if (extractedId !== farmerId && farmerId === 'unknown') {
                                farmerId = extractedId;
                            }
                            farmerName = `Farmer (${farmerId})`;
                        }
                    }

                    // Ensure unique ID for unknown farmers to prevent grouping logic errors if multiple unknowns exist
                    const groupingKey = farmerId === 'unknown' ? `unknown_${plotId}` : farmerId;

                    if (!payouts[groupingKey]) {
                        payouts[groupingKey] = {
                            farmerId: farmerId,
                            farmerName: farmerName,
                            creditsSold: 0,
                            plotIds: [],
                            plots: []
                        };
                    }

                    payouts[groupingKey].creditsSold += 1;
                    if (!payouts[groupingKey].plotIds.includes(plotId)) {
                        payouts[groupingKey].plotIds.push(plotId);
                        payouts[groupingKey].plots.push({ plotId, credits: 1 });
                    } else {
                        // Increment credits for existing plot in list
                        const pIndex = payouts[groupingKey].plots.findIndex(p => p.plotId === plotId);
                        if (pIndex > -1) {
                            payouts[groupingKey].plots[pIndex].credits += 1;
                        }
                    }
                }

                breakdowns.push({
                    transaction: tx,
                    payouts: Object.values(payouts),
                    companyShare: tx.totalAmount * 0.20,
                    platformFee: tx.totalAmount * 0.01
                });
            }

            setSales(breakdowns);

        } catch (error) {
            console.error("Error fetching sales:", error);
            toast.error("Failed to load sales data");
        } finally {
            setLoading(false);
        }
    };

    const toggleExpand = (id: string) => {
        setExpandedSale(expandedSale === id ? null : id);
    };

    const loadRazorpay = () => {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    };

    const handlePayFarmer = async (transaction: Transaction, payout: PayoutDetail, totalFarmerShare: number) => {
        setProcessingPayout(payout.farmerId);

        const res = await loadRazorpay();
        if (!res) {
            toast.error('Razorpay SDK failed to load');
            setProcessingPayout(null);
            return;
        }

        const RAZORPAY_KEY = "rzp_test_S9MkFiLaZYEigi";
        const totalAmountNum = Math.floor(totalFarmerShare); // Use integer for consistent checks, careful with decimals

        const options = {
            key: RAZORPAY_KEY,
            amount: totalAmountNum * 100, // Paise
            currency: "INR",
            name: "AgroCarbon Payouts",
            description: `Payout to ${payout.farmerName} for ${payout.creditsSold} credits`,
            image: "https://cdn-icons-png.flaticon.com/512/2979/2979644.png",
            handler: async function (response: any) {
                try {
                    // Record Payouts - One record per PLOT for granular tracking
                    const pricePerCredit = transaction.pricePerUnit * 0.79;

                    for (const plot of payout.plots) {
                        const plotAmount = plot.credits * pricePerCredit;

                        await addDoc(collection(db, 'payout_records'), {
                            transactionId: transaction.id,
                            razorpayPaymentId: transaction.razorpayPaymentId,
                            companyId: user?.id,
                            farmerId: payout.farmerId,
                            farmerName: payout.farmerName,
                            plotId: plot.plotId,
                            creditsPaid: plot.credits,
                            amount: plotAmount,
                            payoutTxnId: response.razorpay_payment_id,
                            paidAt: Timestamp.now(),
                            type: 'farmer_payout'
                        });
                    }

                    // Send Notification to Farmer
                    await addDoc(collection(db, 'notifications'), {
                        userId: payout.farmerId,
                        title: "Payout Received",
                        message: `You have received a payment of ₹${totalFarmerShare.toLocaleString()} for ${payout.creditsSold} credits from ${user?.name}.`,
                        type: 'payout',
                        read: false,
                        createdAt: Timestamp.now(),
                        amount: totalFarmerShare,
                        transactionId: transaction.id
                    });

                    toast.success(`Paid ₹${totalFarmerShare.toLocaleString()} to ${payout.farmerName}`);
                    fetchPayoutRecords(); // Refresh status
                } catch (error) {
                    console.error("Payout record failed", error);
                    toast.error("Payment successful but recording failed");
                } finally {
                    setProcessingPayout(null);
                }
            },
            prefill: {
                name: user?.name,
                email: user?.email,
                contact: user?.phone
            },
            theme: {
                color: "#10b981" // Green for Company Payout
            },
            modal: {
                ondismiss: function () {
                    setProcessingPayout(null);
                }
            }
        };

        const paymentObject = new (window as any).Razorpay(options);
        paymentObject.open();
    };


    const handlePayAllFarmers = async (transaction: Transaction, payouts: PayoutDetail[]) => {
        // Filter for unpaid farmers only
        const unpaidPayouts = payouts.filter(p => !isPaid(transaction.id, p.plotIds));

        if (unpaidPayouts.length === 0) {
            toast.info("All farmers in this transaction have already been paid.");
            return;
        }

        const totalToPay = unpaidPayouts.reduce((acc, p) => {
            return acc + (p.creditsSold * transaction.pricePerUnit * 0.79);
        }, 0);

        setProcessingPayout('ALL');

        const res = await loadRazorpay();
        if (!res) {
            toast.error('Razorpay SDK failed to load');
            setProcessingPayout(null);
            return;
        }

        const RAZORPAY_KEY = "rzp_test_S9MkFiLaZYEigi";
        const totalAmountNum = Math.floor(totalToPay);

        const options = {
            key: RAZORPAY_KEY,
            amount: totalAmountNum * 100, // Paise
            currency: "INR",
            name: "AgroCarbon Consolidated Payout",
            description: `Bulk Payout for ${unpaidPayouts.length} farmers`,
            image: "https://cdn-icons-png.flaticon.com/512/2979/2979644.png",
            handler: async function (response: any) {
                try {
                    const pricePerCredit = transaction.pricePerUnit * 0.79;
                    const writes = [];

                    for (const payout of unpaidPayouts) {
                        let farmerTotalPayout = 0;
                        for (const plot of payout.plots) {
                            const plotAmount = plot.credits * pricePerCredit;
                            farmerTotalPayout += plotAmount;
                            writes.push(
                                addDoc(collection(db, 'payout_records'), {
                                    transactionId: transaction.id,
                                    razorpayPaymentId: transaction.razorpayPaymentId,
                                    companyId: user?.id,
                                    farmerId: payout.farmerId,
                                    farmerName: payout.farmerName,
                                    plotId: plot.plotId,
                                    creditsPaid: plot.credits,
                                    amount: plotAmount,
                                    payoutTxnId: response.razorpay_payment_id,
                                    paidAt: Timestamp.now(),
                                    type: 'farmer_payout_bulk'
                                })
                            );
                        }

                        // Notification for each farmer in the bulk payment
                        writes.push(
                            addDoc(collection(db, 'notifications'), {
                                userId: payout.farmerId,
                                title: "Payout Received",
                                message: `You have received a payment of ₹${farmerTotalPayout.toLocaleString()} for ${payout.creditsSold} credits from ${user?.name}.`,
                                type: 'payout',
                                read: false,
                                createdAt: Timestamp.now(),
                                amount: farmerTotalPayout,
                                transactionId: transaction.id
                            })
                        );
                    }

                    await Promise.all(writes);

                    toast.success(`Successfully paid ₹${totalToPay.toLocaleString()} to ${unpaidPayouts.length} farmers.`);
                    fetchPayoutRecords();
                } catch (error) {
                    console.error("Bulk payout record failed", error);
                    toast.error("Payment successful but recording failed");
                } finally {
                    setProcessingPayout(null);
                }
            },
            prefill: {
                name: user?.name,
                email: user?.email,
                contact: user?.phone
            },
            theme: {
                color: "#10b981"
            },
            modal: {
                ondismiss: function () {
                    setProcessingPayout(null);
                }
            }
        };

        const paymentObject = new (window as any).Razorpay(options);
        paymentObject.open();
    };

    // Check if ALL plots for this farmer are paid
    const isPaid = (txId: string, plotIds: string[]) => {
        // If every plotId has a corresponding record in payoutRecords (matching txId)
        return plotIds.every(pid =>
            payoutRecords.some(r => r.transactionId === txId && r.plotId === pid)
        );
    };

    const totalRevenue = sales.reduce((acc, curr) => acc + curr.transaction.totalAmount, 0);
    const totalFarmerPayout = sales.reduce((acc, curr) => {
        const txPayout = curr.payouts.reduce((p, c) => p + (c.creditsSold * curr.transaction.pricePerUnit * 0.79), 0);
        return acc + txPayout;
    }, 0);

    return (
        <DashboardLayout role="company">
            <div className="p-6 lg:p-8 space-y-8">
                <div className="flex justify-between items-center animate-fade-in">
                    <div>
                        <h1 className="text-3xl font-display font-bold text-foreground">Sales & Revenue 💰</h1>
                        <p className="text-muted-foreground mt-1">Track credit sales and manage farmer payouts.</p>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
                    <div className="card-elevated p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <DollarSign className="w-24 h-24 text-primary" />
                        </div>
                        <div className="text-sm font-medium text-muted-foreground mb-2">Total Sales Revenue</div>
                        <div className="text-3xl font-bold text-foreground">₹{totalRevenue.toLocaleString()}</div>
                        <div className="mt-2 text-xs text-green-600 flex items-center gap-1">
                            <ArrowUpRight className="w-3 h-3" /> From {sales.length} transactions
                        </div>
                    </div>

                    <div className="card-elevated p-6 relative overflow-hidden bg-emerald-50/50 border-emerald-100">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Users className="w-24 h-24 text-emerald-600" />
                        </div>
                        <div className="text-sm font-medium text-emerald-800 mb-2">Total Farmer Payouts (79%)</div>
                        <div className="text-3xl font-bold text-emerald-700">₹{totalFarmerPayout.toLocaleString()}</div>
                        <div className="mt-2 text-xs text-emerald-600">
                            Distributed to project farmers
                        </div>
                    </div>

                    <div className="card-elevated p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <PieChart className="w-24 h-24 text-blue-600" />
                        </div>
                        <div className="text-sm font-medium text-muted-foreground mb-2">Net Revenue (20%)</div>
                        <div className="text-3xl font-bold text-foreground">₹{(totalRevenue * 0.20).toLocaleString()}</div>
                        <div className="mt-2 text-xs text-muted-foreground">
                            After platform fees (1%)
                        </div>
                    </div>
                </div>

                {/* Sales List */}
                <div className="space-y-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
                    <h2 className="text-xl font-bold text-foreground">Transaction History</h2>

                    {loading ? (
                        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                    ) : sales.length === 0 ? (
                        <div className="text-center py-12 card-elevated">
                            <p className="text-muted-foreground">No sales recorded yet.</p>
                        </div>
                    ) : (
                        sales.map((item) => (
                            <div key={item.transaction.id} className="card-elevated hover:shadow-md transition-all overflow-hidden">
                                <div
                                    className="p-6 flex flex-col md:flex-row items-center justify-between cursor-pointer"
                                    onClick={() => toggleExpand(item.transaction.id)}
                                >
                                    <div className="flex items-center gap-4 w-full md:w-auto">
                                        <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center shrink-0 text-blue-600 font-bold">
                                            {item.transaction.buyerName.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-foreground">{item.transaction.buyerName}</h3>
                                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                                                <Calendar className="w-3 h-3" />
                                                {item.transaction.createdAt?.toDate().toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end mt-4 md:mt-0">
                                        <div className="text-right">
                                            <div className="text-lg font-bold">₹{item.transaction.totalAmount.toLocaleString()}</div>
                                            <div className="text-xs text-muted-foreground">{item.transaction.quantity} Credits @ ₹{item.transaction.pricePerUnit}</div>
                                        </div>
                                        {expandedSale === item.transaction.id ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                                    </div>
                                </div>

                                {expandedSale === item.transaction.id && (
                                    <div className="bg-muted/30 border-t border-border p-6 animate-fade-in">
                                        <h4 className="text-sm font-bold text-muted-foreground mb-4 uppercase tracking-wider">Farmer Payout Breakdown</h4>

                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b border-border">
                                                        <th className="text-left py-2 font-medium text-muted-foreground">Farmer Name</th>
                                                        {/* <th className="text-left py-2 font-medium text-muted-foreground">Plot ID</th> */}
                                                        <th className="text-center py-2 font-medium text-muted-foreground">Total Plots</th>
                                                        <th className="text-center py-2 font-medium text-muted-foreground">Credits</th>
                                                        <th className="text-right py-2 font-medium text-muted-foreground">Total Value</th>
                                                        <th className="text-right py-2 font-medium text-blue-600">Company (20%)</th>
                                                        <th className="text-right py-2 font-medium text-amber-600">Platform (1%)</th>
                                                        <th className="text-right py-2 font-medium text-emerald-600">Farmer (79%)</th>
                                                        <th className="text-center py-2 font-medium text-muted-foreground">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {item.payouts.map((payout) => {
                                                        const totalVal = payout.creditsSold * item.transaction.pricePerUnit;
                                                        const companyShare = totalVal * 0.20;
                                                        const platformFee = totalVal * 0.01;
                                                        const farmerShare = totalVal * 0.79;
                                                        const paid = isPaid(item.transaction.id, payout.plotIds);

                                                        return (
                                                            <tr key={payout.farmerId} className="border-b border-border/50">
                                                                <td className="py-3 font-medium">
                                                                    {payout.farmerName}
                                                                    <div className="text-xs text-muted-foreground font-mono mt-0.5">ID: {payout.farmerId}</div>
                                                                </td>
                                                                {/* <td className="py-3 text-muted-foreground font-mono text-xs">{payout.plotId}</td> */}
                                                                <td className="py-3 text-center text-muted-foreground">
                                                                    {payout.plotIds.length} Plot{payout.plotIds.length !== 1 ? 's' : ''}
                                                                </td>
                                                                <td className="py-3 text-center">{payout.creditsSold}</td>
                                                                <td className="py-3 text-right">₹{totalVal.toLocaleString()}</td>
                                                                <td className="py-3 text-right text-blue-600">₹{companyShare.toLocaleString()}</td>
                                                                <td className="py-3 text-right text-amber-600">₹{platformFee.toLocaleString()}</td>
                                                                <td className="py-3 text-right font-bold text-emerald-700">₹{farmerShare.toLocaleString()}</td>
                                                                <td className="py-3 text-center">
                                                                    {paid ? (
                                                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded-full">
                                                                            Paid
                                                                        </span>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => handlePayFarmer(item.transaction, payout, farmerShare)}
                                                                            disabled={!!processingPayout}
                                                                            className="btn-primary text-xs py-1 px-3 h-auto bg-emerald-600 hover:bg-emerald-700 gap-1"
                                                                        >
                                                                            {processingPayout === payout.farmerId ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wallet className="w-3 h-3" />}
                                                                            Pay
                                                                        </button>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Pay All Button */}
                                        <div className="mt-6 flex justify-end">
                                            {(() => {
                                                const unpaidAmount = item.payouts
                                                    .filter(p => !isPaid(item.transaction.id, p.plotIds))
                                                    .reduce((acc, p) => acc + (p.creditsSold * item.transaction.pricePerUnit * 0.79), 0);

                                                if (unpaidAmount <= 0) return null;

                                                return (
                                                    <button
                                                        onClick={() => handlePayAllFarmers(item.transaction, item.payouts)}
                                                        disabled={!!processingPayout}
                                                        className="btn-primary bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 shadow-lg shadow-emerald-200"
                                                    >
                                                        {processingPayout === 'ALL' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wallet className="w-4 h-4 mr-2" />}
                                                        Pay All Farmers (₹{unpaidAmount.toLocaleString()})
                                                    </button>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
