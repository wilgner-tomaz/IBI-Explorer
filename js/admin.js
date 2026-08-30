let mapAdmin = null;
let polylineAdmin = null;
let coordsGpxExtraidas = [];
let distanciaTotalKm = 0;
let editModalInstance = null;

document.addEventListener("DOMContentLoaded", () => {
  // Inicializa Modal do Bootstrap
  editModalInstance = new bootstrap.Modal(
    document.getElementById("modalEdicao")
  );

  // Inicializa mapa de pré-visualização do ADM
  mapAdmin = L.map("mapPreviewAdmin").setView([-3.7319, -40.9921], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(
    mapAdmin
  );

  // Event Listeners
  document
    .getElementById("rotaFileGpx")
    .addEventListener("change", processarArquivoGPX);
  document
    .getElementById("formCadastraRota")
    .addEventListener("submit", salvarRota);
  document
    .getElementById("formCadastraGuia")
    .addEventListener("submit", salvarGuia);
  document
    .getElementById("formCadastraPonto")
    .addEventListener("submit", salvarPonto);
  document
    .getElementById("formEdicao")
    .addEventListener("submit", salvarEdicao);

  // Carrega as listagens
  carregarRotas();
  carregarGuias();
  carregarPontos();
});

// --- GPX PROCESSOR ---
function processarArquivoGPX(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (evt) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(evt.target.result, "text/xml");
    const trackPoints = xmlDoc.getElementsByTagName("trkpt");

    if (trackPoints.length === 0) {
      alert("Nenhum ponto de trajeto válido encontrado no arquivo GPX.");
      return;
    }

    coordsGpxExtraidas = [];
    let distanciaMeters = 0;

    for (let i = 0; i < trackPoints.length; i++) {
      const lat = parseFloat(trackPoints[i].getAttribute("lat"));
      const lon = parseFloat(trackPoints[i].getAttribute("lon"));
      const ptAtual = [lat, lon];

      coordsGpxExtraidas.push(ptAtual);

      if (i > 0) {
        distanciaMeters += L.latLng(coordsGpxExtraidas[i - 1]).distanceTo(
          L.latLng(ptAtual)
        );
      }
    }

    distanciaTotalKm = (distanciaMeters / 1000).toFixed(2);

    if (polylineAdmin) mapAdmin.removeLayer(polylineAdmin);
    polylineAdmin = L.polyline(coordsGpxExtraidas, {
      color: "#007bff",
      weight: 4,
    }).addTo(mapAdmin);
    mapAdmin.fitBounds(polylineAdmin.getBounds());

    document.getElementById("btnSalvarRota").disabled = false;
  };

  reader.readAsText(file);
}

