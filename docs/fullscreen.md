I want my web app to show a photo full screen.

To show a photo in true fullscreen mode on a mobile device, you generally use the **Fullscreen API**. This removes the browser's address bar and navigation buttons, giving your photo the entire screen.

Here is how to implement it:

### 1. The JavaScript (Requesting Fullscreen)

For security, browsers require a **user gesture** (like a tap) to trigger fullscreen. You cannot force it to happen as soon as the page loads.

```javascript
const photo = document.getElementById('myPhoto');

photo.addEventListener('click', () => {
  if (photo.requestFullscreen) {
    photo.requestFullscreen();
  } else if (photo.webkitRequestFullscreen) { /* Safari/iOS support */
    photo.webkitRequestFullscreen();
  }
});

```

### 2. The CSS (Ensuring the Photo Fits)

When an element enters fullscreen, you often want the photo to cover the screen without being distorted. Use the `:fullscreen` pseudo-class and `object-fit`.

```css
/* Styles applied only when in fullscreen mode */
#myPhoto:fullscreen {
  width: 100vw;
  height: 100vh;
  object-fit: contain; /* Keeps entire photo visible */
  background-color: black;
}

/* For older Safari versions */
#myPhoto:-webkit-full-screen {
  width: 100%;
  height: 100%;
}

```

---

### Important Considerations for 2026

* **iOS Support:** While standard fullscreen is widely supported, older iPhones sometimes restrict the Fullscreen API to `<video>` elements only. For a standard `<img>` on those devices, you might need to use a "fake" fullscreen (a fixed-position modal that covers the viewport) or encourage the user to "Add to Home Screen" as a PWA.
* **The Notch/Safe Areas:** If you want the photo to go behind the camera notch, ensure your HTML includes the `viewport-fit=cover` meta tag:
> `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`


* **Exiting:** Users can usually swipe or use a back gesture to exit, but you can also provide a button that calls `document.exitFullscreen()`.

Would you like a complete code template that includes a "Close" button for the fullscreen view?