import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, Polygon, CircleMarker, useMapEvents, useMap } from 'react-leaflet';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Calculator, FolderOpen, TrendingUp, Leaf, ArrowRight, MapPin, CloudRain, Edit2, Save, Loader2, PenTool, Search, Locate, Check, AlertCircle, RefreshCw, ChevronDown, TreePine, Info } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, orderBy, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { calculateCO2Estimation, fetchAllEnvironmentalData, CO2EstimationResult } from '@/lib/carbonCalculator';
import { CO2EstimationParams } from '@/types';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import * as turf from '@turf/turf';

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

interface FarmPolygonDrawerProps {
  currentPoints: [number, number][];
  setCurrentPoints: (points: [number, number][]) => void;
  polygons: FarmPolygon[];
  onPolygonComplete: (points: [number, number][]) => void;
  isEditing: boolean;
}

function FarmPolygonDrawer({ currentPoints, setCurrentPoints, polygons, onPolygonComplete, isEditing }: FarmPolygonDrawerProps) {
  const [mousePos, setMousePos] = useState<[number, number] | null>(null);

  useMapEvents({
    click(e) {
      if (!isEditing) return;

      const newPoint: [number, number] = [e.latlng.lat, e.latlng.lng];

      // Check closure
      if (currentPoints.length >= 3) {
        const startPoint = currentPoints[0];
        const dist = Math.sqrt(Math.pow(newPoint[0] - startPoint[0], 2) + Math.pow(newPoint[1] - startPoint[1], 2));
        if (dist < 0.0005) {
          onPolygonComplete(currentPoints);
          setMousePos(null);
          return;
        }
      }
      setCurrentPoints([...currentPoints, newPoint]);
    },
    mousemove(e) {
      if (isEditing && currentPoints.length > 0) {
        setMousePos([e.latlng.lat, e.latlng.lng]);
      }
    },
  });

  return (
    <>
      {/* Saved Polygons */}
      {polygons.map((poly) => (
        <Polygon
          key={poly.id}
          positions={poly.points}
          pathOptions={{ color: 'red', fillColor: 'red', fillOpacity: 0.4, weight: 2 }}
        />
      ))}

      {/* Current Drawing Points */}
      {isEditing && currentPoints.map((pos, idx) => (
        <CircleMarker
          key={`point - ${idx} `}
          center={pos}
          radius={4}
          pathOptions={{ color: 'white', fillColor: '#16a34a', fillOpacity: 1 }}
          eventHandlers={{
            click: (e) => {
              if (isEditing && idx === 0 && currentPoints.length >= 3) {
                L.DomEvent.stopPropagation(e);
                onPolygonComplete(currentPoints);
                setMousePos(null);
              }
            }
          }}
        />
      ))}

      {/* Lines connecting current points */}
      {!isEditing && currentPoints.length > 0 && <Polyline positions={currentPoints} pathOptions={{ color: '#16a34a', weight: 2 }} />}
      {/* Actually if not isEditing, currentPoints should be empty ideally, but strictly speaking: */}
      {isEditing && currentPoints.length > 0 && <Polyline positions={currentPoints} pathOptions={{ color: '#16a34a', weight: 2 }} />}

      {isEditing && currentPoints.length > 0 && mousePos && (
        <Polyline positions={[currentPoints[currentPoints.length - 1], mousePos]} pathOptions={{ color: '#16a34a', weight: 2, dashArray: '5, 10' }} />
      )}
      {isEditing && currentPoints.length >= 2 && mousePos && (
        <Polyline positions={[mousePos, currentPoints[0]]} pathOptions={{ color: '#16a34a', weight: 1, opacity: 0.5, dashArray: '5, 5' }} />
      )}
    </>
  );
}

// Helper to calc centroid
function getPolygonCentroid(points: [number, number][]): [number, number] {
  if (points.length === 0) return [0, 0];
  let latSum = 0, lngSum = 0;
  points.forEach(p => { latSum += p[0]; lngSum += p[1]; });
  return [latSum / points.length, lngSum / points.length];
}