// --- SALVAR REGISTROS ---
async function salvarRota(e) {
  e.preventDefault();
  const nome = document.getElementById("rotaNome").value;
  const dificuldade = document.getElementById("rotaDificuldade").value;
  const descricao = document.getElementById("rotaDescricao").value;
  const mediaFileInput = document.getElementById("rotaMediaInput");

  let mediaUrl = null;

  if (mediaFileInput && mediaFileInput.files.length > 0) {
    const file = mediaFileInput.files[0];
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}_${Math.random()
      .toString(36)
      .substring(7)}.${fileExt}`;
    const filePath = `rotas/${fileName}`;

    const { error: uploadError } = await _supabase.storage
      .from("rotas-midia")
      .upload(filePath, file);

    if (uploadError) {
      alert("Erro ao enviar mídia: " + uploadError.message);
      return;
    }

    const { data: publicUrlData } = _supabase.storage
      .from("rotas-midia")
      .getPublicUrl(filePath);
    mediaUrl = publicUrlData.publicUrl;
  }

  const { error } = await _supabase.from("rotas").insert([
    {
      nome: nome,
      dificuldade: dificuldade,
      distancia_km: distanciaTotalKm,
      descricao: descricao,
      coords: coordsGpxExtraidas,
      media_url: mediaUrl,
      visivel: true,
    },
  ]);

  if (error) alert("Erro ao salvar rota: " + error.message);
  else {
    alert("Rota cadastrada!");
    location.reload();
  }
}

async function salvarGuia(e) {
  e.preventDefault();
  const { error } = await _supabase.from("guias_locais").insert([
    {
      nome: document.getElementById("guiaNome").value,
      especialidade: document.getElementById("guiaEspecialidade").value,
      telefone: document.getElementById("guiaTelefone").value,
      cidade: document.getElementById("guiaCidade").value,
    },
  ]);

  if (error) alert("Erro ao salvar guia: " + error.message);
  else {
    alert("Guia cadastrado!");
    location.reload();
  }
}

async function salvarPonto(e) {
  e.preventDefault();
  const mediaFileInput = document.getElementById("pontoMediaInput");
  let mediaUrl = null;

  if (mediaFileInput && mediaFileInput.files.length > 0) {
    const file = mediaFileInput.files[0];
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}_${Math.random()
      .toString(36)
      .substring(7)}.${fileExt}`;
    const filePath = `pontos/${fileName}`;

    const { error: uploadError } = await _supabase.storage
      .from("rotas-midia")
      .upload(filePath, file);

    if (!uploadError) {
      const { data: publicUrlData } = _supabase.storage
        .from("rotas-midia")
        .getPublicUrl(filePath);
      mediaUrl = publicUrlData.publicUrl;
    }
  }

  const { error } = await _supabase.from("pontos_apoio").insert([
    {
      nome: document.getElementById("pontoNome").value,
      categoria: document.getElementById("pontoCategoria").value,
      latitude: parseFloat(document.getElementById("pontoLat").value),
      longitude: parseFloat(document.getElementById("pontoLng").value),
      media_url: mediaUrl,
    },
  ]);

  if (error) alert("Erro ao salvar ponto: " + error.message);
  else {
    alert("Ponto de apoio cadastrado!");
    location.reload();
  }
}

// --- CARREGAR LISTAS ---
async function carregarRotas() {
  const { data, error } = await _supabase
    .from("rotas")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return;

  const tbody = document.getElementById("listaRotasBody");
  tbody.innerHTML = "";

  data.forEach((r) => {
    const isVisivel = r.visivel !== false;
    tbody.innerHTML += `
      <tr>
        <td class="fw-bold">${r.nome}</td>
        <td><span class="badge bg-secondary">${r.dificuldade}</span></td>
        <td>${r.distancia_km} km</td>
        <td><span class="badge ${isVisivel ? "bg-success" : "bg-danger"}">${
      isVisivel ? "Visível" : "Oculto"
    }</span></td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-warning me-1" onclick="abrirEdicao('rotas', '${
            r.id
          }')"><i class="bi bi-pencil-fill"></i></button>
          <button class="btn btn-sm ${
            isVisivel ? "btn-outline-secondary" : "btn-outline-success"
          } me-1" onclick="alternarVisibilidade('rotas', '${
      r.id
    }', ${!isVisivel})">
            <i class="bi ${
              isVisivel ? "bi-eye-slash-fill" : "bi-eye-fill"
            }"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="excluirRegistro('rotas', '${
            r.id
          }')"><i class="bi bi-trash-fill"></i></button>
        </td>
      </tr>
    `;
  });
}

async function carregarGuias() {
  const { data, error } = await _supabase
    .from("guias_locais")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return;

  const tbody = document.getElementById("listaGuiasBody");
  tbody.innerHTML = "";

  data.forEach((g) => {
    tbody.innerHTML += `
      <tr>
        <td class="fw-bold">${g.nome}</td>
        <td>${g.especialidade || "-"}</td>
        <td>${g.telefone}</td>
        <td>${g.cidade}</td>
        <td><span class="badge bg-success">Ativo</span></td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-warning me-1" onclick="abrirEdicao('guias_locais', '${
            g.id
          }')"><i class="bi bi-pencil-fill"></i></button>
          <button class="btn btn-sm btn-outline-danger" onclick="excluirRegistro('guias_locais', '${
            g.id
          }')"><i class="bi bi-trash-fill"></i></button>
        </td>
      </tr>
    `;
  });
}

