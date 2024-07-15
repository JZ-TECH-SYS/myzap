
let router_url = new URL(window.location.href);
let params = new URLSearchParams(router_url.search);

//document.getElementById("apitoken").value = params.get("apitoken");
document.getElementById("session").value = params.get("session");
document.getElementById("sessionkey").value = params.get("sessionkey");

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

    axios.post(url + "/start", {
        session: document.getElementById("session").value,

        wh_status: document.getElementById("wh_status").value,
        wh_message: document.getElementById("wh_message").value,
        wh_qrcode: document.getElementById("wh_qrcode").value,
        wh_connect: document.getElementById("wh_connect").value,
        
    }, {
        headers: {
            apitoken: document.getElementById("apitoken").value,
            sessionkey: document.getElementById("sessionkey").value
        }
    })
    .then((value) => { 

        // document.getElementById('image').src = ""
        // document.getElementById('image').style.visibility = "hidden";

        if (value.data?.state == 'CONNECTED') {

            Swal.fire(
                'Sucesso!!',
                'Whatsapp já está conectado',
                'warning'
            )

            document.getElementById('image').src = "/ok.png"
        }

    })
    .catch((err) => { 
        
        Swal.fire(
            'Error!!',
            `${err ?? ''}`,
            'error'
        )

    })
}

    async function alterSession(session) {

        session = document.getElementById('session').value

        if (!session) {
            
            Swal.fire(
                'Error!!',
                'Digite o nome da sessão antes de continuar...',
                'error'
            )

            document.getElementById('image').src = "/error.png"
            document.getElementById('image').style.visibility = "visible";

        } else if (!document.getElementById('apitoken').value) {
            Swal.fire(
                'Error!!',
                'Digite o TOKEN da API antes de continuar...',
                'error'
            )

            document.getElementById('image').src = "/error.png"
            document.getElementById('image').style.visibility = "visible";

        } else if (!document.getElementById('sessionkey').value) {
            
            Swal.fire(
                'Error!!',
                'Digite a SESSION KEY da sessão antes de continuar...',
                'error'
            )

            document.getElementById('image').src = "/error.png"
            document.getElementById('image').style.visibility = "visible";

        }else {
            
            document.getElementById('image').style.visibility = "visible";
            document.getElementById('send-btn').disabled = true

            setTimeout(() => {
                document.getElementById('send-btn').disabled = false
            }, 10000);

            await getClient(session)
        }

        socket.on('qrcode', (qrcode) => {

            if (session == qrcode.session) {

                console.log('qrcode ===>', qrcode)
                
                if(typeof qrcode.qrCode === 'string'){
                    document.getElementById('image').src = qrcode.qrCode
                }else{
                    document.getElementById('image').src = "/error.png"
                }

            }

        })

        socket.on('events', (event) => {

            if (session == event.session) {

                console.log('event ===>', event)

                document.getElementById('status').innerHTML = `Resposta: ${event?.message ?? ''} / Estado: ${event?.state ?? ''}`
                
                if (event?.state == 'CONNECTED') {
                    Swal.fire(
                        'Sucesso!!',
                        'Whatsapp Aberto com sucesso',
                        'success'
                    )
                    document.getElementById('image').src = "/ok.png"
                }

                if (event?.state == 'DISCONNECTED' && event?.state != 'CONNECTED') {
                    Swal.fire(
                        'Error!!',
                        'Erro durante a inicialização da sessão',
                        'error'
                    )
                    document.getElementById('image').src = "/error.png"
                }
            }

        })
    }