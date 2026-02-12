import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, useMap } from 'react-leaflet';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { CO2EstimationResult } from '@/lib/carbonCalculator';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

import {
  Loader2,
  Check,
  AlertCircle,
  Info,
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);

  return null;
}

interface FarmPolygon {
  id: string;
  points: [number, number][];
}

// Helper to calc centroid
function getPolygonCentroid(points: [number, number][]): [number, number] {
  if (points.length === 0) return [0, 0];
  let latSum = 0, lngSum = 0;
  points.forEach(p => { latSum += p[0]; lngSum += p[1]; });
  return [latSum / points.length, lngSum / points.length];
}

export default function FarmerEstimate() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<CO2EstimationResult | null>(null);
  const [polygons, setPolygons] = useState<FarmPolygon[]>([]);
  const [mapCenter, setMapCenter] = useState<[number, number]>([20.5937, 78.9629]);
  const [envData, setEnvData] = useState({ soc: 0, ndvi: 0, rainfall: 0 });

  // Fetch only
  useEffect(() => {
    const fetchEstimate = async () => {
      if (!user) return;
      try {
        const q = query(collection(db, 'estimates'), where('userId', '==', user.id));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
          // Sort by newly created
          docs.sort((a, b) => {
            const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return tB - tA;
          });
          const docData = docs[0];

          setEnvData({
            soc: docData.soc || 0,
            ndvi: docData.ndvi || 0,
            rainfall: docData.rainfall || 0
          });

          if (docData.totalCO2) {
            setResult({
              totalCO2: docData.totalCO2,
              isEligible: docData.isEligible,
              baseGain: docData.baseGain,
              ndviBonus: docData.ndviBonus,
              rainfallBonus: docData.rainfallBonus,
              tillageBonus: docData.tillageBonus,
              coverCropBonus: docData.coverCropBonus,
              treeBonus: docData.treeBonus,
              yearFactor: docData.yearFactor,
              totalPerAcre: docData.totalPerAcre,
              totalPerHectare: docData.totalPerHectare,
            });
          }

          if (docData.polygons && docData.polygons.length > 0) {
            const loadedPolygons = docData.polygons.map((poly: any) => ({
              id: poly.id || 'id',
              points: poly.points.map((p: any) => [p.lat, p.lng] as [number, number])
            }));
            setPolygons(loadedPolygons);
            if (loadedPolygons.length > 0) {
              setMapCenter(getPolygonCentroid(loadedPolygons[0].points));
            }
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchEstimate();
  }, [user]);

  if (loading) {
    return (
      <DashboardLayout role="farmer">
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!result) {
    return (
      <DashboardLayout role="farmer">
        <div className="p-8 flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold">No Estimate Found</h2>
          <p className="text-muted-foreground max-w-md">
            You haven't set up your farm details yet. Please go to the Dashboard to draw your farm boundaries and estimate your carbon credits.
          </p>
          <Link to="/farmer/dashboard" className="btn-primary">
            Go to Dashboard
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="farmer">
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">CO₂ Estimate Result</h1>
            <p className="text-muted-foreground mt-1">Current estimation based on your dashboard profile</p>
          </div>
          <Link to="/farmer/dashboard" className="btn-secondary gap-2">
            Edit in Dashboard
          </Link>
        </div>

        {/* Result Card */}
        <div className="card-elevated overflow-hidden animate-fade-in">
          <div className={`p-6 ${result.isEligible ? 'gradient-farmer' : 'bg-destructive'} text-white`}>
            <div className="flex items-center gap-3 mb-4">
              {result.isEligible ? (
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <Check className="w-6 h-6" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6" />
                </div>
              )}
              <div>
                <div className="text-sm opacity-80">Estimated CO₂ Stored Per Year</div>
                <div className="text-4xl font-bold">{result.totalCO2.toFixed(2)} tCO₂</div>
              </div>
            </div>
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${result.isEligible ? 'bg-white/20' : 'bg-white/20'
              }`}>
              {result.isEligible ? '✅ Eligible for Projects' : '❌ Low Potential'}
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Text Breakdown */}
            <div className="space-y-4">
              {/* Environmental Data Display */}
              <div className="p-4 bg-secondary/50 rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">
                    Auto-fetched Environmental Data (Centroid)
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">{envData.soc}</div>
                    <div className="text-xs text-muted-foreground">SOC (g/kg)</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">{envData.ndvi}</div>
                    <div className="text-xs text-muted-foreground">NDVI</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">{envData.rainfall}</div>
                    <div className="text-xs text-muted-foreground">Rainfall (mm)</div>
                  </div>
                </div>
              </div>

              <h4 className="font-medium text-foreground text-lg">Calculation Breakdown</h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between p-2 rounded bg-secondary/50">
                  <span className="text-muted-foreground">Base Carbon Gain</span>
                  <span className="font-medium">{result.baseGain} tC/ha/year</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-secondary/50">
                  <span className="text-muted-foreground">Per Acre</span>
                  <span className="font-medium">{result.totalPerAcre.toFixed(3)} tCO₂/acre</span>
                </div>

                <div className="space-y-2 mt-4">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bonuses Applied</div>
                  {result.ndviBonus > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>NDVI Bonus</span>
                      <span className="font-medium">+{result.ndviBonus}</span>
                    </div>
                  )}
                  {result.rainfallBonus > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Rainfall Bonus</span>
                      <span className="font-medium">+{result.rainfallBonus}</span>
                    </div>
                  )}
                  {result.tillageBonus > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Tillage Practice</span>
                      <span className="font-medium">+{result.tillageBonus}</span>
                    </div>
                  )}
                  {result.coverCropBonus > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Cover Crop</span>
                      <span className="font-medium">+{result.coverCropBonus}</span>
                    </div>
                  )}
                  {result.treeBonus > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Agroforestry (Trees)</span>
                      <span className="font-medium">+{result.treeBonus}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Read Only Map */}
            <div className="h-[300px] rounded-xl overflow-hidden border border-border relative">
              <MapContainer center={mapCenter} zoom={15} className="h-full w-full" scrollWheelZoom={true}>
                <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {polygons.map((poly) => (
                  <Polygon
                    key={poly.id}
                    positions={poly.points}
                    pathOptions={{ color: 'red', fillColor: 'red', fillOpacity: 0.4, weight: 2 }}
                  />
                ))}
                <MapController center={mapCenter} zoom={15} />
              </MapContainer>
              <div className="absolute bottom-2 right-2 bg-white/90 px-2 py-1 text-xs rounded shadow z-[1000]">
                Read-only View
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
