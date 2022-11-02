const express = require('express');
const userRouter = express.Router();
const dbFunctions = require('./dbFunctions');

const AddNewUser = async (req, res, next) => {

  try {

    const name = req.query.name;

    if (!name) throw new Error('No name provided')
    if (name.length < 4) throw new Error('Name must be at least 4 characters')
    if (name.length > 20) throw new Error('Name must be max 20 characters')
    await dbFunctions.CreateUser(name);

    res.status(201).send('User created successfully!');

  }
  catch (error) {

    res.status(400).send('Cant create user: ' + error.message);

  }

}

const GetUserInfo = async (req, res, next) => {

  try {
    const userInfo = await dbFunctions.GetLoggedUserInfo();
    res.json(userInfo);
  }
  catch (error) {
    res.status(400).send('Unable to get user. ' + error.message);
  }
  
}

userRouter.get('/', GetUserInfo);
userRouter.post('/', AddNewUser);

module.exports = userRouter;
