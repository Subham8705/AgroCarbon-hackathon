import DashboardLayout from '@/components/layout/DashboardLayout';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, FileCheck, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import PDDDocument from '@/components/pdd/PDDDocument';

export default function RegistryValidationRequests() {
    const { user } = useAuth();
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewRequest, setViewRequest] = useState<any | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (user?.id) {
            fetchRequests();
        }
    }, [user]);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            // In a real app, filter by registry name. For now, fetch all 'report_submitted'
            const q = query(
                collection(db, 'validation_requests'),
                where('status', '==', 'report_submitted')
            );

            const querySnapshot = await getDocs(q);
            const requestList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            setRequests(requestList);
        } catch (error) {
            console.error('Error fetching requests:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleProcessRequest = async (status: 'validated' | 'rejected') => {
        if (!viewRequest) return;
        setProcessing(true);
        try {
            // 1. Update Validation Request
            await updateDoc(doc(db, 'validation_requests', viewRequest.id), {
                status: status,
                processedAt: serverTimestamp(),
                processedBy: user?.name
            });

            // 2. Update PDD Request (to link the status back to the main flow)
            // Find the related PDD request for this company
            const qPDD = query(collection(db, 'pdd_requests'), where('companyId', '==', viewRequest.companyId));
            const snapPDD = await getDocs(qPDD);
            if (!snapPDD.empty) {
                await updateDoc(doc(db, 'pdd_requests', snapPDD.docs[0].id), {
                    status: status,
                    validatedAt: serverTimestamp(),
                    validatorId: viewRequest.verifierId,
                    validationReportId: viewRequest.id
                });
            }

            toast.success(`Project ${status.toUpperCase()} Successfully`);
            setIsModalOpen(false);
            fetchRequests();

        } catch (error) {
            console.error("Error processing", error);
            toast.error("Failed to process request");
        } finally {
            setProcessing(false);
        }
    }

    return (
        <DashboardLayout role="registry">
            <div className="p-6 lg:p-8 space-y-6">
                <div className="animate-fade-in">
                    <h1 className="text-3xl font-display font-bold text-foreground">Validation Reviews</h1>
                    <p className="text-muted-foreground mt-1">Review VVB reports and issue final project validation.</p>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : requests.length === 0 ? (
                    <div className="card-elevated p-12 text-center">
                        <FileCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-foreground">No Pending Validations</h3>
                        <p className="text-muted-foreground">There are no incoming validation reports to review.</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {requests.map((req, index) => (
                            <div
                                key={req.id}
                                className="card-elevated p-6 animate-fade-in hover:shadow-lg transition-all"
                                style={{ animationDelay: `${index * 0.1}s` }}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700">
                                            <FileCheck className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-display font-bold text-foreground">{req.companyName}</h3>
                                            <p className="text-sm text-muted-foreground">Verifier: {req.verifierName}</p>
                                            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                                                <span>Submitted: {req.submittedAt?.toDate().toLocaleDateString()}</span>
                                                <span className="text-green-600 font-medium">Report Ready</span>
                                            </div>
                                        </div>
                                    </div>

                                    <Button onClick={() => { setViewRequest(req); setIsModalOpen(true); }}>
                                        Review Report
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Review Modal */}
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Validation Review: {viewRequest?.companyName}</DialogTitle>
                            <DialogDescription>
                                Review the independent Validation Report from <strong>{viewRequest?.verifierName}</strong>.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-4">
                            {/* Report Details */}
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm space-y-4">
                                <h4 className="font-bold border-b pb-2">VVB Report Findings</h4>
                                {viewRequest?.report ? (
                                    <>
                                        <div>
                                            <strong className="block text-slate-500">Summary</strong>
                                            <p>{viewRequest.report.summary}</p>
                                        </div>
                                        <div>
                                            <strong className="block text-slate-500">Findings</strong>
                                            <p className="whitespace-pre-line">{viewRequest.report.findings}</p>
                                        </div>
                                        <div>
                                            <strong className="block text-slate-500">Conclusion</strong>
                                            <p>{viewRequest.report.conclusion}</p>
                                        </div>
                                        <div className="pt-2 text-xs text-slate-400">
                                            Signed by: {viewRequest.report.validatorSignature} on {new Date(viewRequest.report.date).toLocaleDateString()}
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-red-500">Report details unavailable</p>
                                )}
                            </div>

                            {/* PDD Preview */}
                            <div className="max-h-[500px] overflow-y-auto border rounded-xl overflow-hidden scale-90 origin-top-left">
                                {viewRequest?.pddData && <PDDDocument data={viewRequest.pddData} />}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Close</Button>
                            <Button variant="destructive" onClick={() => handleProcessRequest('rejected')} disabled={processing}>
                                <XCircle className="w-4 h-4 mr-2" /> Reject
                            </Button>
                            <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleProcessRequest('validated')} disabled={processing}>
                                {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                                Approve & Validate Project
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </DashboardLayout>
    );
}
