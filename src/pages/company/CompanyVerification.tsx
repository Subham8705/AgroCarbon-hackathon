import DashboardLayout from '@/components/layout/DashboardLayout';
import { Shield, Star, Send, Check, Building2, Loader2, X, FileText } from 'lucide-react';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import PDDDocument from '@/components/pdd/PDDDocument';
import { calculateCO2Estimation } from '@/lib/carbonCalculator';
import { CO2EstimationParams } from '@/types';
import { toast } from 'sonner';

interface Verifier {
  id: string;
  name: string;
  email: string;
  phone: string;
  organization?: string;
  licenseNumber?: string;
}

export default function CompanyVerification() {
  const { user } = useAuth();
  const [verifiers, setVerifiers] = useState<Verifier[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVerifier, setSelectedVerifier] = useState<Verifier | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [pddData, setPddData] = useState<any>(null);
  const [loadingPDD, setLoadingPDD] = useState(false);
  const [existingRequest, setExistingRequest] = useState<any>(null);

  useEffect(() => {
    fetchVerifiers();
    if (user?.id) fetchExistingRequest();
  }, [user]);

  const fetchExistingRequest = async () => {
    // Find any active or completed request
    const q = query(collection(db, 'validation_requests'), where('companyId', '==', user?.id));
    const snap = await getDocs(q);
    if (!snap.empty) {
      // Get the most recent one
      const docs = snap.docs.map(d => d.data());
      docs.sort((a: any, b: any) => (b.submittedAt?.toMillis() || 0) - (a.submittedAt?.toMillis() || 0));
      setExistingRequest(docs[0]);
    }
  };

  const fetchVerifiers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'verifier'));
      const querySnapshot = await getDocs(q);

      const verifierList: Verifier[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        email: doc.data().email,
        phone: doc.data().phone,
        organization: doc.data().organization,
        licenseNumber: doc.data().licenseNumber
      }));

      setVerifiers(verifierList);
    } catch (error) {
      console.error('Error fetching verifiers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPDDData = async () => {
    if (!user?.id) return;
    setLoadingPDD(true);
    try {
      // 1. Fetch Accepted Farmers
      const qFarmers = query(
        collection(db, 'project_applications'),
        where('companyId', '==', user.id),
        where('status', '==', 'accepted')
      );
      const snapshotFarmers = await getDocs(qFarmers);

      let farmersCount = 0;
      let acresCount = 0;
      let co2Count = 0;
      const fetchedPlots: any[] = [];

      // 2. Process each farmer
      for (const d of snapshotFarmers.docs) {
        const data = d.data();
        farmersCount++;
        acresCount += (data.farmerAcres || 0);
        co2Count += (data.farmerTotalCO2 || 0);

        // Fetch estimates
        const qEstimates = query(
          collection(db, 'estimates'),
          where('userId', '==', data.farmerId)
        );
        const snapshotEstimates = await getDocs(qEstimates);

        if (!snapshotEstimates.empty) {
          const estimatesDocs = snapshotEstimates.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          estimatesDocs.sort((a: any, b: any) => (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0) - (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0));
          const latestEstimate: any = estimatesDocs[0];

          let polygons = [];
          if (latestEstimate.polygons && Array.isArray(latestEstimate.polygons)) {
            polygons = latestEstimate.polygons;
          } else if (latestEstimate.polygonPoints && Array.isArray(latestEstimate.polygonPoints)) {
            polygons = latestEstimate.polygonPoints.map((point: any, index: number) => ({
              id: `polygon_${index}`,
              points: [point],
              area: latestEstimate.area || 0
            }));
          }

          if (polygons.length > 0) {
            polygons.forEach((polygon: any) => {
              let area = polygon.area || latestEstimate.area || latestEstimate.acres || data.farmerAcres || 1;
              const baseResult = calculateCO2Estimation({
                soc: latestEstimate.soc || 30, ndvi: latestEstimate.ndvi || 0.4, rainfall: latestEstimate.rainfall || 800,
                tillage: (latestEstimate.baselinePractice === 'conventional' ? 'ploughing' : latestEstimate.baselinePractice || 'ploughing') as any,
                coverCrop: false, trees: 0, yearsFollowed: 0, acres: area
              });
              const projectResult = calculateCO2Estimation({
                soc: latestEstimate.soc || 30, ndvi: latestEstimate.projectNDVI || 0.4, rainfall: latestEstimate.rainfall || 800,
                tillage: 'no-till', coverCrop: true, trees: latestEstimate.trees || 0, yearsFollowed: 1, acres: area
              });

              fetchedPlots.push({
                plotId: polygon.id || `PLOT-${Math.random().toString(36).substr(2, 5)}`,
                farmerName: data.farmerName || 'Unknown',
                areaAcres: area,
                baseline: { practice: latestEstimate.baselinePractice || 'ploughing', carbonEstimate: baseResult.totalCO2 },
                project: { practice: 'no-till + cover crop', carbonEstimate: projectResult.totalCO2 }
              });
            });
          } else {
            const area = data.farmerAcres || 1;
            fetchedPlots.push({
              plotId: `FARMER-${data.farmerId.substr(0, 4)}`,
              farmerName: data.farmerName,
              areaAcres: area,
              baseline: { practice: 'conventional', carbonEstimate: area * 0.2 },
              project: { practice: 'improved', carbonEstimate: area * 1.5 }
            });
          }
        } else {
          const area = data.farmerAcres || 1;
          fetchedPlots.push({
            plotId: `FARMER-${data.farmerId.substr(0, 4)}`,
            farmerName: data.farmerName,
            areaAcres: area,
            baseline: { practice: 'conventional', carbonEstimate: area * 0.2 },
            project: { practice: 'improved', carbonEstimate: area * 1.5 }
          });
        }
      }

      // Fetch PDD Request Status
      const qPDD = query(collection(db, 'pdd_requests'), where('companyId', '==', user.id));
      const snapshotPDD = await getDocs(qPDD);
      let pddReqData = null;
      if (!snapshotPDD.empty) {
        pddReqData = snapshotPDD.docs[0].data();
      }

      setPddData({
        companyName: (user as any)?.companyName || user?.name || 'AgroCarbon Project',
        region: (user as any)?.location || 'Telangana, India',
        startDate: user?.createdAt,
        totalFarmers: farmersCount,
        totalAcres: acresCount,
        estimatedCO2: co2Count,
        projectId: pddReqData?.registryProjectId || '(pending)',
        registry: pddReqData?.registryName || 'Not Selected',
        plots: fetchedPlots
      });

    } catch (error) {
      console.error('Error fetching PDD Data', error);
      toast.error('Failed to generate PDD preview');
    } finally {
      setLoadingPDD(false);
    }
  };

  const handleSelectVerifier = async (verifier: Verifier) => {
    setSelectedVerifier(verifier);
    setIsModalOpen(true);
    if (!pddData) {
      await fetchPDDData();
    }
  };

  const handleSendForValidation = async () => {
    if (!selectedVerifier || !user || !pddData) return;
    setSending(true);

    try {
      await addDoc(collection(db, 'validation_requests'), {
        companyId: user.id,
        companyName: (user as any).companyName || user.name,
        verifierId: selectedVerifier.id,
        verifierName: selectedVerifier.name,
        registryName: pddData.registry,
        pddData: pddData,
        status: 'pending', // pending -> validated | rejected
        submittedAt: serverTimestamp(),
      });

      toast.success(`Validation request sent to ${selectedVerifier.name}`);
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error sending validation request:', error);
      toast.error('Failed to send request');
    } finally {
      setSending(false);
    }
  };

  return (
    <DashboardLayout role="company">
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-3xl font-display font-bold text-foreground">Registered Verifiers (VVB)</h1>
          <p className="text-muted-foreground mt-1">Select an authorized verifier to audit your Project Design Document (PDD).</p>
        </div>

        {/* Existing Request Alert */}
        {existingRequest && (
          <div className={`p-4 rounded-lg border flex items-center gap-3 mb-6 ${existingRequest.status === 'validated' ? 'bg-green-50 border-green-200 text-green-800' :
            existingRequest.status === 'rejected' ? 'bg-red-50 border-red-200 text-red-800' :
              'bg-blue-50 border-blue-200 text-blue-800'
            }`}>
            {existingRequest.status === 'validated' ? <Check className="w-5 h-5" /> :
              existingRequest.status === 'rejected' ? <X className="w-5 h-5" /> :
                <Loader2 className="w-5 h-5 animate-spin" />}
            <div>
              <h4 className="font-semibold">Validation Request {existingRequest.status === 'validated' ? 'Approved' : existingRequest.status === 'rejected' ? 'Rejected' : 'Active'}</h4>
              <p className="text-sm opacity-90">
                You have sent a request to <strong>{existingRequest.verifierName}</strong>.
                Status: <span className="uppercase">{existingRequest.status}</span>
              </p>
            </div>
          </div>
        )}

        {/* Verifier List */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : verifiers.length === 0 ? (
            <div className="card-elevated p-12 text-center">
              <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground">No Verifiers Available</h3>
              <p className="text-muted-foreground">No registered verifiers found in the system yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {verifiers.map((verifier, index) => {
                const isSelectedVerifier = existingRequest?.verifierId === verifier.id;
                const isDisabled = !!existingRequest; // Disable ALL if any request exists (unless we want to allow retry after rejection?)
                // Assuming "only can be apply to single verifier in once" means concurrent requests are banned.

                return (
                  <div
                    key={verifier.id}
                    className={`card-elevated p-6 animate-fade-in hover:shadow-lg transition-all flex flex-col ${isSelectedVerifier ? 'ring-2 ring-primary bg-primary/5' : ''}`}
                    style={{ animationDelay: `${0.2 + index * 0.1}s` }}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl gradient-verifier flex items-center justify-center">
                        <Shield className="w-6 h-6 text-white" />
                      </div>
                      {isSelectedVerifier && <span className="bg-primary text-white text-xs px-2 py-1 rounded-full">Selected</span>}
                    </div>

                    <h4 className="font-display font-bold text-foreground mb-1">{verifier.name}</h4>
                    {verifier.organization && (
                      <p className="text-sm text-muted-foreground mb-2">{verifier.organization}</p>
                    )}

                    <div className="space-y-1 mt-3 mb-6 flex-1">
                      <p className="text-xs text-muted-foreground">{verifier.email}</p>
                      {verifier.licenseNumber && (
                        <p className="text-xs text-muted-foreground">License: {verifier.licenseNumber}</p>
                      )}
                    </div>

                    <Button
                      className="w-full"
                      onClick={() => handleSelectVerifier(verifier)}
                      disabled={isDisabled && !isSelectedVerifier} // Allow clicking own button to potentially view results? For now just keep disabled logic as is or simple. 
                      // Actually, if it says "Received Results", user might want to click it. But for now request is just text change.
                      // The original code had disabled={isDisabled}. If I want to allow clicking "Received Results", I should un-disable it for the selected one.
                      // But the prompt was strictly "button should be changed".
                      // I will keep the original disabled logic which was `disabled={isDisabled}`. 
                      // Wait, isDisabled is true if ANY request exists. So "Request Sent" button is disabled.
                      // If I change text to "Received Results", it will still be disabled. That seems fine for a status indicator.

                      disabled={isDisabled}
                      variant={isSelectedVerifier ? "secondary" : "default"}
                    >
                      {isSelectedVerifier
                        ? (existingRequest?.status === 'validated' || existingRequest?.status === 'rejected' ? "Received Results" : "Request Sent")
                        : isDisabled ? "Unavailable" : "Select Verifier"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Validation Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Send for Validation</DialogTitle>
              <DialogDescription>
                Review your PDD before sending it to <strong>{selectedVerifier?.name}</strong>.
                This will also notify the correct registry ({pddData?.registry || 'Unknown'}).
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              {loadingPDD ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : pddData ? (
                <div className="border rounded-lg p-2 bg-slate-50">
                  <PDDDocument data={pddData} />
                </div>
              ) : (
                <p className="text-center text-red-500">Failed to load PDD data.</p>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSendForValidation} disabled={sending || loadingPDD}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Send Request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
