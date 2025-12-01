// app.js
// =======================================
// Geokarta – mobile-first map logic
// Использует Leaflet + window.PLACES
// =======================================

// ---- константы ----
const MOSCOW_CENTER = [55.751244, 37.618423];
const NEARBY_RADIUS_METERS = 3000; // для режима "Рядом с вами"
const HIGH_CASHBACK_THRESHOLD = 7; // "осадки кэшбэка" (>= 7%)

const ALL_PLACES = (window.PLACES || []).slice();

// ---- состояние интерфейса ----
let map;
let markersLayer;
let currentMode = "cashback"; // "cashback" | "nearby" | "categories"
let cashbackRainMode = false; // "Осадки кэшбэка"
let selectedCategories = new Set(); // для режима "Категории"
let searchQuery = "";

// состояние "Гид по району"
let guideSteps = [];      // [{ step, place }]
let activeGuideStep = 1;  // 1..5

// ---- получение ссылок на DOM ----
const $ = (id) => document.getElementById(id);

const searchInputEl       = $("searchInput");
const modeCashbackBtn     = $("modeCashbackBtn");
const modeNearbyBtn       = $("modeNearbyBtn");
const modeCategoriesBtn   = $("modeCategoriesBtn");

const cashbackFiltersPanel  = $("cashbackFiltersPanel");
const categoriesFiltersPanel = $("categoriesFiltersPanel");

const guideStepsContainer  = $("guideSteps");
const guideTitleEl         = $("guideTitle");
const guidePlaceCardEl     = $("guidePlaceCard");

const cashbackBannerEl     = $("cashbackBanner");
const placesListEl         = $("placesList");

// элементы чекбоксов фильтров категорий (если есть)
const categoryCheckboxEls = document.querySelectorAll(
  'input[name="categoryFilter"]'
);

// элементы фильтров "Ваш кэшбэк" (если есть – радиокнопки)
const cashbackFilterEls = document.querySelectorAll(
  'input[name="cashbackFilter"]'
);

// ---- инициализация карты ----
function initMap() {
  map = L.map("map", {
    center: MOSCOW_CENTER,
    zoom: 11,
    zoomControl: false,
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
}

// ---- утилиты ----
function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // meters
  const toRad = (v) => (v * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ---- фильтрация точек ----
function getFilteredPlaces() {
  let places = ALL_PLACES.slice();

  // поиск по тексту
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    places = places.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.address && p.address.toLowerCase().includes(q))
    );
  }

  // режимы
  if (currentMode === "nearby") {
    places = places.filter((p) => {
      const d = haversineDistanceMeters(
        MOSCOW_CENTER[0],
        MOSCOW_CENTER[1],
        p.lat,
        p.lng
      );
      return d <= NEARBY_RADIUS_METERS;
    });
  }

  if (currentMode === "categories" && selectedCategories.size > 0) {
    places = places.filter((p) =>
      selectedCategories.has(p.category)
    );
  }

  // "Ваш кэшбэк" – доп. фильтр по проценту (если радиокнопки есть)
  const activeCashbackFilter = Array.from(cashbackFilterEls).find(
    (el) => el.checked
  );
  if (currentMode === "cashback" && activeCashbackFilter) {
    const value = activeCashbackFilter.value;
    if (value === "5") {
      places = places.filter((p) => p.cashbackPercent === 5);
    } else if (value === "7") {
      places = places.filter((p) => p.cashbackPercent >= 7);
    }
    // value === "all" → не фильтруем
  }

  // "Осадки кэшбэка" – оставляем только высокий процент
  if (cashbackRainMode) {
    places = places.filter(
      (p) => p.cashbackPercent >= HIGH_CASHBACK_THRESHOLD
    );
  }

  return places;
}

// ---- отрисовка маркеров ----
function renderMarkers() {
  if (!markersLayer) return;

  markersLayer.clearLayers();
  const places = getFilteredPlaces();

  places.forEach((place) => {
    const isHighCashback =
      place.cashbackPercent >= HIGH_CASHBACK_THRESHOLD;

    const marker = L.circleMarker([place.lat, place.lng], {
      radius: 7,
      weight: 2,
      color: isHighCashback ? "#FF4B4B" : "#1D8DFF",
      fillColor: isHighCashback ? "#FF8080" : "#1D8DFF",
      fillOpacity: 0.9,
    });

    marker.bindPopup(
      `<b>${place.name}</b><br>${place.address}<br><small>${place.category}, ${place.cashbackPercent}% кэшбэк</small>`
    );

    marker.on("click", () => {
      focusOnPlace(place);
      scrollToPlacesListItem(place.id);
    });

    marker.addTo(markersLayer);
  });
}

// ---- список "Точки" ----
function renderPlacesList() {
  if (!placesListEl) return;

  const places = getFilteredPlaces();
  placesListEl.innerHTML = "";

  if (!places.length) {
    const empty = document.createElement("div");
    empty.className = "places-empty";
    empty.textContent = "Ничего не нашли по фильтрам 😔";
    placesListEl.appendChild(empty);
    return;
  }

  places.slice(0, 30).forEach((place) => {
    const item = document.createElement("button");
    item.className = "place-card";
    item.dataset.placeId = place.id;

    item.innerHTML = `
      <div class="place-card__main">
        <div class="place-card__title">${place.name}</div>
        <div class="place-card__address">${place.address}</div>
      </div>
      <div class="place-card__cashback">
        <span class="place-card__percent">${place.cashbackPercent}%</span>
      </div>
    `;

    item.addEventListener("click", () => {
      focusOnPlace(place);
    });

    placesListEl.appendChild(item);
  });
}

