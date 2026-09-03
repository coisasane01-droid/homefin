import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/db';
import { Goal } from '../types';
import { formatCurrency, generateId } from '../utils';
import { Target, Plus, X, Edit2, Trash2, Image as ImageIcon, Upload, Info } from 'lucide-react';

const Goals: React.FC = () => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newGoal, setNewGoal] = useState<Partial<Goal>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadGoals();
  }, []);

  const loadGoals = async () => {
    const data = await db.getGoals();
    setGoals(data);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewGoal({ ...newGoal, photoUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoal.title || !newGoal.targetAmount) return;

    await db.updateGoal({
      id: newGoal.id || generateId(),
      title: newGoal.title,
      targetAmount: Number(newGoal.targetAmount),
      currentAmount: Number(newGoal.currentAmount || 0),
      deadline: newGoal.deadline || '',
      photoUrl: newGoal.photoUrl || '',
      notes: newGoal.notes || ''
    });

    loadGoals();
    setIsModalOpen(false);
    setNewGoal({});
  };

  const handleDelete = async (id: string) => {
    if (confirmDeleteId === id) {
      await db.deleteGoal(id);
      setConfirmDeleteId(null);
      loadGoals();
    } else {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(null), 3000);
    }
  };

  const handleEdit = (goal: Goal) => {
    setNewGoal(goal);
    setIsModalOpen(true);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold dark:text-white flex items-center gap-2">
          <Target className="text-primary-600" /> Metas e Sonhos
          <button 
            onClick={() => setShowInfoModal(true)}
            className="p-1.5 text-gray-400 hover:text-primary-500 bg-white dark:bg-gray-800 rounded-full shadow-sm border border-gray-100 dark:border-gray-700 transition-colors ml-2"
            title="Como funcionam as Metas?"
          >
            <Info size={18} />
          </button>
        </h2>
        <button 
          onClick={() => { setNewGoal({}); setIsModalOpen(true); }}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Plus size={18} /> Nova Meta
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {goals.map(goal => {
          const progress = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
          return (
            <div key={goal.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 relative group overflow-hidden flex flex-col">
              {goal.photoUrl && (
                <div className="h-32 w-full bg-gray-200 dark:bg-gray-700 relative">
                  <img 
                    src={goal.photoUrl} 
                    alt={goal.title} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                </div>
              )}
              
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button 
                  onClick={() => handleEdit(goal)}
                  className="p-2 bg-white/90 dark:bg-gray-800/90 text-gray-600 dark:text-gray-300 hover:text-blue-500 rounded-lg shadow-sm backdrop-blur-sm transition-colors"
                  title="Editar"
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  onClick={() => handleDelete(goal.id)}
                  className={`p-2 bg-white/90 dark:bg-gray-800/90 rounded-lg shadow-sm backdrop-blur-sm transition-colors ${
                    confirmDeleteId === goal.id ? 'text-red-600 bg-red-50 dark:bg-red-900/50' : 'text-gray-600 dark:text-gray-300 hover:text-red-500'
                  }`}
                  title="Excluir"
                >
                  {confirmDeleteId === goal.id ? <Trash2 size={16} /> : <X size={16} />}
                </button>
              </div>
              
              <div className="p-6 flex-1 flex flex-col justify-between">
                <div className="flex justify-between items-start mb-4">
                  <div className={goal.photoUrl ? "text-white absolute top-4 left-4 z-10 drop-shadow-md" : ""}>
                    <h3 className={`font-bold text-lg ${goal.photoUrl ? 'text-white' : 'text-gray-800 dark:text-white'}`}>{goal.title}</h3>
                    {goal.deadline && (
                      <p className={`text-xs ${goal.photoUrl ? 'text-gray-200' : 'text-gray-500'}`}>Prazo: {new Date(goal.deadline).toLocaleDateString('pt-BR')}</p>
                    )}
                  </div>
                  <div className={`text-right ${goal.photoUrl ? 'mt-8' : ''}`}>
                     <p className="text-xs text-gray-500 uppercase">Alvo</p>
                     <p className="font-bold text-primary-600">{formatCurrency(goal.targetAmount)}</p>
                  </div>
                </div>

                <div>
                  {goal.notes && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 italic line-clamp-2" title={goal.notes}>
                      "{goal.notes}"
                    </p>
                  )}
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-300">Guardado: {formatCurrency(goal.currentAmount)}</span>
                    <span className="font-bold text-gray-800 dark:text-white">{progress}%</span>
                  </div>

                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-primary-500 to-indigo-600 h-3 rounded-full transition-all duration-1000"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4 dark:text-white">Nova Meta</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <input 
                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Nome da Meta (Ex: Viagem)"
                required
                value={newGoal.title || ''}
                onChange={e => setNewGoal({...newGoal, title: e.target.value})}
              />
              <div className="grid grid-cols-2 gap-4">
                <input 
                    type="number"
                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Valor Alvo"
                    required
                    value={newGoal.targetAmount || ''}
                    onChange={e => setNewGoal({...newGoal, targetAmount: parseFloat(e.target.value)})}
                />
                <input 
                    type="number"
                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Já guardado"
                    value={newGoal.currentAmount || ''}
                    onChange={e => setNewGoal({...newGoal, currentAmount: parseFloat(e.target.value)})}
                />
              </div>
              <input 
                type="date"
                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                value={newGoal.deadline || ''}
                onChange={e => setNewGoal({...newGoal, deadline: e.target.value})}
              />
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <ImageIcon size={18} className="text-gray-400" />
                  </div>
                  <input 
                    type="url"
                    className="w-full pl-10 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="URL da Foto (Opcional)"
                    value={newGoal.photoUrl || ''}
                    onChange={e => setNewGoal({...newGoal, photoUrl: e.target.value})}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 border rounded dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center justify-center"
                  title="Enviar do aparelho"
                >
                  <Upload size={20} />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>
              <textarea
                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-none"
                placeholder="Observação (Opcional)"
                rows={3}
                value={newGoal.notes || ''}
                onChange={e => setNewGoal({...newGoal, notes: e.target.value})}
              />
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2 bg-gray-200 rounded text-gray-800">Cancelar</button>
                <button type="submit" className="flex-1 py-2 bg-primary-600 text-white rounded font-bold">Salvar</button>
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
                <Info className="text-primary-500" /> Como funcionam as Metas?
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
                A área de <strong>Metas e Sonhos</strong> é onde você planeja suas conquistas financeiras, como uma viagem, um carro novo ou uma reserva de emergência.
              </p>
              
              <div className="space-y-3 mt-4">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-1.5 rounded text-blue-600 dark:text-blue-400 mt-0.5">
                    <Plus size={16} />
                  </div>
                  <div>
                    <strong className="text-gray-800 dark:text-gray-200 block">Criar uma Meta:</strong>
                    <p className="mt-1 opacity-90">
                      Defina um nome, o valor que você quer alcançar (Objetivo) e o valor que você já tem guardado (Atual). Você também pode adicionar uma data limite e uma foto inspiradora!
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 mt-4">
                  <div className="bg-emerald-100 dark:bg-emerald-900/30 p-1.5 rounded text-emerald-600 dark:text-emerald-400 mt-0.5">
                    <Target size={16} />
                  </div>
                  <div>
                    <strong className="text-gray-800 dark:text-gray-200 block">Acompanhar o Progresso:</strong>
                    <p className="mt-1 opacity-90">
                      O sistema calcula automaticamente a porcentagem concluída e exibe uma barra de progresso. Se você definir uma data, ele também mostrará quanto tempo falta.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 mt-4">
                  <div className="bg-purple-100 dark:bg-purple-900/30 p-1.5 rounded text-purple-600 dark:text-purple-400 mt-0.5">
                    <Edit2 size={16} />
                  </div>
                  <div>
                    <strong className="text-gray-800 dark:text-gray-200 block">Atualizar Valores:</strong>
                    <p className="mt-1 opacity-90">
                      Sempre que guardar mais dinheiro, clique no ícone de lápis para editar a meta e atualizar o "Valor Atual". A barra de progresso vai se encher até você atingir 100%!
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

export default Goals;