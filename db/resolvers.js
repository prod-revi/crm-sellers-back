const User = require('../models/User');
const Product = require('../models/Product');
const Client = require('../models/Client');
const Order = require('../models/Order');

const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '.env' });

const crearToken = (user, secret, expiresIn) => {
  // console.log(user);
  const { id, email, name, lastname } = user;

  return jwt.sign( { id, email, name, lastname }, secret, { expiresIn } )
}

// Resolvers
const resolvers = {
  Query: {
    getUser: async (_, {}, ctx) => ctx.user,
    getProduct: async () => {
      try {
        const orders = await Order.find({});
        return orders;
      } catch (err) {
        console.log(err)
      }
    },
    getProduct : async (_, {id}) => {
      const product = await Product.findById(id);
      if (!product) {
        throw new error('Product not found');
      }
      return product;
    },
    getClients: async () => {
      try {
        const clients = await Client.find({});
        return clients;
      } catch (err) {
        console.log(err);
      }
    },
    getClientsSeller: async (_, {}, ctx) => {
      try {
        const Clients = await Client.find({ seller: ctx.user.id.toString() });
        return Clients;
      } catch (err) {
        console.log(err);
      }
    },
    getClient: async (_, {id}, ctx) => {
      // Check if Client exist 
      const Client = await Client.findById(id);
      if (!Client) { throw new error('Client not found'); }
      // Only whoever created the order can see it
      if ( Client.seller.toString() !== ctx.user.id ) {
        throw new error("You don't have the credentials");
      }
      return Client;
    },
    getOrders: async () => {
      try {
        const orders = await Order.find({});
        return orders;
      } catch (err) {
        console.log(err);
      }
    },
    getOrdersSeller: async (_, {}, ctx) => {
      try {
        const orders = await Order.find({ seller: ctx.user.id }).populate('Client');
        return orders;
      } catch (err) {
        console.log(err);
      }
    },
    getOrder: async (_, {id}, ctx) => {
      // Check if order exist
      const order = await Order.findById(id);
      if (!order) {
        throw new error('Order not found');
      }
      // Only whoever created the order can see it
      if (order.seller.toString() !== ctx.user.id) {
        throw new error("You don't have the credentials");
      }
      return order;
    },
    getOrdersState: async (_, {state}, ctx) => {
      const orders = await Order.find({ seller: ctx.user.id, state })

      return orders;
    },
    bestClients: async () => {
      const Clients = await Order.aggregate([
        { $match : { state : "COMPLETED" } },
        { $group : {
          _id : "$Client",
          total: { $sum: '$total' }
        }},
        {
          $lookup: {
            from: 'Clients',
            localField: '_id',
            foreignField: "_id",
            as: "Client"
          }
        },
        {
          $limit: 10
        },
        {
          $sort : { total : -1 }
        }
      ]);
      return Clients;
    },
    bestSellers: async () => {
      const sellers = await Order.aggregate([
        { $match: { state: "COMPLETED" } },
        {
          $group: {
            _id: "$seller",
            total: { $sum : "$total"}
          }
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "seller"
          }
        },
        {
          $limit: 3
        },
        {
          $sort: { total: -1 }
        }
      ]);

      return sellers;
    },
    searchProducts: async (_, {text}) => {
      produts = await Order.find({ $text: { $search: text } }).limit(10);
      return produts
    }
  },
  Mutation: {
    newUser: async(_, { input } ) => {
      const { email, password } = input;
      // Check if user exist
      const User = await User.findOne({email});
      if (!User) { throw new error('user is not registered'); }
      // hash password
      const salt = await bcryptjs.genSalt(10);
      input.password = await bcryptjs.hash(password, salt);
      // write data base
      try {
        const user = new User(input);
        user.save();
        return user;
      } catch (err) {
        console.log(err)
      }
    },
    authenticateUser: async(_, {input} ) => {
      const { email, password } = input;
      // Check if user exist
      const User = await User.findOne({email});
      if (!User) { throw new error('User is not registered'); }
      // Check if password is correct
      const checkPassword = await bcryptjs.compare(password, User.password);
      if (!checkPassword) { throw new error('El password no es correcto'); }
      // Create Token
      return {
        token: crearToken(checkPassword, process.env.SECRET, '24h')
      }
    },
    newProduct: async (_, {input}) => {
      try {
        const order = new Order(input);
        // write in db
        const result = await order.save();
        return result;
      } catch (err) {
        console.log(err);
      }
    },
    updateProduct: async (_, {id, input}) => {
      // Revisar si el order existe
      let order = await Order.findById(id);

      if (!order) {
        throw new error('Order not found');
      }

      // guardarlo en la base de datos
      order = await Order.findOneAndUpdate({_id : id}, input, { new : true });

      return order;
    },
    deleteProduct: async (_, {id}) => {
      // Check if order exist
      let order = await Order.findById(id);
      if (!order) { throw new error('Order not found'); }
      // delete
      await Order.findOneAndDelete({_id: id});
      return "Order Deleted";
    },
    newClient: async (_, {input}, ctx) => {
      const {email} = input;
      // check if Client exist
      const Client = Client.findOne({ email });
      if (Client) { throw new error('That Client is already registered'); }
      const newClient = new Client(input);
      // Assign Seller
      newClient.seller = ctx.user.id;
      // write data base
      try {
        const result = await newClient.save();
        return result;
      } catch (err) {
        console.log(err);
      }
    },
    updateClient: async (_, {id, input}, ctx) => {
      // Check if client exist
      let Client = await Client.findById(id);
      if (!Client) { throw new error('Client not found'); }
      // Check if Seller can edit 
      if ( Client.seller.toString() !== ctx.user.id ) {
        throw new error("You don't have the credentials");
      }
      // Save Client 
      Client = await Client.findOneAndUpdate({_id: id}, input, {new: true})
      return Client;
    },
    deleteClient: async (_, {id}, ctx) => {
      let Client = await Client.findById(id);
      if (!Client) { throw new error('Client not found');
      }
      // Check if seller can edit
      if ( Client.seller.toString() !== ctx.user.id ) {
        throw new error("You don't have the credentials");
      }
      // Delete Client
      await Client.findOneAndDelete({_id: id});
      return "Client Deleted";
    },
    newOrder: async (_, {input}, ctx) => {
      const { ClientInput } = input
      // Check Client
      let Client = await ClientInput.findById(Client);
      if (!Client) { throw new error('Client not found'); }
      // Check if Client is registered by Seller Verificar si el Client es seller
      if ( Client.seller.toString() !== ctx.user.id ) {
        throw new error("You don't have the credentials");
      }
      // Check available stock
      for await ( const product of input.order ) {
        const { id } = product;
        const order = await Order.findById(id);
        if (product.cantidad > order.existence) {
          throw new error(`El product ${order.name} excede la cantidad disponible`);
        } else {
          // Subtract quantity to available
          order.existence = order.existence - product.cantidad;
          await order.save();
        }
      }
      // Create new Order
      const nuevoOrder = new Order(input);
      // Assig Seller
      nuevoOrder.seller = ctx.user.id;
      // Write db
      const result = await nuevoOrder.save()
      return result;
    },
    updateOrder: async (_, {id, input}, ctx) => {
      const { ClientInput } = input
      // Check order
      const Order = await Order.findById(id);
      if (!Order) { throw new error('Order not found'); }
      // Check Client
      const Client = await ClientInput.findById(Client);
      if (!Client) { throw new error('Client not found'); }
      // Check if Client and Order belong to Seller
      if ( Client.seller.toString() !== ctx.user.id ) {
        throw new error("You don't have the credentials");
      }
      // Check stock
      if (input.order) {
        for await ( const product of input.order ) {
          const { id } = product;
          const Order = await Order.findById(id);
          // Check available stock
          for await ( const existente of Order.order ) {
            const { id: idExistente} = existente;
            if (id === idExistente) {
              order.existence = order.existence + existente.cantidad;
            } else {
              console.log('no coincidence');
            }
          }
  
          if (product.cantidad > order.existence) {
            throw new error(`Product ${order.name} exceeds the available`);
          } else {
            // Substrace quantity to available
            order.existence = order.existence - product.cantidad;
            await order.save();
          }
        }
      }
      // Guardar el order
      const result = await Order.findOneAndUpdate({_id: id}, input, {new: true});
      return result;
    },
    deleteOrder: async (_, {id}, ctx) => {
      let Order = await Order.findById(id);
      if (!Order) { throw new error('Order not found'); }
      // Check if Seller can delete
      if ( Order.seller.toString() !== ctx.user.id ) {
        throw new error("You don't have the credentials");
      }
      // Delete Client
      await Order.findOneAndDelete({_id: id});
      return "Order Deleted";
    }
  }
}

module.exports = resolvers;