const express = require('express');
const userRouter = express.Router();
const dbFunctions = require('../database/dbFunctions');
const {isAuth, Login} = require('../middleware/authentication');

const AddNewUser = async (req, res, next) => {

  try {

    const name = req.query.name;
    const email = req.query.email;
    const password = req.query.password;

    if (!name) throw new Error('No name provided')
    if (name.length < 4) throw new Error('Name must be at least 4 characters')
    if (name.length > 20) throw new Error('Name must be max 20 characters')
    if (!email) throw new Error('No email provided')
    if (!password) throw new Error('No password provided')

    await dbFunctions.CreateUser(name, email, password);

    res.status(201).send('User created successfully!');

  }
  catch (error) {

    res.status(400).send('Cant create user: ' + error.message);

  }

}

const GetUserInfo = async (req, res, next) => {

  try {
    res.json({
      id: req.user.id,
      name: req.user.name,
      room_keys: req.user.room_keys,
      email: req.user.email
    });
  }
  catch (error) {
    res.status(400).send('Unable to get user. ' + error.message);
  }

}

userRouter.get('/', isAuth, GetUserInfo);
userRouter.post('/create', AddNewUser);
userRouter.post('/login', Login);

module.exports = userRouter;
