const express = require('express');
const userRouter = express.Router();
const db = require('./dbConnect.js')

userRouter.get('/', async (req, res) => { 
  // const query = await db.query('SELECT * FROM users');
  // res.json(query.rows);
  res.send('getting all the users!')
});

module.exports = userRouter;

// //CREATE A NEW USER
// app.post('/users', async (req, res) => {
//   pool.query('INSERT INTO users (name) VALUES ($1) RETURNING *', [req.query.name], (error, results) => {
//     if (error) {
//       throw error
//     }
//     res.status(201).send({
//       message: 'Successfully added a person to the db!',
//       person: results.rows[0]
//     });
//   })
// });