const express = require('express');
const userRouter = express.Router();
const dbFunctions = require('../database/dbFunctions'); //should be replaced
const dbData = require('../database/dbData');
const { isAuth, Login } = require('../middleware/authentication');
const { ValidateChars } = require('../middleware/validation');

const AddNewUser = async (req, res, next) => {

  try {
    const { name, email, password, pushToken } = req.query;

    if (!exists(email)) throw new Error('No email provided')
    if (!exists(password)) throw new Error('No password provided')
    if (password.length < 6) throw new Error('Password must be at least 6 characters')
    if (!exists(name)) throw new Error('No name provided')
    if (name.length < 4) throw new Error('Name must be at least 4 characters')
    if (name.length > 20) throw new Error('Name must be max 20 characters')

    ValidateChars(email);
    ValidateChars(password);
    ValidateChars(name);

    await dbFunctions.CreateUser(name, email, password, pushToken);

    next();

  }
  catch (error) {

    res.status(400).send({ ok: false, message: error.message });

  }

}
const GetUserInfo = async (req, res, next) => {

  try {
    const user = await dbFunctions.GetLoggedUserInfo(req.userId);
    res.json({
      id: user.id,
      name: user.name,
      room_keys: user.room_keys,
      email: user.email,
      premium: user.premium
    });
  }
  catch (error) {
    res.status(400).send('Unable to get user. ' + error.message);
  }

}
const GetUserStats = async (req, res, next) => {

  try {

    const { userId } = req.query;
    if (!userId) throw new Error('no user id provided in query. Cannot return stats');
    const stats = await dbData.PlayerStats(userId);

    res.status(200).send({
      ok: true,
      message: 'successfully retrieved user stats',
      data: stats
    })

  }
  catch (error) {

    res.status(400).send({
      ok: false,
      message: 'Could not retrieve stats: ' + error.message,
    })

  }

}

userRouter.get('/', isAuth, GetUserInfo);
userRouter.get('/stats', GetUserStats);
userRouter.post('/create', AddNewUser, Login);
userRouter.post('/login', Login);

module.exports = userRouter;

//HELPERS
const exists = text => {
  return !(!text || text == null || text == 'null' || text == 'undefined' || text == '');
}