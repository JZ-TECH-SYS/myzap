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

// ✅ ADICIONADO - Logs de conexão Socket.IO para debugging
socket.on('connect', () => {
  console.log('🔌 Socket.IO conectado com sucesso');
  console.log('📡 Socket ID:', socket.id);
});

socket.on('disconnect', () => {
  console.log('❌ Socket.IO desconectado');
});

socket.on('connect_error', (error) => {
  console.error('❌ Erro de conexão Socket.IO:', error);
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
    
    console.log('📨 Resposta do /start:', value.data);

    if (value.data?.state === 'CONNECTED') {
      Swal.fire('Sucesso!!', 'Whatsapp já está conectado', 'success');
      const imageElement = document.getElementById('image');
      if (imageElement) {
        imageElement.src = "/ok.png";
        imageElement.style.visibility = "visible";
      }
    }
    
    // ✅ ADICIONADO - Verificar se QR Code veio na resposta HTTP (para WhatsApp WebJS)
    if (value.data?.state === 'QRCODE' && value.data?.qrcode) {
      console.log('📱 QR Code recebido via HTTP:', value.data);
      
      const imageElement = document.getElementById('image');
      if (imageElement) {
        imageElement.src = value.data.qrcode;
        imageElement.style.visibility = "visible";
        console.log('✅ QR Code exibido via resposta HTTP');
        
        // Atualizar texto da área do QR Code
        const qrArea = document.querySelector('.qrcode-area h4');
        const qrSmall = document.querySelector('.qrcode-area small');
        if (qrArea) qrArea.innerHTML = '<i class="fas fa-qrcode"></i> QR Code Gerado (HTTP)';
        if (qrSmall) qrSmall.textContent = 'Escaneie o QR Code com seu celular!';
      }
    }
    
  } catch (err) {
    console.error('❌ Erro na requisição /start:', err);
    Swal.fire('Erro!!', `${err?.response?.data?.message || err}`, 'error');
    const imageElement = document.getElementById('image');
    if (imageElement) {
      imageElement.src = "/error.png";
      imageElement.style.visibility = "visible";
    }
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

  // QR Code listener (Socket.IO)
  socket.on('qrcode', (qrcode) => {
    if (session === qrcode.session) {
      console.log('📡 QR Code recebido via Socket.IO:', qrcode);
      
      // ✅ CORRIGIDO - Tornar a imagem visível e definir o QR Code
      const imageElement = document.getElementById('image');
      if (imageElement) {
        imageElement.src = qrcode.qrCode || "/error.png";
        imageElement.style.visibility = "visible"; // Mostrar a imagem
        console.log('✅ QR Code exibido via Socket.IO');
        
        // Atualizar texto da área do QR Code
        const qrArea = document.querySelector('.qrcode-area h4');
        const qrSmall = document.querySelector('.qrcode-area small');
        if (qrArea) qrArea.innerHTML = '<i class="fas fa-qrcode"></i> QR Code Gerado (Socket.IO)';
        if (qrSmall) qrSmall.textContent = 'Escaneie o QR Code com seu celular!';
      } else {
        console.error('❌ Elemento #image não encontrado');
      }
    }
  });

  // Eventos gerais
  socket.on('events', (event) => {
    console.log('📨 Evento recebido:', event);
    if (session === event.session) {
      console.log('event ===>', event);

      document.getElementById('status').innerHTML =
        `Resposta: ${event?.message ?? ''} / Estado: ${event?.state ?? ''}`;

      if (event?.state === 'CONNECTED') {
        Swal.fire('Sucesso!!', 'Whatsapp Aberto com sucesso', 'success');
        const imageElement = document.getElementById('image');
        if (imageElement) {
          imageElement.src = "/ok.png";
          imageElement.style.visibility = "visible";
        }
      }

      if (event?.state === 'DISCONNECTED') {
        Swal.fire('Erro!!', 'Erro durante a inicialização da sessão', 'error');
        const imageElement = document.getElementById('image');
        if (imageElement) {
          imageElement.src = "/error.png";
          imageElement.style.visibility = "visible";
        }
      }
    }
  });
}

function showError(msg) {
  Swal.fire('Erro!!', msg, 'error');
  document.getElementById('image').src = "/error.png";
  document.getElementById('image').style.visibility = "visible";
}
