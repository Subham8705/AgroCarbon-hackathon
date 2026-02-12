import DashboardLayout from '@/components/layout/DashboardLayout';
import { Package, Users, Leaf, Send, Calendar, CheckCircle, Clock, AlertCircle, X, Shield, CreditCard } from 'lucide-react';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, Timestamp, doc, updateDoc, orderBy, limit } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { calculateCO2Estimation } from '@/lib/carbonCalculator';
import { CO2EstimationParams } from '@/types';

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
    tillage?: string;
    coverCrop?: boolean;
    trees?: number;
    yearsFollowed?: number;
  };
  claimedCredits: number;
  year: number;
}

interface VerificationRequestData {
  status: 'pending' | 'inReview' | 'verified' | 'waiting_for_payment' | 'payment_received';
  paymentAmount?: number;
  verifierName?: string;
}

interface Batch {
  id: string;
  month: string;
  monthKey: string;
  farmerCount: number;
  totalAcres: number;
  baselineTotal: number;
  projectTotal: number;
  status: 'pending' | 'pendingVerification' | 'verified' | 'action_required' | 'registry_review' | 'issued';
  requestId?: string;
  requestStatus?: VerificationRequestData['status'];
  paymentAmount?: number;
  verifierName?: string;
}

interface Verifier {
  id: string;
  name: string;
  email: string;
  organization?: string;
  phone: string;
}

