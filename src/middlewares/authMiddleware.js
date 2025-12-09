import jwt from "jsonwebtoken";
import User from "../models/User.js"; 
import Academia from "../models/Academia.js";

export const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ mensagem: "Token não fornecido." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("🟢 Token decodificado:", decoded);

    const user = await User.findById(decoded.id).populate('perfis');
    console.log("🔍 Usuário encontrado:", user?.nome);
    console.log("🔍 Quantidade de perfis:", user?.perfis?.length);
    console.log("🔍 Perfis do usuário:", user?.perfis?.map(p => ({ id: p._id, tipo: p.tipo })));

    if (!user) {
      return res.status(404).json({ mensagem: "Usuário não encontrado no banco." });
    }

    // Encontrar o perfil principal baseado no tipo do usuário
    let profileId = null;
    console.log("🔍 Buscando profileId...");
    
    if (user.perfis && user.perfis.length > 0) {
      console.log("✅ Usuário tem perfis:", user.perfis.length);
      
      // Se for gestor, procura pelo perfil gestor
      if (user.tipo === 'gestor') {
        const gestorProfile = user.perfis.find(p => p.tipo === 'gestor');
        profileId = gestorProfile ? gestorProfile._id : user.perfis[0]._id;
        console.log("🎯 Perfil gestor encontrado:", gestorProfile?._id);
      } 
      // Se for professor, procura pelo perfil professor
      else if (user.tipo === 'professor') {
        const professorProfile = user.perfis.find(p => p.tipo === 'professor');
        profileId = professorProfile ? professorProfile._id : user.perfis[0]._id;
        console.log("🎯 Perfil professor encontrado:", professorProfile?._id);
      }
      // Se for aluno, procura pelo perfil aluno
      else if (user.tipo === 'aluno') {
        const alunoProfile = user.perfis.find(p => p.tipo === 'aluno');
        profileId = alunoProfile ? alunoProfile._id : user.perfis[0]._id;
        console.log("🎯 Perfil aluno encontrado:", alunoProfile?._id);
      }
      // Se for responsavel, procura pelo perfil responsavel
      else if (user.tipo === 'responsavel') {
        const responsavelProfile = user.perfis.find(p => p.tipo === 'responsavel');
        profileId = responsavelProfile ? responsavelProfile._id : user.perfis[0]._id;
        console.log("🎯 Perfil responsavel encontrado:", responsavelProfile?._id);
      }
      // Fallback: usa o primeiro perfil
      else {
        profileId = user.perfis[0]._id;
        console.log("🎯 Usando primeiro perfil:", profileId);
      }
    } else {
      console.log("❌ Usuário NÃO tem perfis!");
    }
    
    console.log("🏆 Profile ID final:", profileId);

    // Resolver academiaId automaticamente
    let academiaIdResolved = user.academiaId || null;
    // Tentar pegar do perfil selecionado
    if (!academiaIdResolved && user.perfis && profileId) {
      const perfilAtual = user.perfis.find(p => p._id.toString() === profileId.toString());
      academiaIdResolved = perfilAtual?.academiaId || null;
      if (academiaIdResolved) {
        console.log("🏫 Academia resolvida pelo perfil atual:", academiaIdResolved);
      }
    }
    // Se for gestor e ainda não tem academia, resolver via vínculo na Academia
    if (!academiaIdResolved && user.tipo === 'gestor') {
      const academiaDoGestor = await Academia.findOne({ gestor: user._id }).select('_id');
      if (academiaDoGestor) {
        academiaIdResolved = academiaDoGestor._id;
        console.log("🏫 Academia do gestor resolvida via vínculo:", academiaIdResolved);
      } else {
        console.log("⚠️ Nenhuma academia vinculada ao gestor encontrada.");
      }
    }

    req.user = {
      id: user._id,
      email: user.email,
      nome: user.nome,
      tipo: user.tipo,
      academiaId: academiaIdResolved || null,
      profileId: profileId
    };

    next();
  } catch (erro) {
    console.error("Erro no middleware de autenticação:", erro);
    res.status(401).json({ mensagem: "Token inválido." });
  }
};
