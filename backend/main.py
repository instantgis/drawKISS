"""
drawKISS Backend - FastAPI + OpenCV Image Processing
Converts photos to B&W sketch references with posterization for pencil mapping
"""

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import cv2
import numpy as np
import io
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

app = FastAPI(title="drawKISS API", version="1.0.0")

# CORS - allow all origins for dev (tighten for production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
storage_bucket = os.getenv("STORAGE_BUCKET", "sketch-refs")

supabase: Client = None
if supabase_url and supabase_key:
    supabase = create_client(supabase_url, supabase_key)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "service": "drawKISS"}


@app.post("/process")
async def process_image(
    file: UploadFile = File(...),
    levels: int = Form(4),
    blur_radius: int = Form(5),
    threshold: int = Form(100),
    mode: str = Form("posterize"),  # posterize, edges, both
    invert: bool = Form(True),
):
    """
    Process an image for sketching reference.
    
    Args:
        file: Input image
        levels: Posterization levels (4 = 5H, 2B, 8B, 14B pencil mapping)
        blur_radius: Gaussian blur kernel size (must be odd)
        threshold: Canny edge detection threshold
        mode: Output mode - 'posterize', 'edges', or 'both'
        invert: If True, output is black on white (ink style)
    
    Returns:
        Processed PNG image
    """
    try:
        # Read image
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image file")
        
        # 1. Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # 2. Apply Gaussian blur (kernel must be odd)
        if blur_radius > 0:
            blur_radius = blur_radius if blur_radius % 2 == 1 else blur_radius + 1
            gray = cv2.GaussianBlur(gray, (blur_radius, blur_radius), 0)
        
        # 3. Posterization - reduce to N discrete gray levels
        # Maps to pencil grades: 5H (lightest), 2B, 8B, 14B (darkest)
        factor = 256 // levels
        posterized = (gray // factor) * factor
        
        # 4. Edge detection (Canny)
        edges = cv2.Canny(posterized, threshold, threshold * 2)
        
        # 5. Choose output based on mode
        if mode == "posterize":
            output = cv2.cvtColor(posterized, cv2.COLOR_GRAY2BGR)
        elif mode == "edges":
            # Black edges on white background
            output = np.full_like(posterized, 255)  # White background
            output[edges > 0] = 0  # Black edges
            output = cv2.cvtColor(output, cv2.COLOR_GRAY2BGR)
        else:  # both - overlay edges in yellow on posterized
            output = cv2.cvtColor(posterized, cv2.COLOR_GRAY2BGR)
            # Yellow edges (BGR: 0, 255, 255)
            output[edges > 0] = [0, 255, 255]
        
        # Encode as PNG
        _, encoded = cv2.imencode('.png', output)
        
        return StreamingResponse(
            io.BytesIO(encoded.tobytes()),
            media_type="image/png",
            headers={"Content-Disposition": "inline; filename=processed.png"}
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/upload")
async def upload_to_storage(
    file: UploadFile = File(...),
    path: str = Form("current/sketch_ref.png"),
):
    """
    Upload processed image to Supabase storage.
    Default path overwrites the 'current' reference for easel view.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    try:
        contents = await file.read()
        
        # Upload to Supabase storage (upsert)
        result = supabase.storage.from_(storage_bucket).upload(
            path,
            contents,
            {"content-type": file.content_type, "upsert": "true"}
        )
        
        # Get public URL
        public_url = supabase.storage.from_(storage_bucket).get_public_url(path)
        
        return {"success": True, "url": public_url, "path": path}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/current")
async def get_current_reference():
    """Get the URL of the current sketch reference image"""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    path = "current/sketch_ref.png"
    public_url = supabase.storage.from_(storage_bucket).get_public_url(path)
    
    return {"url": public_url, "path": path}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

