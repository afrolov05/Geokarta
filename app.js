const map = L.map("map", {
  center: [55.7558, 37.6173],
  zoom: 12,
  zoomControl: false
});

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19
}).addTo(map);

const markersLayer = L.layerGroup().addTo(map);

function renderMarkers(list) {
  markersLayer.clearLayers();
  list.forEach(place => {
    if (!place.lat || !place.lng) return;
    L.marker([place.lat, place.lng])
      .addTo(markersLayer)
      .bindPopup(`<b>${place.name}</b><br>${place.address}<br>Кэшбэк: ${place.cashbackPercent}%`);
  });
}

renderMarkers(window.PLACES);

document.getElementById("search").addEventListener("input", () => {
  const q = search.value.toLowerCase();
  const filtered = window.PLACES.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.address.toLowerCase().includes(q) ||
    p.category.toLowerCase().includes(q)
  );
  renderMarkers(filtered);
});

document.getElementById("filter-cashback").addEventListener("click", () => {
  renderMarkers(window.PLACES.filter(p => p.cashbackPercent >= 5));
});

document.getElementById("filter-near").addEventListener("click", () => {
  if (!navigator.geolocation) return alert("Геолокация недоступна");
  navigator.geolocation.getCurrentPosition(pos => {
    const U = [pos.coords.latitude, pos.coords.longitude];
    const filtered = window.PLACES.filter(p => distance(U, [p.lat, p.lng]) < 2);
    map.setView(U, 14);
    renderMarkers(filtered);
  });
});

function distance(a, b) {
  const R = 6371;
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLon = (b[1] - a[1]) * Math.PI / 180;
  const s =
    Math.sin(dLat/2)**2 +
    Math.cos(a[0]*Math.PI/180) *
    Math.cos(b[0]*Math.PI/180) *
    Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function districtIndex(d) {
  return { "ЦАО":1,"САО":2,"СВАО":2,"ВАО":3,"ЮВАО":3,"ЮАО":4,"ЮЗАО":4,"ЗАО":5,"СЗАО":5 }[d] || 0;
}

document.querySelectorAll(".guide-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const n = Number(btn.dataset.num);
    renderMarkers(window.PLACES.filter(p => districtIndex(p.district) === n));
  });
});
