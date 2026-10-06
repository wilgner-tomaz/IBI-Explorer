// =============================================================================
// IBI-EXPLORER - RASTREADOR GPS & INTEGRAÇÃO SUPABASE
// =============================================================================

let watchId = null;
let posicoes = [];
let distanciaTotalKm = 0;
let elevacaoTotalM = 0;
let ultimaAltitude = null;
let timerInterval = null;
let tempoInicio = null;
let tempoDecorridoSegundos = 0;

window.mapInstance = window.mapInstance || null;
window.polylineRota = window.polylineRota || null;
window.userMarker = window.userMarker || null;

// Pega dados do usuário logado no localStorage
const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado")) || {
  id: null,
  nome: "Explorador",
  cidade: "Tianguá",
  uf: "CE",
  peso_kg: 70,
};

// -----------------------------------------------------------------------------
// FUNÇÕES CÁLCULO (HAVERSINE & MET)
// -----------------------------------------------------------------------------

function calcularHaversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calcularMET(distanciaKm, tempoMinutos, pesoKg = 70) {
  if (tempoMinutos <= 0) return 0;
  const velocidadeMedia = distanciaKm / (tempoMinutos / 60);
  let met = 3.5;

  if (velocidadeMedia > 4 && velocidadeMedia <= 8) met = 6.0;
  else if (velocidadeMedia > 8 && velocidadeMedia <= 15) met = 8.3;
  else if (velocidadeMedia > 15) met = 10.0;

  return Math.round(met * pesoKg * (tempoMinutos / 60));
}

// -----------------------------------------------------------------------------
// CONTROLE DO MAPA & GPS
// -----------------------------------------------------------------------------