const statusConfig = {
  pending: { label: 'Ready to Send', color: 'status-pending', icon: Clock },
  pendingVerification: { label: 'Awaiting Verification', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  action_required: { label: 'Action Required', color: 'bg-red-100 text-red-800', icon: AlertCircle },
  verified: { label: 'Verified', color: 'status-approved', icon: CheckCircle },
  registry_review: { label: 'Registry Review', color: 'bg-orange-100 text-orange-800', icon: Shield },
  issued: { label: 'Credits Issued', color: 'bg-green-100 text-green-800', icon: Leaf },
};

export default function CompanyBatches() {
  const { user } = useAuth();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showVerifierModal, setShowVerifierModal] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [verifiers, setVerifiers] = useState<Verifier[]>([]);
  const [selectedVerifier, setSelectedVerifier] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [preparingData, setPreparingData] = useState(false);
  const [preparedBatchData, setPreparedBatchData] = useState<{ [batchId: string]: PlotData[] }>({});

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [pddRequest, setPddRequest] = useState<any>(null); // Store PDD status

  useEffect(() => {
    fetchBatches();
    fetchPDDStatus();
  }, [user]);

  const fetchPDDStatus = async () => {
    if (!user) return;
    try {
      // Fetch the LATEST PDD request
      const q = query(
        collection(db, 'pdd_requests'),
        where('companyId', '==', user.id),
        orderBy('submittedAt', 'desc'),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const data = snap.docs[0].data();
        // Only enable if the LATEST one is valid
        if (data.status === 'registered' || data.status === 'validated') {
          setPddRequest(data);
        } else {
          setPddRequest(null);
        }
      }
    } catch (e) {
      console.error("Error fetching PDD status", e);
    }
  };

  const fetchBatches = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch accepted farmers for this company
      const q = query(
        collection(db, 'project_applications'),
        where('companyId', '==', user.id),
        where('status', '==', 'accepted')
      );

      const querySnapshot = await getDocs(q);

      // Group farmers by month
      const monthGroups: { [key: string]: any[] } = {};

      querySnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.createdAt) {
          const date = data.createdAt.toDate();
          const monthKey = format(date, 'yyyy-MM');
          const monthLabel = format(date, 'MMMM yyyy');

          if (!monthGroups[monthKey]) {
            monthGroups[monthKey] = [];
          }

          monthGroups[monthKey].push({
            ...data,
            monthLabel
          });
        }
      });

      // Create batches from groups
      const batchList: Batch[] = Object.entries(monthGroups).map(([monthKey, monthFarmers]) => {
        const totalAcres = monthFarmers.reduce((sum, f) => sum + (f.farmerAcres || 0), 0);
        const baselineTotal = monthFarmers.reduce((sum, f) => sum + (f.farmerBaseCO2 || 0), 0);
        const projectTotal = monthFarmers.reduce((sum, f) => sum + (f.farmerTotalCO2 || 0), 0);

        // Use a Set to get unique farmer count
        const uniqueFarmerCount = new Set(monthFarmers.map(f => f.farmerId)).size;

        return {
          id: monthKey,
          month: monthFarmers[0].monthLabel,
          monthKey,
          farmerCount: uniqueFarmerCount,
          totalAcres: Number(totalAcres.toFixed(1)),
          baselineTotal: Number(baselineTotal.toFixed(1)),
          projectTotal: Number(projectTotal.toFixed(1)),
          status: 'pending' as const
        };
      });

      // Sort by month (newest first)
      batchList.sort((a, b) => b.monthKey.localeCompare(a.monthKey));

      // Check for existing verification requests
      const requestsQuery = query(
        collection(db, 'verification_requests'),
        where('companyId', '==', user.id)
      );
      const requestsSnapshot = await getDocs(requestsQuery);

      // Map requests to batches
      requestsSnapshot.docs.forEach(reqDoc => {
        const reqData = reqDoc.data();
        const batch = batchList.find(b => b.monthKey === reqData.batchMonthKey);
        if (batch) {
          batch.requestId = reqDoc.id;
          batch.requestStatus = reqData.status;
          batch.paymentAmount = reqData.paymentAmount;

          // Update batch status based on request status
          if (reqData.status === 'pending') {
            batch.status = 'pendingVerification';
          } else if (reqData.status === 'waiting_for_payment') {
            batch.status = 'action_required';
          } else if (reqData.status === 'payment_received') {
            batch.status = 'pendingVerification'; // Waiting for results
          } else if (reqData.status === 'inReview' || reqData.status === 'verified') {
            batch.status = reqData.status === 'verified' ? 'verified' : 'pendingVerification';
          } else if (reqData.status === 'pending_registry_review') {
            batch.status = 'registry_review';
          } else if (reqData.status === 'issued') {
            batch.status = 'issued';
          }
        }
      });

      setBatches(batchList);
    } catch (error) {
      console.error('Error fetching batches:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVerifiers = async () => {
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'verifier'));
      const querySnapshot = await getDocs(q);

      const verifierList: Verifier[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        email: doc.data().email,
        organization: doc.data().organization,
        phone: doc.data().phone
      }));

      setVerifiers(verifierList);
    } catch (error) {
      console.error('Error fetching verifiers:', error);
    }
  };

  const handleSendForVerification = async (batch: Batch) => {
    setSelectedBatch(batch);
    setShowVerifierModal(true);
    fetchVerifiers();

    // Always prepare data to ensure fresh calculations
    await prepareBatchData(batch);
  };

  const prepareBatchData = async (batch: Batch) => {
    if (!user) return;

    setPreparingData(true);
    try {
      // Fetch all farmers for this batch with their complete data
      const farmersQuery = query(
        collection(db, 'project_applications'),
        where('companyId', '==', user.id),
        where('status', '==', 'accepted')
      );
      const farmersSnapshot = await getDocs(farmersQuery);

      // Filter farmers by batch month
      const batchFarmers = farmersSnapshot.docs.filter(doc => {
        const data = doc.data();
        if (data.createdAt) {
          const monthKey = format(data.createdAt.toDate(), 'yyyy-MM');
          return monthKey === batch.monthKey;
        }
        return false;
      });

      console.log(`Found ${batchFarmers.length} farmers for batch ${batch.monthKey}`);

      // Fetch plot data for each farmer
      const plotsData: PlotData[] = [];
      const currentYear = new Date().getFullYear();

      for (const farmerDoc of batchFarmers) {
        const farmerData = farmerDoc.data();
        console.log(`Processing farmer: ${farmerData.farmerName} (${farmerData.farmerId})`);

        // Fetch farmer's estimates
        const estimatesQuery = query(
          collection(db, 'estimates'),
          where('userId', '==', farmerData.farmerId)
        );
        const estimatesSnapshot = await getDocs(estimatesQuery);

        if (!estimatesSnapshot.empty) {
          const estimatesDocs = estimatesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          estimatesDocs.sort((a: any, b: any) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
          const latestEstimate: any = estimatesDocs[0];

          console.log('Latest estimate document:', latestEstimate.id);
          console.log('Latest estimate data:', JSON.stringify(latestEstimate, null, 2));

          // Check for polygons data in different possible formats
          let polygons = [];

          // Check for polygons array
          if (latestEstimate.polygons && Array.isArray(latestEstimate.polygons)) {
            polygons = latestEstimate.polygons;
          }
          // Check for polygonPoints array (alternative field name)
          else if (latestEstimate.polygonPoints && Array.isArray(latestEstimate.polygonPoints)) {
            polygons = latestEstimate.polygonPoints.map((point, index) => ({
              id: `polygon_${index}`,
              points: [point],
              area: latestEstimate.area || 0
            }));
          }

          console.log(`Found ${polygons.length} polygons for farmer ${farmerData.farmerId}`);

          if (polygons.length > 0) {
            for (const polygon of polygons) {
              // Try to get area from different possible locations
              let area = 0;

              if (polygon.area && polygon.area > 0) {
                area = polygon.area;
              } else if (latestEstimate.area && latestEstimate.area > 0) {
                area = latestEstimate.area;
              } else if (latestEstimate.acres && latestEstimate.acres > 0) {
                area = latestEstimate.acres;
              } else if (farmerData.farmerAcres && farmerData.farmerAcres > 0) {
                area = farmerData.farmerAcres;
              }

              // If still no area, use a default
              if (area <= 0) {
                area = 1; // Default to 1 acre
                console.warn(`Using default area of 1 acre for farmer ${farmerData.farmerId}`);
              }

              console.log(`Processing polygon with area: ${area} acres`);



              // ------------------------------------------------------------------
              // 1. Calculate Baseline (baseCarbon)
              // ------------------------------------------------------------------
              // Formula: Use stored params, default to conventional/no-cover if missing
              const baselinePractice = latestEstimate.baselinePractice || 'conventional';
              const baselineParams: CO2EstimationParams = {
                soc: latestEstimate.soc || 30,
                ndvi: latestEstimate.ndvi || 0.4,
                rainfall: latestEstimate.rainfall || 800,
                tillage: baselinePractice,
                coverCrop: false, // Baseline assumption
                trees: 0,
                yearsFollowed: latestEstimate.yearsFollowed || 0,
                acres: area
              };
              const baseResult = calculateCO2Estimation(baselineParams);
              const baseCarbon = baseResult.totalCO2;

              // ------------------------------------------------------------------
              // 2. Calculate Expected/Project (expectedCarbon)
              // ------------------------------------------------------------------
              // Formula: ENFORCE Improved Practices (No-Till + Cover Crop) as per user request
              const projectParams: CO2EstimationParams = {
                soc: latestEstimate.soc || 30,
                ndvi: latestEstimate.projectNDVI || latestEstimate.ndvi || 0.4,
                rainfall: latestEstimate.projectRainfall || latestEstimate.rainfall || 800,
                tillage: 'no-till',  // Enforce No-Till
                coverCrop: true,     // Enforce Cover Crop
                trees: latestEstimate.trees || 0,
                yearsFollowed: latestEstimate.yearsFollowed || 1,
                acres: area
              };
              const expectedResult = calculateCO2Estimation(projectParams);
              const expectedCarbon = expectedResult.totalCO2;

              // ------------------------------------------------------------------
              // 3. Update 'estimates' document if fields are missing (Persist)
              // ------------------------------------------------------------------
              if (!latestEstimate.baseCarbon || !latestEstimate.expectedCarbon) {
                // We perform this update in the background
                try {
                  const estimateRef = doc(db, 'estimates', latestEstimate.id);
                  updateDoc(estimateRef, {
                    baseCarbon: baseCarbon,
                    expectedCarbon: expectedCarbon,
                    // Allow saving these computed params to DB as "project" defaults if you like
                    projectPractice: 'no-till',
                    coverCrop: true
                  }).catch(e => console.error("Background update failed for estimate", latestEstimate.id, e));
                } catch (e) {
                  console.error("Error queueing update for estimate", latestEstimate.id);
                }
              }

              // ------------------------------------------------------------------
              // 4. Construct Plot Data
              // ------------------------------------------------------------------

              // Create simplified geometry if points exist (User's logic + GeoJSON fix)
              let geometry = null;
              if (polygon.points && Array.isArray(polygon.points) && polygon.points.length > 0) {
                // 1. Create formatted geometry for Verification Map (GeoJSON Polygon)
                const coordinates = polygon.points.map((p: any) => {
                  const lng = p.lng || p.longitude || (Array.isArray(p) ? p[1] : 0);
                  const lat = p.lat || p.latitude || (Array.isArray(p) ? p[0] : 0);
                  return [lng, lat];
                });
                // Ensure closed loop
                if (coordinates.length > 0) {
                  const first = coordinates[0];
                  const last = coordinates[coordinates.length - 1];
                  if (first[0] !== last[0] || first[1] !== last[1]) {
                    coordinates.push(first);
                  }
                }
                geometry = {
                  type: 'Polygon',
                  coordinates: [coordinates]
                };
              }

              plotsData.push({
                plotId: polygon.id || `PLOT_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                farmerId: farmerData.farmerId || '',
                farmerName: farmerData.farmerName || 'Unknown',
                areaAcres: area,
                geometry: geometry, // Send the proper GeoJSON geometry
                baseline: {
                  soc: baselineParams.soc,
                  ndvi: baselineParams.ndvi,
                  rainfall: baselineParams.rainfall,
                  practice: baselineParams.tillage,
                  carbonEstimate: baseCarbon
                },
                project: {
                  ndvi: projectParams.ndvi,
                  rainfall: projectParams.rainfall,
                  practice: 'no-till + cover crop', // Explicitly state the model
                  carbonEstimate: expectedCarbon,
                  tillage: projectParams.tillage,
                  coverCrop: projectParams.coverCrop,
                  trees: projectParams.trees,
                  yearsFollowed: projectParams.yearsFollowed
                },
                claimedCredits: Math.max(0, expectedCarbon - baseCarbon),
                year: currentYear
              });
            }
          } else {
            console.log(`No polygons found in estimate for farmer ${farmerData.farmerId}`);

            // Even without polygons, we can still create a plot with farmer's data
            const area = farmerData.farmerAcres || 1;

            // Get practice values
            const baselinePractice = 'conventional';
            const projectPractice = latestEstimate.projectPractice || 'conventional';

            // Get environmental data
            const soc = latestEstimate.soc || 30;
            const ndvi = latestEstimate.ndvi || 0.4;
            const rainfall = latestEstimate.rainfall || 800;
            const projectNDVI = latestEstimate.projectNDVI || ndvi;
            const projectRainfall = latestEstimate.projectRainfall || rainfall;

            // Calculate Baseline CO2
            const baselineParams: CO2EstimationParams = {
              soc: soc,
              ndvi: ndvi,
              rainfall: rainfall,
              tillage: 'ploughing',
              coverCrop: false,
              trees: 0,
              yearsFollowed: latestEstimate.yearsFollowed || 0,
              acres: area
            };

            const baseResult = calculateCO2Estimation(baselineParams);
            const baseCarbon = baseResult.totalCO2;

            // Calculate Project CO2 (Enforcing Standards)
            const projectParams: CO2EstimationParams = {
              soc: soc,
              ndvi: projectNDVI,
              rainfall: projectRainfall,
              tillage: 'no-till',
              coverCrop: true,
              trees: latestEstimate.trees || 0,
              yearsFollowed: latestEstimate.yearsFollowed || 1,
              acres: area
            };

            const expectedResult = calculateCO2Estimation(projectParams);
            const expectedCarbon = expectedResult.totalCO2;
            const claimedCredits = Math.max(0, expectedCarbon - baseCarbon);

            plotsData.push({
              plotId: `farmer_${farmerData.farmerId}`,
              farmerId: farmerData.farmerId || '',
              farmerName: farmerData.farmerName || 'Unknown',
              areaAcres: area,
              geometry: null,
              baseline: {
                soc: soc,
                ndvi: ndvi,
                rainfall: rainfall,
                practice: baselinePractice,
                carbonEstimate: baseCarbon
              },
              project: {
                ndvi: projectNDVI,
                rainfall: projectRainfall,
                practice: 'no-till + cover crop',
                carbonEstimate: expectedCarbon,
                tillage: projectParams.tillage,
                coverCrop: projectParams.coverCrop,
                trees: projectParams.trees,
                yearsFollowed: projectParams.yearsFollowed
              },
              claimedCredits: claimedCredits,
              year: currentYear
            });
          }
        } else {
          console.log(`No estimates found for farmer ${farmerData.farmerId}`);

          // Create basic plot even without estimate data
          const area = farmerData.farmerAcres || 1;
          const baselineResult = calculateCO2Estimation({
            soc: 30,
            ndvi: 0.4,
            rainfall: 800,
            tillage: 'ploughing',
            coverCrop: false,
            trees: 0,
            yearsFollowed: 0,
            acres: area
          });

          const projectResult = calculateCO2Estimation({
            soc: 30,
            ndvi: 0.5,
            rainfall: 850,
            tillage: 'reduced',
            coverCrop: true,
            trees: 5,
            yearsFollowed: 1,
            acres: area
          });

          plotsData.push({
            plotId: `farmer_fallback_${farmerData.farmerId}`,
            farmerId: farmerData.farmerId || '',
            farmerName: farmerData.farmerName || 'Unknown',
            areaAcres: area,
            geometry: null,
            baseline: {
              soc: 30,
              ndvi: 0.4,
              rainfall: 800,
              practice: 'ploughing',
              carbonEstimate: baselineResult.totalCO2
            },
            project: {
              ndvi: 0.5,
              rainfall: 850,
              practice: 'reduced',
              carbonEstimate: projectResult.totalCO2
            },
            claimedCredits: Math.max(0, projectResult.totalCO2 - baselineResult.totalCO2),
            year: currentYear
          });
        }
      }

      console.log(`Prepared ${plotsData.length} plots for batch ${batch.id}:`, plotsData);

      // Cache the prepared data
      setPreparedBatchData(prev => ({
        ...prev,
        [batch.id]: plotsData
      }));

      if (plotsData.length === 0) {
        console.warn('No plot data was prepared! Check the console logs above for details.');
      }

    } catch (error) {
      console.error('Error preparing batch data:', error);
      alert('Failed to prepare batch data. Please try again.');
    } finally {
      setPreparingData(false);
    }
  };

  const handleConfirmSend = async () => {
    if (!selectedVerifier || !selectedBatch || !user) return;

    // Get prepared data from cache
    const plotsData = preparedBatchData[selectedBatch.id];

    if (!plotsData || plotsData.length === 0) {
      alert('No plot data available. Please try again.');
      return;
    }

    setSending(true);
    try {
      const currentYear = new Date().getFullYear();
      const baselineYear = currentYear - 1;

      // Calculate totals from the prepared plot data
      const totalAcres = plotsData.reduce((sum, plot) => sum + plot.areaAcres, 0);
      const baselineTotal = plotsData.reduce((sum, plot) => sum + plot.baseline.carbonEstimate, 0);
      const projectTotal = plotsData.reduce((sum, plot) => sum + plot.project.carbonEstimate, 0);
      const totalCredits = plotsData.reduce((sum, plot) => sum + plot.claimedCredits, 0);

      console.log('Sending verification request with data:', {
        totalAcres,
        baselineTotal,
        projectTotal,
        totalCredits,
        plotCount: plotsData.length
      });

      // Create clean plot data preserving geometry for the Verifier Map
      const finalPlotsData = plotsData.map(plot => ({
        plotId: plot.plotId || '',
        farmerId: plot.farmerId || '',
        farmerName: plot.farmerName || '',
        areaAcres: plot.areaAcres || 0,
        // CRITICAL: Stringify geometry to avoid Firestore "Nested arrays" error
        geometry: plot.geometry ? JSON.stringify(plot.geometry) : null,
        baseline: {
          soc: plot.baseline?.soc || 0,
          ndvi: plot.baseline?.ndvi || 0,
          rainfall: plot.baseline?.rainfall || 0,
          practice: plot.baseline?.practice || 'conventional',
          carbonEstimate: plot.baseline?.carbonEstimate || 0
        },
        project: {
          ndvi: plot.project?.ndvi || 0,
          rainfall: plot.project?.rainfall || 0,
          practice: plot.project?.practice || 'improved',
          carbonEstimate: plot.project?.carbonEstimate || 0,
          tillage: plot.project?.tillage || 'no-till',
          coverCrop: plot.project?.coverCrop || true,
          trees: plot.project?.trees || 0,
          yearsFollowed: plot.project?.yearsFollowed || 1
        },
        claimedCredits: plot.claimedCredits || 0,
        year: plot.year || currentYear
      }));

      // Create verification request with clean plot data
      const requestRef = await addDoc(collection(db, 'verification_requests'), {
        companyId: user.id || '',
        companyName: user.name || '',
        verifierId: selectedVerifier,
        batchMonth: selectedBatch.month || '',
        batchMonthKey: selectedBatch.monthKey || '',
        farmerCount: selectedBatch.farmerCount || 0,
        totalAcres: totalAcres,
        baselineTotal: baselineTotal,
        projectTotal: projectTotal,
        totalCredits: totalCredits,
        plotsData: finalPlotsData,
        baselineYear: baselineYear,
        projectYear: currentYear,
        status: 'pending',
        paymentAmount: totalCredits * 10,
        paymentStatus: 'pending',
        registryProjectId: pddRequest?.registryProjectId || 'PENDING',
        registryName: pddRequest?.registryName || 'Unknown', // Pass registry info
        pddDocumentUrl: pddRequest?.documentUrl || null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      console.log('Verification request created with ID:', requestRef.id);

      // Close modal and refresh
      setShowVerifierModal(false);
      setSelectedBatch(null);
      setSelectedVerifier(null);

      // Show success message
      alert('Verification request sent successfully!');

      // Refresh batches
      fetchBatches();
    } catch (error) {
      console.error('Error sending verification request:', error);
      alert('Failed to send verification request: ' + (error as Error).message);
    } finally {
      setSending(false);
    }
  };

  const handleProceedPayment = (batch: Batch) => {
    setSelectedBatch(batch);
    setShowPaymentModal(true);
    setShowPaymentSuccess(false);
  };

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => {
        resolve(true);
      };
      script.onerror = () => {
        resolve(false);
      };
      document.body.appendChild(script);
    });
  };

  const handleMakePayment = async () => {
    if (!selectedBatch || !selectedBatch.requestId) return;

    setProcessingPayment(true);

    const res = await loadRazorpay();

    if (!res) {
      alert('Razorpay SDK failed to load. Are you online?');
      setProcessingPayment(false);
      return;
    }

    // Create a dummy order or just use client-side options for testing
    // In production, you should create an order on your backend

    const RAZORPAY_KEY = "rzp_test_S9MkFiLaZYEigi";



    const options = {
      key: RAZORPAY_KEY,
      amount: (selectedBatch.paymentAmount || 5000) * 100, // Amount in paise
      currency: "INR",
      name: "AgroCarbon Verification",
      description: `Verification for Batch ${selectedBatch.month}`,
      image: "https://your-logo-url.com/logo.png", // Optional
      handler: async function (response: any) {
        // Payment Success
        // Verify payment signature on backend in production
        try {
          await updateDoc(doc(db, 'verification_requests', selectedBatch.requestId!), {
            status: 'payment_received',
            paymentStatus: 'paid',
            razorpayPaymentId: response.razorpay_payment_id,
            updatedAt: Timestamp.now()
          });

          setProcessingPayment(false);
          setShowPaymentSuccess(true);
          fetchBatches(); // Refresh UI
        } catch (error) {
          console.error("Payment status update error", error);
          alert("Payment successful but status update failed.");
          setProcessingPayment(false);
        }
      },
      prefill: {
        name: user?.name || "Company Name",
        email: user?.email || "email@example.com",
        contact: user?.phone || "9999999999"
      },
      notes: {
        address: "AgroCarbon Corporate Office"
      },
      theme: {
        color: "#16a34a"
      },
      modal: {
        ondismiss: function () {
          setProcessingPayment(false);
        }
      }
    };

    const paymentObject = new (window as any).Razorpay(options);
    paymentObject.open();
  };

  return (
    <DashboardLayout role="company">
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-3xl font-display font-bold text-foreground">Batch View</h1>
          <p className="text-muted-foreground mt-1">Monthly grouped batches for verification</p>
        </div>

        {/* Info Banner */}
        <div className="card-elevated p-4 border-l-4 border-l-primary animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-start gap-3">
            <Package className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-foreground">
              Batches are automatically grouped by the month farmers joined. Send batches to verifiers for carbon credit verification.
            </p>
          </div>
        </div>

        {/* Batch Cards */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : batches.length === 0 ? (
          <div className="card-elevated p-12 text-center">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground">No Batches Yet</h3>
            <p className="text-muted-foreground">Batches will appear here once farmers join your projects.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {batches.map((batch, index) => {
              const config = statusConfig[batch.status] || statusConfig.pending;
              const StatusIcon = config.icon;

              return (
                <div
                  key={batch.id}
                  className="card-elevated overflow-hidden animate-fade-in"
                  style={{ animationDelay: `${0.2 + index * 0.1}s` }}
                >
                  {/* Batch Header */}
                  <div className="p-4 bg-muted/50 border-b border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-primary" />
                        <h3 className="font-display font-bold text-foreground">{batch.month}</h3>
                      </div>
                      <span className={`status-badge ${config.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {config.label}
                      </span>
                    </div>
                  </div>

                  {/* Batch Stats */}
                  <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                          <Users className="w-4 h-4" />
                          Farmers
                        </div>
                        <div className="text-2xl font-bold text-foreground">{batch.farmerCount}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-sm mb-1">Total Acres</div>
                        <div className="text-2xl font-bold text-foreground">{batch.totalAcres.toFixed(1)}</div>
                      </div>
                    </div>

                    <div className="h-px bg-border" />

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-muted-foreground text-sm mb-1">Baseline Est.</div>
                        <div className="text-lg font-semibold text-muted-foreground">{batch.baselineTotal.toFixed(1)} tCO₂</div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 text-primary text-sm mb-1">
                          <Leaf className="w-4 h-4" />
                          Project Est.
                        </div>
                        <div className="text-lg font-semibold text-primary">{batch.projectTotal.toFixed(1)} tCO₂</div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    {batch.status === 'pending' && (
                      <button
                        onClick={() => handleSendForVerification(batch)}
                        className="btn-primary w-full gap-2 mt-4"
                      >
                        <Send className="w-5 h-5" />
                        Send for Verification
                      </button>
                    )}

                    {batch.status === 'pendingVerification' && batch.requestStatus === 'pending' && (
                      <button className="btn-secondary w-full gap-2 mt-4" disabled>
                        <Clock className="w-5 h-5" />
                        Waiting for response
                      </button>
                    )}

                    {batch.status === 'action_required' && batch.requestStatus === 'waiting_for_payment' && (
                      <button
                        onClick={() => handleProceedPayment(batch)}
                        className="btn-primary w-full gap-2 mt-4 bg-green-600 hover:bg-green-700"
                      >
                        <CreditCard className="w-5 h-5" />
                        Proceed to Payment
                      </button>
                    )}

                    {batch.status === 'pendingVerification' && batch.requestStatus === 'payment_received' && (
                      <button className="btn-secondary w-full gap-2 mt-4" disabled>
                        <Clock className="w-5 h-5" />
                        Waiting for Results
                      </button>
                    )}

                    {batch.status === 'verified' && (
                      <button className="btn-secondary w-full gap-2 mt-4 bg-green-50 text-green-700 border-green-200" disabled>
                        <CheckCircle className="w-5 h-5" />
                        Received Results
                      </button>
                    )}

                    {batch.status === 'issued' && (
                      <button
                        onClick={() => window.location.href = '/company/credits'}
                        className="btn-secondary w-full gap-2 mt-4 bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                      >
                        <Leaf className="w-5 h-5" />
                        View Credits
                      </button>
                    )}

                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Verifier Selection Modal */}
        {showVerifierModal && selectedBatch && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
            onClick={() => !sending && setShowVerifierModal(false)}
          >
            <div
              className="bg-background rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-border">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Select Verifier</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Batch: {selectedBatch.month} • {selectedBatch.farmerCount} farmers
                  </p>
                </div>
                <button
                  onClick={() => !sending && setShowVerifierModal(false)}
                  disabled={sending}
                  className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {/* Modal Content - Scrollable */}
              <div className="flex-1 overflow-y-auto p-6">
                {preparingData ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <h4 className="text-lg font-medium text-foreground">Preparing Data...</h4>
                    <p className="text-muted-foreground">Getting plot data ready for verification</p>
                  </div>
                ) : verifiers.length === 0 ? (
                  <div className="text-center py-12">
                    <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h4 className="text-lg font-medium text-foreground">No Verifiers Available</h4>
                    <p className="text-muted-foreground">No registered verifiers found in the system.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {verifiers.map((verifier) => (
                      <div
                        key={verifier.id}
                        onClick={() => !sending && setSelectedVerifier(verifier.id)}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${selectedVerifier === verifier.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                          } ${sending ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg gradient-verifier flex items-center justify-center shrink-0">
                              <Shield className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-foreground">{verifier.name}</h4>
                              {verifier.organization && (
                                <p className="text-sm text-muted-foreground">{verifier.organization}</p>
                              )}
                              <p className="text-sm text-muted-foreground mt-1">{verifier.email}</p>
                              <p className="text-sm text-muted-foreground">{verifier.phone}</p>
                            </div>
                          </div>
                          {selectedVerifier === verifier.id && (
                            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                              <CheckCircle className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-border">
                <div className="flex gap-3">
                  <button
                    onClick={() => !sending && setShowVerifierModal(false)}
                    disabled={sending}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmSend}
                    disabled={!selectedVerifier || sending || preparingData}
                    className="btn-primary flex-1 gap-2 disabled:opacity-50"
                  >
                    {sending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Sending...
                      </>
                    ) : preparingData ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Loading Data...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Send Request
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payment Confirmation Modal */}
        {showPaymentModal && selectedBatch && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
            onClick={() => !processingPayment && !showPaymentSuccess && setShowPaymentModal(false)}
          >
            <div
              className="bg-background rounded-xl shadow-2xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              {!showPaymentSuccess ? (
                <>
                  <h3 className="text-xl font-display font-bold text-foreground mb-4">Payment for Verification</h3>
                  <div className="space-y-4 mb-6">
                    <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Verifier</span>
                        <span className="font-medium text-foreground">Verifier Corp</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Batch</span>
                        <span className="font-medium text-foreground">{selectedBatch.month}</span>
                      </div>
                      <div className="pt-2 border-t border-border flex justify-between items-center">
                        <span className="text-base font-medium text-foreground">Amount Due</span>
                        <span className="text-xl font-bold text-primary">₹ {selectedBatch.paymentAmount}</span>
                      </div>
                    </div>

                    <div className="text-sm text-blue-600 bg-blue-50 p-3 rounded border border-blue-200">
                      <p className="font-medium">Secure Payment via Razorpay</p>
                      <p>You will be redirected to the secure payment gateway.</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowPaymentModal(false)}
                      disabled={processingPayment}
                      className="btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleMakePayment}
                      disabled={processingPayment}
                      className="btn-primary flex-1 gap-2"
                    >
                      {processingPayment ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Processing...
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4" />
                          Pay Now
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-6">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-10 h-10 text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">Payment Successful!</h3>
                  <p className="text-muted-foreground mb-6">
                    Verified has been notified. Results will be available soon.
                  </p>
                  <button
                    onClick={() => {
                      setShowPaymentModal(false);
                      setShowPaymentSuccess(false);
                    }}
                    className="btn-primary w-full"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}