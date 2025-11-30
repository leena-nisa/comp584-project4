/* City list with coordinates used for API requests */
const cities = {
  la:       { name: "Los Angeles (USA)",    lat: 34.05,    lon: -118.25 },
  nyc:      { name: "New York City (USA)",  lat: 40.71,    lon: -74.01 },
  saopaulo: { name: "São Paulo (Brazil)",   lat: -23.5505, lon: -46.6333 },
  sydney:   { name: "Sydney (Australia)",   lat: -33.8688, lon: 151.2093 }
};

/* Cached references to avoid repeated lookups */
const citySelect = document.getElementById("citySelect");
const aqCard     = document.getElementById("aqCard");
const heroCard   = document.querySelector(".hero-card");

const aqTitle    = document.getElementById("aqTitle");
const aqSubtitle = document.getElementById("aqSubtitle");

const aqiValue   = document.getElementById("aqiValue");
const pm25Value  = document.getElementById("pm25Value");
const pm10Value  = document.getElementById("pm10Value");
const o3Value    = document.getElementById("o3Value");
const coValue    = document.getElementById("coValue");

const shade      = document.getElementById("shade");
const keyModal   = document.getElementById("keyModal");
const keyButton  = document.getElementById("keyButton");
const modalClose = document.getElementById("modalClose");
/* Return the Popmotion object if available; otherwise warn */
function getPopmotion() {
  const pm = window.popmotion;
  if (!pm) {
    console.warn(
      "Popmotion is undefined. " +
      "Make sure the Popmotion <script> tag is correct and you have internet so the CDN can load."
    );
    return null;
  }
  return pm;
}

 
// Animate a card: slide up and fade in for a subtle entrance.
// Exits cleanly if Popmotion or the element isn't available.
function tweenAnimateCard(el) {
  const pm = getPopmotion();
  if (!pm || !el) {
    console.warn("Popmotion or element missing, skipping card animation");
    return;
  }

  // Grab helpers from Popmotion and bind to the element
  const { tween, styler, easing } = pm;
  const elStyler = styler(el);

  // Set initial state (slightly down and transparent)
  elStyler.set({ opacity: 0, y: 30 });

  // Tween to the final visible state
  tween({
    from: { opacity: 0, y: 30 },
    to:   { opacity: 1, y: 0 },
    duration: 600,
    ease: {
      y: easing.backOut,
      opacity: easing.linear
    }
  }).start((v) => {
    elStyler.set({
      opacity: v.opacity,
      y: v.y
    });
  });
}

// Open the Air Quality Key modal (backdrop + card).
function openKeyModal() {
  // Make modal elements visible in the DOM
  shade.classList.remove("d-none");
  keyModal.classList.remove("d-none");

  // Try to get Popmotion; if missing we show the modal without motion
  const pm = getPopmotion();
  if (!pm) {
    console.warn("Popmotion missing, showing modal without animation");
    return;
  }

  // Prepare animation helpers and element stylers
  const { tween, styler, easing } = pm;
  const shadeStyler = styler(shade);
  const modalCard   = keyModal.querySelector(".aq-modal-card");
  const modalStyler = styler(modalCard);

  // Initial visual states for entrance animation
  shadeStyler.set({ opacity: 0 });
  modalStyler.set({ y: -100, opacity: 0 });

  // Animate backdrop opacity and modal position/opacity
  tween({
    from: { shade: 0, y: -100, opacity: 0 },
    to:   { shade: 1, y: 0, opacity: 1 },
    duration: 500,
    ease: { shade: easing.linear, y: easing.backOut, opacity: easing.linear }
  }).start((v) => {
    shadeStyler.set({ opacity: v.shade });
    modalStyler.set({ y: v.y, opacity: v.opacity });
  });
}

/* Hide modal instantly (keeps closing simple) */
function closeKeyModal() {
  shade.classList.add("d-none");
  keyModal.classList.add("d-none");
}

/* Convert null/NaN-ish values into a readable placeholder */
function safe(v) {
  return v == null || isNaN(v) ? "NO INFO" : v;
}

/* Reset all displayed metrics to a 'no info' state */
function setAllNoInfo() {
  aqiValue.textContent  = "NO INFO";
  pm25Value.textContent = "NO INFO";
  pm10Value.textContent = "NO INFO";
  o3Value.textContent   = "NO INFO";
  coValue.textContent   = "NO INFO";
}

/* Fetch latest hourly air quality values for a given city and update UI */
async function fetchAirQuality(cityId) {
  const city = cities[cityId];
  if (!city) return;

  aqTitle.textContent = `Air Quality ${city.name}`;
  // Clear the subtitle while we load fresh data
  aqSubtitle.textContent = "";

  // Build the API request for the city's coordinates
  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality` +
    `?latitude=${city.lat}&longitude=${city.lon}` +
    `&hourly=pm2_5,pm10,ozone,carbon_monoxide,us_aqi&timezone=auto`;

  // Fetch the data and handle network / response errors
  try {
    const res = await fetch(url);
    if (!res.ok) {
      // Bad response — show placeholders
      setAllNoInfo();
      return;
    }

    // Parse JSON and access the hourly arrays
    const data = await res.json();
    const h = data.hourly;
    if (!h || !h.time || !h.time.length) {
      // Missing expected structure
      setAllNoInfo();
      return;
    }

    // Use the most recent timestamp available
    const i = h.time.length - 1;

    // Safely read the latest values; API may return nulls
    const usAqi = h.us_aqi && h.us_aqi[i] != null ? h.us_aqi[i] : null;
    const pm25  = h.pm2_5 && h.pm2_5[i] != null   ? h.pm2_5[i]   : null;
    const pm10  = h.pm10  && h.pm10[i]  != null   ? h.pm10[i]    : null;
    const o3    = h.ozone && h.ozone[i] != null   ? h.ozone[i]   : null;
    const co    = h.carbon_monoxide && h.carbon_monoxide[i] != null
                  ? h.carbon_monoxide[i]
                  : null;

    // Update DOM formatted values
    aqiValue.textContent  = safe(usAqi != null ? Math.round(usAqi) : usAqi);
    pm25Value.textContent = safe(pm25 != null ? pm25.toFixed(1) : pm25);
    pm10Value.textContent = safe(pm10 != null ? pm10.toFixed(1) : pm10);
    o3Value.textContent   = safe(o3   != null ? o3.toFixed(1)   : o3);
    coValue.textContent   = safe(co   != null ? co.toFixed(1)   : co);

    // Give a small visual cue that new data arrived
    tweenAnimateCard(aqCard);

  } catch (err) {
    // Network or parsing error — log and show placeholders
    console.error("Air quality fetch error:", err);
    setAllNoInfo();
  }
}

// init
/* Wire up event handlers and load the default city's data on start */
function init() {
  console.log("init called");

  tweenAnimateCard(heroCard);

  // Load default city's air quality data
  fetchAirQuality(citySelect.value);

  citySelect.addEventListener("change", (event) => {
    fetchAirQuality(event.target.value);
  });

  if (keyButton) {
    keyButton.addEventListener("click", openKeyModal);
  }
  if (modalClose) {
    modalClose.addEventListener("click", closeKeyModal);
  }
  if (shade) {
    shade.addEventListener("click", closeKeyModal);
  }
}

document.addEventListener("DOMContentLoaded", init);
