document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (data.success && !data.require2FA) {
      // Login normal (sem 2FA)
      window.location.href = "/dashboard";
    } else if (data.require2FA && data.twoFASetup) {
      // Usuário precisa ativar 2FA
      document.getElementById("qrCodeImage").src = data.qrCode;
      const modal = new bootstrap.Modal(document.getElementById("setup2FAModal"));
      modal.show();
    } else if (data.require2FA) {
      // Usuário já tem 2FA e precisa validar código
      const modal = new bootstrap.Modal(document.getElementById("verify2FAModal"));
      modal.show();
    } else {
      alert(data.message || "Erro ao fazer login");
    }
  });
});

async function submit2FASetup() {
  const token = document.getElementById("setup-token").value;

  const response = await fetch("/api/auth/2fa/setup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ token })
  });

  const data = await response.json();

  if (data.success) {
    window.location.href = "/dashboard";
  } else {
    document.getElementById("setup-error").textContent = data.message || "Erro na ativação do 2FA";
  }
}

async function submit2FAToken() {
  const token = document.getElementById("twofa-token").value;

  const response = await fetch("/api/auth/2fa/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ token })
  });

  const data = await response.json();

  if (data.success) {
    window.location.href = "/dashboard";
  } else {
    document.getElementById("twofa-error").textContent = data.message || "Token inválido";
  }
}
