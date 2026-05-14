// Blocking <script> that reads the user's theme preference and applies the
// .dark class to <html> BEFORE first paint, eliminating the flash-of-light.
// Placed inside <head> via app/layout.tsx.

export function ThemeScript() {
  const js = `(function(){try{var v=localStorage.getItem('tp_theme');if(v==='dark'||(!v&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`;
  // suppressHydrationWarning because we mutate <html> here on the client.
  return <script dangerouslySetInnerHTML={{ __html: js }} suppressHydrationWarning />;
}
