import { defineConfig, presetUno, presetIcons, transformerDirectives } from 'unocss'

export default defineConfig({
  presets: [
    presetUno(),
    presetIcons({
      scale: 1.2,
      warn: true,
      extraProperties: {
        'display': 'inline-block',
        'vertical-align': 'middle',
      },
    }),
  ],
  transformers: [
    transformerDirectives(),
  ],
  theme: {
    colors: {
      // Base - Dark with depth
      'void': '#0A0A0F',
      'obsidian': '#16161D',
      'coal': '#1F1F2A',
      'iron': '#2A2A3A',
      'iron-light': '#3A3A4A',
      
      // Neon Accents - Cyberpunk glow
      'neon-cyan': '#00FFFF',
      'neon-lime': '#00FF41',
      'neon-magenta': '#FF00FF',
      'neon-orange': '#FF6B00',
      'terminal-green': '#33FF00',
      
      // Voxel Materials - Minecraft inspired
      'diamond': '#5CDBD6',
      'emerald': '#50C878',
      'redstone': '#FF0000',
      'gold': '#FFD700',
      'silver': '#B8B8B8',
    },
    fontFamily: {
      'display': ['Orbitron', 'monospace'],
      'body': ['JetBrains Mono', 'monospace'],
      'pixel': ['Press Start 2P', 'cursive'],
    },
  },
  shortcuts: [
    // Base voxel components
    ['voxel-base', 'bg-coal border-2 border-iron relative transition-all duration-200'],
    ['voxel-hover', 'hover:bg-iron-light hover:border-neon-cyan hover:shadow-[0_0_10px_rgba(0,255,255,0.5)]'],
    ['voxel-active', 'active:translate-y-0.5 active:shadow-[0_2px_0_rgba(0,0,0,0.5)]'],
    
    // Pixel corners (8px cut)
    ['pixel-corner', 'clip-path-[polygon(0_8px,8px_0,calc(100%-8px)_0,100%_8px,100%_calc(100%-8px),calc(100%-8px)_100%,8px_100%,0_calc(100%-8px))]'],
    ['pixel-corner-sm', 'clip-path-[polygon(0_4px,4px_0,calc(100%-4px)_0,100%_4px,100%_calc(100%-4px),calc(100%-4px)_100%,4px_100%,0_calc(100%-4px))]'],
    
    // Cyber text styles
    ['cyber-text', 'font-display text-neon-cyan uppercase tracking-wider'],
    ['terminal-text', 'font-body text-terminal-green'],
    
    // Glow effects
    ['glow-cyan', 'shadow-[0_0_10px_rgba(0,255,255,0.5)]'],
    ['glow-lime', 'shadow-[0_0_10px_rgba(0,255,65,0.5)]'],
    ['glow-magenta', 'shadow-[0_0_10px_rgba(255,0,255,0.5)]'],
    ['glow-gold', 'shadow-[0_0_10px_rgba(255,215,0,0.5)]'],
    
    // Button variants
    ['btn-voxel', 'voxel-base voxel-hover voxel-active pixel-corner px-6 py-3 cyber-text cursor-pointer'],
    ['btn-primary', 'btn-voxel border-neon-cyan text-neon-cyan'],
    ['btn-success', 'btn-voxel border-neon-lime text-neon-lime'],
    ['btn-danger', 'btn-voxel border-redstone text-redstone'],
    ['btn-legendary', 'btn-voxel border-neon-magenta text-neon-magenta animate-pulse'],
    
    // Container styles
    ['terminal-frame', 'bg-obsidian border-2 border-iron shadow-[0_0_20px_rgba(0,255,255,0.2),inset_0_0_20px_rgba(10,10,15,0.5)]'],
    ['inventory-slot', 'w-16 h-16 bg-obsidian border-2 border-iron flex items-center justify-center relative'],
  ],
  rules: [
    // Custom clip-path rule for complex polygons
    [/^clip-path-\[(.+)\]$/, ([, value]) => ({ 'clip-path': value })],
    
    // Data stream animation
    ['data-stream', { animation: 'data-stream 3s linear infinite' }],
    
    // Scanline effect
    ['scanlines', {
      'background': 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(51,255,0,0.03) 2px, rgba(51,255,0,0.03) 4px)',
      'pointer-events': 'none',
      'animation': 'scanlines 8s linear infinite',
    }],
  ],
  preflights: [
    {
      getCSS: () => `
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=JetBrains+Mono:wght@400;700&display=swap');
        
        @keyframes data-stream {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        @keyframes scanlines {
          0% { transform: translateY(0); }
          100% { transform: translateY(10px); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          background-color: #0A0A0F;
          color: #B8B8B8;
          font-family: 'JetBrains Mono', monospace;
        }
      `
    }
  ],
})