async function carregarPontos() {
  const { data, error } = await _supabase
    .from("pontos_apoio")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return;

  const tbody = document.getElementById("listaPontosBody");
  tbody.innerHTML = "";

  data.forEach((p) => {
    tbody.innerHTML += `
      <tr>
        <td class="fw-bold">${p.nome}</td>
        <td><span class="badge bg-info text-dark">${p.categoria}</span></td>
        <td>${p.latitude}, ${p.longitude}</td>
        <td><span class="badge bg-success">Ativo</span></td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-warning me-1" onclick="abrirEdicao('pontos_apoio', '${p.id}')"><i class="bi bi-pencil-fill"></i></button>
          <button class="btn btn-sm btn-outline-danger" onclick="excluirRegistro('pontos_apoio', '${p.id}')"><i class="bi bi-trash-fill"></i></button>
        </td>
      </tr>
    `;
  });
}

// --- VISIBILIDADE E EXCLUSÃO ---
async function alternarVisibilidade(tabela, id, novoEstado) {
  const { error } = await _supabase
    .from(tabela)
    .update({ visivel: novoEstado })
    .eq("id", id);
  if (error) alert("Erro ao alterar visibilidade: " + error.message);
  else location.reload();
}

async function excluirRegistro(tabela, id) {
  if (!confirm("Tem certeza que deseja excluir este registro?")) return;
  const { error } = await _supabase.from(tabela).delete().eq("id", id);
  if (error) alert("Erro ao excluir: " + error.message);
  else location.reload();
}

