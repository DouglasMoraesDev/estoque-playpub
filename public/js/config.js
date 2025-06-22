// public/js/config.js

const formTrocarSenha = document.getElementById('form-trocar-senha');
const feedback = document.getElementById('config-feedback');

formTrocarSenha.addEventListener('submit', async (e) => {
  e.preventDefault();

  const currentPassword = document.getElementById('current-password').value.trim();
  const newPassword = document.getElementById('new-password').value.trim();
  const confirmPassword = document.getElementById('confirm-password').value.trim();

  feedback.textContent = ''; // limpa mensagem

  if (!currentPassword || !newPassword || !confirmPassword) {
    feedback.textContent = 'Preencha todos os campos.';
    return;
  }
  if (newPassword !== confirmPassword) {
    feedback.textContent = 'Nova senha e confirmação não conferem.';
    return;
  }
  if (newPassword.length < 6) {
    feedback.textContent = 'A nova senha deve ter ao menos 6 caracteres.';
    return;
  }

  try {
    const res = await fetch('/api/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    });
    const data = await res.json();

    if (!res.ok) {
      feedback.textContent = data.error || 'Erro ao trocar senha.';
      return;
    }

    // Se chegou aqui, senha trocada com sucesso
    feedback.style.color = 'green';
    feedback.textContent = data.message || 'Senha alterada com sucesso.';
    formTrocarSenha.reset();

    // Opcional: após alguns segundos, redirecionar de volta ao admin
    setTimeout(() => {
      window.location.href = '/admin';
    }, 2000);
  } catch (err) {
    console.error('Erro de rede ao trocar senha:', err);
    feedback.textContent = 'Falha de rede ao trocar senha.';
  }
});