function inicializarMapaLeaflet() {
  if (!mapInstance) {
    mapInstance = L.map("mapTracker").setView([-3.7319, -40.9921], 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(mapInstance);
  }

  if (polylineRota) {
    mapInstance.removeLayer(polylineRota);
    polylineRota = null;
  }
  polylineRota = L.polyline([], {
    color: "#0284c7",
    weight: 5,
    opacity: 0.8,
  }).addTo(mapInstance);

  if (userMarker) {
    mapInstance.removeLayer(userMarker);
    userMarker = null;
  }
}

function iniciarRastreamento() {
  posicoes = [];
  distanciaTotalKm = 0;
  elevacaoTotalM = 0;
  ultimaAltitude = null;
  tempoDecorridoSegundos = 0;
  tempoInicio = Date.now(); // Marca o timestamp exato do início

  setTimeout(() => {
    inicializarMapaLeaflet();
    if (mapInstance) mapInstance.invalidateSize();
  }, 400);

  document.getElementById("liveDistance").innerText = "0.00";
  document.getElementById("liveTimer").innerText = "00:00";
  document.getElementById("liveElevation").innerText = "0";

  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    // Calcula o tempo decorrido usando a diferença de relógio real
    tempoDecorridoSegundos = Math.floor((Date.now() - tempoInicio) / 1000);

    const mins = String(Math.floor(tempoDecorridoSegundos / 60)).padStart(
      2,
      "0"
    );
    const secs = String(tempoDecorridoSegundos % 60).padStart(2, "0");
    document.getElementById("liveTimer").innerText = `${mins}:${secs}`;
  }, 1000);

  if ("geolocation" in navigator) {
    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, altitude } = position.coords;
        const pontoAtual = [latitude, longitude];

        if (!userMarker && mapInstance) {
          const iconeUsuario = L.divIcon({
            className: "custom-user-marker",
            html: '<div style="background-color: #0284c7; width: 16px; height: 16px; border: 3px solid #ffffff; border-radius: 50%; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          });

          userMarker = L.marker(pontoAtual, { icon: iconeUsuario }).addTo(
            mapInstance
          );
          mapInstance.setView(pontoAtual, 17);
        } else if (userMarker) {
          userMarker.setLatLng(pontoAtual);
          mapInstance.panTo(pontoAtual);
        }

        if (altitude !== null && altitude !== undefined) {
          if (ultimaAltitude !== null && altitude > ultimaAltitude) {
            const ganho = altitude - ultimaAltitude;
            if (ganho < 15) {
              elevacaoTotalM += ganho;
              document.getElementById("liveElevation").innerText =
                Math.round(elevacaoTotalM);
            }
          }
          ultimaAltitude = altitude;
        }

        if (posicoes.length > 0) {
          const ultimoPonto = posicoes[posicoes.length - 1];
          const distTrecho = calcularHaversine(
            ultimoPonto[0],
            ultimoPonto[1],
            latitude,
            longitude
          );

          if (distTrecho > 0.002) {
            distanciaTotalKm += distTrecho;
            document.getElementById("liveDistance").innerText =
              distanciaTotalKm.toFixed(2);
          }
        }

        posicoes.push(pontoAtual);
        if (mapInstance && polylineRota) {
          polylineRota.addLatLng(pontoAtual);
        }
      },
      (error) => {
        console.error("Erro GPS:", error);
        alert(
          "Não foi possível obter sua localização exata. Verifique se o GPS está ativado."
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  } else {
    alert("Seu navegador não suporta geolocalização.");
  }
}

function pararRastreamento() {
  if (watchId) navigator.geolocation.clearWatch(watchId);
  if (timerInterval) clearInterval(timerInterval);

  if (tempoInicio) {
    tempoDecorridoSegundos = Math.floor((Date.now() - tempoInicio) / 1000);
  }

  const tempoMinutos = Math.max(1, Math.round(tempoDecorridoSegundos / 60));

  document.getElementById("summaryDist").innerText =
    distanciaTotalKm.toFixed(2);
  document.getElementById("summaryTime").innerText = tempoMinutos;
  document.getElementById("summaryElev").innerText = Math.round(elevacaoTotalM);

  const modalTrackerEl = document.getElementById("modalRastreamento");
  if (typeof bootstrap !== "undefined" && modalTrackerEl) {
    const modalTracker = bootstrap.Modal.getInstance(modalTrackerEl);
    if (modalTracker) modalTracker.hide();

    const modalSave = new bootstrap.Modal(
      document.getElementById("modalSaveActivity")
    );
    modalSave.show();
  }
}

// -----------------------------------------------------------------------------
// PERSISTÊNCIA NO SUPABASE
// -----------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  const btnOpenTracker = document.getElementById("btnOpenTrackerModal");
  if (btnOpenTracker) {
    btnOpenTracker.addEventListener("click", () => iniciarRastreamento());
  }

  const btnStop = document.getElementById("btnStopRecord");
  if (btnStop) {
    btnStop.addEventListener("click", () => pararRastreamento());
  }

  const btnSaveSupabase = document.getElementById("btnConfirmSaveSupabase");
  if (btnSaveSupabase) {
    btnSaveSupabase.addEventListener("click", async () => {
      const descricao =
        document.getElementById("txtModalDescricao")?.value ||
        "Treino na Serra da Ibiapaba";
      const mediaInput = document.getElementById("mediaInput");
      const mediaFile = mediaInput ? mediaInput.files[0] : null;

      const tempoMinutosText =
        document.getElementById("summaryTime")?.innerText;
      const tempoMinutos =
        parseInt(tempoMinutosText, 10) ||
        Math.max(1, Math.round(tempoDecorridoSegundos / 60));

      const calorias = calcularMET(
        distanciaTotalKm,
        tempoMinutos,
        usuarioLogado.peso_kg || 70
      );

      btnSaveSupabase.disabled = true;
      btnSaveSupabase.innerText = "Publicando...";

      try {
        const usuarioLocal = JSON.parse(localStorage.getItem("usuarioLogado"));

        if (!usuarioLocal) {
          throw new Error(
            "Usuário não encontrado no localStorage. Faça login novamente."
          );
        }

        // Garante que o usuario_id seja a Primary Key 'id' da tabela 'usuarios'
        let userId = usuarioLocal.id;

        const { data: userBD } = await _supabase
          .from("usuarios")
          .select("id")
          .or(
            `id.eq.${userId},auth_id.eq.${userId},email.eq.${usuarioLocal.email}`
          )
          .maybeSingle();

        if (userBD) {
          userId = userBD.id;
        } else {
          throw new Error(
            "Usuário não encontrado na tabela 'usuarios' do banco de dados."
          );
        }

        let mediaUrlFinal = null;

        // Upload de mídia
        if (mediaFile) {
          const cleanName = mediaFile.name.replace(/[^a-zA-Z0-9.]/g, "_");
          const fileName = `atividade_${Date.now()}_${cleanName}`;

          const { error: errUpload } = await _supabase.storage
            .from("post-images")
            .upload(fileName, mediaFile);

          if (errUpload) {
            throw new Error(`Erro no Storage: ${errUpload.message}`);
          }

          const { data: publicUrlData } = _supabase.storage
            .from("post-images")
            .getPublicUrl(fileName);

          mediaUrlFinal = publicUrlData.publicUrl;
        }

        // Grava registro na tabela 'atividades'
        const payloadAtividade = {
          usuario_id: userId,
          descricao: descricao,
          distancia_km: parseFloat(distanciaTotalKm.toFixed(2)),
          duracao_minutos: tempoMinutos,
          calorias_kcal: calorias,
          elevacao_m: Math.round(elevacaoTotalM || 0),
          cidade: usuarioLocal?.cidade || "Tianguá",
          uf: usuarioLocal?.uf || "CE",
          media_url: mediaUrlFinal,
          data_postagem: new Date().toISOString(),
        };

        const { data: atividadeCriada, error: errAtividade } = await _supabase
          .from("atividades")
          .insert([payloadAtividade])
          .select();

        if (errAtividade) {
          throw new Error(`Erro no Banco: ${errAtividade.message}`);
        }

        // Salva as coordenadas da rota
        if (
          atividadeCriada &&
          atividadeCriada.length > 0 &&
          posicoes.length > 0
        ) {
          const atividadeId = atividadeCriada[0].id;
          const payloadCoords = posicoes.map((pos, index) => ({
            atividade_id: atividadeId,
            ordem: index,
            latitude: pos[0],
            longitude: pos[1],
            altitude: pos[2] || 0,
          }));

          await _supabase.from("coordenadas_rota").insert(payloadCoords);
        }

        if (mediaInput) mediaInput.value = "";
        const modalSaveEl = document.getElementById("modalSaveActivity");
        if (typeof bootstrap !== "undefined" && modalSaveEl) {
          const modalSave = bootstrap.Modal.getInstance(modalSaveEl);
          if (modalSave) modalSave.hide();
        }

        alert("Atividade salva e publicada no feed!");

        if (typeof carregarFeedGlobal === "function") {
          await carregarFeedGlobal();
        }
      } catch (err) {
        console.error("Erro completo:", err);
        alert(`Falha ao salvar a atividade:\n${err.message}`);
      } finally {
        btnSaveSupabase.disabled = false;
        btnSaveSupabase.innerText = "PUBLICAR NO FEED";
      }
    });
  }
});
