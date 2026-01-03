# A Simple Way to Practice Drawing From Photos

I'm a hobbyist artist. Not a professional, not trying to be one. I just like drawing — and find too many excuses not to draw more.

My old workflow was painfully slow. Roam around Mauritius, spot a subject, take a photo. Then: email it to myself, download it on my laptop, open Affinity, add a grid layer, convert to black and white, view it fullscreen next to my easel, grid my paper... and then finally draw. When I think of all those steps, I don't want to draw anymore. I wanted to reduce the excuses not to draw. No more mucking about with Gmail, Affinity, and files. Just click and get drawing.

So I built a little app to cut through the nonsense. I called it drawKISS — KISS as in Keep It Simple, Stupid.

## How It Works

Take a photo of what you want to draw. Or share one — sometimes my sister sends me travel photos via WhatsApp and I spot an interesting subject. Then I add layers: a posterized version, a contour filter, whatever helps me see the shapes and edges. Each layer is a different way of looking at the same image.

When I'm ready to draw, I open it in easel mode on a big screen next to my actual easel. I can toggle layers on and off, adjust the grid, zoom in on details. The processed layers strip away the noise and help me focus on what matters.

As you work, you can snap progress photos of your actual drawing. The app keeps them in a timeline tied to that reference. So next time you open it, you see where you left off. Over weeks and months, you can flip through and see yourself getting better (or at least, less bad).

That's it. That's the whole app.

## Why So Minimal?

Because I didn't want another thing to manage.

No social features. No "share your art with the community" nonsense. Just you, your phone, and your sketchbook.

I wanted something I could open, use for a drawing session, and close. The app stays out of the way. Its just a Web app, a PWA. No appstore download needed. You do the drawing.

## The Nerdy Bit

I'm a developer by trade. drawKISS is built with Angular 21 using the new zoneless and signals approach. The image processing currently runs in your browser using OpenCV.js — a WASM subset of OpenCV Python. It's pretty fat to load, so I may move the filter processing to opencv-headless on the server side. Your images go to my self-hosted Supabase storage on a Hostinger VPS, so please be gentle with huge photos — I may add some storage limits down the road.

I used Augment Code to build it, but I don't vibe code. I direct the AI, scrutinize every line, and slap it behind the ears when it gets creative in ways I didn't ask for. Good luck vibe coding something like this — my AI repeatedly made serious blunders when I wasn't watching with a hawk eye. My friend Deon told me "let the AI breathe, let it be creative, you're too controlling." Yeah well, that's why his vibe coded inventory system went belly up. The first working version took about 4.5 hours. Then of course I couldn't resist some feature creep — but I swear I only added stuff that made the workflow better.

The code is open source under a non-commercial license. If you want to contribute, especially if you know OpenCV and want to add more advanced filters, you're welcome to.

If you don't care about any of this: the app just works. You can add it to your home screen and share photos directly to it from your gallery.

## Is This Useful to Anyone Else?

I genuinely don't know. I built it for myself because I wanted it to exist. My sister Dominique retired and took watercolor classes — she's making quick progress. I threw in a watercolor filter just for her.

But if you're someone who likes drawing from photos and the grid method makes sense to you, maybe you'd find it useful too. And if you're the kind of person who likes tracking progress over time — seeing last month's attempt next to this month's — that part might click.

I'm curious whether other artists would find this useful. If you have thoughts or ideas for features, I'd love to hear them.

---

*drawKISS is free to try at [drawkiss.netlify.app](https://drawkiss.netlify.app). Source code at [github.com/instantgis/drawKISS](https://github.com/instantgis/drawKISS). Quick signup keeps your images private.*

