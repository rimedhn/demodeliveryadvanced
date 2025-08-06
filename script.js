const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS98meyWBoGVu0iF5ZJmLI7hmA6bLwAZroy6oTvgNJmDi9H7p4QDIiEh8-ocJVe08LhJPD4RtAtlEGq/pub?gid=0&single=true&output=csv';
const ORDER_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS98meyWBoGVu0iF5ZJmLI7hmA6bLwAZroy6oTvgNJmDi9H7p4QDIiEh8-ocJVe08LhJPD4RtAtlEGq/pub?gid=740601453&single=true&output=csv';
let services = [];
let categories = [];
let selectedCategory = null;
let userLocation = [15.7758, -86.7822];
let originCoords = null, destinationCoords = null;
let originMapInstance = null, destinationMapInstance = null;

function customAlert(msg, type="error") {
  const alertBox = document.getElementById("customAlert");
  alertBox.textContent = msg;
  alertBox.className = "custom-alert " + type;
  alertBox.style.display = "block";
  setTimeout(()=>{ alertBox.style.display = "none"; }, 2500);
}

function parseCSV(csv) {
  const rows = csv.trim().split('\n');
  const parseRow = row => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      if (char === '"' && (i === 0 || row[i - 1] !== '\\')) {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.replace(/^"|"$/g, ''));
    return result;
  };
  const header = parseRow(rows[0]);
  return rows.slice(1).map(row => {
    const values = parseRow(row);
    let obj = {};
    header.forEach((k, i) => obj[k.trim()] = values[i] ? values[i].trim() : '');
    return obj;
  });
}
function renderCategories() {
  const catsDiv = document.getElementById('categories-list');
  catsDiv.innerHTML = '';
  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'category-btn' + (cat === selectedCategory ? ' active' : '');
    btn.textContent = cat;
    btn.onclick = () => {
      selectedCategory = cat;
      renderCategories();
      renderServicesInCategory(cat);
    };
    catsDiv.appendChild(btn);
  });
}
function renderServicesInCategory(cat) {
  const svcDiv = document.getElementById('services-in-category');
  svcDiv.innerHTML = '';
  services.filter(s => s.categoria === cat).forEach(service => {
    let card = document.createElement('div');
    card.className = 'service-card';
    card.innerHTML = `
      <div class="service-title">${service.nombre}</div>
      <div class="service-desc">${service.descripcion}</div>
      <div class="service-price"><i class="fas fa-dollar-sign"></i> $${service.precio_base}</div>
      <div class="service-schedule"><i class="fas fa-clock"></i> ${service.horario}</div>
      <button class="service-btn" onclick="selectService('${service.id}')"><i class="fas fa-bolt"></i> Solicitar</button>
    `;
    svcDiv.appendChild(card);
  });
}
function fillServiceSelect() {
  const select = document.getElementById("serviceType");
  select.innerHTML = services.map(s => `<option value="${s.id}">${s.nombre} (${s.categoria})</option>`).join('');
}
function showSchedule() {
  document.getElementById("schedule").innerHTML = `<strong>Horario:</strong> Lunes a sábado 9:00-21:00`;
}
showSchedule();

