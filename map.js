// AgamaKu Custom Vector Canvas Map Simulator
class AgamaKuMap {
  constructor(canvasId, userPos = { x: 0.5, y: 0.5 }) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.userPos = userPos; // Normalized coordinates (0 to 1)
    this.ustazPos = null;
    this.animationFrame = null;
    this.isSearching = false;
    this.searchingRadius = 0;
    this.landmarks = [
      { name: "Masjid Wilayah", x: 0.3, y: 0.2, type: "mosque" },
      { name: "Masjid Negara", x: 0.45, y: 0.75, type: "mosque" },
      { name: "Surau Al-Ikhlas", x: 0.7, y: 0.3, type: "surau" },
      { name: "Pusat Islam KL", x: 0.25, y: 0.55, type: "islamic_center" },
      { name: "Masjid As-Syakirin", x: 0.8, y: 0.6, type: "mosque" },
      { name: "Taman Rekreasi", x: 0.6, y: 0.8, type: "park" }
    ];
    this.roads = [
      // Major highways / arterial routes
      [{ x: 0.1, y: 0.3 }, { x: 0.5, y: 0.3 }, { x: 0.9, y: 0.3 }],
      [{ x: 0.3, y: 0.1 }, { x: 0.3, y: 0.9 }],
      [{ x: 0.7, y: 0.1 }, { x: 0.7, y: 0.9 }],
      [{ x: 0.1, y: 0.6 }, { x: 0.9, y: 0.6 }],
      [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.9 }]
    ];
    
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.parentNode.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    this.draw();
  }

  setUstaz(ustazPos) {
    this.ustazPos = ustazPos; // { x, y, avatar, name }
    this.draw();
  }

  startSearching() {
    this.isSearching = true;
    this.searchingRadius = 0;
    const animate = () => {
      if (!this.isSearching) return;
      this.searchingRadius += 1.5;
      if (this.searchingRadius > 150) this.searchingRadius = 0;
      this.draw();
      this.animationFrame = requestAnimationFrame(animate);
    };
    animate();
  }

  stopSearching() {
    this.isSearching = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    this.draw();
  }

  animateUstazJourney(startPos, endPos, durationMs, onUpdate, onComplete) {
    const startTime = performance.now();
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      
      // Interpolate position
      const currentX = startPos.x + (endPos.x - startPos.x) * progress;
      const currentY = startPos.y + (endPos.y - startPos.y) * progress;
      
      this.ustazPos = {
        ...this.ustazPos,
        x: currentX,
        y: currentY
      };

      if (onUpdate) onUpdate(progress);
      this.draw();

      if (progress < 1) {
        this.animationFrame = requestAnimationFrame(animate);
      } else {
        this.ustazPos = { ...this.ustazPos, x: endPos.x, y: endPos.y };
        this.draw();
        if (onComplete) onComplete();
      }
    };
    this.animationFrame = requestAnimationFrame(animate);
  }

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width / window.devicePixelRatio;
    const h = this.canvas.height / window.devicePixelRatio;
    
    ctx.clearRect(0, 0, w, h);
    
    // Draw beautiful dark emerald/slate map background
    ctx.fillStyle = "#0c1514";
    ctx.fillRect(0, 0, w, h);
    
    // Draw subtle map gridlines
    ctx.strokeStyle = "rgba(16, 185, 129, 0.05)";
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Draw green zones (parks / green areas)
    ctx.fillStyle = "rgba(16, 185, 129, 0.06)";
    ctx.beginPath();
    ctx.arc(w * 0.6, h * 0.75, Math.min(w, h) * 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(4, 120, 87, 0.04)";
    ctx.beginPath();
    ctx.fillRect(w * 0.15, h * 0.15, w * 0.3, h * 0.2);
    ctx.fill();

    // Draw roads / highway paths
    ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    ctx.lineWidth = 4;
    this.roads.forEach(road => {
      ctx.beginPath();
      ctx.moveTo(road[0].x * w, road[0].y * h);
      for (let i = 1; i < road.length; i++) {
        ctx.lineTo(road[i].x * w, road[i].y * h);
      }
      ctx.stroke();
    });

    // Draw minor road linings
    ctx.strokeStyle = "rgba(16, 185, 129, 0.12)";
    ctx.lineWidth = 1.5;
    this.roads.forEach(road => {
      ctx.beginPath();
      ctx.moveTo(road[0].x * w, road[0].y * h);
      for (let i = 1; i < road.length; i++) {
        ctx.lineTo(road[i].x * w, road[i].y * h);
      }
      ctx.stroke();
    });

    // Draw landmarks
    this.landmarks.forEach(lm => {
      const lx = lm.x * w;
      const ly = lm.y * h;
      
      // Small icon background
      ctx.fillStyle = "rgba(16, 185, 129, 0.15)";
      ctx.beginPath();
      ctx.arc(lx, ly, 10, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = "#10b981";
      ctx.beginPath();
      ctx.arc(lx, ly, 3, 0, Math.PI * 2);
      ctx.fill();
      
      // Text labels
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.font = "8px 'Outfit', 'Inter', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(lm.name, lx, ly + 20);
    });

    // Draw searching radar ripple if active
    if (this.isSearching) {
      const ux = this.userPos.x * w;
      const uy = this.userPos.y * h;
      
      ctx.strokeStyle = "rgba(16, 185, 129, " + (1 - this.searchingRadius / 150) + ")";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ux, uy, this.searchingRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "rgba(16, 185, 129, 0.05)";
      ctx.beginPath();
      ctx.arc(ux, uy, this.searchingRadius * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw path between Ustaz and User if Ustaz exists
    if (this.ustazPos) {
      const ux = this.userPos.x * w;
      const uy = this.userPos.y * h;
      const dx = this.ustazPos.x * w;
      const dy = this.ustazPos.y * h;

      // Draw dotted path line
      ctx.strokeStyle = "#eab308"; // Amber gold path
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(dx, dy);
      // Let's make the route slightly curved for high-end aesthetics
      const midX = (dx + ux) / 2 + (dy - uy) * 0.2;
      const midY = (dy + uy) / 2 - (dx - ux) * 0.2;
      ctx.quadraticCurveTo(midX, midY, ux, uy);
      ctx.stroke();
      ctx.setLineDash([]); // Reset
    }

    // Draw User Location Pin
    const ux = this.userPos.x * w;
    const uy = this.userPos.y * h;
    
    // Pulse animation for user location
    const pulseRadius = 15 + Math.sin(Date.now() / 180) * 4;
    ctx.fillStyle = "rgba(234, 179, 8, 0.15)"; // Yellow glow
    ctx.beginPath();
    ctx.arc(ux, uy, pulseRadius, 0, Math.PI * 2);
    ctx.fill();

    // Golden Pin Base
    ctx.fillStyle = "#eab308";
    ctx.beginPath();
    ctx.arc(ux, uy, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Pin icon (small mosque dome or dot)
    ctx.fillStyle = "#0c1514";
    ctx.beginPath();
    ctx.arc(ux, uy, 3, 0, Math.PI * 2);
    ctx.fill();

    // Draw Ustaz Pin if set
    if (this.ustazPos) {
      const dx = this.ustazPos.x * w;
      const dy = this.ustazPos.y * h;

      // Pulse ring for Ustaz
      ctx.strokeStyle = "rgba(16, 185, 129, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(dx, dy, 18 + Math.sin(Date.now() / 150) * 3, 0, Math.PI * 2);
      ctx.stroke();

      // Green circular bubble frame
      ctx.fillStyle = "#10b981";
      ctx.beginPath();
      ctx.arc(dx, dy, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Avatar Text / Emoji
      ctx.fillStyle = "#ffffff";
      ctx.font = "14px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.ustazPos.avatar || "👨‍💼", dx, dy);

      // Label below Pin
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 8px 'Outfit', 'Inter', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      
      // Draw background tag for text
      const tagText = this.ustazPos.name ? this.ustazPos.name.split(' ')[0] : 'Ustaz';
      const textWidth = ctx.measureText(tagText).width;
      ctx.fillStyle = "rgba(12, 21, 20, 0.85)";
      ctx.fillRect(dx - textWidth / 2 - 4, dy + 20, textWidth + 8, 12);
      ctx.strokeStyle = "rgba(16, 185, 129, 0.4)";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(dx - textWidth / 2 - 4, dy + 20, textWidth + 8, 12);

      ctx.fillStyle = "#10b981";
      ctx.fillText(tagText, dx, dy + 22);
    }
  }
}
