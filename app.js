// ====== БАЗОВЫЕ ДАННЫЕ ======

const ALL_PLACES = (window.PLACES || []).slice();

// грубые центры округов (для "Гида по району")
const DISTRICT_CENTERS = {
  "ЦАО": [55.7558, 37.6173],
  "САО": [55.843, 37.54],
  "СВАО": [55.87, 37.65],
  "ВАО": [55.77, 37.76],
  "ЮВАО": [55.7, 37.75],
  "ЮАО": [55.65, 37.62],
  "ЮЗАО": [55.66, 37.52],
  "ЗАО": [55.72, 37.45],
  "СЗАО": [55.81, 37.41]
};

// ====== СОСТОЯНИЕ ФИЛЬТРОВ ======

let currentChip = "my"; // my | nearby | category
let activeCategories = new Set(["АЗС", "Спорттовары", "Рестораны и кафе"]);
let activeGuideDistrict = null; // "ЦАО" и т.п.
let rainMode = false;
let searchQuery = "";
let userLocation = null;

// ====== КАРТА (Leaflet + OpenStreetMap) ======

const map = L.map("map", {
  center: [55.7558, 37.6173],
  zoom: 11,
  zoomControl: false
});

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
  maxZoom: 19
}).addTo(map);

L.control.zoom({ position: "topright" }).addTo(map);

const markersLayer = L.layerGroup().addTo(map);

// ====== УТИЛИТЫ ======

function deg2rad(deg) {
  return (deg * Math.PI) / 180;
}

// расстояние в км
function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ====== ОТРИСОВКА МАРКЕРОВ И СПИСКА ======

const placesListEl = document.getElementById("places-list");
const placesCountEl = document.getElementById("places-count");

function renderMarkers(places) {
  markersLayer.clearLayers();

  places.forEach((p) => {
    const marker = L.marker([p.lat, p.lng]).addTo(markersLayer);
    marker.bindPopup(
      `<strong>${p.name}</strong><br>${p.address}<br>Кэшбэк: ${p.cashbackPercent}%`
    );
  });

  if (places.length > 0) {
    const group = L.featureGroup(
      places.map((p) => L.marker([p.lat, p.lng]))
    );
    map.fitBounds(group.getBounds().pad(0.2));
  }
}

function renderList(places) {
  placesListEl.innerHTML = "";

  places.forEach((p) => {
    const item = document.createElement("div");
    item.className = "place-item";

    const icon = document.createElement("div");
    icon.className = "place-item__icon";
    icon.textContent =
      p.category === "АЗС" ? "⛽️" : p.category === "Спорттовары" ? "🏀" : "☕️";

    const content = document.createElement("div");
    content.className = "place-item__content";

    const name = document.createElement("div");
    name.className = "place-item__name";
    name.textContent = p.name;

    const address = document.createElement("div");
    address.className = "place-item__address";
    address.textContent = p.address;

    const meta = document.createElement("div");
    meta.className = "place-item__meta";
    meta.textContent = `Кэшбэк ${p.cashbackPercent}% • ${p.category} • ${p.district}`;

    content.appendChild(name);
    content.appendChild(address);
    content.appendChild(meta);

    item.appendChild(icon);
    item.appendChild(content);

    item.addEventListener("click", () => {
      map.setView([p.lat, p.lng], 15);
    });

    placesListEl.appendChild(item);
  });

  placesCountEl.textContent =
    places.length > 0 ? `${places.length} точек` : "Ничего не найдено";
}

// ====== ПРИМЕНЕНИЕ ФИЛЬТРОВ ======

function applyFilters() {
  let filtered = ALL_PLACES.slice();

  // категории
  filtered = filtered.filter((p) => activeCategories.has(p.category));

  // гид по району – только кафе и рестораны + конкретный округ
  if (activeGuideDistrict) {
    filtered = filtered.filter(
      (p) =>
        p.category === "Рестораны и кафе" &&
        p.district === activeGuideDistrict
    );
  }

  // осадки кешбэка – высокий процент
  if (rainMode) {
    const maxCashback = Math.max(...ALL_PLACES.map((p) => p.cashbackPercent));
    const threshold = Math.max(maxCashback - 1, 5); // топовые
    filtered = filtered.filter((p) => p.cashbackPercent >= threshold);
  }

  // поиск
  if (searchQuery.trim() !== "") {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }

  // рядом с вами
  if (currentChip === "nearby" && userLocation) {
    filtered = filtered
      .map((p) => ({
        place: p,
        dist: distanceKm(userLocation.lat, userLocation.lng, p.lat, p.lng)
      }))
      .filter((obj) => obj.dist <= 5) // радиус 5 км
      .sort((a, b) => a.dist - b.dist)
      .map((obj) => obj.place);
  }

  renderMarkers(filtered);
  renderList(filtered);
}

