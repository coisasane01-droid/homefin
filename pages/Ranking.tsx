import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { Bill, UserSettings } from '../types';
import { formatCurrency } from '../utils';
import { Trophy, Medal, Award, ChevronLeft, ChevronRight, Info, X } from 'lucide-react';

const Ranking: React.FC = () => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showInfoModal, setShowInfoModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, [currentDate]);

  const fetchData = async () => {
    setLoading(true);
    const monthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const [monthBills, userSettings] = await Promise.all([
      db.getBills(monthStr),
      db.getSettings()
    ]);
    
    setBills(monthBills);
    setSettings(userSettings);
    setLoading(false);
  };

  const changeMonth = (offset: number) => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1);
    setCurrentDate(newDate);
  };

  // Calculate ranking
  const memberTotals: Record<string, number> = {};
  
  // Initialize with all members
  if (settings?.members) {
    settings.members.forEach(m => memberTotals[m] = 0);
  }

  // Add unassigned category just in case
  memberTotals['Não Atribuído'] = 0;

  bills.forEach(bill => {
    const amount = bill.amount + (bill.subCategoryAmount || 0);
    const member = bill.assignedTo || 'Não Atribuído';
    if (memberTotals[member] !== undefined) {
      memberTotals[member] += amount;
    } else {
      memberTotals[member] = amount;
    }
  });

  // Remove 'Não Atribuído' if it's 0
  if (memberTotals['Não Atribuído'] === 0) {
    delete memberTotals['Não Atribuído'];
  }

  const ranking = Object.entries(memberTotals)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);

  const getMedal = (index: number) => {
    if (index === 0) return <Trophy className="text-yellow-500 w-8 h-8" />;
    if (index === 1) return <Medal className="text-gray-400 w-7 h-7" />;
    if (index === 2) return <Award className="text-amber-600 w-6 h-6" />;
    return <span className="text-gray-400 font-bold text-lg w-6 text-center">{index + 1}º</span>;
  };

  const getFunMessage = (index: number, total: number) => {
    if (total === 0) return "Passou ileso! 😇";
    if (index === 0) return "Campeão de gastos! Vai com calma! 💸😂";
    if (index === 1) return "Quase lá, mas o primeiro lugar gastou mais! 🥈";
    if (index === ranking.length - 1 && ranking.length > 2) return "O mais econômico da casa! 🏆✨";
    return "Na média da família. 📊";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <Trophy className="text-yellow-500" /> Ranking Familiar
          <button 
            onClick={() => setShowInfoModal(true)}
            className="p-1.5 text-gray-400 hover:text-primary-500 bg-white dark:bg-gray-800 rounded-full shadow-sm border border-gray-100 dark:border-gray-700 transition-colors ml-2"
            title="Como funciona o Ranking Familiar?"
          >
            <Info size={18} />
          </button>
        </h2>
        
        <div className="flex items-center gap-4 bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
          <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300">
            <ChevronLeft size={20} />
          </button>
          <span className="font-medium text-gray-800 dark:text-gray-200 min-w-[120px] text-center capitalize">
            {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={() => changeMonth(1)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 text-center">
            Quem gastou mais neste mês? 😂
          </h3>
          <p className="text-sm text-gray-500 text-center mt-1">
            Baseado nas contas atribuídas a cada membro da família.
          </p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Calculando ranking...</div>
        ) : ranking.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Nenhum membro cadastrado ou nenhuma conta atribuída neste mês.
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {ranking.map((item, index) => (
              <div key={item.name} className="p-4 sm:p-6 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex-shrink-0 w-12 flex justify-center items-center">
                  {getMedal(index)}
                </div>
                
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="font-bold text-lg text-gray-800 dark:text-gray-200">
                      {item.name}
                    </h4>
                    <span className="font-bold text-lg text-gray-900 dark:text-white">
                      {formatCurrency(item.total)}
                    </span>
                  </div>
                  
                  {/* Progress bar relative to the highest spender */}
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2 mb-2">
                    <div 
                      className={`h-2 rounded-full ${index === 0 ? 'bg-red-500' : index === ranking.length - 1 && ranking.length > 2 ? 'bg-emerald-500' : 'bg-primary-500'}`}
                      style={{ width: `${ranking[0].total > 0 ? (item.total / ranking[0].total) * 100 : 0}%` }}
                    ></div>
                  </div>
                  
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                    {getFunMessage(index, item.total)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <Info className="text-primary-500" /> Como funciona o Ranking Familiar?
              </h2>
              <button 
                onClick={() => setShowInfoModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4 text-sm text-gray-600 dark:text-gray-300">
              <p>
                O <strong>Ranking Familiar</strong> é uma forma divertida de ver quem está gastando mais dinheiro na casa a cada mês!
              </p>
              
              <div className="space-y-3 mt-4">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-1.5 rounded text-blue-600 dark:text-blue-400 mt-0.5">
                    <Trophy size={16} />
                  </div>
                  <div>
                    <strong className="text-gray-800 dark:text-gray-200 block">Como é calculado?</strong>
                    <p className="mt-1 opacity-90">
                      O sistema soma o valor de todas as despesas (pagas ou pendentes) do mês selecionado e agrupa pelo "Membro da Família" atribuído àquela conta.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 mt-4">
                  <div className="bg-emerald-100 dark:bg-emerald-900/30 p-1.5 rounded text-emerald-600 dark:text-emerald-400 mt-0.5">
                    <Medal size={16} />
                  </div>
                  <div>
                    <strong className="text-gray-800 dark:text-gray-200 block">O Pódio:</strong>
                    <p className="mt-1 opacity-90">
                      Quem gastou mais fica em 1º lugar (Troféu de Ouro e barra vermelha). O mais econômico fica por último (barra verde).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 mt-4">
                  <div className="bg-purple-100 dark:bg-purple-900/30 p-1.5 rounded text-purple-600 dark:text-purple-400 mt-0.5">
                    <ChevronLeft size={16} />
                  </div>
                  <div>
                    <strong className="text-gray-800 dark:text-gray-200 block">Navegação por Meses:</strong>
                    <p className="mt-1 opacity-90">
                      Use as setas no topo da página para voltar no tempo e ver quem foi o "campeão de gastos" nos meses anteriores.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 flex justify-end">
              <button 
                onClick={() => setShowInfoModal(false)}
                className="px-6 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Ranking;
