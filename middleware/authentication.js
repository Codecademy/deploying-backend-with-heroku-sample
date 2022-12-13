const jwt = require('jsonwebtoken');
const dbFunctions = require('../database/dbFunctions');
const { ValidateChars } = require('./validation');

const isAuth = async (req, res, next) => {

  const authToken = req.headers['authorization'];

  if (typeof authToken == 'undefined' || !authToken) {
    res.status(403).send('no authorization header provided');
    return;
  }

  jwt.verify(authToken, process.env.JWT_SECRET, (err, data) => {
    if (err) {
      res.status(403).send('invalid auth token');
    }
    else {
      req.userId = data.id;
      console.log('attaching user id: ', req.userId);
      next();
    }
  })

}

const Login = async (req, res, next) => {
  try {

    const email = req.query.email;
    const password = req.query.password;

    if (!email) throw new Error('no email provided');
    if (!password) throw new Error('no password provided');
    ValidateChars(email);
    ValidateChars(password);

    const user = await dbFunctions.Login(email, password);

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(201).send({ message: 'logged in as ' + user.name, token: token });

  } catch (error) {

    res.status(400).send('Cant login: ' + error.message);

  }
}

module.exports = { isAuth, Login };