function initUserLocation(cb) {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        userLocation = [pos.coords.latitude, pos.coords.longitude];
        cb && cb(userLocation);
      },
      err => { cb && cb(userLocation); }
    );
  } else {
    cb && cb(userLocation);
  }
}
function createDynamicMap(mapId, inputId, suggestionsId, coordsCallback, markerDefaultCoords) {
  setTimeout(() => {
    const map = L.map(mapId).setView(markerDefaultCoords, 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);
    let marker = L.marker(markerDefaultCoords, {draggable:true}).addTo(map);
    coordsCallback(markerDefaultCoords);

    const input = document.getElementById(inputId);
    const suggBox = document.getElementById(suggestionsId);

    let timeoutAC = null;
    input.addEventListener('input', function() {
      clearTimeout(timeoutAC);
      const query = input.value.trim();
      if (!query) { suggBox.innerHTML = ""; return; }
      timeoutAC = setTimeout(() => {
        let lat = userLocation[0], lng = userLocation[1];
        let bbox = `${lng-0.08},${lat-0.08},${lng+0.08},${lat+0.08}`;
        fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=7&q=${encodeURIComponent(query)}&viewbox=${bbox}&bounded=1`)
          .then(res => res.json())
          .then(results => {
            suggBox.innerHTML = "";
            if (results.length === 0) return;
            results.forEach((r, idx) => {
              const item = document.createElement("div");
              item.className = 'suggestion-item' + (idx === 0 ? ' active' : '');
              let icon = 'fa-map-pin';
              if (r.type === "city" || r.type === "administrative") icon = 'fa-city';
              if (r.type === "road") icon = 'fa-road';
              if (r.type === "house" || r.type === "residential") icon = 'fa-home';
              item.innerHTML = `
                <span class="suggestion-icon"><i class="fas ${icon}"></i></span>
                <span class="suggestion-name">${r.display_name.split(",")[0]}</span>
                <span class="suggestion-details">${r.display_name}</span>
              `;
              item.onclick = () => {
                input.value = r.display_name;
                suggBox.innerHTML = "";
                map.setView([r.lat, r.lon], 17);
                marker.setLatLng([r.lat, r.lon]);
                coordsCallback([parseFloat(r.lat), parseFloat(r.lon)]);
              };
              suggBox.appendChild(item);
            });
          });
      }, 350);
    });
    map.on('click', function(e) {
      marker.setLatLng(e.latlng);
      coordsCallback([e.latlng.lat, e.latlng.lng]);
      getReverseAddress(e.latlng.lat, e.latlng.lng, val => { input.value = val; });
    });
    marker.on('dragend', function(ev) {
      const pos = marker.getLatLng();
      coordsCallback([pos.lat, pos.lng]);
      getReverseAddress(pos.lat, pos.lng, val => { input.value = val; });
    });
    input.addEventListener('blur', function() { setTimeout(()=>suggBox.innerHTML="", 150); });
    map.invalidateSize();
    if(mapId === 'mapOrigin') originMapInstance = map;
    if(mapId === 'mapDestination') destinationMapInstance = map;
  }, 200);
}
function getReverseAddress(lat, lng, cb) {
  fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
    .then(r=>r.json())
    .then(data=>cb(data.display_name || `${lat},${lng}`));
}

function initStepper() {
  let currentStep = 1;
  const totalSteps = 4;
  function updateTabs() {
    for(let i=1; i<=totalSteps; i++) {
      let tab = document.querySelector(`.step-tab[data-step="step-${i}"]`);
      tab.classList.remove('active','completed');
      tab.removeAttribute('disabled');
      if(i < currentStep) tab.classList.add('completed');
      if(i === currentStep) tab.classList.add('active');
      if(i > currentStep) tab.setAttribute('disabled','');
    }
    for(let i=1; i<=totalSteps; i++) {
      let step = document.getElementById(`step-${i}`);
      step.classList.remove('active');
      if(i === currentStep) step.classList.add('active');
      else step.classList.remove('active');
    }
    if(currentStep === 2 && originMapInstance) setTimeout(()=>originMapInstance.invalidateSize(),100);
    if(currentStep === 3 && destinationMapInstance) setTimeout(()=>destinationMapInstance.invalidateSize(),100);
  }
  document.querySelectorAll('.step-tab').forEach(tab => {
    tab.onclick = function() {
      let stepNum = parseInt(tab.getAttribute('data-step').replace('step-',''));
      if(stepNum <= currentStep) {
        currentStep = stepNum;
        updateTabs();
      }
    };
  });
  for(let i=1; i<totalSteps; i++) {
    document.getElementById(`next-step-${i}`).onclick = function() {
      if(validateStep(i)) {
        currentStep = i+1;
        updateTabs();
      }
    };
    let backBtn = document.getElementById(`back-step-${i+1}`);
    if(backBtn) {
      backBtn.onclick = function() {
        currentStep = i;
        updateTabs();
      };
    }
  }
  updateTabs();
}
function validateStep(stepNum) {
  if(stepNum === 1) {
    if(!document.getElementById("serviceType").value || !document.getElementById("description").value.trim()) {
      customAlert("Selecciona el tipo de servicio y escribe la descripción.", "error");
      return false;
    }
  }
  if(stepNum === 2) {
    if(!document.getElementById("origin").value.trim() || !originCoords) {
      customAlert("Indica la dirección y selecciona el punto de origen en el mapa.", "error");
      return false;
    }
  }
  if(stepNum === 3) {
    if(!document.getElementById("destination").value.trim() || !destinationCoords) {
      customAlert("Indica la dirección y selecciona el punto de destino en el mapa.", "error");
      return false;
    }
  }
  return true;
}

window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.section').forEach(sec => sec.style.display = 'none');
  document.getElementById('home').style.display = 'block';
  document.getElementById('order-intro').style.display = 'none';
  document.querySelectorAll('#app-menu button').forEach(btn => {
    btn.onclick = function() {
      document.querySelectorAll('#app-menu button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const sectionId = btn.getAttribute('data-section');
      document.querySelectorAll('.section').forEach(sec => sec.style.display = 'none');
      if(sectionId === 'services') {
        document.getElementById('services').style.display = 'block';
      } else {
        document.getElementById('services').style.display = 'none';
      }
      if(sectionId === 'order-stepper') {
        if(document.getElementById('order-stepper').style.display !== 'block') {
          document.getElementById('order-intro').style.display = 'block';
          document.getElementById('order-stepper').style.display = 'none';
          document.getElementById('services').style.display = 'none';
          return;
        }
      }
      if(sectionId === 'order-intro') {
        document.getElementById('order-intro').style.display = 'block';
        document.getElementById('services').style.display = 'none';
      }
      if(sectionId !== 'services') document.getElementById(sectionId).style.display = 'block';
    };
  });
  document.getElementById("start-order-btn").onclick = function() {
    document.getElementById("order-intro").style.display = "none";
    document.getElementById("order-stepper").style.display = "block";
    document.getElementById('services').style.display = 'none';
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById("step-1").classList.add('active');
    document.querySelectorAll('.step-tab').forEach(t => t.classList.remove('active','completed'));
    document.querySelector('.step-tab[data-step="step-1"]').classList.add('active');
    document.querySelectorAll('#app-menu button').forEach(b => b.classList.remove('active'));
    document.querySelector('#app-menu button[data-section="order-stepper"]').classList.add('active');
    initStepper();
    initUserLocation(loc => {
      createDynamicMap('mapOrigin', 'origin', 'origin-suggestions', coords => { originCoords = coords; }, loc);
      createDynamicMap('mapDestination', 'destination', 'destination-suggestions', coords => { destinationCoords = coords; }, loc);
    });
  };

  fetch(SHEET_URL)
    .then(res => res.text())
    .then(csv => {
      services = parseCSV(csv);
      categories = Array.from(new Set(services.map(s=>s.categoria)));
      selectedCategory = categories[0] || null;
      renderCategories();
      renderServicesInCategory(selectedCategory);
      fillServiceSelect();
    });
  showSchedule();

  window.selectService = function(id) {
    document.getElementById("order-intro").style.display = "none";
    document.getElementById("order-stepper").style.display = "block";
    document.getElementById('services').style.display = 'none';
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById("step-1").classList.add('active');
    document.querySelectorAll('.step-tab').forEach(t => t.classList.remove('active','completed'));
    document.querySelector('.step-tab[data-step="step-1"]').classList.add('active');
    document.getElementById("serviceType").value = id;
    initStepper();
    initUserLocation(loc => {
      createDynamicMap('mapOrigin', 'origin', 'origin-suggestions', coords => { originCoords = coords; }, loc);
      createDynamicMap('mapDestination', 'destination', 'destination-suggestions', coords => { destinationCoords = coords; }, loc);
    });
  };
});

document.getElementById("whatsapp-send-btn").onclick = function(e) {
  e.preventDefault();
  let serviceId = document.getElementById("serviceType").value;
  let service = services.find(s => s.id === serviceId);
  let desc = document.getElementById("description").value.trim();
  let origin = document.getElementById("origin").value.trim();
  let dest = document.getElementById("destination").value.trim();
  let name = document.getElementById("clientName").value.trim();
  let phone = document.getElementById("clientPhone").value.trim();
  let notes = document.getElementById("notes").value.trim();
  let feedback = document.getElementById("orderFeedback");

  if (!service || !desc || !origin || !dest || !name || !phone || !originCoords || !destinationCoords) {
    customAlert("Por favor completa todos los campos y selecciona los puntos en el mapa.", "error");
    feedback.textContent = "";
    return;
  }

  let pedidoID = "FG" + Date.now().toString().slice(-6);

  // 1. Guardar en Google Sheets
  fetch("https://script.google.com/macros/s/AKfycbxViOKIlVnb-4RLunZV_dIEAz3U4xA9c5kcXIWZ_ayMafILcYobJ5J9GK3dOti4zKlQTg/exec", {
    method: "POST",
    body: JSON.stringify({
      id_pedido: pedidoID,
      nombre: name,
      phone: phone,
      servicio: service.nombre,
      desc: desc,
      origin: origin,
      originCoords: originCoords,
      dest: dest,
      destinationCoords: destinationCoords,
      notes: notes
    }),
    headers: {
      "Content-Type": "application/json"
    }
  }).then(r => r.text())
    .then(res => {
      // 2. WhatsApp
      let msg =
`*Pedido FastGo*
Nombre: ${name}
Teléfono: ${phone}
Servicio: ${service.nombre} (${service.categoria})
Descripción: ${desc}

Origen: ${origin}
Ubicación: https://maps.google.com/?q=${originCoords[0]},${originCoords[1]}

Destino: ${dest}
Ubicación: https://maps.google.com/?q=${destinationCoords[0]},${destinationCoords[1]}

Notas: ${notes || 'Sin notas'}
Precio base: $${service.precio_base}
Horario servicio: ${service.horario}
ID Pedido: ${pedidoID}
`;

      let waUrl = "https://wa.me/50493593126?text=" + encodeURIComponent(msg);
      window.open(waUrl, "_blank");
      customAlert("¡Pedido guardado y listo para enviar por WhatsApp!", "success");
      feedback.textContent = "¡Pedido guardado y listo para enviar por WhatsApp!";
      feedback.style.color = "green";
    })
    .catch(() => {
      customAlert("Error al guardar el pedido, intente nuevamente.", "error");
    });
};

document.getElementById("track-form").onsubmit = function(e) {
  e.preventDefault();
  let id = document.getElementById("trackId").value.trim();
  let result = document.getElementById("trackResult");
  result.classList.remove('visible');
  if (!id) {
    result.innerHTML = "<span class='track-label'>Ingresa tu ID de pedido.</span>";
    result.classList.add('visible');
    result.style.color = "red";
    return;
  }
  fetch(ORDER_SHEET_URL)
    .then(res=>res.text())
    .then(csv=>{
      let pedidos = parseCSV(csv);
      let pedido = pedidos.find(p=>p.id_pedido === id);
      if (!pedido) {
        result.innerHTML = "<span class='track-label'>Pedido no encontrado.</span>";
        result.classList.add('visible');
        result.style.color = "red";
      } else {
        result.innerHTML = `
          <div class="track-status">${pedido.estado ? pedido.estado : "En proceso"}</div>
          <div class="track-label">Servicio:</div>
          <div class="track-value">${pedido.servicio || ''}</div>
          <div class="track-label">Fecha:</div>
          <div class="track-value">${pedido.fecha || ''}</div>
          <div class="track-label">Notas:</div>
          <div class="track-value">${pedido.notas || ''}</div>
        `;
        result.classList.add('visible');
        result.style.color = "#254d24";
      }
    })
    .catch(()=>{
      result.innerHTML = "<span class='track-label'>Error consultando el estado. Inténtalo más tarde.</span>";
      result.classList.add('visible');
      result.style.color = "red";
    });
};

document.querySelectorAll('.faq-list details').forEach(det => {
  det.addEventListener('toggle', function() {
    if(det.open) det.style.background = '#e6f9ee';
    else det.style.background = '#f7fdf7';
  });
});
