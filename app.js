// Геокарта — простой клиентский JS.
// Предполагаем, что places.js положил данные в window.PLACES.

const PLACES = (window.PLACES || []).map(p => ({
  ...p,
  lat: Number(p.lat),
  lng: Number(p.lng)
}));

// Центр Москвы по умолчанию
const MOSCOW_CENTER = [55.751244, 37.618423];

// -------- Карта --------
const map = L.map('map', {
  zoomControl: true
}).setView(MOSCOW_CENTER, 11);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let userLocation = null;

// маркеры всех точек
const markerItems = [];

// Цвет маркера по категории
function getMarkerColor(category) {
  if (category === 'АЗС') return '#287bff';
  if (category === 'Спорттовары') return '#27c46b';
  if (category === 'Рестораны и кафе') return '#ff3b57';
  return '#0099ff';
}

// Создаем маркеры
PLACES.forEach(place => {
  const marker = L.circleMarker([place.lat, place.lng], {
    radius: 7,
    color: getMarkerColor(place.category),
    fillColor: getMarkerColor(place.category),
    fillOpacity: 0.95
  });

  marker.bindPopup(
    `<b>${place.name}</b><br>${place.address}<br>` +
    `<small>${place.category}, ${place.cashbackPercent}% кэшбэк</small>`
  );

  marker.addTo(map);

  markerItems.push({ place, marker });
});

// -------- геолокация --------
if ('geolocation' in navigator) {
  navigator.geolocation.getCurrentPosition(
    position => {
      userLocation = [position.coords.latitude, position.coords.longitude];
      L.circleMarker(userLocation, {
        radius: 6,
        color: '#ffffff',
        fillColor: '#ff2c55',
        fillOpacity: 1
      }).addTo(map);
      map.setView(userLocation, 13);
      refreshUI();
    },
    () => {
      // отказ или ошибка
      refreshUI();
    },
    { enableHighAccuracy: true, timeout: 7000 }
  );
} else {
  refreshUI();
}

// -------- утилита: расстояние в км --------
function distanceKm(aLat, aLng, bLat, bLng) {
  const R = 6371;
  const dLat = (bLat - aLat) * Math.PI / 180;
  const dLng = (bLng - aLng) * Math.PI / 180;
  const la1 = aLat * Math.PI / 180;
  const la2 = bLat * Math.PI / 180;

  const x = Math.sin(dLat / 2) ** 2 +
            Math.sin(dLng / 2) ** 2 * Math.cos(la1) * Math.cos(la2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

// -------- состояние фильтров --------
let currentMode = 'cashback'; // 'cashback' | 'near'

// элементы UI
const searchInput = document.getElementById('searchInput');
const filterCashbackBtn = document.getElementById('filterCashback');
const filterNearBtn = document.getElementById('filterNear');
const placesListEl = document.getElementById('placesList');
const guideListEl = document.getElementById('guideList');

// обработчики фильтров
filterCashbackBtn.addEventListener('click', () => {
  currentMode = 'cashback';
  filterCashbackBtn.classList.add('active');
  filterNearBtn.classList.remove('active');
  refreshUI();
});

filterNearBtn.addEventListener('click', () => {
  currentMode = 'near';
  filterNearBtn.classList.add('active');
  filterCashbackBtn.classList.remove('active');
  refreshUI();
});

// поиск
searchInput.addEventListener('input', () => {
  refreshUI();
});

// -------- применяем фильтры и обновляем всё --------
function refreshUI() {
  const query = (searchInput.value || '').trim().toLowerCase();

  // 1. базовый набор по режиму
  let base = markerItems.slice();

  const center = userLocation || MOSCOW_CENTER;

  if (currentMode === 'near') {
    // сортируем по расстоянию к пользователю и берем, например, 40 ближайших
    base.sort((a, b) => {
      const da = distanceKm(center[0], center[1], a.place.lat, a.place.lng);
      const db = distanceKm(center[0], center[1], b.place.lat, b.place.lng);
      return da - db;
    });
    base = base.slice(0, 40);
  }

  // 2. поиск
  const visibleItems = [];
  markerItems.forEach(item => {
    const matchesMode = base.includes(item);
    const matchesSearch =
      !query ||
      item.place.name.toLowerCase().includes(query) ||
      item.place.address.toLowerCase().includes(query);

    const visible = matchesMode && matchesSearch;
    if (visible) visibleItems.push(item);

    if (visible) {
      if (!map.hasLayer(item.marker)) item.marker.addTo(map);
    } else {
      if (map.hasLayer(item.marker)) map.removeLayer(item.marker);
    }
  });

  // 3. обновляем список карточек
  renderPlacesList(visibleItems);

  // 4. обновляем гид по району
  renderGuide(center);
}

// -------- список точек внизу --------
function renderPlacesList(items) {
  placesListEl.innerHTML = '';

  const limited = items.slice(0, 20);

  limited.forEach(({ place }) => {
    const div = document.createElement('div');
    div.className = 'placeItem';
    div.innerHTML =
      `<div style="font-weight:600; margin-bottom:3px;">${place.name}</div>` +
      `<div style="font-size:13px; opacity:0.8;">${place.address}</div>` +
      `<div style="font-size:12px; margin-top:4px; opacity:0.7;">` +
      `${place.category} • ${place.cashbackPercent}% кэшбэк` +
      `</div>`;
    placesListEl.appendChild(div);
  });

  if (!limited.length) {
    const empty = document.createElement('div');
    empty.className = 'placeItem';
    empty.style.opacity = '0.6';
    empty.textContent = 'Нет подходящих точек';
    placesListEl.appendChild(empty);
  }
}

// -------- гид по району (5 ближайших ресторанов) --------
function renderGuide(center) {
  const [cLat, cLng] = center;

  const restaurants = PLACES.filter(
    p => p.category === 'Рестораны и кафе'
  );

  if (!restaurants.length) {
    guideListEl.textContent = 'Поблизости пока нет ресторанов и кафе.';
    return;
  }

  const withDist = restaurants.map(p => ({
    ...p,
    dist: distanceKm(cLat, cLng, p.lat, p.lng)
  }));

  withDist.sort((a, b) => a.dist - b.dist);

  // 5 разных ресторанов (по имени)
  const unique = [];
  const usedNames = new Set();

  for (const p of withDist) {
    if (!usedNames.has(p.name)) {
      unique.push(p);
      usedNames.add(p.name);
    }
    if (unique.length === 5) break;
  }

  guideListEl.innerHTML = '';
  unique.forEach((p, index) => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.marginBottom = '6px';

    const num = document.createElement('div');
    num.style.width = '22px';
    num.style.fontSize = '14px';
    num.style.opacity = '0.7';
    num.textContent = index + 1;

    const text = document.createElement('div');
    text.style.fontSize = '14px';
    text.innerHTML =
      `<div style="font-weight:500;">${p.name}</div>` +
      `<div style="font-size:12px; opacity:0.7;">${p.address}</div>`;

    row.appendChild(num);
    row.appendChild(text);
    guideListEl.appendChild(row);
  });
}

// первый запуск (если геолокация не успела отработать)
refreshUI();