export default function FarmerDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [estimateDocId, setEstimateDocId] = useState<string | null>(null);
  const [result, setResult] = useState<CO2EstimationResult | null>(null);

  // Map State
  const [mapCenter, setMapCenter] = useState<[number, number]>([20.5937, 78.9629]);
  const [mapZoom, setMapZoom] = useState(5);
  const [polygons, setPolygons] = useState<FarmPolygon[]>([]);
  const [currentPoints, setCurrentPoints] = useState<[number, number][]>([]);

  // Store all existing polygons from DB to check overlap
  const [globalPolygons, setGlobalPolygons] = useState<any[]>([]);

  useEffect(() => {
    const fetchGlobalPolygons = async () => {
      try {
        const q = query(collection(db, 'estimates'));
        const snapshot = await getDocs(q);
        const all: any[] = [];
        snapshot.docs.forEach((doc) => {
          const d = doc.data();
          if (d.polygons && Array.isArray(d.polygons)) {
            d.polygons.forEach((p: any) => {
              // Ensure we have points
              if (p.points && p.points.length >= 3) {
                all.push(p);
              }
            });
          }
        });
        setGlobalPolygons(all);
      } catch (err) {
        console.error("Error fetching global polygons for overlap check:", err);
      }
    };
    fetchGlobalPolygons();
  }, [user]);

  const checkOverlap = (newPoints: [number, number][]) => {
    try {
      if (newPoints.length < 3) return false;

      // Convert Leaflet [lat, lng] to Turf [lng, lat]
      const turfPoints = newPoints.map(p => [p[1], p[0]]);
      // Close the ring
      turfPoints.push(turfPoints[0]);

      const newPoly = turf.polygon([turfPoints]);

      // 1. Check against Global Polygons (DB)
      for (const gp of globalPolygons) {
        // gp.points is likely [{lat: x, lng: y}, ...] based on save logic
        // We need to convert safely
        let gpPoints: number[][] = [];
        if (gp.points && gp.points.length > 0) {
          // Check format
          const p0 = gp.points[0];
          if (Array.isArray(p0)) {
            // [lat, lng]
            gpPoints = gp.points.map((p: any) => [p[1], p[0]]);
          } else if (typeof p0 === 'object' && 'lat' in p0 && 'lng' in p0) {
            // {lat, lng}
            gpPoints = gp.points.map((p: any) => [p.lng, p.lat]);
          }
        }

        if (gpPoints.length < 3) continue;

        // Close ring
        gpPoints.push(gpPoints[0]);
        const gpTurfParams = [gpPoints];

        // Validate geometry (simple check)
        const gpPoly = turf.polygon(gpTurfParams);

        if (turf.booleanIntersects(newPoly, gpPoly)) {
          // For better UX, we can check if it's NOT the same polygon (if editing?)
          // But here we are drawing a NEW polygon.
          // If we are editing an EXISTING polygon, we might overlap with *itself* if we verify against DB.
          // However, handlePolygonComplete creates a NEW polygon ID.
          // If user is editing their own estimate, they might overlap with their previous saved version?
          // Since we fetched ALL estimates, `globalPolygons` includes the current user's *saved* polygons.
          // If this is a *new* addition to the list, overlap is bad.
          // If this is *replacing*... wait, the logic just appends to `polygons`.
          // So yes, overlap is bad.
          return true;
        }
      }

      // 2. Check against Current Session Polygons (Local State)
      for (const lp of polygons) {
        // lp.points is [lat, lng]
        const lpPoints = lp.points.map(p => [p[1], p[0]]);
        lpPoints.push(lpPoints[0]);
        const lpPoly = turf.polygon([lpPoints]);

        // Self-intersection test?
        // turf.intersect(newPoly, lpPoly)
        if (turf.booleanIntersects(newPoly, lpPoly)) {
          return true;
        }
      }

      return false;
    } catch (e) {
      console.error("Turf check error", e);
      return false; // let it pass if check fails to avoid blocking valid user? Or fail safe?
      // Fail safe: user can try again.
    }
  };

  const handlePolygonComplete = (points: [number, number][]) => {
    // Check overlap
    const isOverlapping = checkOverlap(points);
    if (isOverlapping) {
      alert(t('overlap_alert'));
      setCurrentPoints([]);
      return;
    }

    setPolygons([...polygons, {
      id: Math.random().toString(36).substring(2, 9),
      points
    }]);
    setCurrentPoints([]);
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [isLocating, setIsLocating] = useState(false);

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState<{
    tillage: 'ploughing' | 'reduced' | 'no-till';
    coverCrop: boolean;
    trees: number | string;
    yearsFollowed: number | string;
    acres: number | string;
  }>({
    tillage: 'ploughing' as const,
    coverCrop: false,
    trees: 0,
    yearsFollowed: 1,
    acres: 0,
  });

  const [envData, setEnvData] = useState({ soc: 0, ndvi: 0, rainfall: 0 });

  // Fetch Data
  useEffect(() => {
    const fetchEstimate = async () => {
      if (!user) return;
      try {
        // Remove orderBy to avoid needing a composite index (userId + createdAt)
        // const q = query(collection(db, 'estimates'), where('userId', '==', user.id), orderBy('createdAt', 'desc'), limit(1));
        const q = query(collection(db, 'estimates'), where('userId', '==', user.id));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          // Client-side sort to get the latest
          const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
          docs.sort((a, b) => {
            const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return tB - tA;
          });

          const docData = docs[0];
          setEstimateDocId(docData.id);
          setFormData({
            tillage: docData.tillage || 'ploughing',
            coverCrop: docData.coverCrop || false,
            trees: docData.trees || 0,
            yearsFollowed: docData.yearsFollowed || 1,
            acres: docData.acres || 0,
          });
          setEnvData({
            soc: docData.soc || 0,
            ndvi: docData.ndvi || 0,
            rainfall: docData.rainfall || 0
          });
          setResult({
            totalCO2: docData.totalCO2 || 0,
            isEligible: docData.isEligible || false,
            baseGain: docData.baseGain || 0,
            ndviBonus: docData.ndviBonus || 0,
            rainfallBonus: docData.rainfallBonus || 0,
            tillageBonus: docData.tillageBonus || 0,
            coverCropBonus: docData.coverCropBonus || 0,
            treeBonus: docData.treeBonus || 0,
            yearFactor: docData.yearFactor || 1,
            totalPerAcre: docData.totalPerAcre || 0,
            totalPerHectare: docData.totalPerHectare || 0,
          });

          if (docData.polygons && docData.polygons.length > 0) {
            const loadedPolygons = docData.polygons.map((poly: any) => ({
              id: poly.id || Math.random().toString(36).substring(2, 9),
              points: poly.points.map((p: any) => [p.lat, p.lng] as [number, number])
            }));
            setPolygons(loadedPolygons);
            if (loadedPolygons.length > 0) {
              setMapCenter(getPolygonCentroid(loadedPolygons[0].points));
              setMapZoom(15);
            }
          } else if (docData.polygonPoints && docData.polygonPoints.length > 0) {
            const points = docData.polygonPoints.map((p: any) => [p.lat, p.lng] as [number, number]);
            setPolygons([{ id: 'migrated-1', points }]);
            // Center map on polygon
            const centroid = getPolygonCentroid(points);
            setMapCenter(centroid);
            setMapZoom(15);
          }
        } else {
          // New user: Auto-enable edit mode
          setIsEditing(true);
        }
      } catch (error) {
        console.error("Error fetching estimate:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchEstimate();
  }, [user]);

  // Handle Polygon Update Logic
  const handleResetMap = () => {
    setPolygons([]);
    setCurrentPoints([]);
    setEnvData({ soc: 0, ndvi: 0, rainfall: 0 });
  };

  const handleClearCurrentDrawing = () => {
    setCurrentPoints([]);
  };


  // Re-fetch Env Data if polygon changes (only in edit mode if redrawing)
  // Re-fetch Env Data if polygon changes (only in edit mode if redrawing)
  useEffect(() => {
    if (isEditing && polygons.length > 0 && envData.soc === 0) {
      const centroid = getPolygonCentroid(polygons[0].points);
      fetchAllEnvironmentalData(centroid[0], centroid[1]).then(setEnvData);
    }
  }, [isEditing, polygons, envData]);

  const handleSearch = async () => {
    if (!searchQuery) return;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      if (data.length > 0) {
        const { lat, lon } = data[0];
        setMapCenter([parseFloat(lat), parseFloat(lon)]);
        setMapZoom(16);
      }
    } catch (e) { console.error(e); }
  };
  const handleLocate = () => {
    setIsLocating(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setMapCenter([pos.coords.latitude, pos.coords.longitude]);
          setMapZoom(16);
          setIsLocating(false);
        },
        () => setIsLocating(false)
      );
    }
  };

  const handleSave = async () => {
    if (polygons.length === 0) {
      alert(t('draw_alert'));
      return;
    }

    if (formData.trees === '' || formData.yearsFollowed === '' || formData.acres === '') {
      alert(t('fill_alert'));
      return;
    }

    if (Number(formData.acres) <= 0) {
      alert(t('acres_alert'));
      return;
    }

    setIsSaving(true);
    try {
      // Normalize formData: convert empty strings to defaults
      const normalizedFormData = {
        tillage: formData.tillage,
        coverCrop: formData.coverCrop,
        trees: typeof formData.trees === 'string' ? 0 : formData.trees,
        yearsFollowed: typeof formData.yearsFollowed === 'string' ? 1 : formData.yearsFollowed,
        acres: typeof formData.acres === 'string' ? 0 : formData.acres,
      };

      // Recalculate
      const params: CO2EstimationParams = { ...normalizedFormData, ...envData };
      const newResult = calculateCO2Estimation(params);
      setResult(newResult);

      const dataToSave = {
        userId: user?.id || null,
        userName: user?.name || 'Unknown',
        userPhone: user?.phone || '',
        ...params,
        ...newResult,
        ...newResult,
        polygons: polygons.map(poly => ({
          id: poly.id,
          points: poly.points.map(p => ({ lat: p[0], lng: p[1] }))
        })),
        polygonPoints: [], // Deprecated
        status: 'updated',
        createdAt: serverTimestamp() // Update timestamp to show it's fresh
      };

      if (estimateDocId) {
        await updateDoc(doc(db, 'estimates', estimateDocId), dataToSave);
      } else {
        // Create new if didn't exist
        const ref = await addDoc(collection(db, 'estimates'), dataToSave);
        setEstimateDocId(ref.id);
      }

      setIsEditing(false);
    } catch (error) {
      console.error("Error updating estimate:", error);
      alert(t('save_error'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardLayout role="farmer">
      <div className="p-6 lg:p-8 space-y-8">
        {/* Header */}
        <div className="animate-fade-in flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">{t('welcome_farmer', { name: user?.name || 'Farmer' })}</h1>
            <p className="text-muted-foreground mt-1">{t('track_credits')}</p>
          </div>
          <div>
            {!isEditing ? (
              <button onClick={() => setIsEditing(true)} className="btn-secondary gap-2">
                <Edit2 className="w-4 h-4" /> {t('edit_profile')}
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setIsEditing(false)} className="btn-secondary">{t('cancel')}</button>
                <button onClick={handleSave} disabled={isSaving} className="btn-primary gap-2">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {t('save_changes')}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="stat-card animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Leaf className="w-6 h-6 text-primary" />
              </div>
              <div>
                <div className="stat-value">{result?.totalCO2.toFixed(1) || '--'}</div>
                <div className="stat-label">{t('tco2_estimated')}</div>
              </div>
            </div>
          </div>
          <div className="stat-card animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-accent" />
              </div>
              <div>
                <div className="stat-value">{formData.acres || '--'} ac</div>
                <div className="stat-label">{t('land_registered')}</div>
              </div>
            </div>
          </div>
          <div className="stat-card animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-info/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-info" />
              </div>
              <div>
                <div className="stat-value">Open</div>
                <div className="stat-label">{t('project_status')}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Editor Section: Map + Form */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 animate-fade-in">
          {/* Left: Map */}
          <div className="card-elevated overflow-hidden h-fit">
            {isEditing && (
              <div className="p-4 border-b border-border flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} placeholder={t('search_location')} className="input-field pl-9 py-2 text-sm" />
                </div>
                <button onClick={handleSearch} className="btn-secondary py-2 px-3 text-sm">{t('search')}</button>
                <button onClick={handleLocate} disabled={isLocating} className="btn-primary py-2 px-3 text-sm">{isLocating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Locate className="w-4 h-4" />}</button>
              </div>
            )}

            <div className="h-[400px] relative">
              <MapContainer center={mapCenter} zoom={mapZoom} className="h-full w-full" scrollWheelZoom={true}>
                <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapController center={mapCenter} zoom={mapZoom} />
                <FarmPolygonDrawer
                  currentPoints={currentPoints}
                  setCurrentPoints={setCurrentPoints}
                  polygons={polygons}
                  onPolygonComplete={handlePolygonComplete}
                  isEditing={isEditing}
                />
              </MapContainer>

              {/* Overlays */}
              {isEditing && polygons.length === 0 && currentPoints.length === 0 && (
                <div className="absolute bottom-4 left-4 right-4 bg-card/90 backdrop-blur rounded p-2 text-sm border shadow z-[1000] flex justify-between">
                  <span>{t('click_to_start_drawing')}</span>
                </div>
              )}
              {isEditing && currentPoints.length > 0 && (
                <div className="absolute bottom-4 left-4 right-4 bg-card/90 backdrop-blur rounded p-2 text-sm border shadow z-[1000] flex justify-between">
                  <span>{t('click_to_add_points')}</span>
                  <button onClick={handleClearCurrentDrawing} className="text-destructive text-xs font-bold">{t('clear')}</button>
                </div>
              )}
              {polygons.length > 0 && (
                <div className="absolute top-4 right-4 bg-card/90 backdrop-blur rounded p-2 border shadow z-[1000]">
                  <div className="text-green-600 flex items-center gap-1 text-sm font-bold"><Check className="w-4 h-4" /> {polygons.length} {t('areas_set')}</div>
                  {isEditing && <button onClick={handleResetMap} className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><RefreshCw className="w-3 h-3" /> {t('clear_all')}</button>}
                </div>
              )}
            </div>

            {/* Env Data */}
            <div className="p-4 bg-secondary/30 border-t border-border">
              <div className="flex items-center gap-2 mb-2 text-sm font-medium">
                <Info className="w-4 h-4 text-primary" />
                {t('env_data_auto')}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div><div className="font-bold text-lg">{envData.soc}</div><div className="text-xs text-muted-foreground">{t('soc', 'SOC')}</div></div>
                <div><div className="font-bold text-lg">{envData.ndvi}</div><div className="text-xs text-muted-foreground">{t('ndvi', 'NDVI')}</div></div>
                <div><div className="font-bold text-lg">{envData.rainfall}</div><div className="text-xs text-muted-foreground">{t('rainfall', 'Rainfall')}</div></div>
              </div>
            </div>
          </div>

          {/* Right: Form */}
          <div className="card-elevated p-6 h-fit space-y-5">
            <h3 className="text-lg font-display font-bold text-foreground">{t('farm_practices')}</h3>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('tillage_practice')}</label>
                <div className="relative">
                  <select disabled={!isEditing} value={formData.tillage} onChange={e => setFormData({ ...formData, tillage: e.target.value as any })} className="input-field appearance-none disabled:bg-muted disabled:text-muted-foreground">
                    <option value="ploughing">{t('ploughing')}</option>
                    <option value="reduced">{t('reduced_tillage')}</option>
                    <option value="no-till">{t('no_till')}</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-2.5 w-5 h-5 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t('cover_crop_used')}</label>
                <div className="flex gap-3">
                  <button onClick={() => isEditing && setFormData({ ...formData, coverCrop: true })} className={`flex-1 py-2 rounded-lg border text-sm font-medium ${formData.coverCrop ? 'bg-primary/10 border-primary text-primary' : 'bg-background border-border'} ${!isEditing && 'opacity-70 cursor-not-allowed'}`}>{t('yes')}</button>
                  <button onClick={() => isEditing && setFormData({ ...formData, coverCrop: false })} className={`flex-1 py-2 rounded-lg border text-sm font-medium ${!formData.coverCrop ? 'bg-primary/10 border-primary text-primary' : 'bg-background border-border'} ${!isEditing && 'opacity-70 cursor-not-allowed'}`}>{t('no')}</button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium flex gap-2 items-center"><TreePine className="w-4 h-4" /> {t('trees_on_farm')}</label>
                <input
                  type="number"
                  disabled={!isEditing}
                  value={formData.trees}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '') {
                      setFormData({ ...formData, trees: '' });
                    } else {
                      const num = parseInt(val);
                      if (!isNaN(num) && num >= 0) {
                        setFormData({ ...formData, trees: num });
                      }
                    }
                  }}
                  className="input-field disabled:bg-muted disabled:text-muted-foreground"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t('years_practices_followed')}</label>
                <input
                  type="number"
                  disabled={!isEditing}
                  value={formData.yearsFollowed}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '') {
                      setFormData({ ...formData, yearsFollowed: '' });
                    } else {
                      const num = parseInt(val);
                      if (!isNaN(num) && num >= 1) {
                        setFormData({ ...formData, yearsFollowed: num });
                      }
                    }
                  }}
                  className="input-field disabled:bg-muted disabled:text-muted-foreground"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t('number_of_acres')}</label>
                <input
                  type="number"
                  disabled={!isEditing}
                  value={formData.acres}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '') {
                      setFormData({ ...formData, acres: '' });
                    } else {
                      const num = parseFloat(val);
                      if (!isNaN(num) && num >= 0) {
                        setFormData({ ...formData, acres: num });
                      }
                    }
                  }}
                  className="input-field disabled:bg-muted disabled:text-muted-foreground"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

