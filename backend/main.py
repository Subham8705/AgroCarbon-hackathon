import ee
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Initialize Earth Engine
# Ensure you have run `earthengine authenticate` locally before ensuring this script runs
try:
    ee.Initialize()
except Exception as e:
    print(f"Warning: Earth Engine not initialized. Authentication required. Error: {e}")

app = FastAPI()

# Configure CORS to allow requests from the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the exact frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Carbon Cycle Connect Backend is Running"}

@app.get("/api/ndvi")
def get_ndvi(lat: float, lon: float, year: int = 2025):
    try:
        point = ee.Geometry.Point([lon, lat])
        
        # Sentinel-2 Harmonized Data
        # Use the provided year for filtering
        start_date = f'{year}-01-01'
        end_date = f'{year}-12-31'
        
        dataset = (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
                   .filterBounds(point)
                   .filterDate(start_date, end_date)
                   .sort('CLOUDY_PIXEL_PERCENTAGE')
                   .first())
        
        # Calculate NDVI
        ndvi = dataset.normalizedDifference(['B8', 'B4']).rename('NDVI')
        
        # Reduce region to get value at the point
        ndvi_value = ndvi.reduceRegion(
            reducer=ee.Reducer.first(),
            geometry=point,
            scale=10
        ).get('NDVI')
        
        result = ndvi_value.getInfo()
        
        if result is None:
             # Fallback if no data found (clouds etc/masked) - although we sorted by clouds
             return {"ndvi": 0.0}

        return {"ndvi": result}
    except Exception as e:
        print(f"Error fetching NDVI: {e}")
        # Return a fallback or error 500 depending on requirements.
        # Returning 0 or error message safely.
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/rainfall")
def get_rainfall(lat: float, lon: float, year: int = 2025):
    try:
        point = ee.Geometry.Point([lon, lat])
        
        # CHIRPS Daily Rainfall
        # Get total rainfall for the specified year
        start_date = f'{year}-01-01'
        end_date = f'{year}-12-31'
        
        rain = (ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
                .filterBounds(point)
                .filterDate(start_date, end_date)
                .sum())
        
        rain_value = rain.reduceRegion(
            reducer=ee.Reducer.first(),
            geometry=point,
            scale=5000
        ).get('precipitation')
        
        result = rain_value.getInfo()
        
        if result is None:
             return {"rainfall": 0.0}

        return {"rainfall": result}
    except Exception as e:
        print(f"Error fetching Rainfall: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
