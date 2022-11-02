const express = require('express');
const userRouter = express.Router();
const db = require('./dbConnect.js')
const user = require('../fakeData/testUser'); //remove in live v.

const AddNewUser = async (req, res, next) => {

  try {

    if (!req.query.name) throw new Error('No name provided')
    if (req.query.name.length < 4) throw new Error('Name must be at least 4 characters')
    if (req.query.name.length > 20) throw new Error('Name must be max 20 characters')

    await db.query('INSERT INTO users (name) VALUES ($1) RETURNING *', [req.query.name]);

    res.status(201).send('User created successfully!');

  }
  catch (error) {

    res.status(400).send('Cant create user: ' + error.message);

  }

}

const GetUserData = async (req, res, next) => {

  try {

    const query = await db.query('SELECT * FROM users WHERE id=' + user.id); //change to logged user when session is implemented

    if (!query.rows) throw new Error('Query returned nothing');
    if (query.rowCount < 1) throw new Error('Found no user with that id');
    if (query.rows.length > 2) throw new Error('Query returned multiple users');
    
    res.json(query.rows[0]);
    
  }
  catch (error) {
    res.status(400).send('Unable to get user. ' + error.message);
  }
  
}

userRouter.get('/', GetUserData);
userRouter.post('/', AddNewUser);

module.exports = userRouter;

