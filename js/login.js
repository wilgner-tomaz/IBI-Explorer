document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("email").value.trim();
      const senha = document.getElementById("senha").value;

      try {
        // 1. Tenta buscar primeiro na tabela de administradores
        const { data: adminData, error: adminError } = await _supabase
          .from("administradores")
          .select("*")
          .eq("email", email)
          .eq("senha", senha)
          .maybeSingle();

        // Se encontrou o admin com email e senha corretos
        if (!adminError && adminData) {
          localStorage.setItem("usuarioLogado", JSON.stringify(adminData));
          alert(`Bem-vindo ao painel administrativo, ${adminData.nome}!`);
          window.location.href = "admin.html";
          return;
        }

        // 2. Se não for admin, consulta na tabela de usuários comuns
        const { data: usuario, error: usuarioError } = await _supabase
          .from("usuarios")
          .select("*")
          .eq("email", email)
          .eq("senha", senha)
          .maybeSingle();

        if (usuarioError || !usuario) {
          alert("E-mail ou senha incorretos!");
          return;
        }

        // Salva a sessão do usuário comum no navegador
        localStorage.setItem("usuarioLogado", JSON.stringify(usuario));

        alert(`Bem-vindo de volta, ${usuario.nome}!`);
        window.location.href = "feedUsuario.html";
      } catch (err) {
        console.error("Erro na autenticação:", err);
        alert("Ocorreu um erro ao tentar entrar. Tente novamente.");
      }
    });
  }
});
