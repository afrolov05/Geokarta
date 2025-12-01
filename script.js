ymaps.ready(init);

let map;
let placeMarkers = [];

function init() {
  map = new ymaps.Map("map", {
    center: [55.751244, 37.618423],
    zoom: 11,
    controls: ["zoomControl"],
  });

  renderDistricts();
  renderPlaces();
}

function renderDistricts() {
  const list = document.getElementById("district-list");
  list.innerHTML = "";

  DISTRICTS.forEach((district) => {
    const li = document.createElement("li");
    li.textContent = district.name;

    li.onclick = () => {
      map.setCenter([district.lat, district.lng], 12);
    };

    list.appendChild(li);
  });
}

function renderPlaces() {
  const list = document.getElementById("places-list");
  list.innerHTML = "";

  PLACES.forEach((place) => {
    const li = document.createElement("li");
    li.textContent = `${place.name} — ${place.cashbackPercent}%`;

    li.onclick = () => {
      map.setCenter([place.lat, place.lng], 15);
    };

    list.appendChild(li);

    addMarker(place);
  });
}

function addMarker(place) {
  const marker = new ymaps.Placemark(
    [place.lat, place.lng],
    {
      balloonContent: `
        <strong>${place.name}</strong><br>
        Категория: ${place.category}<br>
        Адрес: ${place.address}<br>
        Кэшбэк: ${place.cashbackPercent}%`,
    },
    {
      preset: "islands#redIcon",
    }
  );

  placeMarkers.push(marker);
  map.geoObjects.add(marker);
}
