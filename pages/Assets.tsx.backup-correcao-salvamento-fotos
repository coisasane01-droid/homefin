import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/db';
import { Asset } from '../types';
import { formatCurrency, generateId } from '../utils';
import { Gem, Plus, Image, Upload, X, Edit2, Trash2, Info } from 'lucide-react';

const Assets: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newAsset, setNewAsset] = useState<Partial<Asset>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    const data = await db.getAssets();
    setAssets(data);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAsset.name || !newAsset.purchaseValue) return;

    await db.updateAsset({
      id: newAsset.id || generateId(),
      name: newAsset.name,
      purchaseValue: Number(newAsset.purchaseValue),
      purchaseDate: newAsset.purchaseDate || new Date().toISOString().split('T')[0],
      photoUrl: newAsset.photoUrl,
      notes: newAsset.notes || ''
    });

    loadAssets();
    setIsModalOpen(false);
    setNewAsset({});
  };

  const handleDelete = async (id: string) => {
    if (confirmDeleteId === id) {
      await db.deleteAsset(id);
      setConfirmDeleteId(null);
      loadAssets();
    } else {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(null), 3000);
    }
  };

  const handleEdit = (asset: Asset) => {
    setNewAsset(asset);
    setIsModalOpen(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewAsset(prev => ({ ...prev, photoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const totalEquity = assets.reduce((acc, a) => acc + a.purchaseValue, 0);

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
            <h2 className="text-2xl font-bold dark:text-white flex items-center gap-2">
            <Gem className="text-primary-600" /> Bens e Patrimônio
            <button 
              onClick={() => setShowInfoModal(true)}
              className="p-1.5 text-gray-400 hover:text-primary-500 bg-white dark:bg-gray-800 rounded-full shadow-sm border border-gray-100 dark:border-gray-700 transition-colors ml-2"
              title="Como funciona Bens e Patrimônio?"
            >
              <Info size={18} />
            </button>
            </h2>
            <p className="text-gray-500 text-sm mt-1">Gerencie suas conquistas</p>
        </div>
        
        <div className="bg-gradient-to-r from-primary-600 to-indigo-600 text-white px-6 py-3 rounded-xl shadow-lg">
            <p className="text-xs opacity-80 uppercase font-semibold">Patrimônio Total</p>
            <p className="text-2xl font-bold">{formatCurrency(totalEquity)}</p>
        </div>
      </div>

      <button 
        onClick={() => setIsModalOpen(true)}
        className="w-full md:w-auto mb-6 bg-white dark:bg-gray-800 text-primary-600 border border-primary-200 px-6 py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        <Plus size={20} /> Registrar Novo Bem
      </button>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {assets.map(asset => (
            <div key={asset.id} className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700 relative group flex flex-col">
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button 
                    onClick={() => handleEdit(asset)}
                    className="p-2 bg-white/90 dark:bg-gray-800/90 text-gray-600 dark:text-gray-300 hover:text-blue-500 rounded-lg shadow-sm backdrop-blur-sm transition-colors"
                    title="Editar"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => handleDelete(asset.id)}
                    className={`p-2 bg-white/90 dark:bg-gray-800/90 rounded-lg shadow-sm backdrop-blur-sm transition-colors ${
                      confirmDeleteId === asset.id ? 'text-red-600 bg-red-50 dark:bg-red-900/50' : 'text-gray-600 dark:text-gray-300 hover:text-red-500'
                    }`}
                    title="Excluir"
                  >
                    {confirmDeleteId === asset.id ? <Trash2 size={16} /> : <X size={16} />}
                  </button>
                </div>

                <div className="h-40 bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden relative">
                    {asset.photoUrl ? (
                        <img 
                          src={asset.photoUrl} 
                          alt={asset.name} 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                    ) : (
                        <Image className="text-gray-400 w-12 h-12" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                </div>
                <div className="p-4 flex-1 flex flex-col">
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg">{asset.name}</h3>
                    <p className="text-gray-500 text-sm mb-3">Adquirido em {new Date(asset.purchaseDate).toLocaleDateString('pt-BR')}</p>
                    {asset.notes && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 italic flex-1" title={asset.notes}>
                        "{asset.notes}"
                      </p>
                    )}
                    <p className={`text-xl font-bold text-emerald-600 ${!asset.notes ? 'mt-auto' : ''}`}>{formatCurrency(asset.purchaseValue)}</p>
                </div>
            </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold dark:text-white">Novo Bem</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                    <X size={24} />
                </button>
            </div>
            
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome do Bem</label>
                <input 
                    className="w-full p-3 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                    placeholder="Ex: Carro, Casa, Notebook"
                    required
                    value={newAsset.name || ''}
                    onChange={e => setNewAsset({...newAsset, name: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor Pago</label>
                    <input 
                        type="number"
                        className="w-full p-3 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                        placeholder="0,00"
                        required
                        value={newAsset.purchaseValue || ''}
                        onChange={e => setNewAsset({...newAsset, purchaseValue: parseFloat(e.target.value)})}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data de Aquisição</label>
                    <input 
                        type="date"
                        className="w-full p-3 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                        required
                        value={newAsset.purchaseDate || new Date().toISOString().split('T')[0]}
                        onChange={e => setNewAsset({...newAsset, purchaseDate: e.target.value})}
                    />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Foto do Bem</label>
                <div className="space-y-3">
                    <input 
                        type="url"
                        className="w-full p-3 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                        placeholder="Cole a URL da foto aqui..."
                        value={newAsset.photoUrl && !newAsset.photoUrl.startsWith('data:') ? newAsset.photoUrl : ''}
                        onChange={e => setNewAsset({...newAsset, photoUrl: e.target.value})}
                    />
                    
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                            <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">ou</span>
                        </div>
                    </div>

                    <input 
                        type="file" 
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileSelect}
                    />
                    
                    <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        <Upload size={20} />
                        <span className="text-sm font-medium">Subir do Aparelho</span>
                    </button>

                    {newAsset.photoUrl && (
                        <div className="relative w-full h-32 rounded-xl overflow-hidden border dark:border-gray-700">
                            <img src={newAsset.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                            <button 
                                type="button"
                                onClick={() => setNewAsset({...newAsset, photoUrl: ''})}
                                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full shadow-lg"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observação</label>
                <textarea
                  className="w-full p-3 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                  placeholder="Observação (Opcional)"
                  rows={3}
                  value={newAsset.notes || ''}
                  onChange={e => setNewAsset({...newAsset, notes: e.target.value})}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-bold shadow-lg shadow-primary-500/30">Salvar</button>
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
                <Info className="text-primary-500" /> Como funciona Bens e Patrimônio?
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
                A área de <strong>Bens e Patrimônio</strong> é onde você registra suas grandes conquistas físicas, como imóveis, veículos, eletrônicos caros ou joias.
              </p>
              
              <div className="space-y-3 mt-4">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-1.5 rounded text-blue-600 dark:text-blue-400 mt-0.5">
                    <Plus size={16} />
                  </div>
                  <div>
                    <strong className="text-gray-800 dark:text-gray-200 block">Registrar um Bem:</strong>
                    <p className="mt-1 opacity-90">
                      Clique em "Registrar Novo Bem" e informe o nome, o valor de compra e a data em que você o adquiriu. Você também pode adicionar uma foto para deixar o registro mais bonito.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 mt-4">
                  <div className="bg-emerald-100 dark:bg-emerald-900/30 p-1.5 rounded text-emerald-600 dark:text-emerald-400 mt-0.5">
                    <Gem size={16} />
                  </div>
                  <div>
                    <strong className="text-gray-800 dark:text-gray-200 block">Patrimônio Total:</strong>
                    <p className="mt-1 opacity-90">
                      O sistema soma automaticamente o valor de todos os seus bens e exibe o seu "Patrimônio Total" no topo da página. Isso ajuda você a ter uma visão clara da sua riqueza acumulada.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 mt-4">
                  <div className="bg-purple-100 dark:bg-purple-900/30 p-1.5 rounded text-purple-600 dark:text-purple-400 mt-0.5">
                    <Edit2 size={16} />
                  </div>
                  <div>
                    <strong className="text-gray-800 dark:text-gray-200 block">Gerenciar Bens:</strong>
                    <p className="mt-1 opacity-90">
                      Passe o mouse (ou toque) sobre um bem para ver as opções de Editar ou Excluir. Se um bem valorizar ou desvalorizar, você pode atualizar o valor dele a qualquer momento.
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

export default Assets;