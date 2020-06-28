const { ApolloServer } = require('apollo-server');
const typeDefs = require('./db/schema');
const resolvers = require('./db/resolvers');
const conectarDB = require('./config/db');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '.env' });

// Conect Data Base
conectarDB();
process.on('exit', function () {
  console.log('aqui pasa algo?')
})

// Server 
const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({req}) => {    
    // the authorization token should arrive to start the session
    const token = req.headers['authorization'] || 'No Token Default';
    if (token !== 'No token' && token !== 'No Token Default') {
      try {
        const user = jwt.verify(token.replace('Bearer ', ''), process.env.SECRET);
        return { user }
      } catch (err) {
        console.log("There was a error : ", err);
      }
    }
  }
});

// Run Server
server.listen({ port: process.env.PORT || 4000 }).then( ({url}) => {
  console.log(`Server running in URL ${url}`);  
})