// ====== ИНИЦИАЛИЗАЦИЯ ГИДА ПО РАЙОНУ ======

const guideDistrictsEl = document.getElementById("guide-districts");
const guideSubtitleEl = document.getElementById("guide-subtitle");

// собираем уникальные округа из данных
const districtSet = new Set(ALL_PLACES.map((p) => p.district));
const districtList = Array.from(districtSet).filter((d) => !!d);

districtList.forEach((d) => {
  const chip = document.createElement("button");
  chip.className = "guide-chip";
  chip.textContent = d;
  chip.dataset.district = d;

  chip.addEventListener("click", () => {
    // переключаем активный
    if (activeGuideDistrict === d) {
      activeGuideDistrict = null;
      guideSubtitleEl.textContent =
        "Выберите округ, покажем только кафе и рестораны";
    } else {
      activeGuideDistrict = d;
      guideSubtitleEl.textContent = `Гид по району: ${d}`;
    }

    document
      .querySelectorAll(".guide-chip")
      .forEach((el) => el.classList.remove("guide-chip--active"));
    if (activeGuideDistrict) {
      chip.classList.add("guide-chip--active");

      const center = DISTRICT_CENTERS[d];
      if (center) {
        map.setView(center, 12);
      }
    }

    applyFilters();
  });

  guideDistrictsEl.appendChild(chip);
});

// ====== ВЕРХНИЕ ФИЛЬТРЫ (ЧИПЫ) ======

const chipButtons = document.querySelectorAll(".chip");
const categoryFiltersEl = document.getElementById("category-filters");

chipButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const type = btn.dataset.chip;

    chipButtons.forEach((b) => b.classList.remove("chip--active"));
    btn.classList.add("chip--active");

    currentChip = type;

    if (type === "category") {
      categoryFiltersEl.classList.remove("hidden");
    } else {
      categoryFiltersEl.classList.add("hidden");
    }

    if (type === "nearby" && !userLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          userLocation = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          };
          applyFilters();
        },
        () => {
          alert("Не удалось получить геопозицию. Покажем все точки.");
          currentChip = "my";
          document
            .querySelector('[data-chip="my"]')
            .classList.add("chip--active");
          btn.classList.remove("chip--active");
          applyFilters();
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      applyFilters();
    }
  });
});

// категории
document.querySelectorAll(".cat-chip").forEach((btn) => {
  btn.addEventListener("click", () => {
    const cat = btn.dataset.category;
    if (activeCategories.has(cat)) {
      activeCategories.delete(cat);
      btn.classList.remove("cat-chip--active");
    } else {
      activeCategories.add(cat);
      btn.classList.add("cat-chip--active");
    }
    applyFilters();
  });
});

// ====== ОСАДКИ КЕШБЭКА ======

const rainCardEl = document.getElementById("rain-card");

rainCardEl.addEventListener("click", () => {
  rainMode = !rainMode;
  if (rainMode) {
    rainCardEl.style.boxShadow = "0 0 0 2px rgba(0,0,0,0.3)";
  } else {
    rainCardEl.style.boxShadow = "none";
  }
  applyFilters();
});

// ====== ПОИСК ======

const searchInput = document.getElementById("search");
searchInput.addEventListener("input", (e) => {
  searchQuery = e.target.value || "";
  applyFilters();
});

// ====== БОТОМ-ШИТ: простое сворачивание/разворачивание ======

const sheet = document.getElementById("bottom-sheet");
const sheetToggle = document.getElementById("sheet-toggle");

sheetToggle.addEventListener("click", () => {
  sheet.classList.toggle("bottom-sheet--collapsed");
});

// ====== ПЕРВОНАЧАЛЬНЫЙ РЕНДЕР ======

applyFilters();