// --- EDIÇÃO VIA MODAL ---
async function abrirEdicao(tabela, id) {
  const { data, error } = await _supabase
    .from(tabela)
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) return alert("Erro ao buscar dados do registro.");

  document.getElementById("editId").value = id;
  document.getElementById("editTipo").value = tabela;
  const container = document.getElementById("modalEdicaoCampos");
  container.innerHTML = "";

  // Helper para gerar a caixa visual unificada de upload / mídia atual
  const gerarBlocoUpload = (mediaUrl, inputId) => `
    <div class="mb-3">
      <label class="form-label fw-semibold">Foto / Mídia (Atual e Nova)</label>
      <div class="border border-2 border-dashed rounded p-3 text-center bg-light position-relative" style="cursor: pointer; border-style: dashed !important;" onclick="document.getElementById('${inputId}').click()">
        <input type="file" id="${inputId}" class="d-none" accept="image/*,video/*" multiple onchange="mostrarNomesArquivos(this, '${inputId}-info')" />
        
        <div class="mb-2">
          ${
            mediaUrl
              ? mediaUrl.match(/\.(mp4|webm|ogg)$/i)
                ? `<video src="${mediaUrl}" controls style="max-height: 120px; max-width: 100%; border-radius: 4px;"></video>`
                : `<img src="${mediaUrl}" alt="Mídia Atual" style="max-height: 120px; max-width: 100%; border-radius: 4px; object-fit: contain;" />`
              : `<div class="text-primary mb-1"><i class="bi bi-cloud-arrow-up fs-2"></i></div>
             <span class="fw-semibold text-secondary">Arraste arquivos ou clique aqui</span>`
          }
        </div>
        <div id="${inputId}-info" class="small text-muted mt-1">
          ${
            mediaUrl
              ? '<span class="d-block text-success small">Mídia salva atualmente no sistema</span>'
              : "Suporta múltiplos arquivos (fotos e vídeos)"
          }
        </div>
      </div>
      ${
        mediaUrl
          ? `
        <div class="form-check mt-2">
          <input class="form-check-input" type="checkbox" id="editRemoverMedia">
          <label class="form-check-label text-danger small fw-semibold" for="editRemoverMedia">Remover mídia atual</label>
        </div>`
          : ""
      }
    </div>
  `;

  if (tabela === "rotas") {
    container.innerHTML = `
      <div class="mb-3">
        <label class="form-label fw-semibold">Nome</label>
        <input type="text" id="editNome" class="form-control" value="${
          data.nome
        }" required />
      </div>
      <div class="mb-3">
        <label class="form-label fw-semibold">Dificuldade</label>
        <select id="editDificuldade" class="form-select">
          <option value="Fácil" ${
            data.dificuldade === "Fácil" ? "selected" : ""
          }>Fácil</option>
          <option value="Médio" ${
            data.dificuldade === "Médio" ? "selected" : ""
          }>Médio</option>
          <option value="Difícil" ${
            data.dificuldade === "Difícil" ? "selected" : ""
          }>Difícil</option>
        </select>
      </div>
      <div class="mb-3">
        <label class="form-label fw-semibold">Descrição</label>
        <textarea id="editDescricao" class="form-control" rows="3">${
          data.descricao || ""
        }</textarea>
      </div>
      <div class="mb-3">
        <label class="form-label fw-semibold">Substituir Arquivo GPX (Opcional)</label>
        <input type="file" id="editRotaFileGpx" class="form-control" accept=".gpx" />
        <small class="text-muted">Se não escolher nada, o traçado atual será mantido.</small>
      </div>
      ${gerarBlocoUpload(data.media_url, "editRotaMediaInput")}
    `;
  } else if (tabela === "guias_locais") {
    container.innerHTML = `
      <div class="mb-3">
        <label class="form-label fw-semibold">Nome</label>
        <input type="text" id="editNome" class="form-control" value="${
          data.nome
        }" required />
      </div>
      <div class="mb-3">
        <label class="form-label fw-semibold">Especialidade</label>
        <input type="text" id="editEspecialidade" class="form-control" value="${
          data.especialidade || ""
        }" required />
      </div>
      <div class="mb-3">
        <label class="form-label fw-semibold">Telefone</label>
        <input type="text" id="editTelefone" class="form-control" value="${
          data.telefone
        }" required />
      </div>
      <div class="mb-3">
        <label class="form-label fw-semibold">Cidade</label>
        <input type="text" id="editCidade" class="form-control" value="${
          data.cidade || ""
        }" required />
      </div>
      ${gerarBlocoUpload(data.foto_url, "editGuiaMediaInput")}
    `;
  } else if (tabela === "pontos_apoio") {
    container.innerHTML = `
      <div class="mb-3">
        <label class="form-label fw-semibold">Nome</label>
        <input type="text" id="editNome" class="form-control" value="${
          data.nome
        }" required />
      </div>
      <div class="mb-3">
        <label class="form-label fw-semibold">Categoria</label>
        <select id="editCategoria" class="form-select">
          <option value="Alimentação" ${
            data.categoria === "Alimentação" ? "selected" : ""
          }>Alimentação</option>
          <option value="Hospedagem" ${
            data.categoria === "Hospedagem" ? "selected" : ""
          }>Hospedagem</option>
          <option value="Manutenção" ${
            data.categoria === "Manutenção" ? "selected" : ""
          }>Manutenção</option>
        </select>
      </div>
      <div class="row mb-3">
        <div class="col-6">
          <label class="form-label fw-semibold">Latitude</label>
          <input type="number" step="any" id="editLat" class="form-control" value="${
            data.latitude
          }" required />
        </div>
        <div class="col-6">
          <label class="form-label fw-semibold">Longitude</label>
          <input type="number" step="any" id="editLng" class="form-control" value="${
            data.longitude
          }" required />
        </div>
      </div>
      ${gerarBlocoUpload(data.media_url, "editPontoMediaInput")}
    `;
  }

  editModalInstance.show();
}

// Função auxiliar para exibir os nomes dos arquivos selecionados no box de upload
function mostrarNomesArquivos(input, infoId) {
  const infoDiv = document.getElementById(infoId);
  if (input.files.length > 0) {
    const nomes = Array.from(input.files)
      .map((f) => f.name)
      .join(", ");
    infoDiv.innerHTML = `<span class="text-primary fw-semibold">${input.files.length} arquivo(s) selecionado(s):</span> <span class="small text-dark">${nomes}</span>`;
  }
}

