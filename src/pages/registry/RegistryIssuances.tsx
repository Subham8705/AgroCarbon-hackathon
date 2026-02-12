import DashboardLayout from '@/components/layout/DashboardLayout';
import { Archive, Leaf, Building2, Shield, Calendar, Download, Search, Filter, Loader2, CheckCircle, FileText, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, Timestamp, addDoc } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface Issuance {
  id: string;
  companyName: string;
  companyId?: string; // Add companyId
  projectName?: string;
  verifierName?: string;
  verifierId?: string;
  totalCredits: number;
  farmersCount?: number;
  issuedAt: string;
  serialRange?: string;
  status: string;
  registryProjectId?: string;
  pddDocumentUrl?: string;
  verificationReportId?: string;
  plotsData?: any[]; // Array of plot data
}

export default function RegistryIssuances() {
  const { user } = useAuth();
  const [issuances, setIssuances] = useState<Issuance[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Issuance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<Issuance | null>(null);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [issuing, setIssuing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Issued Credits
      const qIssued = query(collection(db, 'verification_requests'), where('status', '==', 'issued'));
      const snapIssued = await getDocs(qIssued);
      const issuedData: Issuance[] = snapIssued.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          companyName: d.companyName || 'Unknown',
          companyId: d.companyId,
          projectName: d.projectName || `${d.batchMonth} Batch`,
          verifierName: d.verifierName || 'Authorized Verifier',
          totalCredits: d.finalCreditsIssued || d.totalVerifiedCredits || d.totalCredits || 0,
          farmersCount: d.plotsData?.length || 0,
          issuedAt: d.issuedAt?.toDate().toLocaleDateString() || new Date().toLocaleDateString(),
          serialRange: d.serialRange || `IND-2026-${doc.id.slice(0, 4).toUpperCase()}`,
          status: 'issued',
          registryProjectId: d.registryProjectId,
          plotsData: d.plotsData || [] // Capture plotsData
        };
      });
      setIssuances(issuedData);

      // 2. Fetch Pending Issuance Requests
      const qPending = query(collection(db, 'verification_requests'), where('status', '==', 'pending_registry_review'));
      const snapPending = await getDocs(qPending);
      const pendingData: Issuance[] = snapPending.docs.map(doc => {
        const d = doc.data();
        const verifiedTotal = d.verifiedCredits ? Object.values(d.verifiedCredits).reduce((a: any, b: any) => a + b, 0) : d.totalCredits;

        return {
          id: doc.id,
          companyName: d.companyName || 'Unknown',
          companyId: d.companyId,
          projectName: d.batchMonth ? `Batch ${d.batchMonth}` : 'Carbon Project',
          verifierName: d.verifierName || 'Registered Verifier',
          totalCredits: verifiedTotal || 0,
          farmersCount: d.plotsData?.length || 0,
          issuedAt: d.submittedToRegistryAt?.toDate().toLocaleDateString() || 'Today',
          status: 'pending',
          registryProjectId: d.registryProjectId || 'PENDING',
          pddDocumentUrl: d.pddDocumentUrl,
          plotsData: d.plotsData || [] // Capture plotsData
        };
      });
      setPendingRequests(pendingData);

    } catch (err) {
      console.error("Error fetching issuances:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleIssueCredits = async () => {
    if (!selectedRequest || !user) return;
    setIssuing(true);
    try {
      // 1. Generate Serial Numbers
      // Format: <RegistryPrefix>-VCU-<ProjectID>-<Year>-<SeqNum>
      // Example: VERA-VCU-1234-2026-0001

      // Get registry prefix from user name or manual mapping
      const registryPrefix = (user.name || 'REG').substring(0, 4).toUpperCase();
      const projectID = selectedRequest.registryProjectId || 'PROJ';
      const year = new Date().getFullYear();

      // We need to generate a unique block. 
      // For simplicity in this demo, we generate one range string. 
      // In a real system, we'd allocate a block in a separate collection to ensure uniqueness.

      const uniqueSeq = Date.now().toString().slice(-6); // Simple random-ish seq
      const startSerial = `${registryPrefix}-VCU-${projectID}-${year}-${uniqueSeq}`;
      const endSerial = `${registryPrefix}-VCU-${projectID}-${year}-${parseInt(uniqueSeq) + Math.floor(selectedRequest.totalCredits)}`;

      const serialRange = `${startSerial} ... ${endSerial}`;

      // 2. Generate Individual Credits (Collection Logic)
      // The user explicitly requested to verify via the 'issued_credits' collection.

      const creditsCount = Math.floor(selectedRequest.totalCredits);
      const batchOpPromises = [];

      let issuedCount = 0;

      // Helper to issue a single credit
      const issueCredit = (plotId: string) => {
        const uniqueSuffix = (parseInt(uniqueSeq) + issuedCount).toString().padStart(6, '0');
        const serialNumber = `${registryPrefix}-VCU-${projectID}-${year}-${uniqueSuffix}`;

        batchOpPromises.push(addDoc(collection(db, 'issued_credits'), {
          serialNumber: serialNumber,
          registryProjectId: projectID,
          companyName: selectedRequest.companyName,
          companyId: selectedRequest.companyId,
          batchId: selectedRequest.id,
          plotId: plotId, // Store Plot ID
          issuedAt: Timestamp.now(),
          status: 'active',
          vintage: year,
          type: 'VCU'
        }));
        issuedCount++;
      };

      // Fetch the full verification request to get verifiedCredits map
      const reqDoc = await getDocs(query(collection(db, 'verification_requests'), where('__name__', '==', selectedRequest.id)));
      const verifiedCredits = reqDoc.docs[0]?.data()?.verifiedCredits || {};

      // 1. Distribute based on verifiedCredits map (plotId -> credit count)
      // This is what the verifier finalized
      if (Object.keys(verifiedCredits).length > 0) {
        for (const [plotId, creditCount] of Object.entries(verifiedCredits)) {
          const creditsForPlot = Math.floor(creditCount as number);

          for (let k = 0; k < creditsForPlot; k++) {
            if (issuedCount >= creditsCount) break;
            issueCredit(plotId);
          }

          if (issuedCount >= creditsCount) break;
        }
      }

      // 2. Handle any remainder (due to rounding)
      // Assign remainder to the first plot in verifiedCredits
      const fallbackPlotId = Object.keys(verifiedCredits)[0] || 'GENERAL';

      while (issuedCount < creditsCount) {
        issueCredit(fallbackPlotId);
      }

      await Promise.all(batchOpPromises);

      // 3. Update Verification Request Status
      const reqRef = doc(db, 'verification_requests', selectedRequest.id);
      await updateDoc(reqRef, {
        status: 'issued',
        issuedAt: Timestamp.now(),
        finalCreditsIssued: selectedRequest.totalCredits,
        serialRange: serialRange,
        issuedBy: user.id
        // We do NOT need to store the array here anymore
      });

      toast.success(`Succesfully issued ${selectedRequest.totalCredits.toFixed(2)} credits!`);
      setIsIssueModalOpen(false);
      fetchData(); // Refresh

    } catch (error) {
      console.error("Error issuing credits:", error);
      toast.error("Failed to issue credits. Please try again.");
    } finally {
      setIssuing(false);
    }
  };

  const filteredIssuances = issuances.filter(
    (item) =>
      item.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.projectName && item.projectName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalCredits = filteredIssuances.reduce((sum, i) => sum + i.totalCredits, 0);

  return (
    <DashboardLayout role="registry">
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 animate-fade-in">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Registry Issuance</h1>
            <p className="text-muted-foreground mt-1">Manage credit issuance and view registry</p>
          </div>
          <div className="card-elevated px-4 py-2 bg-primary/5 border-primary/20">
            <div className="text-sm text-muted-foreground">Total Registry Limit</div>
            <div className="text-2xl font-bold text-primary">{totalCredits.toFixed(1)} tCO₂</div>
          </div>
        </div>

        <Tabs defaultValue="pending" className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <TabsList>
            <TabsTrigger value="pending" className="gap-2">
              <AlertCircle className="w-4 h-4" />
              Pending Requests ({pendingRequests.length})
            </TabsTrigger>
            <TabsTrigger value="issued" className="gap-2">
              <CheckCircle className="w-4 h-4" />
              Issued Credits
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-6">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : pendingRequests.length === 0 ? (
              <div className="text-center py-12 card-elevated">
                <CheckCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground">All Caught Up</h3>
                <p className="text-muted-foreground">No pending verification requests.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {pendingRequests.map((req) => (
                  <div key={req.id} className="card-elevated p-6 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                        <Shield className="w-6 h-6 text-orange-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{req.companyName}</h3>
                        <p className="text-sm text-muted-foreground">{req.projectName} • {req.farmersCount} Farmers</p>
                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> {req.verifierName}</span>
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Submitted: {req.issuedAt}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-foreground">{req.totalCredits.toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">Verified tCO₂</div>
                      </div>
                      <Button onClick={() => { setSelectedRequest(req); setIsIssueModalOpen(true); }}>
                        Issue Credits
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="issued" className="mt-6 space-y-6">
            {/* Search */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search issuances..."
                  className="input-field pl-10"
                />
              </div>
              <Button variant="outline" className="gap-2">
                <Download className="w-4 h-4" /> Export CSV
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : (
              <div className="space-y-4">
                {filteredIssuances.map((issuance) => (
                  <div key={issuance.id} className="card-elevated p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left: Info */}
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl gradient-registry flex items-center justify-center shrink-0">
                          <Archive className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Building2 className="w-4 h-4 text-muted-foreground" />
                            <span className="font-bold text-foreground">{issuance.companyName}</span>
                          </div>
                          <div className="text-sm text-muted-foreground mb-2">{issuance.projectName}</div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Shield className="w-3 h-3" />
                              {issuance.verifierName}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {issuance.issuedAt}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Middle: Stats */}
                      <div className="flex items-center gap-8">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-primary flex items-center gap-1">
                            <Leaf className="w-5 h-5" />
                            {issuance.totalCredits.toFixed(2)}
                          </div>
                          <div className="text-xs text-muted-foreground">tCO₂ Issued</div>
                        </div>
                      </div>

                      {/* Right: Serial */}
                      <div className="bg-muted/50 rounded-lg px-4 py-2">
                        <div className="text-xs text-muted-foreground mb-1">Serial Range</div>
                        <div className="text-sm font-mono text-foreground">{issuance.serialRange}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Issuance Modal */}
        <Dialog open={isIssueModalOpen} onOpenChange={setIsIssueModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Issue Carbon Credits</DialogTitle>
              <DialogDescription>
                You are about to issue credits for <strong>{selectedRequest?.companyName}</strong>.
                This will generate unique serial numbers for <strong>{selectedRequest?.totalCredits.toFixed(2)} tCO₂</strong>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="bg-muted p-3 rounded-md text-sm">
                <p><strong>Project ID:</strong> {selectedRequest?.registryProjectId}</p>
                <p><strong>Verification:</strong> Passed</p>
                <p><strong>Verifier:</strong> {selectedRequest?.verifierName}</p>
              </div>

              {selectedRequest?.pddDocumentUrl && (
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="w-4 h-4 text-primary" />
                    <span className="font-medium">Project Design Document (PDD) on file</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Document verified and approved by registry</p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsIssueModalOpen(false)}>Cancel</Button>
              <Button onClick={handleIssueCredits} disabled={issuing}>
                {issuing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                Confirm Issuance
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
