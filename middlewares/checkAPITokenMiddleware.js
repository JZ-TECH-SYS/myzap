
require('dotenv').config();

const checkAPITokenMiddleware = async (req, res, next) => {

	let apitoken = req?.headers['apitoken']

	if (!apitoken) {
		res.status(400).json({ error: 'NOT AUTHORIZED, please provide an API TOKEN in the headers.' });
	}

	if (apitoken != process.env.TOKEN) {
		res.status(403).json({ error: "UNAUTHORIZED, API TOKEN is not valid." });
	}

	next()

}

exports.checkAPITokenMiddleware = checkAPITokenMiddleware