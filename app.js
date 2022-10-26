const express = require('express');
const app = express();
const fetch = require('node-fetch');
const PORT = process.env.PORT || 5000;
const bodyParser = require('body-parser');
const Pool = require('pg').Pool

//HEROKU DB CONNECTION
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

//TEST CONNECTION
app.get('/', (req, res) => {
  res.send(`<h1>App is running :)</h1>`);
})

//GET ALL USERS
app.get('/users', async (req, res) => {
  const query = await pool.query('SELECT * FROM users');
  res.json(query.rows);
});

//GET ALL ROOMS
app.get('/rooms', async (req, res) => {
  const query = await pool.query('SELECT * FROM rooms');
});

//CREATE A ROOM
app.post('/rooms', async (req, res) => {
  pool.query(
    'INSERT INTO rooms (title, description, creator_id) VALUES ($1, $2, $3) RETURNING *',
    [req.query.name, req.query.description, req.query.creatorId],
    (error, results) => {
      if (error) {
        throw error
      }
      res.status(201).send({
        message: 'Successfully added a room to the db!',
        person: results.rows[0]
      });
    }
  )
});

//CREATE A NEW USER
app.post('/users', async (req, res) => {
  pool.query('INSERT INTO users (name) VALUES ($1) RETURNING *', [req.query.name], (error, results) => {
    if (error) {
      throw error
    }
    res.status(201).send({
      message: 'Successfully added a person to the db!',
      person: results.rows[0]
    });
  })
});

//START SERVER
app.listen(PORT, () => {
  console.log(`App is running on ${PORT}`)
}) 