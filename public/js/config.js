// public/js/config.js

const formTrocarSenha = document.getElementById('form-trocar-senha');
const feedback        = document.getElementById('config-feedback');
const btnBackup       = document.getElementById('btn-backup');

// Trocar senha (já existente)
formTrocarSenha.addEventListener('submit', async (e) => {
  e.preventDefault();

  const currentPassword = document.getElementById('current-password').value.trim();
  const newPassword     = document.getElementById('new-password').value.trim();
  const confirmPassword = document.getElementById('confirm-password').value.trim();

  feedback.textContent = ''; // limpa mensagem
  feedback.style.color   = ''; // reseta cor

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

    // Sucesso
    feedback.style.color = 'green';
    feedback.textContent = data.message || 'Senha alterada com sucesso.';
    formTrocarSenha.reset();

    setTimeout(() => {
      window.location.href = '/admin';
    }, 2000);
  } catch (err) {
    console.error('Erro de rede ao trocar senha:', err);
    feedback.textContent = 'Falha de rede ao trocar senha.';
  }
});

// Backup de produtos
btnBackup.addEventListener('click', async () => {
  btnBackup.disabled = true;
  btnBackup.textContent = 'Gerando backup...';
  try {
    // busca todos os produtos (independente de estoque)
    const res = await fetch('/api/products', { credentials: 'same-origin' });
    if (!res.ok) throw new Error('Falha ao buscar produtos');
    const produtos = await res.json();

    // converte em JSON e dispara download
    const blob = new Blob([JSON.stringify(produtos, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    const now  = new Date();
    const ts   = now.toISOString().replace(/[:.]/g, '-');
    a.download = `backup_produtos_${ts}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Erro no backup:', err);
    alert('Não foi possível gerar o backup.');
  } finally {
    btnBackup.disabled = false;
    btnBackup.textContent = 'Fazer Backup de Produtos';
  }
});
