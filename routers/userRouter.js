const express = require('express');
const userRouter = express.Router();
const db = require('./dbConnect.js')
const user = require('../fakeData/testUser'); //remove in live v.

userRouter.get('/', async (req, res) => {

  const query = await db.query('SELECT * FROM users WHERE id=' + user.id); //change to logged user when session is implemented
  
  if(!query.rows){
    res.status(400).send('Unable to get users. Query returned nothing');
  }
  else if(query.rows.length < 1){
    res.status(400).send('Couldnt not find any user with that id');
  }
  else if(query.rows.length > 2){
    res.status(400).send('Query returned multiple users');
  }
  else{
    res.json(query.rows[0]);
  }
});

userRouter.post('/', async (req, res) => {

  if(!req.query.name){
    res.status(400).send('cant create user. No name was provided');
    return;
  }

  if(req.query.name.length < 4){
    res.status(400).send('cant create user. name must be at least 4 characters long');
    return;
  }

  if(req.query.name.length > 20){
    res.status(400).send('cant create user. name must be maximum 20 characters long');
    return
  }

  db.query('INSERT INTO users (name) VALUES ($1) RETURNING *', [req.query.name], (error, results) => {
    if (error) {
      res.status(400).send(error.detail);
      return;
    }
    res.status(201).send('User created successfully!');
  })

});

module.exports = userRouter;

