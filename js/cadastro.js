document.addEventListener("DOMContentLoaded", () => {
  const registerForm = document.getElementById("registerForm");

  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const btnCadastrar = registerForm.querySelector("button[type='submit']");
      if (btnCadastrar) {
        btnCadastrar.disabled = true;
        btnCadastrar.innerText = "Cadastrando...";
      }

      const nome = document.getElementById("name").value.trim();
      const sobrenome = document.getElementById("lastName").value.trim();
      const telefone = document.getElementById("phone").value.trim();
      const email = document.getElementById("newEmail").value.trim();
      const senha = document.getElementById("newSenha").value;

      const nomeCompleto = `${nome} ${sobrenome}`.trim();

      try {
        // 1. Verificar se a conexão com o Supabase está pronta
        if (typeof _supabase === "undefined") {
          throw new Error("Cliente Supabase não foi inicializado. Verifique o js/supabase-config.js.");
        }

        // 2. Tentar inserir diretamente na tabela 'usuarios'
        const { data, error } = await _supabase
          .from("usuarios")
          .insert([
            {
              nome: nomeCompleto,
              email: email,
              senha: senha,
              telefone: telefone
            }
          ])
          .select();

        if (error) {
          console.error("Erro detalhado do Supabase:", error);
          alert(`Erro do Banco de Dados: ${error.message || error.details}`);
          return;
        }

        // 3. Sucesso ao criar conta
        if (data && data.length > 0) {
          localStorage.setItem("usuarioLogado", JSON.stringify(data[0]));
        }

        alert("Cadastro realizado com sucesso!");
        window.location.href = "feedUsuario.html";

      } catch (err) {
        console.error("Erro no processo de cadastro:", err);
        alert(`Falha no cadastro: ${err.message || "Verifique o console do seu navegador."}`);
      } finally {
        if (btnCadastrar) {
          btnCadastrar.disabled = false;
          btnCadastrar.innerText = "Cadastrar";
        }
      }
    });
  }
});