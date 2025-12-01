document.addEventListener("DOMContentLoaded", () => {
  // ---------- данные ----------
  const PLACES =
    window.PLACES && Array.isArray(window.PLACES) && window.PLACES.length
      ? window.PLACES
      : [
          // fallback, если файл places.js не подгрузился
          {
            id: "demo1",
            name: "Демо кафе",
            category: "Рестораны и кафе",
            address: "г. Москва, Тверская, д. 1",
            cashbackPercent: 5,
            lat: 55.757,
            lng: 37.615
          }
        ];

  // ---------- карта ----------
  const map = L.map("map", { zoomControl: false }).setView(
    [55.7558, 37.6173],
    11
  );

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19
  }).addTo(map);

  let markers = [];

  function renderMarkers(list) {
    markers.forEach((m) => map.removeLayer(m));
    markers = [];

    list.forEach((p) => {
      const marker = L.marker([p.lat, p.lng]).addTo(map);
      marker.bindPopup(
        `<b>${p.name}</b><br>${p.address}<br>${p.cashbackPercent}% кэшбэк`
      );
      markers.push(marker);
    });
  }

  renderMarkers(PLACES);

  // ---------- ссылки на DOM ----------
  const pointsList = document.getElementById("pointsList");
  const tabCashback = document.getElementById("tabCashback");
  const tabNear = document.getElementById("tabNear");
  const searchInput = document.getElementById("searchInput");

  const bannerGuide = document.getElementById("bannerGuide");
  const bannerRain = document.getElementById("bannerRain");

  const guideScreen = document.getElementById("guideScreen");
  const rainScreen = document.getElementById("rainScreen");
  const guideBack = document.getElementById("guideBack");
  const rainBack = document.getElementById("rainBack");
  const guideProgress = document.getElementById("guideProgress");
  const guideContent = document.getElementById("guideContent");
  const rainContent = document.getElementById("rainContent");

  // ---------- список точек внизу ----------
  function renderList(list) {
    pointsList.innerHTML = "";
    list.forEach((p) => {
      const item = document.createElement("div");
      item.className = "point-item";
      item.innerHTML = `
        <div class="point-name">${p.name}</div>
        <div class="point-address">${p.address}</div>
        <div class="point-address">${p.cashbackPercent}% кэшбэк</div>
      `;
      item.onclick = () => {
        map.setView([p.lat, p.lng], 15);
      };
      pointsList.appendChild(item);
    });
  }

  renderList(PLACES);

  // ---------- табы ----------
  tabCashback.onclick = () => {
    tabCashback.classList.add("active");
    tabNear.classList.remove("active");
    renderList(PLACES);
    renderMarkers(PLACES);
  };

  tabNear.onclick = () => {
    tabNear.classList.add("active");
    tabCashback.classList.remove("active");
    // упрощённо: сортируем по расстоянию от центра карты и берём ближайшие 20
    const center = map.getCenter();
    const withDist = PLACES.map((p) => ({
      ...p,
      dist: Math.hypot(p.lat - center.lat, p.lng - center.lng)
    }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 20);
    renderList(withDist);
    renderMarkers(withDist);
  };

  // ---------- поиск ----------
  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim().toLowerCase();
    const filtered = PLACES.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q)
    );
    renderList(filtered);
    renderMarkers(filtered);
  });

  // ---------- Гид по району ----------
  bannerGuide.onclick = () => {
    // берём только рестораны/кафе и 5 ближайших
    const cafes = PLACES.filter((p) =>
      (p.category || "").toLowerCase().includes("рест")
    );
    const center = map.getCenter();
    const nearest = cafes
      .map((p) => ({
        ...p,
        dist: Math.hypot(p.lat - center.lat, p.lng - center.lng)
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 5);

    showGuide(nearest);
  };

  function showGuide(route) {
    guideScreen.classList.remove("hidden");

    // прогресс-бар 1–5
    guideProgress.innerHTML = "";
    for (let i = 1; i <= 5; i++) {
      const step = document.createElement("div");
      step.className = "progress-step" + (i === 1 ? " active" : "");
      step.textContent = i.toString();
      guideProgress.appendChild(step);
    }

    guideContent.innerHTML = "";
    route.forEach((p, index) => {
      const card = document.createElement("div");
      card.className = "place-card";
      card.innerHTML = `
        <div class="place-name">${p.name}</div>
        <div class="place-extra">${p.address}</div>
        <div class="place-extra">${p.cashbackPercent}% кэшбэк</div>
      `;
      card.onclick = () => {
        map.setView([p.lat, p.lng], 15);
      };
      guideContent.appendChild(card);
    });
  }

  guideBack.onclick = () => {
    guideScreen.classList.add("hidden");
  };

  // ---------- Осадки кэшбэка ----------
  bannerRain.onclick = () => {
    rainScreen.classList.remove("hidden");
    const high = PLACES.filter((p) => p.cashbackPercent >= 7);

    rainContent.innerHTML = "";
    if (!high.length) {
      rainContent.textContent = "Нет точек с высоким кэшбэком.";
      return;
    }

    high.forEach((p) => {
      const card = document.createElement("div");
      card.className = "place-card";
      card.innerHTML = `
        <div class="place-name">${p.name}</div>
        <div class="place-extra">${p.address}</div>
        <div class="place-extra">${p.cashbackPercent}% кэшбэк</div>
      `;
      card.onclick = () => {
        map.setView([p.lat, p.lng], 15);
      };
      rainContent.appendChild(card);
    });
  };

  rainBack.onclick = () => {
    rainScreen.classList.add("hidden");
  };
});
