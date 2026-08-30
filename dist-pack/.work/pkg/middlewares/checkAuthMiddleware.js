async function checkAuthMiddleware(req, res, next) {
    try {

        if (!req.session.usuario) {

            return res.render("pages/auth/login", {
                message: "Logout efetuado com sucesso",
                pageTitle: 'Logout',
                logo: process.env.LOGO,
                version: process.env.VERSION,
            });

        }

        let user = req.session.usuario;

        if (user.id && user.email) {
            return next();
        }

        return res.render("pages/auth/login", {
            message: "Se for o seu primeiro login admin@admin.com senha APIToken",
            pageTitle: 'Logout',
            logo: process.env.LOGO,
            version: process.env.VERSION,
        });

    } catch (error) {
        console.error("Erro no middleware de autenticação:", error);
        return res.status(500).send("Erro interno do servidor");
    }
}

exports.checkAuthMiddleware = checkAuthMiddleware;