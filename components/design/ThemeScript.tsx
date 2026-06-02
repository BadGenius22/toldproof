// Blocking <script> that reads the user's theme preference and applies the
// .dark class to <html> BEFORE first paint, eliminating the flash-of-dark.
// Placed inside <head> via app/layout.tsx.
//
// Default is LIGHT — only opt in to dark if the user explicitly toggled it
// (localStorage = 'dark'). OS-level prefers-color-scheme is no longer
// auto-honored so the brand reads consistent for first-time visitors.

export function ThemeScript() {
  const js = `(function(){try{var v=localStorage.getItem('tp_theme');if(v==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`;
  // type=text/javascript on the server so the browser runs it synchronously
  // before first paint; text/plain on the client so React doesn't warn that a
  // <script> in the tree won't execute (and the browser won't re-run it).
  // suppressHydrationWarning covers the resulting type attribute mismatch.
  // See: nextjs.org/docs preventing-flash-before-hydration (InlineScript).
  return (
    <script
      type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
      dangerouslySetInnerHTML={{ __html: js }}
      suppressHydrationWarning
    />
  );
}
