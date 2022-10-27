const express = require('express');
const roomRouter = express.Router();
const db = require('./dbConnect.js')

roomRouter.get('/', async (req, res, next) => {

  // const query = await pool.query('SELECT * FROM rooms');
  // res.json(query.rows)

  res.send('here are all the rooms :)');
});

module.exports = roomRouter;

// //CREATE A ROOM
// app.post('/rooms', async (req, res) => {
//   pool.query(
//     'INSERT INTO rooms (title, description, creator_id) VALUES ($1, $2, $3) RETURNING *',
//     [req.query.name, req.query.description, req.query.creatorId],
//     (error, results) => {
//       if (error) {
//         throw error
//       }
//       res.status(201).send({
//         message: 'Successfully added a room to the db!',
//         person: results.rows[0]
//       });
//     }
//   )
// });