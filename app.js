// ==== карта ====
const map = L.map('map', {
  zoomControl: false
}).setView([55.7558, 37.6173], 11);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19
}).addTo(map);

// ===== markers =====
let markers = [];

function loadMarkers(list = window.PLACES) {
  markers.forEach(m => map.removeLayer(m));
  markers = [];

  list.forEach(p => {
    const m = L.marker([p.lat, p.lng]).addTo(map);
    m.bindPopup(`<b>${p.name}</b><br>${p.address}<br>${p.cashbackPercent}% кэшбэк`);
    markers.push(m);
  });
}

loadMarkers();

// ====== TABS ======
const tabCashback = document.getElementById("tabCashback");
const tabNear = document.getElementById("tabNear");

tabCashback.onclick = () => {
  tabCashback.classList.add("active");
  tabNear.classList.remove("active");
};

tabNear.onclick = () => {
  tabNear.classList.add("active");
  tabCashback.classList.remove("active");
};

// ====== BANNERS ======
const bannerGuide = document.getElementById("bannerGuide");
const bannerRain = document.getElementById("bannerRain");

const guideScreen = document.getElementById("guideScreen");
const rainScreen = document.getElementById("rainScreen");

document.getElementById("guideBack").onclick = () => {
  guideScreen.classList.add("hidden");
};

document.getElementById("rainBack").onclick = () => {
  rainScreen.classList.add("hidden");
};

bannerGuide.onclick = openGuide;
bannerRain.onclick = openRain;

// ===== ГИД ПО РАЙОНУ =====
function openGuide() {
  const cafes = window.PLACES.filter(p => p.category.includes("рест") || p.category.includes("каф"));
  const nearest = cafes.slice(0, 5);

  guideScreen.classList.remove("hidden");

  // progress
  const progress = document.getElementById("guideProgress");
  progress.innerHTML = "";
  for (let i = 1; i <= 5; i++) {
    const step = document.createElement("div");
    step.className = "progress-step" + (i === 1 ? " active" : "");
    step.innerText = i;
    progress.appendChild(step);
  }

  // list
  const content = document.getElementById("guideContent");
  content.innerHTML = "";

  nearest.forEach((p, i) => {
    const card = document.createElement("div");
    card.className = "place-card";
    card.innerHTML = `
      <div class="place-name">${p.name}</div>
      ${p.address}
    `;
    content.appendChild(card);
  });
}

// ===== ОСАДКИ =====
function openRain() {
  rainScreen.classList.remove("hidden");

  const rainContent = document.getElementById("rainContent");
  rainContent.innerHTML = "<div>Загрузка точек с высоким кэшбэком...</div>";

  const high = window.PLACES.filter(p => p.cashbackPercent >= 7);

  rainContent.innerHTML = high.map(p =>
    `<div class="place-card"><div class="place-name">${p.name}</div>${p.address}</div>`
  ).join("");
}
