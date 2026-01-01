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
    type: str = Form("posterize"),  # posterize, edges, blur, threshold
    param_value: int = Form(4),
):
    """
    Process an image with a single filter layer.

    Args:
        file: Input image
        type: Filter type - 'posterize', 'edges', 'blur', 'threshold'
        param_value: Parameter for the filter:
            - posterize: levels (2-8)
            - edges: threshold (0-255)
            - blur: radius (1-21, odd)
            - threshold: cutoff (0-255)

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

        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # Apply filter based on type
        if type == "posterize":
            levels = max(2, min(8, param_value))
            factor = 256 // levels
            output = (gray // factor) * factor

        elif type == "edges":
            threshold = max(0, min(255, param_value))
            edges = cv2.Canny(gray, threshold, threshold * 2)
            output = np.full_like(gray, 255)  # White background
            output[edges > 0] = 0  # Black edges

        elif type == "blur":
            radius = max(1, min(21, param_value))
            radius = radius if radius % 2 == 1 else radius + 1  # Must be odd
            output = cv2.GaussianBlur(gray, (radius, radius), 0)

        elif type == "threshold":
            cutoff = max(0, min(255, param_value))
            _, output = cv2.threshold(gray, cutoff, 255, cv2.THRESH_BINARY)

        else:
            raise HTTPException(status_code=400, detail=f"Unknown filter type: {type}")

        # Convert to BGR for PNG encoding
        output_bgr = cv2.cvtColor(output, cv2.COLOR_GRAY2BGR)

        # Encode as PNG
        _, encoded = cv2.imencode('.png', output_bgr)

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

