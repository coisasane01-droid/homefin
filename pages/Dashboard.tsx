import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { formatCurrency } from '../utils';
import { Bill, Asset, Goal, UserSettings } from '../types';
import { ArrowUpCircle, ArrowDownCircle, AlertCircle, CheckCircle, Gem, Target, Wallet, Edit2, Check, Lightbulb, TrendingUp, Activity, Info, X } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

const Dashboard: React.FC = () => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [stats, setStats] = useState({ total: 0, paid: 0, pending: 0, count: 0 });
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isEditingBalance, setIsEditingBalance] = useState(false);
  const [tempBalance, setTempBalance] = useState('');
  const [score, setScore] = useState({ value: 0, label: '', color: '', bg: '' });
  const [activeInfoModal, setActiveInfoModal] = useState<string | null>(null);
  const [insights, setInsights] = useState<{
    biggestCategory?: { name: string, amount: number },
    increase?: { name: string, percentage: number }
  }>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    let prevMonthNum = now.getMonth();
    let prevYear = now.getFullYear();
    if (prevMonthNum === 0) {
      prevMonthNum = 12;
      prevYear -= 1;
    }
    const prevMonthStr = `${prevYear}-${String(prevMonthNum).padStart(2, '0')}`;
    
    const [monthBills, prevMonthBills, allAssets, allGoals, userSettings, allBankAccounts, allDebts] = await Promise.all([
      db.getBills(monthStr),
      db.getBills(prevMonthStr),
      db.getAssets(),
      db.getGoals(),
      db.getSettings(),
      db.getBankAccounts(),
      db.getDebts()
    ]);
    
    setBills(monthBills);
    setAssets(allAssets);
    setGoals(allGoals);
    setSettings(userSettings);
    setTempBalance((userSettings.currentBalance || 0).toString());

    const total = monthBills.reduce((acc, b) => acc + b.amount + (b.subCategoryAmount || 0), 0);
    const paid = monthBills.reduce((acc, b) => {
      if (b.status === 'paid') return acc + b.amount + (b.subCategoryAmount || 0);
      return acc + (b.paidAmount || 0);
    }, 0);
    
    const pendingAmount = total - paid;
    setStats({
      total,
      paid,
      pending: pendingAmount,
      count: monthBills.length
    });

    // Calculate Score
    let calculatedScore = 50; // Base score
    
    const currentBalance = userSettings.currentBalance || 0;
    const totalBankBalance = allBankAccounts.reduce((acc, a) => acc + a.balance, 0);
    const effectiveBalance = currentBalance + totalBankBalance;
    
    if (effectiveBalance >= pendingAmount && pendingAmount > 0) {
      calculatedScore += 15;
    } else if (effectiveBalance < pendingAmount) {
      calculatedScore -= 15;
    } else if (effectiveBalance > 0 && pendingAmount === 0) {
      calculatedScore += 15;
    }

    const totalGoals = allGoals.reduce((acc, g) => acc + g.currentAmount, 0);
    const totalAssets = allAssets.reduce((acc, a) => acc + a.purchaseValue, 0);
    if (totalGoals > 0) calculatedScore += 10;
    if (totalAssets > 0) calculatedScore += 5;

    if (total > 0) {
      const paidRatio = paid / total;
      if (paidRatio >= 0.8) calculatedScore += 15;
      else if (paidRatio >= 0.5) calculatedScore += 5;
      else calculatedScore -= 10;
    } else {
      calculatedScore += 10;
    }
    
    const totalDebts = allDebts.reduce((acc, d) => acc + (d.totalAmount - d.paidAmount), 0);
    if (totalDebts === 0) {
      calculatedScore += 10;
    } else if (totalDebts > effectiveBalance) {
      calculatedScore -= 15;
    } else {
      calculatedScore -= 5;
    }

    calculatedScore = Math.max(0, Math.min(100, calculatedScore));

    let scoreLabel = 'Atenção';
    let scoreColor = 'text-red-500';
    let scoreBg = 'bg-red-50 dark:bg-red-900/20';
    
    if (calculatedScore >= 80) {
      scoreLabel = 'Excelente';
      scoreColor = 'text-emerald-500';
      scoreBg = 'bg-emerald-50 dark:bg-emerald-900/20';
    } else if (calculatedScore >= 60) {
      scoreLabel = 'Boa';
      scoreColor = 'text-blue-500';
      scoreBg = 'bg-blue-50 dark:bg-blue-900/20';
    } else if (calculatedScore >= 40) {
      scoreLabel = 'Razoável';
      scoreColor = 'text-yellow-500';
      scoreBg = 'bg-yellow-50 dark:bg-yellow-900/20';
    }

    setScore({ value: calculatedScore, label: scoreLabel, color: scoreColor, bg: scoreBg });

    // Calculate Insights
    const currentTotals: Record<string, number> = {};
    monthBills.forEach(b => {
      const cat = b.category;
      currentTotals[cat] = (currentTotals[cat] || 0) + b.amount + (b.subCategoryAmount || 0);
    });

    const prevTotals: Record<string, number> = {};
    prevMonthBills.forEach(b => {
      const cat = b.category;
      prevTotals[cat] = (prevTotals[cat] || 0) + b.amount + (b.subCategoryAmount || 0);
    });

    let biggestCategory = { name: '', amount: 0 };
    for (const [cat, amount] of Object.entries(currentTotals)) {
      if (amount > biggestCategory.amount) {
        biggestCategory = { name: cat, amount };
      }
    }

    let highestIncrease = { name: '', percentage: 0 };
    for (const [cat, amount] of Object.entries(currentTotals)) {
      const prevAmount = prevTotals[cat] || 0;
      if (prevAmount > 0 && amount > prevAmount) {
        const increase = ((amount - prevAmount) / prevAmount) * 100;
        if (increase > highestIncrease.percentage) {
          highestIncrease = { name: cat, percentage: Math.round(increase) };
        }
      }
    }

    setInsights({
      biggestCategory: biggestCategory.amount > 0 ? biggestCategory : undefined,
      increase: highestIncrease.percentage > 0 ? highestIncrease : undefined
    });

    setLoading(false);
  };

  const handleSaveBalance = async () => {
    if (!settings) return;
    const newBalance = parseFloat(tempBalance) || 0;
    const newSettings = { ...settings, currentBalance: newBalance };
    await db.updateSettings(newSettings);
    setSettings(newSettings);
    setIsEditingBalance(false);
  };

  const progress = stats.total === 0 ? 0 : Math.round((stats.paid / stats.total) * 100);

  const chartData = [
    { name: 'Pago', value: stats.paid, color: '#10b981' }, // emerald-500
    { name: 'Pendente', value: stats.pending, color: '#f59e0b' }, // amber-500
  ];

  const goalsData = goals.map(g => ({
    name: g.title.substring(0, 10) + (g.title.length > 10 ? '...' : ''),
    Guardado: g.currentAmount,
    Alvo: g.targetAmount
  }));

  if (loading) {
      return <div className="p-8 text-center text-gray-500">Carregando dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Dashboard do Mês</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-gray-500 dark:text-gray-400 font-medium">Total Previsto</h3>
              <button onClick={() => setActiveInfoModal('total')} className="text-gray-400 hover:text-primary-500 transition-colors" title="Como funciona?"><Info size={16} /></button>
            </div>
            <ArrowUpCircle className="text-primary-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{formatCurrency(stats.total)}</p>
          <p className="text-sm text-gray-400 mt-1">{stats.count} lançamentos</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-gray-500 dark:text-gray-400 font-medium">Pago</h3>
              <button onClick={() => setActiveInfoModal('pago')} className="text-gray-400 hover:text-primary-500 transition-colors" title="Como funciona?"><Info size={16} /></button>
            </div>
            <CheckCircle className="text-emerald-500" />
          </div>
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(stats.paid)}</p>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-3">
            <div 
              className="bg-emerald-500 h-2 rounded-full transition-all duration-500" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-gray-500 dark:text-gray-400 font-medium">Pendente</h3>
              <button onClick={() => setActiveInfoModal('pendente')} className="text-gray-400 hover:text-primary-500 transition-colors" title="Como funciona?"><Info size={16} /></button>
            </div>
            <AlertCircle className="text-amber-500" />
          </div>
          <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(stats.pending)}</p>
          <p className="text-sm text-gray-400 mt-1">Falta pagar</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-gray-500 dark:text-gray-400 font-medium">Saldo Atual</h3>
              <button onClick={() => setActiveInfoModal('saldo_atual')} className="text-gray-400 hover:text-primary-500 transition-colors" title="Como funciona?"><Info size={16} /></button>
            </div>
            <Wallet className="text-blue-500" />
          </div>
          {isEditingBalance ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={tempBalance}
                onChange={(e) => setTempBalance(e.target.value)}
                className="w-full p-2 text-xl font-bold border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                autoFocus
              />
              <button 
                onClick={handleSaveBalance}
                className="p-2 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition-colors"
              >
                <Check size={20} />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(settings?.currentBalance || 0)}
              </p>
              <button 
                onClick={() => setIsEditingBalance(true)}
                className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
                title="Editar Saldo"
              >
                <Edit2 size={18} />
              </button>
            </div>
          )}
          <p className="text-sm text-gray-400 mt-1">Dinheiro disponível hoje</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-gray-500 dark:text-gray-400 font-medium">Saldo Previsto</h3>
              <button onClick={() => setActiveInfoModal('saldo_previsto')} className="text-gray-400 hover:text-primary-500 transition-colors" title="Como funciona?"><Info size={16} /></button>
            </div>
            <Target className="text-indigo-500" />
          </div>
          <p className={`text-3xl font-bold ${(settings?.currentBalance || 0) - stats.pending >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {formatCurrency((settings?.currentBalance || 0) - stats.pending)}
          </p>
          <p className="text-sm text-gray-400 mt-1">Fim do mês (Saldo Atual - Pendente)</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-gray-500 dark:text-gray-400 font-medium">Score Financeiro</h3>
              <button 
                onClick={() => setActiveInfoModal('score')}
                className="text-gray-400 hover:text-primary-500 transition-colors"
                title="Como funciona o Score?"
              >
                <Info size={16} />
              </button>
            </div>
            <Activity className={score.color} />
          </div>
          <div className="flex items-end gap-2">
            <p className={`text-3xl font-bold ${score.color}`}>
              {score.value}
            </p>
            <p className="text-gray-500 dark:text-gray-400 mb-1 font-medium">/ 100</p>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className={`px-2 py-1 rounded text-xs font-bold ${score.bg} ${score.color}`}>
              {score.label}
            </span>
            <p className="text-xs text-gray-400">Saúde financeira</p>
          </div>
        </div>
      </div>

      {/* Inteligência de Gastos */}
      {(insights.biggestCategory || insights.increase) && (
        <div className="bg-gradient-to-r from-primary-600 to-indigo-600 rounded-xl p-6 text-white shadow-md">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="text-yellow-300 w-6 h-6" />
            <h3 className="text-lg font-bold">Inteligência de Gastos</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.biggestCategory && (
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 border border-white/10">
                <p className="text-primary-100 text-sm mb-1 font-medium">Maior gasto do mês</p>
                <p className="text-xl font-bold leading-tight mt-1">
                  Seu maior gasto foi com <span className="text-yellow-300">{insights.biggestCategory.name}</span>
                </p>
                <p className="text-sm mt-2 opacity-90 font-medium">{formatCurrency(insights.biggestCategory.amount)}</p>
              </div>
            )}
            {insights.increase && (
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 border border-white/10">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="text-red-300 w-4 h-4" />
                  <p className="text-primary-100 text-sm font-medium">Atenção ao aumento</p>
                </div>
                <p className="text-xl font-bold leading-tight mt-1">
                  Você gastou <span className="text-red-300">{insights.increase.percentage}% mais</span> com {insights.increase.name}
                </p>
                <p className="text-sm mt-2 opacity-90">Comparado ao mês passado</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 min-h-[300px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Status de Pagamento</h3>
            <button onClick={() => setActiveInfoModal('status')} className="text-gray-400 hover:text-primary-500 transition-colors"><Info size={16} /></button>
          </div>
          <div className="h-64">
            {stats.total > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                Sem dados para o mês
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Próximos Vencimentos</h3>
            <button onClick={() => setActiveInfoModal('vencimentos')} className="text-gray-400 hover:text-primary-500 transition-colors"><Info size={16} /></button>
          </div>
          <div className="space-y-3">
            {bills
              .filter(b => b.status === 'pending')
              .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
              .slice(0, 5)
              .map(bill => (
                <div key={bill.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-900 dark:text-gray-100">{bill.description}</span>
                    <span className="text-xs text-gray-500">{new Date(bill.dueDate).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-bold text-gray-800 dark:text-gray-200">{formatCurrency(bill.amount + (bill.subCategoryAmount || 0))}</span>
                    {bill.paidAmount !== undefined && bill.paidAmount > 0 && (
                      <div className="flex flex-col items-end text-[10px] mt-0.5">
                        <span className="text-emerald-600 font-medium">Pago: {formatCurrency(bill.paidAmount)}</span>
                        <span className="text-red-500 font-medium">Falta: {formatCurrency((bill.amount + (bill.subCategoryAmount || 0)) - bill.paidAmount)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            {bills.filter(b => b.status === 'pending').length === 0 && (
              <p className="text-gray-400 text-center py-4">Nenhuma conta pendente!</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <Gem className="text-primary-500" size={20} /> Patrimônio Total
            </h3>
            <button onClick={() => setActiveInfoModal('patrimonio')} className="text-gray-400 hover:text-primary-500 transition-colors"><Info size={16} /></button>
          </div>
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(assets.reduce((acc, a) => acc + a.purchaseValue, 0))}
          </p>
          <p className="text-sm text-gray-400 mt-1">{assets.length} bens registrados</p>
          
          <div className="mt-6 space-y-3">
            {assets.slice(0, 3).map(asset => (
              <div key={asset.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <span className="font-medium text-gray-900 dark:text-gray-100">{asset.name}</span>
                <span className="font-bold text-gray-800 dark:text-gray-200">{formatCurrency(asset.purchaseValue)}</span>
              </div>
            ))}
            {assets.length === 0 && (
              <p className="text-gray-400 text-center py-4">Nenhum bem registrado.</p>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <Target className="text-primary-500" size={20} /> Metas e Sonhos
            </h3>
            <button onClick={() => setActiveInfoModal('metas')} className="text-gray-400 hover:text-primary-500 transition-colors"><Info size={16} /></button>
          </div>
          
          <div className="space-y-4 mt-4">
            {goals.length > 0 ? goals.slice(0, 3).map(goal => {
              const progress = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
              return (
                <div key={goal.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-gray-900 dark:text-gray-100">{goal.title}</span>
                    <span className="text-sm font-bold text-primary-600">{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                    <div 
                      className="bg-primary-500 h-2 rounded-full transition-all duration-500" 
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between mt-1 text-xs text-gray-500">
                    <span>{formatCurrency(goal.currentAmount)}</span>
                    <span>{formatCurrency(goal.targetAmount)}</span>
                  </div>
                </div>
              );
            }) : (
              <p className="text-gray-400 text-center py-4">Nenhuma meta registrada.</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <Target className="text-primary-500" size={20} /> Progresso das Metas
          </h3>
          <button onClick={() => setActiveInfoModal('progresso_metas')} className="text-gray-400 hover:text-primary-500 transition-colors"><Info size={16} /></button>
        </div>
        <div className="h-64">
          {goals.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={goalsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(value) => `R$ ${value}`} tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} cursor={{ fill: 'transparent' }} />
                <Legend />
                <Bar dataKey="Guardado" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Alvo" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              Sem metas registradas
            </div>
          )}
        </div>
      </div>

      {/* Info Modal */}
      {activeInfoModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                {activeInfoModal === 'score' ? <Activity className="text-primary-500" /> : <Info className="text-primary-500" />} 
                {activeInfoModal === 'score' ? 'Como funciona o Score?' : 'Entenda este card'}
              </h2>
              <button 
                onClick={() => setActiveInfoModal(null)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4 text-sm text-gray-600 dark:text-gray-300">
              {activeInfoModal === 'total' && (
                <p>O <strong>Total Previsto</strong> é a soma de todas as contas e despesas cadastradas para o mês atual, independentemente de já estarem pagas ou não. Ele ajuda a entender o custo total do seu mês.</p>
              )}
              {activeInfoModal === 'pago' && (
                <p>O valor <strong>Pago</strong> representa a soma de todas as contas que você já marcou como pagas neste mês. A barra de progresso mostra o percentual do total previsto que já foi quitado.</p>
              )}
              {activeInfoModal === 'pendente' && (
                <p>O valor <strong>Pendente</strong> é a soma de todas as contas do mês atual que ainda não foram pagas. É o dinheiro que você ainda precisa desembolsar até o fim do mês.</p>
              )}
              {activeInfoModal === 'saldo_atual' && (
                <p>O <strong>Saldo Atual</strong> é o dinheiro que você tem disponível hoje. Ele representa o valor que você informa manualmente neste card para suas despesas diárias.</p>
              )}
              {activeInfoModal === 'saldo_previsto' && (
                <p>O <strong>Saldo Previsto</strong> é uma projeção de quanto dinheiro vai sobrar (ou faltar) no fim do mês. Ele é calculado subtraindo o valor Pendente (o que falta pagar) do seu Saldo Atual.</p>
              )}
              {activeInfoModal === 'status' && (
                <p>O gráfico de <strong>Status de Pagamento</strong> mostra visualmente a proporção entre o que já foi pago (verde) e o que ainda está pendente (laranja) no mês atual.</p>
              )}
              {activeInfoModal === 'vencimentos' && (
                <p>A lista de <strong>Próximos Vencimentos</strong> mostra as 5 contas pendentes mais próximas de vencer, organizadas por data, para ajudar você a não perder nenhum prazo.</p>
              )}
              {activeInfoModal === 'patrimonio' && (
                <p>O <strong>Patrimônio Total</strong> é a soma do valor de compra de todos os bens (imóveis, veículos, investimentos) que você cadastrou na seção de Bens & Patrimônio.</p>
              )}
              {activeInfoModal === 'metas' && (
                <p>O card de <strong>Metas e Sonhos</strong> mostra o resumo dos seus cofrinhos ativos, exibindo o valor já guardado, o valor alvo e a barra de progresso para cada um.</p>
              )}
              {activeInfoModal === 'progresso_metas' && (
                <p>O gráfico de <strong>Progresso das Metas</strong> compara visualmente o valor que você já guardou (verde) com o valor total necessário (cinza) para cada um dos seus cofrinhos.</p>
              )}
              
              {activeInfoModal === 'score' && (
                <>
                  <p>
                    O <strong>Score Financeiro da Família</strong> é uma nota de 0 a 100 que mede a saúde financeira da sua casa neste mês. Ele é calculado automaticamente com base nos dados que você insere no app.
                  </p>
                  
                  <div className="space-y-3 mt-4">
                    <div className="flex items-start gap-3">
                      <div className="bg-emerald-100 dark:bg-emerald-900/30 p-1.5 rounded text-emerald-600 dark:text-emerald-400 mt-0.5">
                        <ArrowUpCircle size={16} />
                      </div>
                      <div>
                        <strong className="text-gray-800 dark:text-gray-200 block">O que aumenta sua nota:</strong>
                        <ul className="list-disc list-inside mt-1 space-y-1 opacity-90">
                          <li>Ter saldo total (Saldo Atual + Contas Bancárias) suficiente para pagar as contas pendentes.</li>
                          <li>Pagar as contas em dia (maior proporção de contas pagas).</li>
                          <li>Ter dinheiro guardado nos Cofrinhos (Metas).</li>
                          <li>Ter Bens e Patrimônio registrados.</li>
                        </ul>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 mt-4">
                      <div className="bg-red-100 dark:bg-red-900/30 p-1.5 rounded text-red-600 dark:text-red-400 mt-0.5">
                        <ArrowDownCircle size={16} />
                      </div>
                      <div>
                        <strong className="text-gray-800 dark:text-gray-200 block">O que diminui sua nota:</strong>
                        <ul className="list-disc list-inside mt-1 space-y-1 opacity-90">
                          <li>Ter contas pendentes e saldo total insuficiente para pagá-las.</li>
                          <li>Muitas contas atrasadas ou não pagas.</li>
                          <li>Ter Dívidas ativas que superam o seu saldo total.</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg mt-4 border border-gray-100 dark:border-gray-700">
                    <p className="text-xs text-center font-medium text-gray-500 dark:text-gray-400">
                      Mantenha seus dados atualizados (saldo, contas pagas e cofrinhos) para ter um score sempre preciso!
                    </p>
                  </div>
                </>
              )}
            </div>
            
            <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 flex justify-end">
              <button 
                onClick={() => setActiveInfoModal(null)}
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

export default Dashboard;