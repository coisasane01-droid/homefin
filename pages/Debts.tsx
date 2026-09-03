import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Debt, UserSettings } from '../types';
import { generateId, formatCurrency } from '../utils';
import { Wallet, Plus, Edit2, Trash2, X, Check, Search, Info } from 'lucide-react';

const Debts: React.FC = () => {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Partial<Debt>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState<{isOpen: boolean, id: string | null}>({isOpen: false, id: null});
  const [showInfoModal, setShowInfoModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [loadedDebts, userSettings] = await Promise.all([
      db.getDebts(),
      db.getSettings()
    ]);
    setDebts(loadedDebts);
    setSettings(userSettings);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDebt.person || !editingDebt.totalAmount) return;

    if (editingDebt.id) {
      await db.updateDebt(editingDebt.id, editingDebt);
    } else {
      await db.addDebt({
        id: generateId(),
        person: editingDebt.person,
        totalAmount: Number(editingDebt.totalAmount),
        paidAmount: Number(editingDebt.paidAmount) || 0,
        notes: editingDebt.notes || '',
        createdAt: new Date().toISOString()
      });
    }

    setIsModalOpen(false);
    loadData();
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmation({isOpen: true, id});
  };

  const confirmDelete = async () => {
    if (deleteConfirmation.id) {
      await db.deleteDebt(deleteConfirmation.id);
      setDeleteConfirmation({isOpen: false, id: null});
      loadData();
    }
  };

  const openModal = (debt?: Debt) => {
    setEditingDebt(debt || { person: '', totalAmount: 0, paidAmount: 0, notes: '' });
    setIsModalOpen(true);
  };

  const filteredDebts = debts.filter(d => 
    d.person.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.notes && d.notes.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalDebt = debts.reduce((acc, d) => acc + d.totalAmount, 0);
  const totalPaid = debts.reduce((acc, d) => acc + d.paidAmount, 0);
  const totalRemaining = totalDebt - totalPaid;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <Wallet className="text-primary-600" /> Controle de Dívidas
          <button 
            onClick={() => setShowInfoModal(true)}
            className="p-1.5 text-gray-400 hover:text-primary-500 bg-white dark:bg-gray-800 rounded-full shadow-sm border border-gray-100 dark:border-gray-700 transition-colors ml-2"
            title="Como funciona o Controle de Dívidas?"
          >
            <Info size={18} />
          </button>
        </h2>
        <button
          onClick={() => openModal()}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary-700 transition-colors shadow-sm w-full sm:w-auto justify-center"
        >
          <Plus size={20} />
          Nova Dívida
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Valor Total</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(totalDebt)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Total Pago</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Restante</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(totalRemaining)}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por pessoa ou observação..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700">
                <th className="p-4 font-semibold text-gray-600 dark:text-gray-300">Pessoa</th>
                <th className="p-4 font-semibold text-gray-600 dark:text-gray-300 text-right">Valor</th>
                <th className="p-4 font-semibold text-gray-600 dark:text-gray-300 text-right">Pago</th>
                <th className="p-4 font-semibold text-gray-600 dark:text-gray-300 text-right">Restante</th>
                <th className="p-4 font-semibold text-gray-600 dark:text-gray-300 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredDebts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500 dark:text-gray-400">
                    Nenhuma dívida encontrada.
                  </td>
                </tr>
              ) : (
                filteredDebts.map(debt => {
                  const remaining = debt.totalAmount - debt.paidAmount;
                  const isPaid = remaining <= 0;
                  
                  return (
                    <tr key={debt.id} className={`border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${isPaid ? 'opacity-60' : ''}`}>
                      <td className="p-4">
                        <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                          {debt.person}
                          {isPaid && <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-bold">Quitado</span>}
                        </div>
                        {debt.notes && <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{debt.notes}</div>}
                      </td>
                      <td className="p-4 text-right font-medium text-gray-900 dark:text-white">
                        {formatCurrency(debt.totalAmount)}
                      </td>
                      <td className="p-4 text-right font-medium text-emerald-600">
                        {formatCurrency(debt.paidAmount)}
                      </td>
                      <td className="p-4 text-right font-bold text-red-600">
                        {formatCurrency(remaining)}
                      </td>
                      <td className="p-4">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => openModal(debt)}
                            className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(debt.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                {editingDebt.id ? 'Editar Dívida' : 'Nova Dívida'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto">
              <form id="debtForm" onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pessoa</label>
                  <input
                    type="text"
                    required
                    value={editingDebt.person || ''}
                    onChange={e => setEditingDebt({...editingDebt, person: e.target.value})}
                    className="w-full p-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                    placeholder="Nome da pessoa"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor Total</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={editingDebt.totalAmount || ''}
                      onChange={e => setEditingDebt({...editingDebt, totalAmount: Number(e.target.value)})}
                      className="w-full p-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor Pago</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingDebt.paidAmount || ''}
                      onChange={e => setEditingDebt({...editingDebt, paidAmount: Number(e.target.value)})}
                      className="w-full p-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observações (Opcional)</label>
                  <textarea
                    value={editingDebt.notes || ''}
                    onChange={e => setEditingDebt({...editingDebt, notes: e.target.value})}
                    className="w-full p-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none resize-none h-24"
                    placeholder="Detalhes sobre a dívida..."
                  />
                </div>
              </form>
            </div>

            <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="debtForm"
                className="flex-1 py-2.5 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-500/30 flex items-center justify-center gap-2"
              >
                <Check size={20} />
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-sm w-full">
                <h3 className="text-lg font-bold mb-2 dark:text-white">Excluir Dívida?</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">Esta ação não pode ser desfeita.</p>
                <div className="flex gap-3">
                    <button 
                        onClick={() => setDeleteConfirmation({isOpen: false, id: null})} 
                        className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={confirmDelete} 
                        className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-500/30"
                    >
                        Excluir
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <Info className="text-primary-500" /> Como funciona o Controle de Dívidas?
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
                O <strong>Controle de Dívidas</strong> ajuda você a acompanhar o que você deve ou o que devem a você.
              </p>
              
              <div className="space-y-3 mt-4">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-1.5 rounded text-blue-600 dark:text-blue-400 mt-0.5">
                    <Plus size={16} />
                  </div>
                  <div>
                    <strong className="text-gray-800 dark:text-gray-200 block">Nova Dívida:</strong>
                    <p className="mt-1 opacity-90">
                      Adicione uma nova dívida informando a pessoa ou instituição, o valor total e, se já houver, o valor pago.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 mt-4">
                  <div className="bg-emerald-100 dark:bg-emerald-900/30 p-1.5 rounded text-emerald-600 dark:text-emerald-400 mt-0.5">
                    <Edit2 size={16} />
                  </div>
                  <div>
                    <strong className="text-gray-800 dark:text-gray-200 block">Atualizar Pagamentos:</strong>
                    <p className="mt-1 opacity-90">
                      Conforme você for pagando (ou recebendo), edite a dívida e atualize o "Valor Pago". O sistema calcula automaticamente o restante e a barra de progresso.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 mt-4">
                  <div className="bg-purple-100 dark:bg-purple-900/30 p-1.5 rounded text-purple-600 dark:text-purple-400 mt-0.5">
                    <Check size={16} />
                  </div>
                  <div>
                    <strong className="text-gray-800 dark:text-gray-200 block">Dívidas Quitadas:</strong>
                    <p className="mt-1 opacity-90">
                      Quando o valor pago for igual ao valor total, a dívida será marcada como quitada (100%) e ficará verde.
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

export default Debts;
