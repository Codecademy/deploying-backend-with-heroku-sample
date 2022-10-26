const express = require('express'); // import express module (simplifies routing/requests, among other things)
const app = express(); // create an instance of the express module (app is the conventional variable name used)
const fetch = require('node-fetch'); // import node-fetch (enables the fetch API to be used server-side)
const PORT = process.env.PORT || 5000; // use either the host env var port (PORT) provided by Heroku or the local port (5000) on your machine

//these seem to fuck up things for heroku
const bodyParser = require('body-parser');
const Pool = require('pg').Pool

//HEROKU DB CONNECTION
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

app.get('/', (req, res) => { // send a get request to root directory ('/' is this file (app.js))
  res.send(`<h1>App is running :)</h1>`);
})

app.get('/ping', (req, res) => {
  res.send('hello from heroku!');
})

app.get('/initialize', async (req, res) => {
  const query = await pool.query(
    `
    CREATE TABLE "users" (
      "id" SERIAL PRIMARY KEY,
      "name" varchar(20) UNIQUE NOT NULL,
      "premium" boolean DEFAULT false,
      "room_keys" int DEFAULT 0
    );
    
    ALTER TABLE users
    ADD CHECK (LENGTH(name) >= 4);
    
    ALTER TABLE users
    ADD CHECK (room_keys >= 0);
    
    CREATE TABLE "rooms" (
      "id" SERIAL PRIMARY KEY,
      "title" varchar(30) UNIQUE NOT NULL,
      "description" varchar(300) NOT NULL,
      "creator_id" int NOT NULL,
      "next_player_id" int,
      "turn_end" timestamp,
      "full" boolean DEFAULT false,
      "finished" boolean DEFAULT false
    );
    
    ALTER TABLE rooms
    ADD CHECK (LENGTH(title) >= 3);
    
    ALTER TABLE rooms
    ADD CHECK (LENGTH(description) >= 3);
    
    CREATE TABLE "scenarios" (
      "id" SERIAL PRIMARY KEY,
      "number" int NOT NULL,
      "text" varchar NOT NULL,
      "creator_id" int NOT NULL,
      "room_id" int NOT NULL
    );
    
    ALTER TABLE scenarios
    ADD CHECK (number >= 0);
    
    ALTER TABLE scenarios
    ADD CHECK (LENGTH(text) >= 3);
    
    CREATE TABLE "rooms_users" (
      "id" SERIAL PRIMARY KEY,
      "room_id" int NOT NULL,
      "user_id" int NOT NULL,
      "active" boolean NOT NULL DEFAULT true,
      "queue_number" int NOT NULL
    );
    
    ALTER TABLE rooms_users
    ADD CHECK (queue_number >= 0);
    
    ALTER TABLE "rooms" ADD FOREIGN KEY ("creator_id") REFERENCES "users" ("id");
    ALTER TABLE "rooms" ADD FOREIGN KEY ("next_player_id") REFERENCES "users" ("id");
    ALTER TABLE "scenarios" ADD FOREIGN KEY ("creator_id") REFERENCES "users" ("id");
    ALTER TABLE "scenarios" ADD FOREIGN KEY ("room_id") REFERENCES "rooms" ("id");
    ALTER TABLE "rooms_users" ADD FOREIGN KEY ("room_id") REFERENCES "rooms" ("id");
    ALTER TABLE "rooms_users" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");
    `
  );

  res.send(query);
});

app.get('/users', async (req, res) => {
  const query = await pool.query('SELECT * FROM users');
  res.json(query.rows);
});

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

app.listen(PORT, () => { // start server and listen on specified port
  console.log(`App is running on ${PORT}`) // confirm server is running and log port to the console
}) 