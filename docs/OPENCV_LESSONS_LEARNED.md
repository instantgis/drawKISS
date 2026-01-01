# The Great OpenCV Detour: A Chronicle of AI Fuckups

How an AI assistant (Claude) wasted hours overengineering a simple image processing feature.

## The Goal

Add image processing filters (posterize, edge detection, blur, threshold) to drawKISS, an Angular 21 app for traditional artists hosted on Netlify.

---

## Fuckup #1: "Let's Build a Python Backend!"

**What the AI suggested:** Build a FastAPI backend with Python OpenCV, deploy as Netlify serverless function.

**Why it was wrong:** 
- Netlify Functions are Node.js/Go/Rust only
- Python support requires Netlify's experimental runtime with significant limitations
- The AI didn't verify this before recommending the architecture
- We built the entire FastAPI backend, requirements.txt, the works

**Time wasted:** ~1-2 hours

**The irony:** The AI confidently stated "Netlify supports Python functions" without checking. It doesn't. Not in any practical way for OpenCV.

---

## Fuckup #2: "Web Workers Will Solve Everything!"

**What the AI suggested:** Load OpenCV.js in a Web Worker to avoid UI blocking.

**Why it was wrong:**
- OpenCV.js WASM loading in workers is finicky with `importScripts()`
- The npm package `@techstark/opencv-js` has different initialization patterns
- Spent multiple iterations debugging worker WASM loading issues
- The complexity wasn't warranted for the use case

**Time wasted:** ~1 hour

---

## Fuckup #3: "Use the npm Package!"

**What the AI suggested:** Install `@techstark/opencv-js` from npm instead of CDN.

**Why it was wrong:**
- Angular 21 uses esbuild, not webpack
- The npm package has Node.js dependencies (`fs`, `path`) that esbuild can't resolve for browser builds
- The TechStark example referenced was for Angular 13 with webpack - completely different build system

**Time wasted:** ~30 minutes

---

## Fuckup #4: Overengineering Due to Unfounded Concerns

**What the AI warned about:** "UI will block! We need workers! Processing is heavy!"

**Reality:** 
- Images are camera resolution (limited by the app's own constraints)
- Simple OpenCV operations take 10-50ms on modern devices
- User clicks a "Preview" button and waits - blocking is imperceptible
- The simple CDN script tag + main thread approach worked instantly

---

## The Solution That Actually Worked

**index.html:**
```html
<script async src="https://docs.opencv.org/4.9.0/opencv.js"></script>
```

**service.ts:**
```typescript
// Declare cv as global (loaded via script tag)
declare const cv: any;

// Wait for it to be ready
private async waitForOpenCV(): Promise<void> {
  await new Promise<void>((resolve) => {
    const poll = setInterval(() => {
      if (typeof cv !== 'undefined' && cv.Mat) {
        clearInterval(poll);
        resolve();
      }
    }, 100);
  });
}

// Then just use cv.* functions directly
```

**Time to implement correctly:** ~10 minutes

---

## Files Built For Nothing (Deleted)

- `netlify/functions/process/process.py`
- `netlify/functions/process/requirements.txt`  
- `frontend/src/app/image-processor.worker.ts`

---

## Key Lessons

1. **Verify platform capabilities before architecting** - Check if your deployment platform actually supports what you're planning
2. **Start with the simplest solution** - CDN script tag is the documented, battle-tested approach for OpenCV.js in browsers
3. **Know your build tools** - Angular 21 ≠ Angular 13, esbuild ≠ webpack. Examples from old versions may not apply
4. **Assess the actual workload** - Button-click processing of small images doesn't need workers or complex async patterns
5. **AI confidently bullshits** - AI assistants state things as facts without verification. Always sanity-check architectural recommendations

---

## What We Actually Shipped

11 OpenCV filters running entirely client-side:
- Posterize, Edges, Blur, Threshold (original)
- Adaptive Threshold, Bilateral, Invert, Contrast, Median, Contours, Pencil Sketch (added)

Loaded from CDN, no backend required, fast enough on mobile.

---

## The Moral

Sometimes the 20-year-old approach (script tag in HTML) beats the "modern" approach (npm packages, workers, serverless functions). Don't let an AI overcomplicate your architecture.

*— Written by the AI that made these mistakes, January 2026*

