import app from './app.js';
import dotenv from 'dotenv';
import { startAulasWeeklyScheduler, startDailyInatividadeScheduler } from './utils/aulasScheduler.js';
import { startBirthdayScheduler } from './utils/birthdayScheduler.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

app.get('/ping', (req, res) => {
  res.send('pong');
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  try {
    const count = app?._router?.stack?.length || 0;
    console.log('Routes loaded:', count);
  } catch (e) {}
  // Inicia o agendador automático de aulas semanais
  startAulasWeeklyScheduler();
  startDailyInatividadeScheduler();
  startBirthdayScheduler();
});
