// Глобальное состояние
let map;
let markersLayer;
let userLocation = null;
let currentTab = "cashback"; // 'cashback' | 'nearby'
let currentMode = "main"; // 'main' | 'guide' | 'rain'

// Для гида по району
let guidePlaces = []; // массив из 5 ближайших ресторанов
let guideStepIndex = 0; // 0..4

// Утилита расстояния (метры)
function distanceMeters(a, b) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sin1 = Math.sin(dLat / 2);
  const sin2 = Math.sin(dLng / 2);

  const c =
    2 *
    Math.atan2(
      Math.sqrt(
        sin1 * sin1 +
          Math.cos(lat1) * Math.cos(lat2) * sin2 * sin2
      ),
      Math.sqrt(
        1 -
          (sin1 * sin1 +
            Math.cos(lat1) * Math.cos(lat2) * sin2 * sin2)
      )
    );

  return R * c;
}

function initMap() {
  const moscowCenter = [55.751244, 37.618423];

  map = L.map("map", {
    center: moscowCenter,
    zoom: 11,
    zoomControl: false,
  });

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution: "&copy; OpenStreetMap contributors",
    }
  ).addTo(map);

  markersLayer = L.layerGroup().addTo(map);

  // Пытаемся получить геолокацию
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        map.setView([userLocation.lat, userLocation.lng], 13);
        renderMarkers();
      },
      () => {
        userLocation = {
          lat: moscowCenter[0],
          lng: moscowCenter[1],
        };
        renderMarkers();
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  } else {
    userLocation = {
      lat: moscowCenter[0],
      lng: moscowCenter[1],
    };
    renderMarkers();
  }
}

// Отрисовка маркеров на карте в зависимости от табов и режимов
function renderMarkers() {
  if (!window.PLACES) return;

  markersLayer.clearLayers();

  let places = window.PLACES.slice();

  // Поиск
  const q = document
    .getElementById("search-input")
    .value.trim()
    .toLowerCase();
  if (q) {
    places = places.filter((p) =>
      (p.name + " " + p.address)
        .toLowerCase()
        .includes(q)
    );
  }

  // Таб "Рядом с вами"
  if (currentTab === "nearby" && userLocation) {
    places = places.filter((p) => {
      const d = distanceMeters(userLocation, {
        lat: p.lat,
        lng: p.lng,
      });
      return d <= 2000; // 2 км
    });
  }

  // Режим "осадки кешбэка" — оставляем только высокий процент
  if (currentMode === "rain") {
    places = places
      .filter((p) => p.cashbackPercent >= 6)
      .sort((a, b) => b.cashbackPercent - a.cashbackPercent);
  }

  places.forEach((p) => {
    const marker = L.marker([p.lat, p.lng]);
    const popupHtml = `
      <div style="font-size:13px;">
        <strong>${p.name}</strong><br/>
        <span>${p.address}</span><br/>
        <span>Кешбэк: ${p.cashbackPercent}%</span>
      </div>
    `;
    marker.bindPopup(popupHtml);
    markersLayer.addLayer(marker);

    // Сохраняем ссылку на маркер в объекте (для гида)
    p._marker = marker;
  });
}

// Переключение табов
function setTab(tab) {
  currentTab = tab;

  document
    .querySelectorAll(".tab-button")
    .forEach((btn) =>
      btn.classList.remove("tab-active")
    );
  document
    .querySelector(
      `.tab-button[data-tab="${tab}"]`
    )
    .classList.add("tab-active");

  if (currentMode === "main" || currentMode === "rain") {
    renderMarkers();
  }
}

// Переключение режимов (main / guide / rain)
function setMode(mode) {
  currentMode = mode;

  const mainPanel = document.getElementById("main-panel");
  const guidePanel = document.getElementById("guide-panel");
  const rainPanel = document.getElementById("rain-panel");

  mainPanel.classList.add("hidden");
  guidePanel.classList.add("hidden");
  rainPanel.classList.add("hidden");

  if (mode === "main") {
    mainPanel.classList.remove("hidden");
    document
      .getElementById("main-panel")
      .classList.add("panel-active");
    renderMarkers();
  } else if (mode === "guide") {
    guidePanel.classList.remove("hidden");
    document
      .getElementById("main-panel")
      .classList.remove("panel-active");
  } else if (mode === "rain") {
    rainPanel.classList.remove("hidden");
    document
      .getElementById("main-panel")
      .classList.remove("panel-active");
    buildRainList();
    renderMarkers();
  }
}

// ==================== ГИД ПО РАЙОНУ ====================

// Построить список 5 ближайших ресторанов
function buildGuidePlaces() {
  if (!userLocation || !window.PLACES) return [];

  const restaurants = window.PLACES.filter(
    (p) => p.category === "Рестораны и кафе"
  );

  const withDistance = restaurants.map((p) => ({
    place: p,
    dist: distanceMeters(userLocation, {
      lat: p.lat,
      lng: p.lng,
    }),
  }));

  withDistance.sort((a, b) => a.dist - b.dist);

  return withDistance.slice(0, 5).map((x) => x);
}

// Отрисовать прогресс-бар шагов
function renderGuideSteps() {
  const container = document.getElementById(
    "guide-steps"
  );
  container.innerHTML = "";

  for (let i = 0; i < 5; i++) {
    const stepEl = document.createElement("div");
    stepEl.className = "guide-step";
    if (i < guideStepIndex) {
      stepEl.classList.add("completed");
    } else if (i === guideStepIndex) {
      stepEl.classList.add("active");
    }

    const circle = document.createElement("div");
    circle.className = "guide-step-circle";
    circle.textContent = i + 1;

    const line = document.createElement("div");
    line.className = "guide-step-line";

    stepEl.appendChild(circle);
    stepEl.appendChild(line);
    container.appendChild(stepEl);
  }
}

