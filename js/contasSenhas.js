let currentDbUser = null;
const DEFAULT_AVATAR = "images/nature/Homem.jpeg";

document.addEventListener("DOMContentLoaded", async () => {
  const alertBox = document.getElementById("alertConta");
  const imgPreview = document.getElementById("imgPerfilPreview");

  try {
    // 1. Recupera o usuário salvo no localStorage
    const usuarioSalvo = localStorage.getItem("usuarioLogado");

    if (!usuarioSalvo) {
      console.warn("Nenhum usuário logado. Redirecionando...");
      window.location.href = "index.html";
      return;
    }

    currentDbUser = JSON.parse(usuarioSalvo);

    // 2. Busca dados atualizados diretamente do banco de dados
    const { data: dbUser, error } = await _supabase
      .from("usuarios")
      .select("*")
      .eq("id", currentDbUser.id)
      .maybeSingle();

    if (dbUser) {
      currentDbUser = dbUser;
      localStorage.setItem("usuarioLogado", JSON.stringify(dbUser));
    }

    // 3. Preenche o e-mail na tela
    if (document.getElementById("txtContaEmail")) {
      document.getElementById("txtContaEmail").value = currentDbUser.email || "";
    }

    // 4. Exibe a foto de perfil
    const fotoExibir = currentDbUser.foto_url || DEFAULT_AVATAR;
    if (imgPreview) {
      imgPreview.src = fotoExibir;
    }

  } catch (err) {
    console.error("Erro no Perfil:", err);
    if (alertBox) {
      alertBox.innerHTML = `<div class="alert alert-danger">Erro ao carregar perfil: ${err.message}</div>`;
    }
  }
});

// --- UPLOAD DE FOTO DE PERFIL ---
document.getElementById("filePerfilFoto")?.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file || !currentDbUser) return;

  const alertBox = document.getElementById("alertConta");
  const lblStatus = document.getElementById("lblFotoStatus");
  const spinner = document.getElementById("spinnerFoto");

  const reader = new FileReader();
  reader.onload = (event) => {
    document.getElementById("imgPerfilPreview").src = event.target.result;
  };
  reader.readAsDataURL(file);

  if (lblStatus) lblStatus.innerText = "Enviando imagem...";
  if (spinner) spinner.classList.remove("d-none");

  try {
    const fileExt = file.name.split(".").pop();
    const fileName = `perfil_${currentDbUser.id}_${Date.now()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    const { error: uploadError } = await _supabase.storage
      .from("post-images")
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw new Error(`Falha no upload: ${uploadError.message}`);

    const { data: publicUrlData } = _supabase.storage
      .from("post-images")
      .getPublicUrl(filePath);

    const finalFotoUrl = publicUrlData.publicUrl;

    const { error: updateDbError } = await _supabase
      .from("usuarios")
      .update({ foto_url: finalFotoUrl })
      .eq("id", currentDbUser.id);

    if (updateDbError) throw new Error(`Erro no banco: ${updateDbError.message}`);

    currentDbUser.foto_url = finalFotoUrl;
    localStorage.setItem("usuarioLogado", JSON.stringify(currentDbUser));

    if (alertBox) {
      alertBox.innerHTML = `
        <div class="alert alert-success alert-dismissible fade show" role="alert">
          Foto de perfil atualizada com sucesso!
          <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>`;
    }

  } catch (err) {
    console.error(err);
    if (alertBox) {
      alertBox.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  } finally {
    if (spinner) spinner.classList.add("d-none");
    if (lblStatus) lblStatus.innerText = "";
  }
});

// --- REMOVER FOTO DE PERFIL ---
document.getElementById("btnDeletePerfilFoto")?.addEventListener("click", async () => {
  if (!currentDbUser) return;

  const alertBox = document.getElementById("alertConta");

  try {
    const { error: updateDbError } = await _supabase
      .from("usuarios")
      .update({ foto_url: DEFAULT_AVATAR })
      .eq("id", currentDbUser.id);

    if (updateDbError) throw updateDbError;

    currentDbUser.foto_url = DEFAULT_AVATAR;
    localStorage.setItem("usuarioLogado", JSON.stringify(currentDbUser));
    document.getElementById("imgPerfilPreview").src = DEFAULT_AVATAR;

    if (alertBox) {
      alertBox.innerHTML = `
        <div class="alert alert-info alert-dismissible fade show" role="alert">
          Foto removida. Padrão restaurado!
          <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>`;
    }
  } catch (err) {
    if (alertBox) {
      alertBox.innerHTML = `<div class="alert alert-danger">Erro ao remover foto: ${err.message}</div>`;
    }
  }
});

// --- ALTERAR E-MAIL ---
document.getElementById("formEmail")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const alertBox = document.getElementById("alertConta");
  const novoEmail = document.getElementById("txtContaEmail").value;

  try {
    const { error } = await _supabase
      .from("usuarios")
      .update({ email: novoEmail })
      .eq("id", currentDbUser.id);

    if (error) throw error;

    currentDbUser.email = novoEmail;
    localStorage.setItem("usuarioLogado", JSON.stringify(currentDbUser));

    if (alertBox) {
      alertBox.innerHTML = `<div class="alert alert-success">E-mail atualizado com sucesso!</div>`;
    }
  } catch (err) {
    if (alertBox) {
      alertBox.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  }
});

// --- ALTERAR SENHA ---
document.getElementById("formSenha")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const alertBox = document.getElementById("alertConta");
  const novaSenha = document.getElementById("txtContaNovaSenha").value;
  const confirmarSenha = document.getElementById("txtContaConfirmarSenha").value;

  if (novaSenha !== confirmarSenha) {
    if (alertBox) {
      alertBox.innerHTML = `<div class="alert alert-warning">As senhas não coincidem.</div>`;
    }
    return;
  }

  try {
    const { error } = await _supabase
      .from("usuarios")
      .update({ senha: novaSenha })
      .eq("id", currentDbUser.id);

    if (error) throw error;

    currentDbUser.senha = novaSenha;
    localStorage.setItem("usuarioLogado", JSON.stringify(currentDbUser));

    if (alertBox) {
      alertBox.innerHTML = `<div class="alert alert-success">Senha alterada com sucesso!</div>`;
    }
    document.getElementById("formSenha").reset();
  } catch (err) {
    if (alertBox) {
      alertBox.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  }
});

// --- LOGOUT ---
document.getElementById("btnLogout")?.addEventListener("click", () => {
  localStorage.removeItem("usuarioLogado");
  window.location.href = "index.html";
});