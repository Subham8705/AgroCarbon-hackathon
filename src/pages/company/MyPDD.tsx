import DashboardLayout from '@/components/layout/DashboardLayout';
import PDDDocument from '@/components/pdd/PDDDocument';
import { Button } from '@/components/ui/button';
import { Loader2, Send } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { calculateCO2Estimation } from '@/lib/carbonCalculator';
import { CO2EstimationParams } from '@/types';

export default function MyPDD() {
    const { user } = useAuth();
    const location = useLocation();
    const [loading, setLoading] = useState(true);
    const [projectStats, setProjectStats] = useState({
        totalFarmers: 0,
        totalAcres: 0,
        estimatedCO2: 0,
        region: 'India'
    });
    const [pddRequest, setPddRequest] = useState<any>(null);
    const [plotsData, setPlotsData] = useState<any[]>([]);

    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (user?.id) {
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
                const currentYear = new Date().getFullYear();

                // 2. Process each farmer to get their detailed plot data
                for (const d of snapshotFarmers.docs) {
                    const data = d.data();
                    farmersCount++;
                    acresCount += (data.farmerAcres || 0);
                    co2Count += (data.farmerTotalCO2 || 0);

                    // Fetch estimates for this farmer to get plot details
                    const qEstimates = query(
                        collection(db, 'estimates'),
                        where('userId', '==', data.farmerId)
                    );
                    const snapshotEstimates = await getDocs(qEstimates);

                    if (!snapshotEstimates.empty) {
                        // Sort by newest
                        const estimatesDocs = snapshotEstimates.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                        estimatesDocs.sort((a: any, b: any) => (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0) - (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0));
                        const latestEstimate: any = estimatesDocs[0];

                        // Determine polygons
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

                                // Recalculate or use stored values
                                const baselinePractice = latestEstimate.baselinePractice || 'ploughing';
                                const projectPractice = 'no-till + cover crop'; // As per standard project rules

                                // Baseline Params
                                const baselineParams: CO2EstimationParams = {
                                    soc: latestEstimate.soc || 30,
                                    ndvi: latestEstimate.ndvi || 0.4,
                                    rainfall: latestEstimate.rainfall || 800,
                                    tillage: (baselinePractice === 'conventional' ? 'ploughing' : baselinePractice) as any,
                                    coverCrop: false,
                                    trees: 0,
                                    yearsFollowed: 0,
                                    acres: area
                                };
                                const baseResult = calculateCO2Estimation(baselineParams);

                                // Project Params
                                const projectParams: CO2EstimationParams = {
                                    soc: latestEstimate.soc || 30,
                                    ndvi: latestEstimate.projectNDVI || latestEstimate.ndvi || 0.4,
                                    rainfall: latestEstimate.projectRainfall || latestEstimate.rainfall || 800,
                                    tillage: 'no-till',
                                    coverCrop: true,
                                    trees: latestEstimate.trees || 0,
                                    yearsFollowed: 1,
                                    acres: area
                                };
                                const projectResult = calculateCO2Estimation(projectParams);

                                fetchedPlots.push({
                                    plotId: polygon.id || `PLOT-${Math.random().toString(36).substr(2, 5)}`,
                                    farmerName: data.farmerName || 'Unknown',
                                    areaAcres: area,
                                    baseline: {
                                        practice: baselinePractice,
                                        carbonEstimate: baseResult.totalCO2
                                    },
                                    project: {
                                        practice: projectPractice,
                                        carbonEstimate: projectResult.totalCO2
                                    }
                                });
                            });
                        } else {
                            // Fallback: One plot per farmer if no polygons found
                            const area = data.farmerAcres || 1;
                            const baseResult = calculateCO2Estimation({
                                soc: 30, ndvi: 0.4, rainfall: 800, tillage: 'ploughing', coverCrop: false, trees: 0, yearsFollowed: 0, acres: area
                            });
                            const projectResult = calculateCO2Estimation({
                                soc: 30, ndvi: 0.5, rainfall: 850, tillage: 'no-till', coverCrop: true, trees: 0, yearsFollowed: 1, acres: area
                            });

                            fetchedPlots.push({
                                plotId: `FARMER-${data.farmerId.substr(0, 4)}`,
                                farmerName: data.farmerName,
                                areaAcres: area,
                                baseline: { practice: 'conventional', carbonEstimate: baseResult.totalCO2 },
                                project: { practice: 'no-till + cover crop', carbonEstimate: projectResult.totalCO2 }
                            });
                        }
                    } else {
                        // Fallback logic if no estimate doc found at all
                        const area = data.farmerAcres || 1;
                        fetchedPlots.push({
                            plotId: `FARMER-${data.farmerId.substr(0, 4)}`,
                            farmerName: data.farmerName,
                            areaAcres: area,
                            baseline: { practice: 'conventional', carbonEstimate: area * 0.2 }, // Rough estimate
                            project: { practice: 'improved', carbonEstimate: area * 1.5 }
                        });
                    }
                }

                setPlotsData(fetchedPlots);
                setProjectStats({
                    totalFarmers: farmersCount,
                    totalAcres: acresCount,
                    estimatedCO2: co2Count,
                    region: (user as any)?.location || 'Telangana, India'
                });

                // Fetch PDD Request Status
                const qPDD = query(
                    collection(db, 'pdd_requests'),
                    where('companyId', '==', user.id)
                );
                const snapshotPDD = await getDocs(qPDD);
                if (!snapshotPDD.empty) {
                    setPddRequest(snapshotPDD.docs[0].data());
                }
            }
        } catch (error) {
            console.error("Error fetching project data:", error);
        } finally {
            setLoading(false);
        }
    };

    const pddData = {
        companyName: (user as any)?.companyName || user?.name || 'AgroCarbon Project',
        region: projectStats.region,
        startDate: user?.createdAt,
        totalFarmers: projectStats.totalFarmers,
        totalAcres: projectStats.totalAcres,
        estimatedCO2: projectStats.estimatedCO2,
        projectId: pddRequest?.registryProjectId || '(pending)',
        registry: pddRequest?.registryName || (location.state as any)?.targetRegistry || 'Not Selected',
        plots: plotsData
    };

    const contentRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        contentRef: contentRef,
        documentTitle: `PDD_${(user as any)?.companyName || 'Project'}_${new Date().toISOString().split('T')[0]}`,
    });

    return (
        <DashboardLayout role="company">
            <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6 animate-fade-in">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-display font-bold text-foreground">My Project Design Document 📄</h1>
                        <p className="text-muted-foreground">View your auto-generated PDD based on real-time project metrics.</p>
                    </div>
                    <Button variant="outline" className="gap-2" onClick={() => handlePrint()}>
                        <Send className="w-4 h-4" /> Export PDF
                    </Button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <div ref={contentRef}>
                        <Card className="print:border-none print:shadow-none">
                            <CardHeader className="pb-4 print:hidden">
                                <CardTitle>Digital Twin Content</CardTitle>
                                <CardDescription>This document is updated in real-time as you enroll more farmers.</CardDescription>
                            </CardHeader>
                            <CardContent className="print:p-0">
                                <PDDDocument data={pddData} />
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
