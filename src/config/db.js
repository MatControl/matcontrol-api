import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri || !uri.trim()) {
      console.warn('⚠️ MONGO_URI não definido. Iniciando sem conexão com banco.');
      return;
    }
    const conn = await mongoose.connect(uri);
    console.log(`✅ MongoDB conectado: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Erro na conexão com o MongoDB: ${error.message}`);
    console.warn('Prosseguindo sem DB para permitir pré-visualização de páginas estáticas.');
  }
};

export default connectDB;
