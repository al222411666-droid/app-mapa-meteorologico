
"use strict";

// ============================================
// LILA WEATHER - API de lugares y clima
// ============================================

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";

const searchForm = document.getElementById("searchForm");
const cityInput = document.getElementById("cityInput");
const searchButton = document.getElementById("searchButton");
const statusMessage = document.getElementById("statusMessage");
const weatherContent = document.getElementById("weatherContent");

const geocodingCache = new Map();
const weatherCache = new Map();

let lastGeocodingRequest = 0;

// Traducciones de los códigos meteorológicos WMO de Open-Meteo.
const weatherCodes = {
  0: {
    description: "Cielo despejado",
    icon: "☀️",
    advice: "Un día perfecto para disfrutar de la luz del sol."
  },
  1: {
    description: "Mayormente despejado",
    icon: "🌤️",
    advice: "Disfruta del día y mantente cómodo."
  },
  2: {
    description: "Parcialmente nublado",
    icon: "⛅",
    advice: "El cielo combina nubes y claros."
  },
  3: {
    description: "Nublado",
    icon: "☁️",
    advice: "El cielo estará cubierto; lleva algo ligero por si refresca."
  },
  45: {
    description: "Niebla",
    icon: "🌫️",
    advice: "Ten precaución al desplazarte y mantente visible."
  },
  48: {
    description: "Niebla con escarcha",
    icon: "🌫️",
    advice: "La visibilidad puede ser reducida."
  },
  51: {
    description: "Llovizna ligera",
    icon: "🌦️",
    advice: "Un paraguas puede ser útil."
  },
  53: {
    description: "Llovizna moderada",
    icon: "🌦️",
    advice: "Considera llevar paraguas al salir."
  },
  55: {
    description: "Llovizna intensa",
    icon: "🌧️",
    advice: "Prepárate para condiciones húmedas."
  },
  56: {
    description: "Llovizna helada ligera",
    icon: "🌧️",
    advice: "Ten cuidado con las superficies resbaladizas."
  },
  57: {
    description: "Llovizna helada intensa",
    icon: "🌧️",
    advice: "Extrema las precauciones al desplazarte."
  },
  61: {
    description: "Lluvia ligera",
    icon: "🌦️",
    advice: "Lleva paraguas para mantenerte seco."
  },
  63: {
    description: "Lluvia moderada",
    icon: "🌧️",
    advice: "Puede ser conveniente llevar impermeable."
  },
  65: {
    description: "Lluvia intensa",
    icon: "🌧️",
    advice: "Consulta las condiciones antes de salir."
  },
  66: {
    description: "Lluvia helada ligera",
    icon: "🌧️",
    advice: "Ten cuidado con las superficies resbaladizas."
  },
  67: {
    description: "Lluvia helada intensa",
    icon: "🌧️",
    advice: "Evita zonas que puedan presentar hielo."
  },
  71: {
    description: "Nevada ligera",
    icon: "🌨️",
    advice: "Abrígate bien si vas a salir."
  },
  73: {
    description: "Nevada moderada",
    icon: "❄️",
    advice: "Utiliza ropa adecuada para el frío."
  },
  75: {
    description: "Nevada intensa",
    icon: "❄️",
    advice: "Consulta las condiciones de los caminos."
  },
  77: {
    description: "Granizo pequeño de nieve",
    icon: "🌨️",
    advice: "Ten precaución ante las condiciones frías."
  },
  80: {
    description: "Chubascos ligeros",
    icon: "🌦️",
    advice: "Lleva paraguas por si aparecen chubascos."
  },
  81: {
    description: "Chubascos moderados",
    icon: "🌧️",
    advice: "Planea tus actividades considerando la lluvia."
  },
  82: {
    description: "Chubascos fuertes",
    icon: "⛈️",
    advice: "Mantente al tanto de las condiciones meteorológicas."
  },
  85: {
    description: "Chubascos de nieve ligeros",
    icon: "🌨️",
    advice: "Abrígate y presta atención al estado de las vías."
  },
  86: {
    description: "Chubascos de nieve fuertes",
    icon: "❄️",
    advice: "Consulta las condiciones antes de desplazarte."
  },
  95: {
    description: "Tormenta eléctrica",
    icon: "⛈️",
    advice: "Busca refugio seguro durante la tormenta."
  },
  96: {
    description: "Tormenta con granizo ligero",
    icon: "⛈️",
    advice: "Busca refugio y evita permanecer al aire libre."
  },
  99: {
    description: "Tormenta con granizo fuerte",
    icon: "⛈️",
    advice: "Refúgiate en un lugar seguro y sigue los avisos oficiales."
  }
};

