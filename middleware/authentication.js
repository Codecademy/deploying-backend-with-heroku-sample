const dbData = require('../database/dbData');

const isAuth = async (req, res, next) => {

  try {

    const googleToken = req.headers['authorization'];

    if (typeof googleToken == 'undefined' || !googleToken) {
      throw new Error('no google token provided in auth header');
    }

    const user = await dbData.PlayerWithGoogleToken(googleToken);
    if (!user) throw new Error('no player with that google token found');

    req.loggedUser = user;

    next();

  } catch (error) {

    res.status(403).send({
      ok: false,
      message: 'cant authorize user: ' + error.message
    });

  }
}

module.exports = { isAuth };