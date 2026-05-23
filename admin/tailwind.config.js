export default {
  content: ['./index.html','./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: { DEFAULT:'#0b0e14', 50:'#13161f', 100:'#1a1e2a', 200:'#222636' },
        surface: { DEFAULT:'#1e2230', light:'#262b3d', border:'#2e3347' },
        accent: { DEFAULT:'#f0a500', muted:'#c47f00', glow:'rgba(240,165,0,0.15)' },
        danger: { DEFAULT:'#ef4444', muted:'#7f1d1d' },
        success: { DEFAULT:'#22c55e', muted:'#14532d' },
        warn: { DEFAULT:'#f59e0b', muted:'#78350f' },
        info: { DEFAULT:'#38bdf8', muted:'#0c4a6e' },
      },
      fontFamily: { display:['Syne','sans-serif'], body:['DM Sans','sans-serif'], mono:['DM Mono','monospace'] },
      boxShadow: { glow:'0 0 20px rgba(240,165,0,0.2)', card:'0 4px 24px rgba(0,0,0,0.4)' },
    },
  },
  plugins: [],
}