function getWeatherInfo(code) {
  return weatherCodes[code] || {
    description: "Condiciones variables",
    icon: "🌥️",
    advice: "Consulta nuevamente para conocer las condiciones actualizadas."
  };
}

function setStatus(message, type = "") {
  statusMessage.textContent = message;
  statusMessage.className = "status-message";

  if (type) {
    statusMessage.classList.add(type);
  }
}

function formatNumber(value, decimals = 0) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number.toFixed(decimals)
    : "--";
}

function formatDate(dateString, options) {
  // Usamos las fechas de calendario que devuelve la API,
  // evitando desplazamientos de día por la zona horaria.
  const parts = dateString.split("-").map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);

  return new Intl.DateTimeFormat("es-MX", options).format(date);
}

function formatCurrentDate(timeString) {
  // Open-Meteo devuelve la hora local de la ubicación.
  const datePart = timeString.split("T")[0];

  return formatDate(datePart, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function formatCityName(place) {
  const address = place.address || {};

  const city =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.county ||
    place.name ||
    "Ubicación seleccionada";

  const region = address.state || address.region || "";
  const country = address.country || "";

  return [city, region, country]
    .filter((value, index, array) =>
      value && array.indexOf(value) === index
    )
    .join(", ");
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// 1. BUSCAR CIUDADES CON NOMINATIM
// ============================================

async function searchCity(query) {
  const normalizedQuery = query.trim().toLocaleLowerCase("es-MX");

  if (geocodingCache.has(normalizedQuery)) {
    return geocodingCache.get(normalizedQuery);
  }

  // No enviar más de una consulta por segundo a Nominatim.
  const elapsed = Date.now() - lastGeocodingRequest;

  if (elapsed < 1100) {
    await delay(1100 - elapsed);
  }

  const params = new URLSearchParams({
    q: query.trim(),
    format: "jsonv2",
    addressdetails: "1",
    limit: "1",
    "accept-language": "es"
  });

  lastGeocodingRequest = Date.now();

  const response = await fetch(
    `${NOMINATIM_URL}?${params.toString()}`,
    {
      headers: {
        "Accept": "application/json"
      }
    }
  );

  if (!response.ok) {
    throw new Error(
      "No se pudo consultar el servicio de búsqueda de lugares."
    );
  }

  const results = await response.json();

  if (!Array.isArray(results) || results.length === 0) {
    throw new Error(
      "No encontramos esa ciudad. Prueba con su nombre y país."
    );
  }

  const place = results[0];
  const latitude = Number(place.lat);
  const longitude = Number(place.lon);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    throw new Error("La ubicación recibida no es válida.");
  }

  const location = {
    latitude,
    longitude,
    name: formatCityName(place),
    displayName: place.display_name
  };

  geocodingCache.set(normalizedQuery, location);

  return location;
}

// ============================================
// 2. CONSULTAR CLIMA CON OPEN-METEO
// ============================================

async function getWeather(location) {
  // La ubicación y el día forman la clave de caché.
  const cacheKey = [
    location.latitude,
    location.longitude,
    new Date().toISOString().slice(0, 13)
  ].join(",");

  const cached = weatherCache.get(cacheKey);

  // Mantener la información meteorológica en caché 10 minutos.
  if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
    return cached.data;
  }

  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "is_day",
      "precipitation",
      "weather_code",
      "wind_speed_10m"
    ].join(","),
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max"
    ].join(","),
    forecast_days: "7",
    timezone: "auto",
    temperature_unit: "celsius",
    wind_speed_unit: "kmh"
  });

  const response = await fetch(
    `${WEATHER_URL}?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error(
      "No fue posible obtener el pronóstico meteorológico."
    );
  }

  const data = await response.json();

  if (!data.current || !data.daily) {
    throw new Error(
      "El servicio no devolvió todos los datos del clima."
    );
  }

  weatherCache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });

  return data;
}

// ============================================
// 3. MOSTRAR EL CLIMA ACTUAL
// ============================================

function renderCurrentWeather(location, data) {
  const current = data.current;
  const daily = data.daily;
  const info = getWeatherInfo(current.weather_code);

  document.getElementById("cityName").textContent = location.name;
  document.getElementById("currentDate").textContent =
    formatCurrentDate(current.time);

  document.getElementById("weatherIcon").textContent = info.icon;
  document.getElementById("weatherDescription").textContent =
    info.description;

  document.getElementById("temperature").textContent =
    formatNumber(current.temperature_2m);

  document.getElementById("feelsLike").textContent =
    `${formatNumber(current.apparent_temperature)}°C`;

  document.getElementById("humidity").textContent =
    `${formatNumber(current.relative_humidity_2m)}%`;

  document.getElementById("wind").textContent =
    `${formatNumber(current.wind_speed_10m)} km/h`;

  const precipitationProbability =
    daily.precipitation_probability_max?.[0];

  document.getElementById("rain").textContent =
    precipitationProbability == null
      ? "N/D"
      : `${formatNumber(precipitationProbability)}%`;

  document.getElementById("maxTemp").textContent =
    `${formatNumber(daily.temperature_2m_max?.[0])}°C`;

  document.getElementById("weatherAdvice").textContent =
    info.advice;

  document.getElementById("updatedAt").textContent =
    `Datos meteorológicos consultados: ${new Date().toLocaleTimeString(
      "es-MX",
      { hour: "2-digit", minute: "2-digit" }
    )}. La actualización depende del servicio meteorológico.`;

  weatherContent.hidden = false;
}

// ============================================
// 4. PRONÓSTICO DE SIETE DÍAS
// ============================================

function renderForecast(daily) {
  const forecastGrid = document.getElementById("forecastGrid");

  forecastGrid.replaceChildren();

  const days = daily.time.length;

  for (let i = 0; i < days; i++) {
    const info = getWeatherInfo(daily.weather_code[i]);

    const card = document.createElement("article");
    card.className = `forecast-card${i === 0 ? " today" : ""}`;

    const dayName = i === 0
      ? "Hoy"
      : formatDate(daily.time[i], { weekday: "short" });

    const dayElement = document.createElement("p");
    dayElement.className = "forecast-day";
    dayElement.textContent = dayName;

    const iconElement = document.createElement("div");
    iconElement.className = "forecast-icon";
    iconElement.setAttribute("aria-label", info.description);
    iconElement.textContent = info.icon;

    const maxElement = document.createElement("p");
    maxElement.className = "forecast-max";
    maxElement.textContent =
      `${formatNumber(daily.temperature_2m_max[i])}°`;

    const minElement = document.createElement("p");
    minElement.className = "forecast-min";
    minElement.textContent =
      `${formatNumber(daily.temperature_2m_min[i])}°`;

    const rainElement = document.createElement("p");
    rainElement.className = "forecast-rain";

    const rainProbability =
      daily.precipitation_probability_max?.[i];

    rainElement.textContent = rainProbability == null
      ? "Lluvia N/D"
      : `☂ ${formatNumber(rainProbability)}%`;

    card.append(
      dayElement,
      iconElement,
      maxElement,
      minElement,
      rainElement
    );

    forecastGrid.appendChild(card);
  }
}

// ============================================
// 5. FLUJO PRINCIPAL DE BÚSQUEDA
// ============================================

async function loadCityWeather(query) {
  const cleanQuery = query.trim();

  if (!cleanQuery) {
    setStatus("Escribe el nombre de una ciudad.", "error");
    cityInput.focus();
    return;
  }

  searchButton.disabled = true;
  searchButton.textContent = "Buscando...";
  setStatus("Buscando la ubicación y consultando el clima...");
  weatherContent.hidden = true;

  try {
    const location = await searchCity(cleanQuery);
    const weather = await getWeather(location);

    renderCurrentWeather(location, weather);
    renderForecast(weather.daily);

    setStatus(`Pronóstico disponible para ${location.name}.`);
  } catch (error) {
    console.error("Error al consultar el clima:", error);

    setStatus(
      error instanceof TypeError
        ? "No se pudo conectar. Revisa tu conexión a internet e inténtalo de nuevo."
        : error.message || "Ocurrió un error inesperado.",
      "error"
    );
  } finally {
    searchButton.disabled = false;
    searchButton.innerHTML = 'Buscar <span>↗</span>';
  }
}

searchForm.addEventListener("submit", event => {
  event.preventDefault();
  loadCityWeather(cityInput.value);
});

// Cargar una ciudad inicial para que la aplicación no aparezca vacía.
window.addEventListener("DOMContentLoaded", () => {
  cityInput.value = "Toluca, México";
  loadCityWeather("Toluca, México");
});