async function salvarEdicao(e) {
  e.preventDefault();
  const id = document.getElementById("editId").value;
  const tabela = document.getElementById("editTipo").value;

  const { data: registroAtual } = await _supabase
    .from(tabela)
    .select("*")
    .eq("id", id)
    .single();

  let updatePayload = {};

  // Para guias_locais usamos foto_url, para as outras usamos media_url
  let campoMedia = tabela === "guias_locais" ? "foto_url" : "media_url";
  let mediaUrl = registroAtual ? registroAtual[campoMedia] : null;
  const removerMedia = document.getElementById("editRemoverMedia")?.checked;

  if (removerMedia) {
    mediaUrl = null;
  }

  let inputMediaId = "editRotaMediaInput";
  if (tabela === "guias_locais") inputMediaId = "editGuiaMediaInput";
  if (tabela === "pontos_apoio") inputMediaId = "editPontoMediaInput";

  const mediaFileInput = document.getElementById(inputMediaId);
  if (mediaFileInput && mediaFileInput.files.length > 0) {
    const file = mediaFileInput.files[0];
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}_${Math.random()
      .toString(36)
      .substring(7)}.${fileExt}`;
    const filePath = `${
      tabela === "rotas"
        ? "rotas"
        : tabela === "guias_locais"
        ? "guias"
        : "pontos"
    }/${fileName}`;

    const { error: uploadError } = await _supabase.storage
      .from("rotas-midia")
      .upload(filePath, file);

    if (!uploadError) {
      const { data: publicUrlData } = _supabase.storage
        .from("rotas-midia")
        .getPublicUrl(filePath);
      mediaUrl = publicUrlData.publicUrl;
    }
  }

  if (tabela === "rotas") {
    let coordsGpx = registroAtual.coords;
    let distanciaKm = registroAtual.distancia_km;

    const gpxInput = document.getElementById("editRotaFileGpx");
    if (gpxInput && gpxInput.files.length > 0) {
      const file = gpxInput.files[0];
      const gpxText = await file.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(gpxText, "text/xml");
      const trackPoints = xmlDoc.getElementsByTagName("trkpt");

      if (trackPoints.length > 0) {
        coordsGpx = [];
        let distanciaMeters = 0;
        for (let i = 0; i < trackPoints.length; i++) {
          const lat = parseFloat(trackPoints[i].getAttribute("lat"));
          const lon = parseFloat(trackPoints[i].getAttribute("lon"));
          const ptAtual = [lat, lon];
          coordsGpx.push(ptAtual);
          if (i > 0) {
            distanciaMeters += L.latLng(coordsGpx[i - 1]).distanceTo(
              L.latLng(ptAtual)
            );
          }
        }
        distanciaKm = (distanciaMeters / 1000).toFixed(2);
      }
    }

    updatePayload = {
      nome: document.getElementById("editNome").value,
      dificuldade: document.getElementById("editDificuldade").value,
      descricao: document.getElementById("editDescricao").value,
      coords: coordsGpx,
      distancia_km: distanciaKm,
      media_url: mediaUrl,
    };
  } else if (tabela === "guias_locais") {
    updatePayload = {
      nome: document.getElementById("editNome").value,
      especialidade: document.getElementById("editEspecialidade").value,
      telefone: document.getElementById("editTelefone").value,
      cidade: document.getElementById("editCidade").value,
      foto_url: mediaUrl,
    };
  } else if (tabela === "pontos_apoio") {
    updatePayload = {
      nome: document.getElementById("editNome").value,
      categoria: document.getElementById("editCategoria").value,
      latitude: parseFloat(document.getElementById("editLat").value),
      longitude: parseFloat(document.getElementById("editLng").value),
      media_url: mediaUrl,
    };
  }

  const { error } = await _supabase
    .from(tabela)
    .update(updatePayload)
    .eq("id", id);

  if (error) {
    alert("Erro ao atualizar: " + error.message);
  } else {
    alert("Registro atualizado com sucesso!");
    location.reload();
  }
}
