// =============================================================================
// IBI-EXPLORER - FEED GLOBAL, ROTAS, PONTOS E GUIAS LOCAIS
// =============================================================================

// Variáveis Globais de Rastreamento
let trackerState = {
  isTracking: false,
  timerInterval: null,
  watchId: null,
  segundos: 0,
  distanciaTotal: 0,
  elevacaoGanho: 0,
  coordenadas: [],
  ultimaPosicao: null,
};

let mapTracker = null;
let userMarker = null;
let pathPolyline = null;

// Variáveis da Rota Guia e Linha de Acesso
window.polylineGuiaAtual = window.polylineGuiaAtual || null;
window.polylineAcessoInicio = window.polylineAcessoInicio || null;
window.inicioRotaMarker = window.inicioRotaMarker || null;
window.rotaGuiaSelecionada = window.rotaGuiaSelecionada || null;

document.addEventListener("DOMContentLoaded", async () => {
  verificarAutenticacao();

  // Execução paralela dos carregamentos
  await Promise.all([
    carregarFeedGlobal(),
    carregarRotasGpx(),
    carregarPontosApoio(),
    carregarGuiasLocais(),
  ]);

  // Eventos de Logout
  document.getElementById("btnLogout")?.addEventListener("click", fazerLogout);

  // Ajusta a renderização dos mapas ao trocar de aba no Bootstrap
  const tabRotasEl = document.getElementById("tab-rotas");
  if (tabRotasEl) {
    tabRotasEl.addEventListener("shown.bs.tab", () => {
      window.dispatchEvent(new Event("resize"));
    });
  }

  // Inicializa eventos do Modal de Rastreamento
  configurarModalRastreamento();
});

function verificarAutenticacao() {
  const usuarioSalvo = localStorage.getItem("usuarioLogado");
  if (!usuarioSalvo) {
    alert("Acesso restrito! Por favor, faça login.");
    window.location.href = "login.html";
  }
}

function fazerLogout() {
  localStorage.removeItem("usuarioLogado");
  window.location.href = "login.html";
}

// Helper para normalizar coordenadas vindo de GPX/JSON
function normalizarCoordenadas(coords) {
  if (!coords) return [];
  let pontos = coords;
  if (typeof pontos === "string") {
    try {
      pontos = JSON.parse(pontos);
    } catch (e) {
      console.error("Erro ao converter coordenadas:", e);
      return [];
    }
  }

  if (!Array.isArray(pontos)) return [];

  return pontos.map((ponto) => {
    if (Array.isArray(ponto)) return [ponto[0], ponto[1]];
    if (ponto.lat !== undefined && ponto.lng !== undefined)
      return [ponto.lat, ponto.lng];
    if (ponto.latitude !== undefined && ponto.longitude !== undefined)
      return [ponto.latitude, ponto.longitude];
    return ponto;
  });
}

// Função para abrir o Google Maps usando as coordenadas
function abrirNoMaps(latitude, longitude) {
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  window.open(url, "_blank");
}

