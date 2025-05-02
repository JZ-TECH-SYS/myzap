module.exports = class Sockets {
    
    constructor(io) {
        
        this.io = io;

        // this.io.use((socket, next) => {
        //     if (socket.handshake.query && socket.handshake.query.token) {
        //         jwt.verify(socket.handshake.query.token, process.env.JWT_SECRET, (err, decoded) => {
        //             if (err) return next(new Error('Authentication error'));
        //             socket.decoded = decoded;
        //             next();
        //         });
        //     } else {
        //         next(new Error('Authentication error'));
        //     }
        // });
        
    }

    //consumeSession
    consumeSession(session, data) {
        this.io.emit('consume', data);
        return true;
    }

    //emitindo mensagem que qrcode mudou 
    qrCode(session, data) {
        this.io.emit('qrcode', data);
        return true;
    }

    //mudando statusFind
    statusFind(session, data) {
        this.io.emit('statusFind', data);
        return true;
    }

    //detectando start do servidor
    start(session, data) {
        this.io.emit('start', data);
        return true;
    }

    //enviando mensagem como emissor
    messagesent(session, data) {
        this.io.emit('send-message', data);
        return true;
    }
    
    //interfaces
    interface(session, data) {
        this.io.emit('interface', data);
        return true;
    }
    
    //recebendo mensagens
    message(session, data) {
        //console.log(data); receberdor de msg
        this.io.emit('message', data);
        return true;
    }
    //mudando status
    stateChange(session, data) {
        this.io.emit('stateChange', data);
        return true;
    }

    //webhook para detecção de alteracoes de status nas mensagens
    ack(session, data) {
        this.io.emit('ack', data);
        return true;
    }

    //Função para emitir mensagens de status
    events(session, data) {
        this.io.emit('events', data)
    }
    
    //Função para emitir um alerta
    alert(session, data) {
        this.io.emit('alert', data);
        return true;
    }
}