// =======================
//    НАСТРОЙКА КАРТЫ
// =======================

let map = L.map('map', {
    zoomControl: false,
    attributionControl: false
}).setView([55.7558, 37.6173], 11);

// OSM tiles
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19
}).addTo(map);


// =======================
//      ГЛОБАЛЬНЫЕ ДАННЫЕ
// =======================

let markers = [];
let userLocation = null;


// =======================
//     ПОКАЗАТЬ ТОЧКИ
// =======================

function showAllMarkers(list = PLACES) {
    // удалить старые маркеры
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    list.forEach(place => {
        let marker = L.marker([place.lat, place.lng], {
            title: place.name
        }).addTo(map);

        marker.bindPopup(`
            <b>${place.name}</b><br>
            ${place.address}<br>
            <b>${place.cashbackPercent}% кэшбэк</b>
        `);

        markers.push(marker);
    });
}

showAllMarkers();


// =======================
//      ПОИСК
// =======================

document.getElementById("searchInput").addEventListener("input", e => {
    let query = e.target.value.toLowerCase();

    let filtered = PLACES.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.address.toLowerCase().includes(query)
    );

    showAllMarkers(filtered);
    renderPlacesList(filtered);
});


// =======================
//  ФИЛЬТР: ВАШ КЭШБЭК
// =======================

document.getElementById("filterCashback").addEventListener("click", () => {
    activateFilter("filterCashback");

    let sorted = [...PLACES].sort((a, b) => b.cashbackPercent - a.cashbackPercent);

    showAllMarkers(sorted);
    renderPlacesList(sorted);
});


// =======================
//  ФИЛЬТР: РЯДОМ С ВАМИ
// =======================

document.getElementById("filterNear").addEventListener("click", () => {
    activateFilter("filterNear");

    getUserLocation().then(() => {
        if (!userLocation) return;

        let sorted = [...PLACES].sort((a, b) =>
            distance(userLocation, [a.lat, a.lng]) -
            distance(userLocation, [b.lat, b.lng])
        );

        showAllMarkers(sorted);
        renderPlacesList(sorted);
    });
});


// =======================
//  ГИД ПО РАЙОНУ (5 кафе)
// =======================

document.querySelectorAll(".step").forEach(step => {
    step.addEventListener("click", () => {
        getUserLocation().then(() => {
            let cafes = PLACES.filter(p => p.category === "Рестораны и кафе");

            let sorted = cafes.sort((a, b) =>
                distance(userLocation, [a.lat, a.lng]) -
                distance(userLocation, [b.lat, b.lng])
            );

            let five = sorted.slice(0, 5);

            renderGuide(five);
        });
    });
});


// =======================
//      АКТИВНЫЙ ФИЛЬТР
// =======================

function activateFilter(id) {
    document.querySelectorAll(".filterButton").forEach(btn =>
        btn.classList.remove("active")
    );
    document.getElementById(id).classList.add("active");
}


// =======================
//    СПИСОК В НИЖНЕЙ ПАНЕЛИ
// =======================

function renderPlacesList(list) {
    let box = document.getElementById("placesList");
    box.innerHTML = "";

    list.forEach(place => {
        let item = document.createElement("div");
        item.className = "pointItem";
        item.innerHTML = `
            <b>${place.name}</b><br>
            ${place.address}<br>
            <span style="color:#36a3ff">${place.cashbackPercent}% кэшбэк</span>
        `;
        box.appendChild(item);
    });
}


// =======================
//     ГИД ПО РАЙОНУ
// =======================

function renderGuide(list) {
    let box = document.getElementById("placesList");
    box.innerHTML = "";

    list.forEach(place => {
        let el = document.createElement("div");
        el.className = "pointItem";
        el.innerHTML = `
            <b>${place.name}</b><br>
            ${place.address}<br>
            <span style="color:#36a3ff">${place.cashbackPercent}% кэшбэк</span>
        `;
        box.appendChild(el);
    });
}


// =======================
//   ГЕОЛОКАЦИЯ ПОЛЬЗОВАТЕЛЯ
// =======================

function getUserLocation() {
    return new Promise(resolve => {
        if (userLocation) {
            resolve();
            return;
        }

        navigator.geolocation.getCurrentPosition(pos => {
            userLocation = [pos.coords.latitude, pos.coords.longitude];

            L.circle(userLocation, {
                radius: 50,
                color: "red",
                fillOpacity: 0.3
            }).addTo(map);

            map.setView(userLocation, 14);

            resolve();
        }, () => {
            alert("Геолокация отключена");
            resolve();
        });
    });
}


// =======================
//     РАССТОЯНИЕ
// =======================

function distance(a, b) {
    let dx = a[0] - b[0];
    let dy = a[1] - b[1];
    return Math.sqrt(dx*dx + dy*dy);
}
