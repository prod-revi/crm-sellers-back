const User = require('../models/User');
const Product = require('../models/Product');
const Client = require('../models/Client');
const Order = require('../models/Order');

const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '.env' });

const crearToken = (user, secret, expiresIn) => {
  const { id, email, name, lastname } = user;
  return jwt.sign( { id, email, name, lastname }, secret, { expiresIn } )
}

// Resolvers
const resolvers = {
  Query: {
    getUser: async (_, {}, ctx) => {
      return ctx.user
    },
    getProducts: async () => {
      try {
        const product = await Product.find({});
        return product;
      } catch (err) {
        console.log(err)
      }
    },
    getProduct : async (_, {id}) => {
      const product = await Product.findById(id);
      if (!product) {
        throw new Error('Product not found');
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
    getClientsSeller: async (_, {}, ctx ) => {
      try {
          const clientes = await Client.find({ seller: ctx.user.id.toString() });
          return clientes;
      } catch (error) {
          console.log(error);
      }
  }, 
    getClient: async (_, {id}, ctx) => {
      // Check if Client exist 
      const client = await Client.findById(id);
      if (!client) { throw new Error('Client not found'); }
      // Only whoever created the order can see it
      if ( client.seller.toString() !== ctx.user.id ) {
        throw new Error("You don't have the credentials");
      }
      return client;
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
      if (!ctx.user) {
        console.log('user not exist, look ctx : ', ctx)
        throw new Error('not exist user in context.', )
      }
      try {
        const orders = await Order.find({ seller: ctx.user.id }).populate('client');
        return orders;
      } catch (err) {
        console.log(err);
      }
    },
    getOrder: async (_, {id}, ctx) => {
      // Check if order exist
      const order = await Order.findById(id);
      if (!order) {
        throw new Error('Order not found');
      }
      // Only whoever created the order can see it
      if (order.seller.toString() !== ctx.user.id) {
        throw new Error("You don't have the credentials");
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
    createUser: async(_, { input } ) => {
      const { email, password } = input;
      // Check if user exist
      const user = await User.findOne({email});
      if (user) { throw new Error('user is registered'); }
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
      const user = await User.findOne({email});
      if (!user) { throw new Error('User is not registered'); }
      // Check if password is correct
      const checkPassword = await bcryptjs.compare(password, user.password);
      if (!checkPassword) { throw new Error('El password no es correcto'); }
      // Create Token
      return {
        token: crearToken(user, process.env.SECRET, '24h')
      }
    },
    createProduct: async (_, {input}) => {
      try {
        const product = new Product(input);
        // write in db
        const result = await product.save();
        return result;
      } catch (err) {
        console.log(err);
      }
    },
    updateProduct: async (_, {id, input}) => {
      // Revisar si el product existe
      let product = await Product.findById(id);

      if (!product) {
        throw new Error('Product not found');
      }

      // guardarlo en la base de datos
      product = await Product.findOneAndUpdate({_id : id}, input, { new : true });

      return product;
    },
    deleteProduct: async (_, {id}) => {
      // Check if product exist
      let product = await Product.findById(id);
      if (!product) { throw new Error('Product not found'); }
      // delete
      await Product.findOneAndDelete({_id: id});
      return "Product Deleted";
    },
    createClient: async (_, {input}, ctx) => {
      const {email} = input;
      const client = await Client.findOne({ email });
      if (client) { throw new Error('That Client is already registered'); }
      const createClient = new Client(input);
      // Assign Seller
      createClient.seller = ctx.user.id;
      // write data base
      try {
        const result = await createClient.save();
        return result;
      } catch (err) {
        console.log(err);
      }
    },
    updateClient: async (_, {id, input}, ctx) => {
      // Check if client exist
      let client = await Client.findById(id);
      if (!client) { throw new Error('Client not found'); }
      // Check if Seller can edit 
      if ( client.seller.toString() !== ctx.user.id ) {
        throw new Error("You don't have the credentials");
      }
      // Save Client 
      client = await Client.findOneAndUpdate({_id: id}, input, {new: true})
      return client;
    },
    deleteClient: async (_, {id}, ctx) => {
      let client = await Client.findById(id);
      if (!client) { throw new Error('Client not found');
      }
      // Check if seller can edit
      if ( client.seller.toString() !== ctx.user.id ) {
        throw new Error("You don't have the credentials");
      }
      // Delete Client
      await Client.findOneAndDelete({_id: id});
      return "Client Deleted";
    },
    createOrder: async (_, {input}, ctx) => {
      const { client } = input
      console.log(input)
      // Check Client
      let clientData = await Client.findById(client);
      if (!clientData) { throw new Error('Client not found'); }
      // Check if Client is registered by Seller Verificar si el Client es seller
      if ( clientData.seller.toString() !== ctx.user.id ) {
        throw new Error("You don't have the credentials");
      }
      // Check available stock
      for await ( const productOrder of input.order ) {
        const { id } = productOrder;

        const product = await Product.findById(id);
        console.log('product : ', product)
        if (productOrder.quantity > product.quantity) {
          throw new Error(`El product ${productOrder.name} excede la quantity disponible`);
        } else {
          // Subtract quantity to available
          productOrder.quantity = product.quantity - productOrder.quantity;
          await product.save();
        }
      }
      // Create new Order
      const order = new Order(input);
      // Assig Seller
      order.seller = ctx.user.id;
      // Write db
      const res = await order.save()
      return res;
    },
    updateOrder: async (_, {id, input}, ctx) => {
      const { client } = input
      // Check order
      const order = await Order.findById(id);
      if (!order) { throw new Error('order not found'); }
      // Check Client
      const clientDB = await Client.findById(client);
      if (!clientDB) { throw new Error('Client not found'); }
      // Check if Client and order belong to Seller
      if ( clientDB.seller.toString() !== ctx.user.id ) {
        throw new Error("You don't have the credentials");
      }
      // Check stock
      if (input.order) {
        for await ( const product of input.order ) {
          const { id: idProduct } = product;
          const order = await Order.findById(id);
          // Check available stock
          for await ( const existente of order.order ) {
            const { id: idProOrder } = existente;
            if (idProduct === idProOrder ) {
              order.existence = order.existence + existente.quantity;
            } else {
              console.log('no coincidence');
            }
          }
  
          if (product.quantity > order.existence) {
            throw new Error(`Product ${order.name} exceeds the available`);
          } else {
            // Substrace quantity to available
            order.existence = order.existence - product.quantity;
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
      if (!Order) { throw new Error('Order not found'); }
      // Check if Seller can delete
      if ( Order.seller.toString() !== ctx.user.id ) {
        throw new Error("You don't have the credentials");
      }
      // Delete Client
      await Order.findOneAndDelete({_id: id});
      return "Order Deleted";
    }
  }
}

module.exports = resolvers;