// Обновить текст и карточку текущего шага
function renderGuideCard() {
  const label = document.getElementById(
    "guide-step-label"
  );
  label.textContent = `Шаг ${
    guideStepIndex + 1
  } из 5`;

  const card = document.getElementById("guide-card");
  const nameEl = card.querySelector(
    ".guide-place-name"
  );
  const addrEl = card.querySelector(
    ".guide-place-address"
  );
  const distEl = card.querySelector(
    ".guide-place-distance"
  );

  const item = guidePlaces[guideStepIndex];
  if (!item) {
    nameEl.textContent = "Гид завершён!";
    addrEl.textContent =
      "Вы отметили все места в этом маршруте.";
    distEl.textContent = "";
    return;
  }

  nameEl.textContent = item.place.name;
  addrEl.textContent = item.place.address;

  const meters = Math.round(item.dist);
  const km = (meters / 1000).toFixed(1);
  const distText =
    meters < 1000
      ? `${meters} м от вас`
      : `${km} км от вас`;

  distEl.textContent = distText;

  // панорамируем карту на это место
  map.setView(
    [item.place.lat, item.place.lng],
    14
  );
  if (item.place._marker) {
    item.place._marker.openPopup();
  }
}

// Инициализация гида
function openGuide() {
  if (!userLocation) {
    alert(
      "Не удалось получить геопозицию. Гид по району работает лучше, если разрешить доступ к местоположению."
    );
  }

  guidePlaces = buildGuidePlaces();
  guideStepIndex = 0;

  setMode("guide");
  renderGuideSteps();
  renderGuideCard();
}

// Перейти к следующему шагу
function completeGuideStep() {
  if (guideStepIndex < 4) {
    guideStepIndex += 1;
    renderGuideSteps();
    renderGuideCard();
  } else {
    // маршрут завершён
    guideStepIndex = 4;
    renderGuideSteps();
    renderGuideCard();
    alert("Вы прошли весь гид по району 🎉");
  }
}

// Показать текущее место на карте (кнопка)
function showGuidePlaceOnMap() {
  const item = guidePlaces[guideStepIndex];
  if (!item) return;
  map.setView(
    [item.place.lat, item.place.lng],
    15
  );
  if (item.place._marker) {
    item.place._marker.openPopup();
  }
}

// ==================== ОСАДКИ КЕШБЭКА ====================

function buildRainList() {
  const listEl = document.getElementById(
    "rain-list"
  );
  listEl.innerHTML = "";

  if (!window.PLACES) return;

  let places = window.PLACES.slice();

  // сильный кешбэк
  places = places.filter(
    (p) => p.cashbackPercent >= 6
  );

  // сортируем: сначала ближе, потом по проценту
  if (userLocation) {
    places = places
      .map((p) => ({
        place: p,
        dist: distanceMeters(userLocation, {
          lat: p.lat,
          lng: p.lng,
        }),
      }))
      .sort((a, b) => a.dist - b.dist || b.place.cashbackPercent - a.place.cashbackPercent)
      .slice(0, 10);
  } else {
    places = places
      .map((p) => ({
        place: p,
        dist: null,
      }))
      .sort(
        (a, b) =>
          b.place.cashbackPercent -
          a.place.cashbackPercent
      )
      .slice(0, 10);
  }

  places.forEach((item) => {
    const li = document.createElement("li");
    li.className = "rain-item";

    const title = document.createElement("div");
    title.className = "rain-item-title";
    title.textContent = `${item.place.name} — ${item.place.cashbackPercent}%`;

    const sub = document.createElement("div");
    sub.className = "rain-item-sub";
    const distText =
      item.dist != null
        ? item.dist < 1000
          ? `${Math.round(item.dist)} м от вас`
          : `${(item.dist / 1000).toFixed(
              1
            )} км от вас`
        : "";
    sub.textContent = `${item.place.address}${
      distText ? " • " + distText : ""
    }`;

    li.appendChild(title);
    li.appendChild(sub);
    listEl.appendChild(li);

    li.addEventListener("click", () => {
      map.setView(
        [item.place.lat, item.place.lng],
        15
      );
      if (item.place._marker) {
        item.place._marker.openPopup();
      }
    });
  });
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================

document.addEventListener(
  "DOMContentLoaded",
  () => {
    initMap();

    // Табы
    document
      .getElementById("tab-cashback")
      .addEventListener("click", () =>
        setTab("cashback")
      );
    document
      .getElementById("tab-nearby")
      .addEventListener("click", () =>
        setTab("nearby")
      );

    // Поиск
    document
      .getElementById("search-input")
      .addEventListener("input", () => {
        if (currentMode === "main" || currentMode === "rain") {
          renderMarkers();
        }
      });

    // Баннеры
    document
      .getElementById("guide-banner")
      .addEventListener("click", () => {
        openGuide();
      });

    document
      .getElementById("rain-banner")
      .addEventListener("click", () => {
        setMode("rain");
      });

    // Кнопки назад
    document
      .getElementById("guide-back")
      .addEventListener("click", () => {
        setMode("main");
      });

    document
      .getElementById("rain-back")
      .addEventListener("click", () => {
        setMode("main");
      });

    // Кнопки внутри гида
    document
      .getElementById("guide-complete-step")
      .addEventListener("click", () => {
        completeGuideStep();
      });

    document
      .getElementById("guide-show-on-map")
      .addEventListener("click", () => {
        showGuidePlaceOnMap();
      });
  }
);
