const express = require('express');
const app = express();
const PORT = process.env.PORT || 5000;

const roomRouter = require('./routers/roomRouter');
const userRouter = require('./routers/userRouter');
const scenarioRouter = require('./routers/scenarioRouter');

app.use('/room', roomRouter);
app.use('/user', userRouter);
app.use('/scenario', scenarioRouter);

app.get('/', (req, res) => {
  res.send(`<h1>App is running :)</h1>`);
})

app.listen(PORT, () => {
  console.log(`App is running on ${PORT}`)
}) 