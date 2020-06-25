const { ApolloServer } = require('apollo-server');
const typeDefs = require('./db/schema');
const resolvers = require('./db/resolvers');
const conectarDB = require('./config/db');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '.env' });

// Conect Data Base
conectarDB();

// Server 
const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({req}) => {
    // the authorization token should arrive to start the session
    // console.log(req.headers['authorization'])
    // console.log(req.headers)

    const token = req.headers['authorization'] || '';
    if (token) {
      // let's test --- User Bearer has a secret key
      try {
        const user = jwt.verify(token.replace('Bearer ', ''), process.env.SECRET, 
          function(err, decoded) {
            if (err) { 
              console.log('Token is not valid')
              return undefined
            } else { next() }
          }
        );
        return { user }
      } catch (err) {
        console.log("There was a bug : ");
        console.log(err);
      }
    }
  }
});

// Run Server
server.listen({ port: process.env.PORT || 4000 }).then( ({url}) => {
  console.log(`Server running in URL ${url}`);  
})
