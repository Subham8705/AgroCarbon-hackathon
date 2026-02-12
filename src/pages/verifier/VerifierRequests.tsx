import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { ClipboardCheck, Building2, Calendar, MapPin, Users, ArrowRight, Eye, Loader2, CheckCircle, FileText } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

interface VerificationRequest {
  id: string;
  companyId: string;
  companyName: string;
  batchMonth: string;
  batchMonthKey: string;
  farmerCount: number;
  totalAcres: number;
  baselineTotal: number;
  projectTotal: number;
  status: 'pending' | 'inReview' | 'verified' | 'waiting_for_payment' | 'payment_received';
  paymentStatus?: string;
  paymentAmount?: number;
  createdAt: any;
}

const statusConfig = {
  pending: { label: 'Pending Review', color: 'status-pending' },
  inReview: { label: 'In Review', color: 'bg-purple-100 text-purple-800' },
  waiting_for_payment: { label: 'Payment Requested', color: 'bg-amber-100 text-amber-800' },
  payment_received: { label: 'Processing', color: 'bg-blue-100 text-blue-800' },
  verified: { label: 'Verified', color: 'status-approved' },
};

export default function VerifierRequests() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'incoming' | 'active' | 'validation'>('validation');
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [validationRequests, setValidationRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [viewRequest, setViewRequest] = useState<any | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);

  const [reportData, setReportData] = useState({
    summary: "The validator has reviewed the Project Design Document (PDD), baseline scenario, project practices, and calculation methodology.",
    findings: "Project boundaries and plot areas are correctly defined.\nBaseline farming practices represent business-as-usual conditions.\nData sources (SOC, NDVI, rainfall) are appropriate and traceable.\nRisk of double counting has been addressed through unique plot IDs.",
    conclusion: "The project design complies with registry requirements and is suitable for carbon credit issuance after monitoring and verification."
  });

  useEffect(() => {
    if (user?.id) {
      fetchRequests();
      fetchValidationRequests();
    }
  }, [user]);

  const fetchRequests = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'verification_requests'),
        where('verifierId', '==', user.id),
        where('status', 'in', ['pending', 'inReview', 'waiting_for_payment', 'payment_received'])
      );
      const querySnapshot = await getDocs(q);
      const requestList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as VerificationRequest));
      requestList.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });
      setRequests(requestList);
    } catch (error) {
      console.error('Error fetching verification requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchValidationRequests = async () => {
    try {
      const q = query(collection(db, 'validation_requests'), where('verifierId', '==', user?.id), where('status', '==', 'pending'));
      const snapshot = await getDocs(q);
      const valReqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setValidationRequests(valReqs);
    } catch (error) {
      console.error('Error fetching validation requests:', error);
    }
  };

  const handleSendValidationReport = async () => {
    if (!viewRequest || !user) return;
    setSendingReport(true);
    try {
      const report = {
        projectName: viewRequest.companyName || 'Unknown Project',
        verifierName: user?.name,
        summary: reportData.summary,
        findings: reportData.findings,
        conclusion: reportData.conclusion,
        status: 'Validated',
        date: new Date().toISOString()
      };

      // Update request using modular SDK style
      const { updateDoc, doc, serverTimestamp } = await import('firebase/firestore');
      await updateDoc(doc(db, 'validation_requests', viewRequest.id), {
        status: 'report_submitted',
        report: report,
        reportSubmittedAt: serverTimestamp()
      });

      import('sonner').then(({ toast }) => toast.success("Validation Report sent to Registry and Project Company"));
      setIsReportOpen(false);
      setViewRequest(null);
      fetchValidationRequests(); // Refresh list

    } catch (error) {
      console.error("Error sending report", error);
      import('sonner').then(({ toast }) => toast.error("Failed to send validation report"));
    } finally {
      setSendingReport(false);
    }
  };

  const handleRequestPayment = async (request: VerificationRequest) => {
    if (!confirm(`Request payment of ₹${request.paymentAmount || 5000} from ${request.companyName}?`)) return;

    try {
      await updateDoc(doc(db, 'verification_requests', request.id), {
        status: 'waiting_for_payment',
        paymentStatus: 'requested',
        paymentAmount: request.paymentAmount || 5000,
        updatedAt: Timestamp.now()
      });

      // Refresh list
      fetchRequests();
    } catch (error) {
      console.error("Error requesting payment:", error);
      alert("Failed to update status");
    }
  };

  // Filter requests based on tab
  const incomingRequests = requests.filter(r => ['pending', 'inReview', 'waiting_for_payment'].includes(r.status));
  const activeVerifications = requests.filter(r => r.status === 'payment_received');

  const currentBatchList = activeTab === 'incoming' ? incomingRequests : activeVerifications;

  return (
    <DashboardLayout role="verifier">
      <div className="p-6 lg:p-8 space-y-6">
        <div className="animate-fade-in flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Verification Requests</h1>
            <p className="text-muted-foreground mt-1">Manage PDD validations and batch verifications</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-b border-border overflow-x-auto">
          <button
            onClick={() => setActiveTab('validation')}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 px-1 ${activeTab === 'validation' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            PDD Validation
            <span className="ml-2 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">{validationRequests.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('incoming')}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 px-1 ${activeTab === 'incoming' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            Batch Requests
            <span className="ml-2 bg-muted px-2 py-0.5 rounded-full text-xs">{incomingRequests.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 px-1 ${activeTab === 'active' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            Active Batches
            <span className="ml-2 bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs">{activeVerifications.length}</span>
          </button>
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : activeTab === 'validation' ? (
          // ================= PDD VALIDATION TAB =================
          validationRequests.length === 0 ? (
            <div className="card-elevated p-12 text-center text-muted-foreground animate-fade-in">
              <ClipboardCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium text-foreground">No PDD Validation Requests</h3>
              <p>New project validation requests will appear here.</p>
            </div>
          ) : (
            <div className="grid gap-4 animate-fade-in">
              {validationRequests.map(req => (
                <div key={req.id} className="card-elevated p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="w-12 h-12 rounded-xl gradient-company flex items-center justify-center shrink-0">
                      <Building2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{req.companyName}</h3>
                      <p className="text-sm text-muted-foreground">Registry: {req.registryName}</p>
                      <p className="text-xs text-muted-foreground mt-1">Submitted: {req.submittedAt?.toDate ? format(req.submittedAt.toDate(), 'MMM d, yyyy') : 'Just now'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setViewRequest(req); setIsReportOpen(true); }}
                    className="btn-primary w-full md:w-auto gap-2"
                  >
                    <Eye className="w-4 h-4" /> Review PDD
                  </button>
                </div>
              ))}
            </div>
          )
        ) : (
          // ================= BATCH VERIFICATION TABS =================
          currentBatchList.length === 0 ? (
            <div className="card-elevated p-12 text-center text-muted-foreground animate-fade-in">
              <ClipboardCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium text-foreground">No {activeTab === 'incoming' ? 'Incoming' : 'Active'} Requests</h3>
              <p>
                {activeTab === 'incoming'
                  ? 'You have processed all incoming verification requests.'
                  : 'No active verification projects at the moment.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4 animate-fade-in">
              {currentBatchList.map((request, index) => {
                const config = statusConfig[request.status] || { label: 'Unknown', color: 'bg-gray-100' };
                return (
                  <div key={request.id} className="card-elevated p-6 flex flex-col lg:flex-row items-center justify-between gap-4" style={{ animationDelay: `${index * 0.1}s` }}>
                    <div className="flex items-center gap-4 w-full lg:w-auto">
                      <div className="w-12 h-12 rounded-xl gradient-company flex items-center justify-center shrink-0"><Building2 className="w-6 h-6 text-white" /></div>
                      <div>
                        <h3 className="font-bold text-foreground">{request.companyName}</h3>
                        <p className="text-sm text-muted-foreground">Batch: {request.batchMonth}</p>
                        <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {request.farmerCount} Farmers</span>
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {request.totalAcres?.toFixed(1)} Acres</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 w-full lg:w-auto justify-between lg:justify-end">
                      <div className="text-right">
                        <span className={`status-badge ${config.color}`}>{config.label}</span>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button onClick={() => navigate(`/verifier/verify/${request.id}`)} className="btn-primary gap-2 w-full"><Eye className="w-4 h-4" /> View</button>
                        {request.status === 'inReview' && (
                          <button
                            onClick={() => handleRequestPayment(request)}
                            className="bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors w-full"
                          >
                            <span className="font-bold">₹</span> Request Payment
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* Validation Report Modal */}
        {isReportOpen && viewRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 flex flex-col">
              <div className="flex justify-between items-center border-b pb-4 shrink-0">
                <div>
                  <h2 className="text-2xl font-bold">PDD Validation Audit</h2>
                  <p className="text-muted-foreground text-sm">Reviewing Project: {viewRequest.companyName}</p>
                </div>
                <button onClick={() => setIsReportOpen(false)} className="p-2 hover:bg-slate-100 rounded-full"><ArrowRight className="w-5 h-5" /></button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 grow overflow-hidden" style={{ minHeight: '600px' }}>
                {/* LEFT: PDD Data Preview */}
                <div className="border rounded-lg p-4 bg-slate-50 overflow-y-auto h-full space-y-4">
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <h3 className="font-bold">Original PDD Submission</h3>
                  </div>

                  <div className="space-y-4 text-sm">
                    <div className="p-3 bg-white rounded border">
                      <span className="text-xs text-muted-foreground uppercase font-bold">Project ID</span>
                      <div className="font-mono">{viewRequest.pddData?.projectId || 'N/A'}</div>
                    </div>
                    <div className="p-3 bg-white rounded border">
                      <span className="text-xs text-muted-foreground uppercase font-bold">Region</span>
                      <div>{viewRequest.pddData?.region || 'N/A'}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-2 bg-white rounded border text-center">
                        <div className="font-bold text-lg">{viewRequest.pddData?.totalFarmers}</div>
                        <div className="text-[10px] uppercase text-muted-foreground">Farmers</div>
                      </div>
                      <div className="p-2 bg-white rounded border text-center">
                        <div className="font-bold text-lg">{viewRequest.pddData?.totalAcres?.toFixed(1)}</div>
                        <div className="text-[10px] uppercase text-muted-foreground">Acres</div>
                      </div>
                      <div className="p-2 bg-white rounded border text-center">
                        <div className="font-bold text-lg text-green-600">{viewRequest.pddData?.estimatedCO2?.toFixed(1)}</div>
                        <div className="text-[10px] uppercase text-muted-foreground">tCO2e</div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <h4 className="font-bold text-xs uppercase text-muted-foreground mb-2">Plot Data Sample</h4>
                      <div className="space-y-2">
                        {viewRequest.pddData?.plots?.slice(0, 5).map((plot: any, i: number) => (
                          <div key={i} className="text-xs p-2 bg-white border rounded flex justify-between">
                            <span>{plot.farmerName}</span>
                            <span className="font-mono text-muted-foreground">{plot.plotId}</span>
                          </div>
                        ))}
                        {(viewRequest.pddData?.plots?.length || 0) > 5 && (
                          <div className="text-center text-xs text-muted-foreground">
                            + {(viewRequest.pddData?.plots?.length || 0) - 5} more plots
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT: Validation Report Form */}
                <div className="flex flex-col h-full space-y-4">
                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100 text-sm text-yellow-800">
                    <h4 className="font-bold flex items-center gap-2"><ClipboardCheck className="w-4 h-4" /> Auditor Instructions</h4>
                    <p className="mt-1">Please verify the PDD against the registry methodology. Your findings will be sent to the registry for final issuance approval.</p>
                  </div>

                  <div className="space-y-1 grow overflow-y-auto">
                    <label className="text-sm font-medium">Validation Summary</label>
                    <textarea
                      className="w-full border rounded-md p-3 text-sm focus:ring-2 focus:ring-primary h-24"
                      value={reportData.summary}
                      onChange={e => setReportData({ ...reportData, summary: e.target.value })}
                    />

                    <label className="text-sm font-medium mt-4 block">Detailed Findings</label>
                    <textarea
                      className="w-full border rounded-md p-3 text-sm focus:ring-2 focus:ring-primary h-32 font-mono bg-slate-50"
                      value={reportData.findings}
                      onChange={e => setReportData({ ...reportData, findings: e.target.value })}
                    />

                    <label className="text-sm font-medium mt-4 block">Conclusion & Recommendation</label>
                    <textarea
                      className="w-full border rounded-md p-3 text-sm focus:ring-2 focus:ring-primary h-24"
                      value={reportData.conclusion}
                      onChange={e => setReportData({ ...reportData, conclusion: e.target.value })}
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-4 border-t sticky bottom-0 bg-white">
                    <button onClick={() => setIsReportOpen(false)} className="px-4 py-2 border rounded-lg hover:bg-slate-50">Cancel</button>
                    <button
                      onClick={handleSendValidationReport}
                      disabled={sendingReport}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 shadow-lg hover:shadow-green-600/20 transition-all font-medium"
                    >
                      {sendingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      Submit Validation Report
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout >
  );
}