// 1. CARREGAR FEED GLOBAL
async function carregarFeedGlobal() {
  const container = document.getElementById("feedGlobalContainer");
  if (!container) return;

  try {
    const client =
      typeof _supabase !== "undefined" ? _supabase : supabaseClient;
    const { data: atividades, error } = await client
      .from("atividades")
      .select("*, usuarios(nome, foto_url)")
      .eq("visivel", true)
      .order("data_postagem", { ascending: false });

    if (error) throw error;

    if (!atividades || atividades.length === 0) {
      container.innerHTML = `
        <div class="text-center p-4 text-muted">
          <i class="bi bi-info-circle fs-4 d-block mb-2 text-primary"></i>
          <p class="m-0">Nenhuma atividade pública registrada ainda. Seja o primeiro a publicar!</p>
        </div>`;
      return;
    }

    container.innerHTML = "";

    atividades.forEach((act) => {
      const dadosUsuario = act.usuarios || {};
      const nomeUser = dadosUsuario.nome || "Explorador";
      const fotoPerfil = dadosUsuario.foto_url || "images/nature/Homem.jpeg";
      const cidade = act.cidade || dadosUsuario.cidade || "Tianguá";
      const uf = act.uf || dadosUsuario.uf || "CE";
      const cidadeUf = `${cidade} - ${uf}`;

      const dataPost = act.data_postagem
        ? new Date(act.data_postagem)
        : new Date();
      const horaFormatada = dataPost.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const dataFormatada = dataPost.toLocaleDateString("pt-BR");

      let rawMedia = act.media_url || act.midia_url || [];
      let mediaArray = Array.isArray(rawMedia)
        ? rawMedia
        : rawMedia
        ? [rawMedia]
        : [];

      let carouselHTML = "";
      if (mediaArray.length > 0) {
        const slidesHTML = mediaArray
          .map((url, idx) => {
            const isVideo = url.match(/\.(mp4|webm|ogg|mov)$/i);
            return `
              <div class="carousel-item ${idx === 0 ? "active" : ""}">
                ${
                  isVideo
                    ? `<video src="${url}" controls class="w-100 rounded-3" style="max-height: 350px; object-fit: cover;"></video>`
                    : `<img src="${url}" class="w-100 rounded-3" style="max-height: 350px; object-fit: cover;" alt="Mídia">`
                }
              </div>`;
          })
          .join("");

        const controlsHTML =
          mediaArray.length > 1
            ? `
            <button class="carousel-control-prev" type="button" data-bs-target="#carousel-feed-${act.id}" data-bs-slide="prev">
              <span class="carousel-control-prev-icon bg-dark rounded-circle p-2" aria-hidden="true"></span>
            </button>
            <button class="carousel-control-next" type="button" data-bs-target="#carousel-feed-${act.id}" data-bs-slide="next">
              <span class="carousel-control-next-icon bg-dark rounded-circle p-2" aria-hidden="true"></span>
            </button>`
            : "";

        carouselHTML = `
          <div id="carousel-feed-${act.id}" class="carousel slide mt-2" data-bs-ride="false">
            <div class="carousel-inner">${slidesHTML}</div>
            ${controlsHTML}
          </div>`;
      }

      const cardHTML = `
        <div class="feed-item mb-4 p-3 bg-white rounded-3 shadow-sm border">
          <div class="d-flex align-items-center gap-3 mb-3">
            <img src="${fotoPerfil}" class="feed-user-img rounded-circle" style="width: 48px; height: 48px; object-fit: cover;" alt="${nomeUser}">
            <div>
              <h6 class="fw-bold m-0 text-dark">${nomeUser}</h6>
              <small class="text-muted d-block">${cidadeUf} • ${dataFormatada} às ${horaFormatada}</small>
            </div>
          </div>

          ${
            act.descricao
              ? `<p class="text-secondary mb-3">${act.descricao}</p>`
              : ""
          }

          <div class="row g-2 mb-2 text-center">
            <div class="col-3"><div class="metric-badge p-2 bg-light rounded"><strong>${
              act.distancia_km ?? "0.00"
            }</strong><small class="d-block text-muted">KM</small></div></div>
            <div class="col-3"><div class="metric-badge p-2 bg-light rounded"><strong>${
              act.duracao_minutos ?? 0
            }</strong><small class="d-block text-muted">MIN</small></div></div>
            <div class="col-3"><div class="metric-badge p-2 bg-light rounded"><strong>${
              act.elevacao_m ?? 0
            }</strong><small class="d-block text-muted">ELEV (M)</small></div></div>
            <div class="col-3"><div class="metric-badge p-2 bg-light rounded"><strong>${
              act.calorias_kcal ?? 0
            }</strong><small class="d-block text-muted">KCAL</small></div></div>
          </div>

          ${carouselHTML}
        </div>`;

      container.insertAdjacentHTML("beforeend", cardHTML);
    });
  } catch (err) {
    console.error("Falha ao montar o Feed:", err);
    container.innerHTML = `<div class="alert alert-danger text-center my-3">Não foi possível carregar as atividades.</div>`;
  }
}

