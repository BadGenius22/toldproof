// Blocking <script> that reads the user's theme preference and applies the
// .dark class to <html> BEFORE first paint, eliminating the flash-of-dark.
// Placed inside <head> via app/layout.tsx.
//
// Default is LIGHT — only opt in to dark if the user explicitly toggled it
// (localStorage = 'dark'). OS-level prefers-color-scheme is no longer
// auto-honored so the brand reads consistent for first-time visitors.

export function ThemeScript() {
  const js = `(function(){try{var v=localStorage.getItem('tp_theme');if(v==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`;
  // suppressHydrationWarning because we mutate <html> here on the client.
  return <script dangerouslySetInnerHTML={{ __html: js }} suppressHydrationWarning />;
}
