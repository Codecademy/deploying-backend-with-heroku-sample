//import libs
const express = require('express');
const app = express();
const PORT = process.env.PORT || 5000;
require('dotenv').config()

//test pushing
// const {GetPushToken} = require('./database/dbFunctions');
// const {SendTurnNotification} = require('./notifications/notifications');
// const TestPush = async () => {
//   const pushToken = await GetPushToken(13);
//   SendTurnNotification(pushToken, 52, 'Lambda 5');
// }
// TestPush();


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
app.get('/', async (req, res) => {
  res.send(`unwritten server is running on ${PORT} :)`);
})

//start server
app.listen(PORT, () => {
  console.log(`App is running on ${PORT}`)
}) 