import DashboardLayout from '@/components/layout/DashboardLayout';
import { Search, Building2, MapPin, ArrowRight, Loader2, Leaf, ShoppingBag, X, CheckCircle, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ProjectCompany {
    id: string;
    companyName: string;
    name: string;
    phone?: string;
    email?: string;
    minAcres?: number;
    capacity?: number;
    availableCredits?: number; // Computed field
    totalIssued?: number; // Computed field
}

export default function Marketplace() {
    const { user } = useAuth();
    const [companies, setCompanies] = useState<ProjectCompany[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Payment State
    const [selectedCompany, setSelectedCompany] = useState<ProjectCompany | null>(null);
    const [showBuyModal, setShowBuyModal] = useState(false);
    const [quantity, setQuantity] = useState(1);
    const [processing, setProcessing] = useState(false);
    const [txnSuccess, setTxnSuccess] = useState(false);

    const PRICE_PER_CREDIT = 100; // INR - Updated as per user request (5 credits = 500)

    useEffect(() => {
        fetchMarketData();
    }, []);

    const fetchMarketData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Companies
            const companiesQ = query(collection(db, 'users'), where('role', '==', 'company'));
            const companiesSnap = await getDocs(companiesQ);
            const companiesData = companiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ProjectCompany[];

            // 2. Fetch Issued Credits (Supply)
            // We look at verification_requests that are 'issued'
            const issuedQ = query(collection(db, 'verification_requests'), where('status', '==', 'issued'));
            const issuedSnap = await getDocs(issuedQ);
            const issuedMap: Record<string, number> = {};

            issuedSnap.docs.forEach(doc => {
                const d = doc.data();
                const cid = d.companyId;
                const amount = d.finalCreditsIssued || d.totalCredits || 0;
                issuedMap[cid] = (issuedMap[cid] || 0) + amount;
            });

            // 3. Fetch Sold Credits (Demand)
            const salesQ = query(collection(db, 'transactions'), where('type', '==', 'credit_purchase'));
            const salesSnap = await getDocs(salesQ);
            const salesMap: Record<string, number> = {};

            salesSnap.docs.forEach(doc => {
                const d = doc.data();
                const sellerId = d.sellerId;
                const qty = d.quantity || 0;
                salesMap[sellerId] = (salesMap[sellerId] || 0) + qty;
            });

            // 4. Merge Data
            const enrichedCompanies = companiesData.map(c => {
                const totalIssued = issuedMap[c.id] || 0;
                const totalSold = salesMap[c.id] || 0;
                const available = Math.max(0, totalIssued - totalSold);
                return { ...c, availableCredits: available, totalIssued };
            });

            // Only show companies that have projects (optional refinement, keeping all for now but sorting by availability)
            enrichedCompanies.sort((a, b) => (b.availableCredits || 0) - (a.availableCredits || 0));

            setCompanies(enrichedCompanies);

        } catch (error) {
            console.error("Error fetching market data:", error);
            toast.error("Failed to load marketplace data");
        } finally {
            setLoading(false);
        }
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

    const handleInitiatePurchase = (company: ProjectCompany) => {
        setSelectedCompany(company);
        setQuantity(company.availableCredits || 0); // Force buy ALL available
        setTxnSuccess(false);
        setShowBuyModal(true);
    };

    const handlePayment = async () => {
        if (!selectedCompany) return;

        // Final Validation
        if (quantity > (selectedCompany.availableCredits || 0)) {
            toast.error(`Only ${selectedCompany.availableCredits} credits available.`);
            return;
        }

        setProcessing(true);

        const res = await loadRazorpay();
        if (!res) {
            toast.error('Razorpay SDK failed to load');
            setProcessing(false);
            return;
        }

        const totalAmount = quantity * PRICE_PER_CREDIT;
        const RAZORPAY_KEY = "rzp_test_S9MkFiLaZYEigi"; // Using same test key

        const options = {
            key: RAZORPAY_KEY,
            amount: totalAmount * 100, // Paise
            currency: "INR",
            name: "TranspoCarbon Marketplace",
            description: `Purchase ${quantity} Carbon Credits from ${selectedCompany.companyName || selectedCompany.name}`,
            image: "https://cdn-icons-png.flaticon.com/512/2979/2979644.png",
            handler: async function (response: any) {
                try {
                    // 1. Allocate Credits (FIFO)
                    const creditsQ = query(
                        collection(db, 'issued_credits'),
                        where('companyId', '==', selectedCompany.id),
                        where('status', '==', 'active')
                    );

                    const snapshot = await getDocs(creditsQ);

                    // We need to sort client-side if we didn't use orderBy in query (to avoid composite index issues)
                    // Assuming they are reasonably ordered or we just take any active ones.
                    const availableDocs = snapshot.docs.slice(0, quantity);

                    if (availableDocs.length < quantity) {
                        toast.error("Not enough credits found during allocation. Transaction cancelled.");
                        setProcessing(false);
                        return;
                    }

                    const soldCreditIds = availableDocs.map(d => d.id);
                    const updatePromises = availableDocs.map(d =>
                        updateDoc(doc(db, 'issued_credits', d.id), {
                            status: 'sold',
                            buyerId: user?.id,
                            soldAt: Timestamp.now(),
                            transactionId: response.razorpay_payment_id
                        })
                    );

                    await Promise.all(updatePromises);

                    // 2. Record Transaction
                    await addDoc(collection(db, 'transactions'), {
                        buyerId: user?.id,
                        buyerName: user?.name,
                        sellerId: selectedCompany.id,
                        sellerName: selectedCompany.companyName || selectedCompany.name,
                        quantity: quantity,
                        creditIds: soldCreditIds, // Store linked credit IDs
                        pricePerUnit: PRICE_PER_CREDIT,
                        totalAmount: totalAmount,
                        currency: 'INR',
                        razorpayPaymentId: response.razorpay_payment_id,
                        status: 'completed',
                        createdAt: Timestamp.now(),
                        type: 'credit_purchase'
                    });

                    setTxnSuccess(true);
                    toast.success("Purchase successful! Credits have been allocated.");
                    fetchMarketData(); // Refresh inventory
                } catch (error) {
                    console.error("Txn record failed", error);
                    toast.error("Payment successful but recording failed");
                } finally {
                    setProcessing(false);
                }
            },
            prefill: {
                name: user?.name,
                email: user?.email,
                contact: user?.phone
            },
            theme: {
                color: "#0d9488" // Teal for Buyer
            },
            modal: {
                ondismiss: function () {
                    setProcessing(false);
                }
            }
        };

        const paymentObject = new (window as any).Razorpay(options);
        paymentObject.open();
    };

    const filteredCompanies = companies.filter(c =>
        (c.companyName || c.name).toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <DashboardLayout role="buyer">
            <div className="p-6 lg:p-8 space-y-8">
                <div className="animate-fade-in">
                    <h1 className="text-3xl font-display font-bold text-foreground">Carbon Marketplace 🛒</h1>
                    <p className="text-muted-foreground mt-1">Browse verified project developers and purchase high-quality carbon removals.</p>
                </div>

                {/* Search */}
                <div className="relative max-w-md animate-fade-in" style={{ animationDelay: '0.1s' }}>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                        type="text"
                        className="input-field pl-10"
                        placeholder="Search projects or companies..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Grid */}
                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
                        {filteredCompanies.map((company) => {
                            const isSoldOut = (company.availableCredits || 0) <= 0;
                            const isComingSoon = (company.totalIssued || 0) === 0;

                            return (
                                <div key={company.id} className={`card-elevated group hover:shadow-lg transition-all duration-300 flex flex-col h-full ${isSoldOut ? 'opacity-75 grayscale-[0.5]' : ''}`}>
                                    <div className="p-6 flex-1">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="w-12 h-12 rounded-xl gradient-company flex items-center justify-center text-white font-bold text-xl">
                                                {company.companyName ? company.companyName.charAt(0) : 'C'}
                                            </div>
                                            {isSoldOut ? (
                                                <span className={`text-xs font-bold px-2 py-1 rounded ${isComingSoon ? 'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground'}`}>
                                                    {isComingSoon ? 'COMING SOON' : 'SOLD OUT'}
                                                </span>
                                            ) : (
                                                <Leaf className="w-5 h-5 text-green-600" />
                                            )}
                                        </div>

                                        <h3 className="text-xl font-bold text-foreground mb-2">
                                            {company.companyName || company.name}
                                        </h3>

                                        <div className="space-y-3 mb-6">
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Building2 className="w-4 h-4" />
                                                <span>Project Developer</span>
                                            </div>
                                            {company.minAcres && (
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <MapPin className="w-4 h-4" />
                                                    <span>{company.minAcres} Acres Project Area</span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
                                                <CheckCircle className="w-4 h-4" />
                                                <span>Available: {company.availableCredits?.toFixed(1) || 0} tCO₂</span>
                                            </div>
                                        </div>

                                        <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground mb-4">
                                            Verified carbon credits from regenerative agriculture practices like No-till and Agroforestry.
                                        </div>
                                    </div>

                                    <div className="p-4 border-t border-border mt-auto">
                                        <button
                                            onClick={() => handleInitiatePurchase(company)}
                                            disabled={isSoldOut}
                                            className="w-full btn-primary gap-2 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <ShoppingBag className="w-4 h-4" />
                                            {isSoldOut ? (company.totalIssued === 0 ? 'Coming Soon' : 'Sold Out') : 'Buy Credits'}
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Purchase Modal */}
                {showBuyModal && selectedCompany && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4">
                        <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-border">
                            {txnSuccess ? (
                                <div className="p-8 text-center space-y-6">
                                    <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 mx-auto flex items-center justify-center">
                                        <CheckCircle className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-foreground">Purchase Successful!</h3>
                                        <p className="text-muted-foreground mt-2">
                                            You have successfully purchased {quantity} credits from {selectedCompany.companyName || selectedCompany.name}.
                                        </p>
                                    </div>
                                    <button onClick={() => setShowBuyModal(false)} className="btn-primary w-full">
                                        Close
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                                        <h3 className="text-xl font-bold text-foreground">Buy Carbon Credits</h3>
                                        <button onClick={() => setShowBuyModal(false)} className="text-muted-foreground hover:text-foreground">
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>

                                    <div className="p-6 space-y-6">
                                        <div className="p-3 bg-blue-50 text-blue-800 rounded-lg text-sm flex gap-2">
                                            <AlertCircle className="w-5 h-5 shrink-0" />
                                            <div>
                                                <strong>Purchase All Available Credits</strong>
                                                <div className="text-xs opacity-80 mt-1">You are purchasing the entire available stock from this project.</div>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-muted-foreground">Quantity (Tonnes)</span>
                                            <span className="font-bold text-lg">{quantity} tCO₂</span>
                                        </div>

                                        <div className="flex justify-between items-center py-4 border-t border-dashed border-border">
                                            <span className="text-muted-foreground">Price per Credit</span>
                                            <span className="font-mono">₹{PRICE_PER_CREDIT}</span>
                                        </div>

                                        <div className="flex justify-between items-center text-lg font-bold">
                                            <span>Total Amount</span>
                                            <span className="text-primary">₹{(quantity * PRICE_PER_CREDIT).toLocaleString()}</span>
                                        </div>

                                        <button
                                            onClick={handlePayment}
                                            disabled={processing || (selectedCompany.availableCredits || 0) < 1}
                                            className="btn-primary w-full bg-gradient-to-r from-teal-600 to-teal-700"
                                        >
                                            {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Purchase'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

            </div>
        </DashboardLayout>
    );
}
