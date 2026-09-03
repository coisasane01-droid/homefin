import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { BankAccount, Goal } from '../types';
import { generateId, formatCurrency } from '../utils';
import { Wallet, PiggyBank, Plus, Edit2, Trash2, X, CreditCard, Landmark, Coins, Info } from 'lucide-react';

const Wallets: React.FC = () => {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Partial<BankAccount>>({});
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Partial<Goal>>({});
  const [showInfoModal, setShowInfoModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [accs, gls] = await Promise.all([
      db.getBankAccounts(),
      db.getGoals()
    ]);
    setAccounts(accs);
    setGoals(gls);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount.name || editingAccount.balance === undefined) return;

    if (editingAccount.id) {
      await db.updateBankAccount(editingAccount.id, editingAccount);
    } else {
      await db.addBankAccount({
        id: generateId(),
        name: editingAccount.name,
        type: editingAccount.type || 'corrente',
        balance: Number(editingAccount.balance),
        color: editingAccount.color || 'blue'
      } as BankAccount);
    }
    
    setIsAccountModalOpen(false);
    loadData();
  };

  const handleDeleteAccount = async (id: string) => {
    if (confirm('Deseja realmente excluir esta conta?')) {
      await db.deleteBankAccount(id);
      loadData();
    }
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGoal.title || !editingGoal.targetAmount) return;

    if (editingGoal.id) {
      await db.updateGoal({
        ...editingGoal,
        targetAmount: Number(editingGoal.targetAmount),
        currentAmount: Number(editingGoal.currentAmount || 0)
      } as Goal);
    } else {
      await db.updateGoal({
        id: generateId(),
        title: editingGoal.title,
        targetAmount: Number(editingGoal.targetAmount),
        currentAmount: Number(editingGoal.currentAmount || 0),
        deadline: editingGoal.deadline || '',
        photoUrl: editingGoal.photoUrl || '',
        notes: editingGoal.notes || ''
      });
    }
    
    setIsGoalModalOpen(false);
    loadData();
  };

  const handleDeleteGoal = async (id: string) => {
    if (confirm('Deseja realmente excluir este cofrinho?')) {
      await db.deleteGoal(id);
      loadData();
    }
  };

  const totalBalance = accounts.reduce((acc, a) => acc + a.balance, 0);
  const totalGoals = goals.reduce((acc, g) => acc + g.currentAmount, 0);

  const getAccountIcon = (type: string) => {
    switch(type) {
      case 'corrente': return <Landmark size={24} className="text-blue-500" />;
      case 'poupanca': return <PiggyBank size={24} className="text-green-500" />;
      case 'carteira': return <Wallet size={24} className="text-orange-500" />;
      default: return <CreditCard size={24} className="text-gray-500" />;
    }
  };

  return (
    <div className="pb-20">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Wallet className="text-primary-500" />
            Contas & Cofrinhos
          </h1>
          <p className="text-gray-500 dark:text-gray-400">Gerencie seus saldos e metas</p>
        </div>
        <button 
          onClick={() => setShowInfoModal(true)}
          className="p-2 text-gray-400 hover:text-primary-500 bg-white dark:bg-gray-800 rounded-full shadow-sm border border-gray-100 dark:border-gray-700 transition-colors"
          title="Como funciona?"
        >
          <Info size={20} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-6 text-white shadow-lg">
          <h3 className="text-blue-100 font-medium mb-1">Saldo Total nas Contas</h3>
          <p className="text-3xl font-bold">{formatCurrency(totalBalance)}</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg">
          <h3 className="text-emerald-100 font-medium mb-1">Total Guardado (Cofrinhos)</h3>
          <p className="text-3xl font-bold">{formatCurrency(totalGoals)}</p>
        </div>
      </div>

      {/* Contas Bancárias */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <Landmark className="text-blue-500" />
            Contas Bancárias
          </h2>
          <button 
            onClick={() => { setEditingAccount({ type: 'corrente' }); setIsAccountModalOpen(true); }}
            className="flex items-center gap-1 text-sm bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 px-3 py-1.5 rounded-lg font-medium hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
          >
            <Plus size={16} /> Nova Conta
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map(account => (
            <div key={account.id} className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                    {getAccountIcon(account.type)}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">{account.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{account.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => { setEditingAccount(account); setIsAccountModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDeleteAccount(account.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Saldo Atual</p>
                <p className={`text-xl font-bold ${account.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatCurrency(account.balance)}
                </p>
              </div>
            </div>
          ))}
          {accounts.length === 0 && (
            <div className="col-span-full bg-gray-50 dark:bg-gray-800/50 rounded-xl p-8 text-center border border-dashed border-gray-200 dark:border-gray-700">
              <Landmark size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">Nenhuma conta cadastrada.</p>
            </div>
          )}
        </div>
      </div>

      {/* Cofrinhos */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <PiggyBank className="text-emerald-500" />
            Cofrinhos (Metas)
          </h2>
          <button 
            onClick={() => { setEditingGoal({}); setIsGoalModalOpen(true); }}
            className="flex items-center gap-1 text-sm bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 px-3 py-1.5 rounded-lg font-medium hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
          >
            <Plus size={16} /> Novo Cofrinho
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {goals.map(goal => {
            const progress = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) || 0;
            return (
              <div key={goal.id} className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                      <Coins size={24} className="text-emerald-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white">{goal.title}</h3>
                      {goal.deadline && <p className="text-xs text-gray-500 dark:text-gray-400">Até {new Date(goal.deadline).toLocaleDateString('pt-BR')}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditingGoal(goal); setIsGoalModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-emerald-500 transition-colors">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDeleteGoal(goal.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                
                <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-emerald-600 font-bold">{formatCurrency(goal.currentAmount)}</span>
                    <span className="text-gray-500 dark:text-gray-400">de {formatCurrency(goal.targetAmount)}</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                    <div className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                  </div>
                  <p className="text-xs text-right mt-1 text-gray-400">{progress}% concluído</p>
                </div>
              </div>
            );
          })}
          {goals.length === 0 && (
            <div className="col-span-full bg-gray-50 dark:bg-gray-800/50 rounded-xl p-8 text-center border border-dashed border-gray-200 dark:border-gray-700">
              <PiggyBank size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">Nenhum cofrinho criado.</p>
            </div>
          )}
        </div>
      </div>

      {/* Account Modal */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingAccount.id ? 'Editar Conta' : 'Nova Conta'}
              </h2>
              <button onClick={() => setIsAccountModalOpen(false)} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveAccount} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome da Conta</label>
                <input 
                  type="text" 
                  required
                  value={editingAccount.name || ''}
                  onChange={e => setEditingAccount({...editingAccount, name: e.target.value})}
                  className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="Ex: Nubank, Itaú, Carteira"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo</label>
                <select 
                  value={editingAccount.type || 'corrente'}
                  onChange={e => setEditingAccount({...editingAccount, type: e.target.value as any})}
                  className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                >
                  <option value="corrente">Conta Corrente</option>
                  <option value="poupanca">Poupança</option>
                  <option value="carteira">Carteira (Dinheiro Físico)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Saldo Atual</label>
                <input 
                  type="number" 
                  step="0.01"
                  required
                  value={editingAccount.balance || ''}
                  onChange={e => setEditingAccount({...editingAccount, balance: parseFloat(e.target.value)})}
                  className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="0.00"
                />
              </div>
              <div className="pt-4">
                <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors">
                  Salvar Conta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Goal Modal */}
      {isGoalModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingGoal.id ? 'Editar Cofrinho' : 'Novo Cofrinho'}
              </h2>
              <button onClick={() => setIsGoalModalOpen(false)} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveGoal} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome do Cofrinho</label>
                <input 
                  type="text" 
                  required
                  value={editingGoal.title || ''}
                  onChange={e => setEditingGoal({...editingGoal, title: e.target.value})}
                  className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  placeholder="Ex: Viagem, Emergência, Reforma"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Meta (R$)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    required
                    value={editingGoal.targetAmount || ''}
                    onChange={e => setEditingGoal({...editingGoal, targetAmount: parseFloat(e.target.value)})}
                    className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Guardado (R$)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={editingGoal.currentAmount || ''}
                    onChange={e => setEditingGoal({...editingGoal, currentAmount: parseFloat(e.target.value)})}
                    className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="pt-4">
                <button type="submit" className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors">
                  Salvar Cofrinho
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <Info className="text-primary-500" /> Como funciona esta página?
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
                A página de <strong>Contas & Cofrinhos</strong> é onde você organiza o dinheiro que você já tem guardado ou disponível.
              </p>
              
              <div className="space-y-3 mt-4">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-1.5 rounded text-blue-600 dark:text-blue-400 mt-0.5">
                    <Landmark size={16} />
                  </div>
                  <div>
                    <strong className="text-gray-800 dark:text-gray-200 block">Contas Bancárias:</strong>
                    <p className="mt-1 opacity-90">
                      Cadastre suas contas correntes, poupanças ou carteiras digitais. O saldo de todas elas é somado e exibido no card azul no topo. Esse valor também é usado para calcular o seu Score Financeiro no Dashboard.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 mt-4">
                  <div className="bg-emerald-100 dark:bg-emerald-900/30 p-1.5 rounded text-emerald-600 dark:text-emerald-400 mt-0.5">
                    <PiggyBank size={16} />
                  </div>
                  <div>
                    <strong className="text-gray-800 dark:text-gray-200 block">Cofrinhos (Metas):</strong>
                    <p className="mt-1 opacity-90">
                      Crie cofrinhos para seus objetivos (como uma viagem, reserva de emergência ou reforma). Defina um valor alvo e atualize o valor guardado sempre que depositar mais dinheiro. O total guardado aparece no card verde no topo.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg mt-4 border border-gray-100 dark:border-gray-700">
                <p className="text-xs text-center font-medium text-gray-500 dark:text-gray-400">
                  Dica: Mantenha os saldos sempre atualizados para que o aplicativo possa calcular sua saúde financeira com precisão!
                </p>
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

export default Wallets;
