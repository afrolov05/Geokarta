// Init map
const map = L.map("map", {
  center: [55.7558, 37.6173],
  zoom: 11,
  zoomControl: false
});

// OSM tiles
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19
}).addTo(map);

// MARKERS
const markersLayer = L.layerGroup().addTo(map);

function renderMarkers(list) {
  markersLayer.clearLayers();
  list.forEach(p => {
    L.marker([p.lat, p.lng])
      .addTo(markersLayer)
      .bindPopup(`<b>${p.name}</b><br>${p.address}`);
  });
}

renderMarkers(PLACES);

// List in panel
function renderList(list) {
  const container = document.getElementById("points-list");
  container.innerHTML = "";
  list.forEach(p => {
    const el = document.createElement("div");
    el.className = "point-item";
    el.innerHTML = `<b>${p.name}</b><br>${p.address}`;
    el.onclick = () => map.flyTo([p.lat, p.lng], 15);
    container.appendChild(el);
  });
}

renderList(PLACES);

// SEARCH
document.getElementById("search").addEventListener("input", e => {
  const q = e.target.value.toLowerCase();
  const filtered = PLACES.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.address.toLowerCase().includes(q)
  );
  renderMarkers(filtered);
  renderList(filtered);
});
