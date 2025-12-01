(function () {
  const MOSCOW_CENTER = [55.751244, 37.618423];

  const state = {
    userLocation: null,
    activeTab: 'cashback', // 'cashback' | 'near'
    mode: 'main', // 'main' | 'guide' | 'rain'
    markers: [],
    guidePlaces: [],
    guideIndex: 0
  };

  const map = L.map('map', {
    zoomControl: false
  }).setView(MOSCOW_CENTER, 11);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  const mainPanel = document.getElementById('mainPanel');
  const guidePanel = document.getElementById('guidePanel');
  const rainPanel = document.getElementById('rainPanel');

  const tabs = document.querySelectorAll('.tab');
  const searchInput = document.getElementById('searchInput');
  const placesList = document.getElementById('placesList');
  const guideBanner = document.getElementById('guideBanner');
  const rainBanner = document.getElementById('rainBanner');

  const guideBackBtn = document.getElementById('guideBackBtn');
  const guideProgress = document.getElementById('guideProgress');
  const guideStepLabel = document.getElementById('guideStepLabel');
  const guidePlaceCard = document.getElementById('guidePlaceCard');
  const guideShowOnMap = document.getElementById('guideShowOnMap');
  const guideNextBtn = document.getElementById('guideNextBtn');

  const rainBackBtn = document.getElementById('rainBackBtn');
  const rainList = document.getElementById('rainList');

  function renderMarkers(places) {
    state.markers.forEach(m => map.removeLayer(m));
    state.markers = [];

    places.forEach(place => {
      const marker = L.marker([place.lat, place.lng]).addTo(map);
      marker.bindPopup(`<b>${place.name}</b><br>${place.address}<br>${place.category}<br>${place.cashbackPercent}% кэшбэк`);
      state.markers.push(marker);
    });
  }

  function createPlaceCard(place) {
    const div = document.createElement('div');
    div.className = 'place-card';
    div.innerHTML = `
      <div class="place-card__title">${place.name}</div>
      <div class="place-card__address">${place.address}</div>
      <div class="place-card__meta">
        <span>${place.category}</span>
        <span class="place-card__cashback">${place.cashbackPercent}% кэшбэк</span>
      </div>
    `;
    div.addEventListener('click', () => {
      map.setView([place.lat, place.lng], 15);
    });
    return div;
  }

  function getDistanceKm(a, b) {
    const R = 6371;
    const dLat = (b[0] - a[0]) * Math.PI / 180;
    const dLng = (b[1] - a[1]) * Math.PI / 180;
    const lat1 = a[0] * Math.PI / 180;
    const lat2 = b[0] * Math.PI / 180;

    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);

    const aa = sinDLat * sinDLat +
      sinDLng * sinDLng * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
    return R * c;
  }

  function getUserCenter() {
    return state.userLocation || MOSCOW_CENTER;
  }

  function applyMainFilters() {
    const q = searchInput.value.trim().toLowerCase();
    let filtered = window.PLACES.slice();

    if (q) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }

    if (state.activeTab === 'cashback') {
      filtered = filtered.filter(p => p.cashbackPercent >= 6);
    } else if (state.activeTab === 'near') {
      filtered = filtered
        .map(p => ({
          ...p,
          _dist: getDistanceKm(getUserCenter(), [p.lat, p.lng])
        }))
        .sort((a, b) => a._dist - b._dist);
    }

    renderMarkers(filtered);

    placesList.innerHTML = '';
    filtered.forEach(p => {
      placesList.appendChild(createPlaceCard(p));
    });
  }

  function switchMode(newMode) {
    state.mode = newMode;

    mainPanel.classList.remove('panel--active');
    guidePanel.classList.remove('panel--active');
    rainPanel.classList.remove('panel--active');

    if (newMode === 'main') {
      mainPanel.classList.add('panel--active');
      applyMainFilters();
    } else if (newMode === 'guide') {
      guidePanel.classList.add('panel--active');
    } else if (newMode === 'rain') {
      rainPanel.classList.add('panel--active');
    }
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('tab--active'));
      tab.classList.add('tab--active');
      state.activeTab = tab.dataset.tab;
      applyMainFilters();
    });
  });

  searchInput.addEventListener('input', () => {
    if (state.mode === 'main') applyMainFilters();
  });

  guideBanner.addEventListener('click', () => {
    const center = getUserCenter();
    const cafes = window.PLACES.filter(p => p.category === 'Рестораны и кафе')
      .map(p => ({
        ...p,
        _dist: getDistanceKm(center, [p.lat, p.lng])
      }))
      .sort((a, b) => a._dist - b._dist)
      .slice(0, 5);

    state.guidePlaces = cafes;
    state.guideIndex = 0;

    buildGuideProgress();
    renderGuideStep();
    switchMode('guide');
  });

  function buildGuideProgress() {
    guideProgress.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const dot = document.createElement('div');
      dot.className = 'guide-dot';
      if (i < state.guideIndex) {
        dot.classList.add('guide-dot--done');
      } else if (i === state.guideIndex) {
        dot.classList.add('guide-dot--active');
      }
      dot.textContent = i + 1;
      guideProgress.appendChild(dot);
    }
  }

  function renderGuideStep() {
    const step = state.guideIndex;
    const place = state.guidePlaces[step];

    guideStepLabel.textContent = `Шаг ${step + 1} из 5`;

    if (!place) {
      guidePlaceCard.innerHTML = '<div class="place-card__title">Гид завершён 🎉</div>';
      guideNextBtn.disabled = true;
      guideShowOnMap.disabled = true;
      return;
    }

    guidePlaceCard.innerHTML = `
      <div class="place-card__title">${place.name}</div>
      <div class="place-card__address">${place.address}</div>
      <div class="place-card__meta">
        <span>${place.category}</span>
        <span class="place-card__cashback">${place.cashbackPercent}% кэшбэк</span>
      </div>
    `;

    guideNextBtn.disabled = false;
    guideShowOnMap.disabled = false;

    map.setView([place.lat, place.lng], 15);
  }

  guideShowOnMap.addEventListener('click', () => {
    const place = state.guidePlaces[state.guideIndex];
    if (!place) return;
    map.setView([place.lat, place.lng], 15);
  });

  guideNextBtn.addEventListener('click', () => {
    if (state.guideIndex < 4) {
      state.guideIndex += 1;
      buildGuideProgress();
      renderGuideStep();
    } else {
      state.guideIndex = 5;
      buildGuideProgress();
      renderGuideStep();
    }
  });

  guideBackBtn.addEventListener('click', () => {
    switchMode('main');
  });

  rainBanner.addEventListener('click', () => {
    const high = window.PLACES.filter(p => p.cashbackPercent >= 7);
    rainList.innerHTML = '';
    high.forEach(p => {
      rainList.appendChild(createPlaceCard(p));
    });
    renderMarkers(high);
    switchMode('rain');
  });

  rainBackBtn.addEventListener('click', () => {
    switchMode('main');
  });

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        state.userLocation = [pos.coords.latitude, pos.coords.longitude];
        const userMarker = L.circleMarker(state.userLocation, {
          radius: 6,
          color: '#4cc3ff',
          fillColor: '#4cc3ff',
          fillOpacity: 1
        }).addTo(map);
        userMarker.bindPopup('Вы здесь');
        map.setView(state.userLocation, 12);
        applyMainFilters();
      },
      () => {
        applyMainFilters();
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  } else {
    applyMainFilters();
  }
})();