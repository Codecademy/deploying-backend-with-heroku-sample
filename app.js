//import libs
const express = require('express');
const app = express();
const PORT = process.env.PORT || 5000;
require('dotenv').config()

//logging middleware
const morgan = require('morgan');
app.use(morgan('tiny'));

//error handling for dev environment
if (process.env.NODE_ENV === 'development'){
  const errorhandler = require('errorhandler');
  app.use(errorhandler());
}

//import routers
const roomRouter = require('./routers/roomRouter');
const userRouter = require('./routers/userRouter');
const scenarioRouter = require('./routers/scenarioRouter');

//mount routers
app.use('/room', roomRouter);
app.use('/user', userRouter);
app.use('/scenario', scenarioRouter);

//test rout
app.get('/', (req, res) => {
  res.send(`<h1>App is running :)</h1>`);
})

//start server
app.listen(PORT, () => {
  console.log(`App is running on ${PORT}`)
}) 