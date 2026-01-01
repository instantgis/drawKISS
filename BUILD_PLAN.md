# drawKISS - AI Assistant Build Spec

**DEADLINE**: January 3, 2026 | **USER**: Single artist in Mauritius | **GOAL**: 2-3 sketches/day

---

## TECH STACK (NON-NEGOTIABLE)
- **Backend**: Python 3.11+ FastAPI + OpenCV
- **Frontend**: Angular 21 (Zoneless + Signals ONLY, NO RxJS, NO Zone.js)
- **Infrastructure**: Hostinger VPS + Supabase (auth/storage)

---

## BACKEND: FastAPI + OpenCV

### Endpoint: `POST /process`
**Input**: Image file + params (levels=4, blur_radius=5, threshold=100)

**Processing Pipeline**:
1. Grayscale: `cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)`
2. Blur: `cv2.GaussianBlur(img, (blur_radius, blur_radius), 0)`
3. **Posterization** (4 levels for pencils 5H/2B/8B/14B):
   ```python
   factor = 256 // levels
   posterized = (img // factor) * factor
   ```
4. Edge Detection: `cv2.Canny(posterized, threshold, threshold * 2)`
5. Invert: `cv2.bitwise_not(edges)` → black on white

**Output**: PNG image (StreamingResponse)

### Dependencies
```
fastapi==0.109.0
uvicorn[standard]==0.27.0
opencv-python-headless==4.9.0.80
python-multipart==0.0.6
supabase==2.3.0
```

---

## FRONTEND: Angular 21

### Setup
```bash
ng new drawkiss --standalone --routing --style=css
# Remove zone.js from angular.json
# Add provideZonelessChangeDetection() to app.config.ts
```

### State (Signals Only)
```typescript
currentImage = signal<string | null>(null);
processedImage = signal<string | null>(null);
gridConfig = signal({ rows: 5, cols: 5 });
processingParams = signal({ levels: 4, blur: 5, threshold: 100 });
```

### Components

**1. Capture Component** (`/capture` - Mobile)
- Camera input: `<input type="file" accept="image/*" capture="camera">`
- Upload to `/process` endpoint
- Display processed result
- Sliders for params (levels, blur, threshold)
- "Save to Supabase" button → uploads to `/current/sketch_ref.png`

**2. Easel Component** (`/easel` - Desktop)
- Full-screen image display
- **SVG Grid Overlay**:
  ```typescript
  // Computed grid lines based on gridConfig signal
  gridLines = computed(() => {
    const { rows, cols } = this.gridConfig();
    const lines = [];
    for (let i = 0; i <= cols; i++) {
      lines.push({ x1: i * (100/cols), y1: 0, x2: i * (100/cols), y2: 100 });
    }
    for (let i = 0; i <= rows; i++) {
      lines.push({ x1: 0, y1: i * (100/rows), x2: 100, y2: i * (100/rows) });
    }
    return lines;
  });
  ```
- Click grid cell → dim others (opacity: 0.3)
- Grid controls: sliders for rows/cols (2-20)
- Auto-refresh: `setInterval` every 10s to check Supabase

**3. Login Component** (`/login`)
- Supabase email/password auth
- Redirect to `/capture` on success

### Services

**ImageProcessingService**:
```typescript
processImage(file: File, params: ProcessingParams): Promise<Blob> {
  // POST to backend /process
}
uploadToSupabase(blob: Blob, path: string): Promise<string> {
  // Upload to Supabase storage
}
```

**SupabaseService**:
```typescript
currentUser = signal<User | null>(null);
signIn(email: string, password: string): Promise<void>
uploadImage(blob: Blob, path: string): Promise<string>
getImageUrl(path: string): Promise<string>
```

---

## BUILD ORDER (Critical Path)

### Day 1 (6-8 hours)
**Phase 1: Backend (2-3h)**
1. Init FastAPI project
2. Implement `/process` endpoint with OpenCV
3. Test with curl/Postman
4. Add CORS

**Phase 2: Frontend (3-4h)**
1. Init Angular 21 (zoneless + signals)
2. Create Capture component
3. Create Easel component with SVG grid
4. Connect to backend

**Phase 3: Integration (1-2h)**
1. Add Supabase storage
2. Add auth guard
3. Test phone → backend → desktop

### Day 2 (2-4 hours)
**Phase 4: Deploy**
1. Deploy FastAPI to VPS (PM2/Docker)
2. Configure Nginx
3. Build & deploy Angular
4. Test on real devices

### Day 3
**Phase 5: Real-world test** - Sketch Mauritian scene

---

## MUST HAVE vs DEFERRED

### V1 (Must Have)
- ✅ Image processing (B&W, blur, edges, posterization)
- ✅ Camera capture
- ✅ SVG grid overlay
- ✅ Supabase sync
- ✅ Basic auth (single user)

### V2 (Deferred)
- ❌ Multi-user
- ❌ Gallery/history
- ❌ Image editing
- ❌ Download
- ❌ PWA
- ❌ Social sharing

---

## DEPLOYMENT

### Backend (VPS)
```bash
cd /var/www/drawkiss-api
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pm2 start "uvicorn main:app --host 0.0.0.0 --port 8000" --name drawkiss-api
```

### Nginx
```nginx
server {
    listen 80;
    server_name api.drawkiss.com;
    location / {
        proxy_pass http://localhost:8000;
    }
}
```

---

## SUCCESS CRITERIA (Jan 3)
1. ✅ Take photo on phone
2. ✅ See processed B&W + edges in <5s
3. ✅ View on Mac with grid
4. ✅ Click grid cell to focus
5. ✅ Start sketching with correct proportions

**Time saved**: ~10 min/sketch | **Output**: 2-3 sketches/day

---

## KEY NOTES
- User is color blind → B&W is intentional
- Mauritius subjects → unique niche
- 5H to 14B pencils → posterization critical
- Single user first → no multi-tenant complexity
- **Rule**: If tech takes >4h, it's a distraction

**START WITH BACKEND** - Validate processing before UI

