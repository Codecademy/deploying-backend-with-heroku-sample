var Zabo = require('zabo-sdk-js')

abo.init({
  clientId: 'obvI09LujjmnRcAzZAm8ykS3nycZlPhhYy8tg1uftUXLQgtvlPNpEoWLEuNYDBru',
  env: 'sandbox'
}).then(zabo => {
  // `zabo` is ready to be used 
})

// Here we add a listener to the first button in our html file
document.querySelector('button').addEventListener('click', () => {
  // We call the .connect() window when it is clicked, and provide a callback to `onConnection`
  zabo.connect().onConnection((account) => {
    console.log(account)
  }).onError(error => {
    console.error('account connection error:', error)
  })
})