function focusOnPlace(place) {
  if (!map) return;
  map.setView([place.lat, place.lng], 15, { animate: true });
}

// плавный скролл к элементу списка
function scrollToPlacesListItem(placeId) {
  const el = placesListEl?.querySelector(
    `[data-place-id="${placeId}"]`
  );
  if (el && typeof el.scrollIntoView === "function") {
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

// ---- "Гид по району" ----
function initGuideSteps() {
  // Берём первые 5 ресторанов
  const restaurants = ALL_PLACES.filter(
    (p) => p.category === "Рестораны и кафе"
  ).slice(0, 5);

  guideSteps = restaurants.map((place, idx) => ({
    step: idx + 1,
    place,
  }));

  if (!guideStepsContainer) return;

  guideStepsContainer.innerHTML = "";

  guideSteps.forEach((stepObj) => {
    const btn = document.createElement("button");
    btn.className = "guide-step";
    btn.dataset.step = String(stepObj.step);
    btn.textContent = stepObj.step;

    btn.addEventListener("click", () => {
      setActiveGuideStep(stepObj.step);
    });

    guideStepsContainer.appendChild(btn);
  });

  if (guideSteps.length) {
    setActiveGuideStep(1);
  }
}

function setActiveGuideStep(stepNumber) {
  activeGuideStep = stepNumber;

  if (!guideStepsContainer) return;

  // визуально выделяем кнопку
  guideStepsContainer
    .querySelectorAll(".guide-step")
    .forEach((btn) => {
      btn.classList.toggle(
        "guide-step--active",
        Number(btn.dataset.step) === stepNumber
      );
    });

  const stepObj = guideSteps.find(
    (g) => g.step === stepNumber
  );
  if (!stepObj) return;

  const place = stepObj.place;

  // обновляем текст и карточку
  if (guideTitleEl) {
    guideTitleEl.textContent = `Шаг ${stepNumber}: посетите ${place.name}`;
  }

  if (guidePlaceCardEl) {
    guidePlaceCardEl.innerHTML = `
      <div class="guide-place__title">${place.name}</div>
      <div class="guide-place__address">${place.address}</div>
      <div class="guide-place__cashback">
        ${place.cashbackPercent}% кэшбэк · ${place.category}
      </div>
    `;

    guidePlaceCardEl.onclick = () => focusOnPlace(place);
  }

  // фокус карты
  focusOnPlace(place);
}

// ---- обработчики UI ----
function setMode(newMode) {
  currentMode = newMode;

  // переключение активных табов
  [modeCashbackBtn, modeNearbyBtn, modeCategoriesBtn].forEach(
    (btn) => {
      if (!btn) return;
      const mode = btn.dataset.mode;
      btn.classList.toggle("mode-tab--active", mode === newMode);
    }
  );

  // показать/скрыть панели фильтров
  if (cashbackFiltersPanel) {
    cashbackFiltersPanel.style.display =
      newMode === "cashback" ? "block" : "none";
  }
  if (categoriesFiltersPanel) {
    categoriesFiltersPanel.style.display =
      newMode === "categories" ? "block" : "none";
  }

  renderMarkers();
  renderPlacesList();
}

function toggleCashbackRain() {
  cashbackRainMode = !cashbackRainMode;

  if (cashbackBannerEl) {
    cashbackBannerEl.classList.toggle(
      "cashback-banner--active",
      cashbackRainMode
    );

    const subtitle = cashbackBannerEl.querySelector(
      ".cashback-banner__subtitle"
    );
    if (subtitle) {
      subtitle.textContent = cashbackRainMode
        ? "Показываем только точки с высоким кэшбэком"
        : "Точки рядом с высоким процентом";
    }
  }

  renderMarkers();
  renderPlacesList();
}

// ---- навешиваем события ----
function attachEventListeners() {
  if (searchInputEl) {
    searchInputEl.addEventListener("input", (e) => {
      searchQuery = e.target.value || "";
      renderMarkers();
      renderPlacesList();
    });
  }

  if (modeCashbackBtn) {
    modeCashbackBtn.dataset.mode = "cashback";
    modeCashbackBtn.addEventListener("click", () =>
      setMode("cashback")
    );
  }
  if (modeNearbyBtn) {
    modeNearbyBtn.dataset.mode = "nearby";
    modeNearbyBtn.addEventListener("click", () =>
      setMode("nearby")
    );
  }
  if (modeCategoriesBtn) {
    modeCategoriesBtn.dataset.mode = "categories";
    modeCategoriesBtn.addEventListener("click", () =>
      setMode("categories")
    );
  }

  // чекбоксы категорий
  categoryCheckboxEls.forEach((cb) => {
    cb.addEventListener("change", () => {
      selectedCategories = new Set(
        Array.from(categoryCheckboxEls)
          .filter((el) => el.checked)
          .map((el) => el.value)
      );
      renderMarkers();
      renderPlacesList();
    });
  });

  // радиокнопки "Ваш кэшбэк"
  cashbackFilterEls.forEach((rb) => {
    rb.addEventListener("change", () => {
      if (currentMode === "cashback") {
        renderMarkers();
        renderPlacesList();
      }
    });
  });

  if (cashbackBannerEl) {
    cashbackBannerEl.addEventListener("click", toggleCashbackRain);
  }
}

// ---- старт приложения ----
function initApp() {
  if (!ALL_PLACES.length) {
    console.error("Нет данных PLACES. Проверь places.js");
  }

  initMap();
  attachEventListeners();
  initGuideSteps();
  setMode("cashback"); // дефолтный режим

  renderMarkers();
  renderPlacesList();
}

document.addEventListener("DOMContentLoaded", initApp);
