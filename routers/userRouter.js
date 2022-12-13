const express = require('express');
const userRouter = express.Router();
const dbFunctions = require('../database/dbFunctions');
const { isAuth, Login } = require('../middleware/authentication');
const { ValidateChars } = require('../middleware/validation');
// const { makeid } = require('../helpers/generateString');

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
// const RequestPasswordReset = async (req, res, next) => {

//   try {
//     const { email } = req.query;
//     if (!exists(email)) throw new Error('No email provided');
    
//     //kolla att användare med email finns
//     const userExists = await dbFunctions.EmailExists(email);
//     if (!userExists) throw new Error('No user with that email registered');

//     //generera en kod
//     const resetCode = makeid(8);

//     //++ spara koden i backend, tillsammans med en timeout stamp
//     dbFunctions.AddPasswordResetCode(resetCode, email);

//     //++ skicka koden i ett email
//       //detta kräver ju uppenbarligen lite mer arbete. Du måste sätta dig in i hur du kan skicka email online
//       //kanske ska man köra på en service såsom mailersend

//     //skicka ett "ok" status
//     res.status(200).send({ ok: true, message: 'email with reset code sent' });
//   }
//   catch (error) {

//     res.status(400).send({ ok: false, message: error.message });

//   }

// }

userRouter.get('/', isAuth, GetUserInfo);
userRouter.post('/create', AddNewUser, Login);
userRouter.post('/login', Login);
// userRouter.post('/requestPasswordReset', RequestPasswordReset);

module.exports = userRouter;

//HELPERS
const exists = text => {
  return !(!text || text == null || text == 'null' || text == 'undefined' || text == '');
}