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

app.listen(PORT, () => { // start server and listen on specified port
  console.log(`App is running on ${PORT}`) // confirm server is running and log port to the console
}) 