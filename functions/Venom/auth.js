import Sessions from '../../controllers/SessionsController.js';
export default class Auth {

    static async getQrCode(req, res) {

        let session = req.query.session;
        let sessionkey = req.query.sessionkey;
        let data = Sessions.getSession(session)

        if (!session) {
            return res.status(401).json({
                "result": 401,
                "messages": "Não autorizado, verifique se o nome da sessão esta correto"
            })
        }
        else
            if (data.sessionkey != sessionkey) {
                return res.status(401).json({
                    "result": 401,
                    "messages": "Não autorizado, verifique se o sessionkey esta correto"
                })
            }
            else {
                try {
                    var img = Buffer.from(data.qrCode.replace(/^data:image\/(png|jpeg|jpg);base64,/, ''), 'base64');
                    res.writeHead(200, {
                        'Content-Type': 'image/png',
                        'Content-Length': img.length
                    });
                    res.end(img);
                } catch (ex) {
                    return res.status(400).json({
                        response: false,
                        message: "Error ao recuperar QRCode !"
                    });
                }
            }

    }
    
    static async 
}

