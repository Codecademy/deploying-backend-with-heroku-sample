const Pool = require('pg').Pool

const pool = (

  process.env.DATABASE_URL ?

    //heroku
    new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    })

    :
    
    //local
    new Pool({
      user: 'postgres',
      host: 'localhost',
      database: 'unwritten',
      password: 'postgres',
      port: 5432,
    })

)


module.exports = pool;