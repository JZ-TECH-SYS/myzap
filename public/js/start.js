const router_url = new URL(window.location.href);
const params = new URLSearchParams(router_url.search);

// Preenche automaticamente os campos se vierem por URL
document.getElementById("session").value = params.get("session") ?? '';
document.getElementById("sessionkey").value = params.get("sessionkey") ?? '';

const socket = io(url, {
  transportOptions: {
    polling: {
      extraHeaders: {
        'Authorization': 'Bearer abc',
      },
    },
  },
});

async function getClient(session) {
  const payload = {
    session: document.getElementById("session").value,
    wh_status: document.getElementById("wh_status").value,
    wh_message: document.getElementById("wh_message").value,
    wh_qrcode: document.getElementById("wh_qrcode").value,
    wh_connect: document.getElementById("wh_connect").value,
    
    // Campos adicionais para seu controle
    empresa_nome: document.getElementById("empresa_nome")?.value,
    api_url: document.getElementById("api_url")?.value,
  };

  const headers = {
    apitoken: document.getElementById("apitoken").value,
    sessionkey: document.getElementById("sessionkey").value
  };

  try {
    const value = await axios.post(`${url}/start`, payload, { headers });

    if (value.data?.state === 'CONNECTED') {
      Swal.fire('Sucesso!!', 'Whatsapp já está conectado', 'success');
      document.getElementById('image').src = "/ok.png";
    }
  } catch (err) {
    Swal.fire('Erro!!', `${err?.response?.data?.message || err}`, 'error');
    document.getElementById('image').src = "/error.png";
  }
}

async function alterSession(session) {
  session = document.getElementById('session').value;

  const sessionKey = document.getElementById('sessionkey').value;
  const apiToken = document.getElementById('apitoken').value;

  if (!session) {
    return showError('Digite o nome da sessão antes de continuar...');
  }

  if (!apiToken) {
    return showError('Digite o TOKEN da API antes de continuar...');
  }

  if (!sessionKey) {
    return showError('Digite a SESSION KEY da sessão antes de continuar...');
  }

  document.getElementById('image').style.visibility = "visible";
  document.getElementById('send-btn').disabled = true;

  setTimeout(() => {
    document.getElementById('send-btn').disabled = false;
  }, 10000);

  await getClient(session);

  // QR Code listener
  socket.on('qrcode', (qrcode) => {
    if (session === qrcode.session) {
      console.log('qrcode ===>', qrcode);
      document.getElementById('image').src = qrcode.qrCode || "/error.png";
    }
  });

  // Eventos gerais
  socket.on('events', (event) => {
    if (session === event.session) {
      console.log('event ===>', event);

      document.getElementById('status').innerHTML =
        `Resposta: ${event?.message ?? ''} / Estado: ${event?.state ?? ''}`;

      if (event?.state === 'CONNECTED') {
        Swal.fire('Sucesso!!', 'Whatsapp Aberto com sucesso', 'success');
        document.getElementById('image').src = "/ok.png";
      }

      if (event?.state === 'DISCONNECTED') {
        Swal.fire('Erro!!', 'Erro durante a inicialização da sessão', 'error');
        document.getElementById('image').src = "/error.png";
      }
    }
  });
}

function showError(msg) {
  Swal.fire('Erro!!', msg, 'error');
  document.getElementById('image').src = "/error.png";
  document.getElementById('image').style.visibility = "visible";
}
