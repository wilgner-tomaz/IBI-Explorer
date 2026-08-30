// Função para gerar senha aleatória de 8 caracteres
function gerarSenhaAleatoria(tamanho = 8) {
  const caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let senha = "";
  for (let i = 0; i < tamanho; i++) {
    const randomIndex = Math.floor(Math.random() * caracteres.length);
    senha += caracteres.charAt(randomIndex);
  }
  return senha;
}

document.addEventListener("DOMContentLoaded", () => {
  const esqueciSenhaForm = document.getElementById("esqueciSenhaForm");
  const btnEnviar = document.getElementById("btnEnviarEmail");

  if (esqueciSenhaForm) {
    esqueciSenhaForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("emailRecuperacao").value.trim();

      if (btnEnviar) {
        btnEnviar.disabled = true;
        btnEnviar.innerText = "Processando...";
      }

      try {
        // 1. Verifica se o usuário existe na tabela public.usuarios
        const { data: usuario, error: searchError } = await _supabase
          .from("usuarios")
          .select("id, email, nome")
          .eq("email", email)
          .maybeSingle();

        if (searchError || !usuario) {
          alert("E-mail não encontrado no sistema!");
          return;
        }

        // 2. Gera a nova senha automática
        const novaSenhaAutomatica = gerarSenhaAleatoria(8);

        // 3. Atualiza a nova senha na tabela public.usuarios
        const { error: updateError } = await _supabase
          .from("usuarios")
          .update({ senha: novaSenhaAutomatica })
          .eq("id", usuario.id);

        if (updateError) {
          throw new Error("Erro ao atualizar senha no banco de dados.");
        }

        // 4. Envio do e-mail via EmailJS (ou fallback de aviso)
        try {
          await emailjs.send("YOUR_SERVICE_ID", "YOUR_TEMPLATE_ID", {
            to_name: usuario.nome || "Usuário",
            to_email: usuario.email,
            nova_senha: novaSenhaAutomatica,
          });
          
          alert(`Uma nova senha foi gerada e enviada com sucesso para ${usuario.email}!`);
        } catch (emailErr) {
          console.warn("EmailJS não configurado ou falhou. Exibindo alerta alternativo:", emailErr);
          
          // Caso o EmailJS ainda não esteja configurado com suas chaves, ele exibe a senha diretamente na tela
          alert(`Sua nova senha foi gerada com sucesso!\n\nSua nova senha é: ${novaSenhaAutomatica}\n\nUse-a para fazer login.`);
        }

        // Redireciona de volta para a tela de login
        window.location.href = "login.html";

      } catch (err) {
        console.error("Erro na recuperação de senha:", err);
        alert("Ocorreu um erro ao processar a solicitação: " + err.message);
      } finally {
        if (btnEnviar) {
          btnEnviar.disabled = false;
          btnEnviar.innerText = "Enviar Nova Senha";
        }
      }
    });
  }
});