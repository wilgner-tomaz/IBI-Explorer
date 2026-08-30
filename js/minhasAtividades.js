let currentDbUser = null;
let modalEditar = null;

document.addEventListener("DOMContentLoaded", async () => {
  const modalEl = document.getElementById("modalEditarAtividade");
  if (modalEl) {
    modalEditar = new bootstrap.Modal(modalEl);
  }

  const usuarioSalvo = localStorage.getItem("usuarioLogado");
  if (!usuarioSalvo) {
    window.location.href = "index.html";
    return;
  }

  currentDbUser = JSON.parse(usuarioSalvo);
  await carregarMinhasAtividades();
});

async function carregarMinhasAtividades() {
  const container = document.getElementById("containerMinhasAtividades");

  try {
    const { data: atividades, error } = await _supabase
      .from("atividades")
      .select("*, usuarios(nome, foto_url)")
      .eq("usuario_id", currentDbUser.id)
      .order("data_postagem", { ascending: false });

    if (error) throw error;

    if (!atividades || atividades.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5 text-muted">
          <i class="bi bi-journal-x fs-1 d-block mb-2 text-primary"></i>
          <p class="m-0 fw-semibold">Você ainda não publicou nenhuma atividade.</p>
        </div>`;
      return;
    }

    container.innerHTML = atividades.map(act => {
      const dataFormatada = new Date(act.data_postagem).toLocaleDateString("pt-BR");
      const horaFormatada = new Date(act.data_postagem).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });
      
      const nomeUser = act.usuarios?.nome || currentDbUser.nome || "Explorador";
      const fotoUser = act.usuarios?.foto_url || currentDbUser.foto_url || "images/nature/Homem.jpeg";
      const visivel = act.visivel !== false;

      // Pega o link da mídia
      const urlMidia = act.media_url || act.midia_url;

      let mediaTag = '';
      if (urlMidia) {
        const isVideo = urlMidia.match(/\.(mp4|webm|ogg)$/i);
        if (isVideo) {
          mediaTag = `<div class="mt-3"><video src="${urlMidia}" controls class="feed-post-media w-100 rounded-3"></video></div>`;
        } else {
          mediaTag = `<div class="mt-3"><img src="${urlMidia}" class="feed-post-media w-100 rounded-3" style="max-height: 440px; object-fit: cover;" alt="Mídia da atividade" /></div>`;
        }
      }

      return `
        <div class="feed-item mb-4 p-3 border rounded-3 bg-white" id="feed-item-${act.id}">
          
          <!-- Cabeçalho -->
          <div class="d-flex align-items-center justify-content-between mb-3">
            <div class="d-flex align-items-center gap-3">
              <img src="${fotoUser}" class="feed-user-img rounded-circle" style="width: 44px; height: 44px; object-fit: cover;" alt="${nomeUser}">
              <div>
                <h6 class="mb-0 fw-bold text-dark">${nomeUser}</h6>
                <small class="text-muted">${dataFormatada} às ${horaFormatada} &bull; ${act.cidade || 'Tianguá'}</small>
              </div>
            </div>

            <!-- Botões de Ação -->
            <div class="d-flex align-items-center gap-1">
              <button class="btn btn-sm ${visivel ? 'btn-outline-primary' : 'btn-outline-secondary'}" 
                      title="${visivel ? 'Público no Feed' : 'Privado'}"
                      onclick="alternarVisibilidade('${act.id}', ${visivel})">
                <i class="bi ${visivel ? 'bi-eye-fill' : 'bi-eye-slash-fill'}"></i>
              </button>
              <button class="btn btn-sm btn-outline-primary" 
                      title="Editar"
                      onclick="abrirModalEditar('${act.id}', \`${act.descricao || ''}\`, '${act.distancia_km || 0}', '${act.duracao_minutos || 0}', '${act.calorias_kcal || 0}')">
                <i class="bi bi-pencil-square"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger" 
                      title="Excluir"
                      onclick="excluirAtividade('${act.id}')">
                <i class="bi bi-trash-fill"></i>
              </button>
            </div>
          </div>

          <!-- Descrição -->
          ${act.descricao ? `<p class="card-text text-dark mb-3">${act.descricao}</p>` : ''}

          <!-- Grid de Métricas -->
          <div class="row g-2 mb-2">
            <div class="col-4">
              <div class="metric-badge p-2 bg-light text-center rounded border">
                <strong class="d-block text-primary">${act.distancia_km || "0.00"}</strong>
                <small class="text-muted fw-bold">DISTÂNCIA (KM)</small>
              </div>
            </div>
            <div class="col-4">
              <div class="metric-badge p-2 bg-light text-center rounded border">
                <strong class="d-block text-primary">${act.duracao_minutos || "0"}</strong>
                <small class="text-muted fw-bold">TEMPO (MIN)</small>
              </div>
            </div>
            <div class="col-4">
              <div class="metric-badge p-2 bg-light text-center rounded border">
                <strong class="d-block text-primary">${act.calorias_kcal || "0"}</strong>
                <small class="text-muted fw-bold">GASTO (KCAL)</small>
              </div>
            </div>
          </div>

          <!-- Mídia Exibida -->
          ${mediaTag}

        </div>
      `;
    }).join("");

  } catch (err) {
    console.error("Erro ao carregar atividades:", err);
    container.innerHTML = `<div class="alert alert-danger">Erro ao carregar dados: ${err.message}</div>`;
  }
}

// Abrir Modal de Edição
function abrirModalEditar(id, descricao, dist, time, elev) {
  document.getElementById("editAtividadeId").value = id;
  document.getElementById("txtModalDescricao").value = descricao;
  document.getElementById("summaryDist").textContent = dist;
  document.getElementById("summaryTime").textContent = time;
  document.getElementById("summaryElev").textContent = elev;

  modalEditar?.show();
}

// Salvar Alterações na publicação
document.getElementById("btnConfirmSaveEdit")?.addEventListener("click", async () => {
  const id = document.getElementById("editAtividadeId").value;
  const descricao = document.getElementById("txtModalDescricao").value;
  const fileInput = document.getElementById("mediaInput");
  const file = fileInput.files[0];

  try {
    let updateData = { descricao: descricao };

    if (file) {
      const fileExt = file.name.split(".").pop();
      const fileName = `midia_${id}_${Date.now()}.${fileExt}`;
      const filePath = `atividades/${fileName}`;

      const { error: uploadError } = await _supabase.storage
        .from("post-images")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = _supabase.storage
        .from("post-images")
        .getPublicUrl(filePath);

      updateData.media_url = publicUrlData.publicUrl;
    }

    const { error } = await _supabase
      .from("atividades")
      .update(updateData)
      .eq("id", id);

    if (error) throw error;

    modalEditar?.hide();
    fileInput.value = "";
    await carregarMinhasAtividades();

  } catch (err) {
    alert("Erro ao atualizar publicação: " + err.message);
  }
});

// Alternar Visibilidade
async function alternarVisibilidade(id, visivelAtual) {
  try {
    const { error } = await _supabase
      .from("atividades")
      .update({ visivel: !visivelAtual })
      .eq("id", id);

    if (error) throw error;
    await carregarMinhasAtividades();
  } catch (err) {
    alert("Erro ao alterar visibilidade: " + err.message);
  }
}

// Excluir Atividade
async function excluirAtividade(id) {
  if (!confirm("Tem certeza que deseja apagar esta publicação?")) return;

  try {
    const { error } = await _supabase
      .from("atividades")
      .delete()
      .eq("id", id);

    if (error) throw error;
    await carregarMinhasAtividades();
  } catch (err) {
    alert("Erro ao excluir: " + err.message);
  }
}

// Logout
document.getElementById("btnLogout")?.addEventListener("click", () => {
  localStorage.removeItem("usuarioLogado");
  window.location.href = "index.html";
});