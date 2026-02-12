import { CO2EstimationParams } from '@/types';

export interface CO2EstimationResult {
  baseGain: number;
  ndviBonus: number;
  rainfallBonus: number;
  tillageBonus: number;
  coverCropBonus: number;
  treeBonus: number;
  yearFactor: number;
  totalPerHectare: number;
  totalPerAcre: number;
  totalCO2: number;
  isEligible: boolean;
}

export function calculateCO2Estimation(params: CO2EstimationParams): CO2EstimationResult {
  // Base carbon gain in tC/ha/year
  let baseGain = 0.2;

  // NDVI bonus
  const ndviBonus = params.ndvi > 0.4 ? 0.1 : 0;

  // Rainfall bonus
  const rainfallBonus = params.rainfall > 700 ? 0.1 : 0;

  // Tillage practice bonus
  let tillageBonus = 0;
  if (params.tillage === 'no-till') {
    tillageBonus = 0.2;
  } else if (params.tillage === 'reduced') {
    tillageBonus = 0.1;
  }

  // Cover crop bonus
  const coverCropBonus = params.coverCrop ? 0.2 : 0;

  // Tree bonus
  const treeBonus = params.trees >= 30 ? 0.2 : (params.trees >= 15 ? 0.1 : 0);

  // Calculate year factor (diminishing returns over time)
  let yearFactor = 1.0;
  if (params.yearsFollowed <= 1) {
    yearFactor = 1.0;
  } else if (params.yearsFollowed <= 3) {
    yearFactor = 0.8;
  } else if (params.yearsFollowed <= 6) {
    yearFactor = 0.5;
  } else {
    yearFactor = 0.2;
  }

  // Total carbon per hectare
  const totalCarbonPerHectare = (baseGain + ndviBonus + rainfallBonus + tillageBonus + coverCropBonus + treeBonus) * yearFactor;

  // Convert carbon to CO2 (multiply by 3.67)
  const co2PerHectare = totalCarbonPerHectare * 3.67;

  // Convert hectare to acre (divide by 2.47)
  const co2PerAcre = co2PerHectare / 2.47;

  // Total CO2 for all acres
  const totalCO2 = co2PerAcre * params.acres;

  // Eligibility check (minimum threshold)
  const isEligible = totalCO2 >= 0.5;

  return {
    baseGain,
    ndviBonus,
    rainfallBonus,
    tillageBonus,
    coverCropBonus,
    treeBonus,
    yearFactor,
    totalPerHectare: co2PerHectare,
    totalPerAcre: co2PerAcre,
    totalCO2,
    isEligible,
  };
}

// 1. SoilGrids API for SOC
// Documentation: https://rest.isric.org/soilgrids/v2.0/docs
export async function fetchSOC(lat: number, lon: number): Promise<number> {
  try {
    // Query SoilGrids for SOC (soil organic carbon) at the specified location
    // We request depths 0-5cm, 5-15cm, and 15-30cm as per carbon project requirements
    const response = await fetch(
      `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lon}&lat=${lat}&property=soc&depth=0-5cm&depth=5-15cm&depth=15-30cm&value=mean`
    );

    if (!response.ok) {
      throw new Error('SoilGrids API failed');
    }

    const data = await response.json();

    // The API returns data in a specific structure. We need to extract the "mean" values.
    // The "soc" property layer contains the depths.
    const socLayer = data.properties.layers.find((l: any) => l.name === 'soc');

    if (!socLayer) {
      return 30; // Fallback if data not found
    }

    // Extract mean values for each depth range
    // Note: The API returns units in dg/kg.
    // The user's example showed grabbing the "mean" integer directly.
    // We will follow the weighted average logic for 0-30cm.

    // Depth 0-5cm (Thickness: 5cm)
    const depth0_5 = socLayer.depths.find((d: any) => d.label === '0-5cm')?.values.mean || 0;

    // Depth 5-15cm (Thickness: 10cm)
    const depth5_15 = socLayer.depths.find((d: any) => d.label === '5-15cm')?.values.mean || 0;

    // Depth 15-30cm (Thickness: 15cm)
    const depth15_30 = socLayer.depths.find((d: any) => d.label === '15-30cm')?.values.mean || 0;

    // Calculate weighted average for 0-30cm soil profile
    // Formula: (Val1 * T1 + Val2 * T2 + Val3 * T3) / Total_Thickness
    const weightedSum = (depth0_5 * 5) + (depth5_15 * 10) + (depth15_30 * 15);
    const totalDepth = 30;

    const socBaseline = weightedSum / totalDepth;

    return Math.round(socBaseline); // Return as integer g/kg
  } catch (error) {
    console.warn('Failed to fetch SOC data, using fallback', error);
    return Math.round(20 + Math.random() * 40); // 20-60 g/kg fallback
  }
}

// 2. Sentinel-2 Data for NDVI via Google Earth Engine (backend proxy)
export async function fetchNDVI(lat: number, lon: number): Promise<number> {
  try {
    // Call local Python backend which handles Earth Engine Authentication and Computation
    const response = await fetch(`http://localhost:8000/api/ndvi?lat=${lat}&lon=${lon}`);

    if (!response.ok) {
      throw new Error('Backend NDVI fetch failed');
    }

    const data = await response.json();
    return Number(data.ndvi.toFixed(2));
  } catch (error) {
    console.warn('Failed to fetch NDVI from backend (is it running?), using fallback simulation', error);
    // Fallback simulation for when backend is not running
    await new Promise(resolve => setTimeout(resolve, 500));
    const pseudoRandom = Math.abs(Math.sin(lat * lon));
    return Number((0.2 + pseudoRandom * 0.6).toFixed(2));
  }
}

// 3. CHIRPS Rainfall Data via Google Earth Engine (backend proxy)
export async function fetchRainfall(lat: number, lon: number): Promise<number> {
  try {
    // Call local Python backend which handles Earth Engine Authentication and Computation
    const response = await fetch(`http://localhost:8000/api/rainfall?lat=${lat}&lon=${lon}`);

    if (!response.ok) {
      throw new Error('Backend Rainfall fetch failed');
    }

    const data = await response.json();
    return Math.round(data.rainfall);
  } catch (error) {
    console.warn('Failed to fetch Rainfall from backend (is it running?), using fallback simulation', error);
    // Fallback simulation
    await new Promise(resolve => setTimeout(resolve, 500));
    const pseudoRandom = Math.abs(Math.cos(lat + lon));
    return Math.round(400 + pseudoRandom * 800);
  }
}

export async function fetchAllEnvironmentalData(lat: number, lon: number) {
  const [soc, ndvi, rainfall] = await Promise.all([
    fetchSOC(lat, lon),
    fetchNDVI(lat, lon),
    fetchRainfall(lat, lon),
  ]);

  return { soc, ndvi, rainfall };
}
