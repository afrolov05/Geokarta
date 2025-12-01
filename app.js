// app.js
// Ожидается, что PLACES уже загружен из places.js (через <script src="places.js">)

// ---------------------- ГЛОБАЛЬНОЕ СОСТОЯНИЕ ----------------------

const MOSCOW_CENTER = [55.7558, 37.6173];
const MOSCOW_ZOOM = 11;

let map;
let markersLayer;
let userLocation = null;

let currentMode = "cashback"; // 'cashback' | 'nearby' | 'guide'
let guidePlaces = [];          // 5 ближайших ресторанов
let currentGuideStep = 1;
let guideHighlightCircle = null;

// Кэш DOM-элементов
const searchInput = document.getElementById("searchInput");
const filterCashbackBtn = document.getElementById("filterCashbackBtn");
const filterNearbyBtn = document.getElementById("filterNearbyBtn");
// фильтр "Категории" больше НЕ используем

const guideEntry = document.getElementById("guideEntry");   // карточка "Гид по району"
const guidePanel = document.getElementById("guidePanel");   // развёрнутый блок гида
const guideStepsContainer = document.getElementById("guideSteps");
const guideStepTitle = document.getElementById("guideStepTitle");
const guideCardName = document.getElementById("guideCardName");
const guideCardAddress = document.getElementById("guideCardAddress");
const guideCardCashback = document.getElementById("guideCardCashback");

// блок "Осадки кэшбэка" просто как баннер, без логики
const pointsListContainer = document.getElementById("pointsList");

// ---------------------- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ----------------------

