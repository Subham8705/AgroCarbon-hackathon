import DashboardLayout from '@/components/layout/DashboardLayout';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { Check, X, FileText, Loader2, Leaf, MoreHorizontal, ArrowRight, Eye, Sprout, Tractor } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PlotData {
    plotId: string;
    baseline: {
        practice: string;
    };
    project: {
        practice: string;
    };
}

interface VerificationRequest {
    id: string;
    companyName: string;
    projectName?: string; // Might need to fetch from company or project linkage
    batchMonth: string;
    totalAcres: number;
    status: string;
    verifiedCredits: Record<string, number>;
    submittedToRegistryAt?: any;
    plotsData: PlotData[]; // Added plotsData
}

export default function ProjectApprovals() {
    const [requests, setRequests] = useState<VerificationRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        fetchPendingRequests();
    }, []);

    const fetchPendingRequests = async () => {
        setLoading(true);
        try {
            // Main query for pending approvals
            const q = query(
                collection(db, 'verification_requests'),
                where('status', 'in', ['pending_registry_review'])
            );
            const snapshot = await getDocs(q);
            const reqs: VerificationRequest[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as any;

            // Sort by submission date
            reqs.sort((a, b) => {
                const timeA = a.submittedToRegistryAt?.seconds || 0;
                const timeB = b.submittedToRegistryAt?.seconds || 0;
                return timeB - timeA;
            });

            setRequests(reqs);

            // DEBUG: Log all requests to console to diagnose visibility issues
            const debugQ = query(collection(db, 'verification_requests'));
            const debugSnap = await getDocs(debugQ);
            console.log("DEBUG: All Requests in DB:", debugSnap.docs.map(d => ({ id: d.id, status: d.data().status })));

        } catch (error) {
            console.error("Error fetching requests:", error);
        } finally {
            setLoading(false);
        }
    };

    const calculateTotalCredits = (credits: Record<string, number> = {}) => {
        return Object.values(credits).reduce((sum, val) => sum + val, 0);
    };

    const calculatePractices = (plots: PlotData[]) => {
        const practices: Record<string, number> = {};
        plots.forEach(p => {
            const practice = p.project.practice || 'Unknown';
            practices[practice] = (practices[practice] || 0) + 1;
        });
        return practices;
    };

    const handleApproveAndAllocate = async (request: VerificationRequest) => {
        if (!processingId && window.confirm(`Approve issuance of ${calculateTotalCredits(request.verifiedCredits).toFixed(2)} credits for ${request.companyName}?`)) {
            setProcessingId(request.id);
            try {
                // 1. Update Request Status to 'issued'
                await updateDoc(doc(db, 'verification_requests', request.id), {
                    status: 'issued',
                    issuedAt: new Date(),
                    finalCreditsIssued: calculateTotalCredits(request.verifiedCredits)
                });

                // 2. Mock: Allocate to Company Wallet (In reality, this would initiate a blockchain transaction)
                // For now, we update a 'creditsBalance' field in the company's profile if we had one, 
                // or just rely on the 'issued' status to show it in their dashboard.

                // TODO: Call Smart Contract Mint Function here in future.

                alert('Credits Issued and Allocated successfully!');
                fetchPendingRequests();
                setSelectedRequest(null); // Close modal if open
            } catch (error) {
                console.error("Error issuing credits:", error);
                alert("Failed to issue credits.");
            } finally {
                setProcessingId(null);
            }
        }
    };

    const handleReject = async (requestId: string) => {
        // Implement rejection logic (e.g. send back to verifier)
        const reason = prompt("Enter reason for rejection:");
        if (reason) {
            setProcessingId(requestId);
            try {
                await updateDoc(doc(db, 'verification_requests', requestId), {
                    status: 'rejected_by_registry',
                    rejectionReason: reason
                });
                alert('Request rejected and sent back.');
                fetchPendingRequests();
                setSelectedRequest(null);
            } catch (e) {
                console.error(e);
            } finally {
                setProcessingId(null);
            }
        }
    }

    return (
        <DashboardLayout role="registry">
            <div className="p-6 lg:p-8 space-y-8">
                <div className="animate-fade-in">
                    <h1 className="text-3xl font-display font-bold text-foreground">Project Approvals</h1>
                    <p className="text-muted-foreground mt-1">Review verified drafts and allocate credits</p>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : requests.length === 0 ? (
                    <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border">
                        <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium">No Pending Approvals</h3>
                        <p className="text-muted-foreground">All verified drafts have been processed.</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {requests.map((req) => (
                            <div key={req.id} className="card-elevated p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 animate-fade-in">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold border border-amber-200">
                                            PENDING APPROVAL
                                        </span>
                                        <span className="text-xs text-muted-foreground font-mono">#{req.id.slice(-6)}</span>
                                    </div>
                                    <h3 className="text-xl font-bold text-foreground mb-1">{req.companyName}</h3>
                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                        <span>Batch: {req.batchMonth}</span>
                                        <span>•</span>
                                        <span>{req.totalAcres?.toFixed(2)} Acres</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-8">
                                    <div className="text-right">
                                        <div className="text-sm text-muted-foreground">Verified Output</div>
                                        <div className="text-2xl font-bold text-primary flex items-center justify-end gap-1">
                                            <Leaf className="w-5 h-5" />
                                            {calculateTotalCredits(req.verifiedCredits).toFixed(2)}
                                        </div>
                                        <div className="text-xs text-muted-foreground">tCO₂ Credits</div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setSelectedRequest(req)}
                                            className="p-3 rounded-lg border border-border text-muted-foreground hover:bg-muted/50 transition-colors"
                                            title="View Details"
                                        >
                                            <Eye className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => handleReject(req.id)}
                                            disabled={!!processingId}
                                            className="p-3 rounded-lg border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
                                            title="Reject / Request Changes"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => handleApproveAndAllocate(req)}
                                            disabled={!!processingId}
                                            className="btn-primary gap-2 h-12 px-6"
                                        >
                                            {processingId === req.id ? (
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                            ) : (
                                                <Check className="w-5 h-5" />
                                            )}
                                            Approve & Allocate
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Details Modal */}
                {selectedRequest && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                        <div className="bg-background rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col animate-scale-in">
                            <div className="p-6 border-b border-border flex justify-between items-center bg-muted/20">
                                <div>
                                    <h2 className="text-xl font-display font-bold text-foreground">Audit Details</h2>
                                    <p className="text-sm text-muted-foreground">Review practices and features before issuance</p>
                                </div>
                                <button onClick={() => setSelectedRequest(null)} className="p-2 hover:bg-muted rounded-full">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto space-y-6">
                                {/* Company Summary */}
                                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                                    <div>
                                        <div className="text-sm text-muted-foreground">Beneficiary</div>
                                        <div className="font-bold text-lg">{selectedRequest.companyName}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm text-muted-foreground">Verified Volume</div>
                                        <div className="font-bold text-lg text-primary">{calculateTotalCredits(selectedRequest.verifiedCredits).toFixed(2)} tCO₂</div>
                                    </div>
                                </div>

                                {/* Practices Breakdown e.g. Ploughing, Cover Crops */}
                                <div>
                                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-3">Key Features & Practices</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {Object.entries(calculatePractices(selectedRequest.plotsData || [])).map(([practice, count]) => (
                                            <div key={practice} className="p-4 border border-border rounded-lg flex items-start gap-3">
                                                <div className="p-2 bg-primary/10 rounded-lg">
                                                    {practice.toLowerCase().includes('plough') || practice.toLowerCase().includes('till') ? (
                                                        <Tractor className="w-5 h-5 text-primary" />
                                                    ) : (
                                                        <Sprout className="w-5 h-5 text-primary" />
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-sm capitalize">{practice || 'Standard Practice'}</div>
                                                    <div className="text-xs text-muted-foreground mt-1">
                                                        Applied on {count} plots
                                                    </div>
                                                    {/* Tag logic simulation */}
                                                    <div className="flex gap-1 mt-2 flex-wrap">
                                                        {practice.toLowerCase().includes('cover') && (
                                                            <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium border border-green-200">
                                                                Cover Crop
                                                            </span>
                                                        )}
                                                        {(practice.toLowerCase().includes('no-till') || practice.toLowerCase().includes('zero')) && (
                                                            <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium border border-blue-200">
                                                                No-Till
                                                            </span>
                                                        )}
                                                        {(practice.toLowerCase().includes('organic')) && (
                                                            <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium border border-amber-200">
                                                                Organic
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Plots List Preview (First 5) */}
                                <div>
                                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-2">Plots Sample</h3>
                                    <div className="border border-border rounded-lg overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted/50">
                                                <tr>
                                                    <th className="px-3 py-2 text-left">Plot ID</th>
                                                    <th className="px-3 py-2 text-right">Acres</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(selectedRequest.plotsData || []).slice(0, 5).map(plot => (
                                                    <tr key={plot.plotId} className="border-t border-border">
                                                        <td className="px-3 py-2 font-mono text-xs">{plot.plotId}</td>
                                                        <td className="px-3 py-2 text-right">{(plot.baseline?.practice === plot.project?.practice) ? 'Unchanged' : 'Improved'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {(selectedRequest.plotsData?.length || 0) > 5 && (
                                            <div className="p-2 text-center text-xs text-muted-foreground bg-muted/20">
                                                + {(selectedRequest.plotsData?.length || 0) - 5} more plots
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 border-t border-border bg-muted/10 flex justify-end gap-3">
                                <button
                                    onClick={() => handleReject(selectedRequest.id)}
                                    className="btn-secondary"
                                >
                                    Request Changes
                                </button>
                                <button
                                    onClick={() => handleApproveAndAllocate(selectedRequest)}
                                    className="btn-primary gap-2"
                                >
                                    <Check className="w-4 h-4" />
                                    Confirm & Issue
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
