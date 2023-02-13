//import libs
const express = require('express');
const app = express();
const PORT = process.env.PORT || 5000;
require('dotenv').config()

//logging middleware
const morgan = require('morgan');
app.use(morgan('tiny'));

//error handling for dev environment
if (process.env.NODE_ENV === 'development') {
  const errorhandler = require('errorhandler');
  app.use(errorhandler());
}

//import routers
const roomRouter = require('./routers/roomRouter'); //legacy
const scenarioRouter = require('./routers/scenarioRouter'); //legacy

const userRouter = require('./routers/userRouter');
const nodeRouter = require('./routers/nodeRouter');
const campRouter = require('./routers/campRouter');
const infoRouter = require('./routers/infoRouter');

//mount routers
app.use('/room', roomRouter); //legacy
app.use('/scenario', scenarioRouter); //legacy
app.use('/user', userRouter);
app.use('/node', nodeRouter);
app.use('/camp', campRouter);
app.use('/info', infoRouter);

//start server
app.listen(PORT, () => {
  console.log(`App is running on ${PORT}`)
})

//test
