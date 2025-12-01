/**************
 * ЗАГРУЗКА ДАННЫХ
 **************/
import { PLACES } from './places.js';

/**************
 * НАСТРОЙКА КАРТЫ (OpenStreetMap + Leaflet)
 **************/

// Москва центр по умолчанию
const DEFAULT_LOCATION = [55.751244, 37.618423];

// Создаем карту
const map = L.map('map', {
  zoomControl: false,   // убираем крестики увеличения для мобильного UI
  attributionControl: false
}).setView(DEFAULT_LOCATION, 12);

// Слой карт OSM
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19
}).addTo(map);


/**************
 * ДОБАВЛЕНИЕ ТОЧЕК НА КАРТУ
 **************/

let markersLayer = L.layerGroup().addTo(map);

function renderMarkers() {
  markersLayer.clearLayers();

  PLACES.forEach(place => {
    L.marker([place.lat, place.lng])
      .addTo(markersLayer)
      .bindPopup(`<b>${place.name}</b><br>${place.address}`);
  });
}

renderMarkers();



/**************
 * МОБИЛЬНОЕ МЕНЮ (нижняя панель)
 **************/
const modal = document.getElementById('districtGuideModal');
const openGuideBtn = document.getElementById('openDistrictGuide');
const backBtn = document.getElementById('modalBackBtn');
const progressSteps = document.getElementById('progressSteps');
const guidePlaceBox = document.getElementById('guidePlaceBox');
const nextBtn = document.getElementById('nextPlaceBtn');

let guideRestaurants = [];
let currentStep = 0;


/**************
 * ФУНКЦИЯ — вычисление расстояния
 **************/
function distance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}


/**************
 * ОПРЕДЕЛЯЕМ БЛИЖАЙШИЕ РЕСТОРАНЫ
 **************/
function getNearestRestaurants(userLat, userLng) {
  const restaurants = PLACES.filter(p => p.category === "Рестораны и кафе");

  const enriched = restaurants.map(r => ({
    ...r,
    dist: distance(userLat, userLng, r.lat, r.lng)
  }));

  enriched.sort((a, b) => a.dist - b.dist);

  return enriched.slice(0, 5);
}


/**************
 * ОТРИСОВКА ПРОГРЕССА
 **************/
function renderProgress() {
  progressSteps.innerHTML = "";

  guideRestaurants.forEach((_, index) => {
    const step = document.createElement("div");
    step.className = "step" + (index === currentStep ? " active" : "");
    step.innerText = index + 1;
    progressSteps.appendChild(step);
  });
}


/**************
 * ПОКАЗ ЗАВЕДЕНИЯ В МОДАЛЕ
 **************/
function renderGuidePlace() {
  const place = guideRestaurants[currentStep];

  guidePlaceBox.innerHTML = `
    <b>${place.name}</b><br>
    <div style="margin-top:4px; opacity:0.8;">${place.address}</div>
  `;

  // Центровка карты на точке
  map.setView([place.lat, place.lng], 16);
}


/**************
 * ОТКРЫТЬ ГИД ПО РАЙОНУ
 **************/
openGuideBtn.addEventListener("click", () => {
  // Получаем геолокацию пользователя
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      guideRestaurants = getNearestRestaurants(lat, lng);
      currentStep = 0;

      renderProgress();
      renderGuidePlace();

      modal.classList.remove("hidden");

      map.invalidateSize(); // фикс для отображения карты
    },
    () => {
      // если не дали геолокацию — используем центр Москвы
      guideRestaurants = getNearestRestaurants(DEFAULT_LOCATION[0], DEFAULT_LOCATION[1]);
      currentStep = 0;

      renderProgress();
      renderGuidePlace();

      modal.classList.remove("hidden");

      map.invalidateSize();
    }
  );
});


/**************
 * СЛЕДУЮЩЕЕ ЗАВЕДЕНИЕ
 **************/
nextBtn.addEventListener("click", () => {
  if (currentStep < guideRestaurants.length - 1) {
    currentStep++;
    renderProgress();
    renderGuidePlace();
  }
});


/**************
 * КНОПКА НАЗАД
 **************/
backBtn.addEventListener("click", () => {
  modal.classList.add("hidden");
  map.setView(DEFAULT_LOCATION, 12); // возвращаем карту назад
});


/**************
 * ПОИСК ПО ИМЕНИ
 **************/
const searchInput = document.getElementById('searchInput');

searchInput.addEventListener("input", () => {
  const query = searchInput.value.toLowerCase();

  const filtered = PLACES.filter(p =>
    p.name.toLowerCase().includes(query)
  );

  markersLayer.clearLayers();

  filtered.forEach(place => {
    L.marker([place.lat, place.lng])
      .addTo(markersLayer)
      .bindPopup(`<b>${place.name}</b><br>${place.address}`);
  });
});