// 2. CARREGAR ROTAS DA SERRA
async function carregarRotasGpx() {
  const container = document.getElementById("rotasContainer");
  if (!container) return;

  try {
    const client =
      typeof _supabase !== "undefined" ? _supabase : supabaseClient;
    const { data: rotas, error } = await client
      .from("rotas")
      .select("*")
      .eq("visivel", true)
      .order("created_at", { ascending: false });

    if (error || !rotas || rotas.length === 0) {
      container.innerHTML = `<p class="text-muted text-center py-4">Nenhuma rota oficial cadastrada no momento.</p>`;
      return;
    }

    container.innerHTML = "";

    rotas.forEach((rota) => {
      let rawMedia = rota.media_url || rota.midias || [];
      let mediaArray = Array.isArray(rawMedia)
        ? rawMedia
        : rawMedia
        ? [rawMedia]
        : [];

      let mediaSlidesHTML = mediaArray
        .map((url) => {
          const isVideo = url.match(/\.(mp4|webm|ogg|mov)$/i);
          return `
            <div class="carousel-item h-100 bg-dark">
              ${
                isVideo
                  ? `<video src="${url}" controls class="w-100 h-100 rounded-top" style="object-fit: contain; max-height: 250px;"></video>`
                  : `<img src="${url}" class="d-block w-100 h-100 rounded-top" style="object-fit: contain; max-height: 250px;" alt="${rota.nome}">`
              }
            </div>`;
        })
        .join("");

      const hasControls = mediaArray.length > 0;

      const cardHTML = `
        <div class="col-12 col-md-6 mb-4">
          <div class="card h-100 border shadow-sm rounded-4 overflow-hidden">
            <div id="carousel-rota-${
              rota.id
            }" class="carousel slide bg-dark" data-bs-ride="false" style="height: 250px; position: relative; overflow: hidden;">
              <div class="carousel-inner h-100">
                <div class="carousel-item active h-100">
                  <div id="map-rota-${
                    rota.id
                  }" style="height: 100%; width: 100%;"></div>
                </div>
                ${mediaSlidesHTML}
              </div>

              ${
                hasControls
                  ? `
              <button class="carousel-control-prev" type="button" data-bs-target="#carousel-rota-${rota.id}" data-bs-slide="prev">
                <span class="carousel-control-prev-icon bg-dark rounded-circle p-2" aria-hidden="true"></span>
              </button>
              <button class="carousel-control-next" type="button" data-bs-target="#carousel-rota-${rota.id}" data-bs-slide="next">
                <span class="carousel-control-next-icon bg-dark rounded-circle p-2" aria-hidden="true"></span>
              </button>`
                  : ""
              }
            </div>

            <div class="card-body p-3 d-flex flex-column justify-content-between">
              <div>
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <h5 class="fw-bold text-dark m-0">${rota.nome}</h5>
                  <span class="badge bg-warning text-dark border">${
                    rota.dificuldade || "Médio"
                  }</span>
                </div>
                <p class="text-primary fw-bold mb-2">
                  <i class="bi bi-pin-map-fill"></i> Distância: ${
                    rota.distancia_km
                  } KM
                </p>
                <p class="text-secondary small mb-3">
                  ${rota.descricao || "Sem descrição cadastrada."}
                </p>
              </div>

              <button type="button" class="btn btn-primary w-100 fw-bold rounded-3 mt-2" onclick="aderirERotaGuia('${
                rota.id
              }')">
                <i class="bi bi-compass"></i> ADERIR E NAVEGAR ROTA
              </button>
            </div>
          </div>
        </div>`;

      container.insertAdjacentHTML("beforeend", cardHTML);

      setTimeout(() => {
        const coordsNormalizadas = normalizarCoordenadas(rota.coords);

        if (coordsNormalizadas.length > 0) {
          const mapElementId = `map-rota-${rota.id}`;
          const mapElement = document.getElementById(mapElementId);

          if (!mapElement) return;

          const map = L.map(mapElementId, {
            zoomControl: false,
            dragging: false,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            touchZoom: false,
          });

          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "© OpenStreetMap",
          }).addTo(map);

          const polyline = L.polyline(coordsNormalizadas, {
            color: "#0d6efd",
            weight: 4,
            opacity: 0.8,
          }).addTo(map);

          map.fitBounds(polyline.getBounds(), { padding: [10, 10] });

          setTimeout(() => {
            map.invalidateSize();
          }, 300);

          const carouselEl = document.getElementById(
            `carousel-rota-${rota.id}`
          );
          if (carouselEl) {
            carouselEl.addEventListener("slid.bs.carousel", () => {
              map.invalidateSize();
            });
          }
        }
      }, 300);
    });

    window.rotasCache = rotas;
  } catch (err) {
    console.error("Erro ao carregar rotas:", err);
    container.innerHTML = `<p class="text-danger text-center py-3">Erro ao buscar rotas.</p>`;
  }
}

