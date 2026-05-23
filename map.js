// AgamaKu Real Interactive Map Engine (Leaflet.js)
class AgamaKuMap {
  constructor(containerId, userLatLng = { lat: 3.1340, lng: 101.6866 }) {
    this.containerId = containerId;
    this.userLatLng = userLatLng;
    this.ustazMarker = null;
    this.routeLine = null;
    this.isSearching = false;
    this.searchCircle = null;

    // Check if Leaflet is loaded
    if (typeof L === 'undefined') {
      console.error('Leaflet is not loaded!');
      return;
    }

    // Initialize map
    this.map = L.map(containerId, {
      zoomControl: false,
      attributionControl: false
    }).setView([userLatLng.lat, userLatLng.lng], 15);

    // Use CartoDB Dark Matter for the emerald/dark theme aesthetic
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    }).addTo(this.map);

    // Draw user location pin
    this.userMarker = L.marker([userLatLng.lat, userLatLng.lng], {
      icon: this._createAvatarIcon('🧑', false)
    }).addTo(this.map);

    // Handle container resize when view changes
    setTimeout(() => {
      this.map.invalidateSize();
    }, 100);
  }

  resize() {
    if (this.map) {
      this.map.invalidateSize();
    }
  }

  _createAvatarIcon(emoji, isUstaz = false) {
    const color = isUstaz ? '#10b981' : '#eab308';
    const animationClass = isUstaz ? 'agamaku-marker agamaku-marker-pulse' : 'agamaku-marker';
    return L.divIcon({
      html: `
        <div style="
          width: 32px; height: 32px;
          background: ${color};
          border: 2px solid #fff;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.5);
          position: relative;
        ">${emoji}</div>
      `,
      className: animationClass,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16]
    });
  }

  setUstaz(ustazPos) {
    // ustazPos: { lat, lng, avatar, name }
    if (this.ustazMarker) {
      this.map.removeLayer(this.ustazMarker);
    }

    this.ustazMarker = L.marker([ustazPos.lat, ustazPos.lng], {
      icon: this._createAvatarIcon(ustazPos.avatar || '👨‍🏫', true)
    }).addTo(this.map);

    // Add popup with name
    const shortName = ustazPos.name ? ustazPos.name.split(' ')[0] : 'Ustaz';
    this.ustazMarker.bindPopup(`<b>${shortName}</b>`).openPopup();

    // Fit bounds to show both user and ustaz
    const bounds = L.latLngBounds(
      [this.userLatLng.lat, this.userLatLng.lng],
      [ustazPos.lat, ustazPos.lng]
    );
    this.map.fitBounds(bounds, { padding: [50, 50] });
  }

  startSearching() {
    this.isSearching = true;
    
    this.searchCircle = L.circle([this.userLatLng.lat, this.userLatLng.lng], {
      color: '#10b981',
      fillColor: '#10b981',
      fillOpacity: 0.1,
      radius: 50
    }).addTo(this.map);

    let radius = 50;
    const animate = () => {
      if (!this.isSearching || !this.searchCircle) return;
      radius += 5;
      if (radius > 1000) radius = 50; // Max 1km pulse
      this.searchCircle.setRadius(radius);
      requestAnimationFrame(animate);
    };
    animate();
  }

  stopSearching() {
    this.isSearching = false;
    if (this.searchCircle) {
      this.map.removeLayer(this.searchCircle);
      this.searchCircle = null;
    }
  }

  async animateUstazJourney(startLatLng, endLatLng, durationMs, onUpdate, onComplete) {
    // 1. Fetch route from OSRM
    let routeCoords = [];
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${startLatLng.lng},${startLatLng.lat};${endLatLng.lng},${endLatLng.lat}?geometries=geojson&steps=false`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.code === 'Ok' && data.routes.length > 0) {
        // GeoJSON coordinates are [lng, lat] — Leaflet needs [lat, lng]
        routeCoords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
      } else {
        throw new Error('No route found');
      }
    } catch (e) {
      console.warn('OSRM routing failed, falling back to straight line:', e);
      routeCoords = [
        [startLatLng.lat, startLatLng.lng],
        [endLatLng.lat, endLatLng.lng]
      ];
    }

    // 2. Draw the route polyline
    if (this.routeLine) this.map.removeLayer(this.routeLine);
    this.routeLine = L.polyline(routeCoords, {
      color: '#eab308',      // AgamaKu gold
      weight: 4,
      opacity: 0.8,
      dashArray: '10, 8'     // Dashed line
    }).addTo(this.map);

    // 3. Fit bounds to the route
    this.map.fitBounds(this.routeLine.getBounds(), { padding: [50, 50] });

    // 4. Animate marker along the route
    if (!this.ustazMarker) {
      this.ustazMarker = L.marker([startLatLng.lat, startLatLng.lng], {
        icon: this._createAvatarIcon('👳‍♂️', true)
      }).addTo(this.map);
    }

    const startTime = performance.now();
    const totalPoints = routeCoords.length;

    this.isJourneyAnimating = true;
    const animate = (currentTime) => {
      if (!this.isJourneyAnimating) {
        this.ustazMarker.setLatLng(routeCoords[totalPoints - 1]);
        return; // stop instantly
      }
      
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      
      // Calculate which segment we're on
      const pointIndex = Math.floor(progress * (totalPoints - 1));
      const segmentProgress = (progress * (totalPoints - 1)) - pointIndex;
      
      // Interpolate between current and next point
      const currentPoint = routeCoords[Math.min(pointIndex, totalPoints - 1)];
      const nextPoint = routeCoords[Math.min(pointIndex + 1, totalPoints - 1)];
      
      const lat = currentPoint[0] + (nextPoint[0] - currentPoint[0]) * segmentProgress;
      const lng = currentPoint[1] + (nextPoint[1] - currentPoint[1]) * segmentProgress;
      
      this.ustazMarker.setLatLng([lat, lng]);

      if (onUpdate) onUpdate(progress);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.isJourneyAnimating = false;
        this.ustazMarker.setLatLng(routeCoords[totalPoints - 1]);
        if (onComplete) onComplete();
      }
    };

    requestAnimationFrame(animate);
  }

  stopJourneyAnimation() {
    this.isJourneyAnimating = false;
  }

  // Smoothly interpolate ustaz marker to a new GPS position (for real-time tracking)
  updateUstazPosition(newLatLng) {
    if (!this.ustazMarker) return;
    
    const currentLatLng = this.ustazMarker.getLatLng();
    const startLat = currentLatLng.lat;
    const startLng = currentLatLng.lng;
    const endLat = newLatLng.lat;
    const endLng = newLatLng.lng;
    
    // If the movement is very small (<1 meter), skip animation
    const dist = this.getDistanceMeters(startLat, startLng, endLat, endLng);
    if (dist < 1) return;
    
    // Smooth interpolation over 800ms
    const duration = 800;
    const startTime = performance.now();
    
    if (this._positionAnimFrame) cancelAnimationFrame(this._positionAnimFrame);
    
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic for natural deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      
      const lat = startLat + (endLat - startLat) * eased;
      const lng = startLng + (endLng - startLng) * eased;
      
      this.ustazMarker.setLatLng([lat, lng]);
      
      if (progress < 1) {
        this._positionAnimFrame = requestAnimationFrame(animate);
      }
    };
    
    this._positionAnimFrame = requestAnimationFrame(animate);
  }

  // Draw a static route polyline on the map (no marker animation)
  async drawRoute(startLatLng, endLatLng, fitBounds = true) {
    let routeCoords = [];
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${startLatLng.lng},${startLatLng.lat};${endLatLng.lng},${endLatLng.lat}?geometries=geojson&steps=false`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.code === 'Ok' && data.routes.length > 0) {
        routeCoords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
      } else {
        throw new Error('No route found');
      }
    } catch (e) {
      console.warn('OSRM routing failed, falling back to straight line:', e);
      routeCoords = [
        [startLatLng.lat, startLatLng.lng],
        [endLatLng.lat, endLatLng.lng]
      ];
    }

    if (this.routeLine) this.map.removeLayer(this.routeLine);
    this.routeLine = L.polyline(routeCoords, {
      color: '#eab308',
      weight: 4,
      opacity: 0.8,
      dashArray: '10, 8'
    }).addTo(this.map);

    if (fitBounds) {
      this.map.fitBounds(this.routeLine.getBounds(), { padding: [50, 50] });
    }
    return routeCoords;
  }

  // Calculate distance in meters between two lat/lng points (Haversine formula)
  getDistanceMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Earth radius in meters
    const toRad = (deg) => deg * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  destroy() {
    if (this._positionAnimFrame) cancelAnimationFrame(this._positionAnimFrame);
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
}
