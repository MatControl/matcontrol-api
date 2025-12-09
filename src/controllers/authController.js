import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Academia from '../models/Academia.js';
import Profile from '../models/Profile.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { gerarCodigo } from '../utils/gerarCodigo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../public');
const profilePhotosDir = path.join(publicDir, 'profile-photos');



// REGISTRAR GESTOR 
export const registrarGestor = async (req, res) => {
  try {
    const { nome, email, senha, fotoUrl, fotoBase64, ref } = req.body;

    // Verifica se já existe
    const usuarioExistente = await User.findOne({ email });
    if (usuarioExistente) {
      return res.status(400).json({ mensagem: 'E-mail já cadastrado.' });
    }

    // Criptografa a senha
    const senhaCriptografada = await bcrypt.hash(senha, 10);

    // Cria o usuário gestor
    const novoUsuario = await User.create({
      nome,
      email,
      senha: senhaCriptografada,
      tipo: 'gestor'
    });

    try {
      const code = gerarCodigo(8);
      novoUsuario.referralCode = code;
      if (ref) {
        const referrer = await User.findOne({ referralCode: String(ref).trim() }).select('_id');
        if (referrer) novoUsuario.referredBy = referrer._id;
      }
      await novoUsuario.save();
    } catch (e) { void e; }

    // Cria automaticamente o perfil de gestor vinculado
    let fotoPerfilUrl = fotoUrl || null;
    if (fotoBase64) {
      try {
        const base = String(fotoBase64);
        const payload = base.includes(',') ? base.split(',').pop() : base;
        const buf = globalThis.Buffer.from(payload, 'base64');
        fs.mkdirSync(profilePhotosDir, { recursive: true });
        const name = `pf_${novoUsuario._id}_${Date.now()}.jpg`;
        fs.writeFileSync(path.join(profilePhotosDir, name), buf);
        fotoPerfilUrl = `/profile-photos/${name}`;
      } catch (e) {
        console.warn('Falha ao salvar foto do perfil', e?.message);
      }
    }

    const perfilGestor = new Profile({
      userId: novoUsuario._id,
      nome: novoUsuario.nome,
      tipo: "gestor",
      academiaId: novoUsuario.academiaId,
      fotoUrl: fotoPerfilUrl,
      cargoGestor: "Administrador", // opcional, se quiser
    });

    // Salva o perfil
    await perfilGestor.save();
    
    // Vincula o perfil ao usuário
    novoUsuario.perfis.push(perfilGestor._id);
    await novoUsuario.save();

    res.status(201).json({
      mensagem: 'Gestor registrado com sucesso.',
      usuario: novoUsuario,
      perfil: perfilGestor,
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({
      mensagem: 'Erro ao registrar gestor.',
      erro: erro.message,
    });
  }
};

// 🧑‍🏫 REGISTRAR PROFESSOR
export const registrarProfessor = async (req, res) => {
  try {
    const { nome, email, senha, codigoAcademia, fotoUrl, fotoBase64 } = req.body;

    const academia = await Academia.findOne({ codigoAcademia });
    if (!academia) {
      return res.status(404).json({ mensagem: 'Código de academia inválido.' });
    }

    const usuarioExistente = await User.findOne({ email });
    if (usuarioExistente) {
      return res.status(400).json({ mensagem: 'E-mail já cadastrado.' });
    }

    const senhaCriptografada = await bcrypt.hash(senha, 10);
    const novoUsuario = new User({
      nome,
      email,
      senha: senhaCriptografada,
      tipo: 'professor',
      academiaId: academia._id
    });
    await novoUsuario.save();

    let fotoPerfilUrl = fotoUrl || null;
    if (fotoBase64) {
      try {
        const base = String(fotoBase64);
        const payload = base.includes(',') ? base.split(',').pop() : base;
        const buf = globalThis.Buffer.from(payload, 'base64');
        fs.mkdirSync(profilePhotosDir, { recursive: true });
        const name = `pf_${novoUsuario._id}_${Date.now()}.jpg`;
        fs.writeFileSync(path.join(profilePhotosDir, name), buf);
        fotoPerfilUrl = `/profile-photos/${name}`;
      } catch (e) {
        console.warn('Falha ao salvar foto do perfil', e?.message);
      }
    }

    const perfilProfessor = new Profile({
      userId: novoUsuario._id,
      nome: novoUsuario.nome,
      tipo: "professor",
      academiaId: novoUsuario.academiaId,
      fotoUrl: fotoPerfilUrl,
    });
    await perfilProfessor.save();
    // Vincular perfil ao usuário
    novoUsuario.perfis.push(perfilProfessor._id);
    await novoUsuario.save();

    res.status(201).json({
      mensagem: 'Professor registrado com sucesso!',
      usuario: { id: novoUsuario._id, nome, email },
      academia: { id: academia._id, nome: academia.nome }
    });
  } catch (erro) {
    console.error('Erro ao registrar professor:', erro.message);
    res.status(500).json({ mensagem: 'Erro ao registrar professor.', erro: erro.message });
  }
};

// 🧒 REGISTRAR ALUNO
export const registrarAluno = async (req, res) => {
  try {
    const { nome, email, senha, codigoAcademia, fotoUrl, fotoBase64 } = req.body;

    const academia = await Academia.findOne({ codigoAcademia });
    if (!academia) {
      return res.status(404).json({ mensagem: 'Código de academia inválido.' });
    }

    try {
      const totalAlunos = await User.countDocuments({ tipo: 'aluno', academiaId: academia._id });
      const max = Number(academia.alunosMax || 0) || 30;
      if (totalAlunos >= max) {
        return res.status(400).json({ mensagem: `Limite máximo de alunos (${max}) atingido para esta academia. Troque de plano para adicionar mais alunos.` });
      }
    } catch (e) { void e }

    const senhaCriptografada = await bcrypt.hash(senha, 10);
    const novoUsuario = new User({
      nome,
      email,
      senha: senhaCriptografada,
      tipo: 'aluno',
      academiaId: academia._id
    });
    await novoUsuario.save();

    let fotoPerfilUrl = fotoUrl || null;
    if (fotoBase64) {
      try {
        const base = String(fotoBase64);
        const payload = base.includes(',') ? base.split(',').pop() : base;
        const buf = globalThis.Buffer.from(payload, 'base64');
        fs.mkdirSync(profilePhotosDir, { recursive: true });
        const name = `pf_${novoUsuario._id}_${Date.now()}.jpg`;
        fs.writeFileSync(path.join(profilePhotosDir, name), buf);
        fotoPerfilUrl = `/profile-photos/${name}`;
      } catch (e) {
        console.warn('Falha ao salvar foto do perfil', e?.message);
      }
    }

    const perfilAluno = new Profile({
      userId: novoUsuario._id,
      nome: novoUsuario.nome,
      tipo: "aluno",
      academiaId: novoUsuario.academiaId,
      fotoUrl: fotoPerfilUrl,
    });
    await perfilAluno.save();
    // Vincular perfil ao usuário
    novoUsuario.perfis.push(perfilAluno._id);
    await novoUsuario.save();

    res.status(201).json({
      mensagem: 'Aluno registrado com sucesso!',
      usuario: { id: novoUsuario._id, nome, email },
      academia: { id: academia._id, nome: academia.nome }
    });
  } catch (erro) {
    console.error('Erro ao registrar aluno:', erro.message);
    res.status(500).json({ mensagem: 'Erro ao registrar aluno.', erro: erro.message });
  }
};

// 🔐 LOGIN COMUM
export const loginUsuario = async (req, res) => {
  try {
    const { email, senha } = req.body;

    const usuario = await User.findOne({ email });
    if (!usuario) {
      return res.status(404).json({ mensagem: 'Usuário não encontrado.' });
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      return res.status(401).json({ mensagem: 'Senha incorreta.' });
    }

    

    const token = jwt.sign(
      { id: usuario._id, email: usuario.email, nome: usuario.nome, tipo: usuario.tipo },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ mensagem: 'Login bem-sucedido!', token, usuario });
  } catch (erro) {
    res.status(500).json({ mensagem: 'Erro ao realizar login.', erro: erro.message });
  }
};

// Obter dados de usuário logado

export const obterUsuario = async (id) => {
  try {
    const usuario = await User.findById(id).select('-senha'); // exclui a senha
    if (!usuario) {
      throw new Error('Usuário não encontrado');
    }
    return usuario;
  } catch (erro) {
    throw new Error(erro.message);
  }
};

// REGISTRAR RESPONSÁVEL (login para criação/gestão de dependentes)
export const registrarResponsavel = async (req, res) => {
  try {
    const { nome, email, senha, fotoUrl, fotoBase64 } = req.body;

    const usuarioExistente = await User.findOne({ email });
    if (usuarioExistente) {
      return res.status(400).json({ mensagem: 'E-mail já cadastrado.' });
    }

    const senhaCriptografada = await bcrypt.hash(senha, 10);

    const novoUsuario = await User.create({
      nome,
      email,
      senha: senhaCriptografada,
      tipo: 'responsavel'
    });

    // Cria automaticamente o perfil de responsavel vinculado
    let fotoPerfilUrl = fotoUrl || null;
    if (fotoBase64) {
      try {
        const base = String(fotoBase64);
        const payload = base.includes(',') ? base.split(',').pop() : base;
        const buf = globalThis.Buffer.from(payload, 'base64');
        fs.mkdirSync(profilePhotosDir, { recursive: true });
        const name = `pf_${novoUsuario._id}_${Date.now()}.jpg`;
        fs.writeFileSync(path.join(profilePhotosDir, name), buf);
        fotoPerfilUrl = `/profile-photos/${name}`;
      } catch (e) {
        console.warn('Falha ao salvar foto do perfil', e?.message);
      }
    }

    const perfilResponsavel = new Profile({
      userId: novoUsuario._id,
      nome: novoUsuario.nome,
      tipo: 'responsavel',
      academiaId: null,
      fotoUrl: fotoPerfilUrl,
    });
    await perfilResponsavel.save();
    novoUsuario.perfis.push(perfilResponsavel._id);
    await novoUsuario.save();

    res.status(201).json({
      mensagem: 'Responsável registrado com sucesso.',
      usuario: novoUsuario,
      perfil: perfilResponsavel,
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ mensagem: 'Erro ao registrar responsável.', erro: erro.message });
  }
};