// 3. ADERIR À ROTA SELECIONADA E ABRIR MODAL COM RASTREAMENTO ATIVO
function aderirERotaGuia(rotaId) {
  const rotaEncontrada = window.rotasCache?.find((r) => r.id === rotaId);
  if (!rotaEncontrada) return;

  window.rotaGuiaSelecionada = rotaEncontrada;

  const modalElement = document.getElementById("modalRastreamento");
  if (!modalElement) return;

  const modalTrackerInstance =
    bootstrap.Modal.getOrCreateInstance(modalElement);
  modalTrackerInstance.show();
}

// 4. CONFIGURAÇÃO E MOTOR DO MODAL DE RASTREAMENTO
function configurarModalRastreamento() {
  const modalTrackerEl = document.getElementById("modalRastreamento");
  if (!modalTrackerEl) return;

  modalTrackerEl.addEventListener("shown.bs.modal", () => {
    inicializarMapaTracker();
    iniciarRastreamento();
  });

  document
    .getElementById("btnStopRecord")
    ?.addEventListener("click", finalizarRastreamento);
}

function inicializarMapaTracker() {
  if (!mapTracker) {
    mapTracker = L.map("mapTracker").setView([-3.7319, -40.9926], 15);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
    }).addTo(mapTracker);

    pathPolyline = L.polyline([], {
      color: "#dc3545", // Trajeto percorrido em vermelho
      weight: 5,
      opacity: 0.9,
    }).addTo(mapTracker);
  }

  // Limpeza prévia de camadas das rotas guias anteriores
  if (window.polylineGuiaAtual) {
    mapTracker.removeLayer(window.polylineGuiaAtual);
    window.polylineGuiaAtual = null;
  }
  if (window.polylineAcessoInicio) {
    mapTracker.removeLayer(window.polylineAcessoInicio);
    window.polylineAcessoInicio = null;
  }
  if (window.inicioRotaMarker) {
    mapTracker.removeLayer(window.inicioRotaMarker);
    window.inicioRotaMarker = null;
  }

  // Se existe uma rota guia selecionada via GPX
  if (window.rotaGuiaSelecionada && window.rotaGuiaSelecionada.coords) {
    const coordsGuia = normalizarCoordenadas(window.rotaGuiaSelecionada.coords);

    if (coordsGuia.length > 0) {
      // 1. Desenha o trajeto da Rota GPX (Verde tracejado)
      window.polylineGuiaAtual = L.polyline(coordsGuia, {
        color: "#198754",
        weight: 4,
        opacity: 0.8,
        dashArray: "6, 6",
      }).addTo(mapTracker);

      // 2. Cria o Marcador visual no Ponto Inicial da Rota GPX
      const pontoInicial = coordsGuia[0];
      const iconeInicio = L.divIcon({
        className: "custom-start-marker",
        html: '<div style="background-color: #198754; color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white; box-shadow: 0 0 8px rgba(0,0,0,0.5);"><i class="bi bi-flag-fill" style="font-size: 13px;"></i></div>',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      window.inicioRotaMarker = L.marker(pontoInicial, {
        icon: iconeInicio,
        title: "Início da Rota",
      })
        .addTo(mapTracker)
        .bindPopup("<b>Início da Rota Cadastrada</b>")
        .openPopup();

      // Ajusta visão para enquadrar a rota guia
      mapTracker.fitBounds(window.polylineGuiaAtual.getBounds(), {
        padding: [25, 25],
      });
    }
  }

  setTimeout(() => {
    mapTracker.invalidateSize();
  }, 300);
}

function iniciarRastreamento() {
  if (trackerState.isTracking) return;

  // Reset do estado global de rastreamento
  trackerState = {
    isTracking: true,
    timerInterval: null,
    watchId: null,
    segundos: 0,
    distanciaTotal: 0,
    elevacaoGanho: 0,
    coordenadas: [],
    ultimaPosicao: null,
  };

  // Reset dos indicadores na interface
  const liveDistEl = document.getElementById("liveDistance");
  const liveTimerEl = document.getElementById("liveTimer");
  const liveElevEl = document.getElementById("liveElevation");

  if (liveDistEl) liveDistEl.innerText = "0.00";
  if (liveTimerEl) liveTimerEl.innerText = "00:00";
  if (liveElevEl) liveElevEl.innerText = "0";

  if (pathPolyline) pathPolyline.setLatLngs([]);
  if (userMarker) {
    mapTracker.removeLayer(userMarker);
    userMarker = null;
  }

  if (trackerState.timerInterval) clearInterval(trackerState.timerInterval);

  // Timer do rastreamento
  trackerState.timerInterval = setInterval(() => {
    trackerState.segundos++;
    const mins = String(Math.floor(trackerState.segundos / 60)).padStart(
      2,
      "0"
    );
    const secs = String(trackerState.segundos % 60).padStart(2, "0");
    if (liveTimerEl) liveTimerEl.innerText = `${mins}:${secs}`;
  }, 1000);

  if ("geolocation" in navigator) {
    trackerState.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, altitude } = pos.coords;
        const latLng = [latitude, longitude];

        trackerState.coordenadas.push(latLng);

        // Marcador do usuário em tempo real
        if (userMarker) {
          userMarker.setLatLng(latLng);
        } else {
          userMarker = L.marker(latLng, {
            title: "Sua Posição Atual",
          }).addTo(mapTracker);
        }

        pathPolyline.addLatLng(latLng);

        // DIRECIOMENTO ATÉ O INÍCIO DA ROTA GPX
        if (window.rotaGuiaSelecionada && window.rotaGuiaSelecionada.coords) {
          const coordsGuia = normalizarCoordenadas(
            window.rotaGuiaSelecionada.coords
          );

          if (coordsGuia.length > 0) {
            const pontoInicial = coordsGuia[0];

            // Linha conectando o Usuário -> Início da Rota (Azul Tracejado)
            if (window.polylineAcessoInicio) {
              window.polylineAcessoInicio.setLatLngs([latLng, pontoInicial]);
            } else {
              window.polylineAcessoInicio = L.polyline([latLng, pontoInicial], {
                color: "#0d6efd",
                weight: 3,
                opacity: 0.9,
                dashArray: "4, 4",
              }).addTo(mapTracker);
            }

            // Enquadra a tela para mostrar a posição atual do usuário e a rota completa
            if (!trackerState.ultimaPosicao) {
              const bounds = L.latLngBounds([latLng, ...coordsGuia]);
              mapTracker.fitBounds(bounds, { padding: [40, 40] });

              // Notifica a distância restante até o início da rota
              const distAteInicio = calcularDistancia(
                latitude,
                longitude,
                pontoInicial[0],
                pontoInicial[1]
              );

              if (distAteInicio > 0.05) {
                console.log(
                  `Você está a ${distAteInicio.toFixed(
                    2
                  )} km do início da rota.`
                );
              }
            }
          }
        } else if (!trackerState.ultimaPosicao) {
          mapTracker.setView(latLng, 17);
        }

        // Atualiza métricas de caminhada/corrida
        if (trackerState.ultimaPosicao) {
          const dist = calcularDistancia(
            trackerState.ultimaPosicao.lat,
            trackerState.ultimaPosicao.lng,
            latitude,
            longitude
          );

          if (dist > 0.002) {
            trackerState.distanciaTotal += dist;
            if (liveDistEl)
              liveDistEl.innerText = trackerState.distanciaTotal.toFixed(2);
          }

          if (
            altitude !== null &&
            trackerState.ultimaPosicao.alt !== null &&
            altitude > trackerState.ultimaPosicao.alt
          ) {
            const ganho = altitude - trackerState.ultimaPosicao.alt;
            if (ganho < 15) {
              trackerState.elevacaoGanho += ganho;
              if (liveElevEl)
                liveElevEl.innerText = Math.round(trackerState.elevacaoGanho);
            }
          }
        }

        trackerState.ultimaPosicao = {
          lat: latitude,
          lng: longitude,
          alt: altitude,
        };
      },
      (err) => {
        console.warn("Erro ao obter GPS:", err.message);
        alert(
          "Não foi possível capturar sua localização exata. Verifique se o GPS está ativado."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  } else {
    alert("Seu navegador não suporta geolocalização.");
  }
}

function finalizarRastreamento() {
  if (trackerState.timerInterval) clearInterval(trackerState.timerInterval);
  if (trackerState.watchId)
    navigator.geolocation.clearWatch(trackerState.watchId);
  trackerState.isTracking = false;

  const modalTrackerEl = document.getElementById("modalRastreamento");
  if (modalTrackerEl) {
    const modalTrackerInstance = bootstrap.Modal.getInstance(modalTrackerEl);
    if (modalTrackerInstance) modalTrackerInstance.hide();
  }

  const summaryDist = document.getElementById("summaryDist");
  const summaryTime = document.getElementById("summaryTime");
  const summaryElev = document.getElementById("summaryElev");

  if (summaryDist)
    summaryDist.innerText = trackerState.distanciaTotal.toFixed(2);
  if (summaryTime)
    summaryTime.innerText = Math.ceil(trackerState.segundos / 60);
  if (summaryElev)
    summaryElev.innerText = Math.round(trackerState.elevacaoGanho);

  const modalSaveEl = document.getElementById("modalSaveActivity");
  if (modalSaveEl) {
    const modalSave = bootstrap.Modal.getOrCreateInstance(modalSaveEl);
    modalSave.show();
  }
}

function calcularDistancia(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 5. CARREGAR PONTOS DE APOIO E GUIAS LOCAIS
async function carregarPontosApoio() {
  const container = document.getElementById("pontosContainer");
  if (!container) return;

  try {
    const client =
      typeof _supabase !== "undefined" ? _supabase : supabaseClient;
    const { data: pontos, error } = await client
      .from("pontos_apoio")
      .select("*")
      .eq("visivel", true)
      .order("nome");

    if (error || !pontos || pontos.length === 0) {
      container.innerHTML = `<p class="text-muted text-center py-4">Nenhum ponto de apoio registrado.</p>`;
      return;
    }

    container.innerHTML = pontos
      .map((p) => {
        let mediaHTML = "";
        if (p.media_url) {
          const isVideo = p.media_url.match(/\.(mp4|webm|ogg|mov)$/i);
          mediaHTML = isVideo
            ? `<video src="${p.media_url}" controls class="w-100 rounded-3 mb-2" style="max-height: 160px; object-fit: cover;"></video>`
            : `<img src="${p.media_url}" class="w-100 rounded-3 mb-2" style="max-height: 160px; object-fit: cover;" alt="${p.nome}">`;
        }

        return `
          <div class="col-md-4 mb-3">
            <div class="border rounded-3 p-3 bg-white h-100 shadow-sm d-flex flex-column justify-content-between">
              <div>
                ${mediaHTML}
                <span class="badge bg-secondary mb-2">${p.categoria}</span>
                <h6 class="fw-bold mb-1 text-dark">${p.nome}</h6>
                <small class="text-muted d-block mb-2">${
                  p.cidade || "Tianguá"
                } - ${p.estado || "CE"}</small>
                <p class="small text-secondary m-0">${
                  p.descricao || "Ponto de apoio estruturado para exploradores."
                }</p>
              </div>
              <button onclick="abrirNoMaps(${p.latitude}, ${
          p.longitude
        })" class="btn btn-outline-primary btn-sm w-100 mt-3">
                <i class="bi bi-geo-alt"></i> Abrir no Maps
              </button>
            </div>
          </div>`;
      })
      .join("");
  } catch (err) {
    console.error("Erro em pontos de apoio:", err);
  }
}

async function carregarGuiasLocais() {
  const container = document.getElementById("guiasContainer");
  if (!container) return;

  try {
    const client =
      typeof _supabase !== "undefined" ? _supabase : supabaseClient;
    const { data: guias, error } = await client
      .from("guias_locais")
      .select("*")
      .eq("visivel", true)
      .order("nome");

    if (error || !guias || guias.length === 0) {
      container.innerHTML = `<p class="text-muted text-center py-4">Nenhum guia local cadastrado no momento.</p>`;
      return;
    }

    container.innerHTML = guias
      .map((g) => {
        const numWhats = g.telefone ? g.telefone.replace(/\D/g, "") : "";
        return `
          <div class="col-md-6 mb-3">
            <div class="border rounded-3 p-3 bg-white d-flex align-items-center gap-3 shadow-sm">
              <img src="${
                g.foto_url || "images/nature/Homem.jpeg"
              }" class="rounded-circle" style="width: 60px; height: 60px; object-fit: cover;">
              <div class="flex-grow-1">
                <h6 class="fw-bold m-0 text-dark">${g.nome}</h6>
                <small class="text-primary fw-semibold d-block">${
                  g.especialidade || "Guia de Trilha"
                }</small>
                <small class="text-muted d-block mb-2">${
                  g.cidade || "Tianguá"
                }</small>
                ${
                  numWhats
                    ? `<a href="https://wa.me/55${numWhats}" target="_blank" class="btn btn-success btn-sm fw-bold">
                        <i class="bi bi-whatsapp me-1"></i> Entrar em Contato
                      </a>`
                    : ""
                }
              </div>
            </div>
          </div>`;
      })
      .join("");
  } catch (err) {
    console.error("Erro em guias locais:", err);
  }
}