// Хаверсин для расстояния (в метрах)
function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} м`;
  return `${(meters / 1000).toFixed(1)} км`;
}

// ---------------------- НАСТРОЙКА КАРТЫ ----------------------

function initMap() {
  map = L.map("map", {
    center: MOSCOW_CENTER,
    zoom: MOSCOW_ZOOM,
    zoomControl: false
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);

  // Пытаемся получить геолокацию пользователя
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };
        map.setView([userLocation.lat, userLocation.lng], 13);

        // Рисуем маленький маркер пользователя
        L.circleMarker([userLocation.lat, userLocation.lng], {
          radius: 5,
          color: "#ff3b30",
          fillColor: "#ff3b30",
          fillOpacity: 1
        })
          .addTo(map)
          .bindPopup("Вы здесь");
      },
      () => {
        // ничего страшного — останемся в центре Москвы
      },
      {
        enableHighAccuracy: true,
        timeout: 5000
      }
    );
  }

  // Рисуем маркеры для режима "Ваш кэшбэк" по умолчанию
  renderMarkers(PLACES);
}

// ---------------------- МАРКЕРЫ ----------------------

const markerById = new Map();

function clearMarkers() {
  markerById.clear();
  markersLayer.clearLayers();
  if (guideHighlightCircle) {
    map.removeLayer(guideHighlightCircle);
    guideHighlightCircle = null;
  }
}

function renderMarkers(places) {
  clearMarkers();

  places.forEach((place) => {
    const marker = L.marker([place.lat, place.lng]).addTo(markersLayer);
    marker.bindPopup(
      `<strong>${place.name}</strong><br>${place.address}<br>Кэшбэк: ${place.cashbackPercent}%`
    );
    markerById.set(place.id, marker);
  });
}

// Зеленый подсвет для текущей точки гида
function highlightGuidePlace(place) {
  if (!place) return;
  if (guideHighlightCircle) {
    map.removeLayer(guideHighlightCircle);
    guideHighlightCircle = null;
  }

  guideHighlightCircle = L.circleMarker([place.lat, place.lng], {
    radius: 14,
    color: "#2ecc71",
    fillColor: "#2ecc71",
    fillOpacity: 0.4,
    weight: 3
  }).addTo(map);

  map.panTo([place.lat, place.lng]);
}

// ---------------------- РЕЖИМЫ / ФИЛЬТРЫ ----------------------

function setMode(mode) {
  currentMode = mode;

  // Сбрасываем визуальное состояние кнопок
  filterCashbackBtn.classList.remove("active");
  filterNearbyBtn.classList.remove("active");
  guideEntry.classList.remove("active");
  guidePanel.classList.remove("open");

  if (mode === "cashback") {
    filterCashbackBtn.classList.add("active");
    renderMarkers(PLACES);
    renderPointsList(PLACES);
  }

  if (mode === "nearby") {
    filterNearbyBtn.classList.add("active");
    const basePoint = userLocation || {
      lat: MOSCOW_CENTER[0],
      lng: MOSCOW_CENTER[1]
    };
    const sorted = [...PLACES].sort((a, b) => {
      const da = distanceMeters(basePoint.lat, basePoint.lng, a.lat, a.lng);
      const db = distanceMeters(basePoint.lat, basePoint.lng, b.lat, b.lng);
      return da - db;
    });
    const nearest = sorted.slice(0, 20);
    renderMarkers(nearest);
    renderPointsList(nearest);
  }

  if (mode === "guide") {
    guideEntry.classList.add("active");
    guidePanel.classList.add("open");
    prepareGuidePlaces();
  }
}

// ---------------------- ГИД ПО РАЙОНУ ----------------------

// выбираем 5 ближайших ресторанов
function prepareGuidePlaces() {
  const restaurants = PLACES.filter(
    (p) => p.category === "Рестораны и кафе"
  );

  const basePoint = userLocation || {
    lat: MOSCOW_CENTER[0],
    lng: MOSCOW_CENTER[1]
  };

  const sorted = restaurants
    .map((p) => ({
      ...p,
      distance: distanceMeters(basePoint.lat, basePoint.lng, p.lat, p.lng)
    }))
    .sort((a, b) => a.distance - b.distance);

  guidePlaces = sorted.slice(0, 5);

  // На карте показываем только эти 5 ресторанов
  renderMarkers(guidePlaces);
  renderPointsList(guidePlaces);

  // Обновляем UI полоски шагов и карточки
  currentGuideStep = 1;
  updateGuideUI();
}

function updateGuideUI() {
  if (!guidePlaces.length) {
    guideStepTitle.textContent = "Рядом нет ресторанов :(";
    guideCardName.textContent = "";
    guideCardAddress.textContent = "";
    guideCardCashback.textContent = "";
    return;
  }

  // Обновляем активный кружок 1–5
  if (guideStepsContainer) {
    const stepButtons = guideStepsContainer.querySelectorAll("[data-step]");
    stepButtons.forEach((btn) => {
      const step = Number(btn.getAttribute("data-step"));
      if (step === currentGuideStep) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  const idx = currentGuideStep - 1;
  const place = guidePlaces[idx] || guidePlaces[guidePlaces.length - 1];

  guideStepTitle.textContent = `${currentGuideStep}. Посетите ${place.name}`;
  guideCardName.textContent = place.name;
  guideCardAddress.textContent = place.address;
  guideCardCashback.textContent = `${place.cashbackPercent}% кэшбэка`;

  highlightGuidePlace(place);
}

// ---------------------- СПИСОК ТОЧЕК ВНИЗУ ----------------------

function renderPointsList(places) {
  if (!pointsListContainer) return;
  pointsListContainer.innerHTML = "";

  places.forEach((place) => {
    const item = document.createElement("div");
    item.className = "point-item";

    item.innerHTML = `
      <div class="point-title">${place.name}</div>
      <div class="point-subtitle">${place.address}</div>
      <div class="point-meta">${place.category} • ${place.cashbackPercent}% кэшбэка</div>
    `;

    item.addEventListener("click", () => {
      const marker = markerById.get(place.id);
      if (marker) {
        map.setView(marker.getLatLng(), 15);
        marker.openPopup();
      }
      if (currentMode === "guide") {
        const i = guidePlaces.findIndex((p) => p.id === place.id);
        if (i >= 0) {
          currentGuideStep = i + 1;
          updateGuideUI();
        }
      }
    });

    pointsListContainer.appendChild(item);
  });
}

// ---------------------- ПОИСК ----------------------

function applySearchFilter() {
  const term = (searchInput.value || "").trim().toLowerCase();
  let baseList = PLACES;

  if (currentMode === "nearby") {
    const basePoint = userLocation || {
      lat: MOSCOW_CENTER[0],
      lng: MOSCOW_CENTER[1]
    };
    baseList = [...PLACES].sort((a, b) => {
      const da = distanceMeters(basePoint.lat, basePoint.lng, a.lat, a.lng);
      const db = distanceMeters(basePoint.lat, basePoint.lng, b.lat, b.lng);
      return da - db;
    });
  } else if (currentMode === "guide") {
    baseList = guidePlaces;
  }

  const filtered = baseList.filter((p) => {
    if (!term) return true;
    return (
      p.name.toLowerCase().includes(term) ||
      p.address.toLowerCase().includes(term)
    );
  });

  renderMarkers(filtered);
  renderPointsList(filtered);
}

// ---------------------- СЛУШАТЕЛИ ----------------------

function initUI() {
  // фильтры
  filterCashbackBtn.addEventListener("click", () => setMode("cashback"));
  filterNearbyBtn.addEventListener("click", () => setMode("nearby"));

  // клик по карточке "Гид по району"
  if (guideEntry) {
    guideEntry.addEventListener("click", () => setMode("guide"));
  }

  // клики по шагам 1–5
  if (guideStepsContainer) {
    guideStepsContainer.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-step]");
      if (!btn) return;
      const step = Number(btn.getAttribute("data-step"));
      if (!step || step < 1 || step > 5) return;
      currentGuideStep = step;
      updateGuideUI();
    });
  }

  // поиск
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      applySearchFilter();
    });
  }

  // режим по умолчанию
  setMode("cashback");
}

// ---------------------- СТАРТ ----------------------

document.addEventListener("DOMContentLoaded", () => {
  initMap();
  initUI();
});
