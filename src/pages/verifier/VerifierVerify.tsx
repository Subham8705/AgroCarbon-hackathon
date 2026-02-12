import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MapContainer, TileLayer, Polygon, Popup, useMap } from 'react-leaflet';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { MapPin, Save, Check, ArrowLeft, Leaf, Loader2, DollarSign, Send } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

interface PlotData {
  plotId: string;
  farmerId: string;
  farmerName: string;
  areaAcres: number;
  geometry: any;
  baseline: {
    soc: number;
    ndvi: number;
    rainfall: number;
    practice: string;
    carbonEstimate: number;
  };
  project: {
    ndvi: number;
    rainfall: number;
    practice: string;
    carbonEstimate: number;
  };
  claimedCredits: number;
  year: number;
}

interface VerificationRequest {
  id: string;
  companyName: string;
  batchMonth: string;
  plotsData: PlotData[];
  status: string;
  paymentStatus?: 'pending' | 'requested' | 'paid';
  paymentAmount?: number;
  totalAcres?: number;
}

function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export default function VerifierVerify() {
  const navigate = useNavigate();
  const { id: requestId } = useParams();
  const [request, setRequest] = useState<VerificationRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifiedCredits, setVerifiedCredits] = useState<Record<string, number>>({});
  const [verifiedPractices, setVerifiedPractices] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [highlightedPlotId, setHighlightedPlotId] = useState<string | null>(null);

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [sendingPaymentRequest, setSendingPaymentRequest] = useState(false);

  useEffect(() => {
    fetchVerificationRequest();
  }, [requestId]);

  const fetchVerificationRequest = async () => {
    if (!requestId) return;

    setLoading(true);
    try {
      const docRef = doc(db, 'verification_requests', requestId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const requestData: VerificationRequest = {
          id: docSnap.id,
          companyName: data.companyName || '',
          batchMonth: data.batchMonth || '',
          plotsData: (data.plotsData || []).map((plot: any) => ({
            ...plot,
            // Parse geometry if it's a string (fix for Firestore nested array limitation)
            geometry: typeof plot.geometry === 'string' ? JSON.parse(plot.geometry) : plot.geometry
          })),
          status: data.status || 'pending',
          paymentStatus: data.paymentStatus || 'pending',
          paymentAmount: data.paymentAmount || 0,
          totalAcres: data.totalAcres || 0,
        };

        setRequest(requestData);

        // Initialize verified credits and practices
        const initialCredits: Record<string, number> = data.verifiedCredits || {};
        const initialPractices: Record<string, string> = {};

        requestData.plotsData.forEach(plot => {
          initialPractices[plot.plotId] = plot.project?.practice || 'Conventional';
        });

        setVerifiedCredits(initialCredits);
        setVerifiedPractices(initialPractices);

      } else {
        alert('Verification request not found');
        navigate('/verifier/requests');
      }
    } catch (error) {
      console.error('Error fetching verification request:', error);
      alert('Failed to load verification request');
    } finally {
      setLoading(false);
    }
  };

  const handleCreditChange = (plotId: string, value: number) => {
    // Prevent negative values
    const safeValue = isNaN(value) ? 0 : Math.max(0, value);
    setVerifiedCredits({ ...verifiedCredits, [plotId]: safeValue });
  };

  const handlePracticeChange = (plotId: string, value: string) => {
    setVerifiedPractices({ ...verifiedPractices, [plotId]: value });
  };

  const getUpdatedPlotsData = () => {
    if (!request) return [];
    return request.plotsData.map(plot => {
      // Firestore cannot handle nested arrays (like GeoJSON coordinates [[x,y]]). 
      // We must ensure geometry is stringified before saving.
      const geometryToSave = typeof plot.geometry === 'object' ? JSON.stringify(plot.geometry) : (plot.geometry || null);

      return {
        ...plot,
        geometry: geometryToSave,
        project: {
          ...plot.project,
          practice: verifiedPractices[plot.plotId] || plot.project.practice || 'Conventional'
        }
      };
    });
  };

  const handleRequestPayment = async () => {
    if (!requestId || !paymentAmount) return;

    setSendingPaymentRequest(true);
    try {
      const docRef = doc(db, 'verification_requests', requestId);
      await updateDoc(docRef, {
        paymentStatus: 'requested',
        paymentAmount: Number(paymentAmount),
        status: 'waiting_for_payment' // Update main status to reflect flow
      });

      setShowPaymentModal(false);
      // Refresh local state
      fetchVerificationRequest();
    } catch (error) {
      console.error('Error requesting payment:', error);
      alert('Failed to request payment');
    } finally {
      setSendingPaymentRequest(false);
    }
  };

  const handleSubmitToRegistry = async () => {
    if (!requestId) return;
    if (!window.confirm("Are you sure you want to submit this verified draft to the Registry for issuance?")) return;

    setIsSubmitting(true);
    try {
      const docRef = doc(db, 'verification_requests', requestId);
      await updateDoc(docRef, {
        status: 'pending_registry_review',
        submittedToRegistryAt: new Date(),
        // Ensure latest practices are saved
        plotsData: getUpdatedPlotsData(),
        verifiedCredits: verifiedCredits
      });
      alert('Submitted to Registry for Issuance');
      navigate('/verifier/requests');
    } catch (error) {
      console.error('Error submitting to registry:', error);
      alert(`Failed to submit to registry: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSave = async () => {
    if (!requestId) return;
    setIsSubmitting(true);
    try {
      const docRef = doc(db, 'verification_requests', requestId);
      await updateDoc(docRef, {
        verifiedCredits: verifiedCredits,
        plotsData: getUpdatedPlotsData()
      });
      alert('Progress saved');
    } catch (error) {
      console.error('Error saving:', error);
      alert('Failed to save');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendResults = async () => {
    if (!requestId) return;

    if (!window.confirm("Are you sure you want to send the results? This cannot be undone.")) return;

    setIsSubmitting(true);
    try {
      const docRef = doc(db, 'verification_requests', requestId);
      await updateDoc(docRef, {
        status: 'pending_registry_review', // Send directly to registry
        verifiedCredits: verifiedCredits,
        plotsData: getUpdatedPlotsData(),
        verifiedAt: new Date(),
        submittedToRegistryAt: new Date()
      });

      setSubmitted(true);
    } catch (error) {
      console.error('Error submitting verification:', error);
      alert('Failed to submit verification');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalVerified = Object.values(verifiedCredits).reduce((sum, val) => sum + val, 0);

  // Extract center point for map
  const getMapCenter = (): [number, number] => {
    if (request?.plotsData && request.plotsData.length > 0) {
      // Try to find the highlighted plot first
      const targetPlot = highlightedPlotId
        ? request.plotsData.find(p => p.plotId === highlightedPlotId)
        : request.plotsData[0];

      if (targetPlot?.geometry?.coordinates?.[0]?.[0]) {
        // GeoJSON is [lon, lat], Leaflet needs [lat, lon]
        const p = targetPlot.geometry.coordinates[0][0];
        return [p[1], p[0]];
      }
    }
    return [20.5937, 78.9629]; // India Center
  };

  if (loading) {
    return (
      <DashboardLayout role="verifier">
        <div className="flex justify-center items-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (submitted) {
    return (
      <DashboardLayout role="verifier">
        <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
          <div className="text-center animate-fade-in">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-display font-bold text-foreground mb-2">Results Sent!</h2>
            <p className="text-muted-foreground mb-6">
              The verified credits have been sent to the project.
            </p>
            <button onClick={() => navigate('/verifier/requests')} className="btn-primary gap-2">
              <ArrowLeft className="w-5 h-5" />
              Back to Requests
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!request) return null;

  const isPaymentReceived = request.paymentStatus === 'paid' || request.status === 'payment_received';
  // Allow editing if payment is received and not yet fully verified/submitted
  const canEdit = isPaymentReceived && request.status !== 'verified';

  // Prepare map data safely
  const validPlots = request.plotsData.filter(plot =>
    plot.geometry?.coordinates?.[0] && plot.geometry.coordinates[0].length > 0
  );

  return (
    <DashboardLayout role="verifier">
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 animate-fade-in">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">
              {isPaymentReceived ? 'Enter Verification Results' : 'Review Farm Details'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {request.companyName} • {request.batchMonth}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Map Section */}
          <div className="card-elevated overflow-hidden animate-fade-in h-[600px] flex flex-col" style={{ animationDelay: '0.1s' }}>
            <div className="p-4 border-b border-border">
              <h3 className="font-display font-bold text-foreground flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                Plot Locations
              </h3>
            </div>
            <div className="flex-1 relative">
              <MapContainer
                center={getMapCenter()}
                zoom={14}
                className="h-full w-full"
                scrollWheelZoom={true}
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapController center={getMapCenter()} zoom={16} />

                {validPlots.map((plot) => {
                  const positions = plot.geometry.coordinates[0].map((c: any) => [c[1], c[0]] as [number, number]);
                  const isHighlighted = highlightedPlotId === plot.plotId;
                  const pathOptions = {
                    color: isHighlighted ? 'blue' : 'red',
                    fillColor: isHighlighted ? 'blue' : 'red',
                    fillOpacity: 0.4,
                    weight: 2
                  };

                  return (
                    <Polygon
                      key={plot.plotId}
                      positions={positions}
                      pathOptions={pathOptions}
                      eventHandlers={{
                        click: () => setHighlightedPlotId(plot.plotId)
                      }}
                    >
                      <Popup>
                        <div className="p-2">
                          <h4 className="font-bold">{plot.plotId}</h4>
                          <p className="text-sm">Farmer: {plot.farmerName}</p>
                          <p className="text-sm">Area: {plot.areaAcres.toFixed(2)} acres</p>
                          <p className="text-sm">Practice: {verifiedPractices[plot.plotId] || plot.project.practice}</p>
                        </div>
                      </Popup>
                    </Polygon>
                  );
                })}
              </MapContainer>
            </div>
          </div>

          {/* Table Section */}
          <div className="card-elevated overflow-hidden animate-fade-in flex flex-col h-[600px]" style={{ animationDelay: '0.2s' }}>
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/20">
              <h3 className="font-display font-bold text-foreground flex items-center gap-2">
                <Leaf className="w-5 h-5 text-primary" />
                Plot Details
              </h3>
            </div>

            <div className="flex-1 overflow-auto p-0">
              <table className="w-full relative">
                <thead className="sticky top-0 bg-background shadow-sm z-10">
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground w-[100px]">Plot ID</th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground w-[100px]">View</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Farming Method</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Baseline</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Credits</th>
                    {isPaymentReceived && (
                      <th className="text-right px-4 py-3 text-sm font-medium text-primary w-[140px]">Verified Output</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {request.plotsData.map((plot) => (
                    <tr
                      key={plot.plotId}
                      className={`hover:bg-muted/30 transition-colors ${highlightedPlotId === plot.plotId ? 'bg-primary/5' : ''}`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-foreground truncate max-w-[100px]" title={plot.plotId}>
                        {plot.plotId}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setHighlightedPlotId(plot.plotId)}
                          className="text-xs px-2 py-1 rounded border border-primary/20 text-primary hover:bg-primary/10 transition-colors whitespace-nowrap"
                        >
                          Map
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {isPaymentReceived ? (
                          <select
                            className="w-full px-2 py-1 text-xs border rounded bg-background"
                            value={verifiedPractices[plot.plotId] || ''}
                            onChange={(e) => handlePracticeChange(plot.plotId, e.target.value)}
                            disabled={!canEdit}
                          >
                            <option value="Conventional">Conventional</option>
                            <option value="Cover Crops">Cover Crops</option>
                            <option value="No-Till">No-Till</option>
                            <option value="Agroforestry">Agroforestry</option>
                            <option value="Organic">Organic</option>
                            <option value="Regenerative">Regenerative</option>
                          </select>
                        ) : (
                          <span className="text-muted-foreground">{plot.project.practice}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-muted-foreground">
                        {plot.baseline?.carbonEstimate?.toFixed(2) || '0.00'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-muted-foreground">
                        {plot.project?.carbonEstimate?.toFixed(2) || '0.00'}
                      </td>
                      {isPaymentReceived && (
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            min="0"
                            className="w-full px-2 py-1 text-sm text-right border rounded focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                            placeholder="0.00"
                            value={verifiedCredits[plot.plotId] || ''}
                            onChange={(e) => handleCreditChange(plot.plotId, parseFloat(e.target.value))}
                            disabled={!canEdit}
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-border bg-muted/10">
              {!isPaymentReceived ? (
                (request.paymentStatus === 'requested' || request.status === 'waiting_for_payment') ? (
                  <button
                    disabled
                    className="btn-secondary w-full justify-center h-12 text-base gap-2 opacity-70 cursor-not-allowed"
                  >
                    <Check className="w-5 h-5" />
                    Payment Request Sent
                  </button>
                ) : (
                  <button
                    onClick={() => setShowPaymentModal(true)}
                    className="btn-primary w-full justify-center h-12 text-base gap-2"
                  >
                    {/* <DollarSign className="w-5 h-5" /> */}
                    Accept and Request Payment
                  </button>
                )
              ) : request.status === 'pending_registry_review' ? (
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <div className="flex items-center justify-center gap-2 text-primary font-bold mb-1">
                    <Check className="w-5 h-5" />
                    Submitted to Registry
                  </div>
                  <p className="text-sm text-muted-foreground">Waiting for Registry approval and issuance.</p>
                </div>
              ) : request.status === 'verified' ? (
                // This state might not be reached if we move to pending_registry_review immediately, 
                // but keeping for backward compatibility if "Send Results" meant "Verify Locally"
                <div className="space-y-4">
                  <div className="flex justify-between items-center px-2">
                    <span className="text-sm text-muted-foreground">Total Verified:</span>
                    <span className="text-xl font-bold text-primary">{totalVerified.toFixed(2)} tCO₂</span>
                  </div>
                  <button
                    onClick={handleSubmitToRegistry}
                    disabled={isSubmitting}
                    className="btn-primary w-full justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Submit to Registry
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center px-2">
                    <span className="text-sm text-muted-foreground">Total Verified:</span>
                    <span className="text-xl font-bold text-primary">{totalVerified.toFixed(2)} tCO₂</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleSave}
                      disabled={isSubmitting}
                      className="btn-secondary justify-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      Save Draft
                    </button>
                    <button
                      onClick={handleSendResults}
                      disabled={isSubmitting}
                      className="btn-primary justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Finalize & Submit to Registry
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Payment Request Modal */}
        {showPaymentModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-background rounded-xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
              <h3 className="text-xl font-display font-bold text-foreground mb-4">Verification Department</h3>

              <div className="space-y-4 mb-6">
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Project:</span>
                    <span className="font-medium">{request.companyName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Acres:</span>
                    <span className="font-medium">{request.totalAcres?.toFixed(2)} acres</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Enter your amount (Rs.)
                  </label>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="e.g. 50000"
                    className="input-field w-full text-lg"
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRequestPayment}
                  disabled={!paymentAmount || sendingPaymentRequest}
                  className="btn-primary flex-1 gap-2"
                >
                  {sendingPaymentRequest ? 'Sending...' : 'Send Request for Payment'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
